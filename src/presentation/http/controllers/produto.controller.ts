
import type { FastifyReply, FastifyRequest } from "fastify";
import type { CadastrarProduto } from "../../../application/use-cases/produto/cadastrar-produto.js";
import type { ListarProdutos } from "../../../application/use-cases/produto/listar-produtos.js";
import { produtoSchema } from "../schemas/produto.schema.js";

export class ProdutoController {
  constructor(
    private readonly cadastrarProduto: CadastrarProduto,
    private readonly listarProdutos: ListarProdutos,
  ) {}

  async cadastrar(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const validacao = produtoSchema.safeParse(request.body);

    if (!validacao.success) {
      return reply.status(400).send({
        erro: "Dados do produto inválidos",
        detalhes: validacao.error.issues.map((issue) => ({
          campo: issue.path.join("."),
          mensagem: issue.message,
        })),
      });
    }

    try {
      const actorId = (request as FastifyRequest & { user?: { userId: number } }).user?.userId;
      if (!actorId) return reply.status(401).send({ erro: "Autenticação necessária." });
      const produto = await this.cadastrarProduto.executar(validacao.data, actorId);

      return reply.status(201).send(produto);
    } catch (erro) {
      request.log.error(erro);
      const failure = erro as Error & { statusCode?: number; code?: string };
      if (failure.statusCode) return reply.status(failure.statusCode).send({ erro: failure.message });
      if (failure.code === "23505") return reply.status(409).send({ erro: "Código de produto já cadastrado." });
      if (failure.code === "23503") return reply.status(409).send({ erro: "Categoria inválida ou inativa." });
      return reply.status(500).send({ erro: "Não foi possível cadastrar o produto." });
    }
  }

  async listar(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const produtos = await this.listarProdutos.executar();

      return reply.status(200).send(produtos);
    } catch (erro) {
      request.log.error(erro);

      return reply.status(500).send({
        erro: "Não foi possível listar os produtos.",
      });
    }
  }
}
