-- 0.5 · Estructura organizativa dinámica con vigencia
-- Principio: la estructura nunca se edita en sitio. Cada dependencia (sólida o funcional) se CIERRA con fecha
-- y se abre una nueva. Así el organigrama de cualquier fecha se reconstruye y las aprobaciones pasadas cuadran.

-- Fechas de vigencia en hora de Venezuela (current_date). Si el usuario de BD no es dueño, se omite sin fallar.
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/Caracas');
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'Sin permiso para fijar la zona horaria; configúrala en el servicio PostgreSQL'; END $$;

-- Grupos empresariales (APB, ARO, ...) y empresa ampliada
CREATE TABLE grupo (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, siglas text, activo boolean NOT NULL DEFAULT true);
INSERT INTO grupo (nombre, siglas) VALUES ('Grupo APB', 'APB');
ALTER TABLE empresa ADD COLUMN grupo_id int REFERENCES grupo, ADD COLUMN razon_social text, ADD COLUMN siglas text,
  ADD COLUMN rif text, ADD COLUMN estado text, ADD COLUMN ciudad text;
UPDATE empresa SET grupo_id = (SELECT id FROM grupo WHERE siglas = 'APB');
ALTER TABLE empresa ALTER COLUMN grupo_id SET NOT NULL;
CREATE UNIQUE INDEX ux_empresa_rif ON empresa (upper(replace(rif, '-', ''))) WHERE rif IS NOT NULL;
CREATE UNIQUE INDEX ux_empresa_siglas ON empresa (upper(siglas)) WHERE siglas IS NOT NULL;

-- Tipos de unidad (maestro configurable): el nivel solo ordena, no impone jerarquía
CREATE TABLE tipo_unidad (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, nivel int NOT NULL DEFAULT 50, activo boolean NOT NULL DEFAULT true);
INSERT INTO tipo_unidad (nombre, nivel) VALUES ('Presidencia', 10), ('Dirección', 20), ('División', 25), ('Gerencia general', 30), ('Gerencia', 40),
  ('Departamento', 50), ('Jefatura', 60), ('Coordinación', 70), ('Área', 80);

-- Unidad organizativa. empresa_id NULL = unidad corporativa del grupo (servicio compartido).
-- aprueba = la aprobación de requisiciones se detiene aquí al subir por la línea sólida.
CREATE SEQUENCE unidad_seq;
CREATE TABLE unidad (
  id serial PRIMARY KEY, codigo text NOT NULL UNIQUE DEFAULT ('UO-' || lpad(nextval('unidad_seq')::text, 4, '0')),
  nombre text NOT NULL, tipo_id int NOT NULL REFERENCES tipo_unidad, grupo_id int NOT NULL REFERENCES grupo, empresa_id int REFERENCES empresa,
  aprueba boolean NOT NULL DEFAULT false, activa boolean NOT NULL DEFAULT true,
  legacy_area_id int UNIQUE, legacy_direccion_id int UNIQUE, creada_en timestamptz NOT NULL DEFAULT now());
-- Empresas a las que sirve una unidad (servicios compartidos: Administración atiende a MDV y CIM)
CREATE TABLE unidad_empresa (unidad_id int NOT NULL REFERENCES unidad, empresa_id int NOT NULL REFERENCES empresa, PRIMARY KEY (unidad_id, empresa_id));

-- Dependencias con vigencia [desde, hasta). Sólida = jerárquica (una vigente por unidad); funcional = punteada (varias).
CREATE TABLE unidad_relacion (
  id bigserial PRIMARY KEY, unidad_id int NOT NULL REFERENCES unidad, padre_id int NOT NULL REFERENCES unidad,
  tipo text NOT NULL CHECK (tipo IN ('solida', 'funcional')), desde date NOT NULL DEFAULT current_date, hasta date,
  motivo text, creado_por int REFERENCES usuario, cerrado_por int REFERENCES usuario, creado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (unidad_id <> padre_id), CHECK (hasta IS NULL OR hasta >= desde));
CREATE UNIQUE INDEX ux_rel_solida_vigente ON unidad_relacion (unidad_id) WHERE tipo = 'solida' AND hasta IS NULL;
CREATE UNIQUE INDEX ux_rel_funcional_vigente ON unidad_relacion (unidad_id, padre_id) WHERE tipo = 'funcional' AND hasta IS NULL;
CREATE INDEX ix_rel_padre ON unidad_relacion (padre_id) WHERE hasta IS NULL;

-- Una relación solo se cierra (una vez); nunca se borra ni se cambia
CREATE FUNCTION rel_solo_cierre() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Una dependencia no se borra: se cierra con fecha'; END IF;
  IF OLD.hasta IS NOT NULL OR NEW.hasta IS NULL
     OR (NEW.unidad_id, NEW.padre_id, NEW.tipo, NEW.desde, NEW.motivo) IS DISTINCT FROM (OLD.unidad_id, OLD.padre_id, OLD.tipo, OLD.desde, OLD.motivo) THEN
    RAISE EXCEPTION 'Una dependencia solo se puede cerrar una vez';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rel_solo_cierre BEFORE UPDATE OR DELETE ON unidad_relacion FOR EACH ROW EXECUTE FUNCTION rel_solo_cierre();

