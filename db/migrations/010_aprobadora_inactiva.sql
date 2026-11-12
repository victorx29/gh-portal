-- 0.7.7 · La aprobación se detiene en la primera unidad marcada «aprueba», ESTÉ ACTIVA O NO.
-- Antes saltaba las inactivas y subía sola a la siguiente (reasignación silenciosa). Ahora, si la unidad aprobadora
-- está inactiva, la requisición queda retenida «sin aprobador» hasta que GH lo resuelva.
CREATE OR REPLACE FUNCTION unidad_aprobadora(p_unidad int) RETURNS int LANGUAGE sql STABLE AS $$
  WITH RECURSIVE up(id, prof) AS (SELECT p_unidad, 0
    UNION ALL SELECT r.padre_id, up.prof + 1 FROM unidad_relacion r JOIN up ON r.unidad_id = up.id WHERE r.tipo = 'solida' AND r.hasta IS NULL AND up.prof < 50)
  SELECT up.id FROM up JOIN unidad u ON u.id = up.id WHERE u.aprueba ORDER BY up.prof LIMIT 1 $$;
