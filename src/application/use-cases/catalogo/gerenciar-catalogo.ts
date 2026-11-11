import type { CatalogRepository } from "../../../domain/repositories/catalog.repository.js";
import { Categoria } from "../../../domain/entities/categoria.js";
import { Fornecedor } from "../../../domain/entities/fornecedor.js";

export class GerenciarCatalogo {
  constructor(private readonly repository: CatalogRepository) {}

  listarCategorias() { return this.repository.listarCategorias(); }
  buscarCategoria(id: number) { return this.repository.buscarCategoria(id); }
  criarCategoria(data: { nome: string; descricao?: string }, actorId: number) {
    const categoria = new Categoria({ id: 0, ...data });
    return this.repository.criarCategoria({ nome: categoria.nome, descricao: categoria.descricao ?? undefined }, actorId);
  }
  atualizarCategoria(id: number, data: { nome?: string; descricao?: string | null }, actorId: number) { return this.repository.atualizarCategoria(id, data, actorId); }
  removerCategoria(id: number, actorId: number) { return this.repository.removerCategoria(id, actorId); }

  listarFornecedores() { return this.repository.listarFornecedores(); }
  buscarFornecedor(id: number) { return this.repository.buscarFornecedor(id); }
  criarFornecedor(data: { nome: string; email?: string; telefone?: string; documento?: string }, actorId: number) {
    const fornecedor = new Fornecedor({ id: 0, ...data, ativo: true });
    return this.repository.criarFornecedor({ nome: fornecedor.nome, email: fornecedor.email ?? undefined, telefone: fornecedor.telefone ?? undefined, documento: fornecedor.documento ?? undefined }, actorId);
  }
  atualizarFornecedor(id: number, data: { nome?: string; email?: string | null; telefone?: string | null; documento?: string | null }, actorId: number) { return this.repository.atualizarFornecedor(id, data, actorId); }
  desativarFornecedor(id: number, actorId: number) { return this.repository.desativarFornecedor(id, actorId); }

  buscarProduto(id: number) { return this.repository.buscarProduto(id); }
  atualizarProduto(id: number, data: { codigo?: string | null; nome?: string; descricao?: string | null; preco?: number; categoriaId?: number | null; estoqueMinimo?: number }, actorId: number) {
    const normalized = data.codigo === undefined ? data : { ...data, codigo: data.codigo?.trim() || null };
    return this.repository.atualizarProduto(id, normalized, actorId);
  }
  removerProduto(id: number, actorId: number) { return this.repository.removerProduto(id, actorId); }
  listarFornecedoresDoProduto(id: number) { return this.repository.listarFornecedoresDoProduto(id); }
  associarFornecedor(id: number, fornecedorId: number, codigo: string | undefined, custo: number | undefined, actorId: number) { return this.repository.associarFornecedor(id, fornecedorId, codigo, custo, actorId); }
  removerFornecedorDoProduto(id: number, fornecedorId: number, actorId: number) { return this.repository.removerFornecedorDoProduto(id, fornecedorId, actorId); }
}
