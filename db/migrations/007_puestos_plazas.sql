-- 0.7 · Puestos y plazas (plantilla autorizada)
-- Puesto = un perfil (GH-PF) dentro de una unidad. Plaza = cada posición autorizada de ese puesto.
-- La empresa vive en la PLAZA (quién paga la nómina), no en la unidad: una unidad corporativa puede tener plazas de varias empresas.
-- Estado de plan (calculado a una fecha): proyectada (desde futuro) · vigente · congelada · cerrada (hasta).
-- La ocupación (ocupada / vacante / en proceso) llega en la 0.8 con los empleados.

CREATE TABLE puesto (
  id serial PRIMARY KEY, unidad_id int NOT NULL REFERENCES unidad, perfil_id int NOT NULL REFERENCES perfil,
  jefe boolean NOT NULL DEFAULT false,            -- puesto que encabeza la unidad (el jefe directo por defecto)
  reporta_a int REFERENCES puesto,                -- excepción explícita; NULL = regla por defecto
  activo boolean NOT NULL DEFAULT true, creado_por int REFERENCES usuario, creado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (reporta_a IS NULL OR reporta_a <> id));
CREATE UNIQUE INDEX ux_puesto ON puesto (unidad_id, perfil_id) WHERE activo;
CREATE UNIQUE INDEX ux_puesto_jefe ON puesto (unidad_id) WHERE jefe AND activo;

CREATE SEQUENCE plaza_seq;
CREATE TABLE plaza (
  id serial PRIMARY KEY, codigo text NOT NULL UNIQUE DEFAULT ('PZ-' || lpad(nextval('plaza_seq')::text, 5, '0')),
  puesto_id int NOT NULL REFERENCES puesto, empresa_id int NOT NULL REFERENCES empresa,
  modalidad text NOT NULL DEFAULT 'nomina' CHECK (modalidad IN ('nomina', 'outsourcing', 'pasante', 'becario', 'aprendiz')),
  desde date NOT NULL DEFAULT current_date, hasta date, congelada boolean NOT NULL DEFAULT false,
  origen text NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'carga', 'requisicion')), motivo text, requisicion_id int REFERENCES requisicion,
  creado_por int REFERENCES usuario, creado_en timestamptz NOT NULL DEFAULT now(), cerrado_por int REFERENCES usuario, motivo_cierre text,
  CHECK (hasta IS NULL OR hasta >= desde));
CREATE INDEX ix_plaza_puesto ON plaza (puesto_id) WHERE hasta IS NULL;

-- Ni puestos ni plazas se borran: el puesto se desactiva y la plaza se cierra con fecha
CREATE FUNCTION no_borrar_plantilla() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'La plantilla no se borra: desactiva el puesto o cierra la plaza con fecha'; END $$;
CREATE TRIGGER trg_puesto_no_borrar BEFORE DELETE ON puesto FOR EACH ROW EXECUTE FUNCTION no_borrar_plantilla();
CREATE TRIGGER trg_plaza_no_borrar BEFORE DELETE ON plaza FOR EACH ROW EXECUTE FUNCTION no_borrar_plantilla();
-- Una plaza cerrada no se reabre ni se modifica
CREATE FUNCTION plaza_cerrada_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.hasta IS NOT NULL AND OLD.hasta <= current_date THEN RAISE EXCEPTION 'La plaza % está cerrada y no se puede modificar', OLD.codigo; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_plaza_cerrada BEFORE UPDATE ON plaza FOR EACH ROW EXECUTE FUNCTION plaza_cerrada_inmutable();
