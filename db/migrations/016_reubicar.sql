-- 0.9.1 · Reubicar a un empleado en otra plaza (solo Gestión Humana).
--  · Corrección: la persona quedó en la plaza equivocada (por ejemplo, por la carga inicial del Listado). Su relación se cierra
--    como «corregida» (no cuenta como movimiento ni aparece en el organigrama a ninguna fecha) y se abre otra igual en la plaza
--    correcta, con la misma fecha de ingreso.
--  · Traslado: cambio real de plaza en una fecha. La relación anterior se cierra como «movido» el día antes y la nueva empieza ese día.
-- La relación nueva guarda de cuál viene y por qué (reubicada_desde, tipo_reubicacion).
ALTER TABLE relacion_laboral DROP CONSTRAINT ck_relacion_estado;
ALTER TABLE relacion_laboral ADD CONSTRAINT ck_relacion_estado CHECK (estado IN ('por_ingresar', 'activo', 'egresado', 'movido', 'no_ingreso', 'corregida'));
ALTER TABLE relacion_laboral DROP CONSTRAINT ck_relacion_origen;
ALTER TABLE relacion_laboral ADD CONSTRAINT ck_relacion_origen CHECK (origen IN ('seleccion', 'carga_inicial', 'manual', 'traslado'));
ALTER TABLE relacion_laboral
  ADD COLUMN reubicada_desde int REFERENCES relacion_laboral,
  ADD COLUMN tipo_reubicacion text CHECK (tipo_reubicacion IS NULL OR tipo_reubicacion IN ('correccion', 'traslado'));
CREATE INDEX ix_relacion_reubicada ON relacion_laboral (reubicada_desde) WHERE reubicada_desde IS NOT NULL;

-- Una relación «corregida» también está cerrada: no se modifica
CREATE OR REPLACE FUNCTION relacion_cerrada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.estado IN ('egresado', 'movido', 'no_ingreso', 'corregida') THEN RAISE EXCEPTION 'La relación laboral ya está cerrada y no se puede modificar'; END IF; RETURN NEW; END $$;
