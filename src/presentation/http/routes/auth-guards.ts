import type { FastifyReply, FastifyRequest } from "fastify";
import type { GerenciarAutenticacao } from "../../../application/use-cases/auth/gerenciar-autenticacao.js";
import type { TokenClaims } from "../../../domain/security/token-provider.js";
import type { PapelUsuario } from "../../../domain/repositories/auth.repository.js";

type AuthenticatedRequest = FastifyRequest & { user?: TokenClaims };

export function createAuthGuards(auth: GerenciarAutenticacao) {
  const guard = (allowedRoles: PapelUsuario[], requireMovementPermission = false) => async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    const claims = auth.verificarToken(token);
    if (!claims) return reply.code(401).send({ erro: "Autenticação necessária." });
    try {
      const session = await auth.validarSessao(claims.userId, claims.jti);
      if (!session) return reply.code(401).send({ erro: "Sessão inválida, encerrada ou usuário inativo." });
      if (!allowedRoles.includes(session.papel)) return reply.code(403).send({ erro: "Permissão insuficiente." });
      if (requireMovementPermission && session.papel === "funcionario" && !session.podeMovimentar) {
        return reply.code(403).send({ erro: "Este funcionário não tem permissão para registrar movimentações." });
      }
      (request as AuthenticatedRequest).user = { ...claims, role: session.papel };
      return undefined;
    } catch {
      return reply.code(503).send({ erro: "Não foi possível validar a sessão." });
    }
  };

  return {
    exigirLeitura: guard(["admin", "gerente", "funcionario"]),
    exigirEscrita: guard(["admin", "gerente"]),
    exigirMovimentacao: guard(["admin", "gerente", "funcionario"], true),
    exigirGestao: guard(["admin", "gerente"]),
    exigirAdmin: guard(["admin"]),
    exigirGestaoFuncionarios: guard(["admin", "gerente"]),
  };
}

export type AuthGuards = ReturnType<typeof createAuthGuards>;
