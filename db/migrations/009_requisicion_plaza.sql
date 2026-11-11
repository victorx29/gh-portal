-- 0.7.2 · Requisición ligada a la plaza (una plaza por requisición) y empresa «Por definir»
-- Plaza sin empresa = «Por definir»: solo en unidades corporativas. Se fija al aprobar la requisición, al ingresar la persona (0.8) o cuando GH la asigne.
ALTER TABLE plaza ALTER COLUMN empresa_id DROP NOT NULL;
-- Reemplazo: la plaza se elige al crear la requisición. Cargo nuevo: la plaza se crea al aprobarse y se enlaza aquí.
ALTER TABLE requisicion ADD COLUMN plaza_id int REFERENCES plaza;
CREATE INDEX ix_requisicion_plaza ON requisicion (plaza_id) WHERE plaza_id IS NOT NULL;
