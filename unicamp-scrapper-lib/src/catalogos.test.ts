import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCatalogoDisciplinasPrefixo,
  parseCatalogoProgramas,
  parseCursoSugestao,
} from "./catalogos.js";
import type { ScrapeReporter } from "./core.js";

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
      { all: [{ code: "MC101", kind: "FULL" }] },
      {
        all: [
          { code: "MC100", kind: "FULL" },
          { code: "AA200", kind: "SPECIAL" },
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
    { all: [{ code: "F 128", kind: "FULL" }] },
    { all: [{ code: "MA111", kind: "FULL" }] },
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
    offeringPeriod: "Todos os períodos",
    evaluation: "Nota e Frequência",
    finalExam: true,
    minimumAttendancePercent: 75,
    prerequisites: {
      raw: "MC102",
      any: [{ all: [{ code: "MC102", kind: "FULL" }] }],
    },
    syllabus: "Estruturas básicas.",
    bibliography: "Autor. Livro, 2024.",
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
