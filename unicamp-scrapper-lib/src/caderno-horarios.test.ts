import assert from "node:assert/strict";
import test from "node:test";
import {
  createScrapingContext,
  crawlCadernoDeHorario,
  type PageFetcher,
} from "./index.js";

const rootUrl =
  "https://www.dac.unicamp.br/portal/caderno-de-horarios/2026/1/S/G/";
const instituteUrl = `${rootUrl}ic/`;
const courseUrl = `${instituteUrl}mc102/`;

const pages = new Map([
  [
    rootUrl,
    '<div class="lista-oferecimento"><div class="item"><a href="ic/">IC - Instituto de Computação</a></div></div>',
  ],
  [
    instituteUrl,
    '<h1>IC - Instituto de Computação</h1><div class="disciplina"><a href="mc102/">MC102 - Algoritmos</a></div>',
  ],
  [
    courseUrl,
    '<h1>MC102 - Algoritmos</h1><div class="panel"><span class="label">A</span><ul class="docentes"><li>Ada Lovelace</li></ul><ul class="horariosFormatado"><li><span class="diaSemana">Segunda</span><span class="horarios">08:00 - 10:00</span><span class="salaAula">IC-1</span></li></ul><ul class="reservas"><li>10 - vagas</li></ul></div>',
  ],
]);

const fetcher: PageFetcher = {
  async fetch(url) {
    const page = pages.get(url);
    if (!page) throw new Error(`Página ausente: ${url}`);
    return page;
  },
};

test("crawler de caderno agrega páginas de instituto e disciplina", async () => {
  const result = await crawlCadernoDeHorario(
    { year: 2026, semester: 1 },
    createScrapingContext(fetcher),
  );

  assert.equal(result.issues.length, 0);
  assert.equal(result.data.institutes[0].code, "IC");
  assert.equal(result.data.institutes[0].courses[0].code, "MC102");
  assert.equal(
    result.data.institutes[0].courses[0].classes[0].classes[0].room,
    "IC-1",
  );
});
