import type { Pool, PoolClient } from "pg";
import type { AuthRepository, PapelUsuario, UsuarioAuthDTO, UsuarioCredencialDTO } from "../../../domain/repositories/auth.repository.js";

async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function audit(client: PoolClient, actorId: number, action: string, userId: number, details: unknown = {}) {
  await client.query("INSERT INTO auditoria(usuario_id,acao,entidade,entidade_id,detalhes) VALUES($1,$2,'usuario',$3,$4)", [actorId, action, userId, JSON.stringify(details)]);
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly pool: Pool) {}

  async buscarPorEmail(email: string): Promise<UsuarioCredencialDTO | null> {
    const result = await this.pool.query<UsuarioCredencialDTO>(
      'SELECT id::float8 AS id,nome,email,papel,ativo,pode_movimentar AS "podeMovimentar",criado_em::text AS "criadoEm",senha_hash AS "senhaHash" FROM usuarios WHERE email=$1 AND ativo=TRUE',
      [email],
    );
    return result.rows[0] ?? null;
  }

  criarUsuario(data: { nome: string; email: string; senhaHash: string; papel: PapelUsuario; podeMovimentar: boolean; matricula?: string }, actor?: { userId: number; jti: string }): Promise<UsuarioAuthDTO> {
    return transaction(this.pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(89233291)");
      const count = await client.query<{ total: string }>("SELECT count(*)::text AS total FROM usuarios");
      const isFirstAdmin = Number(count.rows[0].total) === 0;
      if (!isFirstAdmin) {
        if (!actor) throw Object.assign(new Error("Autenticação necessária para cadastrar usuários."), { statusCode: 401 });
        const actorUser = await client.query<{ papel: PapelUsuario }>("SELECT u.papel FROM usuarios u WHERE u.id=$1 AND u.ativo=TRUE AND NOT EXISTS(SELECT 1 FROM tokens_revogados t WHERE t.jti=$2 AND t.expira_em>NOW())", [actor.userId, actor.jti]);
        if (!actorUser.rowCount) throw Object.assign(new Error("Sessão inválida ou usuário inativo."), { statusCode: 401 });
        const actorRole = actorUser.rows[0].papel;
        if (actorRole !== "admin" && actorRole !== "gerente") throw Object.assign(new Error("Permissão insuficiente para cadastrar funcionários."), { statusCode: 403 });
        if (actorRole === "gerente" && data.papel !== "funcionario") throw Object.assign(new Error("Gerentes só podem cadastrar funcionários."), { statusCode: 403 });
        if (actorRole !== "admin" && data.podeMovimentar) throw Object.assign(new Error("Somente um administrador pode conceder permissão de movimentação."), { statusCode: 403 });
      }
      const papel = isFirstAdmin ? "admin" : data.papel;
      const created = await client.query<UsuarioAuthDTO>(
        'INSERT INTO usuarios(nome,email,senha_hash,papel,pode_movimentar) VALUES($1,$2,$3,$4,$5) RETURNING id::float8 AS id,nome,email,papel,ativo,pode_movimentar AS "podeMovimentar",criado_em::text AS "criadoEm"',
        [data.nome, data.email, data.senhaHash, papel, papel === "funcionario" && data.podeMovimentar],
      );
      if (papel === "funcionario") {
        await client.query("INSERT INTO funcionarios(usuario_id,matricula) VALUES($1,$2)", [created.rows[0].id, data.matricula ?? null]);
      }
      await audit(client, actor?.userId ?? created.rows[0].id, "usuario_criado", created.rows[0].id, { papel, primeiroAdministrador: isFirstAdmin });
      return created.rows[0];
    });
  }

  async listarUsuarios(actor: { userId: number; jti: string }): Promise<UsuarioAuthDTO[]> {
    const result = await this.pool.query<UsuarioAuthDTO>(
      'SELECT id::float8 AS id,nome,email,papel,ativo,pode_movimentar AS "podeMovimentar",criado_em::text AS "criadoEm" FROM usuarios WHERE EXISTS(SELECT 1 FROM usuarios a WHERE a.id=$1 AND a.ativo=TRUE AND a.papel=\'admin\' AND NOT EXISTS(SELECT 1 FROM tokens_revogados t WHERE t.jti=$2 AND t.expira_em>NOW())) ORDER BY nome',
      [actor.userId, actor.jti],
    );
    return result.rows;
  }

  atualizarUsuario(id: number, data: { nome?: string; papel?: PapelUsuario; ativo?: boolean; podeMovimentar?: boolean }, actor: { userId: number; jti: string }): Promise<UsuarioAuthDTO | null> {
    return transaction(this.pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(89233291)");
      const acting = await client.query("SELECT 1 FROM usuarios WHERE id=$1 AND papel='admin' AND ativo=TRUE AND NOT EXISTS(SELECT 1 FROM tokens_revogados WHERE jti=$2 AND expira_em>NOW())", [actor.userId, actor.jti]);
      if (!acting.rowCount) throw Object.assign(new Error("Sessão administrativa inválida."), { statusCode: 403 });
      const current = await client.query<{ papel: PapelUsuario; ativo: boolean }>("SELECT papel,ativo FROM usuarios WHERE id=$1 FOR UPDATE", [id]);
      if (!current.rowCount) return null;
      const losesAdmin = current.rows[0].papel === "admin" && (data.ativo === false || (data.papel !== undefined && data.papel !== "admin"));
      if (losesAdmin) {
        const others = await client.query<{ total: string }>("SELECT count(*)::text AS total FROM usuarios WHERE ativo=TRUE AND papel='admin' AND id<>$1", [id]);
        if (Number(others.rows[0].total) === 0) throw Object.assign(new Error("O sistema precisa manter ao menos um administrador ativo."), { code: "LAST_ADMIN" });
      }
      const updated = await client.query<UsuarioAuthDTO>(
        'UPDATE usuarios SET nome=COALESCE($2,nome),papel=COALESCE($3,papel),ativo=COALESCE($4,ativo),pode_movimentar=COALESCE($5,pode_movimentar) WHERE id=$1 RETURNING id::float8 AS id,nome,email,papel,ativo,pode_movimentar AS "podeMovimentar",criado_em::text AS "criadoEm"',
        [id, data.nome ?? null, data.papel ?? null, data.ativo ?? null, data.podeMovimentar ?? null],
      );
      if (updated.rows[0].papel === "funcionario") {
        await client.query("INSERT INTO funcionarios(usuario_id) VALUES($1) ON CONFLICT(usuario_id) DO NOTHING", [id]);
      }
      await audit(client, actor.userId, "usuario_atualizado", id, data);
      return updated.rows[0];
    });
  }

  encerrarSessao(userId: number, jti: string, expiresAt: Date): Promise<void> {
    return transaction(this.pool, async (client) => {
      await client.query("INSERT INTO tokens_revogados(jti,usuario_id,expira_em) VALUES($1,$2,$3) ON CONFLICT(jti) DO NOTHING", [jti, userId, expiresAt]);
      await client.query("INSERT INTO auditoria(usuario_id,acao,entidade,detalhes) VALUES($1,'logout','sessao',$2)", [userId, JSON.stringify({ jti })]);
    });
  }

  async registrarLogin(userId: number): Promise<void> {
    await this.pool.query("INSERT INTO auditoria(usuario_id,acao,entidade,entidade_id,detalhes) VALUES($1,'login','sessao',$1,'{}'::jsonb)", [userId]);
  }

  async validarSessao(userId: number, jti: string): Promise<{ papel: PapelUsuario; podeMovimentar: boolean } | null> {
    const result = await this.pool.query<{ papel: PapelUsuario; podeMovimentar: boolean }>(
      'SELECT u.papel,u.pode_movimentar AS "podeMovimentar" FROM usuarios u LEFT JOIN tokens_revogados t ON t.jti=$2 AND t.expira_em>NOW() WHERE u.id=$1 AND u.ativo=TRUE AND t.jti IS NULL',
      [userId, jti],
    );
    return result.rows[0] ?? null;
  }

}
