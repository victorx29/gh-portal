-- 0.7.11 · Dependencia funcional (línea punteada) entre puestos. Solo documenta el organigrama:
-- no cambia a quién reporta el puesto (línea sólida) ni quién aprueba sus requisiciones.
CREATE TABLE puesto_relacion (
  id serial PRIMARY KEY, puesto_id int NOT NULL REFERENCES puesto, funcional_de int NOT NULL REFERENCES puesto,
  desde date NOT NULL DEFAULT current_date, hasta date, motivo text, creado_por int REFERENCES usuario, creado_en timestamptz NOT NULL DEFAULT now(),
  cerrado_por int REFERENCES usuario, motivo_cierre text,
  CHECK (puesto_id <> funcional_de), CHECK (hasta IS NULL OR hasta >= desde));
CREATE UNIQUE INDEX ux_puesto_relacion_vigente ON puesto_relacion (puesto_id, funcional_de) WHERE hasta IS NULL;
-- No se borran; una relación cerrada no se modifica
CREATE TRIGGER trg_puesto_relacion_no_borrar BEFORE DELETE ON puesto_relacion FOR EACH ROW EXECUTE FUNCTION no_borrar_plantilla();
CREATE FUNCTION puesto_relacion_cerrada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.hasta IS NOT NULL THEN RAISE EXCEPTION 'La dependencia funcional ya está cerrada y no se puede modificar'; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_puesto_relacion_cerrada BEFORE UPDATE ON puesto_relacion FOR EACH ROW EXECUTE FUNCTION puesto_relacion_cerrada();
