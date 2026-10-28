
const fs = require('fs'), path = require('path'), { pool } = require('./db');
(async () => {
  const dir = path.join(__dirname, '..', 'db', 'migrations'), c = await pool.connect();
  try {
    await c.query('select pg_advisory_lock(42)');
    await c.query('create table if not exists schema_migrations(name text primary key, aplicada_en timestamptz default now())');
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
      if ((await c.query('select 1 from schema_migrations where name=$1', [f])).rowCount) continue;
      await c.query('begin');
      try { await c.query(fs.readFileSync(path.join(dir, f), 'utf8')); await c.query('insert into schema_migrations(name) values($1)', [f]); await c.query('commit'); console.log('migrada', f); }
      catch (e) { await c.query('rollback'); throw e; }
    }
    await c.query('select pg_advisory_unlock(42)');
  } finally { c.release(); await pool.end(); }
})().catch(e => { console.error(e); process.exit(1); });
