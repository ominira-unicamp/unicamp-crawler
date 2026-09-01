import type {
  PageAdapter,
  ScrapeReporter,
  ScrapeResult,
  ScrapingContext,
} from "./core.js";
import { absoluteUrl, loadHtml, normalizedText } from "./dom.js";
import { canonicalCode } from "./catalogos.js";

const continenciaEquivalenciaUrl =
  "https://www.dac.unicamp.br/portal/continencias";

export type ContinenciaEquivalenciaInput = {
  url?: string;
};

export type ContinenciaEquivalenciaInitialInput = {
  initial: string;
  url: string;
};

export type CourseRelationGroup = {
  sourceCodes: string[];
};

export type CourseRelation = {
  targetCode: string;
  groups: CourseRelationGroup[];
};

export type ContinenciaEquivalenciaIndexPage = {
  sourceUrl: string;
  initials: ContinenciaEquivalenciaInitialInput[];
};

export type ContinenciaEquivalenciaInitialPage = {
  initial: string;
  sourceUrl: string;
  relations: CourseRelation[];
};

export type ContinenciaEquivalenciaData = {
  sourceUrl: string;
  relations: CourseRelation[];
};

export async function fetchContinenciaEquivalenciaIndex(
  input: ContinenciaEquivalenciaInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url ?? continenciaEquivalenciaUrl);
}

export function parseContinenciaEquivalenciaIndex(
  html: string,
  input: ContinenciaEquivalenciaInput,
  reporter?: ScrapeReporter,
): ContinenciaEquivalenciaIndexPage {
  const $ = loadHtml(html);
  const sourceUrl = input.url ?? continenciaEquivalenciaUrl;
  const initials = new Map<string, ContinenciaEquivalenciaInitialInput>();

  $("#iniciais a[href]").each((_, anchor) => {
    const initial = normalizedText($(anchor));
    const href = $(anchor).attr("href");
    if (!/^[A-Z]$/i.test(initial) || !href) {
      reporter?.issue({
        code: "invalid-format",
        path: "initials",
        message: "Inicial de continência em formato inesperado",
        expected: "uma letra e uma URL",
        actual: { initial, href },
      });
      return;
    }
    initials.set(initial.toUpperCase(), {
      initial: initial.toUpperCase(),
      url: absoluteUrl(href, sourceUrl),
    });
  });

  if (initials.size === 0)
    reporter?.issue({
      code: "unrecognized-content",
      path: "initials",
      message: "Nenhuma inicial de continência foi encontrada",
      expected: "#iniciais a[href]",
    });

  return { sourceUrl, initials: [...initials.values()] };
}

export const continenciaEquivalenciaIndex: PageAdapter<
  ContinenciaEquivalenciaInput,
  ContinenciaEquivalenciaIndexPage
> = {
  id: "continencia-equivalencia-index",
  fetch: fetchContinenciaEquivalenciaIndex,
  parse: parseContinenciaEquivalenciaIndex,
};

export async function fetchContinenciaEquivalenciaInitial(
  input: ContinenciaEquivalenciaInitialInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url);
}

export function parseContinenciaEquivalenciaInitial(
  html: string,
  input: ContinenciaEquivalenciaInitialInput,
  reporter?: ScrapeReporter,
): ContinenciaEquivalenciaInitialPage {
  const $ = loadHtml(html);
  const relations: CourseRelation[] = [];

  $(".row").each((index, row) => {
    const target = $(row).find(".disciplina a[name]").first();
    if (!target.length) return;

    const targetCode = canonicalCode(normalizedText(target));
    const content = $(row).find(".continencia").first();
    if (!targetCode) {
      reporter?.issue({
        code: "invalid-format",
        path: `relations[${index}].targetCode`,
        message: "Código da disciplina-alvo não encontrado",
      });
      return;
    }
    if (!content.length) {
      reporter?.issue({
        code: "missing-required-section",
        path: `relations.${targetCode}.groups`,
        message: "Relações da disciplina não encontradas",
        expected: ".continencia",
      });
      return;
    }

    const groups = relationGroups($, content);
    if (groups.length === 0) {
      reporter?.issue({
        code: "unrecognized-content",
        path: `relations.${targetCode}.groups`,
        message: "Nenhuma relação de disciplina foi reconhecida",
      });
      return;
    }
    relations.push({ targetCode, groups });
  });

  if (relations.length === 0)
    reporter?.issue({
      code: "unrecognized-content",
      path: "relations",
      message: "Nenhuma relação de continência foi encontrada",
      expected: ".row .disciplina e .continencia",
    });

  return { initial: input.initial, sourceUrl: input.url, relations };
}

function relationGroups(
  $: ReturnType<typeof loadHtml>,
  content: ReturnType<ReturnType<typeof loadHtml>>,
): CourseRelationGroup[] {
  const groups: CourseRelationGroup[] = [];
  let sourceCodes: string[] = [];

  const appendGroup = () => {
    const uniqueCodes = [...new Set(sourceCodes)];
    if (uniqueCodes.length > 0) groups.push({ sourceCodes: uniqueCodes });
    sourceCodes = [];
  };

  content.contents().each((_, node) => {
    if (node.type === "text") {
      if ((node.data ?? "").includes("/")) appendGroup();
      return;
    }
    if (node.type !== "tag" || node.name !== "a") return;
    const code = canonicalCode(normalizedText($(node)));
    if (code) sourceCodes.push(code);
  });
  appendGroup();
  return groups;
}

export const continenciaEquivalenciaInitial: PageAdapter<
  ContinenciaEquivalenciaInitialInput,
  ContinenciaEquivalenciaInitialPage
> = {
  id: "continencia-equivalencia-initial",
  fetch: fetchContinenciaEquivalenciaInitial,
  parse: parseContinenciaEquivalenciaInitial,
};

export async function crawlContinenciaEquivalencia(
  input: ContinenciaEquivalenciaInput,
  context: ScrapingContext,
): Promise<ScrapeResult<ContinenciaEquivalenciaData>> {
  const index = await context.load(continenciaEquivalenciaIndex, input);
  const pages = await context.map(index.data.initials, async (initial) =>
    context.tryLoad(continenciaEquivalenciaInitial, initial),
  );
  const relationByTarget = new Map<string, CourseRelation>();

  for (const page of pages)
    for (const relation of page?.data.relations ?? []) {
      const existing = relationByTarget.get(relation.targetCode);
      if (!existing) {
        relationByTarget.set(relation.targetCode, relation);
        continue;
      }
      existing.groups.push(...relation.groups);
    }

  return {
    data: {
      sourceUrl: index.data.sourceUrl,
      relations: [...relationByTarget.values()],
    },
    issues: context.issues,
    pages: context.pages,
  };
}
