import type { AtorFuncionario, FuncionarioRepository } from "../../../domain/repositories/funcionario.repository.js";
import { Funcionario } from "../../../domain/entities/funcionario.js";
import type { GerenciarAutenticacao } from "../auth/gerenciar-autenticacao.js";

export class GerenciarFuncionarios {
  constructor(
    private readonly repository: FuncionarioRepository,
    private readonly auth: GerenciarAutenticacao,
  ) {}

  criar(data: { nome: string; email: string; senha: string; matricula?: string; podeMovimentar?: boolean }, actor: AtorFuncionario) {
    const matricula = Funcionario.normalizarMatricula(data.matricula) ?? undefined;
    return this.auth.criarUsuario({ ...data, matricula, papel: "funcionario" }, actor).then((user) => this.repository.buscarFuncionario(user.id, actor));
  }

  listar(actor: AtorFuncionario) { return this.repository.listarFuncionarios(actor); }
  buscar(id: number, actor: AtorFuncionario) { return this.repository.buscarFuncionario(id, actor); }
  atualizar(id: number, data: { nome?: string; ativo?: boolean; podeMovimentar?: boolean; matricula?: string | null }, actor: AtorFuncionario) {
    const normalized = data.matricula === undefined ? data : { ...data, matricula: Funcionario.normalizarMatricula(data.matricula) };
    return this.repository.atualizarFuncionario(id, normalized, actor);
  }
}
