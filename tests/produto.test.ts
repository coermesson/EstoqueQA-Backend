import { describe, expect, it } from "vitest";
import { Produto } from "../src/domain/entities/produto.js";

const base = {
  id: 1,
  nome: " Teclado ",
  descricao: null,
  quantidade: 4,
  preco: 99.9,
  criadoEm: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Produto", () => {
  it("normaliza o nome removendo espaços externos", () => {
    expect(new Produto(base).nome).toBe("Teclado");
  });

  it("rejeita nome vazio", () => {
    expect(() => new Produto({ ...base, nome: "   " })).toThrow("O nome do produto é obrigatório.");
  });

  it("rejeita quantidade negativa ou fracionária", () => {
    expect(() => new Produto({ ...base, quantidade: -1 })).toThrow();
    expect(() => new Produto({ ...base, quantidade: 1.5 })).toThrow();
  });

  it("rejeita preço negativo ou não finito", () => {
    expect(() => new Produto({ ...base, preco: -1 })).toThrow();
    expect(() => new Produto({ ...base, preco: Number.NaN })).toThrow();
  });

  it("normaliza código opcional e representa o estado ativo", () => {
    const product = new Produto({ ...base, codigo: " SKU-01 ", quantidade: 0 });
    expect(product.codigo).toBe("SKU-01");
    expect(product.ativo).toBe(true);
    expect(new Produto({ ...base, codigo: "   " }).codigo).toBeNull();
  });
});
