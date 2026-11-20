-- 0.8.1 · Base de empleados: importación del Listado de Activos, equivalencias, egreso y plazas por regularizar.
-- Ficha del trabajador: TODOS los datos del Listado. Los personales (nacimiento, sexo, hijos…) solo los ve Gestión Humana.
ALTER TABLE trabajador
  ADD COLUMN sexo text,
  ADD COLUMN hijos int,
  ADD COLUMN nivel_academico text,
  ADD COLUMN titulo text,
  ADD COLUMN datos jsonb NOT NULL DEFAULT '{}',          -- la fila completa del Listado tal como vino (todas las columnas)
  ADD COLUMN actualizado_en timestamptz;

-- Relación laboral: datos del puesto según el Listado y cómo terminó
ALTER TABLE relacion_laboral
  ADD COLUMN ubicacion text,
  ADD COLUMN tipo_empleado text,
  ADD COLUMN fecha_fin_contrato date,
  ADD COLUMN departamento_origen text,
  ADD COLUMN supervisor_id int REFERENCES trabajador,
  ADD COLUMN supervisor_texto text,
  ADD COLUMN tipo_egreso text,
  ADD COLUMN importacion_id int;
ALTER TABLE relacion_laboral ADD CONSTRAINT ck_relacion_tipo_egreso CHECK (tipo_egreso IS NULL OR tipo_egreso IN
  ('renuncia', 'despido_justificado', 'despido_injustificado', 'fin_contrato', 'mutuo_acuerdo', 'jubilacion', 'otro'));

-- Quién consultó la ficha de un empleado (datos personales): registro de accesos
CREATE TABLE consulta_ficha (id bigserial PRIMARY KEY, trabajador_id int NOT NULL REFERENCES trabajador, usuario_id int NOT NULL REFERENCES usuario,
  fecha timestamptz NOT NULL DEFAULT now());
CREATE INDEX ix_consulta_ficha ON consulta_ficha (trabajador_id, fecha DESC);

-- Equivalencias del Listado con el portal: departamento (de una empresa) → unidad; cargo → perfil.
-- empresa_id NULL = vale para todas las empresas.
CREATE TABLE equivalencia (id serial PRIMARY KEY, tipo text NOT NULL CHECK (tipo IN ('departamento', 'cargo')),
  empresa_id int REFERENCES empresa, origen text NOT NULL, origen_norm text NOT NULL,
  unidad_id int REFERENCES unidad, perfil_id int REFERENCES perfil,
  creado_por int REFERENCES usuario, actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK ((tipo = 'departamento' AND unidad_id IS NOT NULL AND perfil_id IS NULL) OR (tipo = 'cargo' AND perfil_id IS NOT NULL AND unidad_id IS NULL)));
CREATE UNIQUE INDEX ux_equivalencia ON equivalencia (tipo, coalesce(empresa_id, 0), origen_norm);

-- Cada importación del Listado queda registrada (archivo, quién, resumen)
CREATE TABLE importacion (id serial PRIMARY KEY, tipo text NOT NULL, archivo text, resumen jsonb, usuario_id int REFERENCES usuario,
  creado_en timestamptz NOT NULL DEFAULT now());
ALTER TABLE relacion_laboral ADD CONSTRAINT fk_relacion_importacion FOREIGN KEY (importacion_id) REFERENCES importacion;

-- Plazas: origen «carga_inicial» (creadas por la importación) y regularización por GH
ALTER TABLE plaza DROP CONSTRAINT IF EXISTS plaza_origen_check;
ALTER TABLE plaza ADD CONSTRAINT plaza_origen_check CHECK (origen IN ('manual', 'carga', 'requisicion', 'carga_inicial'));
ALTER TABLE plaza
  ADD COLUMN regularizada_por int REFERENCES usuario,
  ADD COLUMN regularizada_en timestamptz,
  ADD COLUMN regularizacion text;      -- quién la autorizó y con qué soporte (por ejemplo: «Presidencia, correo del 20-11-2026»)
