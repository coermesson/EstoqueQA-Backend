import type { TipoMovimentacao } from "../entities/estoque.js";

export interface Paginado<T> {
  itens: T[];
  pagina: number;
  limite: number;
  total: number;
}

export interface FiltroEstoque {
  busca?: string;
  categoriaId?: number;
  abaixoDoMinimo?: boolean;
  pagina: number;
  limite: number;
}

export interface MovimentacaoInput {
  produtoId: number;
  tipo: TipoMovimentacao;
  quantidade: number;
  fornecedorId?: number;
  motivo: string;
  observacao?: string;
}

export interface FiltroMovimentacao {
  produtoId?: number;
  pagina: number;
  limite: number;
}

export interface FiltroRelatorio {
  inicio?: string;
  fim?: string;
  tipo?: TipoMovimentacao;
  produtoId?: number;
  categoriaId?: number;
  fornecedorId?: number;
}

export interface FiltroRelatorioProdutos {
  busca?: string;
  categoriaId?: number;
  fornecedorId?: number;
  abaixoDoMinimo?: boolean;
  pagina: number;
  limite: number;
}

export interface InventoryRepository {
  listarProdutos(filtros: FiltroEstoque): Promise<Paginado<Record<string, unknown>>>;
  registrarMovimentacao(data: MovimentacaoInput, actorId: number): Promise<Record<string, unknown>>;
  listarMovimentacoes(filtros: FiltroMovimentacao): Promise<Paginado<Record<string, unknown>>>;
  dashboard(): Promise<Record<string, unknown>>;
  alertas(): Promise<Record<string, unknown>>;
  relatorio(filtros: FiltroRelatorio): Promise<Record<string, unknown>[]>;
  relatorioProdutos(filtros: FiltroRelatorioProdutos): Promise<Paginado<Record<string, unknown>>>;
  listarAuditoria(pagina: number, limite: number): Promise<Paginado<Record<string, unknown>>>;
}
