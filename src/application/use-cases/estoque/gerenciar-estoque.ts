import type {
  FiltroEstoque,
  FiltroMovimentacao,
  FiltroRelatorio,
  FiltroRelatorioProdutos,
  InventoryRepository,
  MovimentacaoInput,
} from "../../../domain/repositories/inventory.repository.js";
import { Movimentacao } from "../../../domain/entities/movimentacao.js";

export class GerenciarEstoque {
  constructor(private readonly repository: InventoryRepository) {}

  listarProdutos(filtros: FiltroEstoque) { return this.repository.listarProdutos(filtros); }
  registrarMovimentacao(data: MovimentacaoInput, actorId: number) {
    const movimentacao = new Movimentacao({ ...data, usuarioId: actorId });
    return this.repository.registrarMovimentacao({ ...data, motivo: movimentacao.motivo }, actorId);
  }
  listarMovimentacoes(filtros: FiltroMovimentacao) { return this.repository.listarMovimentacoes(filtros); }
  dashboard() { return this.repository.dashboard(); }
  alertas() { return this.repository.alertas(); }
  relatorio(filtros: FiltroRelatorio) { return this.repository.relatorio(filtros); }
  relatorioProdutos(filtros: FiltroRelatorioProdutos) { return this.repository.relatorioProdutos(filtros); }
  listarAuditoria(pagina: number, limite: number) { return this.repository.listarAuditoria(pagina, limite); }
}
