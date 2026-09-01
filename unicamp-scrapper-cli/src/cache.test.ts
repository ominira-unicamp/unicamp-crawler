import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SqlitePageCache } from "./cache.js";

test("cache SQLite reutiliza páginas e refresh ignora a leitura", async () => {
  const directory = await mkdtemp(join(tmpdir(), "unicamp-scrapper-cli-"));
  const file = join(directory, "pages.db");
  const cache = new SqlitePageCache(file);

  await cache.set("https://example.test", "primeira versão");
  assert.equal(await cache.get("https://example.test"), "primeira versão");

  const refresh = new SqlitePageCache(file, true);
  assert.equal(await refresh.get("https://example.test"), undefined);
  await refresh.set("https://example.test", "segunda versão");
  assert.equal(await cache.get("https://example.test"), "segunda versão");
});
