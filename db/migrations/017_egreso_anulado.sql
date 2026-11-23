-- 0.9.2 · Anular un egreso registrado por error y marcar un puesto «creado por error».
--
-- Anular egreso: la relación egresada pasa a «egreso_anulado» (no aparece en el organigrama a ninguna fecha) y se abre otra
-- activa igual, con la misma fecha de ingreso (reubicada_desde = la anulada, tipo_reubicacion = 'anulacion_egreso').
ALTER TABLE relacion_laboral DROP CONSTRAINT ck_relacion_estado;
ALTER TABLE relacion_laboral ADD CONSTRAINT ck_relacion_estado CHECK (estado IN ('por_ingresar', 'activo', 'egresado', 'movido', 'no_ingreso', 'corregida', 'egreso_anulado'));
ALTER TABLE relacion_laboral DROP CONSTRAINT relacion_laboral_tipo_reubicacion_check;
ALTER TABLE relacion_laboral ADD CONSTRAINT relacion_laboral_tipo_reubicacion_check CHECK (tipo_reubicacion IS NULL OR tipo_reubicacion IN ('correccion', 'traslado', 'anulacion_egreso'));
ALTER TABLE relacion_laboral
  ADD COLUMN anulado_por int REFERENCES usuario,
  ADD COLUMN anulado_en timestamptz,
  ADD COLUMN motivo_anulacion text;

-- Una relación cerrada no se modifica. Única excepción: un egreso se puede anular (solo cambian el estado y los datos de la anulación).
CREATE OR REPLACE FUNCTION relacion_cerrada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE campos text[] := ARRAY['estado', 'anulado_por', 'anulado_en', 'motivo_anulacion'];
BEGIN
  IF OLD.estado = 'egresado' AND NEW.estado = 'egreso_anulado' AND (to_jsonb(NEW) - campos) = (to_jsonb(OLD) - campos) THEN RETURN NEW; END IF;
  IF OLD.estado IN ('egresado', 'movido', 'no_ingreso', 'corregida', 'egreso_anulado') THEN RAISE EXCEPTION 'La relación laboral ya está cerrada y no se puede modificar'; END IF;
  RETURN NEW;
END $$;

-- Puesto desactivado: por qué y si fue un error (por ejemplo, creado por la carga inicial con un cargo que no existe)
ALTER TABLE puesto
  ADD COLUMN creado_por_error boolean NOT NULL DEFAULT false,
  ADD COLUMN motivo_baja text,
  ADD COLUMN desactivado_por int REFERENCES usuario,
  ADD COLUMN desactivado_en timestamptz;
