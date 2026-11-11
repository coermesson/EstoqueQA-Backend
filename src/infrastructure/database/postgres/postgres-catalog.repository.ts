import type { Pool, PoolClient } from "pg";
import type {
  CatalogRepository,
  CategoriaDTO,
  FornecedorDTO,
  ProdutoCatalogoDTO,
  ProdutoFornecedorDTO,
} from "../../../domain/repositories/catalog.repository.js";

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

async function audit(client: PoolClient, actorId: number, action: string, entity: string, entityId: number, details: unknown = {}) {
  await client.query(
    "INSERT INTO auditoria(usuario_id,acao,entidade,entidade_id,detalhes) VALUES($1,$2,$3,$4,$5)",
    [actorId, action, entity, entityId, JSON.stringify(details)],
  );
}

export class PostgresCatalogRepository implements CatalogRepository {
  constructor(private readonly pool: Pool) {}

  async listarCategorias(): Promise<CategoriaDTO[]> {
    const result = await this.pool.query<CategoriaDTO>(
      'SELECT id::float8 AS id,nome,descricao,ativo,criado_em::text AS "criadoEm" FROM categorias WHERE ativo=TRUE ORDER BY nome',
    );
    return result.rows;
  }

  async buscarCategoria(id: number): Promise<CategoriaDTO | null> {
    const result = await this.pool.query<CategoriaDTO>(
      'SELECT id::float8 AS id,nome,descricao,ativo,criado_em::text AS "criadoEm" FROM categorias WHERE id=$1 AND ativo=TRUE', [id],
    );
    return result.rows[0] ?? null;
  }

  criarCategoria(data: { nome: string; descricao?: string }, actorId: number): Promise<CategoriaDTO> {
    return transaction(this.pool, async (client) => {
      const result = await client.query<CategoriaDTO>(
        'INSERT INTO categorias(nome,descricao) VALUES($1,$2) RETURNING id::float8 AS id,nome,descricao,ativo,criado_em::text AS "criadoEm"',
        [data.nome, data.descricao ?? null],
      );
      await audit(client, actorId, "categoria_criada", "categoria", result.rows[0].id);
      return result.rows[0];
    });
  }

  atualizarCategoria(id: number, data: { nome?: string; descricao?: string | null }, actorId: number): Promise<CategoriaDTO | null> {
    return transaction(this.pool, async (client) => {
      const result = await client.query<CategoriaDTO>(
        'UPDATE categorias SET nome=COALESCE($2,nome),descricao=CASE WHEN $3 THEN $4 ELSE descricao END WHERE id=$1 AND ativo=TRUE RETURNING id::float8 AS id,nome,descricao,ativo,criado_em::text AS "criadoEm"',
        [id, data.nome ?? null, data.descricao !== undefined, data.descricao ?? null],
      );
      if (!result.rowCount) return null;
      await audit(client, actorId, "categoria_atualizada", "categoria", id, data);
      return result.rows[0];
    });
  }

  removerCategoria(id: number, actorId: number): Promise<boolean> {
    return transaction(this.pool, async (client) => {
      const result = await client.query("UPDATE categorias SET ativo=FALSE WHERE id=$1 AND ativo=TRUE RETURNING id", [id]);
      if (!result.rowCount) return false;
      await audit(client, actorId, "categoria_inativada", "categoria", id);
      return true;
    });
  }

  async listarFornecedores(): Promise<FornecedorDTO[]> {
    const result = await this.pool.query<FornecedorDTO>(
      'SELECT id::float8 AS id,nome,email,telefone,documento,ativo,criado_em::text AS "criadoEm" FROM fornecedores ORDER BY nome',
    );
    return result.rows;
  }

  async buscarFornecedor(id: number): Promise<FornecedorDTO | null> {
    const result = await this.pool.query<FornecedorDTO>(
      'SELECT id::float8 AS id,nome,email,telefone,documento,ativo,criado_em::text AS "criadoEm" FROM fornecedores WHERE id=$1', [id],
    );
    return result.rows[0] ?? null;
  }

