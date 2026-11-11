# EstoqueQA Backend

Backend TypeScript com Fastify, PostgreSQL (`pg`) e organização em camadas.

## Configuração

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env` e configure os dados PostgreSQL.
3. Gere um `JWT_SECRET` aleatório com pelo menos 32 caracteres.
4. Aponte `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` e `DB_PORT` ao banco usado pelo projeto. O servidor não inicia sem `JWT_SECRET` com pelo menos 32 caracteres.

## Banco de dados

A migration `000` cria a tabela-base `produtos` em instalações novas e não substitui uma tabela já existente. As migrations seguintes adicionam categorias, fornecedores, usuários, perfis, funcionários, movimentações, auditoria, associação entre produtos e fornecedores, revogação de tokens, códigos de produto, inativação lógica e marcas temporais de atualização/inativação. A migration 004 converte perfis antigos de forma conservadora: `operador` e `leitura` viram `funcionario`; os antigos operadores mantêm somente a permissão de movimentação, e os usuários de leitura permanecem sem ela. O runner `scripts/migrate.ts` aplica cada migration em transação, usa advisory lock e registra checksum em `schema_migrations`; checksum divergente causa falha explícita. Execute `npm run db:migrate`; o servidor não migra automaticamente. A migration 000 mantém a tabela preexistente sem apagar dados, mas revise incompatibilidades do esquema legado antes de aplicar em produção.

## Execução

- `npm run dev`: servidor em modo de desenvolvimento.
- `npm start`: inicia o servidor.
- `npm run typecheck`: verifica os tipos TypeScript.
- `npm test`: executa os testes Vitest.
- `npm run build`: compila a aplicação para `dist`.

O teste de integração PostgreSQL é opcional e só roda quando `TEST_DATABASE_URL` aponta para um banco de teste dedicado. Ele cria um schema temporário aleatório, aplica as migrations nesse schema e o remove ao terminar; não use a URL do banco de desenvolvimento/produção. Sem essa variável, os testes unitários e de rotas continuam executáveis normalmente.

## Autenticação e permissões

`POST /auth/usuarios` cria o primeiro usuário como administrador quando ainda não há usuários. Administradores podem criar e gerenciar perfis; administradores e gerentes podem cadastrar funcionários. Gerentes só podem criar, consultar, editar e inativar funcionários, sem alterar perfil ou conceder permissão de movimentação. Perfis: `admin`, `gerente` e `funcionario`. Funcionários podem consultar dados operacionais; movimentações exigem a permissão `podeMovimentar`, concedida por administrador. O login em `POST /auth/login` retorna token Bearer assinado, válido por oito horas. As rotas revalidam usuário, perfil e permissão no banco; logout, inativação ou mudança de permissão têm efeito imediato. Configure um segredo forte em `JWT_SECRET`.

Configure `CORS_ORIGINS` como uma lista de origens permitidas separadas por vírgula para chamadas feitas por navegador. O health check consulta o PostgreSQL e retorna `503` se o banco estiver indisponível.

## Rotas

| Método | Rota | Acesso |
|---|---|---|
| GET | `/health` | Público |
| GET | `/produtos` | Autenticado |
| GET | `/produtos/:id` | Autenticado |
| POST | `/produtos` | Gerente/admin |
| PATCH | `/produtos/:id` | Gerente/admin; inclui código e categoria |
| PATCH | `/produtos/:id/estoque-minimo` | Gerente/admin |
| DELETE | `/produtos/:id` | Admin; inativa somente com saldo zero |
| POST | `/auth/usuarios` | Primeiro usuário; depois admin (gerência de contas/perfis) |
| POST | `/auth/login` | Público |
| POST | `/auth/logout` | Autenticado; revoga o token atual imediatamente |
| GET/POST/PATCH/DELETE | `/funcionarios` | Admin/gerente; DELETE inativa |
| GET/PATCH | `/auth/usuarios` | Admin; permite atribuir perfil e permissão de movimentação |
| GET/POST/PATCH/DELETE | `/categorias` | Leitura autenticada; escrita gerente/admin; DELETE inativa |
| GET/POST/PATCH/DELETE | `/fornecedores` | Leitura autenticada; escrita gerente/admin; DELETE inativa fornecedor |
| GET | `/estoque/produtos` | Autenticado; filtros busca, categoriaId, abaixoDoMinimo, pagina e limite |
| GET | `/produtos/:id/fornecedores` | Autenticado; lista fornecedores associados |
| PUT | `/produtos/:id/fornecedores` | Gerente/admin; cria ou atualiza associação produto-fornecedor |
| DELETE | `/produtos/:id/fornecedores/:fornecedorId` | Gerente/admin; remove associação se não comprometer o histórico |
| POST/GET | `/movimentacoes` | Entrada/saída: admin/gerente ou funcionário autorizado; consulta autenticada |
| GET | `/dashboard` | Admin/gerente; produtos, categorias, fornecedores, saldo, valor e movimentações recentes |
| GET | `/estoque/alertas` | Admin/gerente; lista saldo zero e abaixo do mínimo |
| GET | `/relatorios/movimentacoes` | Admin/gerente; filtros por período, tipo, produto, categoria e fornecedor |
| GET | `/relatorios/movimentacoes.csv` | Admin/gerente; mesmos filtros e exportação CSV |
| GET | `/relatorios/produtos` | Admin/gerente; filtros por busca, categoria, fornecedor e mínimo |
| GET | `/relatorios/produtos.csv` | Admin/gerente; exportação CSV paginada |
| GET | `/auditoria` | Admin |

As movimentações usam transação e bloqueio da linha do produto para impedir saídas concorrentes acima do saldo. Motivo e responsável são exigidos pela API e protegidos por constraints para novas gravações. Fornecedor informado precisa estar associado e ativo. Produtos cadastrados com saldo inicial geram movimento e auditoria na mesma transação. Produtos e categorias são inativados; produto só pode ser inativado com saldo zero. Fornecedores também são inativados para preservar referências e histórico.
