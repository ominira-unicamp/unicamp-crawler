import type {
  PageAdapter,
  ScrapeReporter,
  ScrapeResult,
  ScrapingContext,
} from "./core.js";
import { absoluteUrl, loadHtml, normalizedText } from "./dom.js";

const catalogsPortalUrl =
  "https://www.dac.unicamp.br/portal/graduacao/catalogos-de-cursos";
const catalogUrl = (year: number) =>
  `https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo${year}/index.html`;
const disciplinesUrl = (year: number) =>
  `https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo${year}/disciplinas/index.html`;
export type CatalogosIndiceInput = { url?: string };
export type CatalogoProgramasInput = { year: number; url?: string };
export type CatalogoDisciplinasIndiceInput = { year: number; url?: string };
export type CatalogoDisciplinasPrefixoInput = {
  year: number;
  prefix: string;
  url: string;
};
export type CursoPaginaInput = {
  programCode: number;
  name: string;
  url: string;
};
export type CatalogosIndicePage = { years: number[] };
export type CursoReferencia = {
  code: number;
  name: string;
  slug: string;
  curriculum: CursoPaginaInput;
  members: CursoPaginaInput;
  suggestion: CursoPaginaInput;
};
export type CatalogoProgramasPage = {
  year: number;
  sourceUrl: string;
  programs: CursoReferencia[];
};
export type PrefixoReferencia = CatalogoDisciplinasPrefixoInput;
export type CatalogoDisciplinasIndicePage = {
  year: number;
  prefixes: PrefixoReferencia[];
};
export type DisciplinaCatalogo = {
  code: string;
  name: string;
  coordinator: string | null;
  workload: {
    theoreticalHours: number | null;
    practicalHours: number | null;
    laboratoryHours: number | null;
    guidedActivityHours: number | null;
    distanceHours: number | null;
    guidedExtensionHours: number | null;
    practicalExtensionHours: number | null;
    weeks: number | null;
    weeklyClassHours: number | null;
    classroomHours: number | null;
  };
  credits: number | null;
  offeringPeriod: string | null;
  evaluation: string | null;
  finalExam: boolean | null;
  minimumAttendancePercent: number | null;
  prerequisites: Prerequisite;
  syllabus: string | null;
  bibliography: string | null;
  rawSections?: RawDisciplineSection[];
};
export type CatalogoDisciplinasPrefixoPage = {
  year: number;
  prefix: string;
  sourceUrl: string;
  title: string;
  courses: DisciplinaCatalogo[];
};
export type Prerequisite = {
  raw: string | null;
  any: Array<{ all: PrerequisiteItem[] }>;
};
export type PrerequisiteItem = {
  code: string;
  kind: "FULL" | "PARTIAL" | "SPECIAL";
};
export type RawDisciplineSection = {
  heading: string;
  text: string;
};
type Workload = DisciplinaCatalogo["workload"];
type WorkloadField = keyof Workload;
type ParsedWorkload = { workload: Workload; credits: number | null };
type StructuredDiscipline = {
  sections: RawDisciplineSection[];
  workload: ParsedWorkload;
};
export type Requisito = { type: "any" | "prefix" | "specific"; code?: string };
export type CurriculoPage = {
  blocks: Array<{
    type: "mandatory" | "elective";
    credits: number | null;
    requirements: Requisito[];
  }>;
  specializations: Array<{ code: string; name: string; blocks: unknown[] }>;
};
export type MembrosPage = { unitCode: string };
export type SugestaoPage = {
  suggestions: Array<{
    code: string;
    name: string;
    semesters: Array<{
      semester: number;
      credits: number;
      electiveCredits: number;
      courses: Array<{ code: string; credits: number }>;
    }>;
  }>;
};
export type CatalogoDisciplinas = {
  firstYear: number;
  lastYear: number;
  catalogs: Array<{
    year: number;
    sourceUrl: string;
    prefixes: Array<PrefixoReferencia & CatalogoDisciplinasPrefixoPage>;
  }>;
};
export type CatalogoCurriculos = {
  catalogs: Array<{
    year: number;
    sourceUrl: string;
    programs: Array<CursoReferencia & CurriculoPage>;
  }>;
};
export type SugestaoCurriculo = {
  source: string;
  firstYear: number;
  lastYear: number;
  catalogs: Array<{
    year: number;
    sourceUrl: string;
    programs: Array<CursoReferencia & SugestaoPage>;
  }>;
};
const courseTitle = /^(\d+)\s*-\s*(.+?)(?:\s*-\s*(?:Integral|Noturno))?$/i;
const suggestionTitle = /^(?<code>(?:\d+[A-Z]|[A-Z]{2}))\s*-\s*(?<name>.+)$/i;
export const canonicalCode = (value: string) => {
  const compact = value.replace(/\s+/g, "").replace(/\*+$/, "").toUpperCase();
  const physicsCourse = /^F(\d{3,4})$/.exec(compact);
  return physicsCourse ? `F ${physicsCourse[1]}` : compact;
};

