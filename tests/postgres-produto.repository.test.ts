import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import { Produto } from "../src/domain/entities/produto.js";
import { PostgresProdutoRepository } from "../src/infrastructure/database/postgres/postgres-produto.repository.js";

function produto(quantidade: number) {
  return new Produto({ id: 0, nome: "Mouse", descricao: null, quantidade, preco: 50, criadoEm: new Date(), estoqueMinimo: 2 });
}

describe("PostgresProdutoRepository.cadastrar", () => {
  it("registra saldo inicial, auditoria e produto na mesma transação", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ id: 9, nome: "Mouse", descricao: null, quantidade: 5, preco: "50", criado_em: new Date(), categoria_id: null, estoque_minimo: 2 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    const created = await new PostgresProdutoRepository(pool).cadastrar(produto(5), 3);

    expect(created.id).toBe(9);
    expect(query.mock.calls.map(([sql]) => sql)).toContain("BEGIN");
    expect(query.mock.calls.map(([sql]) => sql).some((sql) => String(sql).includes("INSERT INTO movimentacoes"))).toBe(true);
    expect(query.mock.calls.map(([sql]) => sql).some((sql) => String(sql).includes("INSERT INTO auditoria"))).toBe(true);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });

  it("não cria movimentação de entrada quando o saldo inicial é zero", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ id: 10, nome: "Mouse", descricao: null, quantidade: 0, preco: "50", criado_em: new Date(), categoria_id: null, estoque_minimo: 2 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    await new PostgresProdutoRepository(pool).cadastrar(produto(0), 3);

    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO movimentacoes"))).toBe(false);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });
});
