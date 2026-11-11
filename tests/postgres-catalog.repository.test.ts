import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import { PostgresCatalogRepository } from "../src/infrastructure/database/postgres/postgres-catalog.repository.js";

function setup(quantity: number) {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: null })
    .mockResolvedValueOnce({ rows: [{ quantidade: quantity }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [{ id: 3 }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: null });
  const release = vi.fn();
  const pool = { connect: vi.fn().mockResolvedValue({ query, release } as unknown as PoolClient) } as unknown as Pool;
  return { repository: new PostgresCatalogRepository(pool), query, release };
}

describe("inativação lógica de produto", () => {
  it("marca como inativo sem excluir a linha", async () => {
    const { repository, query, release } = setup(0);
    await expect(repository.removerProduto(3, 8)).resolves.toBe(true);
    const sql = query.mock.calls.map(([statement]) => String(statement));
    expect(sql.some((statement) => statement.includes("UPDATE produtos SET ativo=FALSE"))).toBe(true);
    expect(sql.some((statement) => statement.startsWith("DELETE"))).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });

  it("impede inativação enquanto houver saldo positivo", async () => {
    const { repository, query } = setup(4);
    await expect(repository.removerProduto(3, 8)).rejects.toMatchObject({ statusCode: 409 });
    expect(query.mock.calls.map(([statement]) => String(statement)).some((statement) => statement.includes("UPDATE produtos SET ativo=FALSE"))).toBe(false);
    expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  });
});
