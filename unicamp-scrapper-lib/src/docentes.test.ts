import assert from "node:assert/strict";
import test from "node:test";
import {
  crawlDocentes,
  docentesPortalUrl,
  parseDocentesListPage,
  parseProfessorProfile,
} from "./docentes.js";
import { createScrapingContext, type ScrapingContext } from "./core.js";

test("extrai perfis e próxima página da listagem", () => {
  const page = parseDocentesListPage(`
    <article class="views-row">
      <a href="/perfil?docente=54828"><h3>CARLOS ARTURO LEVI DANCONA</h3></a>
    </article>
    <article class="views-row">
      <a href="/perfil?docente=300834"><h3>MARCIA RODRIGUES DE SOUZA MENDONCA</h3></a>
    </article>
    <a href="/docentes?pagina=1">1</a>
    <a href="/docentes?pagina=2">2</a>
    <a href="/docentes?pagina=3">3</a>
  `, { url: docentesPortalUrl });

  assert.deepEqual(page.entries, [
    {
      portalId: 54828,
      name: "CARLOS ARTURO LEVI DANCONA",
      url: "https://portal.dados.unicamp.br/perfil?docente=54828",
    },
    {
      portalId: 300834,
      name: "MARCIA RODRIGUES DE SOUZA MENDONCA",
      url: "https://portal.dados.unicamp.br/perfil?docente=300834",
    },
  ]);
  assert.equal(page.nextUrl, "https://portal.dados.unicamp.br/docentes?pagina=2");
});

test("preserva dados do perfil, identificadores e frequências", () => {
  const profile = parseProfessorProfile(`
    <main>
      <h1>CARLOS ARTURO LEVI DANCONA</h1>
      <div class="position">MS6 - Professor Titular</div>
      <div class="unit">FCM - FACULDADE DE CIENCIAS MEDICAS</div>
      <div class="department">DEPARTAMENTO DE CIRURGIA</div>
      <ul class="citations"><li>D'ANCONA, Carlos Arturo Levi</li></ul>
      <div class="lattes-abstract">Resumo do currículo.</div>
      <ul class="keywords"><li data-count="12">Urologia</li><li data-count="3">Urodinâmica</li></ul>
      <ul class="coauthors"><li><span class="name">Maria Silva</span><span class="count">4</span></li></ul>
      <table class="training"><tr><td>1989 - 1989</td><td>Doutorado</td><td>UNICAMP</td></tr></table>
    </main>
    <p>ORCID: https://orcid.org/0000-0002-5821-0292</p>
    <p>Lattes: http://lattes.cnpq.br/5061330474201297</p>
  `, { portalId: 54828 });

  assert.equal(profile.portalId, 54828);
  assert.equal(profile.position, "MS6 - Professor Titular");
  assert.deepEqual(profile.unit, {
    code: "FCM",
    name: "FCM - FACULDADE DE CIENCIAS MEDICAS",
  });
  assert.deepEqual(profile.keywords, [
    { name: "Urologia", count: 12 },
    { name: "Urodinâmica", count: 3 },
  ]);
  assert.deepEqual(profile.coauthors, [{ name: "Maria Silva", count: 4 }]);
  assert.deepEqual(profile.identifiers, [
    { system: "LATTES", externalId: "5061330474201297" },
    { system: "ORCID", externalId: "0000-0002-5821-0292" },
  ]);
});

test("ignora script sem fechamento antes de construir o perfil", () => {
  const profile = parseProfessorProfile(
    `<h1>PERFIL</h1><script>${"x".repeat(1_000_000)}`,
    { portalId: 9 },
  );
  assert.equal(profile.name, "PERFIL");
  assert.deepEqual(profile.identifiers, []);
});

test("usa o parser incremental para perfis grandes", () => {
  const profile = parseProfessorProfile(
    `<h1>PERFIL GRANDE</h1><div class="position">MS6 - Professor Titular</div><div>${"x".repeat(5 * 1024 * 1024)}</div><p>ORCID: https://orcid.org/0000-0002-5821-0292</p>`,
    { portalId: 10 },
  );
  assert.equal(profile.name, "PERFIL GRANDE");
  assert.equal(profile.position, "MS6 - Professor Titular");
  assert.deepEqual(profile.identifiers, [
    { system: "ORCID", externalId: "0000-0002-5821-0292" },
  ]);
});

test("não confunde texto biográfico com unidade ou identificador FAPESP", () => {
  const profile = parseProfessorProfile(`
    <main>
      <h1>IZAEL GRESSONI JUNIOR</h1>
      <div class="unit"><span>FEA - FACULDADE DE ENGENHARIA DE ALIMENTOS</span></div>
      <div class="unit"><p>Possui graduação em Engenharia de Alimentos pela Universidade Estadual de Campinas (1998) e mestrado em Ciência de Alimentos pela Universidade Estadual de Campinas (2002). Atualmente é Professor do Magistério Secundário Técnico.</p></div>
      <p>FAPESP: Apoio institucional.</p>
    </main>
  `, { portalId: 308486 });
  assert.deepEqual(profile.unit, {
    code: "FEA",
    name: "FEA - FACULDADE DE ENGENHARIA DE ALIMENTOS",
  });
  assert.deepEqual(profile.identifiers, []);
});

test("normaliza formações e ignora resíduos do HTML", () => {
  const profile = parseProfessorProfile(`
    <div id="prf-formacao"><div class="profile-section-content">
      <div>1993.0 - 1995 &nbsp;&nbsp; Pós-Doutor(a), Universidade Estadual de Campinas</div>
      <div>2000 - 2004 Doutor(a), Universidade de São Paulo</div>
      <div>2002 - 2002 Mestre, Universidade Estadual de Campinas</div>
      <div>200 - 2004 Doutor(a), Universidade de São Paulo</div>
    </div></div>
  `, { portalId: 308486 });
  assert.deepEqual(profile.latestTraining, [
    { startYear: 1993, endYear: 1995, degree: "Pós-Doutorado", institution: "Universidade Estadual de Campinas" },
    { startYear: 2000, endYear: 2004, degree: "Doutorado", institution: "Universidade de São Paulo" },
    { startYear: 2002, endYear: 2002, degree: "Mestrado", institution: "Universidade Estadual de Campinas" },
  ]);
});

test("agrega páginas e não repete o mesmo perfil", async () => {
  const first = docentesPortalUrl;
  const second = "https://portal.dados.unicamp.br/docentes?pagina=2";
  const context = createScrapingContext({
    async fetch(url) {
      if (url === first)
        return `<article class="views-row"><a href="/perfil?docente=1"><h3>A</h3></a></article><a href="${second}">&gt;</a>`;
      if (url === second)
        return `<article class="views-row"><a href="/perfil?docente=1"><h3>A</h3></a><a href="/perfil?docente=2"><h3>B</h3></a>`;
      return `<h1>Perfil</h1>`;
    },
  } as ScrapingContext);

  const result = await crawlDocentes({}, context);
  assert.deepEqual(result.data.map((item) => item.portalId), [1, 2]);
  assert.equal(result.issues.length, 0);
});

test("permite consumir perfis incrementalmente sem acumular o resultado", async () => {
  const records: number[] = [];
  const context = createScrapingContext({
    async fetch(url) {
      if (url === docentesPortalUrl)
        return `<article class="views-row"><a href="/perfil?docente=7"><h3>A</h3></a></article>`;
      return `<h1>Perfil</h1>`;
    },
  } as ScrapingContext);

  const result = await crawlDocentes({ onRecord: (record) => records.push(record.portalId) }, context);
  assert.deepEqual(records, [7]);
  assert.deepEqual(result.data, []);
});
