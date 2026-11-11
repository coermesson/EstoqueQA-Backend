import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PapelUsuario } from "../../domain/entities/usuario.js";
import type { TokenClaims, TokenProvider } from "../../domain/security/token-provider.js";

export class SignedTokenService implements TokenProvider {
  constructor(private readonly secret = process.env.JWT_SECRET ?? "") {}

  issue(userId: number, role: PapelUsuario): string {
    if (this.secret.length < 32) throw new Error("JWT_SECRET é obrigatório e deve ter pelo menos 32 caracteres.");
    const claims = { sub: userId, role, exp: Date.now() + 8 * 60 * 60 * 1000, jti: randomUUID() };
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const signature = createHmac("sha256", this.secret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }

  verify(token: string): TokenClaims | null {
    if (this.secret.length < 32) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", this.secret).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
        sub: number; role: PapelUsuario; exp: number; jti: string;
      };
      if (!Number.isInteger(decoded.sub) || !["admin", "gerente", "funcionario"].includes(decoded.role)
        || !Number.isFinite(decoded.exp) || decoded.exp <= Date.now()
        || !/^[0-9a-f-]{36}$/i.test(decoded.jti)) return null;
      return { userId: decoded.sub, role: decoded.role, jti: decoded.jti, expiresAt: decoded.exp };
    } catch {
      return null;
    }
  }
}
