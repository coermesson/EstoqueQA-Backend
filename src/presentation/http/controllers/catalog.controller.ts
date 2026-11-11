import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { GerenciarCatalogo } from "../../../application/use-cases/catalogo/gerenciar-catalogo.js";

const idSchema = z.coerce.number().int().positive();
const email = z.string().email().max(254);

function actor(request: FastifyRequest): number {
  const userId = (request as FastifyRequest & { user?: { userId: number } }).user?.userId;
  if (!userId) throw Object.assign(new Error("Autenticação necessária."), { statusCode: 401 });
  return userId;
}

function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  request.log.error(error);
  const failure = error as Error & { statusCode?: number; code?: string };
  if (failure.statusCode) return reply.code(failure.statusCode).send({ erro: failure.message });
  if (failure.code === "23514") return reply.code(409).send({ erro: "A regra de integridade impede esta operação." });
  if (failure.code === "NOT_FOUND") return reply.code(404).send({ erro: failure.message });
  if (failure.code === "23505") return reply.code(409).send({ erro: "Registro duplicado." });
  if (failure.code === "23503") return reply.code(409).send({ erro: "A operação comprometeria registros relacionados ou o histórico." });
  return reply.code(500).send({ erro: "Não foi possível concluir a operação." });
}

export class CatalogController {
  constructor(private readonly catalog: GerenciarCatalogo) {}

