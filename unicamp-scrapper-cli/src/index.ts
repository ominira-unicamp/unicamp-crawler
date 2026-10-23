#!/usr/bin/env node
import { Command, Option } from "commander";
import pino, { type Level } from "pino";
import { trace } from "@opentelemetry/api";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { join } from "node:path";
import { writeHeapSnapshot } from "node:v8";
import { DocentesProgressStore } from "./docentes-progress.js";
import {
  cadernoDeHorarioDisciplina,
  cadernoDeHorarioInstituto,
  cadernoDeHorarioPagina,
  calendarioGraduacaoPagina,
  cardapioDia,
  cardapioPortal,
  catalogoDisciplinasIndice,
  catalogoDisciplinasPrefixo,
  catalogoProgramas,
  catalogosIndice,
  crawlCadernoDeHorario,
  crawlCalendario,
  crawlCardapio,
  crawlCardapios,
  crawlCatalogoCurriculos,
  crawlCatalogoDisciplinas,
  crawlCatalogoInformacoes,
  crawlCatalogProgramsSnapshot,
  crawlCatalogosProgramas,
  crawlContinenciaEquivalencia,
  crawlDocentes,
  crawlExchangeNotices,
  crawlSugestaoCurriculo,
  createCachedPageFetcher,
  createScrapingContext,
  cursoCurriculo,
  cursoMembros,
  cursoSugestao,
  type PageAdapter,
  type ScrapeResult,
  type ScrapingContext,
  type ScraperLogger,
  type CatalogProgramsSnapshotProfile,
  isIgnoredSourceIssue,
} from "unicamp-scrapper-lib";
import { createNodePageFetcher } from "unicamp-scrapper-lib/node";
import { SqlitePageCache } from "./cache.js";
import { resolveCardapiosRange } from "./cardapios-range.js";
import {
  createScraperTelemetry,
  shutdownScraperTelemetry,
} from "./telemetry.js";

type CommonOptions = {
  cache?: string | false;
  refresh: boolean;
  concurrency: number;
  requestInterval: number;
  retries: number;
  fetchConcurrency: number;
  output?: string;
  logDestination?: "stdout" | "stderr";
};
type DocentesOptions = CommonOptions & {
  memorySnapshotEvery?: number;
  memorySnapshotDir?: string;
  progressDb?: string;
};

const program = new Command()
  .name("unicamp-scrapper")
  .description("Executa páginas e crawlers da Unicamp")
  .version("0.1.0");

function positiveInteger(value: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1)
    throw new Error("O valor deve ser um inteiro positivo");
  return number;
}

function nonNegativeInteger(value: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0)
    throw new Error("O valor deve ser um inteiro não negativo");
  return number;
}

function year(value: string): number {
  const number = positiveInteger(value);
  if (number < 1900 || number > 3000)
    throw new Error("O ano deve estar entre 1900 e 3000");
  return number;
}

function semester(value: string): 1 | 2 {
  const number = Number(value);
  if (number !== 1 && number !== 2)
    throw new Error("O semestre deve ser 1 ou 2");
  return number;
}

function commonOptions(command: Command): Command {
  return command
    .option("--output <file>", "grava o JSON no arquivo indicado")
    .option(
      "--log-destination <destination>",
      "destino dos logs: stdout ou stderr",
    )
    .option("--cache <file>", "banco SQLite de cache", "rawhtml.db")
    .option("--no-cache", "não lê nem grava cache SQLite")
    .option("--refresh", "rebaixa URLs e atualiza o cache")
    .addOption(
      new Option(
        "--request-interval <ms>",
        "intervalo mínimo entre requisições à DAC",
      )
        .default(100)
        .argParser(positiveInteger),
    )
    .addOption(
      new Option("--retries <n>", "tentativas por página")
        .default(6)
        .argParser(positiveInteger),
    )
    .addOption(
      new Option("--concurrency <n>", "limite de páginas simultâneas")
        .default(4)
        .argParser(positiveInteger),
    )
    .addOption(
      new Option(
        "--fetch-concurrency <n>",
        "limite global de requisições HTTP simultâneas",
      )
        .default(1)
        .argParser(positiveInteger),
    );
}

function logger(command: string, options: CommonOptions): ScraperLogger {
  const destination =
    options.logDestination ??
    process.env.UNICAMP_SCRAPPER_LOG_DESTINATION ??
    (options.output ? "stdout" : "stderr");
  if (destination !== "stdout" && destination !== "stderr")
    throw new Error("--log-destination deve ser stdout ou stderr");
  const level = (process.env.LOG_LEVEL ??
    process.env.UNICAMP_SCRAPPER_LOG_LEVEL ??
    "info") as Level;
  const streams: pino.StreamEntry[] = [
    { level, stream: pino.destination(destination === "stdout" ? 1 : 2) },
  ];
  return pino(
    {
      level,
      mixin: traceContext,
    },
    pino.multistream(streams),
  ).child({
    component: "unicamp-scrapper",
    command,
    runId: process.env.POMI_SCRAPER_RUN_ID ?? randomUUID(),
    injectionRunId: process.env.POMI_INJECTION_RUN_ID,
  });
}

