-- 0.9.5 · IA configurable desde el portal: criterios de la rúbrica con descripción, prompts editables por Gestión Humana
-- (con versiones) y resumen general de la selección con terna orientativa.

-- Criterios: GH agrega los suyos. «campo» = campo del perfil del que toma el requisito; vacío = el requisito es la descripción.
-- «descripcion» = qué busca GH en ese criterio (contexto para la IA). Un criterio no se borra: se desactiva.
ALTER TABLE ia_rubrica ALTER COLUMN campo DROP NOT NULL,
  ADD COLUMN descripcion text NOT NULL DEFAULT '',
  ADD COLUMN creado_en timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER trg_ia_rubrica_no_borrar BEFORE DELETE ON ia_rubrica FOR EACH ROW EXECUTE FUNCTION bloquear_mod();

-- Instrucciones de Gestión Humana para la IA (la parte editable del prompt). Cada cambio es una versión nueva; la activa es la
-- última. Las reglas firmes y el formato de la respuesta los pone el portal y no se editan. Las versiones no se modifican.
CREATE TABLE ia_prompt (id serial PRIMARY KEY, tipo text NOT NULL CHECK (tipo IN ('analisis', 'resumen')), version int NOT NULL,
  instrucciones text NOT NULL, motivo text NOT NULL, creado_por int REFERENCES usuario, creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, version));
CREATE TRIGGER trg_ia_prompt_nomod BEFORE UPDATE OR DELETE ON ia_prompt FOR EACH ROW EXECUTE FUNCTION bloquear_mod();
INSERT INTO ia_prompt (tipo, version, motivo, instrucciones) VALUES
('analisis', 1, 'Original del portal (0.9.5)', $t$## Rol
Eres un analista de selección de personal que apoya a Gestión Humana. Comparas un CV con el perfil de un cargo, criterio por criterio.

## Cómo evaluar
- Usa la descripción de cada criterio («qué buscamos») para entender qué valora Gestión Humana.
- Da a cada criterio un puntaje de 0 a 5 con la evidencia del CV que lo justifica (una cita o un resumen breve).
- Valora la experiencia demostrable (cargos, funciones, logros, tiempo) por encima de las palabras clave sueltas.
- Si no hay evidencia de un requisito, el puntaje es 0 o 1 y lo dices.

## Cómo redactar
- Resumen de 3 a 5 frases, claro y sin adjetivos exagerados.
- Fortalezas y brechas concretas, ligadas a los requisitos del perfil.
- Preguntas para la entrevista que verifiquen una brecha o una afirmación del CV.$t$),
('resumen', 1, 'Original del portal (0.9.5)', $t$## Rol
Eres un analista de selección de personal que apoya a Gestión Humana. Recibes los análisis ya hechos de los candidatos de una
requisición y los comparas entre sí frente al perfil del cargo.

## Cómo comparar
- Compara con los puntajes por criterio y su evidencia; no repitas el análisis de cada CV.
- Señala en qué se diferencian los candidatos y qué conviene verificar en las entrevistas.
- La terna son los candidatos mejor alineados con el perfil según los análisis, con el porqué de cada uno.
- Si los datos no alcanzan para comparar (pocos candidatos o puntajes muy parecidos), dilo.

## Cómo redactar
- Resumen comparativo de 4 a 8 frases, claro y sin adjetivos exagerados.
- Nombra a los candidatos solo por su número (por ejemplo REQ-00001-C03).$t$);

-- Cada análisis guarda con qué versión de las instrucciones se hizo (la rúbrica ya se guardaba como foto)
ALTER TABLE ia_analisis ADD COLUMN prompt_id int REFERENCES ia_prompt;

-- Resumen general de la selección (comparativo + terna orientativa). La IA no decide: decide Gestión Humana.
-- «incluidos» es la foto de los candidatos y análisis que se compararon. Terminado no se modifica; nada se borra.
CREATE TABLE ia_resumen (id serial PRIMARY KEY, requisicion_id int NOT NULL REFERENCES requisicion, prompt_id int NOT NULL REFERENCES ia_prompt,
  incluidos jsonb NOT NULL, estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'listo', 'error')),
  token text NOT NULL, resultado jsonb, modelo text, error text,
  solicitado_por int REFERENCES usuario, solicitado_en timestamptz NOT NULL DEFAULT now(), recibido_en timestamptz);
CREATE INDEX ix_ia_resumen_requisicion ON ia_resumen (requisicion_id, id DESC);
CREATE TRIGGER trg_ia_resumen_cerrado BEFORE UPDATE ON ia_resumen FOR EACH ROW EXECUTE FUNCTION ia_analisis_cerrado();
CREATE TRIGGER trg_ia_resumen_no_borrar BEFORE DELETE ON ia_resumen FOR EACH ROW EXECUTE FUNCTION bloquear_mod();
