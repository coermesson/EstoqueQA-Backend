import { describe, expect, it } from "vitest";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import type { AuthRepository } from "../src/domain/repositories/auth.repository.js";
import { GerenciarAutenticacao } from "../src/application/use-cases/auth/gerenciar-autenticacao.js";
import { SignedTokenService } from "../src/infrastructure/security/signed-token.js";

const scrypt = promisify(scryptCallback);

describe("GerenciarAutenticacao", () => {
  it("autentica senha correta e emite token verificável", async () => {
    const salt = randomBytes(16).toString("hex");
    const passwordHash = await scrypt("SenhaValida123", salt, 64) as Buffer;
    const repository = {
      buscarPorEmail: async () => ({ id: 4, nome: "Ana", email: "ana@example.com", papel: "gerente" as const, podeMovimentar: false, ativo: true, criadoEm: "2026-01-01", senhaHash: `${salt}:${passwordHash.toString("hex")}` }),
      registrarLogin: async () => undefined,
    } as unknown as AuthRepository;
    const tokens = new SignedTokenService("unit-test-secret-that-is-long-enough-123");
    const auth = new GerenciarAutenticacao(repository, tokens);

    const login = await auth.login("ANA@example.com", "SenhaValida123");

    expect(login?.usuario.email).toBe("ana@example.com");
    expect(tokens.verify(login!.token)).toMatchObject({ userId: 4, role: "gerente" });
    expect(await auth.login("ana@example.com", "senha-errada")).toBeNull();
  });

  it("não autentica usuário inexistente", async () => {
    const repository = { buscarPorEmail: async () => null } as unknown as AuthRepository;
    const auth = new GerenciarAutenticacao(repository, new SignedTokenService("unit-test-secret-that-is-long-enough-123"));
    await expect(auth.login("nao-existe@example.com", "senha")).resolves.toBeNull();
  });

  it("persiste um hash scrypt com salt aleatório, sem encaminhar a senha em texto puro", async () => {
    let saved: { nome: string; email: string; senhaHash: string; papel: "admin" | "gerente" | "funcionario"; podeMovimentar: boolean } | undefined;
    const repository = {
      criarUsuario: async (data: typeof saved) => {
        saved = data!;
        return { id: 7, nome: data!.nome, email: data!.email, papel: data!.papel, ativo: true, criadoEm: "2026-01-01" };
      },
    } as unknown as AuthRepository;
    const auth = new GerenciarAutenticacao(repository, new SignedTokenService("unit-test-secret-that-is-long-enough-123"));

    await auth.criarUsuario({ nome: " Bia ", email: "BIA@example.com", senha: "SenhaValida123", papel: "funcionario" });

    expect(saved?.email).toBe("bia@example.com");
    expect(saved?.senhaHash).not.toContain("SenhaValida123");
    const [salt, encodedHash] = saved!.senhaHash.split(":");
    expect(salt).toHaveLength(32);
    const actual = await scrypt("SenhaValida123", salt, 64) as Buffer;
    expect(actual.toString("hex")).toBe(encodedHash);
  });
});
