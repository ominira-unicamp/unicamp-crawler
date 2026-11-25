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

export type CourseRelationMember = {
  code: string;
  prerequisiteOnlyMarker: boolean;
};

export type CourseRelationGroup = {
  members: CourseRelationMember[];
  rawText: string;
};

export type CourseRelation = {
  targetCode: string;
  sourceUrls: string[];
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
  coverage: {
    expectedInitials: string[];
    loadedInitials: string[];
    failedInitials: string[];
    complete: boolean;
  };
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

  $("#iniciais a").each((_, anchor) => {
    const initial = normalizedText($(anchor));
    const href = $(anchor).attr("href");
    if (!/^[A-Z]$/i.test(initial) || !href) {
      reporter?.issue({
        blocksCompleteness: true,
        code: "invalid-format",
        path: "initials",
        message: "Inicial de continência em formato inesperado",
        expected: "uma letra e uma URL",
        actual: { initial, href },
      });
      return;
    }
    let url: string;
    try {
      url = absoluteUrl(href, sourceUrl);
      if (!/^https?:$/.test(new URL(url).protocol)) throw new Error();
    } catch {
      reporter?.issue({
        blocksCompleteness: true,
        code: "invalid-format",
        path: "initials",
        message: "URL de inicial inválida",
        actual: href,
      });
      return;
    }
    const key = initial.toUpperCase();
    if (initials.has(key) && initials.get(key)?.url !== url) {
      reporter?.issue({
        blocksCompleteness: true,
        code: "invalid-value",
        path: "initials",
        message: "URLs divergentes para a mesma inicial",
        actual: { initial, url },
      });
      return;
    }
    initials.set(key, { initial: key, url });
  });

  if (initials.size === 0)
    reporter?.issue({
      blocksCompleteness: true,
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
    const discipline = $(row)
      .find(".disciplina")
      .filter((_, node) => $(node).closest(".row")[0] === row)
      .first();
    const content = $(row)
      .find(".continencia")
      .filter((_, node) => $(node).closest(".row")[0] === row)
      .first();
    if (!discipline.length && !content.length) return;
    const target = discipline.find("a[name]").first();

    const targetCode = canonicalCode(normalizedText(target));
    if (!validCourseCode(targetCode)) {
      reporter?.issue({
        blocksCompleteness: true,
        code: "invalid-format",
        path: `relations[${index}].targetCode`,
        message: "Código da disciplina-alvo não encontrado",
      });
      return;
    }
    if (!content.length) {
      reporter?.issue({
        blocksCompleteness: true,
        code: "missing-required-section",
        path: `relations.${targetCode}.groups`,
        message: "Relações da disciplina não encontradas",
        expected: ".continencia",
      });
      return;
    }

    const groups = relationGroups(
      $,
      content,
      reporter,
      `relations.${targetCode}.groups`,
    );
    if (groups.length === 0) {
      reporter?.issue({
        blocksCompleteness: true,
        code: "unrecognized-content",
        path: `relations.${targetCode}.groups`,
        message: "Nenhuma relação de disciplina foi reconhecida",
      });
      return;
    }
    relations.push({ targetCode, sourceUrls: [input.url], groups });
  });

  if (relations.length === 0)
    reporter?.issue({
      blocksCompleteness: true,
      code: "unrecognized-content",
      path: "relations",
      message: "Nenhuma relação de continência foi encontrada",
      expected: ".row .disciplina e .continencia",
    });

  return { initial: input.initial, sourceUrl: input.url, relations };
}

function validCourseCode(code: string): boolean {
  return /^(?:[A-Z]{1,3}\d{3,4}|F \d{3,4})$/.test(code);
}

type RelationToken = {
  raw: string;
  member?: CourseRelationMember;
};

