-- Esquema-base para instalações novas. Em bancos existentes, não altera nem apaga dados.
CREATE TABLE IF NOT EXISTS produtos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT,
  quantidade INTEGER NOT NULL DEFAULT 0,
  preco NUMERIC(12,2) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_produtos_quantidade_base CHECK (quantidade >= 0),
  CONSTRAINT ck_produtos_preco_base CHECK (preco >= 0)
);

-- Reforça a compatibilidade estrutural sem substituir a tabela existente.
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 0;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco NUMERIC(12,2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE produtos ALTER COLUMN preco SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_produtos_quantidade_base' AND conrelid='produtos'::regclass) THEN
    ALTER TABLE produtos ADD CONSTRAINT ck_produtos_quantidade_base CHECK (quantidade >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_produtos_preco_base' AND conrelid='produtos'::regclass) THEN
    ALTER TABLE produtos ADD CONSTRAINT ck_produtos_preco_base CHECK (preco >= 0) NOT VALID;
  END IF;
END
$$;