function context(
  options: CommonOptions,
  log: ScraperLogger,
  telemetry: ReturnType<typeof createScraperTelemetry>,
): ScrapingContext {
  const pageFetcher = createNodePageFetcher({
    minIntervalMs: options.requestInterval,
    maxConcurrent: options.fetchConcurrency,
    retries: options.retries,
    logger: log,
    telemetry,
  });
  const fetcher =
    options.cache === false
      ? pageFetcher
      : createCachedPageFetcher(
          pageFetcher,
          new SqlitePageCache(options.cache ?? "rawhtml.db", options.refresh),
          { logger: log },
        );
  return createScrapingContext(fetcher, {
    concurrency: options.concurrency,
    logger: log,
    telemetry,
  });
}

async function pageResult<Input, Data>(
  adapter: PageAdapter<Input, Data>,
  input: Input,
  scrapingContext: ScrapingContext,
): Promise<ScrapeResult<Data>> {
  const page = await scrapingContext.load(adapter, input);
  return {
    data: page.data,
    issues: scrapingContext.issues,
    pages: scrapingContext.pages,
  };
}

async function emit(
  result: ScrapeResult<unknown>,
  output?: string,
  log?: ScraperLogger,
): Promise<void> {
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, json, "utf8");
  } else {
    process.stdout.write(json);
  }
  for (const issue of result.issues)
    if (!isIgnoredSourceIssue(issue))
      log?.warn(
        {
          event: "scrape.issue",
          adapter: issue.adapter,
          input: issue.input,
          code: issue.code,
          path: issue.path,
          expected: issue.expected,
          actual: issue.actual,
          err: issue.message,
        },
        "Issue de scraping",
      );
  if (result.issues.length > 0) process.exitCode = 1;
}

async function emitCatalogProgramsSnapshot(
  result: ScrapeResult<unknown>,
  output?: string,
  log?: ScraperLogger,
): Promise<void> {
  if (!output) throw new Error("catalog-programs-snapshot requer --output");
  const snapshot = result.data as {
    year: number;
    profile: CatalogProgramsSnapshotProfile;
    sourceFormat: string;
    components: Record<string, unknown>;
    componentStatuses: Record<string, "COMPLETE" | "UNAVAILABLE" | "FAILED">;
  };
  await mkdir(output, { recursive: true });
  const components: Record<
    string,
    {
      status: "COMPLETE" | "UNAVAILABLE" | "FAILED";
      schemaVersion: number;
      path: string | null;
      sha256: string | null;
      records: number;
    }
  > = {};
  for (const name of new Set([
    ...Object.keys(snapshot.components),
    ...Object.keys(snapshot.componentStatuses),
  ])) {
    const status = snapshot.componentStatuses[name] ?? "FAILED";
    const data = snapshot.components[name];
    if (status !== "COMPLETE") {
      components[name] = {
        status,
        schemaVersion: 1,
        path: null,
        sha256: null,
        records: 0,
      };
      continue;
    }
    if (data === undefined) {
      components[name] = {
        status: "FAILED",
        schemaVersion: 1,
        path: null,
        sha256: null,
        records: 0,
      };
      continue;
    }
    const fileName = `${name}.json`;
    const bytes = Buffer.from(
      `${JSON.stringify({ data, issues: result.issues, pages: result.pages }, null, 2)}\n`,
    );
    await writeFile(join(output, fileName), bytes);
    components[name] = {
      status,
      schemaVersion: 1,
      path: fileName,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      records: componentRecords(data),
    };
  }
  for (const name of ["curricula", "information", "suggestions"])
    if (!(name in components))
      components[name] = {
        status: "UNAVAILABLE",
        schemaVersion: 1,
        path: null,
        sha256: null,
        records: 0,
      };
  const issues = result.issues.map((issue) => ({
    ...issue,
    severity:
      isIgnoredSourceIssue(issue) || issue.blocksCompleteness === false
        ? "warning"
        : "error",
    blocksCompleteness:
      issue.blocksCompleteness ?? !isIgnoredSourceIssue(issue),
  }));
  await writeFile(
    join(output, "issues.json"),
    `${JSON.stringify(issues, null, 2)}\n`,
  );
  await writeFile(
    join(output, "manifest.json"),
    `${JSON.stringify(
      {
        protocol: "pomi.catalog-programs.snapshot",
        version: 1,
        snapshotId: process.env.POMI_SNAPSHOT_ID ?? randomUUID(),
        partition: { year: snapshot.year },
        profile: snapshot.profile,
        producer: {
          name: "unicamp-scrapper-cli",
          sourceFormat: snapshot.sourceFormat,
        },
        createdAt: new Date().toISOString(),
        status:
          issues.some((issue) => issue.blocksCompleteness) ||
          (snapshot.profile === "complete"
            ? ["programs", "curricula", "information", "suggestions"]
            : ["programs"]
          ).some((name) => components[name]?.status !== "COMPLETE")
            ? "PARTIAL"
            : "COMPLETE",
        components,
        issues,
      },
      null,
      2,
    )}\n`,
  );
  if (issues.some((issue) => issue.blocksCompleteness)) process.exitCode = 1;
  log?.info(
    { output, components: Object.keys(components) },
    "Snapshot gravado",
  );
}

