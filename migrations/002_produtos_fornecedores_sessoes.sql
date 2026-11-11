-- Relação muitos-para-muitos: um produto pode ter vários fornecedores.
CREATE TABLE IF NOT EXISTS produtos_fornecedores (
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  codigo_no_fornecedor VARCHAR(120),
  custo_atual NUMERIC(12,2) CHECK (custo_atual IS NULL OR custo_atual >= 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (produto_id, fornecedor_id)
);

CREATE INDEX IF NOT EXISTS idx_produtos_fornecedores_fornecedor
  ON produtos_fornecedores(fornecedor_id, produto_id);

-- Permite logout imediato sem armazenar o token Bearer em texto puro.
CREATE TABLE IF NOT EXISTS tokens_revogados (
  jti UUID PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  expira_em TIMESTAMPTZ NOT NULL,
  revogado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_revogados_expira_em
  ON tokens_revogados(expira_em);
