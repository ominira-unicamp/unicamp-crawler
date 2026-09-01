import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchContinenciaEquivalenciaIndex,
  parseContinenciaEquivalenciaIndex,
  parseContinenciaEquivalenciaInitial,
} from "./continencia-equivalencia.js";
import type { ScrapingContext } from "./core.js";

test("índice usa a URL oficial por padrão e aceita sobrescrita", async () => {
  const urls: string[] = [];
  const context = {
    fetcher: {
      async fetch(url: string) {
        urls.push(url);
        return "";
      },
    },
  } as ScrapingContext;

  await fetchContinenciaEquivalenciaIndex({}, context);
  await fetchContinenciaEquivalenciaIndex(
    { url: "https://example.test/continencias" },
    context,
  );

  assert.deepEqual(urls, [
    "https://www.dac.unicamp.br/portal/continencias",
    "https://example.test/continencias",
  ]);
});

test("índice extrai iniciais e URLs de continência", () => {
  const page = parseContinenciaEquivalenciaIndex(
    `<div id="iniciais">
      <a href="/portal/continencias/A">A</a>
      <a href="https://example.test/continencias/M">M</a>
    </div>`,
    { url: "https://www.dac.unicamp.br/portal/continencias" },
  );

  assert.deepEqual(page, {
    sourceUrl: "https://www.dac.unicamp.br/portal/continencias",
    initials: [
      {
        initial: "A",
        url: "https://www.dac.unicamp.br/portal/continencias/A",
      },
      { initial: "M", url: "https://example.test/continencias/M" },
    ],
  });
});

test("página de inicial extrai alternativas e grupos cumulativos", () => {
  const page = parseContinenciaEquivalenciaInitial(
    `<div class="row">
      <div class="col-sm-2 disciplina"><a name="QF530">QF530</a></div>
      <div class="col-sm-10 continencia">
        <a>QF536</a><a>QF636</a> / <a>QF536</a><a>QF637</a>
      </div>
    </div>
    <div class="row">
      <div class="col-sm-2 disciplina"><a name="M 513">M 513</a></div>
      <div class="col-sm-10 continencia"><a>EA770</a></div>
    </div>`,
    { initial: "Q", url: "https://example.test/continencias/Q" },
  );

  assert.deepEqual(page.relations, [
    {
      targetCode: "QF530",
      groups: [
        { sourceCodes: ["QF536", "QF636"] },
        { sourceCodes: ["QF536", "QF637"] },
      ],
    },
    {
      targetCode: "M513",
      groups: [{ sourceCodes: ["EA770"] }],
    },
  ]);
});

test("página de inicial registra relações inválidas sem descartar as válidas", () => {
  const issues: Array<Record<string, unknown>> = [];
  const page = parseContinenciaEquivalenciaInitial(
    `<div class="row">
      <div class="disciplina"><a name="MC102">MC102</a></div>
      <div class="continencia"><a>MC101</a></div>
    </div>
    <div class="row">
      <div class="disciplina"><a name="MC103">MC103</a></div>
      <div class="continencia"></div>
    </div>`,
    { initial: "M", url: "https://example.test/continencias/M" },
    {
      info() {},
      issue(issue) {
        issues.push(issue);
      },
    },
  );

  assert.deepEqual(page.relations, [
    {
      targetCode: "MC102",
      groups: [{ sourceCodes: ["MC101"] }],
    },
  ]);
  assert.equal(issues[0]?.code, "unrecognized-content");
});