function componentRecords(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const catalogs = (value as { catalogs?: unknown }).catalogs;
  return Array.isArray(catalogs)
    ? catalogs.reduce(
        (total, catalog) =>
          total +
          (Array.isArray((catalog as { programs?: unknown }).programs)
            ? (catalog as { programs: unknown[] }).programs.length
            : 0),
        0,
      )
    : 0;
}

function snapshotPartitionKey() {
  const key = process.env.POMI_SNAPSHOT_PARTITION_KEY;
  if (!key) throw new Error("POMI_SNAPSHOT_PARTITION_KEY deve ser configurada");
  return key;
}

async function emitExchangeNoticesSnapshot(
  result: ScrapeResult<unknown>,
  output: string | undefined,
  log: ScraperLogger | undefined,
  {
    protocol,
    partition,
  }: { protocol: string; partition: Record<string, string | number> },
) {
  const notices = Array.isArray(result.data) ? result.data : [];
  const locations = notices.map((notice) => ({
    place: (notice as { place?: unknown }).place,
  }));
  const attachments = notices.flatMap((notice) => {
    const files = (notice as { files?: unknown }).files;
    return Array.isArray(files)
      ? files.map((file) => ({
          place: (notice as { place?: unknown }).place,
          file,
        }))
      : [];
  });
  return emitComponentsSnapshot(result, output, log, {
    protocol,
    partition,
    components: { notices, locations, attachments },
  });
}

async function emitSingleComponentSnapshot(
  result: ScrapeResult<unknown>,
  output: string | undefined,
  log: ScraperLogger | undefined,
  {
    protocol,
    partition,
    component,
  }: {
    protocol: string;
    partition: Record<string, string | number>;
    component: string;
  },
) {
  return emitComponentsSnapshot(result, output, log, {
    protocol,
    partition,
    components: { [component]: result.data },
  });
}

async function emitComponentsSnapshot(
  result: ScrapeResult<unknown>,
  output: string | undefined,
  log: ScraperLogger | undefined,
  {
    protocol,
    partition,
    components,
    version = 1,
    producer,
    records,
    nonBlockingIssue,
  }: {
    protocol: string;
    partition: Record<string, string | number>;
    components: Record<string, unknown>;
    version?: number;
    producer?: Record<string, unknown>;
    records?: Record<string, number>;
    nonBlockingIssue?: (
      issue: ScrapeResult<unknown>["issues"][number],
    ) => boolean;
  },
) {
  if (!output) throw new Error(`${protocol} requer --output`);
  await mkdir(output, { recursive: true });
  const issues = result.issues.map((issue) => ({
    ...issue,
    severity:
      isIgnoredSourceIssue(issue) || issue.blocksCompleteness === false
        ? "warning"
        : "error",
    blocksCompleteness:
      issue.blocksCompleteness ??
      (!isIgnoredSourceIssue(issue) && !nonBlockingIssue?.(issue)),
  }));
  const blocksCompleteness = issues.some((issue) => issue.blocksCompleteness);
  await writeFile(
    join(output, "issues.json"),
    `${JSON.stringify(issues, null, 2)}\n`,
  );
  await writeFile(
    join(output, "manifest.json"),
    `${JSON.stringify(
      {
        protocol,
        version,
        snapshotId: process.env.POMI_SNAPSHOT_ID ?? randomUUID(),
        partition,
        producer: { name: "unicamp-scrapper-cli", ...producer },
        createdAt: new Date().toISOString(),
        status: blocksCompleteness ? "PARTIAL" : "COMPLETE",
        components: Object.fromEntries(
          await Promise.all(
            Object.entries(components).map(async ([name, data]) => {
              const fileName = `${name}.json`;
              const bytes = Buffer.from(
                `${JSON.stringify({ data, issues: result.issues, pages: result.pages }, null, 2)}\n`,
              );
              await writeFile(join(output, fileName), bytes);
              return [
                name,
                {
                  status: blocksCompleteness ? "FAILED" : "COMPLETE",
                  schemaVersion: version,
                  path: fileName,
                  sha256: createHash("sha256").update(bytes).digest("hex"),
                  records:
                    records?.[name] ?? (Array.isArray(data) ? data.length : 1),
                },
              ];
            }),
          ),
        ),
        issues,
      },
      null,
      2,
    )}\n`,
  );
  if (blocksCompleteness) process.exitCode = 1;
  log?.info(
    { output, components: Object.keys(components) },
    "Snapshot gravado",
  );
}

