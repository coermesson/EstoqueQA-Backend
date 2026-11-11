export interface FuncionarioDTO {
  id: number;
  usuarioId: number;
  nome: string;
  email: string;
  ativo: boolean;
  podeMovimentar: boolean;
  matricula: string | null;
  criadoEm: string;
}

export interface AtorFuncionario {
  userId: number;
  jti: string;
}

export interface FuncionarioRepository {
  listarFuncionarios(actor: AtorFuncionario): Promise<FuncionarioDTO[]>;
  buscarFuncionario(id: number, actor: AtorFuncionario): Promise<FuncionarioDTO | null>;
  atualizarFuncionario(id: number, data: { nome?: string; ativo?: boolean; podeMovimentar?: boolean; matricula?: string | null }, actor: AtorFuncionario): Promise<FuncionarioDTO | null>;
}
