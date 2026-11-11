import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { GerenciarAutenticacao } from "../src/application/use-cases/auth/gerenciar-autenticacao.js";
import { AuthController } from "../src/presentation/http/controllers/auth.controller.js";
import { createAuthGuards } from "../src/presentation/http/routes/auth-guards.js";
import { authRoutes } from "../src/presentation/http/routes/auth.routes.js";
import { SignedTokenService } from "../src/infrastructure/security/signed-token.js";

describe("limite de tentativas de login", () => {
  const tokenService = new SignedTokenService("login-test-secret-with-at-least-thirty-two-chars");
  const login = vi.fn(async () => null);
  const auth = {
    login,
    verificarToken: (token: string) => tokenService.verify(token),
    validarSessao: async () => ({ papel: "admin", podeMovimentar: false }),
  } as unknown as GerenciarAutenticacao;
  let app: ReturnType<typeof Fastify> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    login.mockClear();
  });

  it("limita a dez falhas por IP em quinze minutos", async () => {
    app = Fastify();
    await app.register(async (instance: FastifyInstance) => authRoutes(instance, new AuthController(auth), createAuthGuards(auth)));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "user@example.test", senha: "wrong-password" } });
      expect(response.statusCode).toBe(401);
    }
    const limited = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "user@example.test", senha: "wrong-password" } });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(login).toHaveBeenCalledTimes(10);
  });
});
