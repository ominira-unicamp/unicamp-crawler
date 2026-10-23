import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogDirectory,
  crawlCatalogoDisciplinas,
  crawlCatalogProgramsSnapshot,
  parseCatalogoProgramaHistoricoDetalhes,
  catalogProgramsUrl,
  parseCatalogoDisciplinasPrefixo,
  parseCatalogoProgramas,
  parseCatalogoProgramasHistoricos,
  parseCatalogosIndice,
  parseCurriculoEspecializacoes,
  parseCursoCurriculo,
  parseCursoInformacoes,
  parseCursoSugestao,
  resolveInformationSpecializations,
  structureCursoInformacoes,
  validateCursoInformacoes,
} from "./catalogos.js";
import { createScrapingContext, type ScrapeReporter } from "./core.js";

test("página histórica descobre os links de currículo e sugestão", () => {
  const page = parseCatalogoProgramaHistoricoDetalhes(
    `<a href="cpl34.html">Currículo Pleno</a>
     <a href="sug34.html">Sugestões de Currículo</a>
     <p><b>Período:</b> Integral</p>`,
    {
      programCode: 34,
      name: "Engenharia de Computação",
      url: "https://example.test/catalogo98/cursos/cur34.html",
    },
  );

  assert.equal(
    page.curriculum?.url,
    "https://example.test/catalogo98/cursos/cpl34.html",
  );
  assert.equal(
    page.suggestion?.url,
    "https://example.test/catalogo98/cursos/sug34.html",
  );
  assert.equal(page.information.programCode, 34);
});

test("página intermediária descobre a proposta de cumprimento", () => {
  const page = parseCatalogoProgramaHistoricoDetalhes(
    `<a href="../curriculoPleno/cp34.html">Currículo Pleno</a>
     <a href="../proposta/sug34.html">Proposta para Cumprimento de Currículo</a>`,
    {
      programCode: 34,
      name: "Engenharia de Computação",
      url: "https://example.test/catalogo2020/cursos/cur34.html",
    },
  );

  assert.equal(
    page.curriculum?.url,
    "https://example.test/catalogo2020/curriculoPleno/cp34.html",
  );
  assert.equal(
    page.suggestion?.url,
    "https://example.test/catalogo2020/proposta/sug34.html",
  );
});

test("crawler intermediário normaliza disciplinas de coordenadorias", async () => {
  const indexUrl =
    "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo2020/coordenadorias.html";
  const pageUrl =
    "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo2020/coordenadorias/0023.html";
  const detailUrl =
    "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo2020/coordenadorias/0023/0023.html";
  const context = createScrapingContext({
    async fetch(url) {
      if (url === indexUrl)
        return '<a href="coordenadorias/0023.html">Comissão de Graduação do Curso de Ciência da Computação</a>';
      if (url === pageUrl)
        return '<a href="../coordenadorias/0023/0023.html#MC102">MC102 - Algoritmos</a>';
      if (url === detailUrl)
        return `<div class="ancora"><a name="MC102">MC102 - Algoritmos</a></div>
          <p>OF:S-1 T:004 P:000 L:002 O:000 D:000 HS:006 SL:006 C:006 AV:N EX:S FM:75%<br><strong>Pré-Req.:</strong> Não há</p>
          <div class="justificado"><strong>Ementa:</strong> Algoritmos.</div>`;
      throw new Error(`Página não prevista: ${url}`);
    },
  });

  const result = await crawlCatalogoDisciplinas(
    { firstYear: 2020, lastYear: 2020 },
    context,
  );

  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.data.catalogs[0], {
    year: 2020,
    sourceFormat: "LEGACY_INTERMEDIATE",
    sourceUrl: indexUrl,
    courses: [
      {
        code: "MC102",
        name: "Algoritmos",
        coordinator:
          "Comissão de Graduação do Curso de Ciência da Computação",
        workload: {
          theoreticalHours: 60,
          practicalHours: 0,
          laboratoryHours: 30,
          guidedActivityHours: 0,
          distanceHours: 0,
          guidedExtensionHours: null,
          practicalExtensionHours: null,
          weeks: 15,
          weeklyClassHours: 6,
          classroomHours: 90,
        },
        credits: 6,
        offeringPeriod: "ODD_PERIODS",
        evaluation: "GRADE_AND_ATTENDANCE",
        finalExam: true,
        minimumAttendancePercent: 75,
        prerequisites: { raw: "Não há", any: [] },
        syllabus: "Algoritmos.",
        bibliography: null,
        sourceUrl: detailUrl,
      },
    ],
  });
});

test("crawler clássico descobre páginas de ementa pelos currículos", async () => {
  const base = "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo98";
  const context = createScrapingContext({
    async fetch(url) {
      if (url === `${base}/cursos.html`)
        return '<a href="cursos/cur34.html">34 - Computação - Integral</a>';
      if (url === `${base}/cursos/cur34.html`)
        return '<a href="cpl34.html">Currículo Pleno</a><a href="sug34.html">Sugestões de Currículo</a>';
      if (url === `${base}/cursos/cpl34.html`)
        return '<a href="../ementas/todasmc.html#mc102">MC102</a>';
      if (url === `${base}/ementas/todasmc.html`)
        return `<div align="right"><a name="mc102">MC102 Algoritmos</a></div>
          <font>OF:S-5 T:004 P:000 L:002 HS:006 SL:006 C:006</font>
          <br><font><strong>Pré-Req.:</strong> Não há</font>
          <br><font><strong>Ementa:</strong> Algoritmos.</font>`;
      throw new Error(`Página não prevista: ${url}`);
    },
  });

  const result = await crawlCatalogoDisciplinas(
    { firstYear: 1998, lastYear: 1998 },
    context,
  );

  assert.deepEqual(result.issues, []);
  assert.equal(result.data.catalogs[0]?.sourceFormat, "LEGACY_CLASSIC");
  assert.deepEqual(
    result.data.catalogs[0]?.courses.map(({ code, offeringPeriod }) => ({
      code,
      offeringPeriod,
    })),
    [{ code: "MC102", offeringPeriod: "ALL_PERIODS" }],
  );
});

