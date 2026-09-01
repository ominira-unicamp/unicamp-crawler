import type { PageAdapter, ScrapeResult, ScrapingContext } from "./core.js";
import { absoluteUrl, loadHtml, normalizedText } from "./dom.js";

export const cardapioPortalUrl = "https://www.prefeitura.unicamp.br/cardapio/";
export const cardapioDiaBaseUrl =
  "https://sistemas.prefeitura.unicamp.br/apps/cardapio/index.php";
const headings: Record<string, [string, boolean]> = {
  almoço: ["lunch", false],
  almoco: ["lunch", false],
  "almoço vegano": ["lunch", true],
  "almoco vegano": ["lunch", true],
  jantar: ["dinner", false],
  "jantar vegano": ["dinner", true],
  "café da manhã": ["breakfast", false],
  "cafe da manha": ["breakfast", false],
};
export type CardapioInput = { date?: string };
export type CardapioDiaInput = { url: string; date?: string };
export type Refeicao = {
  meal: string;
  label: string;
  vegan: boolean;
  status: "available" | "not_registered";
  unavailableMessage: string | null;
  mainDish: string | null;
  items: string[];
  observations: string[];
  serviceNotes: string[];
};
export type CardapioPortalPage = { menu: CardapioDiaInput };
export type CardapioDiaPage = { sourceUrl: string; meals: Refeicao[] };
export type Cardapio = CardapioDiaPage & { date: string | null };
export type CardapiosInput = { firstDate: string; lastDate: string };
export type Cardapios = {
  firstDate: string;
  lastDate: string;
  menus: Cardapio[];
};
export function cardapioDiaUrl(date?: string): string {
  if (!date) return cardapioDiaBaseUrl;
  parseIsoDate(date);
  return `${cardapioDiaBaseUrl}?d=${encodeURIComponent(date)}`;
}
export async function fetchCardapioPortal(
  _input: CardapioInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(cardapioPortalUrl);
}
export function parseCardapioPortal(
  html: string,
  input: CardapioInput,
): CardapioPortalPage {
  const $ = loadHtml(html);
  const iframe = $("iframe[src]").first().attr("src");
  if (!iframe && !input.date)
    throw new Error("Não foi encontrado o iframe do cardápio");
  return {
    menu: {
      url: input.date
        ? cardapioDiaUrl(input.date)
        : absoluteUrl(iframe!, cardapioPortalUrl),
      date: input.date,
    },
  };
}
export const cardapioPortal: PageAdapter<CardapioInput, CardapioPortalPage> = {
  id: "cardapio-portal",
  fetch: fetchCardapioPortal,
  parse: parseCardapioPortal,
};
export async function fetchCardapioDia(
  input: CardapioDiaInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url);
}
export function parseCardapioDia(
  html: string,
  input: CardapioDiaInput,
): CardapioDiaPage {
  const $ = loadHtml(html);
  const meals: Refeicao[] = [];

  $(".menu-section").each((_, sectionElement) => {
    const section = $(sectionElement);
    const headingElement = section.find("h2,h3").first();
    const label = normalizedText(headingElement);
    if (!label) return;

    const heading = headings[label.toLocaleLowerCase("pt-BR")];
    if (!heading) return;

    const menuItem = section.find(".menu-item").first();
    if (!menuItem.length) {
      throw new Error(`A seção "${label}" não contém .menu-item`);
    }

    const mainDishElement = menuItem.find(".menu-item-name").first();
    const descriptionElement = menuItem
      .find(".menu-item-description")
      .first();

    const hasMainDishElement = mainDishElement.length > 0;
    const hasDescriptionElement = descriptionElement.length > 0;

    if (!hasMainDishElement && !hasDescriptionElement) {
      meals.push({
        meal: heading[0],
        label,
        vegan: heading[1],
        status: "not_registered",
        unavailableMessage: normalizedText(menuItem) || null,
        mainDish: null,
        items: [],
        observations: [],
        serviceNotes: [],
      });
      return;
    }

    if (!hasMainDishElement || !hasDescriptionElement) {
      throw new Error(
        `A seção "${label}" possui uma estrutura de cardápio incompleta`,
      );
    }

    const mainDish = normalizedText(mainDishElement) || null;
    if (!mainDish) {
      throw new Error(`A seção "${label}" possui prato principal vazio`);
    }

    const toLines = (element: typeof descriptionElement): string[] => {
      const clone = element.clone();
      clone.find("br").replaceWith("\n");

      return clone
        .text()
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);
    };

    const serviceNoteElements = descriptionElement
      .find("font[color]")
      .filter((_, element) =>
        (($(element).attr("color") ?? "").toLocaleLowerCase("pt-BR")) ===
        "red",
      );

    const serviceNotes = serviceNoteElements
      .toArray()
      .flatMap((element) => toLines($(element)));

    const descriptionWithoutServiceNotes = descriptionElement.clone();
    descriptionWithoutServiceNotes
      .find("font[color]")
      .filter((_, element) =>
        (($(element).attr("color") ?? "").toLocaleLowerCase("pt-BR")) ===
        "red",
      )
      .remove();

    const lines = toLines(descriptionWithoutServiceNotes);
    const observationMarkerIndex = lines.findIndex((line) => {
      const value = line.toLocaleLowerCase("pt-BR");
      return value === "observações:" || value === "observacoes:";
    });

    const items =
      observationMarkerIndex >= 0
        ? lines.slice(0, observationMarkerIndex)
        : lines;
    const observations =
      observationMarkerIndex >= 0
        ? lines.slice(observationMarkerIndex + 1)
        : [];

    meals.push({
      meal: heading[0],
      label,
      vegan: heading[1],
      status: "available",
      unavailableMessage: null,
      mainDish,
      items,
      observations,
      serviceNotes,
    });
  });

  if (!meals.length)
    throw new Error("Nenhuma seção de refeição foi encontrada no cardápio");

  return { sourceUrl: input.url, meals };
}

