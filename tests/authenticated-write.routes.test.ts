import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { CadastrarProduto } from "../src/application/use-cases/produto/cadastrar-produto.js";
import type { ListarProdutos } from "../src/application/use-cases/produto/listar-produtos.js";
import type { GerenciarCatalogo } from "../src/application/use-cases/catalogo/gerenciar-catalogo.js";
import { SignedTokenService } from "../src/infrastructure/security/signed-token.js";
import { ProdutoController } from "../src/presentation/http/controllers/produto.controller.js";
import { CatalogController } from "../src/presentation/http/controllers/catalog.controller.js";
import { createAuthGuards } from "../src/presentation/http/routes/auth-guards.js";
import { produtoRoutes } from "../src/presentation/http/routes/produto.routes.js";
import { catalogRoutes } from "../src/presentation/http/routes/catalog.routes.js";
import type { GerenciarAutenticacao } from "../src/application/use-cases/auth/gerenciar-autenticacao.js";

describe("identidade nas rotas de escrita autenticadas", () => {
  const tokenService = new SignedTokenService("test-secret-that-is-at-least-thirty-two-characters");
  const token = tokenService.issue(91, "admin");
  let app: ReturnType<typeof Fastify> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("encaminha userId ao cadastro de produto", async () => {
    const execute = vi.fn(async (_data: unknown, actorId: number) => ({ id: 1, nome: "Caneta", quantidade: 1, preco: 2, criadoEm: new Date(), categoriaId: null, estoqueMinimo: 0 }));
    const auth = { verificarToken: (value: string) => tokenService.verify(value), validarSessao: async () => ({ papel: "admin", podeMovimentar: false }) } as unknown as GerenciarAutenticacao;
    app = Fastify();
    await app.register(async (instance: FastifyInstance) => produtoRoutes(instance,
      new ProdutoController({ executar: execute } as unknown as CadastrarProduto, {} as ListarProdutos), createAuthGuards(auth)));

    const response = await app.inject({ method: "POST", url: "/produtos", headers: { authorization: `Bearer ${token}` }, payload: { nome: "Caneta", quantidade: 1, preco: 2 } });

    expect(response.statusCode).toBe(201);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ nome: "Caneta" }), 91);
  });

  it("encaminha userId às gravações de categoria e fornecedor", async () => {
    const criarCategoria = vi.fn(async (data: { nome: string }, actorId: number) => ({ id: 2, nome: data.nome, descricao: null, criadoEm: "2026-01-01" }));
    const criarFornecedor = vi.fn(async (data: { nome: string }, actorId: number) => ({ id: 3, nome: data.nome, email: null, telefone: null, documento: null, ativo: true, criadoEm: "2026-01-01" }));
    const catalog = { criarCategoria, criarFornecedor } as unknown as GerenciarCatalogo;
    const auth = { verificarToken: (value: string) => tokenService.verify(value), validarSessao: async () => ({ papel: "admin", podeMovimentar: false }) } as unknown as GerenciarAutenticacao;
    app = Fastify();
    await app.register(async (instance: FastifyInstance) => catalogRoutes(instance, new CatalogController(catalog), createAuthGuards(auth)));

    const categoria = await app.inject({ method: "POST", url: "/categorias", headers: { authorization: `Bearer ${token}` }, payload: { nome: "Papelaria" } });
    const fornecedor = await app.inject({ method: "POST", url: "/fornecedores", headers: { authorization: `Bearer ${token}` }, payload: { nome: "Distribuidora" } });

    expect(categoria.statusCode).toBe(201);
    expect(fornecedor.statusCode).toBe(201);
    expect(criarCategoria).toHaveBeenCalledWith({ nome: "Papelaria" }, 91);
    expect(criarFornecedor).toHaveBeenCalledWith({ nome: "Distribuidora" }, 91);
  });
});
