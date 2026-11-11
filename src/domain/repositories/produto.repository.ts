
import { Produto } from "../entities/produto.js";

export interface ProdutoRepository {
  cadastrar(produto: Produto, usuarioId: number): Promise<Produto>;
  listarTodos(): Promise<Produto[]>;
}