export async function fetchCatalogosIndice(
  input: CatalogosIndiceInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url ?? catalogsPortalUrl);
}
export function parseCatalogosIndice(html: string): CatalogosIndicePage {
  return {
    years: [
      ...new Set(
        [...html.matchAll(/catalogo(\d{4})\/index\.html/gi)].map((match) =>
          Number(match[1]),
        ),
      ),
    ].sort(),
  };
}
export const catalogosIndice: PageAdapter<
  CatalogosIndiceInput,
  CatalogosIndicePage
> = {
  id: "catalogos-indice",
  fetch: fetchCatalogosIndice,
  parse: parseCatalogosIndice,
};

export async function fetchCatalogoProgramas(
  input: CatalogoProgramasInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url ?? catalogUrl(input.year));
}
export function parseCatalogoProgramas(
  html: string,
  input: CatalogoProgramasInput,
): CatalogoProgramasPage {
  const $ = loadHtml(html);
  const sourceUrl = input.url ?? catalogUrl(input.year);
  const programs = new Map<string, CursoReferencia>();
  $("a.rotulo-curso").each((_, anchor) => {
    const match = courseTitle.exec(normalizedText($(anchor)));
    const parent = $(anchor).closest("li");
    const curriculumHref = parent
      .find('a[href*="curriculo.html"]')
      .first()
      .attr("href");
    if (!match || !curriculumHref) return;
    const curriculumUrl = absoluteUrl(curriculumHref, sourceUrl);
    const code = Number(match[1]);
    const name = match[2].trim();
    const slug = curriculumUrl.split("/").slice(-2, -1)[0] ?? String(code);
    programs.set(slug, {
      code,
      name,
      slug,
      curriculum: { programCode: code, name, url: curriculumUrl },
      members: {
        programCode: code,
        name,
        url: curriculumUrl.replace("curriculo.html", "membros.html"),
      },
      suggestion: {
        programCode: code,
        name,
        url: curriculumUrl.replace("curriculo.html", "sugestao.html"),
      },
    });
  });
  return { year: input.year, sourceUrl, programs: [...programs.values()] };
}
export const catalogoProgramas: PageAdapter<
  CatalogoProgramasInput,
  CatalogoProgramasPage
> = {
  id: "catalogo-programas",
  fetch: fetchCatalogoProgramas,
  parse: parseCatalogoProgramas,
};

export async function fetchCatalogoDisciplinasIndice(
  input: CatalogoDisciplinasIndiceInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url ?? disciplinesUrl(input.year));
}
export function parseCatalogoDisciplinasIndice(
  html: string,
  input: CatalogoDisciplinasIndiceInput,
): CatalogoDisciplinasIndicePage {
  const $ = loadHtml(html);
  const sourceUrl = input.url ?? disciplinesUrl(input.year);
  return {
    year: input.year,
    prefixes: $(".prefixos-disciplinas a[href]")
      .toArray()
      .map((anchor) => ({
        year: input.year,
        prefix: normalizedText($(anchor)),
        url: absoluteUrl($(anchor).attr("href")!, sourceUrl),
      }))
      .filter((item) => item.prefix),
  };
}
export const catalogoDisciplinasIndice: PageAdapter<
  CatalogoDisciplinasIndiceInput,
  CatalogoDisciplinasIndicePage
