-- 0.9 · Postulados con análisis de CV por IA (la IA corre en n8n; analiza y resume, nunca decide).
-- Consentimiento del postulado para tratar sus datos (habeas data): sin él no se analiza su CV.
ALTER TABLE candidato
  ADD COLUMN consentimiento_en timestamptz,
  ADD COLUMN consentimiento_por int REFERENCES usuario,
  ADD COLUMN consentimiento_ref text;            -- cómo se obtuvo: «formulario de postulación», «correo del …»

-- Texto extraído del CV (Word y texto los lee el portal; el PDF lo extrae n8n y lo devuelve con el resultado)
ALTER TABLE cv_archivo ADD COLUMN texto text, ADD COLUMN candidato_id int REFERENCES candidato, ADD COLUMN tamano int;

-- Rúbrica: dimensiones y pesos configurables por GH. Cada dimensión toma su requisito del perfil del cargo.
CREATE TABLE ia_rubrica (clave text PRIMARY KEY, nombre text NOT NULL, campo text NOT NULL, peso int NOT NULL DEFAULT 0 CHECK (peso BETWEEN 0 AND 100),
  orden int NOT NULL DEFAULT 0, activo boolean NOT NULL DEFAULT true);
INSERT INTO ia_rubrica (clave, nombre, campo, peso, orden) VALUES
  ('educacion', 'Educación', 'educacion', 20, 1),
  ('experiencia', 'Experiencia', 'experiencia', 25, 2),
  ('conocimientos', 'Conocimientos técnicos', 'conocimientos', 25, 3),
  ('competencias', 'Competencias', 'competencias', 15, 4),
  ('idiomas', 'Idiomas y certificaciones', 'idiomas', 5, 5),
  ('criterios', 'Criterios de selección del perfil', 'criterios', 10, 6);

-- Cada análisis guarda la rúbrica con la que se hizo (foto) y el resultado; terminado no se modifica.
CREATE TABLE ia_analisis (id serial PRIMARY KEY, candidatura_id int NOT NULL REFERENCES candidatura, cv_archivo_id int NOT NULL REFERENCES cv_archivo,
  perfil_version_id int NOT NULL REFERENCES perfil_version, rubrica jsonb NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'listo', 'error')),
  token text NOT NULL, resultado jsonb, puntaje numeric(5,1), modelo text, error text,
  solicitado_por int REFERENCES usuario, solicitado_en timestamptz NOT NULL DEFAULT now(), recibido_en timestamptz);
CREATE INDEX ix_ia_analisis_candidatura ON ia_analisis (candidatura_id, id DESC);
CREATE FUNCTION ia_analisis_cerrado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.estado IN ('listo', 'error') THEN RAISE EXCEPTION 'El análisis % ya terminó y no se modifica', OLD.id; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_ia_analisis_cerrado BEFORE UPDATE ON ia_analisis FOR EACH ROW EXECUTE FUNCTION ia_analisis_cerrado();
CREATE TRIGGER trg_ia_analisis_no_borrar BEFORE DELETE ON ia_analisis FOR EACH ROW EXECUTE FUNCTION bloquear_mod();