async function emitDailyMenusSnapshot(
  result: ScrapeResult<unknown>,
  output: string | undefined,
  log: ScraperLogger | undefined,
  {
    protocol,
    partition,
  }: { protocol: string; partition: Record<string, string | number> },
) {
  const unavailableDates = result.issues.flatMap((issue) =>
    issue.adapter === "cardapio-dia" &&
    issue.code === "load-error" &&
    typeof (issue.input as { date?: unknown }).date === "string"
      ? [(issue.input as { date: string }).date]
      : [],
  );
  return emitComponentsSnapshot(result, output, log, {
    protocol,
    partition,
    components: { menus: result.data, availability: { unavailableDates } },
    nonBlockingIssue: (issue) =>
      unavailableDates.includes((issue.input as { date?: string }).date ?? ""),
  });
}

function action<Options extends CommonOptions>(
  runner: (
    options: Options,
    scrapingContext: ScrapingContext,
  ) => Promise<ScrapeResult<unknown>>,
  resultEmitter: (
    result: ScrapeResult<unknown>,
    output?: string,
    log?: ScraperLogger,
    options?: Options,
  ) => Promise<void> = emit,
) {
  return async (options: Options, command: Command): Promise<void> => {
    const log = logger(command.name(), options);
    const telemetry = createScraperTelemetry();
    const startedAt = Date.now();
    const commandName = command.name();
    log.info(
      {
        event: "scrape.start",
        command: commandName,
        cacheMode: options.cache === false ? "disabled" : "sqlite",
        options: { ...options, output: undefined },
      },
      "Scraping iniciado",
    );
    try {
      const result = await telemetry.span(
        "scraper.run",
        {
          "scraper.command": commandName,
          "scraper.cache_mode": options.cache === false ? "disabled" : "sqlite",
        },
        () => runner(options, context(options, log, telemetry)),
      );
      await resultEmitter(result, options.output, log, options);
      const outcome = result.issues.length > 0 ? "partial" : "success";
      telemetry.count("scrape_runs_total", 1, {
        command: commandName,
        outcome,
      });
      telemetry.duration("scrape_run_duration_ms", Date.now() - startedAt, {
        command: commandName,
      });
      log.info(
        {
          event: "scrape.complete",
          command: commandName,
          outcome,
          pagesTotal: result.pages.length,
          issuesTotal: result.issues.length,
          durationMs: Date.now() - startedAt,
        },
        "Scraping concluído",
      );
    } catch (error) {
      telemetry.count("scrape_runs_total", 1, {
        command: commandName,
        outcome: "failed",
      });
      telemetry.duration("scrape_run_duration_ms", Date.now() - startedAt, {
        command: commandName,
      });
      log.error(
        {
          event: "scrape.error",
          durationMs: Date.now() - startedAt,
          err: error instanceof Error ? error.message : String(error),
        },
        "Scraping falhou",
      );
      throw error;
    }
  };
}

async function runDocentes(
  options: DocentesOptions,
  scrapingContext: ScrapingContext,
): Promise<ScrapeResult<unknown>> {
  const progress = new DocentesProgressStore(
    options.progressDb ?? "docentes-progress.db",
  );
  await progress.initialize();
  const result = await crawlDocentes(
    {
      progress,
      onProgress: async ({ profiles, pages }) => {
        const every = options.memorySnapshotEvery ?? 0;
        if (every < 1 || profiles % every !== 0) return;
        const memory = process.memoryUsage();
        const directory = options.memorySnapshotDir ?? "memory-snapshots";
        await mkdir(directory, { recursive: true });
        const prefix = `docentes-${profiles.toString().padStart(5, "0")}`;
        const summaryPath = join(directory, `${prefix}.memory.json`);
        await writeFile(
          summaryPath,
          `${JSON.stringify({ profiles, pages, timestamp: new Date().toISOString(), memory }, null, 2)}\n`,
          "utf8",
        );
        const heapPath = writeHeapSnapshot(
          join(directory, `${prefix}.heapsnapshot`),
        );
        process.stderr.write(
          `${JSON.stringify({ event: "scrape.memory_snapshot", profiles, pages, summaryPath, heapPath, memory })}\n`,
        );
      },
    },
    scrapingContext,
  );
  const file = options.output
    ? await (async () => {
        await mkdir(dirname(options.output!), { recursive: true });
        return open(options.output!, "w");
      })()
    : undefined;
  const write = (value: string) =>
    file ? file.write(value) : (process.stdout.write(value), Promise.resolve());
  let first = true;
  let envelopeClosed = false;
  await write('{"data":[\n');
  try {
    await progress.forEachCompleted(async (json) => {
      if (!first) await write(",\n");
      first = false;
      await write(json);
    });
    await write(
      `],"issues":${JSON.stringify(result.issues)},"pages":${JSON.stringify(result.pages)}}\n`,
    );
    envelopeClosed = true;
    return result;
  } finally {
    if (!envelopeClosed) await write("]\n");
    await file?.close();
  }
}