test("página histórica sem sugestão registra falha bloqueante", () => {
  const issues: Array<Record<string, unknown>> = [];
  const page = parseCatalogoProgramaHistoricoDetalhes(
    '<a href="cpl34.html">Currículo Pleno</a>',
    {
      programCode: 34,
      name: "Engenharia de Computação",
      url: "https://example.test/catalogo98/cursos/cur34.html",
    },
    {
      info() {},
      issue(issue) {
        issues.push(issue);
      },
    },
  );

  assert.equal(page.suggestion, null);
  assert.deepEqual(
    issues.map(({ code, path }) => ({ code, path })),
    [{ code: "missing-required-section", path: "suggestion" }],
  );
});

test("snapshot histórico complete só marca componentes completos com as quatro coletas", async () => {
  const pages = new Map([
    [
      "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo2020/cursos.html",
      '<a href="cursos/cur34.html">34 - Engenharia de Computação - Integral</a>',
    ],
    [
      "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo2020/cursos/cur34.html",
      `<a href="cpl34.html">Currículo Pleno</a>
       <a href="sug34.html">Sugestões de Currículo</a>
       <section class="main-section">
         <h1>Curso 34</h1><h2>Turno</h2><p>Integral</p>
         <h2>Limite de Créditos para Matrícula Semestral</h2><p>Máximo de 30 créditos por Período Letivo</p>
         <h2>Integralização</h2><p>Para graduar-se neste curso, o aluno deverá obter o total de 240 créditos, correspondentes a 3600 horas de atividades supervisionadas, que poderão ser integralizadas em 10 semestres, sendo o prazo máximo de integralização 16 semestres.</p>
         <h2>O Profissional</h2><p>Texto profissional.</p>
         <h2>Reconhecimento</h2><p>Processo de Reconhecimento em Tramitação.</p>
       </section>`,
    ],
    [
      "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo2020/cursos/cpl34.html",
      "<h3>Núcleo Comum</h3><table><tr><td><a>MC102</a></td></tr></table>",
    ],
    [
      "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo2020/cursos/sug34.html",
      "<h2>AA - Padrão</h2><h3>1º Semestre - 20 créditos</h3><p><a>MC102 (6)</a></p>",
    ],
  ]);
  const context = createScrapingContext({
    async fetch(url) {
      const page = pages.get(url);
      if (!page) throw new Error(`Página não prevista: ${url}`);
      return page;
    },
  });

  const result = await crawlCatalogProgramsSnapshot(
    { year: 2020, profile: "complete" },
    context,
  );

  assert.deepEqual(result.data.componentStatuses, {
    programs: "COMPLETE",
    curricula: "COMPLETE",
    information: "COMPLETE",
    suggestions: "COMPLETE",
  });
  assert.deepEqual(result.issues, []);
});

test("página de programas cria referências para páginas filhas", () => {
  const page = parseCatalogoProgramas(
    '<li><a class="rotulo-curso">34 - Ciência da Computação - Integral</a><a href="cursos/ciencia/curriculo.html">Currículo Pleno</a></li>',
    { year: 2026 },
  );

  assert.equal(
    page.programs[0].curriculum.url.endsWith("curriculo.html"),
    true,
  );
  assert.equal(page.programs[0].members.url.endsWith("membros.html"), true);
  assert.equal(page.programs[0].suggestion.url.endsWith("sugestao.html"), true);
});

test("resolve diretórios históricos de 1998 e 1999", () => {
  assert.equal(catalogDirectory(1998), "catalogo98");
  assert.equal(catalogDirectory(1999), "catalogo99");
  assert.equal(catalogDirectory(2000), "catalogo2000");
  assert.equal(
    catalogProgramsUrl(1998),
    "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo98/cursos.html",
  );
});

test("índice reconhece catálogos históricos com ano abreviado", () => {
  assert.deepEqual(
    parseCatalogosIndice(
      '<a href="catalogo98/cursos.html">1998</a><a href="catalogo1999/cursos.html">1999</a><a href="catalogo2026/index.html">2026</a>',
    ).years,
    [1998, 1999, 2026],
  );
});

test("extrai programas do catálogo clássico pela URL", () => {
  const page = parseCatalogoProgramasHistoricos(
    `<font>37 - <a href="cursos/cur37.html">Curso Superior de Tecnologia da Construção Civil - Noturno</a></font>
     <font>52 - <a href="cursos/cur52.html">Ciência da Terra - Diurno</a></font>`,
    { year: 1998 },
  );

  assert.equal(page.layout, "LEGACY_CLASSIC");
  assert.deepEqual(page.programs, [
    {
      code: 37,
      name: "Curso Superior de Tecnologia da Construção Civil",
      shift: "NIGHT",
      sourceUrl:
        "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo98/cursos/cur37.html",
    },
    {
      code: 52,
      name: "Ciência da Terra",
      shift: "DAYTIME",
      sourceUrl:
        "https://www.dac.unicamp.br/sistemas/catalogos/grad/catalogo98/cursos/cur52.html",
    },
  ]);
});

