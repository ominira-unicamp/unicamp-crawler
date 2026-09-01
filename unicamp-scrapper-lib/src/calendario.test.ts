import assert from "node:assert/strict";
import test from "node:test";
import { parseCalendarioGraduacaoPagina, parsePeriodo } from "./calendario.js";

test("interpreta período que atravessa o ano", () => {
  assert.deepEqual(parsePeriodo("30.12 a 02.01", 12, 2026), {
    startDate: "30-12-2026",
    endDate: "02-01-2027",
  });
});

test("interpreta tabela de calendário com células mescladas", () => {
  const page = parseCalendarioGraduacaoPagina(
    '<table><tr><th colspan="3">Janeiro de 2026</th></tr><tr><td rowspan="2">10 a 12</td><td>Graduação</td><td>Matrícula</td></tr><tr><td>Graduação</td><td>Ajuste</td></tr></table>',
    { year: 2026 },
  );

  assert.deepEqual(page.events, [
    {
      startDate: "10-01-2026",
      endDate: "12-01-2026",
      category: "Graduação",
      description: "Matrícula",
    },
    {
      startDate: "10-01-2026",
      endDate: "12-01-2026",
      category: "Graduação",
      description: "Ajuste",
    },
  ]);
});
