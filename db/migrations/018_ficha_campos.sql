-- 0.9.3 · Ficha completa del empleado, campos personalizados y catálogos de la ficha.
--
-- Catálogos (Configuración › Catálogos): la sede donde trabaja y el tipo de empleado. Arrancan con los valores del
-- Listado ya importado; desde aquí la ficha se llena eligiendo de la lista, no con texto libre.
CREATE TABLE ubicacion (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, activo boolean NOT NULL DEFAULT true);
CREATE TABLE tipo_empleado (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, activo boolean NOT NULL DEFAULT true,
  requiere_fin boolean NOT NULL DEFAULT false);   -- «Contratado»: pide la fecha de fin de contrato
INSERT INTO ubicacion (nombre) SELECT DISTINCT btrim(ubicacion) FROM relacion_laboral WHERE nullif(btrim(ubicacion), '') IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO tipo_empleado (nombre, requiere_fin) SELECT DISTINCT btrim(tipo_empleado), btrim(tipo_empleado) ILIKE 'contrat%' FROM relacion_laboral
  WHERE nullif(btrim(tipo_empleado), '') IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO tipo_empleado (nombre, requiere_fin) VALUES ('Fijo', false), ('Contratado', true) ON CONFLICT DO NOTHING;

-- Campos personalizados que define Gestión Humana: para el candidato, el empleado o ambos.
-- Nunca se envían a la IA ni a n8n. «Sensible» = solo Gestión Humana lo ve (hoy candidato y ficha ya son solo de GH;
-- la marca protege las vistas que se abran a otros roles en el futuro).
CREATE TABLE campo_personalizado (
  id serial PRIMARY KEY, etiqueta text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('texto', 'numero', 'fecha', 'lista', 'si_no')),
  opciones text[] NOT NULL DEFAULT '{}',                        -- solo para «lista»
  aplica text NOT NULL CHECK (aplica IN ('candidato', 'empleado', 'ambos')),
  obligatorio boolean NOT NULL DEFAULT false, sensible boolean NOT NULL DEFAULT false, ayuda text,
  orden int NOT NULL DEFAULT 0, activo boolean NOT NULL DEFAULT true,
  creado_por int REFERENCES usuario, creado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (tipo <> 'lista' OR cardinality(opciones) > 0));
CREATE UNIQUE INDEX ux_campo_etiqueta ON campo_personalizado (lower(etiqueta)) WHERE activo;
-- Valores: { "<id del campo>": valor }
ALTER TABLE candidato ADD COLUMN campos jsonb NOT NULL DEFAULT '{}';
ALTER TABLE trabajador ADD COLUMN campos jsonb NOT NULL DEFAULT '{}';
