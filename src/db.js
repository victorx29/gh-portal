const { Pool, types } = require('pg'), cfg = require('./config');
types.setTypeParser(1082, v => v);   // columnas date como 'YYYY-MM-DD' (sin desfase de zona horaria)
const pool = new Pool({ connectionString: cfg.db, max: 10 });
const q = (t, p) => pool.query(t, p);
async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('begin'); const r = await fn(c); await c.query('commit'); return r; }
  catch (e) { await c.query('rollback'); throw e; }
  finally { c.release(); }
}
module.exports = { pool, q, tx };
