import type { AnyNode } from "domhandler";
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
export const catalogDirectory = (year: number) =>
  year === 1998 || year === 1999
    ? `catalogo${String(year).slice(2)}`
    : `catalogo${year}`;
export const catalogProgramsUrl = (year: number) =>
  `https://www.dac.unicamp.br/sistemas/catalogos/grad/${catalogDirectory(year)}/${year < 2021 ? "cursos.html" : "index.html"}`;
const disciplinesUrl = (year: number) =>
  `https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo${year}/disciplinas/index.html`;
export type CatalogosIndiceInput = { url?: string };
export type CatalogoProgramasInput = { year: number; url?: string };
export type CatalogosProgramasInput = {
  firstYear: number;
  lastYear: number;
};
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
export type CatalogProgramLayout =
  "LEGACY_CLASSIC" | "LEGACY_INTERMEDIATE" | "MODERN";
export type CatalogProgramReference = {
  code: number;
  name: string;
  shift: CatalogProgramShift | null;
  sourceUrl: string;
};
export type CatalogoProgramasHistoricosPage = {
  year: number;
  sourceUrl: string;
  layout: CatalogProgramLayout;
  programs: CatalogProgramReference[];
};
export type CatalogosProgramas = {
  firstYear: number;
  lastYear: number;
  catalogs: CatalogoProgramasHistoricosPage[];
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
export type CursoInformacoesSection = {
  level: number;
  heading: string;
  headingKey: string;
  parentHeadingKey: string | null;
  content: string[];
};
export type CursoInformacoesPage = {
  programCode: number;
  programName: string;
  sourceUrl: string;
  curriculumUrl: string | null;
  pageTitle: string;
  sections: CursoInformacoesSection[];
};
export type CurriculoEspecializacoesPage = {
  sourceUrl: string;
  specializations: Array<{ code: string; name: string }>;
};
export type CatalogProgramShift = "DAYTIME" | "NIGHT";
export type CatalogCreditLimitType = "NONE" | "FIXED" | "CR_FORMULA";
export type CatalogProgramVariantInformation = {
  specializationCode: string | null;
  specializationName: string | null;
  integralizationCredits: number | null;
  integralizationSupervisedHours: number | null;
  integralizationExtensionHours: number | null;
  integralizationSemesters: number | null;
  integralizationMaximumSemesters: number | null;
  professionalDescription: string | null;
  recognitionDescription: string | null;
};
export type CatalogProgramInformation = {
  sourceUrl: string;
  shift: CatalogProgramShift | null;
  creditLimitType: CatalogCreditLimitType | null;
  creditLimitFixedCredits: number | null;
  creditLimitBeforeThresholdCredits: number | null;
  creditLimitThresholdCredits: number | null;
  creditLimitCrBase: number | null;
  creditLimitCrMultiplier: number | null;
  professionalPracticeDescription: string | null;
  variants: CatalogProgramVariantInformation[];
};
export type CatalogoInformacoesValidationViolation = {
  year: number;
  programCode: number;
  programName: string;
  specializationCode: string | null;
  rule: string;
  message: string;
  actual?: string | number | null;
};
export type CatalogoInformacoesValidation = {
  checkedPrograms: number;
  checkedVariants: number;
  byYear: Array<{
    year: number;
    programs: number;
    variants: number;
    programVariants: number;
    specializationVariants: number;
    violations: number;
  }>;
  checks: Array<{
    rule: string;
    passed: boolean;
    violations: number;
  }>;
  violations: CatalogoInformacoesValidationViolation[];
};
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
        [
          ...html.matchAll(/catalogo(\d{2}|\d{4})\/(?:index|cursos)\.html/gi),
        ].map((match) => {
          const value = Number(match[1]);
          return match[1].length === 2
            ? value >= 90
              ? 1900 + value
              : 2000 + value
            : value;
        }),
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

function catalogProgramLayout(year: number): CatalogProgramLayout {
  if (year <= 2011) return "LEGACY_CLASSIC";
  if (year <= 2020) return "LEGACY_INTERMEDIATE";
  return "MODERN";
}

function programNameAndShift(value: string): {
  name: string;
  shift: CatalogProgramShift | null;
} {
  const match = /^(.*?)\s*-\s*(Integral|Noturno|Diurno)\s*$/i.exec(value);
  if (!match) return { name: value.trim(), shift: null };
  return {
    name: match[1].trim(),
    shift: /^noturno$/i.test(match[2]) ? "NIGHT" : "DAYTIME",
  };
}

export async function fetchCatalogoProgramasHistoricos(
  input: CatalogoProgramasInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url ?? catalogProgramsUrl(input.year));
}