test("extrai programas do catálogo intermediário e normaliza o turno", () => {
  const page = parseCatalogoProgramasHistoricos(
    `<span>73 </span><a href='cursos/cur73.html'>Curso Superior de Tecnologia em Saneamento Ambiental - Integral</a>
     <span>83 </span><a href='cursos/cur83.html'>Curso Superior de Tecnologia em Construção de Edifícios - Noturno</a>`,
    { year: 2020 },
  );

  assert.equal(page.layout, "LEGACY_INTERMEDIATE");
  assert.deepEqual(
    page.programs.map(({ code, name, shift }) => ({ code, name, shift })),
    [
      {
        code: 73,
        name: "Curso Superior de Tecnologia em Saneamento Ambiental",
        shift: "DAYTIME",
      },
      {
        code: 83,
        name: "Curso Superior de Tecnologia em Construção de Edifícios",
        shift: "NIGHT",
      },
    ],
  );
});

test("registra conflito de descrição para o mesmo código histórico", () => {
  const issues: Array<Record<string, unknown>> = [];
  const page = parseCatalogoProgramasHistoricos(
    `<a href="cursos/cur73.html">Controle Ambiental - Integral</a>
     <a href="cursos/cur73.html">Saneamento Ambiental - Integral</a>`,
    { year: 2018 },
    {
      info() {},
      issue(issue) {
        issues.push(issue);
      },
    },
  );

  assert.equal(page.programs.length, 1);
  assert.deepEqual(
    issues.map(({ code }) => code),
    ["invalid-value"],
  );
});

test("página de prefixo extrai disciplina e créditos", () => {
  const page = parseCatalogoDisciplinasPrefixo(
    `<h1>Disciplinas MC</h1>
      <h2 id="disc-mc102">MC102 - Algoritmos</h2>
      <h3>Carga Horária</h3>
      <p>Total de Horas de Atividades Teóricas: 60</p>
      <p>Total de Horas de Atividades Práticas: 0</p>
      <p>Total de Créditos: 6</p>
      <h3>Pré-requisitos</h3>
      <p>MC101 ou MC100+AA200</p>
      <h3>Bibliografia</h3>
      <p>Não há.</p>`,
    { year: 2026, prefix: "MC", url: "https://example.test/mc" },
  );

  assert.equal(page.title, "Disciplinas MC");
  assert.equal(page.courses[0].credits, 6);
  assert.equal(page.courses[0].workload.theoreticalHours, 60);
  assert.equal(page.courses[0].workload.practicalHours, 0);
  assert.deepEqual(page.courses[0].prerequisites, {
    raw: "MC101 ou MC100+AA200",
    any: [
      { all: [{ type: "course", code: "MC101", fulfillment: "FULL" }] },
      {
        all: [
          { type: "course", code: "MC100", fulfillment: "FULL" },
          { type: "authorization" },
        ],
      },
    ],
  });
  assert.equal(page.courses[0].bibliography, null);
  assert.equal(page.courses[0].rawSections.length, 3);
});

test("página de prefixo preserva o espaço significativo dos códigos de Física", () => {
  const page = parseCatalogoDisciplinasPrefixo(
    `<h1>Disciplinas F</h1>
      <h2 id="disc-f328">F 328 - Física Geral III</h2>
      <h3>Carga Horária</h3><p>Total de Créditos: 4</p>
      <h3>Pré-requisitos</h3><p>F 128 ou MA111</p>`,
    { year: 2026, prefix: "F", url: "https://example.test/f" },
  );

  assert.equal(page.courses[0].code, "F 328");
  assert.deepEqual(page.courses[0].prerequisites.any, [
    { all: [{ type: "course", code: "F 128", fulfillment: "FULL" }] },
    { all: [{ type: "course", code: "MA111", fulfillment: "FULL" }] },
  ]);
});

test("página de prefixo preserva bibliografia plaintext e campos ausentes", () => {
  const page = parseCatalogoDisciplinasPrefixo(
    `<h2 id="disc-mc404">MC404 - Sistemas</h2>
      <h3>Bibliografia</h3>
      <p>Autor Um. Livro A, Editora, 2024.</p>
      <p>Autor Dois. Livro B, Editora, 2020.</p>`,
    { year: 2026, prefix: "MC", url: "https://example.test/mc" },
  );

  assert.equal(
    page.courses[0].bibliography,
    "Autor Um. Livro A, Editora, 2024.\nAutor Dois. Livro B, Editora, 2020.",
  );
  assert.equal(page.courses[0].coordinator, null);
  assert.equal(page.courses[0].prerequisites.raw, null);
  assert.deepEqual(page.courses[0].prerequisites.any, []);
});

test("aceita dois-pontos no título da seção", () => {
  const issues: Array<Record<string, unknown>> = [];
  const page = parseCatalogoDisciplinasPrefixo(
    `<h1>Disciplinas MC</h1><h2 id="disc-mc001">MC001 - Introdução</h2>
      <h3>Frequência Mínima:</h3><p>75%</p>`,
    { year: 2026, prefix: "MC", url: "https://example.test/mc" },
    {
      info() {},
      issue(issue) {
        issues.push(issue);
      },
    },
  );

  assert.equal(page.courses[0].minimumAttendancePercent, 75);
  assert.deepEqual(issues, []);
});

test("parser registra informações normais e issues de conteúdo inesperado", () => {
  const infos: Array<Record<string, unknown>> = [];
  const issues: Array<Record<string, unknown>> = [];
  const reporter: ScrapeReporter = {
    info(fields) {
      infos.push(fields);
    },
    issue(issue) {
      issues.push(issue);
    },
  };

  parseCatalogoDisciplinasPrefixo(
    `<h1>Disciplinas MC</h1>
      <h2 id="disc-mc404">MC404 - Sistemas</h2>
      <h3>Carga Horária</h3>
      <p>Total de Créditos: desconhecido</p>
      <h3>Exame Final de Avaliação</h3>
      <p>Talvez</p>
      <h3>Seção Nova</h3>
      <p>Conteúdo adicional</p>`,
    { year: 2026, prefix: "MC", url: "https://example.test/mc" },
    reporter,
  );

  assert.equal(infos.length, 2);
  assert.equal(infos[0].event, "scrape.discipline.parse-mode");
  assert.equal(infos[1].event, "scrape.disciplines.parsed");
  assert.deepEqual(
    issues.map((issue) => issue.code),
    ["unexpected-section", "invalid-format", "invalid-value"],
  );
});

