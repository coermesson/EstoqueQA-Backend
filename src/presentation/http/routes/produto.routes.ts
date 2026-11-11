
import type { FastifyInstance } from "fastify";
import type { ProdutoController } from "../controllers/produto.controller.js";
import type { AuthGuards } from "./auth-guards.js";

export async function produtoRoutes(
  app: FastifyInstance,
  controller: ProdutoController,
  guards: AuthGuards,
): Promise<void> {
  app.post("/produtos", { preHandler: guards.exigirEscrita }, (request, reply) =>
    controller.cadastrar(request, reply),
  );

  app.get("/produtos", { preHandler: guards.exigirLeitura }, (request, reply) =>
    controller.listar(request, reply),
  );
}
