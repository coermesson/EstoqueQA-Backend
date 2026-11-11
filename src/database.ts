
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const required = ["DB_HOST", "DB_NAME", "DB_USER"] as const;
for (const key of required) {
  if (!process.env[key]) throw new Error(`Variável obrigatória não configurada: ${key}`);
}
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5000),
});
