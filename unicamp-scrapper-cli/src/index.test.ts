import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/index.js", import.meta.url));

test("list expõe crawlers e páginas públicas", async () => {
  const result = await run(process.execPath, [cli, "list"]);

  assert.match(result.stdout, /^caderno-horarios\t/m);
  assert.match(result.stdout, /^cardapio-dia\t/m);
  assert.match(result.stdout, /^catalogo-curriculos\t/m);
  assert.match(result.stdout, /^catalogo-informacoes\t/m);
  assert.match(result.stdout, /^continencia-equivalencia\t/m);
  assert.match(result.stdout, /^editais-intercambio\t/m);
});

test("editais-intercambio agrega as páginas abertas e fechadas", async () => {
  const server = createServer((request, response) => {
    const title = request.url === "/abertos" ? "Aberto" : "Fechado";
    response.writeHead(200, { "content-type": "text/html" });
    response.end(
      `<article class="filtrable-item"><span class="edital__title">${title}</span></article>`,
    );
  });
  const directory = await mkdtemp(join(tmpdir(), "exchange-notices-cli-"));

  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Servidor inválido");

    const output = join(directory, "editais.json");
    await run(process.execPath, [
      cli,
      "editais-intercambio",
      "--open-url",
      `http://127.0.0.1:${address.port}/abertos`,
      "--closed-url",
      `http://127.0.0.1:${address.port}/fechados`,
      "--cache",
      join(directory, "cache.db"),
      "--output",
      output,
    ]);

    const result = JSON.parse(await readFile(output, "utf8")) as {
      data: Array<{ title: string | null }>;
      issues: unknown[];
    };
    assert.deepEqual(
      result.data.map((notice) => notice.title),
      ["Aberto", "Fechado"],
    );
    assert.deepEqual(result.issues, []);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
