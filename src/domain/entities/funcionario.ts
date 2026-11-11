export interface FuncionarioProps {
  usuarioId: number;
  matricula?: string | null;
  criadoEm: Date;
}

export class Funcionario {
  readonly usuarioId: number;
  readonly matricula: string | null;
  readonly criadoEm: Date;

  static normalizarMatricula(value?: string | null): string | null {
    const matricula = value?.trim() || null;
    if ((matricula?.length ?? 0) > 40) throw new Error("Matrícula inválida.");
    return matricula;
  }

  constructor(props: FuncionarioProps) {
    if (!Number.isInteger(props.usuarioId) || props.usuarioId <= 0) throw new Error("Usuário do funcionário inválido.");
    const matricula = Funcionario.normalizarMatricula(props.matricula);
    this.usuarioId = props.usuarioId;
    this.matricula = matricula;
    this.criadoEm = props.criadoEm;
  }
}
