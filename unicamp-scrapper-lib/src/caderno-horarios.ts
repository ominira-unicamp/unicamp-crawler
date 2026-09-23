import type { PageAdapter, ScrapeResult, ScrapingContext } from "./core.js";
import { absoluteUrl, loadHtml, normalizedText } from "./dom.js";

const baseUrl = (year: number, semester: number) =>
  `https://www.dac.unicamp.br/portal/caderno-de-horarios/${year}/${semester}/S/G/`;

export type CadernoDeHorarioInput = {
  year: number;
  semester: 1 | 2;
  instituteCode?: string;
};
export type CadernoDeHorarioInstitutoInput = CadernoDeHorarioInput & {
  instituteCode: string;
  url?: string;
  name?: string;
};
export type CadernoDeHorarioDisciplinaInput = CadernoDeHorarioInput & {
  courseCode: string;
  url: string;
};
export type Aula = {
  weekday: string;
  time: { start: string; end: string };
  room: string;
};
export type Turma = {
  name: string;
  professors: string[];
  classes: Aula[];
  reservations: number[];
};
export type Disciplina = { code: string; name: string; classes: Turma[] };
export type CadernoDeHorarioInstitutoPage = {
  code: string;
  name: string;
  courses: CadernoDeHorarioDisciplinaInput[];
};
export type CadernoDeHorarioPagina = {
  institutes: CadernoDeHorarioInstitutoInput[];
};
export type CadernoDeHorario = {
  year: number;
  semester: 1 | 2;
  institutes: Array<{
    code: string;
    name: string;
    courses: Disciplina[];
  }>;
};

export function cadernoDeHorarioUrl(input: CadernoDeHorarioInput): string {
  return baseUrl(input.year, input.semester);
}
export async function fetchCadernoDeHorarioPagina(
  input: CadernoDeHorarioInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(cadernoDeHorarioUrl(input));
}
export function parseCadernoDeHorarioPagina(
  html: string,
  input: CadernoDeHorarioInput,
): CadernoDeHorarioPagina {
  const $ = loadHtml(html);
  const url = cadernoDeHorarioUrl(input);
  const institutes: CadernoDeHorarioInstitutoInput[] = [];
  const seenInstituteUrls = new Set<string>();
  $(".lista-oferecimento .item a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href");
    if (!href) return;
    const instituteUrl = absoluteUrl(href, url);
    const codigo = normalizedText($(anchor)).match(/^[A-Z][A-Z0-9]{1,9}/)?.[0];
    const urlCode = new URL(instituteUrl).pathname
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.toUpperCase();
    if (!codigo || codigo !== urlCode || seenInstituteUrls.has(instituteUrl))
      return;
    seenInstituteUrls.add(instituteUrl);
    const name = normalizedText($(anchor)).replace(
      new RegExp(`^${codigo}\\s*[-–—]?\\s*`, "i"),
      "",
    );
    institutes.push({
      ...input,
      instituteCode: codigo,
      url: instituteUrl,
      name: name || undefined,
    });
  });
  return { institutes };
}
export const cadernoDeHorarioPagina: PageAdapter<
  CadernoDeHorarioInput,
  CadernoDeHorarioPagina
> = {
  id: "caderno-horarios-pagina",
  fetch: fetchCadernoDeHorarioPagina,
  parse: parseCadernoDeHorarioPagina,
};

export async function fetchCadernoDeHorarioInstituto(
  input: CadernoDeHorarioInstitutoInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(
    input.url ?? `${cadernoDeHorarioUrl(input)}${input.instituteCode}/`,
  );
}
export function parseCadernoDeHorarioInstituto(
  html: string,
  input: CadernoDeHorarioInstitutoInput,
): CadernoDeHorarioInstitutoPage {
  const $ = loadHtml(html);
  const heading = normalizedText($("h1").first());
  const [, headingName] = heading.split(/\s*[-–—]\s*/, 2);
  const name = input.name?.trim() || headingName?.trim() || heading || input.instituteCode;
  const courses: CadernoDeHorarioDisciplinaInput[] = [];
  $(".disciplina a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href");
    if (!href) return;
    const label = normalizedText($(anchor));
    const courseCode = label.split("-")[0].trim();
    if (courseCode)
      courses.push({
        year: input.year,
        semester: input.semester,
        courseCode,
        url: absoluteUrl(href, input.url ?? cadernoDeHorarioUrl(input)),
      });
  });
  return { code: input.instituteCode, name, courses };
}
export const cadernoDeHorarioInstituto: PageAdapter<
  CadernoDeHorarioInstitutoInput,
  CadernoDeHorarioInstitutoPage
