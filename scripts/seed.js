// Uso: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run seed
// Con SEED_DEMO=true crea además perfiles y usuarios de prueba (gerente, director, presidencia).
const bcrypt = require('bcryptjs'), { pool, tx } = require('../src/db');
const EMPRESAS = ['Changan Venezuela', 'Fotón Venezuela'], AREAS = ['Ventas', 'Postventa', 'Administración', 'Logística', 'TI'];
(async () => {
  const email = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase(), pass = process.env.SEED_ADMIN_PASSWORD || '';
  if (!email || pass.length < 10) throw new Error('Define SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (mínimo 10 caracteres)');
  await tx(async c => {
    const ids = {};
    for (const n of EMPRESAS) {
      ids[n] = (await c.query('insert into empresa(nombre) values($1) on conflict(nombre) do update set nombre=excluded.nombre returning id', [n])).rows[0].id;
      for (const a of AREAS) await c.query('insert into area(empresa_id,nombre) values($1,$2) on conflict do nothing', [ids[n], a]);
    }
    const mk = async (nombre, mail, pw) => (await c.query('insert into usuario(nombre,email,pass_hash) values($1,$2,$3) on conflict(email) do update set nombre=excluded.nombre returning id', [nombre, mail, await bcrypt.hash(pw, 10)])).rows[0].id;
    const rol = (u, r, e) => c.query('insert into usuario_rol(usuario_id,rol,empresa_id) values($1,$2,$3) on conflict do nothing', [u, r, e]);
    const admin = await mk('Administrador GH', email, pass); await rol(admin, 'gh', null);
    if (process.env.SEED_DEMO === 'true') {
      const ch = ids['Changan Venezuela'], pw = process.env.SEED_DEMO_PASSWORD || pass;
      await rol(await mk('Gerente Demo', 'gerente@demo.local', pw), 'gerente', ch);
      await rol(await mk('Director Demo', 'director@demo.local', pw), 'director', ch);
      await rol(await mk('Presidencia Demo', 'presidencia@demo.local', pw), 'presidencia', null);
      const p = (await c.query("insert into perfil(codigo,nombre) values('ANA-DAT','Analista de Datos') on conflict(codigo) do update set nombre=excluded.nombre returning id")).rows[0].id;
      await c.query("insert into perfil_version(perfil_id,version,contenido,creado_por) values($1,1,$2,$3) on conflict do nothing", [p, { objetivo: 'Analizar datos del negocio', requisitos: 'Universitario; 2 años de experiencia', criterios: ['SQL', 'Excel avanzado', 'Reportes'] }, admin]);
    }
  });
  console.log('Seed completado'); await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
