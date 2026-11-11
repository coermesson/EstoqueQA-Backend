
import type { ProdutoRepository } from "../../../domain/repositories/produto.repository.js";
import type { ProdutoResponseDTO } from "../../dtos/produto.dto.js";

export class ListarProdutos {
  constructor(
    private readonly produtoRepository: ProdutoRepository,
  ) {}

  async executar(): Promise<ProdutoResponseDTO[]> {
    const produtos = await this.produtoRepository.listarTodos();

    return produtos.map((produto) => ({
      id: produto.id,
      codigo: produto.codigo,
      nome: produto.nome,
      descricao: produto.descricao,
      quantidade: produto.quantidade,
      preco: produto.preco,
      criadoEm: produto.criadoEm,
      categoriaId: produto.categoriaId,
      estoqueMinimo: produto.estoqueMinimo,
      ativo: produto.ativo,
    }));
  }
}
