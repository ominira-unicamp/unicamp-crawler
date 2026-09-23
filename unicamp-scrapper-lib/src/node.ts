import { decodeBuffer } from "encoding-sniffer";

import type {
  FetchOptions,
  PageFetcher,
  ScraperLogger,
  ScraperTelemetry,
} from "./core.js";

type QueueTask = {
  url: string;
  options?: FetchOptions;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
};


async function decodeHtmlResponse(response: Response): Promise<string> {
  const buffer = Buffer.from(await response.arrayBuffer());

  const contentType = response.headers.get("content-type");
  const charset = contentType
    ?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];

  return decodeBuffer(buffer, {
    transportLayerEncodingLabel: charset,
  });
}

export function createNodePageFetcher(
  options: {
    retries?: number;
    minIntervalMs?: number;
    maxConcurrent?: number;
    fetch?: typeof fetch;
    logger?: ScraperLogger;
    telemetry?: ScraperTelemetry;
  } = {},
): PageFetcher {
  const client = options.fetch ?? fetch;
  const retries = options.retries ?? 6;
  const minIntervalMs = options.minIntervalMs ?? 1_000;
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 1);
  const logger = options.logger;
  const telemetry = options.telemetry;
  const queue: QueueTask[] = [];
  let active = 0;
  let nextRequestAt = 0;
  let pumping = false;

  const pump = async (): Promise<void> => {
    if (pumping) return;
    pumping = true;
    try {
      while (active < maxConcurrent && queue.length > 0) {
        const task = queue.shift()!;
        if (task.options?.signal?.aborted) {
          task.reject(abortError());
          continue;
        }
        const wait = nextRequestAt - Date.now();
        if (wait > 0) await sleep(wait);
        if (task.options?.signal?.aborted) {
          task.reject(abortError());
          continue;
        }
        nextRequestAt = Date.now() + minIntervalMs;
        active += 1;
        void execute(task)
          .then(task.resolve, task.reject)
          .finally(() => {
            active -= 1;
            void pump();
          });
      }
    } finally {
      pumping = false;
    }
  };

  const execute = async (task: QueueTask): Promise<string> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < retries; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await client(task.url, {
          headers: {
            "User-Agent": "Unicamp scraper/1.0",
            Accept: "text/html,application/xhtml+xml",
            ...task.options?.headers,
          },
          signal: task.options?.signal,
        });
        if (response.ok) {
          const html = await decodeHtmlResponse(response);
          logger?.info(
            {
              event: "scrape.request.success",
              ...safeUrl(task.url),
              attempt: attempt + 1,
              status: response.status,
              durationMs: Date.now() - startedAt,
              active,
            },
            "Requisição concluída",
          );
          telemetry?.count("scrape_http_requests_total", 1, {
            host: safeHost(task.url),
            status_class: `${Math.floor(response.status / 100)}xx`,
            outcome: "success",
          });
          telemetry?.duration("scrape_http_request_duration_ms", Date.now() - startedAt, {
            host: safeHost(task.url),
          });
          return html;
        }
        if (![429, 500, 502, 503, 504].includes(response.status))
          throw new Error(`HTTP ${response.status} em ${safeUrl(task.url).url}`);
        lastError = new Error(`HTTP ${response.status} em ${safeUrl(task.url).url}`);
        const delayMs = retryDelay(response, attempt);
        logger?.warn(
          {
            event: "scrape.request.retry",
            ...safeUrl(task.url),
            attempt: attempt + 1,
            status: response.status,
            delayMs,
          },
          "Repetindo requisição",
        );
        telemetry?.count("scrape_retries_total", 1, {
          host: safeHost(task.url),
          reason: `http_${response.status}`,
        });
        await sleep(delayMs);
      } catch (error) {
        if (task.options?.signal?.aborted) throw abortError();
        lastError = error;
        telemetry?.count("scrape_http_requests_total", 1, {
          host: safeHost(task.url),
          status_class: "error",
          outcome: "failed",
        });
        telemetry?.duration("scrape_http_request_duration_ms", Date.now() - startedAt, {
          host: safeHost(task.url),
        });
        const delayMs = 1_000 * (attempt + 1);
        if (attempt + 1 < retries)
          logger?.warn(
            {
              event: "scrape.request.retry",
              ...safeUrl(task.url),
              attempt: attempt + 1,
              delayMs,
              err: error instanceof Error ? error.message : String(error),
            },
            "Repetindo requisição após erro",
          );
        await sleep(delayMs);
      }
    }
    logger?.error(
      { event: "scrape.request.error", ...safeUrl(task.url), retries },
      "Requisição esgotou as tentativas",
    );
    throw lastError ?? new Error(`Não foi possível baixar ${safeUrl(task.url).url}`);
  };

  return {
    fetch(url: string, fetchOptions?: FetchOptions): Promise<string> {
      return new Promise((resolve, reject) => {
        queue.push({ url, options: fetchOptions, resolve, reject });
        void pump();
      });
    },
  };
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

function safeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return { url: `${parsed.origin}${parsed.pathname}`, host: parsed.host, path: parsed.pathname };
  } catch {
    return { url: "invalid", host: "invalid", path: "invalid" };
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return Math.min(60_000, 2_000 * 2 ** attempt);
}

function abortError(): Error {
  return new DOMException("A requisição foi cancelada", "AbortError");
}

function sleep(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay));
}
