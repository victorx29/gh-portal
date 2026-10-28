CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Organización: grupo multiempresa; una dirección puede atender varias empresas
CREATE TABLE empresa (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, activa boolean NOT NULL DEFAULT true);
CREATE TABLE direccion (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE);
CREATE TABLE direccion_empresa (direccion_id int REFERENCES direccion, empresa_id int REFERENCES empresa, PRIMARY KEY (direccion_id, empresa_id));
CREATE TABLE area (id serial PRIMARY KEY, empresa_id int NOT NULL REFERENCES empresa, direccion_id int REFERENCES direccion, nombre text NOT NULL, UNIQUE (empresa_id, nombre));

-- Acceso: roles con alcance por empresa (empresa_id NULL = todas). GH siempre es global.
CREATE TABLE usuario (id serial PRIMARY KEY, email text NOT NULL UNIQUE, nombre text NOT NULL, pass_hash text NOT NULL, activo boolean NOT NULL DEFAULT true, creado_en timestamptz NOT NULL DEFAULT now());
CREATE TYPE rol_t AS ENUM ('gerente','director','presidencia','gh');
CREATE TABLE usuario_rol (id serial PRIMARY KEY, usuario_id int NOT NULL REFERENCES usuario ON DELETE CASCADE, rol rol_t NOT NULL, empresa_id int REFERENCES empresa);
CREATE UNIQUE INDEX ux_usuario_rol ON usuario_rol (usuario_id, rol, COALESCE(empresa_id, 0));
CREATE TABLE "session" ("sid" varchar NOT NULL PRIMARY KEY, "sess" json NOT NULL, "expire" timestamp(6) NOT NULL);
CREATE INDEX "IDX_session_expire" ON "session" ("expire");

-- Perfiles versionados (inmutables): la requisición apunta a una versión
CREATE TABLE perfil (id serial PRIMARY KEY, codigo text NOT NULL UNIQUE, nombre text NOT NULL, empresa_id int REFERENCES empresa, activo boolean NOT NULL DEFAULT true);
CREATE TABLE perfil_version (id serial PRIMARY KEY, perfil_id int NOT NULL REFERENCES perfil, version int NOT NULL, contenido jsonb NOT NULL, creado_por int NOT NULL REFERENCES usuario, creado_en timestamptz NOT NULL DEFAULT now(), UNIQUE (perfil_id, version));
CREATE FUNCTION bloquear_mod() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '% es solo-inserción', TG_TABLE_NAME; END $$;
CREATE TRIGGER trg_pv_nomod BEFORE UPDATE OR DELETE ON perfil_version FOR EACH ROW EXECUTE FUNCTION bloquear_mod();

-- Requisiciones: Gerente solicita → Director aprueba → Presidencia (solo cargo nuevo); GH no aprueba
CREATE TYPE req_estado_t AS ENUM ('borrador','pend_director','pend_presidencia','rechazada','aprobado','publicacion','convocatoria','seleccion','ingreso','cancelado');
CREATE SEQUENCE req_seq;
CREATE TABLE requisicion (
  id serial PRIMARY KEY, codigo text NOT NULL UNIQUE,
  empresa_id int NOT NULL REFERENCES empresa, area_id int REFERENCES area,
  perfil_version_id int NOT NULL REFERENCES perfil_version,
  tipo text NOT NULL CHECK (tipo IN ('reemplazo','nuevo')),
  contratacion text NOT NULL DEFAULT 'Permanente', plazas int NOT NULL DEFAULT 1 CHECK (plazas > 0),
  justificacion text, fecha_requerida date,
  solicitante_id int NOT NULL REFERENCES usuario,
  estado req_estado_t NOT NULL DEFAULT 'borrador', motivo_cierre text,
  creada_en timestamptz NOT NULL DEFAULT now(), actualizada_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE aprobacion (id serial PRIMARY KEY, requisicion_id int NOT NULL REFERENCES requisicion, paso text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('aprobada','devuelta','rechazada','automatica')),
  decidido_por int NOT NULL REFERENCES usuario, comentario text, fecha timestamptz NOT NULL DEFAULT now());

-- Selección (se implementa en la siguiente entrega; el esquema ya queda definido)
CREATE TYPE etapa_t AS ENUM ('seleccionado','entrevista_telefonica','entrevista_tecnica','psicotecnico','servicio_medico','propuesta_salarial','ingreso','rechazado');
CREATE TABLE candidato (id serial PRIMARY KEY, nombre text NOT NULL, email text, telefono text, cedula text);
CREATE TABLE cv_archivo (id serial PRIMARY KEY, requisicion_id int NOT NULL REFERENCES requisicion, nombre_original text NOT NULL, ruta text NOT NULL, mime text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','procesando','listo','error')),
  score numeric(5,2), resultado jsonb, subido_por int REFERENCES usuario, subido_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE candidatura (id serial PRIMARY KEY, requisicion_id int NOT NULL REFERENCES requisicion, candidato_id int NOT NULL REFERENCES candidato,
  cv_archivo_id int REFERENCES cv_archivo, etapa etapa_t NOT NULL DEFAULT 'seleccionado', motivo_rechazo text,
  actualizada_en timestamptz NOT NULL DEFAULT now(), UNIQUE (requisicion_id, candidato_id));

-- Ingreso: persona y relación laboral (la ficha completa se amplía en la fase de expediente)
CREATE TABLE trabajador (id serial PRIMARY KEY, cedula text UNIQUE, nombres text NOT NULL, apellidos text, email text, telefono text, fecha_nacimiento date, creado_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE relacion_laboral (id serial PRIMARY KEY, trabajador_id int NOT NULL REFERENCES trabajador, empresa_id int NOT NULL REFERENCES empresa, area_id int REFERENCES area,
  cargo text NOT NULL, requisicion_id int REFERENCES requisicion, fecha_ingreso date, fecha_egreso date, estado text NOT NULL DEFAULT 'por_ingresar');

-- Eventos para n8n (outbox): el estado se confirma en BD; el aviso se reintenta sin duplicar
CREATE TABLE evento_outbox (id bigserial PRIMARY KEY, tipo text NOT NULL, payload jsonb NOT NULL, creado_en timestamptz NOT NULL DEFAULT now(), enviado_en timestamptz, intentos int NOT NULL DEFAULT 0, ultimo_error text);
CREATE INDEX ix_outbox_pend ON evento_outbox (id) WHERE enviado_en IS NULL;

-- Historial inmutable con hash encadenado
CREATE TABLE historial (id bigserial PRIMARY KEY, fecha timestamptz NOT NULL DEFAULT now(), usuario_id int, entidad text NOT NULL, entidad_id text NOT NULL, accion text NOT NULL, detalle jsonb, hash_prev text, hash text NOT NULL);
CREATE FUNCTION historial_hash() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prev text;
BEGIN
  LOCK TABLE historial IN SHARE ROW EXCLUSIVE MODE;
  SELECT hash INTO prev FROM historial ORDER BY id DESC LIMIT 1;
  NEW.hash_prev := prev;
  NEW.hash := encode(digest(coalesce(prev,'') || NEW.fecha::text || coalesce(NEW.usuario_id::text,'') || NEW.entidad || NEW.entidad_id || NEW.accion || coalesce(NEW.detalle::text,''), 'sha256'), 'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_historial_hash BEFORE INSERT ON historial FOR EACH ROW EXECUTE FUNCTION historial_hash();
CREATE TRIGGER trg_historial_nomod BEFORE UPDATE OR DELETE ON historial FOR EACH ROW EXECUTE FUNCTION bloquear_mod();
