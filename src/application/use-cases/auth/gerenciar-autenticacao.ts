import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { AuthRepository, PapelUsuario } from "../../../domain/repositories/auth.repository.js";
import type { TokenClaims, TokenProvider } from "../../../domain/security/token-provider.js";
import { Usuario } from "../../../domain/entities/usuario.js";

const scrypt = promisify(scryptCallback);

export class GerenciarAutenticacao {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: TokenProvider,
  ) {}

  async login(email: string, password: string) {
    const user = await this.repository.buscarPorEmail(email.toLowerCase());
    if (!user) return null;
    const [salt, encodedHash] = user.senhaHash.split(":");
    if (!salt || !encodedHash) return null;
    const actual = await scrypt(password, salt, 64) as Buffer;
    const expected = Buffer.from(encodedHash, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    await this.repository.registrarLogin(user.id);
    return {
      token: this.tokens.issue(user.id, user.papel),
      usuario: { id: user.id, nome: user.nome, email: user.email, papel: user.papel, podeMovimentar: user.podeMovimentar },
    };
  }

  async criarUsuario(data: { nome: string; email: string; senha: string; papel: PapelUsuario; podeMovimentar?: boolean; matricula?: string }, actor?: { userId: number; jti: string }) {
    const usuario = new Usuario({ id: 0, nome: data.nome, email: data.email, papel: data.papel, podeMovimentar: data.podeMovimentar, ativo: true, criadoEm: new Date() });
    const salt = randomBytes(16).toString("hex");
    const hash = await scrypt(data.senha, salt, 64) as Buffer;
    return this.repository.criarUsuario({
      nome: usuario.nome,
      email: usuario.email,
      senhaHash: `${salt}:${hash.toString("hex")}`,
      papel: usuario.papel,
      podeMovimentar: usuario.podeMovimentar,
      matricula: data.matricula,
    }, actor);
  }

  listarUsuarios(actor: { userId: number; jti: string }) { return this.repository.listarUsuarios(actor); }

  atualizarUsuario(id: number, data: { nome?: string; papel?: PapelUsuario; ativo?: boolean; podeMovimentar?: boolean }, actor: { userId: number; jti: string }) {
    return this.repository.atualizarUsuario(id, data, actor);
  }

  encerrarSessao(claims: TokenClaims): Promise<void> {
    return this.repository.encerrarSessao(claims.userId, claims.jti, new Date(claims.expiresAt));
  }

  validarSessao(userId: number, jti: string): Promise<{ papel: PapelUsuario; podeMovimentar: boolean } | null> {
    return this.repository.validarSessao(userId, jti);
  }

  verificarToken(token: string): TokenClaims | null {
    return this.tokens.verify(token);
  }
}
