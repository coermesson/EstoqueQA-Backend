export interface FornecedorProps {
  id: number;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  documento?: string | null;
  ativo: boolean;
  criadoEm?: Date;
}

export class Fornecedor {
  readonly id: number;
  readonly nome: string;
  readonly email: string | null;
  readonly telefone: string | null;
  readonly documento: string | null;
  readonly ativo: boolean;
  readonly criadoEm: Date;

  constructor(props: FornecedorProps) {
    const nome = props.nome.trim();
    const email = props.email?.trim().toLowerCase() ?? null;
    if (!Number.isInteger(props.id) || props.id < 0) throw new Error("ID de fornecedor inválido.");
    if (!nome || nome.length > 160) throw new Error("Nome de fornecedor inválido.");
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("E-mail de fornecedor inválido.");
    if ((props.telefone?.length ?? 0) > 40 || (props.documento?.length ?? 0) > 40) throw new Error("Telefone ou documento de fornecedor muito longo.");
    this.id = props.id;
    this.nome = nome;
    this.email = email;
    this.telefone = props.telefone ?? null;
    this.documento = props.documento ?? null;
    this.ativo = props.ativo;
    this.criadoEm = props.criadoEm ?? new Date();
  }
}
