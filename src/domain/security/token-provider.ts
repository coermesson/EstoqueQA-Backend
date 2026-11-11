import type { PapelUsuario } from "../entities/usuario.js";

export interface TokenClaims {
  userId: number;
  role: PapelUsuario;
  jti: string;
  expiresAt: number;
}

export interface TokenProvider {
  issue(userId: number, role: PapelUsuario): string;
  verify(token: string): TokenClaims | null;
}
