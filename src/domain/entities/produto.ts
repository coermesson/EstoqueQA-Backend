
export interface ProdutoProps {
  id: number;
  codigo?: string | null;
  nome: string;
  descricao: string | null;
  quantidade: number;
  preco: number;
  criadoEm: Date;
  categoriaId?: number | null;
  estoqueMinimo?: number;
  ativo?: boolean;
}

export class Produto {
  readonly id: number;
  readonly codigo: string | null;
  readonly nome: string;
  readonly descricao: string | null;
  readonly quantidade: number;
  readonly preco: number;
  readonly criadoEm: Date;
  readonly categoriaId: number | null;
  readonly estoqueMinimo: number;
  readonly ativo: boolean;

  constructor(props: ProdutoProps) {
    const nome = props.nome.trim();
    const codigo = props.codigo?.trim() || null;

    if (!nome) {
      throw new Error("O nome do produto é obrigatório.");
    }
    if ((codigo?.length ?? 0) > 64) throw new Error("O código do produto deve ter no máximo 64 caracteres.");

    if (!Number.isInteger(props.quantidade) || props.quantidade < 0) {
      throw new Error("A quantidade deve ser um número inteiro não negativo.");
    }

    if (!Number.isFinite(props.preco) || props.preco < 0) {
      throw new Error("O preço deve ser um número não negativo.");
    }
    const estoqueMinimo = props.estoqueMinimo ?? 0;
    if (!Number.isInteger(estoqueMinimo) || estoqueMinimo < 0) {
      throw new Error("O estoque mínimo deve ser um número inteiro não negativo.");
    }

    this.id = props.id;
    this.codigo = codigo;
    this.nome = nome;
    this.descricao = props.descricao;
    this.quantidade = props.quantidade;
    this.preco = props.preco;
    this.criadoEm = props.criadoEm;
    this.categoriaId = props.categoriaId ?? null;
    this.estoqueMinimo = estoqueMinimo;
    this.ativo = props.ativo ?? true;
  }
}
