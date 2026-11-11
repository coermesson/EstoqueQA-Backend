import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createApp } from "../src/app.js";

describe("composition root", () => {
  it("registra as rotas sem conectar ao banco e responde health", async () => {
    const end = async () => undefined;
    const pool = {
      query: async (sql: string) => {
        if (sql === "SELECT 1") return { rows: [{ "?column?": 1 }], rowCount: 1 };
        throw new Error("Consulta inesperada.");
      },
      connect: async () => { throw new Error("Conexão inesperada."); },
      end,
    } as unknown as Pool;
    const app = createApp(pool);
    try {
      await app.ready();
      const response = await app.inject({ method: "GET", url: "/health" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok", sistema: "EstoqueQA", banco: "ok" });
    } finally {
      await app.close();
    }
  });
});
