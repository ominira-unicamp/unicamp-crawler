import assert from "node:assert/strict";
import test from "node:test";
import { resolveCardapiosRange } from "./cardapios-range.js";

test("resolve janela relativa de cardápios", () => {
  assert.deepEqual(
    resolveCardapiosRange(
      { pastDays: 1, futureDays: 7 },
      new Date(2026, 7, 20, 12),
    ),
    { firstDate: "2026-08-19", lastDate: "2026-08-27" },
  );
});

test("exige as duas datas do intervalo exato", () => {
  assert.throws(
    () => resolveCardapiosRange({ firstDate: "2026-08-20" }),
    /devem ser informados juntos/,
  );
});

test("não combina intervalo exato e relativo", () => {
  assert.throws(
    () =>
      resolveCardapiosRange({
        firstDate: "2026-08-20",
        lastDate: "2026-08-21",
        futureDays: 7,
      }),
    /não podem ser combinadas/,
  );
});
