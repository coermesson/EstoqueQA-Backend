
import { Produto } from "../../../domain/entities/produto.js";
import type { ProdutoRepository } from "../../../domain/repositories/produto.repository.js";
import type {
    CadastrarProdutoDTO,
    ProdutoResponseDTO,
} from "../../dtos/produto.dto.js";

export class CadastrarProduto {
  constructor(
    private readonly produtoRepository: ProdutoRepository,
  ) {}

  async executar(
    dados: CadastrarProdutoDTO,
    usuarioId: number,
  ): Promise<ProdutoResponseDTO> {
    const produto = new Produto({
      id: 0,
      codigo: dados.codigo,
      nome: dados.nome,
      descricao: dados.descricao ?? null,
      quantidade: dados.quantidade,
      preco: dados.preco,
      criadoEm: new Date(),
      categoriaId: dados.categoriaId,
      estoqueMinimo: dados.estoqueMinimo,
      ativo: true,
    });

    const produtoCadastrado =
      await this.produtoRepository.cadastrar(produto, usuarioId);

    return {
      id: produtoCadastrado.id,
      codigo: produtoCadastrado.codigo,
      nome: produtoCadastrado.nome,
      descricao: produtoCadastrado.descricao,
      quantidade: produtoCadastrado.quantidade,
      preco: produtoCadastrado.preco,
      criadoEm: produtoCadastrado.criadoEm,
      categoriaId: produtoCadastrado.categoriaId,
      estoqueMinimo: produtoCadastrado.estoqueMinimo,
      ativo: produtoCadastrado.ativo,
    };
  }
}
