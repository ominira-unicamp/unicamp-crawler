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
  assert.match(result.stdout, /^calendar-snapshot\t/m);
  assert.match(result.stdout, /^academic-data-snapshot\t/m);
  assert.match(result.stdout, /^catalogo-curriculos\t/m);
  assert.match(result.stdout, /^catalog-disciplines-snapshot\t/m);
  assert.match(result.stdout, /^catalogo-informacoes\t/m);
  assert.match(result.stdout, /^catalog-programs-snapshot\t/m);
  assert.match(result.stdout, /^continencia-equivalencia\t/m);
  assert.match(result.stdout, /^editais-intercambio\t/m);
  assert.match(result.stdout, /^exchange-notices-snapshot\t/m);
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

for (const scenario of ["complete", "missing-page", "invalid-row"] as const) {
  test(`continencia-equivalencia emite contrato e cobertura: ${scenario}`, async () => {
    const server = createServer((request, response) => {
      response.setHeader("content-type", "text/html; charset=utf-8");
      if (request.url === "/index") {
        response.end(
          `<div id="iniciais"><a href="/M">M</a><a href="/F">F</a></div>`,
        );
      } else if (request.url === "/F" && scenario === "missing-page") {
        response.statusCode = 503;
        response.end("Indisponível");
      } else {
        const content =
          request.url === "/F" && scenario === "invalid-row"
            ? "<a>inválido</a>"
            : "*<a>MC101</a>";
        response.end(
          `<div class="row"><div class="disciplina"><a name="MC102">MC102</a></div><div class="continencia">${content}</div></div>`,
        );
      }
    });
    const directory = await mkdtemp(join(tmpdir(), "continencias-cli-"));
    try {
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Servidor inválido");
      const output = join(directory, "relations.json");
      const args = [
        cli,
        "continencia-equivalencia",
        "--url",
        `http://127.0.0.1:${address.port}/index`,
        "--no-cache",
        "--request-interval",
        "1",
        "--retries",
        "1",
        "--output",
        output,
      ];
      if (scenario === "complete") {
        await run(process.execPath, args);
      } else {
        await assert.rejects(run(process.execPath, args), (error: unknown) => {
          assert.equal((error as { code: number }).code, 1);
          return true;
        });
      }
      const result = JSON.parse(await readFile(output, "utf8"));
      assert.equal(result.data.coverage.complete, scenario === "complete");
      assert.deepEqual(result.data.coverage.expectedInitials, ["M", "F"]);
      assert.deepEqual(
        result.data.coverage.failedInitials,
        scenario === "missing-page" ? ["F"] : [],
      );
      assert.deepEqual(
        result.data.coverage.loadedInitials,
        scenario === "missing-page" ? ["M"] : ["M", "F"],
      );
      assert.deepEqual(result.data.relations[0].groups, [
        {
          members: [{ code: "MC101", prerequisiteOnlyMarker: true }],
          rawText: "*MC101",
        },
      ]);
      assert.ok(!("sourceCodes" in result.data.relations[0].groups[0]));
      assert.ok(
        result.data.relations[0].sourceUrls.includes(
          `http://127.0.0.1:${address.port}/M`,
        ),
      );
      assert.equal(result.issues.length === 0, scenario === "complete");
      assert.ok(result.pages.length >= 2);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await rm(directory, { recursive: true, force: true });
    }
  });
}
