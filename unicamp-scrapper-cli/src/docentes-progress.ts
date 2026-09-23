import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { ProfessorDataPortalRecord } from "unicamp-scrapper-lib";

export class DocentesProgressStore {
  private initialization?: Promise<void>;

  constructor(private readonly file: string) {}

  async initialize(): Promise<void> {
    this.initialization ??= this.execute(
      "CREATE TABLE IF NOT EXISTS docente_profiles (portal_id INTEGER PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, data TEXT, error TEXT, fetched_at TEXT, parsed_at TEXT);",
    ).then(() => undefined);
    await this.initialization;
  }

  async isCompleted(portalId: number): Promise<boolean> {
    await this.initialize();
    const result = await this.execute(
      `SELECT 1 FROM docente_profiles WHERE portal_id=${portalId} AND status='COMPLETED' LIMIT 1;`,
    );
    return result.stdout.trim() === "1";
  }

  async save(record: ProfessorDataPortalRecord): Promise<void> {
    await this.initialize();
    const now = new Date().toISOString();
    await this.execute(
      `INSERT OR REPLACE INTO docente_profiles(portal_id, name, status, data, error, fetched_at, parsed_at) VALUES (${record.portalId}, ${sqlString(record.name)}, 'COMPLETED', ${sqlString(JSON.stringify(record))}, NULL, ${sqlString(now)}, ${sqlString(now)});`,
    );
  }

  async saveFailure(portalId: number, name: string, error: unknown): Promise<void> {
    await this.initialize();
    await this.execute(
      `INSERT OR REPLACE INTO docente_profiles(portal_id, name, status, data, error, fetched_at, parsed_at) VALUES (${portalId}, ${sqlString(name)}, 'FAILED', NULL, ${sqlString(error instanceof Error ? error.message : String(error))}, ${sqlString(new Date().toISOString())}, NULL);`,
    );
  }

  async forEachCompleted(callback: (json: string) => Promise<void>): Promise<void> {
    await this.initialize();
    const child = spawn(
      "sqlite3",
      ["-batch", "-noheader", "-cmd", ".timeout 30000", this.file],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const errors: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.stdin.end(
      "SELECT data FROM docente_profiles WHERE status='COMPLETED' ORDER BY portal_id;",
    );
    const lines = createInterface({ input: child.stdout });
    for await (const line of lines) if (line) await callback(line);
    const code = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (value) => resolve(value ?? 1));
    });
    if (code !== 0)
      throw new Error(`sqlite3 encerrou com código ${code}: ${Buffer.concat(errors).toString()}`);
  }

  private execute(sql: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const sqlite = spawn(
        "sqlite3",
        ["-batch", "-noheader", "-cmd", ".timeout 30000", this.file],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      sqlite.stdout.on("data", (chunk: Buffer) => { stdout += chunk; });
      sqlite.stderr.on("data", (chunk: Buffer) => { stderr += chunk; });
      sqlite.once("error", reject);
      sqlite.once("close", (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`sqlite3 encerrou com código ${code}: ${stderr}`));
      });
      sqlite.stdin.end(sql);
    });
  }
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
