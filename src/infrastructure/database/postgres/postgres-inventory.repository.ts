import type { Pool, PoolClient } from "pg";
import { calcularSaldoAposMovimentacao } from "../../../domain/entities/estoque.js";
import type {
  FiltroEstoque,
  FiltroMovimentacao,
  FiltroRelatorio,
  FiltroRelatorioProdutos,
  InventoryRepository,
  MovimentacaoInput,
  Paginado,
} from "../../../domain/repositories/inventory.repository.js";

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

async function audit(client: PoolClient, actorId: number, action: string, productId: number, details: unknown) {
  await client.query("INSERT INTO auditoria(usuario_id,acao,entidade,entidade_id,detalhes) VALUES($1,$2,'produto',$3,$4)", [actorId, action, productId, JSON.stringify(details)]);
}

function paginated<T>(items: T[], pagina: number, limite: number, count: { total: string }): Paginado<T> {
  return { itens: items, pagina, limite, total: Number(count.total) };
}

export class PostgresInventoryRepository implements InventoryRepository {
  constructor(private readonly pool: Pool) {}

  async listarProdutos(filtros: FiltroEstoque): Promise<Paginado<Record<string, unknown>>> {
    const parameters = [filtros.busca ?? null, filtros.categoriaId ?? null, filtros.abaixoDoMinimo ?? null];
    const [items, count] = await Promise.all([
      this.pool.query('SELECT p.id,p.codigo,p.nome,p.descricao,p.quantidade,p.preco::float8 AS preco,p.criado_em AS "criadoEm",p.categoria_id::float8 AS "categoriaId",p.estoque_minimo AS "estoqueMinimo",c.nome AS "categoriaNome",(p.quantidade<=p.estoque_minimo) AS "abaixoDoMinimo" FROM produtos p LEFT JOIN categorias c ON c.id=p.categoria_id WHERE p.ativo=TRUE AND ($1::text IS NULL OR p.nome ILIKE \'%\' || $1 || \'%\' OR p.codigo ILIKE \'%\' || $1 || \'%\') AND ($2::bigint IS NULL OR p.categoria_id=$2) AND ($3::boolean IS NULL OR (p.quantidade<=p.estoque_minimo)=$3) ORDER BY p.id LIMIT $4 OFFSET $5', [...parameters, filtros.limite, (filtros.pagina - 1) * filtros.limite]),
      this.pool.query<{ total: string }>('SELECT count(*)::text AS total FROM produtos p WHERE p.ativo=TRUE AND ($1::text IS NULL OR p.nome ILIKE \'%\' || $1 || \'%\' OR p.codigo ILIKE \'%\' || $1 || \'%\') AND ($2::bigint IS NULL OR p.categoria_id=$2) AND ($3::boolean IS NULL OR (p.quantidade<=p.estoque_minimo)=$3)', parameters),
    ]);
    return paginated(items.rows, filtros.pagina, filtros.limite, count.rows[0]);
  }

  registrarMovimentacao(data: MovimentacaoInput, actorId: number): Promise<Record<string, unknown>> {
    return transaction(this.pool, async (client) => {
      const product = await client.query<{ quantidade: number }>("SELECT quantidade FROM produtos WHERE id=$1 AND ativo=TRUE FOR UPDATE", [data.produtoId]);
      if (!product.rowCount) throw Object.assign(new Error("Produto não encontrado."), { statusCode: 404 });
      let newBalance: number;
      try { newBalance = calcularSaldoAposMovimentacao(product.rows[0].quantidade, data.tipo, data.quantidade); }
      catch (error) { throw Object.assign(error as Error, { statusCode: 409 }); }

      if (data.fornecedorId) {
        const supplier = await client.query("SELECT 1 FROM produtos_fornecedores pf JOIN fornecedores f ON f.id=pf.fornecedor_id WHERE pf.produto_id=$1 AND pf.fornecedor_id=$2 AND f.ativo=TRUE", [data.produtoId, data.fornecedorId]);
        if (!supplier.rowCount) throw Object.assign(new Error("Associe um fornecedor ativo ao produto antes da movimentação."), { statusCode: 409 });
      }

      await client.query("UPDATE produtos SET quantidade=$2 WHERE id=$1", [data.produtoId, newBalance]);
      const movement = await client.query(
        'INSERT INTO movimentacoes(produto_id,fornecedor_id,usuario_id,tipo,quantidade,motivo,observacao) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::float8 AS id,produto_id AS "produtoId",fornecedor_id::float8 AS "fornecedorId",usuario_id::float8 AS "usuarioId",tipo,quantidade,motivo,observacao,criado_em AS "criadoEm"',
        [data.produtoId, data.fornecedorId ?? null, actorId, data.tipo, data.quantidade, data.motivo, data.observacao ?? data.motivo],
      );
      await audit(client, actorId, `estoque_${data.tipo}`, data.produtoId, { quantidade: data.quantidade, saldo: newBalance, motivo: data.motivo, fornecedorId: data.fornecedorId ?? null });
      return { ...movement.rows[0], saldoAtual: newBalance };
    });
  }

