import Fastify from "fastify";
import type { Pool } from "pg";
import { PostgresProdutoRepository } from "./infrastructure/database/postgres/postgres-produto.repository.js";
import { CadastrarProduto } from "./application/use-cases/produto/cadastrar-produto.js";
import { ListarProdutos } from "./application/use-cases/produto/listar-produtos.js";
import { ProdutoController } from "./presentation/http/controllers/produto.controller.js";
import { produtoRoutes } from "./presentation/http/routes/produto.routes.js";
import { inventoryRoutes } from "./presentation/http/routes/inventory.routes.js";
import { catalogRoutes } from "./presentation/http/routes/catalog.routes.js";
import { CatalogController } from "./presentation/http/controllers/catalog.controller.js";
import { GerenciarCatalogo } from "./application/use-cases/catalogo/gerenciar-catalogo.js";
import { PostgresCatalogRepository } from "./infrastructure/database/postgres/postgres-catalog.repository.js";
import { PostgresAuthRepository } from "./infrastructure/database/postgres/postgres-auth.repository.js";
import { SignedTokenService } from "./infrastructure/security/signed-token.js";
import { GerenciarAutenticacao } from "./application/use-cases/auth/gerenciar-autenticacao.js";
import { AuthController } from "./presentation/http/controllers/auth.controller.js";
import { createAuthGuards } from "./presentation/http/routes/auth-guards.js";
import { authRoutes } from "./presentation/http/routes/auth.routes.js";
import { PostgresInventoryRepository } from "./infrastructure/database/postgres/postgres-inventory.repository.js";
import { GerenciarEstoque } from "./application/use-cases/estoque/gerenciar-estoque.js";
import { InventoryController } from "./presentation/http/controllers/inventory.controller.js";
import { FuncionarioController } from "./presentation/http/controllers/funcionario.controller.js";
import { GerenciarFuncionarios } from "./application/use-cases/funcionarios/gerenciar-funcionarios.js";
import { funcionarioRoutes } from "./presentation/http/routes/funcionario.routes.js";
import { PostgresFuncionarioRepository } from "./infrastructure/database/postgres/postgres-funcionario.repository.js";

/** Composition root: recebe infraestrutura pronta para permitir testes isolados. */
export function createApp(pool: Pool) {
  const app = Fastify({ logger: true });
  const corsOrigins = new Set((process.env.CORS_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean));
  app.addHook("onRequest", (request, reply, done) => {
    const origin = request.headers.origin;
    if (origin && corsOrigins.has(origin)) {
      reply.header("access-control-allow-origin", origin);
      reply.header("vary", "Origin");
      reply.header("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
      reply.header("access-control-allow-headers", "Authorization,Content-Type");
    }
    if (request.method === "OPTIONS" && origin && corsOrigins.has(origin)) {
      reply.code(204).send();
      return;
    }
    done();
  });
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = (error as Error & { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ erro: "Requisição inválida." });
    }
    return reply.code(500).send({ erro: "Erro interno do servidor." });
  });
  const produtoRepository = new PostgresProdutoRepository(pool);
  const controller = new ProdutoController(
    new CadastrarProduto(produtoRepository),
    new ListarProdutos(produtoRepository),
  );
  const catalogController = new CatalogController(
    new GerenciarCatalogo(new PostgresCatalogRepository(pool)),
  );
  const auth = new GerenciarAutenticacao(new PostgresAuthRepository(pool), new SignedTokenService());
  const authController = new AuthController(auth);
  const authGuards = createAuthGuards(auth);
  const funcionarioController = new FuncionarioController(new GerenciarFuncionarios(new PostgresFuncionarioRepository(pool), auth));
  const inventoryController = new InventoryController(
    new GerenciarEstoque(new PostgresInventoryRepository(pool)),
  );

  app.get("/health", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok", sistema: "EstoqueQA", banco: "ok" };
    } catch {
      return reply.code(503).send({ status: "indisponivel", sistema: "EstoqueQA", banco: "indisponivel" });
    }
  });
  app.register(async (instance) => produtoRoutes(instance, controller, authGuards));
  app.register(async (instance) => inventoryRoutes(instance, inventoryController, authGuards));
  app.register(async (instance) => catalogRoutes(instance, catalogController, authGuards));
  app.register(async (instance) => authRoutes(instance, authController, authGuards));
  app.register(async (instance) => funcionarioRoutes(instance, funcionarioController, authGuards));
  app.addHook("onClose", async () => pool.end());
  return app;
}