test("separa métricas concatenadas e não confunde rótulos de extensão", () => {
  const issues: Array<Record<string, unknown>> = [];
  const page = parseCatalogoDisciplinasPrefixo(
    `<h1>Disciplinas MC</h1>
      <h2 id="disc-mc051">MC051 - Disciplina</h2>
      <h3>Carga Horária</h3>
      <p>Total de Horas de Atividades Orientadas: 0 Total de Horas de Atividades Orientadas de Extensão: 0 Total de Horas de Atividades Práticas de Extensão: 0 Número de Semanas: 15 Total de Horas/Aula Semanais: 8 Total de Horas/Aula Realizadas em Sala de Aula: 0 Total de Créditos: 8</p>`,
    { year: 2026, prefix: "MC", url: "https://example.test/mc" },
    {
      info() {},
      issue(issue) {
        issues.push(issue);
      },
    },
  );

  assert.equal(page.courses[0].workload.guidedActivityHours, 0);
  assert.equal(page.courses[0].workload.guidedExtensionHours, 0);
  assert.equal(page.courses[0].workload.practicalExtensionHours, 0);
  assert.equal(page.courses[0].workload.weeks, 15);
  assert.equal(page.courses[0].workload.weeklyClassHours, 8);
  assert.equal(page.courses[0].workload.classroomHours, 0);
  assert.equal(page.courses[0].credits, 8);
  assert.deepEqual(issues, []);
});

test("extrai disciplina pelo markup estruturado do catálogo", () => {
  const issues: Array<Record<string, unknown>> = [];
  const page = parseCatalogoDisciplinasPrefixo(
    `<h1>Disciplinas MC</h1><div class="row"><div class="small-12 columns pad-content">
      <h2 id="disc-mc202">MC202 - Estruturas de Dados</h2>
      <h3>Coordenadoria</h3><p>Comissão de Graduação</p>
      <h3>Carga Horária</h3><p>
        <strong>Total de Horas de Atividades Teóricas:</strong> 60 <br>
        <strong>Total de Horas de Atividades Práticas:</strong> 0 <br>
        <strong>Total de Horas de Laboratório:</strong> 30 <br>
        <strong>Total de Horas de Atividades Orientadas:</strong> 0 <br>
        <strong>Total de Horas de Atividades à Distância:</strong> 0 <br>
        <strong>Total de Horas de Atividades Orientadas de Extensão:</strong> 0 <br>
        <strong>Total de Horas de Atividades Práticas de Extensão:</strong> 0 <br>
        <strong>Número de Semanas:</strong> 15 <br>
        <strong>Total de Horas/Aula Semanais:</strong> 6 <br>
        <strong>Total de Horas/Aula Realizadas em Sala de Aula:</strong> 90 <br>
        <strong>Total de Créditos:</strong> 6 <br>
      </p>
      <h3>Período de Oferecimento</h3><p>Todos os períodos</p>
      <h3>Avaliação</h3><p>Nota e Frequência</p>
      <h3>Exame Final de Avaliação</h3><p>Sim</p>
      <h3>Frequência Mínima</h3><p>75%</p>
      <h3>Pré-requisitos</h3><p>MC102</p>
      <h3>Ementa</h3><div class="long-text"><p>Estruturas básicas.</p></div>
      <h3>Bibliografia</h3><div class="long-text"><p>Autor. Livro, 2024.</p></div>
    </div></div>`,
    { year: 2026, prefix: "MC", url: "https://example.test/mc" },
    {
      info() {},
      issue(issue) {
        issues.push(issue);
      },
    },
  );

  assert.deepEqual(page.courses[0], {
    code: "MC202",
    name: "Estruturas de Dados",
    coordinator: "Comissão de Graduação",
    workload: {
      theoreticalHours: 60,
      practicalHours: 0,
      laboratoryHours: 30,
      guidedActivityHours: 0,
      distanceHours: 0,
      guidedExtensionHours: 0,
      practicalExtensionHours: 0,
      weeks: 15,
      weeklyClassHours: 6,
      classroomHours: 90,
    },
    credits: 6,
    offeringPeriod: "ALL_PERIODS",
    evaluation: "GRADE_AND_ATTENDANCE",
    finalExam: true,
    minimumAttendancePercent: 75,
    prerequisites: {
      raw: "MC102",
      any: [{ all: [{ type: "course", code: "MC102", fulfillment: "FULL" }] }],
    },
    syllabus: "Estruturas básicas.",
    bibliography: "Autor. Livro, 2024.",
    sourceUrl: "https://example.test/mc",
    rawSections: [
      { heading: "Coordenadoria", text: "Comissão de Graduação" },
      {
        heading: "Carga Horária",
        text: "Total de Horas de Atividades Teóricas: 60 Total de Horas de Atividades Práticas: 0 Total de Horas de Laboratório: 30 Total de Horas de Atividades Orientadas: 0 Total de Horas de Atividades à Distância: 0 Total de Horas de Atividades Orientadas de Extensão: 0 Total de Horas de Atividades Práticas de Extensão: 0 Número de Semanas: 15 Total de Horas/Aula Semanais: 6 Total de Horas/Aula Realizadas em Sala de Aula: 90 Total de Créditos: 6",
      },
      { heading: "Período de Oferecimento", text: "Todos os períodos" },
      { heading: "Avaliação", text: "Nota e Frequência" },
      { heading: "Exame Final de Avaliação", text: "Sim" },
      { heading: "Frequência Mínima", text: "75%" },
      { heading: "Pré-requisitos", text: "MC102" },
      { heading: "Ementa", text: "Estruturas básicas." },
      { heading: "Bibliografia", text: "Autor. Livro, 2024." },
    ],
  });
  assert.deepEqual(issues, []);
});

