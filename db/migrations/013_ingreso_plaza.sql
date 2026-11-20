-- 0.8.0 · Ingreso ligado a la plaza, candidatos únicos por cédula y plaza «por regularizar».
-- Cédula normalizada: solo los dígitos («V-12.345.678» → «12345678»), para comparar candidatos y trabajadores.
CREATE FUNCTION cedula_norm(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT nullif(regexp_replace(coalesce(t, ''), '\D', '', 'g'), '') $$;
UPDATE candidato SET cedula = cedula_norm(cedula) WHERE cedula IS DISTINCT FROM cedula_norm(cedula);
UPDATE trabajador SET cedula = cedula_norm(cedula) WHERE cedula IS DISTINCT FROM cedula_norm(cedula);
-- Un candidato por cédula: sus postulaciones se acumulan en la misma ficha
CREATE UNIQUE INDEX ux_candidato_cedula ON candidato (cedula) WHERE cedula IS NOT NULL;

-- Relación laboral: plaza que ocupa, versión del perfil con la que ingresó, quién confirmó y cómo terminó.
-- Estados: por_ingresar → activo → egresado | movido (otra plaza) ; por_ingresar → no_ingreso
ALTER TABLE relacion_laboral
  ADD COLUMN plaza_id int REFERENCES plaza,
  ADD COLUMN perfil_version_id int REFERENCES perfil_version,
  ADD COLUMN candidatura_id int REFERENCES candidatura,
  ADD COLUMN origen text NOT NULL DEFAULT 'seleccion',
  ADD COLUMN confirmado_por int REFERENCES usuario,
  ADD COLUMN confirmado_en timestamptz,
  ADD COLUMN cerrado_por int REFERENCES usuario,
  ADD COLUMN motivo_cierre text,
  ADD COLUMN creado_en timestamptz NOT NULL DEFAULT now();
ALTER TABLE relacion_laboral ADD CONSTRAINT ck_relacion_estado CHECK (estado IN ('por_ingresar', 'activo', 'egresado', 'movido', 'no_ingreso'));
ALTER TABLE relacion_laboral ADD CONSTRAINT ck_relacion_origen CHECK (origen IN ('seleccion', 'carga_inicial', 'manual'));
ALTER TABLE relacion_laboral ADD CONSTRAINT ck_relacion_fechas CHECK (fecha_egreso IS NULL OR fecha_ingreso IS NULL OR fecha_egreso >= fecha_ingreso);
UPDATE relacion_laboral r SET plaza_id = q.plaza_id, perfil_version_id = q.perfil_version_id FROM requisicion q WHERE q.id = r.requisicion_id AND r.plaza_id IS NULL;
-- Una plaza tiene a lo sumo una persona activa y una por ingresar (el reemplazo puede entrar mientras sale el anterior)
CREATE UNIQUE INDEX ux_relacion_plaza_activa ON relacion_laboral (plaza_id) WHERE estado = 'activo';
CREATE UNIQUE INDEX ux_relacion_plaza_por_ingresar ON relacion_laboral (plaza_id) WHERE estado = 'por_ingresar';
CREATE INDEX ix_relacion_trabajador ON relacion_laboral (trabajador_id);
-- Las relaciones no se borran; una cerrada no se modifica
CREATE FUNCTION relacion_no_borrar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'La relación laboral no se borra: se cierra con fecha y motivo'; END $$;
CREATE TRIGGER trg_relacion_no_borrar BEFORE DELETE ON relacion_laboral FOR EACH ROW EXECUTE FUNCTION relacion_no_borrar();
CREATE FUNCTION relacion_cerrada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.estado IN ('egresado', 'movido', 'no_ingreso') THEN RAISE EXCEPTION 'La relación laboral ya está cerrada y no se puede modificar'; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_relacion_cerrada BEFORE UPDATE ON relacion_laboral FOR EACH ROW EXECUTE FUNCTION relacion_cerrada();

-- Plaza creada por la carga inicial del Listado sin estar autorizada: no cuenta en el HC y no admite ingresos
-- ni reemplazos hasta que GH la regularice (0.8.1).
ALTER TABLE plaza ADD COLUMN por_regularizar boolean NOT NULL DEFAULT false;
