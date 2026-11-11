import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { GerenciarEstoque } from "../../../application/use-cases/estoque/gerenciar-estoque.js";
import type { TokenClaims } from "../../../domain/security/token-provider.js";

type AuthRequest = FastifyRequest & { user?: TokenClaims };
const idSchema = z.coerce.number().int().positive();
const reportSchema = z.object({ inicio: z.string().datetime().optional(), fim: z.string().datetime().optional(), tipo: z.enum(["entrada", "saida"]).optional(), produtoId: idSchema.optional(), categoriaId: idSchema.optional(), fornecedorId: idSchema.optional() });

function errorResponse(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  request.log.error(error);
  const failure = error as Error & { statusCode?: number; code?: string };
  if (failure.statusCode) return reply.code(failure.statusCode).send({ erro: failure.message });
  if (failure.code === "23503") return reply.code(409).send({ erro: "Fornecedor não associado ao produto ou registro relacionado impede a operação." });
  return reply.code(500).send({ erro: "Não foi possível concluir a operação de estoque." });
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export class InventoryController {
  constructor(private readonly inventory: GerenciarEstoque) {}

  listarProdutos = async (request: FastifyRequest, reply: FastifyReply) => {
    const filters = z.object({ busca: z.string().max(120).optional(), categoriaId: idSchema.optional(), abaixoDoMinimo: z.enum(["true", "false"]).transform((value) => value === "true").optional(), pagina: z.coerce.number().int().min(1).default(1), limite: z.coerce.number().int().min(1).max(200).default(50) }).safeParse(request.query);
    if (!filters.success) return reply.code(400).send({ erro: "Filtros inválidos." });
    try { return await this.inventory.listarProdutos(filters.data); }
    catch (error) { return errorResponse(request, reply, error); }
  };

  registrarMovimentacao = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = z.object({ produtoId: idSchema, tipo: z.enum(["entrada", "saida"]), quantidade: z.number().int().positive(), fornecedorId: idSchema.optional(), motivo: z.string().trim().min(1).max(500).optional(), observacao: z.string().max(2000).optional() }).refine((value) => Boolean(value.motivo || value.observacao?.trim()), "O motivo da movimentação é obrigatório.").safeParse(request.body);
    if (!data.success) return reply.code(400).send({ erro: "Movimentação inválida.", detalhes: data.error.issues });
    const actorId = (request as AuthRequest).user?.userId;
    if (!actorId) return reply.code(401).send({ erro: "Autenticação necessária." });
    try {
      return reply.code(201).send(await this.inventory.registrarMovimentacao({ ...data.data, motivo: data.data.motivo ?? data.data.observacao!.trim() }, actorId));
    } catch (error) { return errorResponse(request, reply, error); }
  };

  listarMovimentacoes = async (request: FastifyRequest, reply: FastifyReply) => {
    const filters = z.object({ produtoId: idSchema.optional(), pagina: z.coerce.number().int().min(1).default(1), limite: z.coerce.number().int().min(1).max(500).default(100) }).safeParse(request.query);
    if (!filters.success) return reply.code(400).send({ erro: "Filtros inválidos." });
    try { return await this.inventory.listarMovimentacoes(filters.data); }
    catch (error) { return errorResponse(request, reply, error); }
  };

  dashboard = async (request: FastifyRequest, reply: FastifyReply) => {
    try { return await this.inventory.dashboard(); }
    catch (error) { return errorResponse(request, reply, error); }
  };

  alertas = async (request: FastifyRequest, reply: FastifyReply) => {
    try { return await this.inventory.alertas(); }
    catch (error) { return errorResponse(request, reply, error); }
  };

  relatorio = async (request: FastifyRequest, reply: FastifyReply) => {
    const filters = reportSchema.safeParse(request.query);
    if (!filters.success) return reply.code(400).send({ erro: "Filtros inválidos.", detalhes: filters.error.issues });
    if (filters.data.inicio && filters.data.fim && filters.data.inicio > filters.data.fim) return reply.code(400).send({ erro: "A data inicial deve preceder a data final." });
    try { return await this.inventory.relatorio(filters.data); }
    catch (error) { return errorResponse(request, reply, error); }
  };

  exportarRelatorio = async (request: FastifyRequest, reply: FastifyReply) => {
    const filters = reportSchema.safeParse(request.query);
    if (!filters.success) return reply.code(400).send({ erro: "Filtros inválidos.", detalhes: filters.error.issues });
    if (filters.data.inicio && filters.data.fim && filters.data.inicio > filters.data.fim) return reply.code(400).send({ erro: "A data inicial deve preceder a data final." });
    try {
      const rows = await this.inventory.relatorio(filters.data);
      const columns = ["id", "tipo", "quantidade", "motivo", "criadoEm", "produtoId", "produtoCodigo", "produto", "categoriaId", "categoria", "fornecedorId", "fornecedor", "usuarioId", "usuario"];
      const csv = [columns, ...rows.map((row) => columns.map((column) => row[column]))].map((row) => row.map(csvCell).join(",")).join("\r\n");
      return reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", "attachment; filename=estoqueqa-movimentacoes.csv").send(`\uFEFF${csv}`);
    } catch (error) { return errorResponse(request, reply, error); }
  };

  relatorioProdutos = async (request: FastifyRequest, reply: FastifyReply) => {
    const filters = z.object({
      busca: z.string().max(120).optional(), categoriaId: idSchema.optional(), fornecedorId: idSchema.optional(),
      abaixoDoMinimo: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
      pagina: z.coerce.number().int().min(1).default(1), limite: z.coerce.number().int().min(1).max(200).default(50),
    }).safeParse(request.query);
    if (!filters.success) return reply.code(400).send({ erro: "Filtros inválidos.", detalhes: filters.error.issues });
    try { return await this.inventory.relatorioProdutos(filters.data); }
    catch (error) { return errorResponse(request, reply, error); }
  };

  exportarProdutosCsv = async (request: FastifyRequest, reply: FastifyReply) => {
    const filters = z.object({
      busca: z.string().max(120).optional(), categoriaId: idSchema.optional(), fornecedorId: idSchema.optional(),
      abaixoDoMinimo: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
      pagina: z.coerce.number().int().min(1).default(1), limite: z.coerce.number().int().min(1).max(5000).default(1000),
    }).safeParse(request.query);
    if (!filters.success) return reply.code(400).send({ erro: "Filtros inválidos.", detalhes: filters.error.issues });
    try {
      const result = await this.inventory.relatorioProdutos(filters.data);
      const columns = ["id", "codigo", "nome", "descricao", "categoria", "quantidade", "estoqueMinimo", "abaixoDoMinimo", "preco", "valorEmEstoque", "fornecedores"];
      const csv = [columns, ...result.itens.map((row) => columns.map((column) => row[column]))].map((row) => row.map(csvCell).join(",")).join("\r\n");
      return reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", "attachment; filename=estoqueqa-produtos.csv").send(`\uFEFF${csv}`);
    } catch (error) { return errorResponse(request, reply, error); }
  };

  auditoria = async (request: FastifyRequest, reply: FastifyReply) => {
    const page = z.object({ pagina: z.coerce.number().int().min(1).default(1), limite: z.coerce.number().int().min(1).max(500).default(100) }).safeParse(request.query);
    if (!page.success) return reply.code(400).send({ erro: "Paginação inválida." });
    try { return await this.inventory.listarAuditoria(page.data.pagina, page.data.limite); }
    catch (error) { return errorResponse(request, reply, error); }
  };
}