test("registra métrica desconhecida sem perder a disciplina", () => {
  const issues: Array<Record<string, unknown>> = [];
  const page = parseCatalogoDisciplinasPrefixo(
    `<h1>Disciplinas MC</h1><div class="pad-content">
      <h2 id="disc-mc999">MC999 - Nova</h2><h3>Carga Horária</h3><p>
        <strong>Total de Horas de Atividades Teóricas:</strong> 1 <br>
        <strong>Total de Horas de Atividades Remotas:</strong> 2 <br>
      </p></div>`,
    { year: 2026, prefix: "MC", url: "https://example.test/mc" },
    {
      info() {},
      issue(issue) {
        issues.push(issue);
      },
    },
  );

  assert.equal(page.courses[0].workload.theoreticalHours, 1);
  assert.deepEqual(
    issues.map((issue) => issue.code),
    ["unrecognized-content"],
  );
  assert.deepEqual(issues[0].actual, {
    label: "Total de Horas de Atividades Remotas",
    value: "2",
  });
});

test("página de sugestão extrai semestres e disciplinas", () => {
  const page = parseCursoSugestao(
    "<h2>AA - Padrão</h2><h3>1º Semestre - 20 créditos</h3><p><a>MC102 (6)</a> 14 créditos eletivos</p>",
    {
      programCode: 34,
      name: "Ciência",
      url: "https://example.test/sugestao.html",
    },
  );

  assert.deepEqual(page.suggestions[0], {
    code: "AA",
    name: "Padrão",
    semesters: [
      {
        semester: 1,
        credits: 20,
        electiveCredits: 14,
        courses: [{ code: "MC102", credits: 6 }],
      },
    ],
  });
});

test("página intermediária de proposta extrai semestres em texto solto", () => {
  const page = parseCursoSugestao(
    `<h1>AA - Sistemas de Computação</h1>
     01° Semestre : 28 Créditos<br>
     <a>F 128(04)</a> <a>MC102(06)</a> 18 créditos eletivos<br><br>
     02° Semestre : 24 Créditos<br><a>MC202(04)</a>`,
    {
      programCode: 34,
      name: "Engenharia de Computação",
      url: "https://example.test/proposta/sug34.html",
    },
  );

  assert.deepEqual(page.suggestions, [
    {
      code: "AA",
      name: "Sistemas de Computação",
      semesters: [
        {
          semester: 1,
          credits: 28,
          electiveCredits: 18,
          courses: [
            { code: "F 128", credits: 4 },
            { code: "MC102", credits: 6 },
          ],
        },
        {
          semester: 2,
          credits: 24,
          electiveCredits: 0,
          courses: [{ code: "MC202", credits: 4 }],
        },
      ],
    },
  ]);
});

test("página clássica de sugestão extrai tabelas por semestre", () => {
  const page = parseCursoSugestao(
    `<p><b>AA - Bacharelado em Física</b></p>
     <p><b>01º Semestre: 21 Créditos</b></p>
     <center><table><tr><td><a>F 128</a> (04)</td><td><a>MA141</a> (04)</td></tr></table></center>
     <p><b>02º Semestre: 22 Créditos</b></p>
     <center><table><tr><td><a>F 218</a> (04)</td><td>ELET.(04)</td></tr></table></center>`,
    {
      programCode: 4,
      name: "Física",
      url: "https://example.test/catalogo98/cursos/sug04.html",
    },
  );

  assert.deepEqual(page.suggestions, [
    {
      code: "AA",
      name: "Bacharelado em Física",
      semesters: [
        {
          semester: 1,
          credits: 21,
          electiveCredits: 0,
          courses: [
            { code: "F 128", credits: 4 },
            { code: "MA141", credits: 4 },
          ],
        },
        {
          semester: 2,
          credits: 22,
          electiveCredits: 4,
          courses: [{ code: "F 218", credits: 4 }],
        },
      ],
    },
  ]);
});

test("página clássica sem modalidade cria sugestão geral", () => {
  const page = parseCursoSugestao(
    `<p><b>01º Semestre: 22 Créditos</b></p>
     <center><table><tr><td><a>MA111</a> (06)</td><td>ELET.(04)</td></tr></table></center>`,
    {
      programCode: 2,
      name: "Estatística",
      url: "https://example.test/catalogo98/cursos/sug02.html",
    },
  );

  assert.deepEqual(page.suggestions, [
    {
      code: "2",
      name: "Estatística",
      semesters: [
        {
          semester: 1,
          credits: 22,
          electiveCredits: 4,
          courses: [{ code: "MA111", credits: 6 }],
        },
      ],
    },
  ]);
});

