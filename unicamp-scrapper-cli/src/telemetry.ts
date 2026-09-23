import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions";
import type { ScraperTelemetry } from "unicamp-scrapper-lib";

let tracerProvider: NodeTracerProvider | undefined;
let meterProvider: MeterProvider | undefined;
let initialized = false;

export function initializeScraperTelemetry(): void {
  if (initialized) return;
  initialized = true;
  const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const metricsEndpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
  if (!tracesEndpoint && !metricsEndpoint) return;
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "unicamp-scrapper",
    [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? "unknown",
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
      process.env.DEPLOYMENT_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? "development",
    "cloud.provider": process.env.CLOUD_PROVIDER ?? "aws",
    "cloud.region": process.env.AWS_REGION ?? "sa-east-1",
  });
  const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
  if (tracesEndpoint) {
    tracerProvider = new NodeTracerProvider({
      resource,
      sampler: new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(parseRatio(process.env.OTEL_TRACE_SAMPLE_RATIO)),
      }),
      spanProcessors: [
        new BatchSpanProcessor(new OTLPTraceExporter({ url: tracesEndpoint, headers, timeoutMillis: 5_000 })),
      ],
    });
    tracerProvider.register();
  }
  if (metricsEndpoint) {
    meterProvider = new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: metricsEndpoint, headers, timeoutMillis: 5_000 }),
          exportIntervalMillis: 15_000,
        }),
      ],
    });
    metrics.setGlobalMeterProvider(meterProvider);
  }
  registerInstrumentations({
    tracerProvider,
    instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation()],
  });
}

export function createScraperTelemetry(): ScraperTelemetry {
  const meter = meterProvider?.getMeter("unicamp-scrapper");
  const counters = new Map<string, ReturnType<NonNullable<typeof meter>["createCounter"]>>();
  const histograms = new Map<string, ReturnType<NonNullable<typeof meter>["createHistogram"]>>();
  return {
    async span<Result>(
      name: string,
      attributes: Record<string, string | number | boolean>,
      operation: () => Promise<Result> | Result,
    ) {
      const tracer = trace.getTracer("unicamp-scrapper");
      return tracer.startActiveSpan(name, { attributes }, async (span) => {
        try {
          const result = await operation();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      });
    },
    count(name, value, attributes) {
      if (!meter) return;
      let counter = counters.get(name);
      if (!counter) {
        counter = meter.createCounter(name);
        counters.set(name, counter);
      }
      counter.add(value, attributes);
    },
    duration(name, valueMs, attributes) {
      if (!meter) return;
      let histogram = histograms.get(name);
      if (!histogram) {
        histogram = meter.createHistogram(name, { unit: "ms" });
        histograms.set(name, histogram);
      }
      histogram.record(valueMs, attributes);
    },
  };
}

export async function shutdownScraperTelemetry(): Promise<void> {
  await Promise.allSettled([tracerProvider?.shutdown(), meterProvider?.shutdown()]);
}

function parseRatio(value: string | undefined): number {
  const ratio = Number(value ?? "1");
  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 1;
}

function parseHeaders(value: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (value ?? "").split(",").flatMap((entry) => {
      const separator = entry.indexOf("=");
      if (separator <= 0) return [];
      return [[entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]];
    }),
  );
}