> = {
  id: "catalogo-disciplinas-indice",
  fetch: fetchCatalogoDisciplinasIndice,
  parse: parseCatalogoDisciplinasIndice,
};

export async function fetchCatalogoDisciplinasPrefixo(
  input: CatalogoDisciplinasPrefixoInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url);
}
export function parseCatalogoDisciplinasPrefixo(
  html: string,
  input: CatalogoDisciplinasPrefixoInput,
  reporter?: ScrapeReporter,
): CatalogoDisciplinasPrefixoPage {
  const $ = loadHtml(html);
  const courses: DisciplinaCatalogo[] = [];
  const title = normalizedText($("h1").first());
  if (!title)
    reporter?.issue({
      code: "missing-required-section",
      path: "title",
      message: "Título da página não encontrado",
      expected: "h1",
    });
  $("h2[id^='disc-']").each((index, heading) => {
    const match = /^([A-Z]{1,3}\s*[A-Z]?\s*\d{3,4})\s*[-–]\s*(.+)$/i.exec(
      normalizedText($(heading)),
    );
    if (!match) {
      reporter?.issue({
        code: "invalid-format",
        path: `disciplines[${index}]`,
        message: "Título de disciplina em formato inesperado",
        expected: "CÓDIGO - NOME",
        actual: normalizedText($(heading)),
      });
      return;
    }
    const code = canonicalCode(match[1]);
    const structured = parseStructuredDiscipline($, heading, reporter, code);
    if (!structured)
      reporter?.info(
        {
          event: "scrape.discipline.parse-mode",
          code,
          mode: "text-fallback",
        },
        "Markup estruturado ausente; usando fallback textual",
      );
    const sections =
      structured?.sections ??
      parseDisciplineSections($, heading, reporter, code);
    const section = (name: string) =>
      sections.find(({ heading: value }) => sameHeading(value, name))?.text ??
      null;
    const workloadText = section("Carga Horária") ?? "";
    const parsedWorkload =
      structured?.workload ?? parseWorkload(workloadText, reporter, code);
    courses.push({
      code,
      name: match[2].trim(),
      coordinator: section("Coordenadoria"),
      workload: parsedWorkload.workload,
      credits: parsedWorkload.credits,
      offeringPeriod: section("Período de Oferecimento"),
      evaluation: section("Avaliação"),
      finalExam: booleanValue(
        section("Exame Final de Avaliação"),
        reporter,
        code,
      ),
      minimumAttendancePercent: percentage(
        section("Frequência Mínima"),
        reporter,
        code,
      ),
      prerequisites: parsePrerequisites(
        section("Pré-requisitos"),
        reporter,
        code,
      ),
      syllabus: section("Ementa"),
      bibliography: parseBibliography(section("Bibliografia")),
      rawSections: sections,
    });
  });
  reporter?.info(
    {
      event: "scrape.disciplines.parsed",
      year: input.year,
      prefix: input.prefix,
      url: input.url,
      disciplineCount: courses.length,
      sectionCount: courses.reduce(
        (total, course) => total + (course.rawSections?.length ?? 0),
        0,
      ),
    },
    "Disciplinas estruturadas",
  );
  if (courses.length === 0)
    reporter?.issue({
      code: "unrecognized-content",
      path: "disciplines",
      message: "Nenhuma disciplina reconhecida na página",
      expected: "h2[id^=disc-]",
    });
  return {
    year: input.year,
    prefix: input.prefix,
    sourceUrl: input.url,
    title,
    courses,
  };
}

type DisciplineElement = Parameters<ReturnType<typeof loadHtml>>[0];

const structuredWorkloadFields: Record<string, WorkloadField | "credits"> = {
  "Total de Horas de Atividades Teóricas": "theoreticalHours",
  "Total de Horas de Atividades Práticas": "practicalHours",
  "Total de Horas de Laboratório": "laboratoryHours",
  "Total de Horas de Atividades Orientadas": "guidedActivityHours",
  "Total de Horas de Atividades à Distância": "distanceHours",
  "Total de Horas de Atividades Orientadas de Extensão": "guidedExtensionHours",
  "Total de Horas de Atividades Práticas de Extensão":
    "practicalExtensionHours",
  "Número de Semanas": "weeks",
  "N��mero de Semanas": "weeks",
  "Total de Horas/Aula Semanais": "weeklyClassHours",
  "Total de Horas/Aula Realizadas em Sala de Aula": "classroomHours",
  "Total de Créditos": "credits",
};