async function emitDocentes(
  result: ScrapeResult<unknown>,
  output?: string,
  log?: ScraperLogger,
): Promise<void> {
  for (const issue of result.issues)
    if (!isIgnoredSourceIssue(issue))
      log?.warn(
        {
          event: "scrape.issue",
          adapter: issue.adapter,
          input: issue.input,
          code: issue.code,
          path: issue.path,
          expected: issue.expected,
          actual: issue.actual,
          err: issue.message,
        },
        "Issue de scraping",
      );
  if (result.issues.length > 0) process.exitCode = 1;
}

commonOptions(
  program
    .command("continencia-equivalencia")
    .description("agrega a tabela de continência e equivalência")
    .option("--url <url>", "URL explícita do índice"),
).action(
  action((options, scrapingContext) =>
    crawlContinenciaEquivalencia({ url: options.url }, scrapingContext),
  ),
);

commonOptions(
  program
    .command("docentes")
    .description("agrega docentes e professores seniores do Portal de Dados")
    .option(
      "--memory-snapshot-every <n>",
      "grava snapshot de memória a cada N perfis; 0 desabilita",
      nonNegativeInteger,
      0,
    )
    .option(
      "--memory-snapshot-dir <directory>",
      "diretório dos snapshots de memória",
      "memory-snapshots",
    )
    .option(
      "--progress-db <file>",
      "SQLite temporário de progresso dos docentes",
      "docentes-progress.db",
    ),
).action(action(runDocentes, emitDocentes));

commonOptions(
  program
    .command("editais-intercambio")
    .description("agrega os editais de intercâmbio da DERI")
    .option("--open-url <url>", "URL explícita dos editais abertos")
    .option("--closed-url <url>", "URL explícita dos editais fechados"),
).action(
  action((options, scrapingContext) =>
    crawlExchangeNotices(
      { openUrl: options.openUrl, closedUrl: options.closedUrl },
      scrapingContext,
    ),
  ),
);

commonOptions(
  program
    .command("exchange-notices-snapshot")
    .description("produz um snapshot versionado dos editais de intercâmbio")
    .option("--open-url <url>", "URL explícita dos editais abertos")
    .option("--closed-url <url>", "URL explícita dos editais fechados"),
).action(
  action<CommonOptions & { openUrl?: string; closedUrl?: string }>(
    (options, scrapingContext) =>
      crawlExchangeNotices(
        { openUrl: options.openUrl, closedUrl: options.closedUrl },
        scrapingContext,
      ),
    (result, output, log) =>
      emitExchangeNoticesSnapshot(result, output, log, {
        protocol: "pomi.exchange-notices.snapshot",
        partition: { collectionKey: snapshotPartitionKey() },
      }),
  ),
);

commonOptions(
  program
    .command("caderno-horarios")
    .description("agrega um caderno de horários")
    .requiredOption("--year <year>", "ano", year)
    .requiredOption("--semester <semester>", "semestre", semester)
    .option("--institute-code <code>", "sigla do instituto"),
).action(
  action((options, scrapingContext) =>
    crawlCadernoDeHorario(
      {
        year: options.year,
        semester: options.semester,
        instituteCode: options.instituteCode,
      },
      scrapingContext,
    ),
  ),
);

commonOptions(
  program
    .command("academic-data-snapshot")
    .description("produz um snapshot versionado de um caderno de horários")
    .requiredOption("--year <year>", "ano", year)
    .requiredOption("--semester <semester>", "semestre", semester)
    .requiredOption("--institute-code <code>", "sigla do instituto"),
).action(
  action<
    CommonOptions & { year: number; semester: 1 | 2; instituteCode: string }
  >(
    (options, scrapingContext) =>
      crawlCadernoDeHorario(
        {
          year: options.year,
          semester: options.semester,
          instituteCode: options.instituteCode,
        },
        scrapingContext,
      ),
    (result, output, log, options) =>
      emitSingleComponentSnapshot(result, output, log, {
        protocol: "pomi.academic-data.snapshot",
        partition: {
          year: options!.year,
          semester: options!.semester,
          instituteCode: options!.instituteCode,
        },
        component: "academicData",
      }),
  ),
);

