import type { Pool, PoolClient } from "pg";
import type { AtorFuncionario, FuncionarioDTO, FuncionarioRepository } from "../../../domain/repositories/funcionario.repository.js";
import type { PapelUsuario } from "../../../domain/entities/usuario.js";

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

async function audit(client: PoolClient, actorId: number, employeeId: number, details: unknown) {
  await client.query(
    "INSERT INTO auditoria(usuario_id,acao,entidade,entidade_id,detalhes) VALUES($1,'funcionario_atualizado','funcionario',$2,$3)",
    [actorId, employeeId, JSON.stringify(details)],
  );
}

export class PostgresFuncionarioRepository implements FuncionarioRepository {
  constructor(private readonly pool: Pool) {}

  async listarFuncionarios(actor: AtorFuncionario): Promise<FuncionarioDTO[]> {
    const result = await this.pool.query<FuncionarioDTO>(
      'SELECT u.id::float8 AS id,u.id::float8 AS "usuarioId",u.nome,u.email,u.ativo,u.pode_movimentar AS "podeMovimentar",f.matricula,f.criado_em::text AS "criadoEm" FROM funcionarios f JOIN usuarios u ON u.id=f.usuario_id WHERE u.papel=\'funcionario\' AND EXISTS(SELECT 1 FROM usuarios a WHERE a.id=$1 AND a.ativo=TRUE AND a.papel IN (\'admin\',\'gerente\') AND NOT EXISTS(SELECT 1 FROM tokens_revogados t WHERE t.jti=$2 AND t.expira_em>NOW())) ORDER BY u.nome',
      [actor.userId, actor.jti],
    );
    return result.rows;
  }

  async buscarFuncionario(id: number, actor: AtorFuncionario): Promise<FuncionarioDTO | null> {
    const result = await this.pool.query<FuncionarioDTO>(
      'SELECT u.id::float8 AS id,u.id::float8 AS "usuarioId",u.nome,u.email,u.ativo,u.pode_movimentar AS "podeMovimentar",f.matricula,f.criado_em::text AS "criadoEm" FROM funcionarios f JOIN usuarios u ON u.id=f.usuario_id WHERE u.id=$1 AND u.papel=\'funcionario\' AND EXISTS(SELECT 1 FROM usuarios a WHERE a.id=$2 AND a.ativo=TRUE AND a.papel IN (\'admin\',\'gerente\') AND NOT EXISTS(SELECT 1 FROM tokens_revogados t WHERE t.jti=$3 AND t.expira_em>NOW()))',
      [id, actor.userId, actor.jti],
    );
    return result.rows[0] ?? null;
  }

  atualizarFuncionario(id: number, data: { nome?: string; ativo?: boolean; podeMovimentar?: boolean; matricula?: string | null }, actor: AtorFuncionario): Promise<FuncionarioDTO | null> {
    return transaction(this.pool, async (client) => {
      const acting = await client.query<{ papel: PapelUsuario }>(
        "SELECT papel FROM usuarios WHERE id=$1 AND ativo=TRUE AND NOT EXISTS(SELECT 1 FROM tokens_revogados WHERE jti=$2 AND expira_em>NOW())",
        [actor.userId, actor.jti],
      );
      if (!acting.rowCount) throw Object.assign(new Error("Sessão inválida."), { statusCode: 401 });
      const actorRole = acting.rows[0].papel;
      if (actorRole !== "admin" && actorRole !== "gerente") throw Object.assign(new Error("Permissão insuficiente."), { statusCode: 403 });
      if (actorRole === "gerente" && (data.podeMovimentar !== undefined || data.matricula !== undefined)) {
        throw Object.assign(new Error("Gerentes não podem alterar permissões ou matrícula."), { statusCode: 403 });
      }

      const target = await client.query<{ usuarioId: number; papel: PapelUsuario }>(
        "SELECT u.id AS \"usuarioId\",u.papel FROM funcionarios f JOIN usuarios u ON u.id=f.usuario_id WHERE u.id=$1 AND u.papel='funcionario' FOR UPDATE OF u",
        [id],
      );
      if (!target.rowCount) return null;
      if (actorRole === "gerente" && target.rows[0].papel !== "funcionario") throw Object.assign(new Error("Gerentes só podem gerenciar funcionários."), { statusCode: 403 });

      await client.query(
        "UPDATE usuarios SET nome=COALESCE($2,nome),ativo=COALESCE($3,ativo),pode_movimentar=COALESCE($4,pode_movimentar) WHERE id=$1",
        [target.rows[0].usuarioId, data.nome ?? null, data.ativo ?? null, data.podeMovimentar ?? null],
      );
      if (data.matricula !== undefined) await client.query("UPDATE funcionarios SET matricula=$2 WHERE usuario_id=$1", [id, data.matricula]);
      await audit(client, actor.userId, target.rows[0].usuarioId, data);
      const employee = await client.query<FuncionarioDTO>(
        'SELECT u.id::float8 AS id,u.id::float8 AS "usuarioId",u.nome,u.email,u.ativo,u.pode_movimentar AS "podeMovimentar",f.matricula,f.criado_em::text AS "criadoEm" FROM funcionarios f JOIN usuarios u ON u.id=f.usuario_id WHERE u.id=$1',
        [id],
      );
      return employee.rows[0] ?? null;
    });
  }
}
