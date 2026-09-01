import type { PageAdapter, ScrapeResult, ScrapingContext } from "./core.js";
import { loadHtml } from "./dom.js";

export const exchangeNoticesUrl =
  "https://www.internationaloffice.unicamp.br/intercambio/editais/";

export const closedExchangeNoticesUrl =
  "https://www.internationaloffice.unicamp.br/intercambio/editais/editais-fechados/";

export type ExchangeNoticesInput = {
  openUrl?: string;
  closedUrl?: string;
};

export type ExchangeNoticeFile = {
  name: string;
  url: string;
};

export type ExchangeNoticeRegistration = {
  originalText: string;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type ExchangeNotice = {
  number: string | null;
  issuer: string | null;
  title: string | null;
  place: string;
  registration: ExchangeNoticeRegistration | null;
  files: ExchangeNoticeFile[];
};

function dateToIso(value?: string): string | null {
  if (!value || !value.includes("/")) return null;
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

export async function fetchOpenExchangeNotices(
  input: ExchangeNoticesInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.openUrl ?? exchangeNoticesUrl);
}

export async function fetchClosedExchangeNotices(
  input: ExchangeNoticesInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.closedUrl ?? closedExchangeNoticesUrl);
}

export function parseExchangeNotices(html: string): ExchangeNotice[] {
  const $ = loadHtml(html);
  const notices: ExchangeNotice[] = [];

  $(".filtrable-item").each((_, element) => {
    const item = $(element);
    const number = item.find("span.edital__number").text().trim();
    const issuer = item.find("span.edital__author").text().trim();
    const title = item.find("span.edital__title").text().trim();
    const place = item.find("span.edital__place").text().trim();
    const registrationText = item.find("span.edital__time").text().trim();

    let registration: ExchangeNoticeRegistration | null = null;
    if (registrationText) {
      if (registrationText.includes(" a ")) {
        const [startsAtText, endsAtText] = registrationText.split(" a ");
        registration = {
          originalText: registrationText,
          startsAt: dateToIso(startsAtText.trim()),
          endsAt: dateToIso(endsAtText.trim()),
        };
      } else {
        registration = { originalText: registrationText };
      }
    }

    const files: ExchangeNoticeFile[] = [];
    item.find("a.edital__file__link").each((__, fileElement) => {
      const file = $(fileElement);
      files.push({
        name: file.find("span.edital__file__name").text().trim() || "Link",
        url: file.attr("href") || "",
      });
    });

    notices.push({
      number: number || null,
      issuer: issuer || null,
      title: title || null,
      place: place || "Não especificado",
      registration,
      files,
    });
  });

  return notices;
}

export const openExchangeNotices: PageAdapter<
  ExchangeNoticesInput,
  ExchangeNotice[]
> = {
  id: "exchange-open-notices",
  fetch: fetchOpenExchangeNotices,
  parse: parseExchangeNotices,
};

export const closedExchangeNotices: PageAdapter<
  ExchangeNoticesInput,
  ExchangeNotice[]
> = {
  id: "exchange-closed-notices",
  fetch: fetchClosedExchangeNotices,
  parse: parseExchangeNotices,
};

export async function crawlExchangeNotices(
  input: ExchangeNoticesInput,
  context: ScrapingContext,
): Promise<ScrapeResult<ExchangeNotice[]>> {
  const [open, closed] = await Promise.all([
    context.tryLoad(openExchangeNotices, input),
    context.tryLoad(closedExchangeNotices, input),
  ]);
  return {
    data: [...(open?.data ?? []), ...(closed?.data ?? [])],
    issues: context.issues,
    pages: context.pages,
  };
}