test("currículo clássico extrai núcleo comum e disciplinas eletivas", () => {
  const page = parseCursoCurriculo(
    `<p><b>Núcleo Comum ao Curso:</b></p>
     <table><tr><td><a>F 128</a> Física Geral I</td></tr></table>
     <p><b>AA - Bacharelado em Física</b></p>
     <table><tr><td><a>F 540</a> Métodos da Física Experimental I</td></tr></table>
     <p><b>Disciplinas Eletivas</b></p><p>14 créditos dentre:</p>
     <table><tr><td>----- Qualquer disciplina da UNICAMP</td></tr></table>`,
    {
      programCode: 4,
      name: "Física",
      url: "https://example.test/catalogo98/cursos/cpl04.html",
    },
  );

  assert.deepEqual(page.blocks, [
    {
      type: "mandatory",
      credits: null,
      requirements: [{ type: "specific", code: "F 128" }],
    },
  ]);
  assert.deepEqual(page.specializations, [
    {
      code: "AA",
      name: "Bacharelado em Física",
      blocks: [
        {
          type: "mandatory",
          credits: null,
          requirements: [{ type: "specific", code: "F 540" }],
        },
        {
          type: "elective",
          credits: 14,
          requirements: [{ type: "any" }],
        },
      ],
    },
  ]);
});

test("currículo clássico limita o nome da especialização ao título enfatizado", () => {
  const page = parseCursoCurriculo(
    `<p><b>AD - Instrumento - Trompete</b><br>Além do núcleo comum, o aluno deverá cumprir:</p>
     <table><tr><td><a>MU105</a></td></tr></table>`,
    {
      programCode: 22,
      name: "Música",
      url: "https://example.test/catalogo98/cursos/cpl22.html",
    },
  );

  assert.equal(page.specializations[0]?.name, "Instrumento - Trompete");
});

test("currículo intermediário extrai blocos em divs", () => {
  const page = parseCursoCurriculo(
    `<p><strong>Núcleo Comum ao Curso:</strong></p>
     <div class="div100"><div><a>MC102</a> Algoritmos</div></div>
     <strong>AA - Sistemas de Computação</strong><br>
     <strong>Além do núcleo comum, o aluno deverá cumprir:</strong><br>
     <div class="div100"><div><a>MC202</a> Estruturas</div></div>
     <strong>Disciplinas Eletivas</strong><br><br>13 créditos dentre:<br>
     <div class="div100"><div><a>-----</a> Qualquer disciplina</div></div>`,
    {
      programCode: 34,
      name: "Engenharia de Computação",
      url: "https://example.test/curriculoPleno/cp34.html",
    },
  );

  assert.deepEqual(page.blocks, [
    {
      type: "mandatory",
      credits: null,
      requirements: [{ type: "specific", code: "MC102" }],
    },
  ]);
  assert.deepEqual(page.specializations, [
    {
      code: "AA",
      name: "Sistemas de Computação",
      blocks: [
        {
          type: "mandatory",
          credits: null,
          requirements: [{ type: "specific", code: "MC202" }],
        },
        {
          type: "elective",
          credits: 13,
          requirements: [{ type: "any" }],
        },
      ],
    },
  ]);
});

test("currículo moderno não transforma prefixos em especializações e isola créditos", () => {
  const page = parseCursoCurriculo(
    `<h2>42 - Ciência da Computação - Currículo Pleno</h2>
     <h3>Núcleo Comum ao Curso</h3>
     <table><tr><td><a>MC102</a></td></tr></table>
     <h3>Disciplinas Eletivas</h3>
     <p>Disciplinas eletivas I: O aluno deve obter 26 créditos dentre as disciplinas listadas abaixo.</p>
     <table><tr><td><a>-----</a></td></tr></table>
     <p>Disciplinas eletivas II: O aluno deve obter 12 créditos dentre as disciplinas listadas abaixo.</p>
     <table><tr><td><a>MC851</a></td></tr></table>
     <p>Disciplinas eletivas III: O aluno deve obter 10 créditos dentre as disciplinas listadas abaixo.</p>
     <table><tr><td><strong>EX---</strong></td><td><strong>MX---</strong></td></tr></table>`,
    {
      programCode: 42,
      name: "Ciência da Computação",
      url: "https://example.test/catalogo2026/cursos/42g/curriculo.html",
    },
  );

  assert.deepEqual(page.specializations, []);
  assert.deepEqual(
    page.blocks.filter(({ type }) => type === "elective"),
    [
      {
        type: "elective",
        credits: 26,
        requirements: [{ type: "any" }],
      },
      {
        type: "elective",
        credits: 12,
        requirements: [{ type: "specific", code: "MC851" }],
      },
      {
        type: "elective",
        credits: 10,
        requirements: [
          { type: "prefix", code: "EX" },
          { type: "prefix", code: "MX" },
        ],
      },
    ],
  );
});

test("extrator de especializações ignora requisitos por prefixo", () => {
  const page = parseCurriculoEspecializacoes(
    `<h2>AA - Sistemas de Computação</h2>
     <table><tr><td><strong>EX---</strong></td><td><strong>MX---</strong></td></tr></table>`,
    {
      programCode: 34,
      name: "Engenharia de Computação",
      url: "https://example.test/catalogo2026/cursos/34g/curriculo.html",
    },
  );

  assert.deepEqual(page.specializations, [
    { code: "AA", name: "Sistemas de Computação" },
  ]);
});

