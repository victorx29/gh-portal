-- 0.6 · Divisiones, datos de empresa y Perfiles y Cargos

-- Divisiones: cada empresa pertenece a una; una empresa de servicios (p. ej. transporte) puede atender a varias
CREATE TABLE division (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, activo boolean NOT NULL DEFAULT true);
ALTER TABLE empresa ADD COLUMN division_id int REFERENCES division, ADD COLUMN direccion_fiscal text;
CREATE TABLE empresa_division_servicio (empresa_id int NOT NULL REFERENCES empresa, division_id int NOT NULL REFERENCES division, PRIMARY KEY (empresa_id, division_id));

-- Perfiles: código automático GH-PF-NNN; versión GH-PF-NNN-VV. Las versiones siguen siendo inmutables:
-- la versión vigente se marca en el perfil (version_activa_id), no en la versión.
ALTER TABLE perfil ADD COLUMN correlativo int UNIQUE, ADD COLUMN codigo_anterior text, ADD COLUMN nivel text,
  ADD COLUMN general boolean NOT NULL DEFAULT false, ADD COLUMN version_activa_id int REFERENCES perfil_version,
  ADD COLUMN creado_en timestamptz NOT NULL DEFAULT now();
CREATE SEQUENCE perfil_seq;
-- Alcance: cada fila es una empresa, una unidad o ambas. Sin filas y general=false = nadie lo ve.
CREATE TABLE perfil_alcance (id serial PRIMARY KEY, perfil_id int NOT NULL REFERENCES perfil, empresa_id int REFERENCES empresa, unidad_id int REFERENCES unidad,
  CHECK (empresa_id IS NOT NULL OR unidad_id IS NOT NULL));
CREATE UNIQUE INDEX ux_perfil_alcance ON perfil_alcance (perfil_id, COALESCE(empresa_id, 0), COALESCE(unidad_id, 0));

-- Migración de los perfiles existentes: correlativo por orden de creación, código nuevo y el anterior guardado
WITH n AS (SELECT id, row_number() OVER (ORDER BY id) k FROM perfil)
UPDATE perfil p SET correlativo = n.k, codigo_anterior = p.codigo, codigo = 'GH-PF-' || lpad(n.k::text, 3, '0') FROM n WHERE n.id = p.id;
SELECT setval('perfil_seq', GREATEST(1, (SELECT coalesce(max(correlativo), 0) FROM perfil)), (SELECT count(*) > 0 FROM perfil));
UPDATE perfil p SET version_activa_id = (SELECT id FROM perfil_version v WHERE v.perfil_id = p.id ORDER BY version DESC LIMIT 1);
UPDATE perfil SET general = true WHERE empresa_id IS NULL;
INSERT INTO perfil_alcance (perfil_id, empresa_id) SELECT id, empresa_id FROM perfil WHERE empresa_id IS NOT NULL;
ALTER TABLE perfil ALTER COLUMN correlativo SET NOT NULL;