commonOptions(
  program
    .command("caderno-horarios-pagina")
    .description("carrega a página raiz de um caderno")
    .requiredOption("--year <year>", "ano", year)
    .requiredOption("--semester <semester>", "semestre", semester),
).action(
  action((options, scrapingContext) =>
    pageResult(
      cadernoDeHorarioPagina,
      { year: options.year, semester: options.semester },
      scrapingContext,
    ),
  ),
);

commonOptions(
  program
    .command("caderno-horarios-instituto")
    .description("carrega um instituto de um caderno")
    .requiredOption("--year <year>", "ano", year)
    .requiredOption("--semester <semester>", "semestre", semester)
    .requiredOption("--institute-code <code>", "sigla do instituto")
    .option("--url <url>", "URL explícita da página"),
).action(
  action((options, scrapingContext) =>
    pageResult(
      cadernoDeHorarioInstituto,
      {
        year: options.year,
        semester: options.semester,
        instituteCode: options.instituteCode,
        url: options.url,
      },
      scrapingContext,
    ),
  ),
);

commonOptions(
  program
    .command("caderno-horarios-disciplina")
    .description("carrega uma disciplina de um caderno")
    .requiredOption("--year <year>", "ano", year)
    .requiredOption("--semester <semester>", "semestre", semester)
    .requiredOption("--course-code <code>", "código da disciplina")
    .requiredOption("--url <url>", "URL da disciplina"),
).action(
  action((options, scrapingContext) =>
    pageResult(
      cadernoDeHorarioDisciplina,
      {
        year: options.year,
        semester: options.semester,
        courseCode: options.courseCode,
        url: options.url,
      },
      scrapingContext,
    ),
  ),
);

commonOptions(
  program
    .command("calendario")
    .description("agrega eventos do calendário de graduação")
    .requiredOption("--year <year>", "ano", year)
    .option("--url <url>", "URL explícita da página"),
).action(
  action((options, scrapingContext) =>
    crawlCalendario({ year: options.year, url: options.url }, scrapingContext),
  ),
);

commonOptions(
  program
    .command("calendar-snapshot")
    .description("produz um snapshot versionado do calendário de graduação")
    .requiredOption("--year <year>", "ano", year)
    .option("--url <url>", "URL explícita da página"),
).action(
  action<CommonOptions & { year: number; url?: string }>(
    (options, scrapingContext) =>
      crawlCalendario(
        { year: options.year, url: options.url },
        scrapingContext,
      ),
    (result, output, log, options) =>
      emitSingleComponentSnapshot(result, output, log, {
        protocol: "pomi.calendar.snapshot",
        partition: { year: options!.year },
        component: "events",
      }),
  ),
);

commonOptions(
  program
    .command("calendario-graduacao-pagina")
    .description("carrega uma página de calendário")
    .requiredOption("--year <year>", "ano", year)
    .option("--url <url>", "URL explícita da página"),
).action(
  action((options, scrapingContext) =>
    pageResult(
      calendarioGraduacaoPagina,
      { year: options.year, url: options.url },
      scrapingContext,
    ),
  ),
);

commonOptions(
  program
    .command("cardapio")
    .description("agrega o cardápio diário")
    .option("--date <date>", "data AAAA-MM-DD"),
).action(
  action((options, scrapingContext) =>
    crawlCardapio({ date: options.date }, scrapingContext),
  ),
);

commonOptions(
  program
    .command("cardapios")
    .description("agrega os cardápios")
    .option("--first-date <date>", "data AAAA-MM-DD")
    .option("--last-date <date>", "data AAAA-MM-DD")
    .option("--past-days <days>", "dias anteriores", nonNegativeInteger)
    .option("--future-days <days>", "dias futuros", nonNegativeInteger),
).action(
  action((options, scrapingContext) => {
    const range = resolveCardapiosRange(options);
    return crawlCardapios(range, scrapingContext);
  }),
);

commonOptions(
  program
    .command("daily-menus-snapshot")
    .description("produz um snapshot versionado dos cardápios")
    .option("--first-date <date>", "data AAAA-MM-DD")
    .option("--last-date <date>", "data AAAA-MM-DD")
    .option("--past-days <days>", "dias anteriores", nonNegativeInteger)
    .option("--future-days <days>", "dias futuros", nonNegativeInteger),
).action(
  action<
    CommonOptions & {
      firstDate?: string;
      lastDate?: string;
      pastDays?: number;
      futureDays?: number;
    }
  >(
    (options, scrapingContext) =>
      crawlCardapios(resolveCardapiosRange(options), scrapingContext),
    (result, output, log) => {
      const data = result.data as { firstDate: string; lastDate: string };
      return emitDailyMenusSnapshot(result, output, log, {
        protocol: "pomi.daily-menus.snapshot",
        partition: { firstDate: data.firstDate, lastDate: data.lastDate },
      });
    },
  ),
);

