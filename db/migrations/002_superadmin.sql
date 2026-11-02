-- Debe ir sola: un valor nuevo de enum no se puede usar en la misma transacción.
ALTER TYPE rol_t ADD VALUE IF NOT EXISTS 'superadmin';
