import type { PapelUsuario } from "../entities/usuario.js";
export type { PapelUsuario } from "../entities/usuario.js";

export interface UsuarioAuthDTO {
  id: number;
  nome: string;
  email: string;
  papel: PapelUsuario;
  podeMovimentar: boolean;
  ativo: boolean;
  criadoEm: string;
}

export interface UsuarioCredencialDTO extends UsuarioAuthDTO {
  senhaHash: string;
}

export interface AuthRepository {
  buscarPorEmail(email: string): Promise<UsuarioCredencialDTO | null>;
  criarUsuario(data: { nome: string; email: string; senhaHash: string; papel: PapelUsuario; podeMovimentar: boolean; matricula?: string }, actor?: { userId: number; jti: string }): Promise<UsuarioAuthDTO>;
  listarUsuarios(actor: { userId: number; jti: string }): Promise<UsuarioAuthDTO[]>;
  atualizarUsuario(id: number, data: { nome?: string; papel?: PapelUsuario; ativo?: boolean; podeMovimentar?: boolean }, actor: { userId: number; jti: string }): Promise<UsuarioAuthDTO | null>;
  encerrarSessao(userId: number, jti: string, expiraEm: Date): Promise<void>;
  registrarLogin(userId: number): Promise<void>;
  validarSessao(userId: number, jti: string): Promise<{ papel: PapelUsuario; podeMovimentar: boolean } | null>;
}