commonOptions(
  program
    .command("cardapio-portal")
    .description("carrega o portal que referencia o cardápio")
    .option("--date <date>", "data AAAA-MM-DD"),
).action(
  action((options, scrapingContext) =>
    pageResult(cardapioPortal, { date: options.date }, scrapingContext),
  ),
);

commonOptions(
  program
    .command("cardapio-dia")
    .description("carrega uma página diária de cardápio")
    .requiredOption("--url <url>", "URL do cardápio")
    .option("--date <date>", "data AAAA-MM-DD"),
).action(
  action((options, scrapingContext) =>
    pageResult(
      cardapioDia,
      { url: options.url, date: options.date },
      scrapingContext,
    ),
  ),
);

function catalogRange(command: Command): Command {
  return command
    .requiredOption("--first-year <year>", "primeiro ano", year)
    .requiredOption("--last-year <year>", "último ano", year);
}

commonOptions(
  program
    .command("catalog-programs-snapshot")
    .description("produz um snapshot versionado dos programas de um catálogo")
    .requiredOption("--year <year>", "ano", year)
    .requiredOption("--profile <profile>", "core, available ou complete"),
).action(
  action(
    (options, scrapingContext) =>
      crawlCatalogProgramsSnapshot(
        {
          year: options.year,
          profile: catalogSnapshotProfile(options.profile),
        },
        scrapingContext,
      ),
    emitCatalogProgramsSnapshot,
  ),
);

function catalogSnapshotProfile(value: string): CatalogProgramsSnapshotProfile {
  if (!(["core", "available", "complete"] as string[]).includes(value))
    throw new Error("Perfil inválido");
  return value as CatalogProgramsSnapshotProfile;
}

commonOptions(
  catalogRange(
    program
      .command("catalogos-programas")
      .description("agrega programas dos catálogos anuais, inclusive legados"),
  ),
).action(
  action((options, scrapingContext) =>
    crawlCatalogosProgramas(
      { firstYear: options.firstYear, lastYear: options.lastYear },
      scrapingContext,
    ),
  ),
);

commonOptions(
  catalogRange(
    program
      .command("catalogo-disciplinas")
      .description("agrega disciplinas de catálogos anuais"),
  ),
).action(
  action((options, scrapingContext) =>
    crawlCatalogoDisciplinas(
      { firstYear: options.firstYear, lastYear: options.lastYear },
      scrapingContext,
    ),
  ),
);

commonOptions(
  program
    .command("catalog-disciplines-snapshot")
    .description("produz um snapshot versionado das disciplinas de um catálogo")
    .requiredOption("--year <year>", "ano", year),
).action(
  action<CommonOptions & { year: number }>(
    (options, scrapingContext) =>
      crawlCatalogoDisciplinas(
        { firstYear: options.year, lastYear: options.year },
        scrapingContext,
      ),
    (result, output, log, options) =>
      emitComponentsSnapshot(result, output, log, {
        protocol: "pomi.catalog-disciplines.snapshot",
        partition: { year: options!.year },
        version: 2,
        producer: {
          sourceFormat:
            (
              result.data as {
                catalogs?: Array<{ sourceFormat?: string }>;
              }
            ).catalogs?.[0]?.sourceFormat ?? "MODERN",
        },
        components: catalogDisciplineSnapshotComponents(result.data),
        records: catalogDisciplineSnapshotRecords(result.data),
      }),
  ),
);

function catalogDisciplineSnapshotComponents(data: unknown) {
  const catalogs =
    (
      data as {
        catalogs?: Array<{
          year: number;
          sourceFormat: string;
          sourceUrl: string;
          courses: Array<Record<string, unknown>>;
        }>;
      }
    ).catalogs ?? [];
  return {
    catalog: {
      catalogs: catalogs.map(({ year, sourceFormat, sourceUrl, courses }) => ({
        year,
        sourceFormat,
        sourceUrl,
        courses: courses.map(({ prerequisites: _, ...course }) => course),
      })),
    },
    relationships: {
      catalogs: catalogs.map(({ year, sourceFormat, sourceUrl, courses }) => ({
        year,
        sourceFormat,
        sourceUrl,
        courses: courses.map(({ code, prerequisites }) => ({
          code,
          prerequisites,
        })),
      })),
    },
  };
}