function relationGroups(
  $: ReturnType<typeof loadHtml>,
  content: ReturnType<ReturnType<typeof loadHtml>>,
  reporter: ScrapeReporter | undefined,
  path: string,
): CourseRelationGroup[] {
  const alternatives: RelationToken[][] = [[]];
  const issue = (message: string, actual: unknown) =>
    reporter?.issue({
      blocksCompleteness: true,
      code: "unrecognized-content",
      path,
      message,
      actual,
    });
  const visit = (node: Parameters<typeof $>[0]) => {
    const element = $(node);
    const dom = element[0];
    if (!dom) return;
    if (dom.type === "comment") return;
    if (dom.type === "text") {
      const parts = (dom.data ?? "").split("/");
      parts.forEach((raw, index) => {
        if (index > 0) alternatives.push([]);
        alternatives.at(-1)!.push({ raw });
      });
      return;
    }
    if (dom.type === "tag" && dom.name === "a") {
      const raw = element.text();
      const code = canonicalCode(
        raw.replace(/^\s*\*+\s*/, "").replace(/\s*\*+\s*$/, ""),
      );
      alternatives.at(-1)!.push({
        raw,
        member: validCourseCode(code)
          ? {
              code,
              prerequisiteOnlyMarker: raw.includes("*"),
            }
          : undefined,
      });
      return;
    }
    if (dom.type === "tag" && dom.name === "br") {
      alternatives.at(-1)!.push({ raw: " " });
      return;
    }
    element.contents().each((_, child) => visit(child));
  };
  content.contents().each((_, node) => visit(node));

  const groups: CourseRelationGroup[] = [];
  for (const tokens of alternatives) {
    const rawText = tokens
      .map((token) => token.raw)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    let invalid = false;
    let offset = 0;
    const positioned = tokens.map((token) => {
      const start = offset;
      offset += token.raw.length;
      return { ...token, start, end: offset };
    });
    const members = positioned.filter((token) => token.member);
    for (const token of positioned) {
      if (token.member) continue;
      if (/[^\s*]/.test(token.raw)) {
        issue("Conteúdo da alternativa não reconhecido", token.raw);
        invalid = true;
      }
      for (const match of token.raw.matchAll(/\*/g)) {
        const position = token.start + match.index!;
        const before = members
          .filter((member) => member.end <= position)
          .at(-1);
        const after = members.find((member) => member.start > position);
        const leftDistance = before ? position - before.end : Infinity;
        const rightDistance = after ? after.start - position - 1 : Infinity;
        const selected =
          leftDistance === 0 && rightDistance !== 0
            ? before
            : rightDistance === 0 && leftDistance !== 0
              ? after
              : !before
                ? after
                : !after
                  ? before
                  : undefined;
        if (!selected?.member) {
          issue("Associação do asterisco ambígua", rawText);
          invalid = true;
        } else selected.member.prerequisiteOnlyMarker = true;
      }
    }
    if (members.length === 0) {
      issue("Alternativa vazia ou sem códigos válidos", rawText);
      continue;
    }
    if (invalid) continue;
    groups.push({
      members: [
        ...new Map(
          members.map(({ member }) => [JSON.stringify(member), member!]),
        ).values(),
      ],
      rawText,
    });
  }
  return groups;
}

function groupKey(group: CourseRelationGroup): string {
  return JSON.stringify(
    group.members
      .map((member) =>
        JSON.stringify([member.code, member.prerequisiteOnlyMarker]),
      )
      .sort(),
  );
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
  const issueStart = context.issues.length;
  const index = await context.tryLoad(continenciaEquivalenciaIndex, input);
  const initials = index?.data.initials ?? [];
  const pages = await context.map(initials, async (initial) =>
    context.tryLoad(continenciaEquivalenciaInitial, initial),
  );
  const relationByTarget = new Map<string, CourseRelation>();

  for (const page of pages)
    for (const relation of page?.data.relations ?? []) {
      const existing = relationByTarget.get(relation.targetCode);
      if (!existing) {
        const keys = new Set<string>();
        relationByTarget.set(relation.targetCode, {
          ...relation,
          groups: relation.groups.filter((group) => {
            const key = groupKey(group);
            if (keys.has(key)) return false;
            keys.add(key);
            return true;
          }),
        });
        continue;
      }
      existing.sourceUrls = [
        ...new Set([...existing.sourceUrls, ...relation.sourceUrls]),
      ];
      const keys = new Set(existing.groups.map(groupKey));
      for (const group of relation.groups) {
        const key = groupKey(group);
        if (keys.has(key)) continue;
        existing.groups.push(group);
        keys.add(key);
      }
    }

  const issues = context.issues.slice(issueStart);
  for (const issue of issues)
    if (issue.code === "load-error") issue.blocksCompleteness = true;

  return {
    data: {
      sourceUrl:
        index?.data.sourceUrl ?? input.url ?? continenciaEquivalenciaUrl,
      coverage: {
        expectedInitials: initials.map(({ initial }) => initial),
        loadedInitials: initials
          .filter((_, i) => pages[i])
          .map(({ initial }) => initial),
        failedInitials: initials
          .filter((_, i) => !pages[i])
          .map(({ initial }) => initial),
        complete:
          Boolean(index) &&
          initials.length > 0 &&
          pages.every(Boolean) &&
          !issues.some((issue) => issue.blocksCompleteness),
      },
      relations: [...relationByTarget.values()],
    },
    issues: context.issues,
    pages: context.pages,
  };
}
