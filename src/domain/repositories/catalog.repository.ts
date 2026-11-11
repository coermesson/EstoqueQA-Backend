export interface CategoriaDTO {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  criadoEm: string;
}

export interface FornecedorDTO {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  ativo: boolean;
  criadoEm: string;
}

export interface ProdutoCatalogoDTO {
  id: number;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  quantidade: number;
  preco: number;
  criadoEm: string;
  categoriaId: number | null;
  estoqueMinimo: number;
  ativo: boolean;
}

export interface ProdutoFornecedorDTO {
  produtoId: number;
  fornecedorId: number;
  fornecedorNome: string;
  codigoNoFornecedor: string | null;
  custoAtual: number | null;
  criadoEm: string;
}

export interface CatalogRepository {
  listarCategorias(): Promise<CategoriaDTO[]>;
  buscarCategoria(id: number): Promise<CategoriaDTO | null>;
  criarCategoria(data: { nome: string; descricao?: string }, actorId: number): Promise<CategoriaDTO>;
  atualizarCategoria(id: number, data: { nome?: string; descricao?: string | null }, actorId: number): Promise<CategoriaDTO | null>;
  removerCategoria(id: number, actorId: number): Promise<boolean>;
  listarFornecedores(): Promise<FornecedorDTO[]>;
  buscarFornecedor(id: number): Promise<FornecedorDTO | null>;
  criarFornecedor(data: { nome: string; email?: string; telefone?: string; documento?: string }, actorId: number): Promise<FornecedorDTO>;
  atualizarFornecedor(id: number, data: { nome?: string; email?: string | null; telefone?: string | null; documento?: string | null }, actorId: number): Promise<FornecedorDTO | null>;
  desativarFornecedor(id: number, actorId: number): Promise<boolean>;
  buscarProduto(id: number): Promise<ProdutoCatalogoDTO | null>;
  atualizarProduto(id: number, data: { codigo?: string | null; nome?: string; descricao?: string | null; preco?: number; categoriaId?: number | null; estoqueMinimo?: number }, actorId: number): Promise<ProdutoCatalogoDTO | null>;
  removerProduto(id: number, actorId: number): Promise<boolean>;
  listarFornecedoresDoProduto(id: number): Promise<ProdutoFornecedorDTO[]>;
  associarFornecedor(id: number, fornecedorId: number, codigo: string | undefined, custo: number | undefined, actorId: number): Promise<ProdutoFornecedorDTO>;
  removerFornecedorDoProduto(id: number, fornecedorId: number, actorId: number): Promise<boolean>;
}
