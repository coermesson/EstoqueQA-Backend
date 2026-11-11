import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "../src/database.js";

const migrationDirectory = join(process.cwd(), "migrations");
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      aplicado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(migrationDirectory))
    .filter((file) => /^\d+_[a-z0-9_]+\.sql$/i.test(file))
    .sort((left, right) => left.localeCompare(right, "en"));

  for (const file of files) {
    const sql = await readFile(join(migrationDirectory, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");

    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock($1)", [89233291]);
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE version=$1",
        [file],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Checksum divergente para migration já aplicada: ${file}`);
        }
        await client.query("COMMIT");
        continue;
      }

      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)",
        [file, checksum],
      );
      await client.query("COMMIT");
      process.stdout.write(`Aplicada: ${file}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} catch (error) {
  process.stderr.write(`Falha ao aplicar migrations: ${error instanceof Error ? error.message : "erro desconhecido"}\n`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
