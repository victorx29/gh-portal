// Uso: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run seed
// Con SEED_DEMO=true crea además una estructura mínima, un perfil y usuarios de prueba (gerente, director, presidencia).
const bcrypt = require('bcryptjs'), { pool, tx } = require('../src/db');
const EMPRESAS = [['Changan Venezuela', 'Multinacional de Vehículos, C.A.', 'MDV'], ['Fotón Venezuela', 'Comercializadora Intermundial 2020, C.A.', 'CIM']];
(async () => {
  const email = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase(), pass = process.env.SEED_ADMIN_PASSWORD || '';
  if (!email || pass.length < 10) throw new Error('Define SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (mínimo 10 caracteres)');
  await tx(async c => {
    const grupo = (await c.query("insert into grupo(nombre,siglas) values('Grupo APB','APB') on conflict(nombre) do update set nombre=excluded.nombre returning id")).rows[0].id;
    const ids = {};
    for (const [n, rs, sg] of EMPRESAS) {
      ids[sg] = (await c.query(`insert into empresa(nombre,razon_social,siglas,grupo_id) values($1,$2,$3,$4)
        on conflict(nombre) do update set razon_social=coalesce(empresa.razon_social,excluded.razon_social), siglas=coalesce(empresa.siglas,excluded.siglas) returning id`, [n, rs, sg, grupo])).rows[0].id;
    }
    const mk = async (nombre, mail, pw) => (await c.query('insert into usuario(nombre,email,pass_hash) values($1,$2,$3) on conflict(email) do update set nombre=excluded.nombre returning id', [nombre, mail, await bcrypt.hash(pw, 10)])).rows[0].id;
    const rol = (u, r, e, un) => c.query('insert into usuario_rol(usuario_id,rol,empresa_id,unidad_id) values($1,$2,$3,$4) on conflict do nothing', [u, r, e || null, un || null]);
    const admin = await mk('Administrador GH', email, pass); await rol(admin, 'gh'); await rol(admin, 'superadmin');
    if (process.env.SEED_DEMO === 'true') {
      const tipo = async n => (await c.query('select id from tipo_unidad where nombre=$1', [n])).rows[0].id;
      const unidad = async (cod, nombre, t, aprueba, padre) => {
        let u = (await c.query('select id from unidad where codigo=$1', [cod])).rows[0];
        if (!u) u = (await c.query('insert into unidad(codigo,nombre,tipo_id,grupo_id,aprueba) values($1,$2,$3,$4,$5) returning id', [cod, nombre, await tipo(t), grupo, aprueba])).rows[0];
        if (padre && !(await c.query("select 1 from unidad_relacion where unidad_id=$1 and tipo='solida' and hasta is null", [u.id])).rowCount)
          await c.query("insert into unidad_relacion(unidad_id,padre_id,tipo,motivo) values($1,$2,'solida','Datos de prueba')", [u.id, padre]);
        for (const e of Object.values(ids)) await c.query('insert into unidad_empresa(unidad_id,empresa_id) values($1,$2) on conflict do nothing', [u.id, e]);
        return u.id;
      };
      const pres = await unidad('DEMO-PRES', 'Presidencia', 'Presidencia', false), dtec = await unidad('DEMO-DTEC', 'Dirección de Tecnología', 'Dirección', true, pres);
      const gtec = await unidad('DEMO-GTEC', 'Gerencia de Tecnología', 'Gerencia', false, dtec);
      const pw = process.env.SEED_DEMO_PASSWORD || pass;
      await rol(await mk('Gerente Demo', 'gerente@demo.local', pw), 'gerente', null, gtec);
      await rol(await mk('Director Demo', 'director@demo.local', pw), 'director', null, dtec);
      await rol(await mk('Presidencia Demo', 'presidencia@demo.local', pw), 'presidencia');
      const p = (await c.query("insert into perfil(codigo,nombre) values('ANA-DAT','Analista de Datos') on conflict(codigo) do update set nombre=excluded.nombre returning id")).rows[0].id;
      await c.query("insert into perfil_version(perfil_id,version,contenido,creado_por) values($1,1,$2,$3) on conflict do nothing", [p, { objetivo: 'Analizar datos del negocio', requisitos: 'Universitario; 2 años de experiencia', criterios: ['SQL', 'Excel avanzado', 'Reportes'] }, admin]);
    }
  });
  console.log('Seed completado'); await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