  async listarMovimentacoes(filtros: FiltroMovimentacao): Promise<Paginado<Record<string, unknown>>> {
    const params = [filtros.produtoId ?? null];
    const [items, count] = await Promise.all([
      this.pool.query('SELECT m.id::float8 AS id,m.produto_id AS "produtoId",m.fornecedor_id::float8 AS "fornecedorId",m.usuario_id::float8 AS "usuarioId",m.tipo,m.quantidade,m.motivo,m.observacao,m.criado_em AS "criadoEm",p.nome AS "produtoNome",f.nome AS "fornecedorNome",u.nome AS "usuarioNome" FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id LEFT JOIN fornecedores f ON f.id=m.fornecedor_id LEFT JOIN usuarios u ON u.id=m.usuario_id WHERE ($1::bigint IS NULL OR m.produto_id=$1) ORDER BY m.criado_em DESC,m.id DESC LIMIT $2 OFFSET $3', [params[0], filtros.limite, (filtros.pagina - 1) * filtros.limite]),
      this.pool.query<{ total: string }>("SELECT count(*)::text AS total FROM movimentacoes WHERE ($1::bigint IS NULL OR produto_id=$1)", params),
    ]);
    return paginated(items.rows, filtros.pagina, filtros.limite, count.rows[0]);
  }

  async dashboard(): Promise<Record<string, unknown>> {
    const [summary, monthly, recent] = await Promise.all([
      this.pool.query("SELECT count(*)::int AS total_produtos,COALESCE(sum(quantidade),0)::int AS unidades_em_estoque,count(*) FILTER(WHERE quantidade<=estoque_minimo)::int AS produtos_abaixo_minimo,count(*) FILTER(WHERE quantidade=0)::int AS produtos_sem_estoque,(SELECT count(*)::int FROM categorias WHERE ativo=TRUE) AS total_categorias,(SELECT count(*)::int FROM fornecedores WHERE ativo=TRUE) AS total_fornecedores,COALESCE(sum(quantidade*preco),0)::float8 AS valor_estimado_estoque FROM produtos WHERE ativo=TRUE"),
      this.pool.query("SELECT date_trunc('month',criado_em)::date AS mes,tipo,sum(quantidade)::int AS quantidade FROM movimentacoes WHERE criado_em>=date_trunc('month',NOW())-interval '11 months' GROUP BY 1,2 ORDER BY 1,2"),
      this.pool.query('SELECT m.id::float8 AS id,m.tipo,m.quantidade,m.motivo,m.criado_em AS "criadoEm",p.id AS "produtoId",p.nome AS "produtoNome",u.id::float8 AS "usuarioId",u.nome AS "usuarioNome" FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id LEFT JOIN usuarios u ON u.id=m.usuario_id ORDER BY m.criado_em DESC,m.id DESC LIMIT 10'),
    ]);
    return { resumo: summary.rows[0], movimentacoesPorMes: monthly.rows, movimentacoesRecentes: recent.rows };
  }

  async alertas(): Promise<Record<string, unknown>> {
    const [empty, belowMinimum] = await Promise.all([
      this.pool.query('SELECT id,nome,quantidade,estoque_minimo AS "estoqueMinimo" FROM produtos WHERE ativo=TRUE AND quantidade=0 ORDER BY nome'),
      this.pool.query('SELECT id,nome,quantidade,estoque_minimo AS "estoqueMinimo" FROM produtos WHERE ativo=TRUE AND quantidade>0 AND quantidade<=estoque_minimo ORDER BY quantidade,nome'),
    ]);
    return { produtosSemEstoque: empty.rows, abaixoDoMinimo: belowMinimum.rows };
  }

