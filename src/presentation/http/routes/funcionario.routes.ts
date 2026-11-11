import type { FastifyInstance } from "fastify";
import type { FuncionarioController } from "../controllers/funcionario.controller.js";
import type { AuthGuards } from "./auth-guards.js";

export async function funcionarioRoutes(app: FastifyInstance, controller: FuncionarioController, guards: AuthGuards): Promise<void> {
  app.get("/funcionarios", { preHandler: guards.exigirGestaoFuncionarios }, controller.listar);
  app.get<{ Params: { id: string } }>("/funcionarios/:id", { preHandler: guards.exigirGestaoFuncionarios }, controller.buscar);
  app.post("/funcionarios", { preHandler: guards.exigirGestaoFuncionarios }, controller.criar);
  app.patch<{ Params: { id: string } }>("/funcionarios/:id", { preHandler: guards.exigirGestaoFuncionarios }, controller.atualizar);
  app.delete<{ Params: { id: string } }>("/funcionarios/:id", { preHandler: guards.exigirGestaoFuncionarios }, controller.inativar);
}
