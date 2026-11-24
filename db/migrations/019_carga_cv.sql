-- 0.9.4 · Carga masiva de CV: número de candidato por requisición, lectura del CV en n8n (OCR y datos) y alertas.

-- Número del candidato dentro de la requisición: REQ-00001-C03. No depende de la cédula (en la carga masiva aún no se conoce).
ALTER TABLE candidatura ADD COLUMN correlativo int, ADD COLUMN codigo text;
WITH n AS (SELECT ca.id, row_number() OVER (PARTITION BY ca.requisicion_id ORDER BY ca.id) k, r.codigo FROM candidatura ca JOIN requisicion r ON r.id = ca.requisicion_id)
UPDATE candidatura ca SET correlativo = n.k, codigo = n.codigo || '-C' || CASE WHEN n.k < 10 THEN '0' || n.k ELSE n.k::text END FROM n WHERE n.id = ca.id;
ALTER TABLE candidatura ALTER COLUMN correlativo SET NOT NULL, ALTER COLUMN codigo SET NOT NULL;
CREATE UNIQUE INDEX ux_candidatura_correlativo ON candidatura (requisicion_id, correlativo);
CREATE UNIQUE INDEX ux_candidatura_codigo ON candidatura (codigo);
-- Lo asigna la base al insertar (cualquier camino: alta manual, carga masiva). La requisición ya está bloqueada por quien inserta.
CREATE FUNCTION candidatura_codigo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k int; rc text;
BEGIN
  SELECT coalesce(max(correlativo), 0) + 1 INTO k FROM candidatura WHERE requisicion_id = NEW.requisicion_id;
  SELECT codigo INTO rc FROM requisicion WHERE id = NEW.requisicion_id;
  NEW.correlativo := k; NEW.codigo := rc || '-C' || CASE WHEN k < 10 THEN '0' || k ELSE k::text END;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_candidatura_codigo BEFORE INSERT ON candidatura FOR EACH ROW EXECUTE FUNCTION candidatura_codigo();
CREATE FUNCTION candidatura_codigo_fijo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.correlativo IS DISTINCT FROM OLD.correlativo OR NEW.codigo IS DISTINCT FROM OLD.codigo OR NEW.requisicion_id IS DISTINCT FROM OLD.requisicion_id THEN
  RAISE EXCEPTION 'El número del candidato % no se modifica', OLD.codigo; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_candidatura_codigo_fijo BEFORE UPDATE ON candidatura FOR EACH ROW EXECUTE FUNCTION candidatura_codigo_fijo();

-- Candidato creado desde un CV: el nombre es el del archivo hasta que la lectura (o GH) ponga el real.
-- unido_a: la ficha provisional se unió a la ficha anterior de la misma persona (misma cédula); no se borra.
ALTER TABLE candidato ADD COLUMN nombre_provisional boolean NOT NULL DEFAULT false, ADD COLUMN unido_a int REFERENCES candidato;

-- Lectura del CV en n8n (OCR local y extracción de nombre, cédula, correo y teléfono)
--   no_aplica: no se pidió · sin_lectura: n8n no está configurado · pendiente · lista · error
ALTER TABLE cv_archivo
  ADD COLUMN hash text,
  ADD COLUMN lectura text NOT NULL DEFAULT 'no_aplica' CHECK (lectura IN ('no_aplica', 'sin_lectura', 'pendiente', 'lista', 'error')),
  ADD COLUMN lectura_token text, ADD COLUMN lectura_pedida_en timestamptz, ADD COLUMN lectura_recibida_en timestamptz,
  ADD COLUMN lectura_datos jsonb, ADD COLUMN lectura_modelo text, ADD COLUMN lectura_error text,
  ADD COLUMN alertas jsonb NOT NULL DEFAULT '[]', ADD COLUMN alertas_revisadas_en timestamptz, ADD COLUMN alertas_revisadas_por int REFERENCES usuario;
CREATE INDEX ix_cv_archivo_hash ON cv_archivo (requisicion_id, hash);

-- Corrección: dos transacciones que escriben en el historial a la vez se trababan (deadlock). Cada una ya tenía el permiso normal de
-- escritura en la tabla y luego pedía el bloqueo exclusivo: se esperaban mutuamente. Aparece con n8n devolviendo varias lecturas a la vez.
-- Ahora la cadena de hash se ordena con un candado de transacción: el segundo espera a que el primero termine (sin trabarse), y el número
-- de la fila se toma dentro del candado, para que el orden de los números sea el de la cadena (el «anterior» es siempre la última fila).
CREATE OR REPLACE FUNCTION historial_hash() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prev text;
BEGIN
  PERFORM pg_advisory_xact_lock(7140001);   -- candado de la cadena del historial (se libera al terminar la transacción)
  NEW.id := nextval(pg_get_serial_sequence('historial', 'id'));   -- número en el orden de la cadena (el tomado antes queda sin usar)
  SELECT hash INTO prev FROM historial ORDER BY id DESC LIMIT 1;
  NEW.hash_prev := prev;
  NEW.hash := encode(digest(coalesce(prev,'') || NEW.fecha::text || coalesce(NEW.usuario_id::text,'') || NEW.entidad || NEW.entidad_id || NEW.accion || coalesce(NEW.detalle::text,''), 'sha256'), 'hex');
  RETURN NEW;
END $$;
