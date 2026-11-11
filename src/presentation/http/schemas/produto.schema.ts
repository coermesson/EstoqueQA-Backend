
import { z } from "zod";

export const produtoSchema = z.object({
  codigo: z.string().trim().max(64).nullable().optional(),
  nome: z.string().trim().min(1, "O nome é obrigatório").max(120),
  descricao: z.string().optional(),
  quantidade: z.number().int().min(0).default(0),
  preco: z.number().finite().min(0),
  categoriaId: z.number().int().positive().nullable().optional(),
  estoqueMinimo: z.number().int().min(0).default(0),
});
