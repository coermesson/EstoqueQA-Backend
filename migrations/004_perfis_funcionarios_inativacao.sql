-- Evolução aditiva: perfis oficiais, registro de funcionários e inativação lógica.
CREATE TABLE IF NOT EXISTS perfis (
  codigo VARCHAR(20) PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE
);

INSERT INTO perfis(codigo,nome) VALUES
  ('admin','Administrador'),
  ('gerente','Gerente'),
  ('funcionario','Funcionário')
ON CONFLICT (codigo) DO UPDATE SET nome=EXCLUDED.nome;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pode_movimentar BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS funcionarios (
  usuario_id BIGINT PRIMARY KEY REFERENCES usuarios(id) ON DELETE RESTRICT,
  matricula VARCHAR(40) UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migra perfis antigos sem conceder operações de catálogo aos operadores.
UPDATE usuarios SET pode_movimentar=TRUE WHERE papel='operador';
INSERT INTO funcionarios(usuario_id)
SELECT id FROM usuarios WHERE papel IN ('operador','leitura')
ON CONFLICT (usuario_id) DO NOTHING;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_papel_check;
UPDATE usuarios SET papel='funcionario' WHERE papel IN ('operador','leitura');
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_usuarios_perfil' AND conrelid='usuarios'::regclass) THEN
    ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_perfil FOREIGN KEY (papel) REFERENCES perfis(codigo) NOT VALID;
  END IF;
END
$$;

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS codigo VARCHAR(64);
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_produtos_quantidade_nao_negativa' AND conrelid='produtos'::regclass) THEN
    ALTER TABLE produtos ADD CONSTRAINT ck_produtos_quantidade_nao_negativa CHECK (quantidade >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_produtos_preco_nao_negativo' AND conrelid='produtos'::regclass) THEN
    ALTER TABLE produtos ADD CONSTRAINT ck_produtos_preco_nao_negativo CHECK (preco >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_produtos_inativo_sem_saldo' AND conrelid='produtos'::regclass) THEN
    ALTER TABLE produtos ADD CONSTRAINT ck_produtos_inativo_sem_saldo CHECK (ativo OR quantidade=0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_movimentacoes_responsavel_obrigatorio' AND conrelid='movimentacoes'::regclass) THEN
    ALTER TABLE movimentacoes ADD CONSTRAINT ck_movimentacoes_responsavel_obrigatorio CHECK (usuario_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_movimentacoes_motivo_obrigatorio' AND conrelid='movimentacoes'::regclass) THEN
    ALTER TABLE movimentacoes ADD CONSTRAINT ck_movimentacoes_motivo_obrigatorio CHECK (motivo IS NOT NULL AND length(trim(motivo)) > 0) NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_produtos_ativos_nome ON produtos(ativo,nome);
CREATE INDEX IF NOT EXISTS idx_categorias_ativas_nome ON categorias(ativo,nome);
CREATE UNIQUE INDEX IF NOT EXISTS ux_produtos_codigo ON produtos(codigo) WHERE codigo IS NOT NULL AND codigo <> '';
