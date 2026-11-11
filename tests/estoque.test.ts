import { describe, expect, it } from "vitest";
import { calcularSaldoAposMovimentacao } from "../src/domain/entities/estoque.js";

describe("cálculo do saldo", () => {
  it("soma entradas", () => {
    expect(calcularSaldoAposMovimentacao(5, "entrada", 3)).toBe(8);
  });

  it("subtrai saídas sem permitir saldo negativo", () => {
    expect(calcularSaldoAposMovimentacao(5, "saida", 3)).toBe(2);
    expect(() => calcularSaldoAposMovimentacao(2, "saida", 3)).toThrow("Estoque insuficiente para esta saída.");
  });

  it("rejeita quantidades e saldos inválidos", () => {
    expect(() => calcularSaldoAposMovimentacao(-1, "entrada", 1)).toThrow();
    expect(() => calcularSaldoAposMovimentacao(1, "entrada", 0)).toThrow();
    expect(() => calcularSaldoAposMovimentacao(1, "saida", 1.5)).toThrow();
  });
});
