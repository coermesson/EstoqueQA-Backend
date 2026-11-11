import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { PapelUsuario } from "../../../domain/repositories/auth.repository.js";
import type { GerenciarAutenticacao } from "../../../application/use-cases/auth/gerenciar-autenticacao.js";
import type { TokenClaims } from "../../../domain/security/token-provider.js";

type AuthRequest = FastifyRequest & { user?: TokenClaims };
const emailSchema = z.string().email().max(254);

function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  request.log.error(error);
  const failure = error as Error & { code?: string; statusCode?: number };
  if (failure.statusCode) return reply.code(failure.statusCode).send({ erro: failure.message });
  if (failure.code === "23505") return reply.code(409).send({ erro: "E-mail ou matrícula já cadastrados." });
  if (failure.code === "LAST_ADMIN") return reply.code(409).send({ erro: failure.message });
  return reply.code(500).send({ erro: "Não foi possível concluir a operação de usuário." });
}

export class AuthController {
  private readonly failedLogins = new Map<string, { count: number; startedAt: number }>();

  constructor(private readonly auth: GerenciarAutenticacao) {}

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = z.object({ email: emailSchema, senha: z.string().min(1).max(200) }).safeParse(request.body);
    if (!data.success) return reply.code(400).send({ erro: "Credenciais inválidas." });
    const now = Date.now();
    const key = request.ip;
    const current = this.failedLogins.get(key);
    if (current && now - current.startedAt < 15 * 60_000 && current.count >= 10) {
      const retryAfter = Math.ceil((15 * 60_000 - (now - current.startedAt)) / 1000);
      return reply.code(429).header("retry-after", String(retryAfter)).send({ erro: "Muitas tentativas de login. Tente novamente mais tarde." });
    }
    if (current && now - current.startedAt >= 15 * 60_000) this.failedLogins.delete(key);
    try {
      const result = await this.auth.login(data.data.email, data.data.senha);
      if (result) {
        this.failedLogins.delete(key);
        return result;
      }
      const bucket = this.failedLogins.get(key);
      if (!bucket) this.failedLogins.set(key, { count: 1, startedAt: now });
      else bucket.count += 1;
      if (this.failedLogins.size > 10_000) {
        for (const [ip, attempt] of this.failedLogins) if (now - attempt.startedAt >= 15 * 60_000) this.failedLogins.delete(ip);
        while (this.failedLogins.size > 10_000) this.failedLogins.delete(this.failedLogins.keys().next().value as string);
      }
      return reply.code(401).send({ erro: "E-mail ou senha incorretos." });
    } catch (error) { return sendError(request, reply, error); }
  };

  criarUsuario = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = z.object({ nome: z.string().trim().min(1).max(160), email: emailSchema, senha: z.string().min(10).max(200), papel: z.enum(["admin", "gerente", "funcionario"]).default("funcionario"), podeMovimentar: z.boolean().optional(), matricula: z.string().trim().max(40).optional() }).safeParse(request.body);
    if (!data.success) return reply.code(400).send({ erro: "Dados do usuário inválidos.", detalhes: data.error.issues });
    const token = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : "";
    const actor = this.auth.verificarToken(token);
    try {
      const user = await this.auth.criarUsuario(data.data, actor ? { userId: actor.userId, jti: actor.jti } : undefined);
      return reply.code(201).send(user);
    } catch (error) { return sendError(request, reply, error); }
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    const claims = (request as AuthRequest).user;
    if (!claims) return reply.code(401).send({ erro: "Autenticação necessária." });
    try { await this.auth.encerrarSessao(claims); return reply.code(204).send(); }
    catch (error) { return sendError(request, reply, error); }
  };

  listarUsuarios = async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = (request as AuthRequest).user;
    if (!actor) return reply.code(401).send({ erro: "Autenticação necessária." });
    try { return await this.auth.listarUsuarios({ userId: actor.userId, jti: actor.jti }); }
    catch (error) { return sendError(request, reply, error); }
  };

  atualizarUsuario = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = z.coerce.number().int().positive().safeParse(request.params.id);
    const data = z.object({ nome: z.string().trim().min(1).max(160).optional(), papel: z.enum(["admin", "gerente", "funcionario"]).optional(), ativo: z.boolean().optional(), podeMovimentar: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0).safeParse(request.body);
    if (!id.success || !data.success) return reply.code(400).send({ erro: "Dados de usuário inválidos." });
    const actor = (request as AuthRequest).user;
    if (!actor) return reply.code(401).send({ erro: "Autenticação necessária." });
    if (id.data === actor.userId && (data.data.ativo === false || (data.data.papel && data.data.papel !== "admin"))) return reply.code(400).send({ erro: "Não é permitido remover o próprio acesso administrativo." });
    try {
      const result = await this.auth.atualizarUsuario(id.data, data.data as { nome?: string; papel?: PapelUsuario; ativo?: boolean; podeMovimentar?: boolean }, { userId: actor.userId, jti: actor.jti });
      return result ?? reply.code(404).send({ erro: "Usuário não encontrado." });
    } catch (error) { return sendError(request, reply, error); }
  };
}
