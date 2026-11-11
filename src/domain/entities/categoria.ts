export interface CategoriaProps {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
  criadoEm?: Date;
}

export class Categoria {
  readonly id: number;
  readonly nome: string;
  readonly descricao: string | null;
  readonly ativo: boolean;
  readonly criadoEm: Date;

  constructor(props: CategoriaProps) {
    const nome = props.nome.trim();
    if (!Number.isInteger(props.id) || props.id < 0) throw new Error("ID de categoria inválido.");
    if (!nome || nome.length > 120) throw new Error("Nome de categoria inválido.");
    if ((props.descricao?.length ?? 0) > 2000) throw new Error("Descrição de categoria muito longa.");
    this.id = props.id;
    this.nome = nome;
    this.descricao = props.descricao ?? null;
    this.ativo = props.ativo ?? true;
    this.criadoEm = props.criadoEm ?? new Date();
  }
}