export function parseCatalogoProgramasHistoricos(
  html: string,
  input: CatalogoProgramasInput,
  reporter?: ScrapeReporter,
): CatalogoProgramasHistoricosPage {
  const $ = loadHtml(html);
  const sourceUrl = input.url ?? catalogProgramsUrl(input.year);
  const programs = new Map<number, CatalogProgramReference>();
  if (input.year >= 2021)
    $("a.rotulo-curso").each((_, anchor) => {
      const title = courseTitle.exec(normalizedText($(anchor)));
      if (!title) return;
      const code = Number(title[1]);
      const parent = $(anchor).closest("li");
      const href =
        parent.find('a[href$="/index.html"]').first().attr("href") ??
        parent.find('a[href*="curriculo.html"]').first().attr("href");
      if (!href) return;
      const { name, shift } = programNameAndShift(
        normalizedText($(anchor)).replace(/^\d+\s*-\s*/, ""),
      );
      programs.set(code, {
        code,
        name,
        shift,
        sourceUrl: absoluteUrl(href, sourceUrl),
      });
    });
  else
    $("a[href]").each((_, anchor) => {
      const href = $(anchor).attr("href");
      if (!href) return;
      const url = absoluteUrl(href, sourceUrl);
      const match = /\/cursos\/cur0*(\d+)\.html$/i.exec(new URL(url).pathname);
      if (!match) return;
      const code = Number(match[1]);
      const label = normalizedText($(anchor));
      if (!label) return;
      const { name, shift } = programNameAndShift(
        label.replace(/^\d+\s*-\s*/, ""),
      );
      const existing = programs.get(code);
      if (existing && (existing.name !== name || existing.shift !== shift)) {
        reporter?.issue({
          code: "invalid-value",
          path: `programs.${code}`,
          message: "Mesmo código possui descrições diferentes no catálogo",
          expected: JSON.stringify({
            name: existing.name,
            shift: existing.shift,
          }),
          actual: JSON.stringify({ name, shift }),
        });
        return;
      }
      programs.set(code, { code, name, shift, sourceUrl: url });
    });
  if (programs.size === 0)
    reporter?.issue({
      code: "unrecognized-content",
      path: "programs",
      message: "Nenhum programa reconhecido na página histórica",
      expected: "links cursos/curNNN.html",
    });
  return {
    year: input.year,
    sourceUrl,
    layout: catalogProgramLayout(input.year),
    programs: [...programs.values()].sort(
      (left, right) => left.code - right.code,
    ),
  };
}

export const catalogoProgramasHistoricos: PageAdapter<
  CatalogoProgramasInput,
  CatalogoProgramasHistoricosPage
