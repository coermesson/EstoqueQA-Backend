import type { FastifyInstance } from "fastify";
import type { CatalogController } from "../controllers/catalog.controller.js";
import type { AuthGuards } from "./auth-guards.js";

export async function catalogRoutes(app: FastifyInstance, controller: CatalogController, guards: AuthGuards): Promise<void> {
  const { exigirLeitura, exigirEscrita, exigirAdmin } = guards;

  app.get("/categorias", { preHandler: exigirLeitura }, controller.listarCategorias);
  app.get<{ Params: { id: string } }>("/categorias/:id", { preHandler: exigirLeitura }, controller.buscarCategoria);
  app.post("/categorias", { preHandler: exigirEscrita }, controller.criarCategoria);
  app.patch<{ Params: { id: string } }>("/categorias/:id", { preHandler: exigirEscrita }, controller.atualizarCategoria);
  app.delete<{ Params: { id: string } }>("/categorias/:id", { preHandler: exigirAdmin }, controller.removerCategoria);

  app.get("/fornecedores", { preHandler: exigirLeitura }, controller.listarFornecedores);
  app.get<{ Params: { id: string } }>("/fornecedores/:id", { preHandler: exigirLeitura }, controller.buscarFornecedor);
  app.post("/fornecedores", { preHandler: exigirEscrita }, controller.criarFornecedor);
  app.patch<{ Params: { id: string } }>("/fornecedores/:id", { preHandler: exigirEscrita }, controller.atualizarFornecedor);
  app.delete<{ Params: { id: string } }>("/fornecedores/:id", { preHandler: exigirAdmin }, controller.removerFornecedor);

  app.get<{ Params: { id: string } }>("/produtos/:id", { preHandler: exigirLeitura }, controller.buscarProduto);
  app.patch<{ Params: { id: string } }>("/produtos/:id", { preHandler: exigirEscrita }, controller.atualizarProduto);
  app.patch<{ Params: { id: string } }>("/produtos/:id/estoque-minimo", { preHandler: exigirEscrita }, controller.atualizarEstoqueMinimo);
  app.delete<{ Params: { id: string } }>("/produtos/:id", { preHandler: exigirAdmin }, controller.removerProduto);
  app.get<{ Params: { id: string } }>("/produtos/:id/fornecedores", { preHandler: exigirLeitura }, controller.listarFornecedoresDoProduto);
  app.put<{ Params: { id: string } }>("/produtos/:id/fornecedores", { preHandler: exigirEscrita }, controller.associarFornecedor);
  app.delete<{ Params: { id: string; fornecedorId: string } }>("/produtos/:id/fornecedores/:fornecedorId", { preHandler: exigirEscrita }, controller.removerFornecedorDoProduto);
}
