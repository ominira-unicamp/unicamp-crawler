#!/usr/bin/env node
import { Command, Option } from "commander";
import pino, { type Level } from "pino";
import { trace } from "@opentelemetry/api";
import { randomUUID } from "node:crypto";
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

function action<Options extends CommonOptions>(
  runner: (
    options: Options,
    scrapingContext: ScrapingContext,
  ) => Promise<ScrapeResult<unknown>>,
  resultEmitter: typeof emit = emit,
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
      await resultEmitter(result, options.output, log);
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