function parseStructuredDiscipline(
  $: ReturnType<typeof loadHtml>,
  heading: DisciplineElement,
  reporter?: ScrapeReporter,
  code?: string,
): StructuredDiscipline | undefined {
  const container = $(heading).closest(".pad-content").first();
  const sectionHeadings = container.children("h3");
  if (!container.length || sectionHeadings.length === 0) return undefined;

  const sections: RawDisciplineSection[] = [];
  let workload: ParsedWorkload | undefined;
  sectionHeadings.each((_, element) => {
    const sectionHeading = normalizedText($(element));
    const content = $(element).nextUntil("h3");
    const text = content
      .map((__, child) => normalizedText($(child)))
      .get()
      .filter(Boolean)
      .join("\n");
    sections.push({ heading: sectionHeading, text });
    if (sameHeading(sectionHeading, "Carga Horária")) {
      workload = parseStructuredWorkload($, content, reporter, code);
    }
    if (!knownDisciplineHeadings.has(normalizeHeading(sectionHeading)))
      reporter?.issue({
        code: "unexpected-section",
        path: code ? `disciplines.${code}.sections` : "sections",
        message: "Seção de disciplina não reconhecida",
        actual: sectionHeading,
      });
  });
  if (!workload) return undefined;
  return {
    sections,
    workload,
  };
}

const knownDisciplineHeadings = new Set([
  "coordenadoria",
  "carga horaria",
  "periodo de oferecimento",
  "avaliacao",
  "exame final de avaliacao",
  "frequencia minima",
  "pre-requisitos",
  "ementa",
  "bibliografia",
]);

function parseStructuredWorkload(
  $: ReturnType<typeof loadHtml>,
  content: ReturnType<ReturnType<typeof loadHtml>>,
  reporter?: ScrapeReporter,
  code?: string,
): ParsedWorkload | undefined {
  const values: Partial<Record<WorkloadField, number | null>> = {};
  let credits: number | null = null;
  let foundMetric = false;
  content.find("strong").each((_, element) => {
    foundMetric = true;
    const label = normalizedText($(element)).replace(/[：:]\s*$/, "");
    const field = structuredWorkloadFields[label];
    const value = readStrongValue($, element);
    if (!field) {
      reporter?.issue({
        code: "unrecognized-content",
        path: code ? `disciplines.${code}.workload` : "workload",
        message: "Métrica de carga horária não reconhecida",
        expected: Object.keys(structuredWorkloadFields).join(", "),
        actual: { label, value },
      });
      return;
    }
    const parsed = parseStructuredInteger(value, label, reporter, code);
    if (field === "credits") credits = parsed;
    else values[field] = parsed;
  });
  if (!foundMetric) return undefined;
  return {
    workload: {
      theoreticalHours: values.theoreticalHours ?? null,
      practicalHours: values.practicalHours ?? null,
      laboratoryHours: values.laboratoryHours ?? null,
      guidedActivityHours: values.guidedActivityHours ?? null,
      distanceHours: values.distanceHours ?? null,
      guidedExtensionHours: values.guidedExtensionHours ?? null,
      practicalExtensionHours: values.practicalExtensionHours ?? null,
      weeks: values.weeks ?? null,
      weeklyClassHours: values.weeklyClassHours ?? null,
      classroomHours: values.classroomHours ?? null,
    },
    credits,
  };
}

function readStrongValue(
  $: ReturnType<typeof loadHtml>,
  element: DisciplineElement,
): string {
  const parent = $(element).parent();
  const contents = parent.contents().toArray();
  const index = contents.findIndex((node) => node === element);
  if (index < 0) return "";
  const value: string[] = [];
  for (const node of contents.slice(index + 1)) {
    if (node.type === "tag" && node.name === "br") break;
    const text = normalizedText($(node));
    if (text) value.push(text);
  }
  return value.join(" ").trim();
}

