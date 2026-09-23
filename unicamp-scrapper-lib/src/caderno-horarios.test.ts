import assert from "node:assert/strict";
import test from "node:test";
import {
  createScrapingContext,
  crawlCadernoDeHorario,
  type PageFetcher,
} from "./index.js";
import {
  parseCadernoDeHorarioInstituto,
  parseCadernoDeHorarioPagina,
} from "./caderno-horarios.js";

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
  assert.equal(result.data.institutes[0].name, "Instituto de Computação");
  assert.equal(result.data.institutes[0].courses[0].code, "MC102");
  assert.equal(
    result.data.institutes[0].courses[0].classes[0].classes[0].room,
    "IC-1",
  );
});

test("parser de instituto usa o código como fallback quando não há nome", () => {
  const result = parseCadernoDeHorarioInstituto(
    "<h1>IC</h1>",
    { year: 2026, semester: 1, instituteCode: "IC" },
  );

  assert.equal(result.name, "IC");
});

test("parser de instituto preserva o nome da página raiz", () => {
  const result = parseCadernoDeHorarioInstituto(
    "<h1>IC - Graduação/Tecnologia</h1>",
    {
      year: 2026,
      semester: 1,
      instituteCode: "IC",
      name: "Instituto de Computação",
    },
  );

  assert.equal(result.name, "Instituto de Computação");
});

test("crawler de caderno não confunde siglas de disciplinas com institutos", () => {
  const result = parseCadernoDeHorarioPagina(
    '<div class="lista-oferecimento">' +
      '<div class="item"><a href="ia/">IA Instituto de Artes</a></div>' +
      '<div class="item"><a href="ic/">IC Instituto de Computação</a></div>' +
      '<div class="item"><a href="ia/?prefix=AC"><span>AC Instituto de Artes</span></a></div>' +
      "</div>",
    { year: 2026, semester: 1 },
  );

  assert.deepEqual(
    result.institutes.map(({ instituteCode }) => instituteCode),
    ["IA", "IC"],
  );
});

test("crawler de caderno limita a coleta ao instituto solicitado", async () => {
  const result = await crawlCadernoDeHorario(
    { year: 2026, semester: 1, instituteCode: "ic" },
    createScrapingContext(fetcher),
  );

  assert.deepEqual(
    result.data.institutes.map((institute) => institute.code),
    ["IC"],
  );
});
