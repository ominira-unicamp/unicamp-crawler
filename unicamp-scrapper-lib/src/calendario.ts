import type { PageAdapter, ScrapeResult, ScrapingContext } from "./core.js";
import { loadHtml, normalizedText } from "./dom.js";

export const calendarioGraduacaoUrl = (year: number) =>
  `https://www.dac.unicamp.br/portal/calendario/${year}/graduacao`;
export type CalendarioInput = { year: number; url?: string };
export type EventoCalendario = {
  startDate: string;
  endDate: string | null;
  category: string;
  description: string;
};
export type CalendarioGraduacaoPage = { events: EventoCalendario[] };
const months: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};
const period =
  /^(\d{1,2})(?:\.(\d{1,2}))?(?:\s+(a|e)\s+(\d{1,2})(?:\.(\d{1,2}))?)?$/i;
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
function dateValue(year: number, month: number, day: number): string {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  )
    throw new Error(`Data inválida: ${day}-${month}-${year}`);
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
}
export function parsePeriodo(
  value: string,
  baseMonth: number,
  baseYear: number,
): Pick<EventoCalendario, "startDate" | "endDate"> {
  const match = period.exec(
    value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(),
  );
  if (!match) throw new Error(`Formato de período não reconhecido: ${value}`);
  const startMonth = match[2] ? Number(match[2]) : baseMonth;
  const startYear =
    match[2] && startMonth < baseMonth ? baseYear + 1 : baseYear;
  const startDate = dateValue(startYear, startMonth, Number(match[1]));
  if (!match[3]) return { startDate, endDate: null };
  const endMonth = match[5] ? Number(match[5]) : startMonth;
  const endYear = endMonth < startMonth ? startYear + 1 : startYear;
  return {
    startDate,
    endDate: dateValue(endYear, endMonth, Number(match[4])),
  };
}
function rows(html: string): string[][] {
  const $ = loadHtml(html);
  const result: string[][] = [];
  const active = new Map<number, { value: string; until: number }>();
  $("table tr").each((rowIndex, row) => {
    for (const [column, info] of [...active])
      if (info.until < rowIndex) active.delete(column);
    const cells: string[] = [];
    let column = 0;
    $(row)
      .children("th,td")
      .each((_, cell) => {
        while (active.has(column)) {
          cells[column] = active.get(column)!.value;
          column += 1;
        }
        const colspan = Math.max(1, Number($(cell).attr("colspan") ?? 1));
        const rowspan = Math.max(1, Number($(cell).attr("rowspan") ?? 1));
        const value = normalizedText($(cell));
        for (let offset = 0; offset < colspan; offset += 1) {
          cells[column + offset] = value;
          if (rowspan > 1)
            active.set(column + offset, {
              value,
              until: rowIndex + rowspan - 1,
            });
        }
        column += colspan;
      });
    for (const [index, info] of active)
      if (!cells[index]) cells[index] = info.value;
    result.push(cells);
  });
  return result;
}
export async function fetchCalendarioGraduacaoPagina(
  input: CalendarioInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url ?? calendarioGraduacaoUrl(input.year));
}
export function parseCalendarioGraduacaoPagina(
  html: string,
  _input: CalendarioInput,
): CalendarioGraduacaoPage {
  const events: EventoCalendario[] = [];
  let month = 0;
  let year = 0;
  for (const row of rows(html)) {
    const headerValue = row[0];
    if (headerValue && row.every((value) => value === headerValue)) {
      const heading =
        /^(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (\d{4})$/i.exec(
          normalize(headerValue),
        );
      if (heading) {
        month = months[heading[1].toLocaleLowerCase("pt-BR")];
        year = Number(heading[2]);
      }
      continue;
    }
    if (!month || row.length < 3 || !row[0] || !row[1] || !row[2]) continue;
    try {
      events.push({
        ...parsePeriodo(row[0], month, year),
        category: row[1],
        description: row[2],
      });
    } catch {}
  }
  return { events };
}
export const calendarioGraduacaoPagina: PageAdapter<
  CalendarioInput,
  CalendarioGraduacaoPage
> = {
  id: "calendario-graduacao-pagina",
  fetch: fetchCalendarioGraduacaoPagina,
  parse: parseCalendarioGraduacaoPagina,
};
export async function crawlCalendario(
  input: CalendarioInput,
  context: ScrapingContext,
): Promise<ScrapeResult<EventoCalendario[]>> {
  const page = await context.load(calendarioGraduacaoPagina, input);
  return {
    data: page.data.events,
    issues: context.issues,
    pages: context.pages,
  };
}
