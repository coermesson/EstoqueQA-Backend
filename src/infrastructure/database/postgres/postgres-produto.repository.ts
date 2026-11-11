
import type { Pool } from "pg";
import { Produto } from "../../../domain/entities/produto.js";
import type { ProdutoRepository } from "../../../domain/repositories/produto.repository.js";

interface ProdutoRow {
  id: number;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  quantidade: number;
  preco: string | number;
  criado_em: Date | string;
  categoria_id: number | null;
  estoque_minimo: number;
  ativo: boolean;
}

export class PostgresProdutoRepository implements ProdutoRepository {
  constructor(private readonly pool: Pool) {}

  async cadastrar(produto: Produto, usuarioId: number): Promise<Produto> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (produto.categoriaId !== null) {
        const category = await client.query("SELECT 1 FROM categorias WHERE id=$1 AND ativo=TRUE", [produto.categoriaId]);
        if (!category.rowCount) throw Object.assign(new Error("Categoria inexistente ou inativa."), { statusCode: 409 });
      }
      const resultado = await client.query<ProdutoRow>(
      `INSERT INTO produtos (codigo, nome, descricao, quantidade, preco, categoria_id, estoque_minimo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, codigo, nome, descricao, quantidade, preco, criado_em, categoria_id, estoque_minimo, ativo`,
      [
        produto.codigo,
        produto.nome,
        produto.descricao,
        produto.quantidade,
        produto.preco,
        produto.categoriaId,
        produto.estoqueMinimo,
      ],
      );
      const criado = this.converterParaEntidade(resultado.rows[0]);
      if (criado.quantidade > 0) {
        await client.query("INSERT INTO movimentacoes(produto_id,usuario_id,tipo,quantidade,motivo,observacao) VALUES($1,$2,'entrada',$3,$4,$4)", [criado.id, usuarioId, criado.quantidade, "Saldo inicial do cadastro"]);
      }
      await client.query("INSERT INTO auditoria(usuario_id,acao,entidade,entidade_id,detalhes) VALUES($1,$2,$3,$4,$5)", [usuarioId, "produto_criado", "produto", criado.id, JSON.stringify({ codigo: criado.codigo, categoriaId: criado.categoriaId, estoqueMinimo: criado.estoqueMinimo, saldoInicial: criado.quantidade })]);
      await client.query("COMMIT");
      return criado;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listarTodos(): Promise<Produto[]> {
    const resultado = await this.pool.query<ProdutoRow>(
      `SELECT id, codigo, nome, descricao, quantidade, preco, criado_em, categoria_id, estoque_minimo, ativo
       FROM produtos
       WHERE ativo=TRUE
       ORDER BY id`,
    );

    return resultado.rows.map((linha) =>
      this.converterParaEntidade(linha),
    );
  }

  private converterParaEntidade(linha: ProdutoRow): Produto {
    return new Produto({
      id: linha.id,
      codigo: linha.codigo ?? null,
      nome: linha.nome,
      descricao: linha.descricao,
      quantidade: linha.quantidade,
      preco: Number(linha.preco),
      criadoEm: new Date(linha.criado_em),
      categoriaId: linha.categoria_id,
      estoqueMinimo: linha.estoque_minimo,
      ativo: linha.ativo ?? true,
    });
  }
}
