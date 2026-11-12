-- 0.7.8 · Niveles jerárquicos: GH los ordena de arriba abajo y cada perfil elige el suyo.
-- Solo deciden EN QUÉ FILA se dibuja cada cargo en el organigrama; quién reporta a quién sigue saliendo de la plantilla.
CREATE TABLE nivel_jerarquico (id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, orden int NOT NULL, activo boolean NOT NULL DEFAULT true);
INSERT INTO nivel_jerarquico (nombre, orden) VALUES ('Presidencia', 10), ('Dirección', 20), ('Gerencia', 30), ('Jefatura', 40), ('Coordinación', 50),
  ('Especialista', 60), ('Analista', 70), ('Asistente / Auxiliar', 80), ('Operativo', 90);
ALTER TABLE perfil ADD COLUMN nivel_jerarquico_id int REFERENCES nivel_jerarquico;
