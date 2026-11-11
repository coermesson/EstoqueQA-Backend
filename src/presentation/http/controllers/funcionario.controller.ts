import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { GerenciarFuncionarios } from "../../../application/use-cases/funcionarios/gerenciar-funcionarios.js";
import type { TokenClaims } from "../../../domain/security/token-provider.js";

type AuthRequest = FastifyRequest & { user?: TokenClaims };
const idSchema = z.coerce.number().int().positive();
const emailSchema = z.string().email().max(254);

function actor(request: FastifyRequest) {
  const user = (request as AuthRequest).user;
  if (!user) throw Object.assign(new Error("Autenticação necessária."), { statusCode: 401 });
  return { userId: user.userId, jti: user.jti };
}

function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  request.log.error(error);
  const failure = error as Error & { statusCode?: number; code?: string };
  if (failure.statusCode) return reply.code(failure.statusCode).send({ erro: failure.message });
  if (failure.code === "23505") return reply.code(409).send({ erro: "E-mail ou matrícula já cadastrados." });
  return reply.code(500).send({ erro: "Não foi possível concluir a operação de funcionário." });
}

export class FuncionarioController {
  constructor(private readonly funcionarios: GerenciarFuncionarios) {}

  listar = async (request: FastifyRequest, reply: FastifyReply) => {
    try { return await this.funcionarios.listar(actor(request)); }
    catch (error) { return sendError(request, reply, error); }
  };

  buscar = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ erro: "ID inválido." });
    try { return await this.funcionarios.buscar(id.data, actor(request)) ?? reply.code(404).send({ erro: "Funcionário não encontrado." }); }
    catch (error) { return sendError(request, reply, error); }
  };

  criar = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = z.object({
      nome: z.string().trim().min(1).max(160), email: emailSchema,
      senha: z.string().min(10).max(200), matricula: z.string().trim().max(40).optional(),
      podeMovimentar: z.boolean().optional(),
    }).safeParse(request.body);
    if (!data.success) return reply.code(400).send({ erro: "Dados do funcionário inválidos.", detalhes: data.error.issues });
    try { return reply.code(201).send(await this.funcionarios.criar(data.data, actor(request))); }
    catch (error) { return sendError(request, reply, error); }
  };

  atualizar = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    const data = z.object({
      nome: z.string().trim().min(1).max(160).optional(), ativo: z.boolean().optional(),
      podeMovimentar: z.boolean().optional(), matricula: z.string().trim().max(40).nullable().optional(),
    }).refine((value) => Object.keys(value).length > 0).safeParse(request.body);
    if (!id.success || !data.success) return reply.code(400).send({ erro: "Dados do funcionário inválidos." });
    try { return await this.funcionarios.atualizar(id.data, data.data, actor(request)) ?? reply.code(404).send({ erro: "Funcionário não encontrado." }); }
    catch (error) { return sendError(request, reply, error); }
  };

  inativar = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ erro: "ID inválido." });
    try {
      const result = await this.funcionarios.atualizar(id.data, { ativo: false }, actor(request));
      return result ? reply.code(200).send(result) : reply.code(404).send({ erro: "Funcionário não encontrado." });
    } catch (error) { return sendError(request, reply, error); }
  };
}
