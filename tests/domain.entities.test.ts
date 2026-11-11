import { describe, expect, it } from "vitest";
import { Categoria } from "../src/domain/entities/categoria.js";
import { Fornecedor } from "../src/domain/entities/fornecedor.js";
import { Movimentacao } from "../src/domain/entities/movimentacao.js";
import { Usuario } from "../src/domain/entities/usuario.js";
import { Funcionario } from "../src/domain/entities/funcionario.js";

describe("entidades do domínio", () => {
  it("normaliza nome e e-mail de usuário e valida o perfil", () => {
    const user = new Usuario({ id: 1, nome: " Ana ", email: "ANA@example.com", papel: "admin", ativo: true, criadoEm: new Date() });
    expect(user.nome).toBe("Ana");
    expect(user.email).toBe("ana@example.com");
    expect(() => new Usuario({ id: 2, nome: "Bia", email: "bia@example.com", papel: "root" as "admin", ativo: true, criadoEm: new Date() })).toThrow("Perfil de usuário inválido.");
  });

  it("rejeita categoria e fornecedor com campos inválidos", () => {
    expect(() => new Categoria({ id: 0, nome: "  " })).toThrow("Nome de categoria inválido.");
    expect(() => new Fornecedor({ id: 0, nome: "Fornecedor", email: "email-inválido", ativo: true })).toThrow("E-mail de fornecedor inválido.");
  });

  it("rejeita movimentação sem motivo ou com quantidade inválida", () => {
    expect(() => new Movimentacao({ produtoId: 1, tipo: "saida", quantidade: 1, motivo: "  ", usuarioId: 2 })).toThrow("Motivo da movimentação inválido.");
    expect(() => new Movimentacao({ produtoId: 1, tipo: "saida", quantidade: 0, motivo: "Ajuste", usuarioId: 2 })).toThrow("A quantidade movimentada deve ser um inteiro positivo.");
  });

  it("normaliza matrícula e rejeita valores longos", () => {
    expect(new Funcionario({ usuarioId: 2, matricula: " INT-02 ", criadoEm: new Date() }).matricula).toBe("INT-02");
    expect(() => Funcionario.normalizarMatricula("x".repeat(41))).toThrow("Matrícula inválida.");
  });
});