  async relatorio(filters: FiltroRelatorio): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      'SELECT m.id::float8 AS id,m.tipo,m.quantidade,m.motivo,m.observacao,m.criado_em AS "criadoEm",p.id AS "produtoId",p.codigo AS "produtoCodigo",p.nome AS produto,c.id::float8 AS "categoriaId",c.nome AS categoria,f.id::float8 AS "fornecedorId",f.nome AS fornecedor,u.id::float8 AS "usuarioId",u.nome AS usuario FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id LEFT JOIN categorias c ON c.id=p.categoria_id LEFT JOIN fornecedores f ON f.id=m.fornecedor_id LEFT JOIN usuarios u ON u.id=m.usuario_id WHERE ($1::timestamptz IS NULL OR m.criado_em>=$1) AND ($2::timestamptz IS NULL OR m.criado_em<=$2) AND ($3::text IS NULL OR m.tipo=$3) AND ($4::bigint IS NULL OR m.produto_id=$4) AND ($5::bigint IS NULL OR p.categoria_id=$5) AND ($6::bigint IS NULL OR m.fornecedor_id=$6) ORDER BY m.criado_em DESC,m.id DESC LIMIT 5000',
      [filters.inicio ?? null, filters.fim ?? null, filters.tipo ?? null, filters.produtoId ?? null, filters.categoriaId ?? null, filters.fornecedorId ?? null],
    );
    return result.rows;
  }

  async relatorioProdutos(filters: FiltroRelatorioProdutos): Promise<Paginado<Record<string, unknown>>> {
    const params = [filters.busca ?? null, filters.categoriaId ?? null, filters.fornecedorId ?? null, filters.abaixoDoMinimo ?? null];
    const [items, count] = await Promise.all([
      this.pool.query(
        'SELECT p.id,p.codigo,p.nome,p.descricao,p.quantidade,p.estoque_minimo AS "estoqueMinimo",(p.quantidade<=p.estoque_minimo) AS "abaixoDoMinimo",p.preco::float8 AS preco,(p.quantidade*p.preco)::float8 AS "valorEmEstoque",p.criado_em AS "criadoEm",p.categoria_id::float8 AS "categoriaId",c.nome AS categoria,COALESCE((SELECT json_agg(json_build_object(\'id\',f.id,\'nome\',f.nome)) FROM produtos_fornecedores pf JOIN fornecedores f ON f.id=pf.fornecedor_id WHERE pf.produto_id=p.id AND f.ativo=TRUE),\'[]\'::json) AS fornecedores FROM produtos p LEFT JOIN categorias c ON c.id=p.categoria_id WHERE p.ativo=TRUE AND ($1::text IS NULL OR p.nome ILIKE \'%\'||$1||\'%\' OR p.codigo ILIKE \'%\'||$1||\'%\') AND ($2::bigint IS NULL OR p.categoria_id=$2) AND ($3::bigint IS NULL OR EXISTS(SELECT 1 FROM produtos_fornecedores pf JOIN fornecedores f ON f.id=pf.fornecedor_id WHERE pf.produto_id=p.id AND pf.fornecedor_id=$3 AND f.ativo=TRUE)) AND ($4::boolean IS NULL OR (p.quantidade<=p.estoque_minimo)=$4) ORDER BY p.nome LIMIT $5 OFFSET $6',
        [...params, filters.limite, (filters.pagina - 1) * filters.limite],
      ),
      this.pool.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM produtos p WHERE p.ativo=TRUE AND ($1::text IS NULL OR p.nome ILIKE \'%\'||$1||\'%\' OR p.codigo ILIKE \'%\'||$1||\'%\') AND ($2::bigint IS NULL OR p.categoria_id=$2) AND ($3::bigint IS NULL OR EXISTS(SELECT 1 FROM produtos_fornecedores pf JOIN fornecedores f ON f.id=pf.fornecedor_id WHERE pf.produto_id=p.id AND pf.fornecedor_id=$3 AND f.ativo=TRUE)) AND ($4::boolean IS NULL OR (p.quantidade<=p.estoque_minimo)=$4)',
        params,
      ),
    ]);
    return paginated(items.rows, filters.pagina, filters.limite, count.rows[0]);
  }

  async listarAuditoria(pagina: number, limite: number): Promise<Paginado<Record<string, unknown>>> {
    const [items, count] = await Promise.all([
      this.pool.query('SELECT a.id::float8 AS id,a.usuario_id::float8 AS "usuarioId",u.nome AS "usuarioNome",a.acao,a.entidade,a.entidade_id::float8 AS "entidadeId",a.detalhes,a.criado_em AS "criadoEm" FROM auditoria a LEFT JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.criado_em DESC,a.id DESC LIMIT $1 OFFSET $2', [limite, (pagina - 1) * limite]),
      this.pool.query<{ total: string }>("SELECT count(*)::text AS total FROM auditoria"),
    ]);
    return paginated(items.rows, pagina, limite, count.rows[0]);
  }
}
