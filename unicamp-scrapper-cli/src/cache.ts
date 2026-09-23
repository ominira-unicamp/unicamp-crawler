import { spawn } from "node:child_process";
import type { PageCache } from "unicamp-scrapper-lib";

export class SqlitePageCache implements PageCache {
  private static readonly maxCachedContentBytes = 10 * 1024 * 1024;
  private initialization?: Promise<void>;
  private writeQueue = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly refresh = false,
  ) {}

  async get(url: string): Promise<string | undefined> {
    if (this.refresh) return undefined;
    await this.initialize();
    const result = await this.execute(
      `SELECT content FROM pages WHERE url=${sqlString(url)} LIMIT 1;`,
    );
    return result.stdout.length === 0
      ? undefined
      : result.stdout.replace(/\n$/, "");
  }

  async set(url: string, html: string): Promise<void> {
    if (Buffer.byteLength(html, "utf8") > SqlitePageCache.maxCachedContentBytes)
      return;
    await this.initialize();
    let release!: () => void;
    const previous = this.writeQueue;
    this.writeQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      await this.execute(
        `INSERT OR REPLACE INTO pages(url, content, timestamp) VALUES (${sqlString(url)}, ${sqlString(html)}, CURRENT_TIMESTAMP);`,
      );
    } finally {
      release();
    }
  }

  private async initialize(): Promise<void> {
    this.initialization ??= this.execute(
      "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS pages (url TEXT PRIMARY KEY, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);",
    ).then(() => undefined);
    await this.initialization;
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

      sqlite.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk;
      });
      sqlite.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk;
      });
      sqlite.once("error", reject);
      sqlite.once("close", (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else
          reject(new Error(`sqlite3 encerrou com código ${code}: ${stderr}`));
      });
      sqlite.stdin.end(sql);
    });
  }
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