> = {
  id: "catalogo-programas-historicos",
  fetch: fetchCatalogoProgramasHistoricos,
  parse: parseCatalogoProgramasHistoricos,
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

function headingKey(input: string): string {
  return normalizeHeading(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export async function fetchCursoInformacoes(
  input: CursoPaginaInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url);
}

function curriculumUrlFromPage(
  $: ReturnType<typeof loadHtml>,
  sourceUrl: string,
): string | null {
  const anchor = $("a[href]")
    .toArray()
    .find((element) => {
      const href = $(element).attr("href") ?? "";
      const label = normalizedText($(element));
      return (
        /curr[ií]culo pleno/i.test(label) ||
        /(?:^|\/)(?:cpl?\d+|curriculo)\.html(?:$|[?#])/i.test(href)
      );
    });
  const href = anchor ? $(anchor).attr("href") : undefined;
  return href ? absoluteUrl(href, sourceUrl) : null;
}

export async function fetchCurriculoEspecializacoes(
  input: CursoPaginaInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url);
}

export function parseCurriculoEspecializacoes(
  html: string,
  input: CursoPaginaInput,
): CurriculoEspecializacoesPage {
  const $ = loadHtml(html);
  const specializations = new Map<string, { code: string; name: string }>();
  $("h1,h2,h3,b,strong").each((_, element) => {
    const match =
      /^(?:Habilitação\s+|Modalidade\s+)?([A-Z]{2})\s*[-–]\s*(.+)$/i.exec(
        normalizedText($(element)),
      );
    if (!match) return;
    const code = match[1].toUpperCase();
    const name = match[2].replace(/\s*:\s*$/, "").trim();
    if (name) specializations.set(code, { code, name });
  });
  return {
    sourceUrl: input.url,
    specializations: [...specializations.values()],
  };
}

export const curriculoEspecializacoes: PageAdapter<
  CursoPaginaInput,
  CurriculoEspecializacoesPage
> = {
  id: "curriculo-especializacoes",
  fetch: fetchCurriculoEspecializacoes,
  parse: parseCurriculoEspecializacoes,
};

type LegacyInformationGroup = {
  heading: string;
  inlineContent: string;
  extraContent: string[];
  nodes: AnyNode[];
};

function legacyGroupContent(
  group: LegacyInformationGroup,
  $: ReturnType<typeof loadHtml>,
): string[] {
  return [
    group.inlineContent,
    ...group.extraContent,
    ...group.nodes.map((node) => legacyText(node, $)),
  ].filter(Boolean);
}

function legacyText(node: AnyNode, $: ReturnType<typeof loadHtml>): string {
  return normalizedText($(node));
}

function plausibleLegacySpecializationName(value: string): boolean {
  return (
    value.length > 2 &&
    value.length <= 80 &&
    !/^(?:para graduar|o aluno|o profissional|diferentes especializa|o curso|deverá|devera)\b/i.test(
      value.trim(),
    )
  );
}

function legacyNamedEntries(
  value: string,
  names: Array<{ code: string | null; name: string }> = [],
): Array<{ code: string | null; name: string; content: string }> {
  const text = value.replace(/\s+/g, " ").trim();
  const uniqueNames = [
    ...new Map(
      names
        .map((entry) => ({
          ...entry,
          name: entry.name.replace(/\s+/g, " ").trim(),
        }))
        .filter((entry) => plausibleLegacySpecializationName(entry.name))
        .map((entry) => [entry.name.toLowerCase(), entry]),
    ).values(),
  ];
  const codedMarkers = uniqueNames
    .filter(
      (entry): entry is { code: string; name: string } => entry.code !== null,
    )
    .flatMap((entry) => {
      const code = entry.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const name = entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `(?:^|\\s)(?:Habilitação\\s+)?${code}\\s*[-–]\\s*${name}(?=\\s*(?::|Para graduar|Reconhecido|Não haverá|$))`,
        "gi",
      );
      return [...text.matchAll(pattern)].map((match) => ({
        ...entry,
        index: match.index!,
        end: match.index! + match[0].length,
      }));
    })
    .sort((left, right) => left.index - right.index);
  if (codedMarkers.length > 0)
    return codedMarkers.map((marker, index) => ({
      code: marker.code,
      name: marker.name,
      content: text
        .slice(marker.end, codedMarkers[index + 1]?.index ?? text.length)
        .replace(/^\s*:\s*/, "")
        .trim(),
    }));

  const codePattern =
    /(?:^|\s)(?:Habilitação\s+)?([A-Z]{2})\s*[-–]\s*([^:]+?)(?=:|\s+(?:Habilitação\s+)?[A-Z]{2}\s*[-–])/gi;
  const codeMatches = [...text.matchAll(codePattern)];
  if (codeMatches.length > 0)
    return codeMatches.map((match, index) => ({
      code: match[1].toUpperCase(),
      name: match[2].trim(),
      content: text
        .slice(
          match.index! + match[0].length,
          codeMatches[index + 1]?.index ?? text.length,
        )
        .replace(/^\s*:\s*/, "")
        .trim(),
    }));

  const markers = uniqueNames
    .flatMap((entry) => {
      const pattern = new RegExp(
        `(?:^|\\s)${entry.name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?=\\s*(?::|\\d+\\s+cr[eé]ditos|Para graduar|Não haverá))`,
        "gi",
      );
      return [...text.matchAll(pattern)].map((match) => ({
        ...entry,
        index: match.index! + (match[0].length - entry.name.length),
        end: match.index! + match[0].length,
      }));
    })
    .sort((left, right) => left.index - right.index);
  return markers.map((marker, index) => ({
    code: marker.code,
    name: marker.name,
    content: text
      .slice(marker.end, markers[index + 1]?.index ?? text.length)
      .replace(/^\s*:\s*/, "")
      .trim(),
  }));
}

function legacyGroupSections(
  $: ReturnType<typeof loadHtml>,
): LegacyInformationGroup[] {
  const container = $("div.div100")
    .filter((_, element) => $(element).find("h2").length > 0)
    .last();
  if (!container.length) return [];
  const groups: LegacyInformationGroup[] = [];
  let current: LegacyInformationGroup | undefined;
  for (const node of container.contents().toArray()) {
    const tag = node.type === "tag" ? node.tagName.toLowerCase() : "";
    const value = legacyText(node, $);
    const nestedHeading =
      tag !== "h2" ? $(node).find("h2").first().text().trim() : "";
    if (tag === "h2" || nestedHeading) {
      const headingValue = nestedHeading || value;
      const match = /^([^:]+):\s*(.+)$/.exec(headingValue);
      current = {
        heading: (match?.[1] ?? headingValue).trim(),
        inlineContent: match?.[2]?.trim() ?? "",
        extraContent: [],
        nodes: [],
      };
      groups.push(current);
      continue;
    }
    if (current && value) current.nodes.push(node);
  }
  return groups;
}

function legacyParagraphSections(
  $: ReturnType<typeof loadHtml>,
): LegacyInformationGroup[] {
  const paragraphs = $("body p")
    .toArray()
    .map((node) => legacyText(node, $))
    .filter(Boolean);
  const turn = $("body center")
    .toArray()
    .map((node) => legacyText(node, $))
    .find((value) => /(?:Período|Turno)\s*:/i.test(value));
  const groups: LegacyInformationGroup[] = [];
  if (turn) {
    const match = /(?:Período|Turno)\s*:\s*(Integral|Noturno)/i.exec(turn);
    groups.push({
      heading: "Turno",
      inlineContent: match?.[1] ?? "",
      extraContent: [],
      nodes: [],
    });
  }
  const headings = [
    "O Profissional",
    "Integralização",
    "Reconhecimento",
    "Limite de Créditos para matrícula semestral",
  ];
  const headingPositions = paragraphs.flatMap((paragraph, index) => {
    const heading = headings.find((candidate) =>
      paragraph.toLowerCase().startsWith(candidate.toLowerCase()),
    );
    return heading ? [{ index, heading }] : [];
  });
  for (let position = 0; position < headingPositions.length; position += 1) {
    const { index, heading } = headingPositions[position];
    const paragraph = paragraphs[index];
    const content = paragraph.slice(heading.length).trim();
    const nextHeadingIndex =
      headingPositions[position + 1]?.index ?? paragraphs.length;
    groups.push({
      heading,
      inlineContent: content,
      extraContent: paragraphs.slice(index + 1, nextHeadingIndex),
      nodes: [],
    });
  }
  return groups;
}

function parseLegacyCursoInformacoes(
  input: CursoPaginaInput,
  $: ReturnType<typeof loadHtml>,
): CursoInformacoesPage {
  const groups = legacyGroupSections($);
  const resolvedGroups = groups.length ? groups : legacyParagraphSections($);
  const sections: CursoInformacoesSection[] = [];
  const professionalGroup = resolvedGroups.find((group) =>
    /^o profissional$/i.test(group.heading),
  );
  const allInformationText = resolvedGroups
    .flatMap((group) => legacyGroupContent(group, $))
    .join(" ");
  const candidateNames = [
    ...allInformationText.matchAll(
      /(?:^|[.:])\s*([A-ZÀ-Ú][^.:]{2,80}?)(?=:\s*)/g,
    ),
  ]
    .map((match) => ({ code: null, name: match[1].trim() }))
    .filter((entry) => plausibleLegacySpecializationName(entry.name));
  const professionalText = professionalGroup
    ? legacyGroupContent(professionalGroup, $).join(" ")
    : "";
  const professionalEntries = professionalGroup
    ? legacyNamedEntries(professionalText, candidateNames)
    : [];
  const knownVariants = professionalEntries.map(({ code, name }) => ({
    code,
    name,
  }));

  for (const group of resolvedGroups) {
    const key = headingKey(group.heading);
    if (key === "turno") {
      sections.push({
        level: 2,
        heading: "Turno",
        headingKey: key,
        parentHeadingKey: null,
        content: group.inlineContent ? [group.inlineContent] : [],
      });
      continue;
    }
    if (key === "o-profissional") {
      const firstVariant = professionalEntries[0]
        ? professionalText.indexOf(professionalEntries[0].name)
        : -1;
      const general = professionalText
        .slice(0, firstVariant >= 0 ? firstVariant : professionalText.length)
        .replace(/\s*Habilitação\s+[A-Z]{2}\s*[-–]\s*$/i, "")
        .trim();
      sections.push({
        level: 2,
        heading: group.heading,
        headingKey: key,
        parentHeadingKey: null,
        content: general ? [general] : [],
      });
      for (const entry of professionalEntries)
        sections.push({
          level: 3,
          heading: `${entry.code ? `${entry.code} - ` : ""}${entry.name}`,
          headingKey: headingKey(entry.name),
          parentHeadingKey: key,
          content: entry.content ? [entry.content] : [],
        });
      continue;
    }
    if (key === "integralizacao") {
      const content = legacyGroupContent(group, $).join(" ");
      const inferredNames = [
        ...content.matchAll(
          /(?:^|[.:])\s*([A-ZÀ-Ú][^.:]+?)\s+(?=\d+\s+cr[eé]ditos)/g,
        ),
      ]
        .map((match) => ({ code: null, name: match[1].trim() }))
        .filter((entry) => plausibleLegacySpecializationName(entry.name));
      const entries = legacyNamedEntries(content, [
        ...(knownVariants.length > 0
          ? knownVariants
          : [...candidateNames, ...inferredNames]),
        ...(/Para Matrícula Antes da Opção/i.test(content)
          ? [{ code: "AX", name: "Para Matrícula Antes da Opção" }]
          : []),
      ]);
      sections.push({
        level: 2,
        heading: group.heading,
        headingKey: key,
        parentHeadingKey: null,
        content: entries.length ? [] : content ? [content] : [],
      });
      for (const entry of entries)
        sections.push({
          level: 3,
          heading: `${entry.code ? `${entry.code} - ` : ""}${entry.name}`,
          headingKey: headingKey(entry.name),
          parentHeadingKey: key,
          content: entry.content ? [entry.content] : [],
        });
      continue;
    }
    if (key === "reconhecimento") {
      const content = legacyGroupContent(group, $).join(" ");
      const entries = legacyNamedEntries(content, knownVariants);
      sections.push({
        level: 2,
        heading: group.heading,
        headingKey: key,
        parentHeadingKey: null,
        content: entries.length ? [] : content ? [content] : [],
      });
      for (const entry of entries)
        sections.push({
          level: 3,
          heading: `${entry.code ? `${entry.code} - ` : ""}${entry.name}`,
          headingKey: headingKey(entry.name),
          parentHeadingKey: key,
          content: entry.content ? [entry.content] : [],
        });
      continue;
    }
    if (key === "limite-de-creditos-para-matricula-semestral") {
      const content = legacyGroupContent(group, $)
        .flatMap((value) => value.split(/(?=\d+\s*[-–]\s*)/))
        .map((value) => value.replace(/^\s*-\s*/, "").trim())
        .filter(Boolean);
      sections.push({
        level: 2,
        heading: group.heading,
        headingKey: key,
        parentHeadingKey: null,
        content,
      });
    }
  }
  return {
    programCode: input.programCode,
    programName: input.name,
    sourceUrl: input.url,
    curriculumUrl: curriculumUrlFromPage($, input.url),
    pageTitle:
      normalizedText($("h1").first()) ||
      `Curso ${input.programCode} - ${input.name}`,
    sections,
  };
}

export function parseCursoInformacoes(
  html: string,
  input: CursoPaginaInput,
): CursoInformacoesPage {
  const $ = loadHtml(html);
  const main = $("section.main-section").first();
  if (!main.length && ($("div.div100").length > 0 || $("h2").length === 0))
    return parseLegacyCursoInformacoes(input, $);
  const root = main.length ? main : $("html").first();
  const pageTitle = normalizedText(root.find("h1").first());
  const sections: CursoInformacoesSection[] = [];
  let current: CursoInformacoesSection | undefined;
  const activeHeadings = new Map<number, string>();

  root.find("h2,h3,h4,h5,h6,p,li").each((_, element) => {
    const node = $(element);
    if (node.closest(".breadcrumbs,.off-canvas-list,#footer").length > 0)
      return;

    const tag = element.tagName?.toLowerCase();
    const value = normalizedText(node);
    if (!value) return;

    if (/^h[2-6]$/.test(tag ?? "")) {
      const level = Number(tag!.slice(1));
      const inline = /^([^:]{2,100}):\s*(.+)$/.exec(value);
      const heading = inline?.[1]?.trim() ?? value;
      const content = inline?.[2] ? [inline[2].trim()] : [];
      const parentHeadingKey =
        activeHeadings.get(level - 1) ??
        [...activeHeadings.entries()]
          .filter(([activeLevel]) => activeLevel < level)
          .sort(([left], [right]) => right - left)[0]?.[1] ??
        null;
      const section: CursoInformacoesSection = {
        level,
        heading,
        headingKey: headingKey(heading),
        parentHeadingKey,
        content,
      };
      sections.push(section);
      current = section;
      for (const activeLevel of activeHeadings.keys())
        if (activeLevel >= level) activeHeadings.delete(activeLevel);
      activeHeadings.set(level, section.headingKey);
      return;
    }

    if (current) current.content.push(value);
  });

  return {
    programCode: input.programCode,
    programName: input.name,
    sourceUrl: input.url,
    curriculumUrl: curriculumUrlFromPage($, input.url),
    pageTitle,
    sections,
  };
}

export const cursoInformacoes: PageAdapter<
  CursoPaginaInput,
  CursoInformacoesPage
> = {
  id: "curso-informacoes",
  fetch: fetchCursoInformacoes,
  parse: parseCursoInformacoes,
};

type InformationVariantEntry = {
  specializationCode: string | null;
  specializationName: string | null;
  content: string;
};

const informationVariantSectionKeys = [
  "integralizacao",
  "o-profissional",
  "reconhecimento",
] as const;

const informationTopLevelSectionKeys = new Set([
  "turno",
  "limite-de-creditos-para-matricula-semestral",
  "integralizacao",
  "o-profissional",
  "reconhecimento",
  "exercicio-profissional",
]);

function sectionContent(section: CursoInformacoesSection | undefined): string {
  return section?.content.join("\n") ?? "";
}

function informationVariantEntry(
  section: CursoInformacoesSection,
): InformationVariantEntry {
  const match = /^([A-Z]{2})\s*[-–]\s*(.+)$/i.exec(section.heading);
  return {
    specializationCode: match?.[1]?.toUpperCase() ?? null,
    specializationName:
      match?.[2]?.trim() ??
      (section.parentHeadingKey ? section.heading.trim() : null),
    content: sectionContent(section),
  };
}

function informationVariantEntries(
  page: CursoInformacoesPage,
  sectionKey: (typeof informationVariantSectionKeys)[number],
): InformationVariantEntry[] {
  const direct = page.sections.find(
    (section) => section.headingKey === sectionKey,
  );
  const children = page.sections
    .filter((section) => section.parentHeadingKey === sectionKey)
    .map(informationVariantEntry);
  const directContent = sectionContent(direct);
  return directContent
    ? [
        {
          specializationCode: null,
          specializationName: null,
          content: directContent,
        },
        ...children,
      ]
    : children;
}

function parseDecimal(value: string): number {
  return Number(value.replace(",", "."));
}

type ParsedCreditLimit = Pick<
  CatalogProgramInformation,
  | "creditLimitType"
  | "creditLimitFixedCredits"
  | "creditLimitBeforeThresholdCredits"
  | "creditLimitThresholdCredits"
  | "creditLimitCrBase"
  | "creditLimitCrMultiplier"
>;

function emptyCreditLimit(): ParsedCreditLimit {
  return {
    creditLimitType: null,
    creditLimitFixedCredits: null,
    creditLimitBeforeThresholdCredits: null,
    creditLimitThresholdCredits: null,
    creditLimitCrBase: null,
    creditLimitCrMultiplier: null,
  };
}

function parseCreditLimit(
  section: CursoInformacoesSection | undefined,
): ParsedCreditLimit {
  const content = section?.content ?? [];
  if (content.length !== 1 && content.length !== 2) return emptyCreditLimit();
  const text = content.join(" ");
  if (/^Não tem\.?$/i.test(text))
    return {
      ...emptyCreditLimit(),
      creditLimitType: "NONE",
    };
  const fixed =
    /^Máximo de (\d+) créditos(?: por período(?: letivo)?)?\.?$/i.exec(text);
  if (fixed)
    return {
      ...emptyCreditLimit(),
      creditLimitType: "FIXED",
      creditLimitFixedCredits: Number(fixed[1]),
    };
  if (content.length !== 2) return emptyCreditLimit();
  const first =
    /^1\s*[–-]\s*Até que tenha matrícula em (\d+) créditos:\s*Máximo de (\d+) créditos por período\.?$/i.exec(
      content[0],
    );
  const second =
    /^2\s*[–-]\s*A partir do período seguinte em que se tenha totalizado matrícula em (\d+) créditos:\s*o máximo de créditos por período será dado pela expressão:\s*(\d+)\s*\+\s*([\d.,]+)\s*CR\.?$/i.exec(
      content[1],
    );
  if (!first || !second || Number(first[1]) !== Number(second[1]))
    return emptyCreditLimit();
  return {
    creditLimitType: "CR_FORMULA",
    creditLimitFixedCredits: null,
    creditLimitBeforeThresholdCredits: Number(first[2]),
    creditLimitThresholdCredits: Number(first[1]),
    creditLimitCrBase: Number(second[2]),
    creditLimitCrMultiplier: parseDecimal(second[3]),
  };
}

type ParsedIntegralization = Pick<
  CatalogProgramVariantInformation,
  | "integralizationCredits"
  | "integralizationSupervisedHours"
  | "integralizationExtensionHours"
  | "integralizationSemesters"
  | "integralizationMaximumSemesters"
>;

function emptyIntegralization(): ParsedIntegralization {
  return {
    integralizationCredits: null,
    integralizationSupervisedHours: null,
    integralizationExtensionHours: null,
    integralizationSemesters: null,
    integralizationMaximumSemesters: null,
  };
}

function parseIntegralization(text: string): ParsedIntegralization {
  const match =
    /total de (\d+) créditos, correspondentes a (\d+) horas de atividades supervisionadas(?: e (\d+) horas de atividades de extensão)?,?\s*que poderão ser integralizadas em (\d+) semestres.*?prazo máximo de integralização (\d+) semestres/i.exec(
      text,
    );
  if (match)
    return {
      integralizationCredits: Number(match[1]),
      integralizationSupervisedHours: Number(match[2]),
      integralizationExtensionHours: match[3] ? Number(match[3]) : null,
      integralizationSemesters: Number(match[4]),
      integralizationMaximumSemesters: Number(match[5]),
    };
  const legacy =
    /^(?:.*?)(\d+)\s+cr[eé]ditos,\s+(?:equivalentes|correspondentes)\s+a\s+(\d+)\s+horas.*?integralizadas?\s+em\s+(\d+)\s+semestres.*?prazo máximo de integralização\s+(\d+)\s+semestres/i.exec(
      text,
    );
  if (!legacy) return emptyIntegralization();
  return {
    integralizationCredits: Number(legacy[1]),
    integralizationSupervisedHours: Number(legacy[2]),
    integralizationExtensionHours: null,
    integralizationSemesters: Number(legacy[3]),
    integralizationMaximumSemesters: Number(legacy[4]),
  };
}

function parseShift(
  section: CursoInformacoesSection | undefined,
): CatalogProgramShift | null {
  const value = section?.content[0];
  if (value === "Integral") return "DAYTIME";
  if (value === "Noturno") return "NIGHT";
  return null;
}

function variantInformation(
  entries: Map<string, CatalogProgramVariantInformation>,
  entry: InformationVariantEntry,
  field: "integralization" | "professional" | "recognition",
): void {
  const key = entry.specializationCode ?? entry.specializationName ?? "PROGRAM";
  const current = entries.get(key) ?? {
    specializationCode: entry.specializationCode,
    specializationName: entry.specializationName,
    ...emptyIntegralization(),
    professionalDescription: null,
    recognitionDescription: null,
  };
  if (field === "integralization")
    Object.assign(current, parseIntegralization(entry.content));
  if (field === "professional")
    current.professionalDescription = entry.content || null;
  if (field === "recognition")
    current.recognitionDescription = entry.content || null;
  entries.set(key, current);
}

export function structureCursoInformacoes(
  page: CursoInformacoesPage,
): CatalogProgramInformation {
  const creditLimit = parseCreditLimit(
    page.sections.find(
      (section) =>
        section.headingKey === "limite-de-creditos-para-matricula-semestral",
    ),
  );
  const variants = new Map<string, CatalogProgramVariantInformation>();
  for (const sectionKey of informationVariantSectionKeys) {
    const field =
      sectionKey === "integralizacao"
        ? "integralization"
        : sectionKey === "o-profissional"
          ? "professional"
          : "recognition";
    for (const entry of informationVariantEntries(page, sectionKey))
      variantInformation(variants, entry, field);
  }
  return {
    sourceUrl: page.sourceUrl,
    shift: parseShift(
      page.sections.find((section) => section.headingKey === "turno"),
    ),
    ...creditLimit,
    professionalPracticeDescription:
      sectionContent(
        page.sections.find(
          (section) => section.headingKey === "exercicio-profissional",
        ),
      ) || null,
    variants: [...variants.values()],
  };
}

function normalizedSpecializationName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(?:habilitacao|modalidade|enfase)\s+/i, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function resolveInformationSpecializations(
  page: CursoInformacoesPage,
  year: number,
  information: CatalogProgramInformation,
  specializations: CurriculoEspecializacoesPage["specializations"],
): {
  information: CatalogProgramInformation;
  violations: CatalogoInformacoesValidationViolation[];
} {
  const byName = new Map<string, Array<{ code: string; name: string }>>();
  for (const specialization of specializations) {
    const key = normalizedSpecializationName(specialization.name);
    const values = byName.get(key) ?? [];
    values.push(specialization);
    byName.set(key, values);
  }
  const violations: CatalogoInformacoesValidationViolation[] = [];
  const variants: CatalogProgramVariantInformation[] = [];
  for (const variant of information.variants) {
    if (variant.specializationCode || !variant.specializationName) {
      variants.push(variant);
      continue;
    }
    const matches =
      byName.get(normalizedSpecializationName(variant.specializationName)) ??
      [];
    if (matches.length !== 1) {
      violations.push(
        validationViolation(
          page,
          year,
          "specialization-resolution",
          matches.length === 0
            ? "Especialização não encontrada no currículo pleno"
            : "Especialização possui correspondência ambígua no currículo pleno",
          null,
          variant.specializationName,
        ),
      );
      continue;
    }
    variants.push({
      ...variant,
      specializationCode: matches[0].code,
      specializationName: matches[0].name,
    });
  }
  return { information: { ...information, variants }, violations };
}

function validationViolation(
  page: CursoInformacoesPage,
  year: number,
  rule: string,
  message: string,
  specializationCode: string | null = null,
  actual?: string | number | null,
): CatalogoInformacoesValidationViolation {
  return {
    year,
    programCode: page.programCode,
    programName: page.programName,
    specializationCode,
    rule,
    message,
    actual,
  };
}

function variantTargetKeys(entries: InformationVariantEntry[]): string[] {
  return [
    ...new Set(
      entries.map(
        (entry) =>
          entry.specializationCode ?? entry.specializationName ?? "PROGRAM",
      ),
    ),
  ].sort();
}

function compatibleVariantTargets(left: string[], right: string[]): boolean {
  const leftSpecializations = left.filter((value) => value !== "PROGRAM");
  const rightSpecializations = right.filter((value) => value !== "PROGRAM");
  if (leftSpecializations.length === 0 || rightSpecializations.length === 0)
    return true;
  const leftSet = new Set(leftSpecializations);
  const rightSet = new Set(rightSpecializations);
  return (
    leftSpecializations.every((value) => rightSet.has(value)) ||
    rightSpecializations.every((value) => leftSet.has(value))
  );
}

function recognizedText(text: string): boolean {
  return /^Reconhecido (?:pelo|pela) (?:Decreto Federal|Portaria CEE\/GP|Portaria MEC|Portaria Ministerial).*?\d{2}\/\d{2}\/\d{2,4}.*(?:\.)?$/i.test(
    text,
  );
}

export function validateCursoInformacoes(
  page: CursoInformacoesPage,
  year: number,
): CatalogoInformacoesValidationViolation[] {
  const violations: CatalogoInformacoesValidationViolation[] = [];
  const topLevel = page.sections.filter((section) => section.level === 2);
  for (const section of topLevel) {
    if (!informationTopLevelSectionKeys.has(section.headingKey))
      violations.push(
        validationViolation(
          page,
          year,
          "known-top-level-sections",
          "Seção de nível superior não prevista no contrato",
          null,
          section.heading,
        ),
      );
  }
  const shift = page.sections.find((section) => section.headingKey === "turno");
  if (!parseShift(shift))
    violations.push(
      validationViolation(
        page,
        year,
        "shift-values",
        "Turno ausente ou fora dos valores previstos",
        null,
        shift?.content[0] ?? null,
      ),
    );
  const creditLimit = page.sections.find(
    (section) =>
      section.headingKey === "limite-de-creditos-para-matricula-semestral",
  );
  if (!creditLimit || !parseCreditLimit(creditLimit).creditLimitType)
    violations.push(
      validationViolation(
        page,
        year,
        "credit-limit-shape",
        "Limite de créditos fora dos formatos previstos",
      ),
    );
  const targetSets = informationVariantSectionKeys.map((key) =>
    variantTargetKeys(informationVariantEntries(page, key)),
  );
  if (targetSets.some((targets) => targets.length === 0))
    violations.push(
      validationViolation(
        page,
        year,
        "variant-section-presence",
        "Uma das seções dependentes de variante não possui conteúdo",
      ),
    );
  if (
    targetSets.some((targets, index) =>
      targetSets
        .slice(index + 1)
        .some((other) => !compatibleVariantTargets(targets, other)),
    )
  )
    violations.push(
      validationViolation(
        page,
        year,
        "variant-section-alignment",
        "Integralização, O Profissional e Reconhecimento possuem variantes diferentes",
      ),
    );
  for (const sectionKey of informationVariantSectionKeys) {
    for (const entry of informationVariantEntries(page, sectionKey)) {
      if (!entry.content) continue;
      if (
        sectionKey === "integralizacao" &&
        parseIntegralization(entry.content).integralizationCredits === null &&
        !/Não haverá integralização/i.test(entry.content)
      )
        violations.push(
          validationViolation(
            page,
            year,
            "integralization-format",
            "Texto de integralização fora do formato previsto",
            entry.specializationCode,
          ),
        );
      if (
        sectionKey === "reconhecimento" &&
        !recognizedText(entry.content) &&
        entry.content !== "Processo de Reconhecimento em Tramitação."
      )
        violations.push(
          validationViolation(
            page,
            year,
            "recognition-format",
            "Texto de reconhecimento fora dos formatos previstos",
            entry.specializationCode,
          ),
        );
    }
  }
  const integralizationEntries = informationVariantEntries(
    page,
    "integralizacao",
  );
  for (const entry of integralizationEntries) {
    const parsed = parseIntegralization(entry.content);
    if (
      parsed.integralizationSemesters !== null &&
      parsed.integralizationSemesters <= 0
    )
      violations.push(
        validationViolation(
          page,
          year,
          "integralization-positive-semesters",
          "Prazo regular de integralização não é positivo",
          entry.specializationCode,
          parsed.integralizationSemesters,
        ),
      );
    if (
      parsed.integralizationMaximumSemesters !== null &&
      parsed.integralizationMaximumSemesters <= 0
    )
      violations.push(
        validationViolation(
          page,
          year,
          "integralization-positive-maximum",
          "Prazo máximo de integralização não é positivo",
          entry.specializationCode,
          parsed.integralizationMaximumSemesters,
        ),
      );
  }
  return violations;
}

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

export async function crawlCatalogosProgramas(
  input: CatalogosProgramasInput,
  context: ScrapingContext,
): Promise<ScrapeResult<CatalogosProgramas>> {
  if (input.firstYear > input.lastYear)
    throw new Error("firstYear não pode ser maior que lastYear");
  const years = Array.from(
    { length: input.lastYear - input.firstYear + 1 },
    (_, offset) => input.firstYear + offset,
  );
  const catalogs = await context.map(years, (year) =>
    context.tryLoad(catalogoProgramasHistoricos, { year }),
  );
  return {
    data: {
      firstYear: input.firstYear,
      lastYear: input.lastYear,
      catalogs: catalogs.flatMap((catalog) => (catalog ? [catalog.data] : [])),
    },
    issues: context.issues,
    pages: context.pages,
  };
}

async function selectedCatalogs(
  input: { firstYear: number; lastYear: number },
  _context: ScrapingContext,
): Promise<number[]> {
  if (input.firstYear > input.lastYear)
    throw new Error("firstYear não pode ser maior que lastYear");
  return Array.from(
    { length: input.lastYear - input.firstYear + 1 },
    (_, offset) => input.firstYear + offset,
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

export type CatalogoInformacoesProgram = {
  code: number;
  name: string;
  sourceUrl: string;
  sections: CursoInformacoesSection[];
  information: CatalogProgramInformation | null;
};
export type CatalogoInformacoes = {
  catalogs: Array<{
    year: number;
    sourceUrl: string;
    programs: CatalogoInformacoesProgram[];
  }>;
  validation: CatalogoInformacoesValidation;
};

type CollectedCatalogoInformacoes = {
  year: number;
  sourceUrl: string;
  programs: CatalogoInformacoesProgram[];
  violations: CatalogoInformacoesValidationViolation[];
};

const validationRules = [
  "known-top-level-sections",
  "shift-values",
  "credit-limit-shape",
  "variant-section-presence",
  "variant-section-alignment",
  "integralization-format",
  "recognition-format",
  "specialization-resolution",
  "integralization-positive-semesters",
  "integralization-positive-maximum",
] as const;

function buildCatalogoInformacoesValidation(
  catalogs: CollectedCatalogoInformacoes[],
): CatalogoInformacoesValidation {
  const violations = catalogs.flatMap((catalog) => catalog.violations);
  const byYear = catalogs.map((catalog) => {
    const variants = catalog.programs.flatMap(
      (program) => program.information?.variants ?? [],
    );
    return {
      year: catalog.year,
      programs: catalog.programs.length,
      variants: variants.length,
      programVariants: variants.filter(
        (variant) => variant.specializationCode === null,
      ).length,
      specializationVariants: variants.filter(
        (variant) => variant.specializationCode !== null,
      ).length,
      violations: catalog.violations.length,
    };
  });
  return {
    checkedPrograms: catalogs.reduce(
      (total, catalog) => total + catalog.programs.length,
      0,
    ),
    checkedVariants: byYear.reduce((total, year) => total + year.variants, 0),
    byYear,
    checks: validationRules.map((rule) => ({
      rule,
      passed: !violations.some((violation) => violation.rule === rule),
      violations: violations.filter((violation) => violation.rule === rule)
        .length,
    })),
    violations,
  };
}

export async function crawlCatalogoInformacoes(
  input: { firstYear: number; lastYear: number },
  context: ScrapingContext,
): Promise<ScrapeResult<CatalogoInformacoes>> {
  const years = await selectedCatalogs(input, context);
  const collectedCatalogs = await context.map(years, async (year) => {
    const catalog = await context.tryLoad(catalogoProgramasHistoricos, {
      year,
    });
    if (!catalog) return undefined;
    const programs = await context.map(
      catalog.data.programs,
      async (program) => {
        const page = await context.tryLoad(cursoInformacoes, {
          programCode: program.code,
          name: program.name,
          url: program.sourceUrl,
        });
        if (!page)
          return {
            program: {
              code: program.code,
              name: program.name,
              sourceUrl: program.sourceUrl,
              sections: [],
              information: null,
            },
            violations: [
              {
                year,
                programCode: program.code,
                programName: program.name,
                specializationCode: null,
                rule: "page-loaded",
                message: "Página de informações não carregada",
              },
            ],
          };
        const parsedInformation = structureCursoInformacoes(page.data);
        const needsSpecializationResolution = parsedInformation.variants.some(
          (variant) =>
            variant.specializationCode === null &&
            variant.specializationName !== null,
        );
        const curriculum =
          needsSpecializationResolution && page.data.curriculumUrl
            ? await context.tryLoad(curriculoEspecializacoes, {
                programCode: program.code,
                name: program.name,
                url: page.data.curriculumUrl,
              })
            : undefined;
        const resolved = resolveInformationSpecializations(
          page.data,
          year,
          parsedInformation,
          curriculum?.data.specializations ?? [],
        );
        return {
          program: {
            code: program.code,
            name: program.name,
            sourceUrl: page.data.sourceUrl,
            sections: page.data.sections,
            information: resolved.information,
          },
          violations: [
            ...validateCursoInformacoes(page.data, year),
            ...resolved.violations,
          ],
        };
      },
    );
    return {
      year,
      sourceUrl: catalog.data.sourceUrl,
      programs: programs.map(({ program }) => program),
      violations: programs.flatMap(({ violations }) => violations),
    };
  });
  const collected = collectedCatalogs.flatMap((catalog) =>
    catalog ? [catalog] : [],
  );
  return {
    data: {
      catalogs: collected.map(({ violations: _, ...catalog }) => catalog),
      validation: buildCatalogoInformacoesValidation(collected),
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