  criarFornecedor(data: { nome: string; email?: string; telefone?: string; documento?: string }, actorId: number): Promise<FornecedorDTO> {
    return transaction(this.pool, async (client) => {
      const result = await client.query<FornecedorDTO>(
        'INSERT INTO fornecedores(nome,email,telefone,documento) VALUES($1,$2,$3,$4) RETURNING id::float8 AS id,nome,email,telefone,documento,ativo,criado_em::text AS "criadoEm"',
        [data.nome, data.email?.toLowerCase() ?? null, data.telefone ?? null, data.documento ?? null],
      );
      await audit(client, actorId, "fornecedor_criado", "fornecedor", result.rows[0].id);
      return result.rows[0];
    });
  }

  atualizarFornecedor(id: number, data: { nome?: string; email?: string | null; telefone?: string | null; documento?: string | null }, actorId: number): Promise<FornecedorDTO | null> {
    return transaction(this.pool, async (client) => {
      const result = await client.query<FornecedorDTO>(
        'UPDATE fornecedores SET nome=COALESCE($2,nome),email=CASE WHEN $3 THEN $4 ELSE email END,telefone=CASE WHEN $5 THEN $6 ELSE telefone END,documento=CASE WHEN $7 THEN $8 ELSE documento END WHERE id=$1 RETURNING id::float8 AS id,nome,email,telefone,documento,ativo,criado_em::text AS "criadoEm"',
        [id, data.nome ?? null, data.email !== undefined, data.email?.toLowerCase() ?? null, data.telefone !== undefined, data.telefone ?? null, data.documento !== undefined, data.documento ?? null],
      );
      if (!result.rowCount) return null;
      await audit(client, actorId, "fornecedor_atualizado", "fornecedor", id, data);
      return result.rows[0];
    });
  }

  desativarFornecedor(id: number, actorId: number): Promise<boolean> {
    return transaction(this.pool, async (client) => {
      const result = await client.query("UPDATE fornecedores SET ativo=FALSE WHERE id=$1 AND ativo=TRUE RETURNING id", [id]);
      if (!result.rowCount) return false;
      await audit(client, actorId, "fornecedor_desativado", "fornecedor", id);
      return true;
    });
  }

  async buscarProduto(id: number): Promise<ProdutoCatalogoDTO | null> {
    const result = await this.pool.query<ProdutoCatalogoDTO>(
      'SELECT id,codigo,nome,descricao,quantidade,preco::float8 AS preco,criado_em::text AS "criadoEm",categoria_id::float8 AS "categoriaId",estoque_minimo AS "estoqueMinimo",ativo FROM produtos WHERE id=$1 AND ativo=TRUE', [id],
    );
    return result.rows[0] ?? null;
  }

  atualizarProduto(id: number, data: { codigo?: string | null; nome?: string; descricao?: string | null; preco?: number; categoriaId?: number | null; estoqueMinimo?: number }, actorId: number): Promise<ProdutoCatalogoDTO | null> {
    return transaction(this.pool, async (client) => {
      if (data.categoriaId !== undefined && data.categoriaId !== null) {
        const category = await client.query("SELECT 1 FROM categorias WHERE id=$1 AND ativo=TRUE", [data.categoriaId]);
        if (!category.rowCount) throw Object.assign(new Error("Categoria inexistente ou inativa."), { statusCode: 409 });
      }
      const result = await client.query<ProdutoCatalogoDTO>(
        'UPDATE produtos SET nome=COALESCE($2,nome),descricao=CASE WHEN $3 THEN $4 ELSE descricao END,preco=COALESCE($5,preco),categoria_id=CASE WHEN $6 THEN $7 ELSE categoria_id END,estoque_minimo=COALESCE($8,estoque_minimo),codigo=CASE WHEN $9 THEN $10 ELSE codigo END WHERE id=$1 AND ativo=TRUE RETURNING id,codigo,nome,descricao,quantidade,preco::float8 AS preco,criado_em::text AS "criadoEm",categoria_id::float8 AS "categoriaId",estoque_minimo AS "estoqueMinimo",ativo',
        [id, data.nome ?? null, data.descricao !== undefined, data.descricao ?? null, data.preco ?? null, data.categoriaId !== undefined, data.categoriaId ?? null, data.estoqueMinimo ?? null, data.codigo !== undefined, data.codigo ?? null],
      );
      if (!result.rowCount) return null;
      await audit(client, actorId, "produto_atualizado", "produto", id, data);
      return result.rows[0];
    });
  }

