-- Los estados dejan de ser enums fijos: ahora son claves de etapas configurables por empresa.
ALTER TABLE requisicion ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE requisicion ALTER COLUMN estado TYPE text USING estado::text;
ALTER TABLE requisicion ALTER COLUMN estado SET DEFAULT 'borrador';
ALTER TABLE candidatura ALTER COLUMN etapa DROP DEFAULT;
ALTER TABLE candidatura ALTER COLUMN etapa TYPE text USING etapa::text;
ALTER TABLE candidatura ALTER COLUMN etapa SET DEFAULT 'seleccionado';
DROP TYPE req_estado_t;
DROP TYPE etapa_t;

-- empresa_id NULL = pipeline estándar del grupo; si una empresa tiene el suyo, lo usa
CREATE TABLE pipeline (id serial PRIMARY KEY, tipo text NOT NULL CHECK (tipo IN ('requisicion','seleccion')), empresa_id int REFERENCES empresa, nombre text NOT NULL);
CREATE UNIQUE INDEX ux_pipeline ON pipeline (tipo, COALESCE(empresa_id, 0));
-- clase: inicio (fija, primera), normal (configurable), exito (fija, Ingreso), cierre (fija, Cancelado/Rechazado)
CREATE TABLE etapa (id serial PRIMARY KEY, pipeline_id int NOT NULL REFERENCES pipeline ON DELETE CASCADE, clave text NOT NULL, nombre text NOT NULL, orden int NOT NULL,
  clase text NOT NULL DEFAULT 'normal' CHECK (clase IN ('inicio','normal','exito','cierre')), reglas jsonb NOT NULL DEFAULT '{}', activa boolean NOT NULL DEFAULT true, UNIQUE (pipeline_id, clave));
-- reglas: { "requiere_resultado": true, "checklist": ["Documento X", "..."] }
CREATE TABLE etapa_registro (id serial PRIMARY KEY, tipo text NOT NULL CHECK (tipo IN ('requisicion','candidatura')), entidad_id int NOT NULL, etapa text NOT NULL,
  resultado text NOT NULL DEFAULT 'pendiente' CHECK (resultado IN ('apto','no_apto','pendiente')), nota text, checklist jsonb NOT NULL DEFAULT '{}',
  registrado_por int REFERENCES usuario, actualizado_en timestamptz NOT NULL DEFAULT now(), UNIQUE (tipo, entidad_id, etapa));

INSERT INTO pipeline (tipo, empresa_id, nombre) VALUES ('requisicion', NULL, 'Estándar del grupo'), ('seleccion', NULL, 'Estándar del grupo');
INSERT INTO etapa (pipeline_id, clave, nombre, orden, clase)
SELECT p.id, v.clave, v.nombre, v.orden, v.clase FROM pipeline p JOIN (VALUES
  ('requisicion','aprobado','Aprobado',1,'inicio'), ('requisicion','publicacion','Publicación',2,'normal'), ('requisicion','convocatoria','Convocatoria',3,'normal'),
  ('requisicion','seleccion','Selección',4,'normal'), ('requisicion','ingreso','Ingreso',5,'exito'), ('requisicion','cancelado','Cancelado',6,'cierre'),
  ('seleccion','seleccionado','Seleccionado',1,'inicio'), ('seleccion','entrevista_telefonica','Entrevista telefónica',2,'normal'), ('seleccion','entrevista_tecnica','Entrevista técnica',3,'normal'),
  ('seleccion','psicotecnico','Psicotécnico',4,'normal'), ('seleccion','servicio_medico','Servicio médico',5,'normal'), ('seleccion','propuesta_salarial','Propuesta salarial',6,'normal'),
  ('seleccion','ingreso','Ingreso',7,'exito'), ('seleccion','rechazado','Rechazado',8,'cierre')
) v(tipo, clave, nombre, orden, clase) ON v.tipo = p.tipo WHERE p.empresa_id IS NULL;
