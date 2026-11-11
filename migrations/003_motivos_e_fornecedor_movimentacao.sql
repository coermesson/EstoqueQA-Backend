-- Adiciona um motivo explícito sem apagar nem sobrescrever observações antigas.
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS motivo TEXT;
UPDATE movimentacoes SET motivo=observacao WHERE motivo IS NULL AND observacao IS NOT NULL;

-- Novas movimentações só podem indicar fornecedores já associados ao produto.
-- NOT VALID preserva históricos pré-existentes e valida todas as novas gravações.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='fk_movimentacoes_produto_fornecedor'
      AND conrelid='movimentacoes'::regclass
  ) THEN
    ALTER TABLE movimentacoes
      ADD CONSTRAINT fk_movimentacoes_produto_fornecedor
      FOREIGN KEY (produto_id, fornecedor_id)
      REFERENCES produtos_fornecedores(produto_id, fornecedor_id)
      NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_movimentacoes_fornecedor_data
  ON movimentacoes(fornecedor_id, criado_em DESC);
