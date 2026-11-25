import assert from "node:assert/strict";
import test from "node:test";
import {
  crawlContinenciaEquivalencia,
  fetchContinenciaEquivalenciaIndex,
  parseContinenciaEquivalenciaIndex,
  parseContinenciaEquivalenciaInitial,
} from "./continencia-equivalencia.js";
import { createScrapingContext, type ScrapeReporter } from "./core.js";

const url = "https://example.test/continencias";
const member = (code: string, prerequisiteOnlyMarker = false) => ({
  code,
  prerequisiteOnlyMarker,
});
const row = (content: string, code = "MC102") =>
  `<div class="row"><div class="disciplina"><a name="${code}">${code}</a></div><div class="continencia">${content}</div></div>`;
const index = `<div id="iniciais"><a href="/M">M</a><a href="/F">F</a></div>`;
function parse(html: string) {
  const issues: Array<Parameters<ScrapeReporter["issue"]>[0]> = [];
  const data = parseContinenciaEquivalenciaInitial(
    html,
    { initial: "M", url },
    {
      info() {},
      issue(issue) {
        issues.push(issue);
      },
    },
  );
  return { ...data, issues };
}
function context(pages: Record<string, string>) {
  return createScrapingContext({
    async fetch(requested) {
      if (!(requested in pages)) throw new Error("Página indisponível");
      return pages[requested];
    },
  });
}

test("índice usa URL oficial por padrão e aceita sobrescrita", async () => {
  const urls: string[] = [];
  const ctx = createScrapingContext({
    async fetch(requested) {
      urls.push(requested);
      return "";
    },
  });
  await fetchContinenciaEquivalenciaIndex({}, ctx);
  await fetchContinenciaEquivalenciaIndex({ url }, ctx);
  assert.deepEqual(urls, [
    "https://www.dac.unicamp.br/portal/continencias",
    url,
  ]);
});

test("índice resolve URLs e rejeita entradas inválidas ou conflitantes", () => {
  const issues: unknown[] = [];
  const parsed = parseContinenciaEquivalenciaIndex(
    index +
      `<div id="iniciais"><a href="/outra">M</a><a href="javascript:alert(1)">A</a><a href="/B">BB</a><a>C</a></div>`,
    { url },
    {
      info() {},
      issue(issue) {
        issues.push(issue);
      },
    },
  );
  assert.deepEqual(parsed.initials, [
    { initial: "M", url: "https://example.test/M" },
    { initial: "F", url: "https://example.test/F" },
  ]);
  assert.equal(issues.length, 4);
});

test("parser preserva alternativas, conjuntos, texto e códigos históricos", () => {
  const parsed = parse(
    row(
      `<span><a>QF536</a> <strong><a>QF636</a></strong></span> / <a>QF536</a> <a>QF637</a>`,
      "QF530",
    ) + row(`<a>F 139</a> <a>M 513</a> <a>ABC1234</a>`),
  );
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.relations[0], {
    targetCode: "QF530",
    sourceUrls: [url],
    groups: [
      { members: [member("QF536"), member("QF636")], rawText: "QF536 QF636" },
      { members: [member("QF536"), member("QF637")], rawText: "QF536 QF637" },
    ],
  });
  assert.deepEqual(parsed.relations[1].groups[0].members, [
    member("F 139"),
    member("M513"),
    member("ABC1234"),
  ]);
});

test("asteriscos internos e adjacentes são capturados antes da normalização", () => {
  for (const html of [
    "<a>*MC101</a>",
    "<a>MC101*</a>",
    "*<span><a>MC101</a></span>",
    "<a>MC101</a><sup>*</sup>",
  ]) {
    const parsed = parse(row(html));
    assert.deepEqual(parsed.issues, [], html);
    assert.deepEqual(
      parsed.relations[0].groups[0].members,
      [member("MC101", true)],
      html,
    );
    assert.match(parsed.relations[0].groups[0].rawText, /\*/);
  }
  const parsed = parse(
    row(`<a>MC101</a> *<a>MC103</a> / <a>MC104</a>* <a>MC105</a>`),
  );
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(
    parsed.relations[0].groups.map((group) => group.members),
    [
      [member("MC101"), member("MC103", true)],
      [member("MC104", true), member("MC105")],
    ],
  );
});