  listarCategorias = async () => this.catalog.listarCategorias();
  buscarCategoria = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ erro: "ID inválido." });
    const result = await this.catalog.buscarCategoria(id.data);
    return result ?? reply.code(404).send({ erro: "Categoria não encontrada." });
  };
  criarCategoria = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = z.object({ nome: z.string().trim().min(1).max(120), descricao: z.string().max(2000).optional() }).safeParse(request.body);
    if (!data.success) return reply.code(400).send({ erro: "Categoria inválida.", detalhes: data.error.issues });
    try { return reply.code(201).send(await this.catalog.criarCategoria(data.data, actor(request))); }
    catch (error) { return sendError(request, reply, error); }
  };
  atualizarCategoria = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    const data = z.object({ nome: z.string().trim().min(1).max(120).optional(), descricao: z.string().max(2000).nullable().optional() }).refine((value) => Object.keys(value).length > 0).safeParse(request.body);
    if (!id.success || !data.success) return reply.code(400).send({ erro: "Dados de categoria inválidos." });
    try { const result = await this.catalog.atualizarCategoria(id.data, data.data, actor(request)); return result ?? reply.code(404).send({ erro: "Categoria não encontrada." }); }
    catch (error) { return sendError(request, reply, error); }
  };
  removerCategoria = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ erro: "ID inválido." });
    try { if (!await this.catalog.removerCategoria(id.data, actor(request))) return reply.code(404).send({ erro: "Categoria não encontrada." }); return reply.code(204).send(); }
    catch (error) { return sendError(request, reply, error); }
  };

  listarFornecedores = async () => this.catalog.listarFornecedores();
  buscarFornecedor = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ erro: "ID inválido." });
    const result = await this.catalog.buscarFornecedor(id.data);
    return result ?? reply.code(404).send({ erro: "Fornecedor não encontrado." });
  };
  criarFornecedor = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = z.object({ nome: z.string().trim().min(1).max(160), email: email.optional(), telefone: z.string().max(40).optional(), documento: z.string().max(40).optional() }).safeParse(request.body);
    if (!data.success) return reply.code(400).send({ erro: "Fornecedor inválido.", detalhes: data.error.issues });
    try { return reply.code(201).send(await this.catalog.criarFornecedor(data.data, actor(request))); }
    catch (error) { return sendError(request, reply, error); }
  };
  atualizarFornecedor = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    const data = z.object({ nome: z.string().trim().min(1).max(160).optional(), email: email.nullable().optional(), telefone: z.string().max(40).nullable().optional(), documento: z.string().max(40).nullable().optional() }).refine((value) => Object.keys(value).length > 0).safeParse(request.body);
    if (!id.success || !data.success) return reply.code(400).send({ erro: "Dados de fornecedor inválidos." });
    try { const result = await this.catalog.atualizarFornecedor(id.data, data.data, actor(request)); return result ?? reply.code(404).send({ erro: "Fornecedor não encontrado." }); }
    catch (error) { return sendError(request, reply, error); }
  };
  removerFornecedor = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ erro: "ID inválido." });
    try { if (!await this.catalog.desativarFornecedor(id.data, actor(request))) return reply.code(404).send({ erro: "Fornecedor não encontrado ou já inativo." }); return reply.code(204).send(); }
    catch (error) { return sendError(request, reply, error); }
  };

  buscarProduto = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ erro: "ID inválido." });
    const result = await this.catalog.buscarProduto(id.data);
    return result ?? reply.code(404).send({ erro: "Produto não encontrado." });
  };
  atualizarProduto = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    const data = z.object({ codigo: z.string().trim().max(64).nullable().optional(), nome: z.string().trim().min(1).max(120).optional(), descricao: z.string().nullable().optional(), preco: z.number().finite().min(0).optional(), categoriaId: idSchema.nullable().optional(), estoqueMinimo: z.number().int().min(0).optional() }).refine((value) => Object.keys(value).length > 0).safeParse(request.body);
    if (!id.success || !data.success) return reply.code(400).send({ erro: "Dados de produto inválidos." });
    try { const result = await this.catalog.atualizarProduto(id.data, data.data, actor(request)); return result ?? reply.code(404).send({ erro: "Produto não encontrado." }); }
    catch (error) { return sendError(request, reply, error); }
  };
  atualizarEstoqueMinimo = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    const data = z.object({ estoqueMinimo: z.number().int().min(0) }).safeParse(request.body);
    if (!id.success || !data.success) return reply.code(400).send({ erro: "Dados inválidos." });
    try { const result = await this.catalog.atualizarProduto(id.data, data.data, actor(request)); return result ?? reply.code(404).send({ erro: "Produto não encontrado." }); }
    catch (error) { return sendError(request, reply, error); }
  };
  removerProduto = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ erro: "ID inválido." });
    try { if (!await this.catalog.removerProduto(id.data, actor(request))) return reply.code(404).send({ erro: "Produto não encontrado." }); return reply.code(204).send(); }
    catch (error) { return sendError(request, reply, error); }
  };
  listarFornecedoresDoProduto = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ erro: "ID inválido." });
    if (!await this.catalog.buscarProduto(id.data)) return reply.code(404).send({ erro: "Produto não encontrado." });
    return this.catalog.listarFornecedoresDoProduto(id.data);
  };
  associarFornecedor = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    const data = z.object({ fornecedorId: idSchema, codigoNoFornecedor: z.string().trim().max(120).optional(), custoAtual: z.number().finite().min(0).optional() }).safeParse(request.body);
    if (!id.success || !data.success) return reply.code(400).send({ erro: "Dados da associação inválidos." });
    try { return reply.code(200).send(await this.catalog.associarFornecedor(id.data, data.data.fornecedorId, data.data.codigoNoFornecedor, data.data.custoAtual, actor(request))); }
    catch (error) { return sendError(request, reply, error); }
  };
  removerFornecedorDoProduto = async (request: FastifyRequest<{ Params: { id: string; fornecedorId: string } }>, reply: FastifyReply) => {
    const id = idSchema.safeParse(request.params.id);
    const fornecedorId = idSchema.safeParse(request.params.fornecedorId);
    if (!id.success || !fornecedorId.success) return reply.code(400).send({ erro: "Dados da associação inválidos." });
    try { if (!await this.catalog.removerFornecedorDoProduto(id.data, fornecedorId.data, actor(request))) return reply.code(404).send({ erro: "Associação não encontrada." }); return reply.code(204).send(); }
    catch (error) { return sendError(request, reply, error); }
  };
}
