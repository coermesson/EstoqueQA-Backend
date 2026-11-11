export type PapelUsuario = "admin" | "gerente" | "funcionario";

export interface UsuarioProps {
  id: number;
  nome: string;
  email: string;
  papel: PapelUsuario;
  podeMovimentar?: boolean;
  ativo: boolean;
  criadoEm: Date;
}

export class Usuario {
  readonly id: number;
  readonly nome: string;
  readonly email: string;
  readonly papel: PapelUsuario;
  readonly podeMovimentar: boolean;
  readonly ativo: boolean;
  readonly criadoEm: Date;

  constructor(props: UsuarioProps) {
    const nome = props.nome.trim();
    const email = props.email.trim().toLowerCase();
    if (!Number.isInteger(props.id) || props.id < 0) throw new Error("ID de usuário inválido.");
    if (!nome || nome.length > 160) throw new Error("Nome de usuário inválido.");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail de usuário inválido.");
    if (!["admin", "gerente", "funcionario"].includes(props.papel)) throw new Error("Perfil de usuário inválido.");

    this.id = props.id;
    this.nome = nome;
    this.email = email;
    this.papel = props.papel;
    this.podeMovimentar = props.podeMovimentar ?? false;
    this.ativo = props.ativo;
    this.criadoEm = props.criadoEm;
  }
}