test("página de informações preserva seções e hierarquia", () => {
  const page = parseCursoInformacoes(
    `<section class="main-section">
      <div class="breadcrumbs"><li>Ignorar</li></div>
      <h1>Curso 34 - Engenharia de Computação</h1>
      <h2>Turno: Integral</h2>
      <h2>O Profissional</h2>
      <h3>AA - Sistemas de Computação</h3>
      <div class="long-text"><p>Texto profissional.</p></div>
      <h2>Limite de Créditos para Matrícula Semestral</h2>
      <p>Máximo de 30 créditos por período.</p>
    </section>`,
    {
      programCode: 34,
      name: "Engenharia de Computação",
      url: "https://example.test/cursos/34g/index.html",
    },
  );

  assert.equal(page.pageTitle, "Curso 34 - Engenharia de Computação");
  assert.deepEqual(
    page.sections.map(
      ({ level, heading, headingKey, parentHeadingKey, content }) => ({
        level,
        heading,
        headingKey,
        parentHeadingKey,
        content,
      }),
    ),
    [
      {
        level: 2,
        heading: "Turno",
        headingKey: "turno",
        parentHeadingKey: null,
        content: ["Integral"],
      },
      {
        level: 2,
        heading: "O Profissional",
        headingKey: "o-profissional",
        parentHeadingKey: null,
        content: [],
      },
      {
        level: 3,
        heading: "AA - Sistemas de Computação",
        headingKey: "aa-sistemas-de-computacao",
        parentHeadingKey: "o-profissional",
        content: ["Texto profissional."],
      },
      {
        level: 2,
        heading: "Limite de Créditos para Matrícula Semestral",
        headingKey: "limite-de-creditos-para-matricula-semestral",
        parentHeadingKey: null,
        content: ["Máximo de 30 créditos por período."],
      },
    ],
  );
});

test("página de informações projeta dados por variante e valida padrões", () => {
  const page = parseCursoInformacoes(
    `<section class="main-section">
      <h1>Curso 34 - Engenharia de Computação</h1>
      <h2>Turno: Integral</h2>
      <h2>Limite de Créditos para Matrícula Semestral</h2>
      <p>1 – Até que tenha matrícula em 30 créditos: Máximo de 30 créditos por período.</p>
      <p>2 – A partir do período seguinte em que se tenha totalizado matrícula em 30 créditos: o máximo de créditos por período será dado pela expressão: 20 + 16,0CR.</p>
      <h2>Integralização</h2>
      <h3>AA - Sistemas de Computação</h3>
      <p>Para graduar-se neste curso, o aluno deverá obter o total de 243 créditos, correspondentes a 3645 horas de atividades supervisionadas e 375 horas de atividades de extensão, que poderão ser integralizadas em 10 semestres, conforme proposta oferecida pela unidade para o cumprimento do currículo pleno, sendo o prazo máximo de integralização 16 semestres.</p>
      <h2>O Profissional</h2>
      <h3>AA - Sistemas de Computação</h3>
      <p>Texto profissional.</p>
      <h2>Reconhecimento</h2>
      <h3>AA - Sistemas de Computação</h3>
      <p>Reconhecido pela Portaria MEC n° 196 de 07/05/1984 e renovado pela Portaria CEE/GP n° 310 de 18/12/2020.</p>
      <h2>Exercício Profissional</h2>
      <p>Regulamentado por lei.</p>
    </section>`,
    {
      programCode: 34,
      name: "Engenharia de Computação",
      url: "https://example.test/cursos/34g/index.html",
    },
  );

  const information = structureCursoInformacoes(page);

  assert.deepEqual(information, {
    sourceUrl: "https://example.test/cursos/34g/index.html",
    shift: "DAYTIME",
    creditLimitType: "CR_FORMULA",
    creditLimitFixedCredits: null,
    creditLimitBeforeThresholdCredits: 30,
    creditLimitThresholdCredits: 30,
    creditLimitCrBase: 20,
    creditLimitCrMultiplier: 16,
    professionalPracticeDescription: "Regulamentado por lei.",
    variants: [
      {
        specializationCode: "AA",
        specializationName: "Sistemas de Computação",
        integralizationCredits: 243,
        integralizationSupervisedHours: 3645,
        integralizationExtensionHours: 375,
        integralizationSemesters: 10,
        integralizationMaximumSemesters: 16,
        professionalDescription: "Texto profissional.",
        recognitionDescription:
          "Reconhecido pela Portaria MEC n° 196 de 07/05/1984 e renovado pela Portaria CEE/GP n° 310 de 18/12/2020.",
      },
    ],
  });
  assert.deepEqual(validateCursoInformacoes(page, 2026), []);
});

test("informações clássicas usam o currículo pleno para resolver códigos", () => {
  const input = {
    programCode: 34,
    name: "Engenharia de Computação",
    url: "https://example.test/catalogo98/cursos/cur34.html",
  };
  const page = parseCursoInformacoes(
    `<html><body>
      <a href="cpl34.html">Currículo Pleno</a>
      <center><b>Período:</b> Integral</center>
      <p><b>O Profissional</b> Texto geral.</p>
      <p><b>Sistemas de Computação:</b> Texto da modalidade.</p>
      <p><b>Integralização</b> Sistemas de Computação 247 créditos, equivalentes a 3705 horas que poderão ser integralizadas em 10 semestres, sendo o prazo máximo de integralização 20 semestres.</p>
      <p><b>Reconhecimento</b> Reconhecido pela Portaria MEC nº 244, de 11/02/94.</p>
      <p><b>Limite de Créditos para matrícula semestral</b></p>
      <p>1 - Até que tenha matrícula em 29 créditos: Máximo de 30 créditos por período.<br>2 - A partir do período seguinte em que se tenha totalizado matrícula em 29 créditos: o máximo de créditos por período será dado pela expressão: 20 + 24 CR.</p>
    </body></html>`,
    input,
  );
  const curriculum = parseCurriculoEspecializacoes(
    "<p><b>AA - Sistemas de Computação</b></p>",
    { ...input, url: page.curriculumUrl! },
  );
  const resolved = resolveInformationSpecializations(
    page,
    1998,
    structureCursoInformacoes(page),
    curriculum.specializations,
  );

  assert.equal(
    page.curriculumUrl,
    "https://example.test/catalogo98/cursos/cpl34.html",
  );
  assert.equal(resolved.information.creditLimitType, "CR_FORMULA");
  assert.deepEqual(resolved.violations, []);
  assert.deepEqual(
    resolved.information.variants.map(
      ({ specializationCode, specializationName, integralizationCredits }) => ({
        specializationCode,
        specializationName,
        integralizationCredits,
      }),
    ),
    [
      {
        specializationCode: "AA",
        specializationName: "Sistemas de Computação",
        integralizationCredits: 247,
      },
      {
        specializationCode: null,
        specializationName: null,
        integralizationCredits: null,
      },
    ],
  );
});