function parseStructuredInteger(
  value: string,
  label: string,
  reporter?: ScrapeReporter,
  code?: string,
): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  reporter?.issue({
    code: "invalid-format",
    path: code ? `disciplines.${code}.${label}` : label,
    message: "Campo numérico em formato inesperado",
    expected: "número inteiro",
    actual: value,
  });
  return null;
}

function parseWorkload(
  text: string,
  reporter?: ScrapeReporter,
  code?: string,
): ParsedWorkload {
  return {
    workload: {
      theoreticalHours: metric(
        text,
        "Total de Horas de Atividades Teóricas",
        reporter,
        code,
      ),
      practicalHours: metric(
        text,
        "Total de Horas de Atividades Práticas",
        reporter,
        code,
      ),
      laboratoryHours: metric(
        text,
        "Total de Horas de Laboratório",
        reporter,
        code,
      ),
      guidedActivityHours: metric(
        text,
        "Total de Horas de Atividades Orientadas",
        reporter,
        code,
      ),
      distanceHours: metric(
        text,
        "Total de Horas de Atividades à Distância",
        reporter,
        code,
      ),
      guidedExtensionHours: metric(
        text,
        "Total de Horas de Atividades Orientadas de Extensão",
        reporter,
        code,
      ),
      practicalExtensionHours: metric(
        text,
        "Total de Horas de Atividades Práticas de Extensão",
        reporter,
        code,
      ),
      weeks: metric(text, "Número de Semanas", reporter, code),
      weeklyClassHours: metric(
        text,
        "Total de Horas/Aula Semanais",
        reporter,
        code,
      ),
      classroomHours: metric(
        text,
        "Total de Horas/Aula Realizadas em Sala de Aula",
        reporter,
        code,
      ),
    },
    credits: metric(text, "Total de Créditos", reporter, code),
  };
}

function parseDisciplineSections(
  $: ReturnType<typeof loadHtml>,
  heading: DisciplineElement,
  reporter?: ScrapeReporter,
  code?: string,
): RawDisciplineSection[] {
  const sections: RawDisciplineSection[] = [];
  let current: RawDisciplineSection | null = null;
  $(heading)
    .nextUntil("h2[id^='disc-']")
    .each((_, element) => {
      if (element.tagName?.toLowerCase() === "h3") {
        if (current) sections.push(current);
        current = { heading: normalizedText($(element)), text: "" };
        if (
          !knownDisciplineHeadings.has(
            normalizeHeading(normalizedText($(element))),
          )
        )
          reporter?.issue({
            code: "unexpected-section",
            path: code ? `disciplines.${code}.sections` : "sections",
            message: "Seção de disciplina não reconhecida",
            actual: normalizedText($(element)),
          });
        return;
      }
      if (!current) return;
      const text = normalizedText($(element));
      if (text) current.text = current.text ? `${current.text}\n${text}` : text;
    });
  if (current) sections.push(current);
  return sections;
}

function sameHeading(value: string, expected: string): boolean {
  return normalizeHeading(value) === normalizeHeading(expected);
}

function normalizeHeading(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[：:]\s*$/, "")
    .trim()
    .toLowerCase();
}

function metric(
  text: string,
  label: string,
  reporter?: ScrapeReporter,
  code?: string,
): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const labelPattern = `${escaped}\\s*:\\s*`;
  const numeric = new RegExp(`${labelPattern}(\\d+)(?!\\d)`, "i").exec(text);
  if (numeric?.[1] !== undefined) return Number(numeric[1]);

  const labelMatch = new RegExp(labelPattern, "i").exec(text);
  if (!labelMatch) return null;

  const valueStart = (labelMatch.index ?? 0) + labelMatch[0].length;
  const actual = (
    text.slice(valueStart).split(/\s+(?=[A-ZÀ-Ý][^:]{0,120}:)/i)[0] ?? ""
  ).trim();
  if (actual.length > 0) {
    reporter?.issue({
      code: "invalid-format",
      path: code ? `disciplines.${code}.${label}` : label,
      message: "Campo numérico em formato inesperado",
      expected: "número inteiro",
      actual,
    });
  }
  return null;
}

