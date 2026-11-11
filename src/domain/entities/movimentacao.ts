import type { TipoMovimentacao } from "./estoque.js";

export interface MovimentacaoProps {
  produtoId: number;
  tipo: TipoMovimentacao;
  quantidade: number;
  motivo: string;
  usuarioId: number;
  fornecedorId?: number;
}

export class Movimentacao {
  readonly produtoId: number;
  readonly tipo: TipoMovimentacao;
  readonly quantidade: number;
  readonly motivo: string;
  readonly usuarioId: number;
  readonly fornecedorId?: number;

  constructor(props: MovimentacaoProps) {
    const motivo = props.motivo.trim();
    if (!Number.isInteger(props.produtoId) || props.produtoId <= 0) throw new Error("Produto da movimentação inválido.");
    if (!Number.isInteger(props.usuarioId) || props.usuarioId <= 0) throw new Error("Responsável pela movimentação inválido.");
    if (props.fornecedorId !== undefined && (!Number.isInteger(props.fornecedorId) || props.fornecedorId <= 0)) throw new Error("Fornecedor da movimentação inválido.");
    if (props.tipo !== "entrada" && props.tipo !== "saida") throw new Error("Tipo de movimentação inválido.");
    if (!Number.isInteger(props.quantidade) || props.quantidade <= 0) throw new Error("A quantidade movimentada deve ser um inteiro positivo.");
    if (!motivo || motivo.length > 2000) throw new Error("Motivo da movimentação inválido.");
    this.produtoId = props.produtoId;
    this.tipo = props.tipo;
    this.quantidade = props.quantidade;
    this.motivo = motivo;
    this.usuarioId = props.usuarioId;
    this.fornecedorId = props.fornecedorId;
  }
}
