import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { SignedTokenService } from "../src/infrastructure/security/signed-token.js";
import type { GerenciarAutenticacao } from "../src/application/use-cases/auth/gerenciar-autenticacao.js";
import type { GerenciarEstoque } from "../src/application/use-cases/estoque/gerenciar-estoque.js";
import { InventoryController } from "../src/presentation/http/controllers/inventory.controller.js";
import { createAuthGuards } from "../src/presentation/http/routes/auth-guards.js";

process.env.JWT_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
const { inventoryRoutes } = await import("../src/presentation/http/routes/inventory.routes.js");

describe("rotas do estoque", () => {
  let app: ReturnType<typeof Fastify>;
  let validationCalls = vi.fn();
  const tokenService = new SignedTokenService(process.env.JWT_SECRET);
  const auth = {
    verificarToken: (token: string) => tokenService.verify(token),
    validarSessao: async (userId: number, jti: string) => validationCalls(userId, jti),
  } as unknown as GerenciarAutenticacao;
  const inventory = {
    listarMovimentacoes: vi.fn(async () => ({ itens: [{ id: 3, tipo: "entrada" }], pagina: 1, limite: 100, total: 1 })),
    registrarMovimentacao: vi.fn(async () => ({ id: 4, tipo: "entrada" })),
  } as unknown as GerenciarEstoque;

  beforeEach(async () => {
    validationCalls = vi.fn(async () => ({ papel: "admin", podeMovimentar: false }));
    app = Fastify();
    await inventoryRoutes(app, new InventoryController(inventory), createAuthGuards(auth));
    await app.ready();
  });

  afterEach(async () => app.close());

  it("protege recursos que exigem autenticação", async () => {
    const response = await app.inject({ method: "GET", url: "/movimentacoes" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ erro: "Autenticação necessária." });
  });

  it("recusa filtros de relatório com data inválida", async () => {
    const response = await app.inject({ method: "GET", url: "/relatorios/movimentacoes?inicio=inválido", headers: { authorization: `Bearer ${createToken(12, "funcionario")}` } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ erro: "Filtros inválidos.", detalhes: expect.any(Array) });
  });

  it("protege operações de movimentação", async () => {
    const response = await app.inject({ method: "POST", url: "/movimentacoes", payload: { produtoId: 1, tipo: "saida", quantidade: 1 } });
    expect(response.statusCode).toBe(401);
  });

  it("consulta o papel atual antes de liberar leitura", async () => {
    validationCalls.mockResolvedValueOnce({ papel: "funcionario", podeMovimentar: false });
    const response = await app.inject({ method: "GET", url: "/movimentacoes", headers: { authorization: `Bearer ${createToken(12, "admin")}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ itens: [{ id: 3, tipo: "entrada" }], pagina: 1, limite: 100, total: 1 });
    expect(validationCalls).toHaveBeenCalledOnce();
  });

  it("nega sessão revogada ou usuário desativado", async () => {
    validationCalls.mockResolvedValueOnce(null);
    const response = await app.inject({ method: "GET", url: "/movimentacoes", headers: { authorization: `Bearer ${createToken(12, "admin")}` } });
    expect(response.statusCode).toBe(401);
  });

  it("nega acesso administrativo após rebaixamento de papel", async () => {
    validationCalls.mockResolvedValueOnce({ papel: "funcionario", podeMovimentar: false });
    const response = await app.inject({ method: "GET", url: "/auditoria", headers: { authorization: `Bearer ${createToken(12, "admin")}` } });
    expect(response.statusCode).toBe(403);
  });

  it("permite movimentação de funcionário somente quando a permissão está concedida", async () => {
    validationCalls.mockResolvedValueOnce({ papel: "funcionario", podeMovimentar: false });
    const denied = await app.inject({ method: "POST", url: "/movimentacoes", headers: { authorization: `Bearer ${createToken(12, "admin")}` }, payload: { produtoId: 1, tipo: "entrada", quantidade: 1, motivo: "Teste" } });
    expect(denied.statusCode).toBe(403);
    validationCalls.mockResolvedValueOnce({ papel: "funcionario", podeMovimentar: true });
    const allowed = await app.inject({ method: "POST", url: "/movimentacoes", headers: { authorization: `Bearer ${createToken(12, "admin")}` }, payload: { produtoId: 1, tipo: "entrada", quantidade: 1, motivo: "Teste" } });
    expect(allowed.statusCode).toBe(201);
  });
});

function createToken(id: number, role: "admin" | "gerente" | "funcionario"): string {
  const payload = Buffer.from(JSON.stringify({ sub: id, role, exp: Date.now() + 60_000, jti: "123e4567-e89b-12d3-a456-426614174000" })).toString("base64url");
  const signature = createHmac("sha256", process.env.JWT_SECRET!).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
