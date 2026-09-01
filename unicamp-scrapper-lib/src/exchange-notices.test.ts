import assert from "node:assert/strict";
import test from "node:test";
import {
  closedExchangeNoticesUrl,
  crawlExchangeNotices,
  exchangeNoticesUrl,
  fetchClosedExchangeNotices,
  fetchOpenExchangeNotices,
  parseExchangeNotices,
} from "./exchange-notices.js";
import { createScrapingContext, type ScrapingContext } from "./core.js";

test("extrai editais de intercâmbio com inscrições e arquivos", () => {
  const notices = parseExchangeNotices(`
    <article class="filtrable-item">
      <span class="edital__number">12/2026</span>
      <span class="edital__author">DERI</span>
      <span class="edital__title">Intercâmbio</span>
      <span class="edital__place">França</span>
      <span class="edital__time">01/08/2026 a 31/08/2026</span>
      <a class="edital__file__link" href="https://example.test/edital.pdf">
        <span class="edital__file__name">Edital</span>
      </a>
    </article>
  `);

  assert.deepEqual(notices, [
    {
      number: "12/2026",
      issuer: "DERI",
      title: "Intercâmbio",
      place: "França",
      registration: {
        originalText: "01/08/2026 a 31/08/2026",
        startsAt: "2026-08-01",
        endsAt: "2026-08-31",
      },
      files: [{ name: "Edital", url: "https://example.test/edital.pdf" }],
    },
  ]);
});

test("preserva fallbacks e inscrições sem intervalo", () => {
  const notices = parseExchangeNotices(`
    <article class="filtrable-item">
      <span class="edital__time">Em breve</span>
      <a class="edital__file__link"></a>
    </article>
  `);

  assert.deepEqual(notices, [
    {
      number: null,
      issuer: null,
      title: null,
      place: "Não especificado",
      registration: { originalText: "Em breve" },
      files: [{ name: "Link", url: "" }],
    },
  ]);
});

test("retorna lista vazia quando não há editais", () => {
  assert.deepEqual(parseExchangeNotices("<html><body></body></html>"), []);
});

test("usa as URLs da DERI por padrão e aceita sobrescritas", async () => {
  const urls: string[] = [];
  const context = {
    fetcher: {
      async fetch(url: string) {
        urls.push(url);
        return "";
      },
    },
  } as ScrapingContext;

  await fetchOpenExchangeNotices({}, context);
  await fetchClosedExchangeNotices({}, context);
  await fetchOpenExchangeNotices(
    { openUrl: "https://example.test/editais" },
    context,
  );
  await fetchClosedExchangeNotices(
    { closedUrl: "https://example.test/editais-fechados" },
    context,
  );

  assert.deepEqual(urls, [
    exchangeNoticesUrl,
    closedExchangeNoticesUrl,
    "https://example.test/editais",
    "https://example.test/editais-fechados",
  ]);
});

test("agrega editais abertos e fechados", async () => {
  const context = createScrapingContext({
    async fetch(url) {
      return url === exchangeNoticesUrl
        ? `<article class="filtrable-item"><span class="edital__title">Aberto</span></article>`
        : `<article class="filtrable-item"><span class="edital__title">Fechado</span></article>`;
    },
  });

  const result = await crawlExchangeNotices({}, context);

  assert.deepEqual(
    result.data.map((notice) => notice.title),
    ["Aberto", "Fechado"],
  );
  assert.equal(result.issues.length, 0);
  assert.equal(result.pages.length, 2);
});