export const cardapioDia: PageAdapter<CardapioDiaInput, CardapioDiaPage> = {
  id: "cardapio-dia",
  fetch: fetchCardapioDia,
  parse: parseCardapioDia,
};
export async function crawlCardapio(
  input: CardapioInput,
  context: ScrapingContext,
): Promise<ScrapeResult<Cardapio>> {
  const menu = input.date
    ? { url: cardapioDiaUrl(input.date), date: input.date }
    : (await context.load(cardapioPortal, input)).data.menu;
  const page = await context.load(cardapioDia, menu);
  return {
    data: { ...page.data, date: input.date ?? null },
    issues: context.issues,
    pages: context.pages,
  };
}

export async function crawlCardapios(
  input: CardapiosInput,
  context: ScrapingContext,
): Promise<ScrapeResult<Cardapios>> {
  const dates = dateRange(input.firstDate, input.lastDate);
  const menus = await context.map(dates, async (date) => {
    const page = await context.tryLoad(cardapioDia, {
      url: cardapioDiaUrl(date),
      date,
    });
    return page ? { ...page.data, date } : undefined;
  });

  return {
    data: {
      firstDate: input.firstDate,
      lastDate: input.lastDate,
      menus: menus.flatMap((menu) => (menu ? [menu] : [])),
    },
    issues: context.issues,
    pages: context.pages,
  };
}

function dateRange(firstDate: string, lastDate: string): string[] {
  const first = parseIsoDate(firstDate);
  const last = parseIsoDate(lastDate);
  if (first > last)
    throw new Error("A data inicial deve ser anterior ou igual à data final");

  const dates: string[] = [];
  for (let timestamp = first; timestamp <= last; timestamp += 86_400_000)
    dates.push(new Date(timestamp).toISOString().slice(0, 10));
  return dates;
}

function parseIsoDate(value: string): number {
  const parts = value.split("-");
  if (parts.length !== 3)
    throw new Error("A data deve estar no formato AAAA-MM-DD");

  const [yearText, monthText, dayText] = parts;
  if (yearText.length !== 4 || monthText.length !== 2 || dayText.length !== 2)
    throw new Error("A data deve estar no formato AAAA-MM-DD");

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  )
    throw new Error("A data deve estar no formato AAAA-MM-DD");

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw new Error(`Data inválida: ${value}`);

  return timestamp;
}
