import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { Produto } from "../src/domain/entities/produto.js";
import { PostgresProdutoRepository } from "../src/infrastructure/database/postgres/postgres-produto.repository.js";
import { PostgresCatalogRepository } from "../src/infrastructure/database/postgres/postgres-catalog.repository.js";
import { PostgresAuthRepository } from "../src/infrastructure/database/postgres/postgres-auth.repository.js";
import { PostgresFuncionarioRepository } from "../src/infrastructure/database/postgres/postgres-funcionario.repository.js";
import { PostgresInventoryRepository } from "../src/infrastructure/database/postgres/postgres-inventory.repository.js";
import { GerenciarAutenticacao } from "../src/application/use-cases/auth/gerenciar-autenticacao.js";
import { GerenciarEstoque } from "../src/application/use-cases/estoque/gerenciar-estoque.js";
import { SignedTokenService } from "../src/infrastructure/security/signed-token.js";

const { Pool } = pg;
const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

suite("integração PostgreSQL em schema temporário", () => {
  const schema = `estoqueqa_test_${randomBytes(8).toString("hex")}`;
  let adminPool: pg.Pool;
  let testPool: pg.Pool;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: databaseUrl });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    testPool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
    for (const name of ["000_produtos_base.sql", "001_inventory.sql", "002_produtos_fornecedores_sessoes.sql", "003_motivos_e_fornecedor_movimentacao.sql", "004_perfis_funcionarios_inativacao.sql", "005_datas_atualizacao_inativacao.sql"]) {
      await testPool.query(await readFile(join(process.cwd(), "migrations", name), "utf8"));
    }
  }, 30_000);

  afterAll(async () => {
    await testPool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await adminPool.end();
    }
  }, 30_000);

  it("persiste usuário, autentica, movimenta saldo e registra auditoria", async () => {
    const authRepository = new PostgresAuthRepository(testPool);
    const tokenProvider = new SignedTokenService("integration-test-secret-with-at-least-32-chars");
    const auth = new GerenciarAutenticacao(authRepository, tokenProvider);
    const email = `${randomBytes(6).toString("hex")}@example.test`;
    const password = "SenhaDeIntegracao123";
    await auth.criarUsuario({ nome: "Usuário de integração", email, senha: password, papel: "admin" });
    const login = await auth.login(email.toUpperCase(), password);

    expect(login?.usuario.papel).toBe("admin");
    expect(await auth.login(email, "senha incorreta")).toBeNull();
    const claims = tokenProvider.verify(login!.token)!;
    expect(await auth.validarSessao(claims.userId, claims.jti)).toMatchObject({ papel: "admin" });
    const manager = await auth.criarUsuario({ nome: "Gerente de integração", email: `ger-${email}`, senha: password, papel: "gerente" }, { userId: claims.userId, jti: claims.jti });
    const managerLogin = await auth.login(manager.email, password);
    const managerClaims = tokenProvider.verify(managerLogin!.token)!;
    const employees = new PostgresFuncionarioRepository(testPool);
    const employee = await auth.criarUsuario({ nome: "Funcionário de integração", email: `func-${email}`, senha: password, papel: "funcionario", matricula: "INT-001" }, { userId: manager.id, jti: managerClaims.jti });
    expect((await employees.listarFuncionarios({ userId: manager.id, jti: managerClaims.jti })).length).toBe(1);
    await expect(auth.criarUsuario({ nome: "Admin indevido", email: `bad-${email}`, senha: password, papel: "admin" }, { userId: manager.id, jti: managerClaims.jti }))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(employees.atualizarFuncionario(employee.id, { podeMovimentar: true }, { userId: manager.id, jti: managerClaims.jti }))
      .rejects.toMatchObject({ statusCode: 403 });
    const permittedEmployee = await employees.atualizarFuncionario(employee.id, { podeMovimentar: true }, { userId: claims.userId, jti: claims.jti });
    expect(permittedEmployee?.podeMovimentar).toBe(true);

    const catalog = new PostgresCatalogRepository(testPool);
    const category = await catalog.criarCategoria({ nome: "Categoria de teste" }, claims.userId);
    const supplier = await catalog.criarFornecedor({ nome: "Fornecedor de teste" }, claims.userId);
    const productRepository = new PostgresProdutoRepository(testPool);
    const product = await productRepository.cadastrar(new Produto({
      id: 0, nome: "Produto de integração", descricao: null, quantidade: 5, preco: 3.5,
      criadoEm: new Date(), categoriaId: category.id, estoqueMinimo: 1,
    }), claims.userId);
    await catalog.associarFornecedor(product.id, supplier.id, undefined, undefined, claims.userId);

    const inventory = new GerenciarEstoque(new PostgresInventoryRepository(testPool));
    await expect(inventory.registrarMovimentacao({ produtoId: product.id, tipo: "saida", quantidade: 6, motivo: "Teste de limite" }, claims.userId))
      .rejects.toMatchObject({ statusCode: 409 });
    await inventory.registrarMovimentacao({ produtoId: product.id, fornecedorId: supplier.id, tipo: "entrada", quantidade: 2, motivo: "Reposição de teste" }, claims.userId);
    await inventory.registrarMovimentacao({ produtoId: product.id, tipo: "saida", quantidade: 1, motivo: "Consumo de teste" }, claims.userId);

    const persistedProduct = await catalog.buscarProduto(product.id);
    expect(persistedProduct?.quantidade).toBe(6);
    expect((await inventory.relatorio({ produtoId: product.id, fornecedorId: supplier.id })).length).toBe(1);
    expect((await inventory.listarAuditoria(1, 20)).total).toBeGreaterThanOrEqual(5);

    await auth.encerrarSessao(claims);
    expect(await auth.validarSessao(claims.userId, claims.jti)).toBeNull();
  }, 30_000);
});
