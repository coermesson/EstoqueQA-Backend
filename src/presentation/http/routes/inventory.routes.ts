import type { FastifyInstance } from "fastify";
import type { InventoryController } from "../controllers/inventory.controller.js";
import type { AuthGuards } from "./auth-guards.js";

export async function inventoryRoutes(app: FastifyInstance, controller: InventoryController, guards: AuthGuards): Promise<void> {
  app.get("/estoque/produtos", { preHandler: guards.exigirLeitura }, controller.listarProdutos);
  app.post("/movimentacoes", { preHandler: guards.exigirMovimentacao }, controller.registrarMovimentacao);
  app.get("/movimentacoes", { preHandler: guards.exigirLeitura }, controller.listarMovimentacoes);
  app.get("/dashboard", { preHandler: guards.exigirGestao }, controller.dashboard);
  app.get("/estoque/alertas", { preHandler: guards.exigirGestao }, controller.alertas);
  app.get("/relatorios/movimentacoes", { preHandler: guards.exigirGestao }, controller.relatorio);
  app.get("/relatorios/movimentacoes.csv", { preHandler: guards.exigirGestao }, controller.exportarRelatorio);
  app.get("/relatorios/produtos", { preHandler: guards.exigirGestao }, controller.relatorioProdutos);
  app.get("/relatorios/produtos.csv", { preHandler: guards.exigirGestao }, controller.exportarProdutosCsv);
  app.get("/auditoria", { preHandler: guards.exigirAdmin }, controller.auditoria);
}