function booleanValue(
  text: string | null,
  reporter?: ScrapeReporter,
  code?: string,
): boolean | null {
  if (!text) return null;
  if (/^sim$/i.test(text.trim())) return true;
  if (/^n[aã]o$/i.test(text.trim())) return false;
  reporter?.issue({
    code: "invalid-value",
    path: code ? `disciplines.${code}.finalExam` : "finalExam",
    message: "Valor booleano em formato inesperado",
    expected: "Sim ou Não",
    actual: text,
  });
  return null;
}

function percentage(
  text: string | null,
  reporter?: ScrapeReporter,
  code?: string,
): number | null {
  if (!text) return null;
  const value = text ? /(\d+(?:[.,]\d+)?)\s*%/.exec(text)?.[1] : undefined;
  if (value === undefined) {
    reporter?.issue({
      code: "invalid-format",
      path: code
        ? `disciplines.${code}.minimumAttendancePercent`
        : "percentage",
      message: "Percentual em formato inesperado",
      expected: "número seguido de %",
      actual: text,
    });
    return null;
  }
  return value === undefined ? null : Number(value.replace(",", "."));
}

function parseBibliography(text: string | null): string | null {
  if (!text || /^n[aã]o h[aá]\.?$/i.test(text.trim())) return null;
  return text.trim();
}

function parsePrerequisites(
  text: string | null,
  reporter?: ScrapeReporter,
  code?: string,
): Prerequisite {
  if (!text || /n[aã]o h[aá] pré-requisitos/i.test(text))
    return { raw: text, any: [] };
  const any = text
    .split(/\s+ou\s+/i)
    .map((alternative) => ({
      all: alternative
        .split("+")
        .map((value): PrerequisiteItem | null => {
          const partial = /^\s*\*/.test(value);
          const code = canonicalCode(
            value.replace(/^\s*\*/, "").replace(/[^A-Z0-9\s-]/gi, ""),
          );
          if (!code) return null;
          return {
            code,
            kind: partial
              ? "PARTIAL"
              : /^AA(?:200|4\d{2})$/.test(code)
                ? "SPECIAL"
                : "FULL",
          };
        })
        .filter((item): item is PrerequisiteItem => item !== null),
    }))
    .filter(({ all }) => all.length > 0);
  if (any.length === 0)
    reporter?.issue({
      code: "unrecognized-content",
      path: code ? `disciplines.${code}.prerequisites` : "prerequisites",
      message: "Pré-requisitos não puderam ser interpretados",
      actual: text,
    });
  return { raw: text, any };
}
export const catalogoDisciplinasPrefixo: PageAdapter<
  CatalogoDisciplinasPrefixoInput,
  CatalogoDisciplinasPrefixoPage
> = {
  id: "catalogo-disciplinas-prefixo",
  fetch: fetchCatalogoDisciplinasPrefixo,
  parse: parseCatalogoDisciplinasPrefixo,
};

function parseRequirements(table: ReturnType<typeof loadHtml>): Requisito[] {
  const requirements = new Map<string, Requisito>();
  table("a").each((_, anchor) => {
    const code = canonicalCode(normalizedText(table(anchor)));
    const requirement =
      code === "-----"
        ? { type: "any" as const }
        : /^[A-Z]{2}---$/.test(code)
          ? { type: "prefix" as const, code: code.slice(0, 2) }
          : /^(?:[A-Z]{2}\d{3}|F \d{3,4})$/.test(code)
            ? { type: "specific" as const, code }
            : undefined;
    if (requirement)
      requirements.set(
        `${requirement.type}:${requirement.code ?? ""}`,
        requirement,
      );
  });
  return [...requirements.values()];
}

export async function fetchCursoCurriculo(
  input: CursoPaginaInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url);
}

