-- 0.7.1 · Control documental (ISO) de cada versión de perfil: registro simple, sin flujo de aprobación.
-- La versión del perfil sigue siendo inmutable; el control vive aparte y cada cambio queda en el historial.
CREATE TABLE perfil_version_control (
  version_id int PRIMARY KEY REFERENCES perfil_version,
  fecha_actualizacion date,            -- fecha del documento (por ejemplo, la del Word importado)
  revisado_por text, fecha_revision date, aprobado_por text, fecha_aprobacion date,
  origen text,                         -- 'manual' o el nombre del archivo importado
  registrado_por int REFERENCES usuario, registrado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_aprobacion IS NULL OR fecha_revision IS NULL OR fecha_aprobacion >= fecha_revision));