test("informações clássicas associam rótulos de bacharelado à modalidade", () => {
  const input = {
    programCode: 4,
    name: "Física",
    url: "https://example.test/catalogo98/cursos/cur04.html",
  };
  const page = parseCursoInformacoes(
    `<html><body>
      <a href="cpl04.html">Currículo Pleno</a>
      <center><b>Período:</b> Integral</center>
      <p><b>O Profissional</b></p>
      <p><b>Bacharel -</b> Poderá atuar como professor universitário.</p>
      <p><b>Integralização</b></p>
      <p>Bacharelado em Física 176 créditos, equivalentes a 2640 horas que poderão ser integralizadas em 08 semestres, sendo o prazo máximo de integralização 12 semestres.</p>
      <p><b>Reconhecimento</b></p>
      <p><b>Bacharelado em Física -</b> Decreto Federal nº 072264, de 15/05/73, ratificado pela Portaria MEC nº 001790, de 22/12/93.</p>
      <p><b>Limite de Créditos para matrícula semestral</b></p>
      <p>1 - Até que tenha matrícula em 26 créditos: Máximo de 26 créditos por período.</p>
      <p>2 - A partir do período seguinte em que se tenha totalizado matrícula em 26 créditos: o máximo de créditos por período será dado pela expressão: 13 + 26 CR.</p>
    </body></html>`,
    input,
  );
  const curriculum = parseCurriculoEspecializacoes(
    "<p><b>AA - Bacharelado em Física</b></p>",
    { ...input, url: page.curriculumUrl! },
  );
  const resolved = resolveInformationSpecializations(
    page,
    1998,
    structureCursoInformacoes(page),
    curriculum.specializations,
  );

  assert.deepEqual(resolved.violations, []);
  assert.equal(resolved.information.creditLimitType, "CR_FORMULA");
  assert.deepEqual(resolved.information.variants, [
    {
      specializationCode: "AA",
      specializationName: "Bacharelado em Física",
      integralizationCredits: 176,
      integralizationSupervisedHours: 2640,
      integralizationExtensionHours: null,
      integralizationSemesters: 8,
      integralizationMaximumSemesters: 12,
      professionalDescription: "Poderá atuar como professor universitário.",
      recognitionDescription:
        "Decreto Federal nº 072264, de 15/05/73, ratificado pela Portaria MEC nº 001790, de 22/12/93.",
    },
  ]);
  assert.deepEqual(validateCursoInformacoes(page, 1998), []);
});

test("informações intermediárias separam conteúdo por habilitação", () => {
  const page = parseCursoInformacoes(
    `<div class="div100">
      <h2>Turno : Integral</h2>
      <h2>O Profissional</h2><div>Texto geral. <b>Habilitação AA - Sistemas de Computação</b>: Texto profissional.</div>
      <h2>Integralização</h2><b>AA - Sistemas de Computação</b><br><div>Para graduar-se neste curso, o aluno deverá obter o total de 240 créditos, correspondentes a 3600 horas de atividades supervisionadas, que poderão ser integralizadas em 10 semestres, sendo o prazo máximo de integralização 16 semestres.</div>
      <b><h2>Reconhecimento</h2></b><b>AA - Sistemas de Computação</b><br>Reconhecido pela Portaria Ministerial n° 244 de 11/02/1994.
      <h2>Limite de Créditos para matrícula semestral</h2>Máximo de 30 créditos por Período Letivo
    </div>`,
    {
      programCode: 34,
      name: "Engenharia de Computação",
      url: "https://example.test/catalogo2020/cursos/cur34.html",
    },
  );
  const information = structureCursoInformacoes(page);

  assert.equal(information.creditLimitType, "FIXED");
  assert.deepEqual(
    information.variants.map((variant) => [
      variant.specializationCode,
      variant.integralizationCredits,
      variant.professionalDescription,
      variant.recognitionDescription,
    ]),
    [
      [
        "AA",
        240,
        "Texto profissional.",
        "Reconhecido pela Portaria Ministerial n° 244 de 11/02/1994.",
      ],
      [null, null, "Texto geral.", null],
    ],
  );
  assert.deepEqual(validateCursoInformacoes(page, 2020), []);
});

test("validação identifica integralização com prazo zero", () => {
  const page = parseCursoInformacoes(
    `<h1>Curso 51 - Programa</h1>
      <h2>Turno</h2><p>Integral</p>
      <h2>Limite de Créditos para Matrícula Semestral</h2><p>Máximo de 30 créditos por Período Letivo</p>
      <h2>Integralização</h2><p>Para graduar-se neste curso, o aluno deverá obter o total de 64 créditos, correspondentes a 960 horas de atividades supervisionadas, que poderão ser integralizadas em 0 semestres, conforme proposta oferecida pela unidade para o cumprimento do currículo pleno, sendo o prazo máximo de integralização 0 semestres.</p>
      <h2>O Profissional</h2><p>Texto.</p>
      <h2>Reconhecimento</h2><p>Processo de Reconhecimento em Tramitação.</p>`,
    {
      programCode: 51,
      name: "Programa",
      url: "https://example.test/cursos/51g/index.html",
    },
  );

  assert.deepEqual(
    validateCursoInformacoes(page, 2026).map(({ rule }) => rule),
    ["integralization-positive-semesters", "integralization-positive-maximum"],
  );
});
