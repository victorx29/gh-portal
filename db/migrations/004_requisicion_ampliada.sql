-- Maestros configurables (los administra el superadmin)
CREATE TABLE grado_instruccion (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, activo boolean NOT NULL DEFAULT true, orden int NOT NULL DEFAULT 0);
CREATE TABLE catalogo_equipo (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, requiere_linea boolean NOT NULL DEFAULT false, activo boolean NOT NULL DEFAULT true);
CREATE TABLE catalogo_acceso (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, activo boolean NOT NULL DEFAULT true);
INSERT INTO grado_instruccion (nombre, orden) VALUES ('Bachiller',1), ('Técnico medio',2), ('T.S.U.',3), ('Universitario',4), ('Postgrado',5);
INSERT INTO catalogo_equipo (nombre, requiere_linea) VALUES ('Laptop',false), ('PC de escritorio',false), ('Teléfono',true), ('Bolso / morral',false), ('Mouse',false), ('Teclado',false), ('Audífonos',false);

ALTER TABLE requisicion
  ADD COLUMN sustituye_a text, ADD COLUMN profesion text, ADD COLUMN grado_id int REFERENCES grado_instruccion, ADD COLUMN experiencia text,
  ADD COLUMN vigencia_desde date, ADD COLUMN vigencia_hasta date, ADD COLUMN correo_corporativo boolean NOT NULL DEFAULT false, ADD COLUMN equipos_otros text;
CREATE TABLE requisicion_equipo (requisicion_id int NOT NULL REFERENCES requisicion, equipo_id int NOT NULL REFERENCES catalogo_equipo, requiere_linea boolean NOT NULL DEFAULT false, PRIMARY KEY (requisicion_id, equipo_id));
CREATE TABLE requisicion_acceso (requisicion_id int NOT NULL REFERENCES requisicion, acceso_id int NOT NULL REFERENCES catalogo_acceso, nivel text, PRIMARY KEY (requisicion_id, acceso_id));

-- Comentarios: solo-inserción (traza). ambito 'gh' = nota interna visible solo para GH
CREATE TABLE comentario (id bigserial PRIMARY KEY, entidad text NOT NULL CHECK (entidad IN ('requisicion','candidatura')), entidad_id int NOT NULL,
  ambito text NOT NULL DEFAULT 'proceso' CHECK (ambito IN ('proceso','gh')), autor_id int NOT NULL REFERENCES usuario, texto text NOT NULL, creado_en timestamptz NOT NULL DEFAULT now());
CREATE INDEX ix_comentario ON comentario (entidad, entidad_id);
CREATE TRIGGER trg_comentario_nomod BEFORE UPDATE OR DELETE ON comentario FOR EACH ROW EXECUTE FUNCTION bloquear_mod();
-- Adjuntos: archivos en el volumen (UPLOADS_DIR); aquí solo metadatos
CREATE TABLE adjunto (id bigserial PRIMARY KEY, entidad text NOT NULL CHECK (entidad IN ('requisicion','candidatura')), entidad_id int NOT NULL, nombre_original text NOT NULL,
  ruta text NOT NULL, mime text, tamano int, subido_por int NOT NULL REFERENCES usuario, subido_en timestamptz NOT NULL DEFAULT now());
CREATE INDEX ix_adjunto ON adjunto (entidad, entidad_id);
