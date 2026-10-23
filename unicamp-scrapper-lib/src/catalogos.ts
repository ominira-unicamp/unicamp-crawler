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
  `https://www.dac.unicamp.br/sistemas/catalogos/grad/${catalogDirectory(year)}/disciplinas/index.html`;
const catalogCoordinatorsUrl = (year: number) =>
  `https://www.dac.unicamp.br/sistemas/catalogos/grad/${catalogDirectory(year)}/coordenadorias.html`;
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
export type CatalogCourseOfferingPeriod =
  "ODD_PERIODS" | "EVEN_PERIODS" | "ALL_PERIODS" | "UNIT_DISCRETION";
export type CatalogCourseEvaluationMode =
  "GRADE_AND_ATTENDANCE" | "ATTENDANCE" | "CONCEPT";
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
export type CatalogoProgramaHistoricoDetalhesPage = {
  curriculum: CursoPaginaInput | null;
  suggestion: CursoPaginaInput | null;
  information: CursoInformacoesPage;
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
  offeringPeriod: CatalogCourseOfferingPeriod | null;
  evaluation: CatalogCourseEvaluationMode | null;
  finalExam: boolean | null;
  minimumAttendancePercent: number | null;
  prerequisites: Prerequisite;
  syllabus: string | null;
  bibliography: string | null;
  sourceUrl: string;
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
export type PrerequisiteItem =
  | {
      type: "course";
      code: string;
      fulfillment: "FULL" | "PARTIAL";
    }
  | {
      type: "authorization";
    }
  | {
      type: "progression-coefficient";
      minimum: number;
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
    sourceFormat: CatalogProgramLayout;
    sourceUrl: string;
    courses: DisciplinaCatalogo[];
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

function legacyProgramLink(
  $: ReturnType<typeof loadHtml>,
  sourceUrl: string,
  expression: RegExp,
): string | null {
  const href = $("a[href]")
    .toArray()
    .find((anchor) => expression.test(normalizedText($(anchor))))
    ?.attribs?.href;
  return href ? absoluteUrl(href, sourceUrl) : null;
}

export function parseCatalogoProgramaHistoricoDetalhes(
  html: string,
  input: CursoPaginaInput,
  reporter?: ScrapeReporter,
): CatalogoProgramaHistoricoDetalhesPage {
  const $ = loadHtml(html);
  const curriculumUrl = legacyProgramLink(
    $,
    input.url,
    /curr[ií]culo\s+pleno/i,
  );
  const suggestionUrl = legacyProgramLink(
    $,
    input.url,
    /(?:sugest[oõ]es?\s+de\s+curr[ií]culo|proposta\s+para\s+cumprimento\s+de\s+curr[ií]culo)/i,
  );
  if (!curriculumUrl)
    reporter?.issue({
      code: "missing-required-section",
      path: "curriculum",
      message: "Currículo pleno não encontrado na página histórica",
    });
  if (!suggestionUrl)
    reporter?.issue({
      code: "missing-required-section",
      path: "suggestion",
      message: "Sugestões de currículo não encontradas na página histórica",
    });
  return {
    curriculum: curriculumUrl ? { ...input, url: curriculumUrl } : null,
    suggestion: suggestionUrl ? { ...input, url: suggestionUrl } : null,
    information: parseCursoInformacoes(html, input),
  };
}

export const catalogoProgramaHistoricoDetalhes: PageAdapter<
  CursoPaginaInput,
  CatalogoProgramaHistoricoDetalhesPage
> = {
  id: "catalogo-programa-historico-detalhes",
  fetch: fetchCursoInformacoes,
  parse: parseCatalogoProgramaHistoricoDetalhes,
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
      offeringPeriod: normalizeOfferingPeriod(
        section("Período de Oferecimento"),
        reporter,
        code,
      ),
      evaluation: normalizeEvaluation(section("Avaliação"), reporter, code),
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
      sourceUrl: input.url,
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

function normalizeSourceText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeOfferingPeriod(
  value: string | null,
  reporter?: ScrapeReporter,
  code?: string,
): CatalogCourseOfferingPeriod | null {
  if (!value) return null;
  const normalized = normalizeSourceText(value);
  const period = /^(?:(?:s|b)-?1|1[ºo]? periodo)/.test(normalized)
    ? "ODD_PERIODS"
    : /^(?:(?:s|b)-?2|2[ºo]? periodo)/.test(normalized)
      ? "EVEN_PERIODS"
      : /^(?:(?:s|a|b)-?5|todos os periodos)/.test(normalized)
        ? "ALL_PERIODS"
        : /^(?:(?:s|b)-?6|a criterio da unidade)/.test(normalized)
          ? "UNIT_DISCRETION"
          : null;
  if (period) return period;
  reporter?.issue({
    code: "invalid-value",
    path: code ? `disciplines.${code}.offeringPeriod` : "offeringPeriod",
    message: "Período de oferecimento em formato inesperado",
    actual: value,
  });
  return null;
}

function normalizeEvaluation(
  value: string | null,
  reporter?: ScrapeReporter,
  code?: string,
): CatalogCourseEvaluationMode | null {
  if (!value) return null;
  const normalized = normalizeSourceText(value);
  const evaluation = /^(?:n|nota e frequencia)$/.test(normalized)
    ? "GRADE_AND_ATTENDANCE"
    : /^(?:f|frequencia)$/.test(normalized)
      ? "ATTENDANCE"
      : /^(?:c|conceito)$/.test(normalized)
        ? "CONCEPT"
        : null;
  if (evaluation) return evaluation;
  reporter?.issue({
    code: "invalid-value",
    path: code ? `disciplines.${code}.evaluation` : "evaluation",
    message: "Modo de avaliação em formato inesperado",
    actual: value,
  });
  return null;
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
  if (!text || /n[aã]o h[aá](?: pré-requisitos)?\.?$/i.test(text.trim()))
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
          if (code === "AA200") return { type: "authorization" };
          const progression = /^AA4(\d{2})$/.exec(code);
          if (progression)
            return {
              type: "progression-coefficient",
              minimum: Number(progression[1]),
            };
          return {
            type: "course",
            code,
            fulfillment: partial ? "PARTIAL" : "FULL",
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

type LegacyDisciplineReference = {
  url: string;
  codes: string[];
  names: Record<string, string>;
  credits: Record<string, number>;
  coordinator: string | null;
  fallbackSourceUrl: string;
};
type LegacyEmentasReferencesPage = {
  references: LegacyDisciplineReference[];
};
type CatalogoCoordenadoriasPage = {
  coordinators: Array<{ url: string; coordinator: string }>;
};
type LegacyDisciplinasPage = { courses: DisciplinaCatalogo[] };
type LegacySuggestionCreditsPage = {
  courses: Array<{ code: string; credits: number }>;
};

function legacyReferenceCode(value: string) {
  const code = canonicalCode(value.replace(/^#/, ""));
  return /^[A-Z]{1,3}\d{3,4}$|^F \d{3,4}$/.test(code) ? code : null;
}

function mergeLegacyReferences(
  references: LegacyDisciplineReference[],
): LegacyDisciplineReference[] {
  const merged = new Map<string, LegacyDisciplineReference>();
  for (const reference of references) {
    const key = `${reference.url}\u0000${reference.coordinator ?? ""}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...reference,
        codes: [...new Set(reference.codes)],
        names: { ...reference.names },
        credits: { ...reference.credits },
      });
      continue;
    }
    existing.codes = [...new Set([...existing.codes, ...reference.codes])];
    existing.names = { ...reference.names, ...existing.names };
    existing.credits = { ...reference.credits, ...existing.credits };
  }
  return [...merged.values()].sort((left, right) =>
    left.url.localeCompare(right.url),
  );
}

function parseLegacyEmentasReferences(
  html: string,
  sourceUrl: string,
): LegacyEmentasReferencesPage {
  const $ = loadHtml(html);
  const references = $("a[href]")
    .toArray()
    .flatMap((anchor): LegacyDisciplineReference[] => {
      const href = $(anchor).attr("href");
      if (!href || !/\/ementas\/todas[^#]+\.html#/i.test(href)) return [];
      const target = new URL(absoluteUrl(href, sourceUrl));
      const code =
        legacyReferenceCode(decodeURIComponent(target.hash)) ??
        legacyReferenceCode(normalizedText($(anchor)));
      const anchorText = normalizedText($(anchor));
      const parentText = normalizedText($(anchor).parent());
      const name = parentText
        .slice(parentText.indexOf(anchorText) + anchorText.length)
        .replace(/^\s*[-–:]?\s*/, "")
        .trim();
      const choiceCredits = /(?:^|\s)(\d+)\s+cr[eé]ditos\s+dentre/i.exec(
        normalizedText(
          $(anchor).closest("table").parent().prevAll().slice(0, 4),
        ),
      )?.[1];
      target.hash = "";
      return [
        {
          url: target.toString(),
          codes: code ? [code] : [],
          names: code && name ? { [code]: name } : {},
          credits:
            code && choiceCredits ? { [code]: Number(choiceCredits) } : {},
          coordinator: null,
          fallbackSourceUrl: sourceUrl,
        },
      ];
    });
  return {
    references: mergeLegacyReferences(references),
  };
}

const catalogoDisciplinasClassico: PageAdapter<
  { url: string },
  LegacyEmentasReferencesPage
> = {
  id: "catalogo-disciplinas-classico",
  fetch: (input, context) => context.fetcher.fetch(input.url),
  parse: (html, input) => parseLegacyEmentasReferences(html, input.url),
};

const catalogoDisciplinasCreditosClassicos: PageAdapter<
  CursoPaginaInput,
  LegacySuggestionCreditsPage
> = {
  id: "catalogo-disciplinas-creditos-classicos",
  fetch: (input, context) => context.fetcher.fetch(input.url),
  parse: (html) => {
    const $ = loadHtml(html);
    return {
      courses: $("a[href]")
        .toArray()
        .flatMap((anchor) => {
          const code = legacyReferenceCode(normalizedText($(anchor)));
          const credits = /\(\s*(\d+)\s*\)/.exec(
            normalizedText($(anchor).parent()),
          )?.[1];
          return code && credits ? [{ code, credits: Number(credits) }] : [];
        }),
    };
  },
};

function parseCatalogoCoordenadorias(
  html: string,
  sourceUrl: string,
): CatalogoCoordenadoriasPage {
  const $ = loadHtml(html);
  return {
    coordinators: $("a[href]")
      .toArray()
      .flatMap((anchor) => {
        const href = $(anchor).attr("href");
        const coordinator = normalizedText($(anchor));
        return href && coordinator && /^coordenadorias\/\d+\.html$/i.test(href)
          ? [{ url: absoluteUrl(href, sourceUrl), coordinator }]
          : [];
      }),
  };
}

const catalogoCoordenadorias: PageAdapter<
  { year: number; url?: string },
  CatalogoCoordenadoriasPage
> = {
  id: "catalogo-coordenadorias",
  fetch: (input, context) =>
    context.fetcher.fetch(input.url ?? catalogCoordinatorsUrl(input.year)),
  parse: (html, input) =>
    parseCatalogoCoordenadorias(
      html,
      input.url ?? catalogCoordinatorsUrl(input.year),
    ),
};

function parseCatalogoCoordenadoriaDisciplinas(
  html: string,
  sourceUrl: string,
  coordinator: string,
): LegacyEmentasReferencesPage {
  const $ = loadHtml(html);
  const references = $("a[href]")
    .toArray()
    .flatMap((anchor): LegacyDisciplineReference[] => {
      const href = $(anchor).attr("href");
      if (!href || !/\/coordenadorias\/\d+\/\d+\.html#/i.test(href))
        return [];
      const target = new URL(absoluteUrl(href, sourceUrl));
      const code =
        legacyReferenceCode(decodeURIComponent(target.hash)) ??
        legacyReferenceCode(normalizedText($(anchor)));
      const name = normalizedText($(anchor))
        .replace(/^[A-Z]{1,3}\s*[A-Z]?\s*\d{3,4}\s*[-–:]?\s*/i, "")
        .trim();
      target.hash = "";
      return [
        {
          url: target.toString(),
          codes: code ? [code] : [],
          names: code && name ? { [code]: name } : {},
          credits: {},
          coordinator,
          fallbackSourceUrl: sourceUrl,
        },
      ];
    });
  return { references: mergeLegacyReferences(references) };
}

const catalogoCoordenadoriaDisciplinas: PageAdapter<
  { url: string; coordinator: string },
  LegacyEmentasReferencesPage
> = {
  id: "catalogo-coordenadoria-disciplinas",
  fetch: (input, context) => context.fetcher.fetch(input.url),
  parse: (html, input) =>
    parseCatalogoCoordenadoriaDisciplinas(
      html,
      input.url,
      input.coordinator,
    ),
};

function legacyMetric(
  vector: string,
  key: string,
  reporter: ScrapeReporter | undefined,
  code: string,
  required = true,
): number | null {
  const value = new RegExp(`(?:^|\\s)${key}:(\\d+)`, "i").exec(vector)?.[1];
  if (value !== undefined) return Number(value);
  if (required)
    reporter?.issue({
      code: "invalid-format",
      path: `disciplines.${code}.workload`,
      message: `Métrica ${key} ausente no vetor histórico`,
      actual: vector,
    });
  return null;
}

function legacyDisciplineFragment(
  $: ReturnType<typeof loadHtml>,
  anchor: AnyNode,
) {
  const boundary = $(anchor).closest(".ancora, div[align='right']").first();
  const start = boundary[0] ?? anchor;
  const fragments: string[] = [];
  let current = start.nextSibling;
  while (current) {
    const element = $(current);
    if (element.is("a[name]") || element.find("a[name]").length > 0) break;
    fragments.push($.html(current) ?? "");
    current = current.nextSibling;
  }
  return loadHtml(`<div>${fragments.join("")}</div>`);
}

function legacyLabeledValue(
  text: string,
  label: "prerequisite" | "syllabus",
) {
  const expression =
    label === "prerequisite"
      ? /Pr[eé]-?Req\.?\s*:\s*(.*?)(?=\s+Ementa\s*:|\s+Obs\.?\s*:|\s+Voltar\b|$)/i
      : /Ementa\s*:\s*(.*?)(?=\s+Obs\.?\s*:|\s+Voltar\b|$)/i;
  return expression.exec(text)?.[1]?.trim() ?? "";
}

function parseLegacyDisciplinePage(
  html: string,
  input: {
    url: string;
    sourceFormat: "LEGACY_CLASSIC" | "LEGACY_INTERMEDIATE";
    coordinator: string | null;
  },
  reporter?: ScrapeReporter,
): LegacyDisciplinasPage {
  const $ = loadHtml(html);
  const courses: DisciplinaCatalogo[] = [];
  $("a[name]").each((_, anchor) => {
    const heading = normalizedText($(anchor));
    const match =
      /^([A-Z]{1,3}(?:\s*[A-Z])?\s*\d{3,4}|F\s*\d{3,4})\s*(?:-\s*)?(.+)$/i.exec(
        heading,
      );
    if (!match) return;
    const code = canonicalCode(match[1]);
    if (!/^[A-Z]{1,3}\d{3,4}$|^F \d{3,4}$/.test(code)) return;
    const fragment = legacyDisciplineFragment($, anchor);
    const text = normalizedText(fragment.root());
    const vector =
      /\bOF:\s*[^\s]+(?:\s+[A-Z]{1,2}:\s*[^\s]+)+/i.exec(text)?.[0] ??
      "";
    if (!vector)
      reporter?.issue({
        code: "missing-required-section",
        path: `disciplines.${code}.workload`,
        message: "Vetor de carga horária histórico ausente",
      });
    const prerequisite = legacyLabeledValue(text, "prerequisite");
    const syllabus = legacyLabeledValue(text, "syllabus");
    const classic = input.sourceFormat === "LEGACY_CLASSIC";
    const annual = /\bOF:\s*A-/i.test(vector);
    const weeks = annual ? null : 15;
    const weekly = legacyMetric(vector, "HS", reporter, code);
    const classroomWeekly = legacyMetric(vector, "SL", reporter, code);
    const total = (value: number | null) =>
      value === null || weeks === null ? null : value * weeks;
    courses.push({
      code,
      name: match[2].trim(),
      coordinator: input.coordinator,
      workload: {
        theoreticalHours: total(legacyMetric(vector, "T", reporter, code)),
        practicalHours: total(legacyMetric(vector, "P", reporter, code)),
        laboratoryHours: total(legacyMetric(vector, "L", reporter, code)),
        guidedActivityHours: total(
          legacyMetric(vector, "O", reporter, code, !classic),
        ),
        distanceHours: total(
          legacyMetric(vector, "D", reporter, code, !classic),
        ),
        guidedExtensionHours: null,
        practicalExtensionHours: null,
        weeks,
        weeklyClassHours: weekly,
        classroomHours: total(classroomWeekly),
      },
      credits: legacyMetric(vector, "C", reporter, code),
      offeringPeriod: normalizeOfferingPeriod(
        /OF:([^\s]+)/i.exec(vector)?.[1] ?? null,
        reporter,
        code,
      ),
      evaluation: normalizeEvaluation(
        /AV:([^\s]+)/i.exec(vector)?.[1] ?? null,
        reporter,
        code,
      ),
      finalExam: (() => {
        const value = /EX:([^\s]+)/i.exec(vector)?.[1]?.toUpperCase();
        return value === "S" ? true : value === "N" ? false : null;
      })(),
      minimumAttendancePercent: percentage(
        /FM:\s*(\d+(?:[.,]\d+)?%)/i.exec(vector)?.[1] ?? null,
        reporter,
        code,
      ),
      prerequisites: parsePrerequisites(prerequisite || null, reporter, code),
      syllabus: syllabus || null,
      bibliography: null,
      sourceUrl: input.url,
    });
  });
  if (!courses.length)
    reporter?.issue({
      code: "unrecognized-content",
      path: "disciplines",
      message: "Nenhuma disciplina reconhecida na página histórica",
    });
  return { courses };
}

const catalogoDisciplinasLegado: PageAdapter<
  {
    url: string;
    sourceFormat: "LEGACY_CLASSIC" | "LEGACY_INTERMEDIATE";
    coordinator: string | null;
  },
  LegacyDisciplinasPage
> = {
  id: "catalogo-disciplinas-legado",
  fetch: (input, context) => context.fetcher.fetch(input.url),
  parse: (html, input, reporter) =>
    parseLegacyDisciplinePage(html, input, reporter),
};

function parseRequirements(table: ReturnType<typeof loadHtml>): Requisito[] {
  const requirements = new Map<string, Requisito>();
  const add = (requirement: Requisito | undefined) => {
    if (!requirement) return;
    requirements.set(
      `${requirement.type}:${requirement.code ?? ""}`,
      requirement,
    );
  };
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
    add(requirement);
  });
  table("td").each((_, cell) => {
    const value = normalizedText(table(cell));
    const prefix = /^([A-Z]{2})\s*---/.exec(value);
    add(
      /^-----/.test(value)
        ? { type: "any" }
        : prefix
          ? { type: "prefix", code: prefix[1] }
          : undefined,
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

function specializationTitle(
  value: string,
): { code: string; name: string } | null {
  const match = /^([A-Z]{2})\s*[-–]\s*(.+)$/i.exec(value);
  if (!match) return null;
  const name = match[2].replace(/\s*:\s*$/, "").trim();
  if (!/[\p{L}\p{N}]/u.test(name)) return null;
  return { code: match[1].toUpperCase(), name };
}

function parseModernCursoCurriculo(
  $: ReturnType<typeof loadHtml>,
): CurriculoPage {
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
      const specialization = specializationTitle(value);
      if (!specialization) {
        current = undefined;
        return;
      }
      current = specializations.get(specialization.code) ?? {
        ...specialization,
        blocks: [],
      };
      specializations.set(specialization.code, current);
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
      const match = /obter\s+(\d+)\s+cr[eé]ditos/i.exec(value);
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

function parseLegacyCursoCurriculo(
  $: ReturnType<typeof loadHtml>,
): CurriculoPage {
  const blocks: CurriculoPage["blocks"] = [];
  const specializations = new Map<
    string,
    { code: string; name: string; blocks: CurriculoPage["blocks"] }
  >();
  let current:
    | { code: string; name: string; blocks: CurriculoPage["blocks"] }
    | undefined;
  let kind: "mandatory" | "elective" | undefined;
  let electiveCredits: number | null = null;

  $("h3,p,strong,div.div100,table").each((_, element) => {
    if (
      element.tagName === "strong" &&
      $(element).parents("table").length > 0
    )
      return;
    const value = normalizedText($(element));
    if (element.tagName === "h3") {
      if (/opções por língua/i.test(value)) {
        kind = "mandatory";
        current = undefined;
      } else if (/disciplinas eletivas/i.test(value)) kind = "elective";
      else if (/núcleo comum|disciplinas obrigatórias/i.test(value)) {
        kind = "mandatory";
        current = undefined;
      }
      return;
    }
    if (element.tagName === "p" || element.tagName === "strong") {
      const emphasized = $(element).children("strong,b").first();
      const specialization = specializationTitle(
        emphasized.length ? normalizedText(emphasized) : value,
      );
      if (specialization) {
        current = specializations.get(specialization.code) ?? {
          ...specialization,
          blocks: [],
        };
        specializations.set(specialization.code, current);
        kind ??= "mandatory";
        return;
      }
      if (/disciplinas eletivas/i.test(value)) kind = "elective";
      else if (/^(?:núcleo comum|disciplinas obrigatórias)/i.test(value)) {
        kind = "mandatory";
        current = undefined;
      } else if (kind === "elective") {
        const match =
          /(?:obter\s+)?(\d+)\s+cr[eé]ditos\s+(?:eletivos|dentre)/i.exec(
            value,
          );
        if (match) electiveCredits = Number(match[1]);
      }
      return;
    }
    if ((element.tagName !== "table" && element.tagName !== "div") || !kind)
      return;
    if (
      element.tagName === "div" &&
      $(element).find("div.div100").length > 0
    )
      return;
    if (kind === "elective" && electiveCredits === null) {
      const parentHtml = $(element).parent().html() ?? "";
      const elementHtml = $(element).toString();
      const elementIndex = parentHtml.indexOf(elementHtml);
      const precedingText = normalizedText(
        loadHtml(
          elementIndex >= 0 ? parentHtml.slice(0, elementIndex) : "",
        ).root(),
      );
      const match =
        /(?:obter\s+)?(\d+)\s+cr[eé]ditos\s+(?:eletivos|dentre)/i.exec(
          precedingText,
        );
      if (match) electiveCredits = Number(match[1]);
    }
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

export function parseCursoCurriculo(
  html: string,
  input: CursoPaginaInput,
): CurriculoPage {
  const $ = loadHtml(html);
  const historicalUrl = /catalogo(?:\d{2}|20(?:0\d|1\d|20))\//i.test(
    input.url,
  );
  return historicalUrl || $("div.div100").length > 0
    ? parseLegacyCursoCurriculo($)
    : parseModernCursoCurriculo($);
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
    if ($(element).parents("table").length > 0) return;
    const title = specializationTitle(
      normalizedText($(element)).replace(
        /^(?:Habilitação|Modalidade)\s+/i,
        "",
      ),
    );
    if (title) specializations.set(title.code, title);
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

  const dashedMatches = [
    ...text.matchAll(
      /(?:^|\s)([A-ZÀ-Ú][^.:]{1,80}?)\s*[-–]\s*(?=(?:Poderá|Poder[aá]|Terá|Ter[aá]|Decreto|Portaria|Reconhecido|Não haverá))/gi,
    ),
  ];
  if (dashedMatches.length > 0)
    return dashedMatches.map((match, index) => ({
      code: null,
      name: match[1].trim(),
      content: text
        .slice(
          match.index! + match[0].length,
          dashedMatches[index + 1]?.index ?? text.length,
        )
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
        ...knownVariants,
        ...candidateNames,
        ...inferredNames,
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
    .replace(/\bbacharelado\b/i, "bacharel")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function specializationLookupKeys(
  value: string,
  programName: string,
): string[] {
  const normalized = normalizedSpecializationName(value);
  const keys = [normalized];
  if (normalized === "bacharel")
    keys.push(normalizedSpecializationName(`Bacharelado em ${programName}`));
  if (normalized === "licenciado")
    keys.push(normalizedSpecializationName(`Licenciatura em ${programName}`));
  return [...new Set(keys)];
}

function mergeVariantInformation(
  left: CatalogProgramVariantInformation | undefined,
  right: CatalogProgramVariantInformation,
): CatalogProgramVariantInformation {
  if (!left) return right;
  return {
    specializationCode: right.specializationCode ?? left.specializationCode,
    specializationName: right.specializationName ?? left.specializationName,
    integralizationCredits:
      right.integralizationCredits ?? left.integralizationCredits,
    integralizationSupervisedHours:
      right.integralizationSupervisedHours ??
      left.integralizationSupervisedHours,
    integralizationExtensionHours:
      right.integralizationExtensionHours ?? left.integralizationExtensionHours,
    integralizationSemesters:
      right.integralizationSemesters ?? left.integralizationSemesters,
    integralizationMaximumSemesters:
      right.integralizationMaximumSemesters ??
      left.integralizationMaximumSemesters,
    professionalDescription:
      right.professionalDescription ?? left.professionalDescription,
    recognitionDescription:
      right.recognitionDescription ?? left.recognitionDescription,
  };
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
  const variants = new Map<string, CatalogProgramVariantInformation>();
  for (const variant of information.variants) {
    if (variant.specializationCode || !variant.specializationName) {
      const key = variant.specializationCode
        ? `code:${variant.specializationCode}`
        : "program";
      variants.set(key, mergeVariantInformation(variants.get(key), variant));
      continue;
    }
    const matches = [
      ...new Map(
        specializationLookupKeys(variant.specializationName, page.programName)
          .flatMap((key) => byName.get(key) ?? [])
          .map((value) => [value.code, value]),
      ).values(),
    ];
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
    const resolved = {
      ...variant,
      specializationCode: matches[0].code,
      specializationName: matches[0].name,
    };
    const key = `code:${resolved.specializationCode}`;
    variants.set(key, mergeVariantInformation(variants.get(key), resolved));
  }
  return {
    information: { ...information, variants: [...variants.values()] },
    violations,
  };
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
  const equivalent = (first: string, second: string) => {
    const leftName = normalizedSpecializationName(first);
    const rightName = normalizedSpecializationName(second);
    return (
      leftName === rightName ||
      (leftName === "bacharel" && rightName.startsWith("bacharel ")) ||
      (rightName === "bacharel" && leftName.startsWith("bacharel ")) ||
      (leftName === "licenciado" && rightName.startsWith("licenciatura ")) ||
      (rightName === "licenciado" && leftName.startsWith("licenciatura "))
    );
  };
  return (
    leftSpecializations.every((value) =>
      rightSpecializations.some((other) => equivalent(value, other)),
    ) ||
    rightSpecializations.every((value) =>
      leftSpecializations.some((other) => equivalent(value, other)),
    )
  );
}

function recognizedText(text: string): boolean {
  return /^(?:Reconhecido (?:pelo|pela) |Decreto Federal|Portaria (?:CEE\/GP|MEC|Ministerial)).*?\d{2}\/\d{2}\/\d{2,4}.*(?:\.)?$/i.test(
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
  input: CursoPaginaInput,
): SugestaoPage {
  const $ = loadHtml(html);
  const suggestions: SugestaoPage["suggestions"] = [];
  const semesterTitle =
    /^(\d+)[º°o.]?\s+Semestre\s*(?:-|:)\s*(\d+)\s+cr[eé]ditos$/i;
  const courseTitle = /^([A-Z]{1,3}\s*[A-Z]?\s*\d{3,4}\*?)\s*\((\d+)\)$/i;
  const electiveCredits = /(\d+)\s+cr[eé]ditos\s+eletivos/i;

  const intermediateSuggestions = [
    ...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>([\s\S]*?)(?=<h1\b|$)/gi),
  ].flatMap((match) => {
    const title = normalizedText(loadHtml(match[1]).root());
    const suggestion = suggestionTitle.exec(title);
    if (!suggestion?.groups) return [];
    const semesters = [
      ...match[2].matchAll(
        /(\d+)[º°o.]?\s*Semestre\s*:\s*(\d+)\s+cr[eé]ditos([\s\S]*?)(?=(?:\d+)[º°o.]?\s*Semestre\s*:|$)/gi,
      ),
    ].map((semester) => {
      const fragment = loadHtml(semester[3]);
      const text = normalizedText(fragment.root());
      const elective = electiveCredits.exec(text);
      const courses = fragment("a")
        .toArray()
        .flatMap((anchor) => {
          const course = courseTitle.exec(normalizedText(fragment(anchor)));
          return course
            ? [{ code: canonicalCode(course[1]), credits: Number(course[2]) }]
            : [];
        });
      return {
        semester: Number(semester[1]),
        credits: Number(semester[2]),
        electiveCredits: elective ? Number(elective[1]) : 0,
        courses,
      };
    });
    return semesters.length
      ? [
          {
            code: canonicalCode(suggestion.groups.code),
            name: suggestion.groups.name.trim(),
            semesters,
          },
        ]
      : [];
  });
  if (intermediateSuggestions.length)
    return { suggestions: intermediateSuggestions };

  const semesterFromHeading = (element: AnyNode) => {
    const semester = semesterTitle.exec(normalizedText($(element)));
    if (!semester) return null;
    const content = $(element)
      .nextAll()
      .toArray()
      .find((next) => {
        const nextValue = normalizedText($(next));
        if (semesterTitle.test(nextValue) || suggestionTitle.test(nextValue))
          return false;
        return (
          next.tagName === "p" ||
          next.tagName === "table" ||
          $(next).find("table").length > 0
        );
      });
    if (!content) return null;
    const container = $(content).find("table").first().length
      ? $(content).find("table").first()
      : $(content);
    const courseElements = container.find("td").length
      ? container.find("td").toArray()
      : container.find("a").toArray();
    const courses = courseElements.flatMap((courseElement) => {
      const course = courseTitle.exec(normalizedText($(courseElement)));
      return course
        ? [{ code: canonicalCode(course[1]), credits: Number(course[2]) }]
        : [];
    });
    const text = normalizedText(container);
    const elective = electiveCredits.exec(text);
    const legacyElective = [
      ...text.matchAll(/ELET\.?\s*\(?\s*(\d+)\s*\)?/gi),
    ].reduce((total, match) => total + Number(match[1]), 0);
    return {
      semester: Number(semester[1]),
      credits: Number(semester[2]),
      electiveCredits: elective ? Number(elective[1]) : legacyElective,
      courses,
    };
  };

  $("h2,p").each((_, heading) => {
    const title = normalizedText($(heading));
    const suggestion = suggestionTitle.exec(title);
    if (!suggestion?.groups) return;
    const semesters: SugestaoPage["suggestions"][number]["semesters"] = [];
    $(heading)
      .nextAll()
      .each((__, element) => {
        const value = normalizedText($(element));
        if (suggestionTitle.test(value)) return false;
        if (element.tagName !== "h3" && element.tagName !== "p") return;
        const semester = semesterFromHeading(element);
        if (semester) semesters.push(semester);
      });
    if (semesters.length)
      suggestions.push({
        code: canonicalCode(suggestion.groups.code),
        name: suggestion.groups.name.trim(),
        semesters,
      });
  });
  if (suggestions.length === 0) {
    const semesters = $("h3,p")
      .toArray()
      .flatMap((element) => {
        const semester = semesterFromHeading(element);
        return semester ? [semester] : [];
      });
    if (semesters.length)
      suggestions.push({
        code: String(input.programCode),
        name: input.name,
        semesters,
      });
  }
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
    if (year <= 2011) return crawlCatalogoDisciplinasClassico(year, context);
    if (year <= 2020)
      return crawlCatalogoDisciplinasIntermediario(year, context);
    const index = await context.tryLoad(catalogoDisciplinasIndice, { year });
    if (!index) return undefined;
    const prefixes = await context.map(index.data.prefixes, async (prefix) =>
      context.tryLoad(catalogoDisciplinasPrefixo, prefix),
    );
    return {
      year,
      sourceFormat: "MODERN" as const,
      sourceUrl: disciplinesUrl(year),
      courses: uniqueCatalogCourses(
        prefixes.flatMap((page) => page?.data.courses ?? []),
        context,
        year,
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

function crawlerIssue(
  context: ScrapingContext,
  adapter: string,
  input: unknown,
  issue: Omit<
    ScrapeResult<unknown>["issues"][number],
    "adapter" | "input" | "timestamp"
  >,
) {
  context.issues.push({
    ...issue,
    adapter,
    input,
    timestamp: new Date().toISOString(),
  });
}

function comparableCatalogCourse(course: DisciplinaCatalogo) {
  const { sourceUrl: _, ...comparable } = course;
  return comparable;
}

function uniqueCatalogCourses(
  courses: DisciplinaCatalogo[],
  context: ScrapingContext,
  year: number,
): DisciplinaCatalogo[] {
  const unique = new Map<string, DisciplinaCatalogo>();
  for (const course of [...courses].sort((left, right) =>
    left.sourceUrl.localeCompare(right.sourceUrl),
  )) {
    const existing = unique.get(course.code);
    if (!existing) {
      unique.set(course.code, course);
      continue;
    }
    if (
      JSON.stringify(comparableCatalogCourse(existing)) !==
      JSON.stringify(comparableCatalogCourse(course))
    )
      crawlerIssue(
        context,
        "catalogo-disciplinas-cobertura",
        { year, code: course.code },
        {
          code: "invalid-value",
          path: `disciplines.${course.code}`,
          message: "Mesmo código possui dados divergentes no catálogo",
          expected: JSON.stringify(comparableCatalogCourse(existing)),
          actual: comparableCatalogCourse(course),
        },
      );
  }
  return [...unique.values()].sort((left, right) =>
    left.code.localeCompare(right.code),
  );
}

function validateLegacyCoverage(
  year: number,
  references: LegacyDisciplineReference[],
  courses: DisciplinaCatalogo[],
  context: ScrapingContext,
) {
  const parsedCodes = new Set(courses.map(({ code }) => code));
  const expectedCodes = new Set(references.flatMap(({ codes }) => codes));
  if (expectedCodes.size === 0)
    crawlerIssue(
      context,
      "catalogo-disciplinas-cobertura",
      { year },
      {
        code: "missing-required-section",
        path: "disciplines.references",
        message: "Nenhuma referência de disciplina encontrada no catálogo",
      },
    );
  if (courses.length === 0)
    crawlerIssue(
      context,
      "catalogo-disciplinas-cobertura",
      { year },
      {
        code: "unrecognized-content",
        path: "disciplines",
        message: "Nenhuma disciplina coletada no catálogo",
      },
    );
  for (const code of expectedCodes)
    if (!parsedCodes.has(code))
      crawlerIssue(
        context,
        "catalogo-disciplinas-cobertura",
        { year, code },
        {
          code: "missing-required-section",
          path: `disciplines.${code}`,
          message: "Disciplina referenciada não foi coletada",
        },
      );
  for (const reference of references) {
    if (!reference.codes.every((code) => parsedCodes.has(code))) continue;
    for (const issue of context.issues)
      if (
        issue.adapter === "catalogo-disciplinas-legado" &&
        (issue.input as { url?: unknown })?.url === reference.url &&
        (issue.code === "load-error" || issue.code === "unrecognized-content")
      )
        issue.blocksCompleteness = false;
  }
}

function legacyFallbackCourses(
  references: LegacyDisciplineReference[],
  collected: DisciplinaCatalogo[],
  creditsByCode: Map<string, number>,
) {
  const collectedCodes = new Set(collected.map(({ code }) => code));
  return references.flatMap((reference) =>
    reference.codes.flatMap((code): DisciplinaCatalogo[] => {
      if (collectedCodes.has(code)) return [];
      const name = reference.names[code];
      const credits = creditsByCode.get(code) ?? reference.credits[code];
      if (!name || credits === undefined) return [];
      collectedCodes.add(code);
      return [
        {
          code,
          name,
          coordinator: reference.coordinator,
          workload: {
            theoreticalHours: null,
            practicalHours: null,
            laboratoryHours: null,
            guidedActivityHours: null,
            distanceHours: null,
            guidedExtensionHours: null,
            practicalExtensionHours: null,
            weeks: null,
            weeklyClassHours: null,
            classroomHours: null,
          },
          credits,
          offeringPeriod: null,
          evaluation: null,
          finalExam: null,
          minimumAttendancePercent: null,
          prerequisites: { raw: null, any: [] },
          syllabus: null,
          bibliography: null,
          sourceUrl: reference.fallbackSourceUrl,
        },
      ];
    }),
  );
}

async function crawlCatalogoDisciplinasClassico(
  year: number,
  context: ScrapingContext,
) {
  const programs = await context.tryLoad(catalogoProgramasHistoricos, { year });
  if (!programs) return undefined;
  const details = await context.map(programs.data.programs, async (program) =>
    context.tryLoad(catalogoProgramaHistoricoDetalhes, {
      programCode: program.code,
      name: program.name,
      url: program.sourceUrl,
    }),
  );
  for (const detail of details) {
    if (!detail) continue;
    const inputUrl = (detail.metadata.input as { url: string }).url;
    const hasNoIntegralization = normalizeSourceText(
      JSON.stringify(detail.data.information.sections),
    ).includes("nao havera integralizacao");
    for (const issue of context.issues)
      if (
        issue.adapter === "catalogo-programa-historico-detalhes" &&
        (issue.input as { url?: unknown })?.url === inputUrl &&
        (issue.path === "suggestion" ||
          (issue.path === "curriculum" && hasNoIntegralization))
      )
        issue.blocksCompleteness = false;
  }
  const referenceSources = details.flatMap((detail) => [
    ...(detail?.data.curriculum
      ? [{ ...detail.data.curriculum, kind: "curriculum" as const }]
      : []),
    ...(detail?.data.suggestion
      ? [{ ...detail.data.suggestion, kind: "suggestion" as const }]
      : []),
  ]);
  const references = await context.map(referenceSources, async (source) => ({
    source,
    page: await context.tryLoad(catalogoDisciplinasClassico, {
      url: source.url,
    }),
  }));
  const loadedSuggestionUrls = new Set(
    references.flatMap(({ source, page }) =>
      source.kind === "suggestion" && page ? [source.url] : [],
    ),
  );
  for (const detail of details) {
    const curriculumUrl = detail?.data.curriculum?.url;
    const suggestionUrl = detail?.data.suggestion?.url;
    if (!curriculumUrl || !suggestionUrl || !loadedSuggestionUrls.has(suggestionUrl))
      continue;
    for (const issue of context.issues)
      if (
        issue.adapter === "catalogo-disciplinas-classico" &&
        (issue.input as { url?: unknown })?.url === curriculumUrl &&
        issue.code === "load-error"
      )
        issue.blocksCompleteness = false;
  }
  const disciplineReferences = mergeLegacyReferences(
    references.flatMap(
      ({ page }) => page?.data.references ?? [],
    ),
  );
  const pages = await context.map(disciplineReferences, async (reference) =>
    context.tryLoad(catalogoDisciplinasLegado, {
      url: reference.url,
      sourceFormat: "LEGACY_CLASSIC",
      coordinator: null,
    }),
  );
  const collected = pages.flatMap((page) => page?.data.courses ?? []);
  const collectedCodes = new Set(collected.map(({ code }) => code));
  const needsFallback = disciplineReferences.some((reference) =>
    reference.codes.some((code) => !collectedCodes.has(code)),
  );
  const suggestionInputs = needsFallback
    ? details.flatMap((detail) =>
        detail?.data.suggestion ? [detail.data.suggestion] : [],
      )
    : [];
  const suggestions = await context.map(suggestionInputs, (suggestion) =>
    context.tryLoad(catalogoDisciplinasCreditosClassicos, suggestion),
  );
  const creditsByCode = new Map<string, number>();
  for (const suggestion of suggestions)
    for (const course of suggestion?.data.courses ?? []) {
          const code = canonicalCode(course.code);
          const existing = creditsByCode.get(code);
          if (existing !== undefined && existing !== course.credits)
            crawlerIssue(
              context,
              "catalogo-disciplinas-cobertura",
              { year, code },
              {
                code: "invalid-value",
                path: `disciplines.${code}.credits`,
                message: "Mesmo código possui créditos divergentes no catálogo",
                expected: String(existing),
                actual: course.credits,
              },
            );
          else creditsByCode.set(code, course.credits);
    }
  const courses = uniqueCatalogCourses(
    [
      ...collected,
      ...legacyFallbackCourses(
        disciplineReferences,
        collected,
        creditsByCode,
      ),
    ],
    context,
    year,
  );
  validateLegacyCoverage(year, disciplineReferences, courses, context);
  return {
    year,
    sourceFormat: "LEGACY_CLASSIC" as const,
    sourceUrl: catalogProgramsUrl(year),
    courses,
  };
}

async function crawlCatalogoDisciplinasIntermediario(
  year: number,
  context: ScrapingContext,
) {
  const index = await context.tryLoad(catalogoCoordenadorias, { year });
  if (!index) return undefined;
  const coordinatorIndexes = await context.map(
    index.data.coordinators,
    async (coordinator) =>
      context.tryLoad(catalogoCoordenadoriaDisciplinas, coordinator),
  );
  const disciplineReferences = mergeLegacyReferences(
    coordinatorIndexes.flatMap(
      (coordinator) => coordinator?.data.references ?? [],
    ),
  );
  const pages = await context.map(disciplineReferences, async (reference) =>
    context.tryLoad(catalogoDisciplinasLegado, {
      url: reference.url,
      sourceFormat: "LEGACY_INTERMEDIATE",
      coordinator: reference.coordinator,
    }),
  );
  const courses = uniqueCatalogCourses(
    pages.flatMap((page) => page?.data.courses ?? []),
    context,
    year,
  );
  validateLegacyCoverage(year, disciplineReferences, courses, context);
  return {
    year,
    sourceFormat: "LEGACY_INTERMEDIATE" as const,
    sourceUrl: catalogCoordinatorsUrl(year),
    courses,
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

export type CatalogProgramsSnapshotProfile = "core" | "available" | "complete";

export type CatalogProgramsSnapshot = {
  year: number;
  profile: CatalogProgramsSnapshotProfile;
  sourceFormat: CatalogProgramLayout;
  components: {
    programs: CatalogosProgramas;
    curricula?: CatalogoCurriculos;
    information?: CatalogoInformacoes;
    suggestions?: SugestaoCurriculo;
  };
  componentStatuses: Record<
    "programs" | "curricula" | "information" | "suggestions",
    "COMPLETE" | "UNAVAILABLE" | "FAILED"
  >;
};

const snapshotComponentNames = [
  "programs",
  "curricula",
  "information",
  "suggestions",
] as const;

type SnapshotComponentName = (typeof snapshotComponentNames)[number];

function catalogProgramReference(
  program: CatalogProgramReference,
  curriculum: CursoPaginaInput,
  suggestion: CursoPaginaInput,
): CursoReferencia {
  return {
    code: program.code,
    name: program.name,
    slug: String(program.code),
    curriculum,
    members: { ...curriculum },
    suggestion,
  };
}

function completeComponent(
  expectedPrograms: CatalogProgramReference[],
  programs: Array<{ code: number }>,
  issuesBefore: number,
  context: ScrapingContext,
): "COMPLETE" | "FAILED" {
  const actual = new Set(programs.map((program) => program.code));
  return context.issues
    .slice(issuesBefore)
    .every((issue) => issue.blocksCompleteness === false) &&
    expectedPrograms.every((program) => actual.has(program.code))
    ? "COMPLETE"
    : "FAILED";
}

async function crawlHistoricalCatalogProgramsSnapshot(
  year: number,
  programs: CatalogosProgramas,
  context: ScrapingContext,
): Promise<Pick<CatalogProgramsSnapshot, "components" | "componentStatuses">> {
  const catalog = programs.catalogs.find((value) => value.year === year);
  const statuses: CatalogProgramsSnapshot["componentStatuses"] = {
    programs: catalog && catalog.programs.length > 0 ? "COMPLETE" : "FAILED",
    curricula: "UNAVAILABLE",
    information: "UNAVAILABLE",
    suggestions: "UNAVAILABLE",
  };
  if (!catalog)
    return { components: { programs }, componentStatuses: statuses };

  const detailsBefore = context.issues.length;
  const details = await context.map(catalog.programs, async (program) =>
    context.tryLoad(catalogoProgramaHistoricoDetalhes, {
      programCode: program.code,
      name: program.name,
      url: program.sourceUrl,
    }),
  );
  const loaded = details.flatMap((detail, index) =>
    detail ? [{ program: catalog.programs[index], detail: detail.data }] : [],
  );
  if (
    loaded.length !== catalog.programs.length ||
    context.issues.length !== detailsBefore
  ) {
    statuses.curricula = "FAILED";
    statuses.information = "FAILED";
    statuses.suggestions = "FAILED";
    return { components: { programs }, componentStatuses: statuses };
  }

  const curriculaBefore = context.issues.length;
  const curricula = await context.map(loaded, async ({ program, detail }) => {
    if (!detail.curriculum) return undefined;
    const page = await context.tryLoad(cursoCurriculo, detail.curriculum);
    if (!page) return undefined;
    return {
      ...catalogProgramReference(
        program,
        detail.curriculum,
        detail.suggestion ?? detail.curriculum,
      ),
      ...page.data,
    };
  });
  const curriculumPrograms = curricula.flatMap((program) =>
    program ? [program] : [],
  );
  for (const program of curriculumPrograms)
    if (
      program.blocks.length === 0 &&
      program.specializations.every(
        (specialization) => specialization.blocks.length === 0,
      )
    )
      context.issues.push({
        adapter: "curso-curriculo",
        input: { year, programCode: program.code },
        code: "missing-required-section",
        path: "blocks",
        message: "Currículo histórico sem blocos reconhecidos",
        timestamp: new Date().toISOString(),
      });
  statuses.curricula = completeComponent(
    catalog.programs,
    curriculumPrograms,
    curriculaBefore,
    context,
  );

  const informationBefore = context.issues.length;
  const informationPrograms = await context.map(
    loaded,
    async ({ program, detail }) => {
      const parsedInformation = structureCursoInformacoes(detail.information);
      const curriculum = detail.information.curriculumUrl
        ? await context.tryLoad(curriculoEspecializacoes, {
            programCode: program.code,
            name: program.name,
            url: detail.information.curriculumUrl,
          })
        : undefined;
      const resolved = resolveInformationSpecializations(
        detail.information,
        year,
        parsedInformation,
        curriculum?.data.specializations ?? [],
      );
      for (const violation of [
        ...validateCursoInformacoes(detail.information, year),
        ...resolved.violations,
      ])
        context.issues.push({
          adapter: "catalogo-informacoes",
          input: { year, programCode: program.code },
          code: "invalid-value",
          path: violation.rule,
          message: violation.message,
          actual: violation.actual,
          blocksCompleteness: year <= 2020 ? false : undefined,
          timestamp: new Date().toISOString(),
        });
      return {
        code: program.code,
        name: program.name,
        sourceUrl: detail.information.sourceUrl,
        sections: detail.information.sections,
        information: resolved.information,
      };
    },
  );
  statuses.information = completeComponent(
    catalog.programs,
    informationPrograms,
    informationBefore,
    context,
  );

  const suggestionsBefore = context.issues.length;
  const suggestions = await context.map(loaded, async ({ program, detail }) => {
    if (!detail.suggestion) return undefined;
    const page = await context.tryLoad(cursoSugestao, detail.suggestion);
    if (!page || page.data.suggestions.length === 0) {
      if (page && page.data.suggestions.length === 0)
        context.issues.push({
          adapter: "curso-sugestao",
          input: detail.suggestion,
          code: "missing-required-section",
          path: "suggestions",
          message: "Sugestões de currículo vazias na página histórica",
          timestamp: new Date().toISOString(),
        });
      return undefined;
    }
    return {
      ...catalogProgramReference(
        program,
        detail.curriculum ?? detail.suggestion,
        detail.suggestion,
      ),
      ...page.data,
    };
  });
  const suggestionPrograms = suggestions.flatMap((program) =>
    program ? [program] : [],
  );
  statuses.suggestions = completeComponent(
    catalog.programs,
    suggestionPrograms,
    suggestionsBefore,
    context,
  );

  return {
    components: {
      programs,
      curricula: {
        catalogs: [
          {
            year,
            sourceUrl: catalog.sourceUrl,
            programs: curriculumPrograms,
          },
        ],
      },
      information: {
        catalogs: [
          {
            year,
            sourceUrl: catalog.sourceUrl,
            programs: informationPrograms,
          },
        ],
        validation: buildCatalogoInformacoesValidation([
          {
            year,
            sourceUrl: catalog.sourceUrl,
            programs: informationPrograms,
            violations: [],
          },
        ]),
      },
      suggestions: {
        source: catalogsPortalUrl,
        firstYear: year,
        lastYear: year,
        catalogs: [
          {
            year,
            sourceUrl: catalog.sourceUrl,
            programs: suggestionPrograms,
          },
        ],
      },
    },
    componentStatuses: statuses,
  };
}

export async function crawlCatalogProgramsSnapshot(
  input: { year: number; profile: CatalogProgramsSnapshotProfile },
  context: ScrapingContext,
): Promise<ScrapeResult<CatalogProgramsSnapshot>> {
  const programs = await crawlCatalogosProgramas(
    { firstYear: input.year, lastYear: input.year },
    context,
  );
  const components: CatalogProgramsSnapshot["components"] = {
    programs: programs.data,
  };
  const componentStatuses: CatalogProgramsSnapshot["componentStatuses"] = {
    programs:
      programs.data.catalogs.length === 1 &&
      programs.data.catalogs[0].programs.length > 0
        ? "COMPLETE"
        : "FAILED",
    curricula: "UNAVAILABLE",
    information: "UNAVAILABLE",
    suggestions: "UNAVAILABLE",
  };
  if (input.year < 2021 && input.profile === "complete") {
    const historical = await crawlHistoricalCatalogProgramsSnapshot(
      input.year,
      programs.data,
      context,
    );
    Object.assign(components, historical.components);
    Object.assign(componentStatuses, historical.componentStatuses);
  }
  if (input.year >= 2021 && input.profile !== "core") {
    components.curricula = (
      await crawlCatalogoCurriculos(
        { firstYear: input.year, lastYear: input.year },
        context,
      )
    ).data;
    components.information = (
      await crawlCatalogoInformacoes(
        { firstYear: input.year, lastYear: input.year },
        context,
      )
    ).data;
    components.suggestions = (
      await crawlSugestaoCurriculo(
        { firstYear: input.year, lastYear: input.year },
        context,
      )
    ).data;
    componentStatuses.curricula = "COMPLETE";
    componentStatuses.information = "COMPLETE";
    componentStatuses.suggestions = "COMPLETE";
  }
  return {
    data: {
      year: input.year,
      profile: input.profile,
      sourceFormat: catalogProgramLayout(input.year),
      components,
      componentStatuses,
    },
    issues: context.issues,
    pages: context.pages,
  };
}
