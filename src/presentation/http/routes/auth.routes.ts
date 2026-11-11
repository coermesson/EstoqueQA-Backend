import type { FastifyInstance } from "fastify";
import type { AuthController } from "../controllers/auth.controller.js";
import type { AuthGuards } from "./auth-guards.js";

export async function authRoutes(app: FastifyInstance, controller: AuthController, guards: AuthGuards): Promise<void> {
  app.post("/auth/login", controller.login);
  app.post("/auth/usuarios", controller.criarUsuario);
  app.post("/auth/logout", { preHandler: guards.exigirLeitura }, controller.logout);
  app.get("/auth/usuarios", { preHandler: guards.exigirAdmin }, controller.listarUsuarios);
  app.patch<{ Params: { id: string } }>("/auth/usuarios/:id", { preHandler: guards.exigirAdmin }, controller.atualizarUsuario);
}