export function parseCursoCurriculo(
  html: string,
  _input: CursoPaginaInput,
): CurriculoPage {
  const $ = loadHtml(html);
  const blocks: CurriculoPage["blocks"] = [];
  const specializations = new Map<
    string,
    {
      code: string;
      name: string;
      blocks: CurriculoPage["blocks"];
    }
  >();
  let current:
    { code: string; name: string; blocks: CurriculoPage["blocks"] } | undefined;
  let kind: "mandatory" | "elective" | undefined;
  let electiveCredits: number | null = null;

  $("h2,h3,p,table").each((_, element) => {
    const value = normalizedText($(element));
    if (element.tagName === "h2") {
      kind = undefined;
      const match = /^([A-Z]{2})\s*-\s*(.+)$/i.exec(value);
      if (!match) {
        current = undefined;
        return;
      }
      current = specializations.get(match[1]) ?? {
        code: match[1],
        name: match[2],
        blocks: [],
      };
      specializations.set(match[1], current);
      return;
    }
    if (element.tagName === "h3") {
      if (/opções por língua/i.test(value)) {
        kind = "mandatory";
        current = undefined;
      } else if (/disciplinas eletivas/i.test(value)) {
        kind = "elective";
      } else if (/núcleo comum|disciplinas obrigatórias/i.test(value)) {
        kind = "mandatory";
      }
      return;
    }
    if (element.tagName === "p" && kind === "elective") {
      const match = /obter\s+(\d+)\s+créditos/i.exec(value);
      electiveCredits = match ? Number(match[1]) : null;
      return;
    }
    if (element.tagName !== "table" || !kind) return;
    const table = loadHtml($(element).toString());
    const requirements = parseRequirements(table);
    if (!requirements.length) return;
    const block = {
      type: kind,
      credits: kind === "elective" ? electiveCredits : null,
      requirements,
    };
    (current?.blocks ?? blocks).push(block);
    electiveCredits = null;
  });
  return { blocks, specializations: [...specializations.values()] };
}

export const cursoCurriculo: PageAdapter<CursoPaginaInput, CurriculoPage> = {
  id: "curso-curriculo",
  fetch: fetchCursoCurriculo,
  parse: parseCursoCurriculo,
};

export async function fetchCursoMembros(
  input: CursoPaginaInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url);
}

export function parseCursoMembros(
  html: string,
  _input: CursoPaginaInput,
): MembrosPage {
  const $ = loadHtml(html);
  const heading = normalizedText($("h1").first());
  return {
    unitCode: /-\s*([A-Z][A-Z0-9]{1,9})\s*$/.exec(heading)?.[1] ?? "DAC",
  };
}

export const cursoMembros: PageAdapter<CursoPaginaInput, MembrosPage> = {
  id: "curso-membros",
  fetch: fetchCursoMembros,
  parse: parseCursoMembros,
};

export async function fetchCursoSugestao(
  input: CursoPaginaInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url);
}

export function parseCursoSugestao(
  html: string,
  _input: CursoPaginaInput,
): SugestaoPage {
  const $ = loadHtml(html);
  const suggestions: SugestaoPage["suggestions"] = [];
  const semesterTitle = /^(\d+)[º°o.]?\s+Semestre\s*-\s*(\d+)\s+cr[eé]ditos$/i;
  const courseTitle = /^([A-Z]{1,3}\s*[A-Z]?\s*\d{3,4}\*?)\s*\((\d+)\)$/i;
  const electiveCredits = /(\d+)\s+cr[eé]ditos\s+eletivos/i;

  $("h2").each((_, heading) => {
    const title = normalizedText($(heading));
    const suggestion = suggestionTitle.exec(title);
    if (!suggestion?.groups) return;
    const semesters: SugestaoPage["suggestions"][number]["semesters"] = [];
    $(heading)
      .nextAll()
      .each((__, element) => {
        if (element.tagName === "h2") return false;
        if (element.tagName !== "h3") return;
        const semester = semesterTitle.exec(normalizedText($(element)));
        if (!semester) return;
        const paragraph = $(element).nextAll("p").first();
        if (!paragraph.length) return;
        const courses = paragraph
          .find("a")
          .toArray()
          .flatMap((anchor) => {
            const course = courseTitle.exec(normalizedText($(anchor)));
            return course
              ? [{ code: canonicalCode(course[1]), credits: Number(course[2]) }]
              : [];
          });
        const elective = electiveCredits.exec(normalizedText(paragraph));
        semesters.push({
          semester: Number(semester[1]),
          credits: Number(semester[2]),
          electiveCredits: elective ? Number(elective[1]) : 0,
          courses,
        });
      });
    if (semesters.length)
      suggestions.push({
        code: canonicalCode(suggestion.groups.code),
        name: suggestion.groups.name.trim(),
        semesters,
      });
  });
  return { suggestions };
}