-- Sin ciclos en la línea sólida (A no puede depender de algo que depende de A)
CREATE FUNCTION rel_sin_ciclo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo = 'solida' AND NEW.hasta IS NULL THEN
    LOCK TABLE unidad_relacion IN SHARE ROW EXCLUSIVE MODE;
    IF EXISTS (WITH RECURSIVE up(id) AS (SELECT NEW.padre_id UNION SELECT r.padre_id FROM unidad_relacion r JOIN up ON r.unidad_id = up.id WHERE r.tipo = 'solida' AND r.hasta IS NULL)
               SELECT 1 FROM up WHERE id = NEW.unidad_id) THEN
      RAISE EXCEPTION 'La dependencia crea un ciclo en la estructura' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rel_sin_ciclo BEFORE INSERT ON unidad_relacion FOR EACH ROW EXECUTE FUNCTION rel_sin_ciclo();

-- Unidad que aprueba: la primera marcada «aprueba» subiendo por la línea sólida vigente (incluida la propia)
CREATE FUNCTION unidad_aprobadora(p_unidad int) RETURNS int LANGUAGE sql STABLE AS $$
  WITH RECURSIVE up(id, prof) AS (SELECT p_unidad, 0
    UNION ALL SELECT r.padre_id, up.prof + 1 FROM unidad_relacion r JOIN up ON r.unidad_id = up.id WHERE r.tipo = 'solida' AND r.hasta IS NULL AND up.prof < 50)
  SELECT up.id FROM up JOIN unidad u ON u.id = up.id WHERE u.aprueba AND u.activa ORDER BY up.prof LIMIT 1 $$;
-- Cadena de mando vigente (para la foto de cada aprobación)
CREATE FUNCTION unidad_cadena(p_unidad int) RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH RECURSIVE up(id, prof) AS (SELECT p_unidad, 0
    UNION ALL SELECT r.padre_id, up.prof + 1 FROM unidad_relacion r JOIN up ON r.unidad_id = up.id WHERE r.tipo = 'solida' AND r.hasta IS NULL AND up.prof < 50)
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'codigo', u.codigo, 'nombre', u.nombre, 'tipo', t.nombre, 'aprueba', u.aprueba) ORDER BY up.prof), '[]')
  FROM up JOIN unidad u ON u.id = up.id JOIN tipo_unidad t ON t.id = u.tipo_id $$;

-- Roles por unidad: un rol con unidad_id alcanza a esa unidad y a sus dependientes (línea sólida)
ALTER TABLE usuario_rol ADD COLUMN unidad_id int REFERENCES unidad;
DROP INDEX ux_usuario_rol;
CREATE UNIQUE INDEX ux_usuario_rol ON usuario_rol (usuario_id, rol, COALESCE(empresa_id, 0), COALESCE(unidad_id, 0));

-- Requisición y relación laboral pasan de «área» a unidad. area_id queda solo como referencia histórica.
ALTER TABLE requisicion ADD COLUMN unidad_id int REFERENCES unidad;
ALTER TABLE relacion_laboral ADD COLUMN unidad_id int REFERENCES unidad;
-- Foto inmutable de la estructura con la que se decidió cada aprobación
ALTER TABLE aprobacion ADD COLUMN estructura jsonb;
CREATE TRIGGER trg_aprobacion_nomod BEFORE UPDATE OR DELETE ON aprobacion FOR EACH ROW EXECUTE FUNCTION bloquear_mod();

-- ---- Migración de datos 0.4 → 0.5 ----
-- Direcciones antiguas → unidades corporativas tipo Dirección (sin «aprueba»: hasta que se asigne su director,
-- las requisiciones siguen aprobándose como en la 0.4, por el director de la empresa)
INSERT INTO unidad (nombre, tipo_id, grupo_id, empresa_id, legacy_direccion_id)
  SELECT d.nombre, (SELECT id FROM tipo_unidad WHERE nombre = 'Dirección'), (SELECT id FROM grupo WHERE siglas = 'APB'), NULL, d.id FROM direccion d;
INSERT INTO unidad_empresa (unidad_id, empresa_id)
  SELECT u.id, de.empresa_id FROM direccion_empresa de JOIN unidad u ON u.legacy_direccion_id = de.direccion_id;
-- Áreas antiguas → unidades tipo Área de su empresa
INSERT INTO unidad (nombre, tipo_id, grupo_id, empresa_id, legacy_area_id)
  SELECT a.nombre, (SELECT id FROM tipo_unidad WHERE nombre = 'Área'), e.grupo_id, a.empresa_id, a.id FROM area a JOIN empresa e ON e.id = a.empresa_id;
INSERT INTO unidad_relacion (unidad_id, padre_id, tipo, motivo)
  SELECT ua.id, ud.id, 'solida', 'Migración 0.5' FROM area a JOIN unidad ua ON ua.legacy_area_id = a.id JOIN unidad ud ON ud.legacy_direccion_id = a.direccion_id;
UPDATE requisicion r SET unidad_id = u.id FROM unidad u WHERE u.legacy_area_id = r.area_id;
UPDATE relacion_laboral r SET unidad_id = u.id FROM unidad u WHERE u.legacy_area_id = r.area_id;