function catalogDisciplineSnapshotRecords(data: unknown) {
  const catalogs =
    (data as { catalogs?: Array<{ courses?: unknown[] }> }).catalogs ?? [];
  const count = catalogs.reduce(
    (total, catalog) => total + (catalog.courses?.length ?? 0),
    0,
  );
  return { catalog: count, relationships: count };
}

commonOptions(
  catalogRange(
    program
      .command("catalogo-curriculos")
      .description("agrega currículos de catálogos anuais"),
  ),
).action(
  action((options, scrapingContext) =>
    crawlCatalogoCurriculos(
      { firstYear: options.firstYear, lastYear: options.lastYear },
      scrapingContext,
    ),
  ),
);

commonOptions(
  catalogRange(
    program
      .command("catalogo-informacoes")
      .description("agrega as seções das páginas de informações dos programas"),
  ),
).action(
  action((options, scrapingContext) =>
    crawlCatalogoInformacoes(
      { firstYear: options.firstYear, lastYear: options.lastYear },
      scrapingContext,
    ),
  ),
);

commonOptions(
  catalogRange(
    program
      .command("sugestao-curriculo")
      .description("agrega sugestões curriculares"),
  ),
).action(
  action((options, scrapingContext) =>
    crawlSugestaoCurriculo(
      { firstYear: options.firstYear, lastYear: options.lastYear },
      scrapingContext,
    ),
  ),
);

commonOptions(
  program
    .command("catalogos-indice")
    .description("carrega o índice de catálogos")
    .option("--url <url>", "URL explícita da página"),
).action(
  action((options, scrapingContext) =>
    pageResult(catalogosIndice, { url: options.url }, scrapingContext),
  ),
);

commonOptions(
  program
    .command("catalogo-programas")
    .description("carrega programas de um catálogo")
    .requiredOption("--year <year>", "ano", year)
    .option("--url <url>", "URL explícita da página"),
).action(
  action((options, scrapingContext) =>
    pageResult(
      catalogoProgramas,
      { year: options.year, url: options.url },
      scrapingContext,
    ),
  ),
);

commonOptions(
  program
    .command("catalogo-disciplinas-indice")
    .description("carrega prefixos de um catálogo")
    .requiredOption("--year <year>", "ano", year)
    .option("--url <url>", "URL explícita da página"),
).action(
  action((options, scrapingContext) =>
    pageResult(
      catalogoDisciplinasIndice,
      { year: options.year, url: options.url },
      scrapingContext,
    ),
  ),
);

commonOptions(
  program
    .command("catalogo-disciplinas-prefixo")
    .description("carrega disciplinas de um prefixo")
    .requiredOption("--year <year>", "ano", year)
    .requiredOption("--prefix <prefix>", "prefixo")
    .requiredOption("--url <url>", "URL do prefixo"),
).action(
  action((options, scrapingContext) =>
    pageResult(
      catalogoDisciplinasPrefixo,
      { year: options.year, prefix: options.prefix, url: options.url },
      scrapingContext,
    ),
  ),
);

function coursePage(command: Command): Command {
  return command
    .requiredOption(
      "--program-code <code>",
      "código do programa",
      positiveInteger,
    )
    .requiredOption("--name <name>", "nome do programa")
    .requiredOption("--url <url>", "URL da página");
}

commonOptions(
  coursePage(
    program.command("curso-curriculo").description("carrega um currículo"),
  ),
).action(
  action((options, scrapingContext) =>
    pageResult(
      cursoCurriculo,
      {
        programCode: options.programCode,
        name: options.name,
        url: options.url,
      },
      scrapingContext,
    ),
  ),
);

commonOptions(
  coursePage(
    program.command("curso-membros").description("carrega membros de um curso"),
  ),
).action(
  action((options, scrapingContext) =>
    pageResult(
      cursoMembros,
      {
        programCode: options.programCode,
        name: options.name,
        url: options.url,
      },
      scrapingContext,
    ),
  ),
);

commonOptions(
  coursePage(
    program
      .command("curso-sugestao")
      .description("carrega sugestões de um curso"),
  ),
).action(
  action((options, scrapingContext) =>
    pageResult(
      cursoSugestao,
      {
        programCode: options.programCode,
        name: options.name,
        url: options.url,
      },
      scrapingContext,
    ),
  ),
);

program
  .command("list")
  .description("lista os comandos disponíveis")
  .action(() => {
    for (const command of program.commands)
      process.stdout.write(`${command.name()}\t${command.description()}\n`);
  });

program
  .parseAsync()
  .catch((error: unknown) => {
    pino({ level: process.env.UNICAMP_SCRAPPER_LOG_LEVEL ?? "info" }).error(
      { event: "scrape.cli.error", err: error },
      "Falha ao executar comando",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdownScraperTelemetry();
  });

function traceContext() {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (!spanContext || /^0+$/.test(spanContext.traceId)) return {};
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
}