export const cursoSugestao: PageAdapter<CursoPaginaInput, SugestaoPage> = {
  id: "curso-sugestao",
  fetch: fetchCursoSugestao,
  parse: parseCursoSugestao,
};

export async function crawlCatalogoDisciplinas(
  input: { firstYear: number; lastYear: number },
  context: ScrapingContext,
): Promise<ScrapeResult<CatalogoDisciplinas>> {
  const years = Array.from(
    { length: input.lastYear - input.firstYear + 1 },
    (_, offset) => input.firstYear + offset,
  );
  const catalogs = await context.map(years, async (year) => {
    const index = await context.tryLoad(catalogoDisciplinasIndice, { year });
    if (!index) return undefined;
    const prefixes = await context.map(index.data.prefixes, async (prefix) =>
      context.tryLoad(catalogoDisciplinasPrefixo, prefix),
    );
    return {
      year,
      sourceUrl: disciplinesUrl(year),
      prefixes: prefixes.flatMap((page) =>
        page
          ? [
              {
                ...(page.metadata.input as PrefixoReferencia),
                ...page.data,
                courses: page.data.courses.map(
                  ({ rawSections: _, ...course }) => course,
                ),
              },
            ]
          : [],
      ),
    };
  });
  return {
    data: {
      firstYear: input.firstYear,
      lastYear: input.lastYear,
      catalogs: catalogs.flatMap((catalog) => (catalog ? [catalog] : [])),
    },
    issues: context.issues,
    pages: context.pages,
  };
}

async function selectedCatalogs(
  input: { firstYear: number; lastYear: number },
  context: ScrapingContext,
): Promise<number[]> {
  const page = await context.load(catalogosIndice, {});
  return page.data.years.filter(
    (year) => year >= input.firstYear && year <= input.lastYear,
  );
}

export async function crawlCatalogoCurriculos(
  input: { firstYear: number; lastYear: number },
  context: ScrapingContext,
): Promise<ScrapeResult<CatalogoCurriculos>> {
  const years = await selectedCatalogs(input, context);
  const catalogs = await context.map(years, async (year) => {
    const catalog = await context.tryLoad(catalogoProgramas, { year });
    if (!catalog) return undefined;
    const programs = await context.map(
      catalog.data.programs,
      async (program) => {
        const curriculum = await context.tryLoad(
          cursoCurriculo,
          program.curriculum,
        );
        return curriculum ? { ...program, ...curriculum.data } : undefined;
      },
    );
    return {
      year,
      sourceUrl: catalog.data.sourceUrl,
      programs: programs.flatMap((program) => (program ? [program] : [])),
    };
  });
  return {
    data: {
      catalogs: catalogs.flatMap((catalog) => (catalog ? [catalog] : [])),
    },
    issues: context.issues,
    pages: context.pages,
  };
}

export async function crawlSugestaoCurriculo(
  input: { firstYear: number; lastYear: number },
  context: ScrapingContext,
): Promise<ScrapeResult<SugestaoCurriculo>> {
  const years = await selectedCatalogs(input, context);
  const catalogs = await context.map(years, async (year) => {
    const catalog = await context.tryLoad(catalogoProgramas, { year });
    if (!catalog) return undefined;
    const programs = await context.map(
      catalog.data.programs,
      async (program) => {
        const suggestion = await context.tryLoad(
          cursoSugestao,
          program.suggestion,
        );
        return suggestion?.data.suggestions.length
          ? { ...program, ...suggestion.data }
          : undefined;
      },
    );
    return {
      year,
      sourceUrl: catalog.data.sourceUrl,
      programs: programs.flatMap((program) => (program ? [program] : [])),
    };
  });
  return {
    data: {
      source: catalogsPortalUrl,
      firstYear: input.firstYear,
      lastYear: input.lastYear,
      catalogs: catalogs.flatMap((catalog) => (catalog ? [catalog] : [])),
    },
    issues: context.issues,
    pages: context.pages,
  };
}
