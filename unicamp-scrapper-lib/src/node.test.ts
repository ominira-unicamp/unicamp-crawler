import assert from "node:assert/strict";
import test from "node:test";
import { createNodePageFetcher } from "./node.js";

test("limita requisições simultâneas no fetcher compartilhado", async () => {
  let active = 0;
  let maximum = 0;
  let calls = 0;
  const fetcher = createNodePageFetcher({
    maxConcurrent: 2,
    minIntervalMs: 0,
    retries: 1,
    fetch: async () => {
      calls += 1;
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return new Response("ok");
    },
  });

  const result = await Promise.all(
    [1, 2, 3, 4].map((id) => fetcher.fetch(`https://example.test/${id}`)),
  );

  assert.equal(calls, 4);
  assert.equal(maximum, 2);
  assert.deepEqual(result, ["ok", "ok", "ok", "ok"]);
});

test("respeita o intervalo entre inícios de requisições", async () => {
  const startedAt: number[] = [];
  const fetcher = createNodePageFetcher({
    maxConcurrent: 2,
    minIntervalMs: 20,
    retries: 1,
    fetch: async () => {
      startedAt.push(Date.now());
      return new Response("ok");
    },
  });

  await Promise.all([
    fetcher.fetch("https://example.test/1"),
    fetcher.fetch("https://example.test/2"),
  ]);

  assert.equal(startedAt.length, 2);
  assert.ok(startedAt[1] - startedAt[0] >= 15);
});
