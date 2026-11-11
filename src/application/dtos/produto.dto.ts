
export interface CadastrarProdutoDTO {
  codigo?: string | null;
  nome: string;
  descricao?: string;
  quantidade: number;
  preco: number;
  categoriaId?: number | null;
  estoqueMinimo?: number;
}

export interface ProdutoResponseDTO {
  id: number;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  quantidade: number;
  preco: number;
  criadoEm: Date;
  categoriaId: number | null;
  estoqueMinimo: number;
  ativo: boolean;
}