test("conteúdo desconhecido, código inválido, alternativa vazia e marcador ambíguo bloqueiam completude", () => {
  for (const html of [
    "<a>MC101</a> observação",
    "<a>???</a>",
    "<a>M*C101</a>",
    '<a href="https://www.dac.unicamp.br/portal/continencias/"> </a>',
    "<a>MC101</a> /",
    "/ <a>MC101</a>",
    "<a>MC101</a> // <a>MC103</a>",
    "<a>MC101</a> * <a>MC103</a>",
    "*",
  ]) {
    const parsed = parse(row(html) + row("<a>MC104</a>", "MC105"));
    assert.ok(parsed.issues.length > 0, html);
    assert.ok(
      parsed.issues.every((issue) => issue.blocksCompleteness),
      html,
    );
    assert.ok(
      parsed.relations.some((relation) => relation.targetCode === "MC105"),
    );
  }
  assert.equal(parse(row("<a>MC101</a> observação")).relations.length, 0);
});

test("linhas incompletas são diagnosticadas sem duplicar linhas em containers row", () => {
  const parsed = parse(
    `<div class="row">${row("<a>MC101</a>")}<div class="row"><div class="disciplina">MC103</div></div><div class="row"><div class="continencia"><a>MC104</a></div></div></div>`,
  );
  assert.equal(parsed.relations.length, 1);
  assert.equal(parsed.issues.length, 2);
  assert.ok(parsed.issues.every((issue) => issue.blocksCompleteness));
});

test("crawler agrega origens e deduplica conjuntos sem perder restrições", async () => {
  const ctx = context({
    [url]: index,
    "https://example.test/M": row(
      "<a>MC101</a> <a>MC103</a> / <a>MC103</a> <a>MC101</a> / <a>MC101</a> <a>MC101</a>",
    ),
    "https://example.test/F": row(
      "<a>MC103</a> <a>MC101</a> / <a>*MC101</a> <a>MC101</a>",
    ),
  });
  const result = await crawlContinenciaEquivalencia({ url }, ctx);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.data.coverage, {
    expectedInitials: ["M", "F"],
    loadedInitials: ["M", "F"],
    failedInitials: [],
    complete: true,
  });
  assert.equal(result.data.relations.length, 1);
  const relation = result.data.relations[0];
  assert.deepEqual(relation.sourceUrls, [
    "https://example.test/M",
    "https://example.test/F",
  ]);
  assert.equal(relation.groups.length, 3);
  assert.deepEqual(relation.groups[0].members, [
    member("MC101"),
    member("MC103"),
  ]);
  assert.deepEqual(relation.groups[1].members, [member("MC101")]);
  assert.deepEqual(relation.groups[2].members, [
    member("MC101", true),
    member("MC101"),
  ]);
  assert.equal(relation.groups[0].rawText, "MC101 MC103");
});

test("crawler identifica inicial ausente mantendo dados válidos", async () => {
  const result = await crawlContinenciaEquivalencia(
    { url },
    context({ [url]: index, "https://example.test/M": row("<a>MC101</a>") }),
  );
  assert.deepEqual(result.data.coverage, {
    expectedInitials: ["M", "F"],
    loadedInitials: ["M"],
    failedInitials: ["F"],
    complete: false,
  });
  assert.equal(result.data.relations.length, 1);
  assert.equal(result.issues[0].code, "load-error");
  assert.equal(result.issues[0].blocksCompleteness, true);
});

test("página carregada com linha inválida não conta como falha HTTP mas torna coleta incompleta", async () => {
  const result = await crawlContinenciaEquivalencia(
    { url },
    context({
      [url]: index,
      "https://example.test/M": row("<a>MC101</a>"),
      "https://example.test/F": row("<a>inválido</a>"),
    }),
  );
  assert.deepEqual(result.data.coverage.loadedInitials, ["M", "F"]);
  assert.deepEqual(result.data.coverage.failedInitials, []);
  assert.equal(result.data.coverage.complete, false);
  assert.equal(result.data.relations.length, 1);
});

test("índice vazio ou indisponível produz diagnóstico incompleto", async () => {
  for (const pages of [{ [url]: "<html></html>" }, {}]) {
    const result = await crawlContinenciaEquivalencia({ url }, context(pages));
    assert.equal(result.data.coverage.complete, false);
    assert.deepEqual(result.data.coverage.expectedInitials, []);
    assert.deepEqual(result.data.relations, []);
    assert.ok(result.issues.some((issue) => issue.blocksCompleteness));
  }
});
