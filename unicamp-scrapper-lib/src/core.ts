export type FetchOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type ScraperLogFields = Record<string, unknown>;
export type ScraperTelemetry = {
  span<Result>(
    name: string,
    attributes: Record<string, string | number | boolean>,
    operation: () => Promise<Result> | Result,
  ): Promise<Result>;
  count(
    name: string,
    value: number,
    attributes: Record<string, string | number | boolean>,
  ): void;
  duration(
    name: string,
    valueMs: number,
    attributes: Record<string, string | number | boolean>,
  ): void;
};

export interface ScraperLogger {
  debug(fields: ScraperLogFields, message: string): void;
  info(fields: ScraperLogFields, message: string): void;
  warn(fields: ScraperLogFields, message: string): void;
  error(fields: ScraperLogFields, message: string): void;
}

export interface PageFetcher {
  fetch(url: string, options?: FetchOptions): Promise<string>;
}

export type ScrapeIssue = {
  adapter: string;
  input: unknown;
  code:
    | "unexpected-section"
    | "missing-required-section"
    | "invalid-format"
    | "invalid-value"
    | "unrecognized-content"
    | "load-error";
  path?: string;
  message: string;
  expected?: string;
  actual?: unknown;
  timestamp: string;
};

export function isIgnoredSourceIssue(issue: {
  adapter?: string;
  code?: string;
  path?: string;
  actual?: unknown;
}): boolean {
  const invalidAttendance =
    issue.code === "invalid-format" &&
    issue.adapter === "catalogo-disciplinas-prefixo" &&
    issue.path?.endsWith(".minimumAttendancePercent") === true &&
    issue.actual === "$disc.perMinFreq%";
  return invalidAttendance;
}

export type ScrapeReporter = {
  info(fields: ScraperLogFields, message: string): void;
  issue(issue: Omit<ScrapeIssue, "adapter" | "input" | "timestamp">): void;
};

export type PageMetadata = {
  adapter: string;
  input: unknown;
  fetchedAt: string;
};

export type PageResult<Data> = {
  data: Data;
  metadata: PageMetadata;
};

export type ScrapeResult<Data> = {
  data: Data;
  issues: ScrapeIssue[];
  pages: PageMetadata[];
};

export interface PageAdapter<Input, Data> {
  id: string;
  fetch(input: Input, context: ScrapingContext): Promise<string>;
  parse(html: string, input: Input, reporter?: ScrapeReporter): Data;
}

export type ScrapingContext = {
  fetcher: PageFetcher;
  logger: ScraperLogger;
  concurrency: number;
  load<Input, Data>(
    adapter: PageAdapter<Input, Data>,
    input: Input,
  ): Promise<PageResult<Data>>;
  tryLoad<Input, Data>(
    adapter: PageAdapter<Input, Data>,
    input: Input,
  ): Promise<PageResult<Data> | undefined>;
  map<Input, Output>(
    inputs: readonly Input[],
    worker: (input: Input) => Promise<Output>,
  ): Promise<Output[]>;
  issues: ScrapeIssue[];
  pages: PageMetadata[];
};

export function createScrapingContext(
  fetcher: PageFetcher,
  options: {
    concurrency?: number;
    logger?: ScraperLogger;
    telemetry?: ScraperTelemetry;
  } = {},
): ScrapingContext {
  const issues: ScrapeIssue[] = [];
  const pages: PageMetadata[] = [];
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const context = {} as ScrapingContext;
  const logger = options.logger ?? noopLogger;
  const telemetry = options.telemetry;

  context.fetcher = fetcher;
  context.logger = logger;
  context.concurrency = concurrency;
  context.issues = issues;
  context.pages = pages;
  context.load = async <Input, Data>(
    adapter: PageAdapter<Input, Data>,
    input: Input,
  ): Promise<PageResult<Data>> => {
    const startedAt = Date.now();
    logger.info(
      { event: "scrape.page.start", adapter: adapter.id, input },
      "Página iniciada",
    );
    try {
      const html = telemetry
        ? await telemetry.span(
            "scraper.page",
            { "scraper.adapter": adapter.id },
            () => adapter.fetch(input, context),
          )
        : await adapter.fetch(input, context);
      const metadata: PageMetadata = {
        adapter: adapter.id,
        input,
        fetchedAt: new Date().toISOString(),
      };
      const reporter: ScrapeReporter = {
        info: (fields, message) =>
          logger.info({ ...fields, adapter: adapter.id, input }, message),
        issue: (issue) => {
          const completeIssue: ScrapeIssue = {
            ...issue,
            adapter: adapter.id,
            input,
            timestamp: new Date().toISOString(),
          };
          issues.push(completeIssue);
          if (isIgnoredSourceIssue(completeIssue)) return;
          logger.warn(
            {
              event: "scrape.issue",
              adapter: adapter.id,
              input,
              ...issue,
            },
            issue.message,
          );
        },
      };
      const parsed = telemetry
        ? await telemetry.span(
            "scraper.parse",
            { "scraper.adapter": adapter.id },
            () => adapter.parse(html, input, reporter),
          )
        : adapter.parse(html, input, reporter);
      const result = { data: parsed, metadata };
      pages.push(metadata);
      logger.info(
        {
          event: "scrape.page.success",
          adapter: adapter.id,
          durationMs: Date.now() - startedAt,
        },
        "Página concluída",
      );
      telemetry?.count("scrape_pages_total", 1, {
        adapter: adapter.id,
        outcome: "success",
      });
      telemetry?.duration("scrape_page_duration_ms", Date.now() - startedAt, {
        adapter: adapter.id,
      });
      return result;
    } catch (error) {
      logger.error(
        {
          event: "scrape.page.error",
          adapter: adapter.id,
          durationMs: Date.now() - startedAt,
          err: error instanceof Error ? error.message : String(error),
        },
        "Falha ao carregar página",
      );
      telemetry?.count("scrape_pages_total", 1, {
        adapter: adapter.id,
        outcome: "failed",
      });
      telemetry?.duration("scrape_page_duration_ms", Date.now() - startedAt, {
        adapter: adapter.id,
      });
      throw error;
    }
  };
  context.tryLoad = async <Input, Data>(
    adapter: PageAdapter<Input, Data>,
    input: Input,
  ): Promise<PageResult<Data> | undefined> => {
    try {
      return await context.load(adapter, input);
    } catch (error) {
      issues.push({
        adapter: adapter.id,
        input,
        code: "load-error",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      logger.warn(
        {
          event: "scrape.issue",
          adapter: adapter.id,
          input,
          code: "load-error",
          err: error instanceof Error ? error.message : String(error),
        },
        "Issue de scraping",
      );
      return undefined;
    }
  };
  context.map = async <Input, Output>(
    inputs: readonly Input[],
    worker: (input: Input) => Promise<Output>,
  ): Promise<Output[]> => {
    const output: Output[] = [];
    let next = 0;
    const run = async (): Promise<void> => {
      while (next < inputs.length) {
        const index = next++;
        output[index] = await worker(inputs[index]);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, inputs.length) }, run),
    );
    return output;
  };
  return context;
}

const noopLogger: ScraperLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export async function crawl<Input, Data>(
  input: Input,
  context: ScrapingContext,
  load: (input: Input, context: ScrapingContext) => Promise<Data>,
): Promise<ScrapeResult<Data>> {
  return {
    data: await load(input, context),
    issues: context.issues,
    pages: context.pages,
  };
}
