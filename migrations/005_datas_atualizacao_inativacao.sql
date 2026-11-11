-- Datas de manutenção do cadastro sem alterar o histórico existente.
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS inativado_em TIMESTAMPTZ;
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS inativado_em TIMESTAMPTZ;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS inativado_em TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS inativado_em TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION atualizar_marcas_temporais() RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em := NOW();
  IF TG_OP = 'UPDATE' AND OLD.ativo IS DISTINCT FROM NEW.ativo THEN
    NEW.inativado_em := CASE WHEN NEW.ativo THEN NULL ELSE NOW() END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_produtos_marcas_temporais ON produtos;
CREATE TRIGGER trg_produtos_marcas_temporais BEFORE UPDATE ON produtos
FOR EACH ROW EXECUTE FUNCTION atualizar_marcas_temporais();
DROP TRIGGER IF EXISTS trg_categorias_marcas_temporais ON categorias;
CREATE TRIGGER trg_categorias_marcas_temporais BEFORE UPDATE ON categorias
FOR EACH ROW EXECUTE FUNCTION atualizar_marcas_temporais();
DROP TRIGGER IF EXISTS trg_fornecedores_marcas_temporais ON fornecedores;
CREATE TRIGGER trg_fornecedores_marcas_temporais BEFORE UPDATE ON fornecedores
FOR EACH ROW EXECUTE FUNCTION atualizar_marcas_temporais();
DROP TRIGGER IF EXISTS trg_usuarios_marcas_temporais ON usuarios;
CREATE TRIGGER trg_usuarios_marcas_temporais BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION atualizar_marcas_temporais();

CREATE INDEX IF NOT EXISTS idx_movimentacoes_usuario_data ON movimentacoes(usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_data ON auditoria(usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_papel_ativo ON usuarios(papel, ativo);