> = {
  id: "caderno-horarios-instituto",
  fetch: fetchCadernoDeHorarioInstituto,
  parse: parseCadernoDeHorarioInstituto,
};

export async function fetchCadernoDeHorarioDisciplina(
  input: CadernoDeHorarioDisciplinaInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url);
}
export function parseCadernoDeHorarioDisciplina(
  html: string,
  input: CadernoDeHorarioDisciplinaInput,
): Disciplina {
  const $ = loadHtml(html);
  const heading = normalizedText($("h1").first()).split("-");
  const code = heading[0]?.trim() || input.courseCode;
  const name = heading.slice(1).join("-").trim();
  const classes = $(".panel")
    .toArray()
    .map((panel) => ({
      name: normalizedText($(panel).find(".label").first()),
      professors: $(panel)
        .find(".docentes li")
        .toArray()
        .map((item) => normalizedText($(item))),
      classes: $(panel)
        .find(".horariosFormatado > li")
        .toArray()
        .map((item) => {
          const time = normalizedText($(item).find(".horarios").first()).split(
            "-",
          );
          return {
            weekday: normalizedText($(item).find(".diaSemana").first()),
            time: {
              start: time[0]?.trim() ?? "",
              end: time.slice(1).join("-").trim(),
            },
            room: normalizedText($(item).find(".salaAula").first()),
          };
        }),
      reservations: $(panel)
        .find(".reservas > li")
        .toArray()
        .map((item) => Number(normalizedText($(item)).split("-")[0]))
        .filter(Number.isFinite),
    }));
  return { code, name, classes };
}
export const cadernoDeHorarioDisciplina: PageAdapter<
  CadernoDeHorarioDisciplinaInput,
  Disciplina
> = {
  id: "caderno-horarios-disciplina",
  fetch: fetchCadernoDeHorarioDisciplina,
  parse: parseCadernoDeHorarioDisciplina,
};

export async function crawlCadernoDeHorario(
  input: CadernoDeHorarioInput,
  context: ScrapingContext,
): Promise<ScrapeResult<CadernoDeHorario>> {
  const root = await context.load(cadernoDeHorarioPagina, input);
  const loaded = await context.map(
    root.data.institutes.filter(
      (institute) =>
        !input.instituteCode ||
        institute.instituteCode.toLowerCase() ===
          input.instituteCode.toLowerCase(),
    ),
    async (instituteInput) => {
      const institute = await context.tryLoad(
        cadernoDeHorarioInstituto,
        instituteInput,
      );
      if (!institute) return undefined;
      const disciplines = await context.map(
        institute.data.courses,
        async (disciplineInput) => {
          const discipline = await context.tryLoad(
            cadernoDeHorarioDisciplina,
            disciplineInput,
          );
          if (discipline)
            context.logger.debug(
              {
                event: "scrape.discipline.success",
                year: input.year,
                semester: input.semester,
                code: discipline.data.code,
                name: discipline.data.name,
              },
              "Disciplina extraída",
            );
          return discipline;
        },
      );
      return {
        code: institute.data.code,
        name: institute.data.name,
        courses: disciplines.flatMap((item) => (item ? [item.data] : [])),
      };
    },
  );
  return {
    data: {
      year: input.year,
      semester: input.semester,
      institutes: loaded.flatMap((item) => (item ? [item] : [])),
    },
    issues: context.issues,
    pages: context.pages,
  };
}