  removerProduto(id: number, actorId: number): Promise<boolean> {
    return transaction(this.pool, async (client) => {
      const current = await client.query<{ quantidade: number }>("SELECT quantidade FROM produtos WHERE id=$1 AND ativo=TRUE FOR UPDATE", [id]);
      if (!current.rowCount) return false;
      if (current.rows[0].quantidade > 0) throw Object.assign(new Error("Esvazie o estoque antes de inativar o produto."), { statusCode: 409 });
      const result = await client.query("UPDATE produtos SET ativo=FALSE WHERE id=$1 AND ativo=TRUE RETURNING id", [id]);
      if (!result.rowCount) return false;
      await audit(client, actorId, "produto_inativado", "produto", id);
      return true;
    });
  }

  async listarFornecedoresDoProduto(id: number): Promise<ProdutoFornecedorDTO[]> {
    const result = await this.pool.query<ProdutoFornecedorDTO>(
      'SELECT pf.produto_id AS "produtoId",pf.fornecedor_id::float8 AS "fornecedorId",f.nome AS "fornecedorNome",pf.codigo_no_fornecedor AS "codigoNoFornecedor",pf.custo_atual::float8 AS "custoAtual",pf.criado_em::text AS "criadoEm" FROM produtos_fornecedores pf JOIN fornecedores f ON f.id=pf.fornecedor_id JOIN produtos p ON p.id=pf.produto_id WHERE pf.produto_id=$1 AND f.ativo=TRUE AND p.ativo=TRUE ORDER BY f.nome', [id],
    );
    return result.rows;
  }

  associarFornecedor(id: number, fornecedorId: number, codigo: string | undefined, custo: number | undefined, actorId: number): Promise<ProdutoFornecedorDTO> {
    return transaction(this.pool, async (client) => {
      const result = await client.query<ProdutoFornecedorDTO>(
        'INSERT INTO produtos_fornecedores(produto_id,fornecedor_id,codigo_no_fornecedor,custo_atual) SELECT $1,$2,$3,$4 WHERE EXISTS(SELECT 1 FROM produtos WHERE id=$1 AND ativo=TRUE) AND EXISTS(SELECT 1 FROM fornecedores WHERE id=$2 AND ativo=TRUE) ON CONFLICT(produto_id,fornecedor_id) DO UPDATE SET codigo_no_fornecedor=EXCLUDED.codigo_no_fornecedor,custo_atual=EXCLUDED.custo_atual RETURNING produto_id AS "produtoId",fornecedor_id::float8 AS "fornecedorId",NULL::text AS "fornecedorNome",codigo_no_fornecedor AS "codigoNoFornecedor",custo_atual::float8 AS "custoAtual",criado_em::text AS "criadoEm"',
        [id, fornecedorId, codigo ?? null, custo ?? null],
      );
      if (!result.rowCount) throw Object.assign(new Error("Produto ou fornecedor inexistente/inativo."), { code: "NOT_FOUND" });
      const joined = await client.query<ProdutoFornecedorDTO>(
        'SELECT pf.produto_id AS "produtoId",pf.fornecedor_id::float8 AS "fornecedorId",f.nome AS "fornecedorNome",pf.codigo_no_fornecedor AS "codigoNoFornecedor",pf.custo_atual::float8 AS "custoAtual",pf.criado_em::text AS "criadoEm" FROM produtos_fornecedores pf JOIN fornecedores f ON f.id=pf.fornecedor_id WHERE pf.produto_id=$1 AND pf.fornecedor_id=$2',
        [id, fornecedorId],
      );
      await audit(client, actorId, "fornecedor_associado_produto", "produto", id, { fornecedorId, codigoNoFornecedor: codigo ?? null });
      return joined.rows[0];
    });
  }

  removerFornecedorDoProduto(id: number, fornecedorId: number, actorId: number): Promise<boolean> {
    return transaction(this.pool, async (client) => {
      const result = await client.query("DELETE FROM produtos_fornecedores WHERE produto_id=$1 AND fornecedor_id=$2 RETURNING produto_id", [id, fornecedorId]);
      if (!result.rowCount) return false;
      await audit(client, actorId, "fornecedor_desassociado_produto", "produto", id, { fornecedorId });
      return true;
    });
  }
}
