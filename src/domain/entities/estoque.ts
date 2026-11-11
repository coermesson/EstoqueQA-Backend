export type TipoMovimentacao = "entrada" | "saida";

export function calcularSaldoAposMovimentacao(
  saldoAtual: number,
  tipo: TipoMovimentacao,
  quantidade: number,
): number {
  if (!Number.isInteger(saldoAtual) || saldoAtual < 0) {
    throw new Error("O saldo atual deve ser um inteiro não negativo.");
  }
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error("A quantidade movimentada deve ser um inteiro positivo.");
  }

  const saldo = tipo === "entrada"
    ? saldoAtual + quantidade
    : saldoAtual - quantidade;
  if (saldo < 0) throw new Error("Estoque insuficiente para esta saída.");
  return saldo;
}
