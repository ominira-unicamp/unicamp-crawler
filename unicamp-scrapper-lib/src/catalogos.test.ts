import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogDirectory,
  catalogProgramsUrl,
  parseCatalogoDisciplinasPrefixo,
  parseCatalogoProgramas,
  parseCatalogoProgramasHistoricos,
  parseCatalogosIndice,
  parseCurriculoEspecializacoes,
  parseCursoInformacoes,
  parseCursoSugestao,
  resolveInformationSpecializations,
  structureCursoInformacoes,
  validateCursoInformacoes,
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
