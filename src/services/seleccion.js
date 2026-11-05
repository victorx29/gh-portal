const { q, tx } = require('../db'), P = require('./perm'), PL = require('./pipelines'), RS = require('./requisiciones'), { E } = require('../util');
const ghOnly = u => { if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana gestiona la selección'); };
const histC = (c, u, id, accion, detalle) => c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'candidatura', String(id), accion, detalle || {}]);
const evento = (c, tipo, p) => c.query('insert into evento_outbox(tipo,payload) values($1,$2)', [tipo, p]);
const CA = `select ca.*, c.nombre, c.email, c.telefono, c.cedula, r.empresa_id, r.codigo, r.plazas, r.estado req_estado, pf.nombre cargo
  from candidatura ca join candidato c on c.id=ca.candidato_id join requisicion r on r.id=ca.requisicion_id
  join perfil_version pv on pv.id=r.perfil_version_id join perfil pf on pf.id=pv.perfil_id`;

async function tablero(u, reqId) {
  ghOnly(u); const req = await RS.obtener(u, reqId), pl = await PL.resolver(req.empresa_id, 'seleccion');
  const cands = (await q('select ca.*, c.nombre, c.email from candidatura ca join candidato c on c.id=ca.candidato_id where ca.requisicion_id=$1 order by ca.id', [reqId])).rows;
  const ing = cands.filter(x => pl.exito && x.etapa === pl.exito.clave).length;
  return { req, pl, cands, ing };
}
async function crearCandidato(u, reqId, b) {
  ghOnly(u); const nombre = String(b.nombre || '').trim(); if (!nombre) throw E(400, 'El nombre es obligatorio');
  return tx(async c => {
    const r = await RS.lock(c, reqId); if (r.estado !== 'seleccion') throw E(400, 'La requisición no está en Selección');
    const pl = await PL.resolver(r.empresa_id, 'seleccion', c);
    const cd = (await c.query('insert into candidato(nombre,email,telefono,cedula) values($1,$2,$3,$4) returning id', [nombre, b.email || null, b.telefono || null, b.cedula || null])).rows[0];
    const ca = (await c.query('insert into candidatura(requisicion_id,candidato_id,etapa) values($1,$2,$3) returning id', [reqId, cd.id, pl.flujo[0].clave])).rows[0];
    await histC(c, u, ca.id, 'crear', { requisicion: reqId }); return ca.id;
  });
}
async function detalle(u, id) {
  ghOnly(u); const ca = (await q(CA + ' where ca.id=$1', [id])).rows[0]; if (!ca) throw E(404, 'Candidatura no encontrada');
  const pl = await PL.resolver(ca.empresa_id, 'seleccion'), i = pl.flujo.findIndex(e => e.clave === ca.etapa), et = pl.etapas.find(e => e.clave === ca.etapa);
  const activa = i >= 0 && et.clase !== 'exito', nxt = activa ? pl.flujo[i + 1] : null;
  const registro = activa ? (await q('select * from etapa_registro where tipo=$1 and entidad_id=$2 and etapa=$3', ['candidatura', id, et.clave])).rows[0] || null : null;
  const bloqueos = nxt ? await PL.problemas({ query: q }, 'candidatura', id, et) : [];
  return { ca, et, activa, siguiente: nxt, registro, bloqueos };
}
async function registrar(u, id, b) { const d = await detalle(u, id); if (!d.activa) throw E(400, 'Esta etapa no admite registro'); await PL.registrar(u, 'candidatura', id, d.et, b); }

async function avanzar(u, id) {
  ghOnly(u);
  return tx(async c => {
    const ca = (await c.query('select * from candidatura where id=$1 for update', [id])).rows[0]; if (!ca) throw E(404, 'No encontrada');
    const r = (await c.query('select r.*, pf.nombre cargo from requisicion r join perfil_version pv on pv.id=r.perfil_version_id join perfil pf on pf.id=pv.perfil_id where r.id=$1 for update of r', [ca.requisicion_id])).rows[0];
    const pl = await PL.resolver(r.empresa_id, 'seleccion', c), i = pl.flujo.findIndex(e => e.clave === ca.etapa), nxt = pl.flujo[i + 1];
    if (i < 0 || !nxt) throw E(400, 'No se puede avanzar desde esta etapa');
    const pr = await PL.problemas(c, 'candidatura', id, pl.flujo[i]); if (pr.length) throw E(400, pr.join('. '));
    await c.query('update candidatura set etapa=$2, actualizada_en=now() where id=$1', [id, nxt.clave]);
    await histC(c, u, id, 'avanzar', { de: ca.etapa, a: nxt.clave });
    const cd = (await c.query('select * from candidato where id=$1', [ca.candidato_id])).rows[0];
    await evento(c, 'candidatura.' + nxt.clave, { candidatura_id: id, requisicion_id: r.id, codigo: r.codigo, etapa: nxt.nombre, candidato: cd.nombre, email: cd.email });
    if (nxt.clase === 'exito') {   // ingreso: se crea la persona y su relación laboral pendiente de formalizar
      let t = cd.cedula ? (await c.query('select id from trabajador where cedula=$1', [cd.cedula])).rows[0] : null;
      if (!t) t = (await c.query('insert into trabajador(cedula,nombres,email,telefono) values($1,$2,$3,$4) returning id', [cd.cedula || null, cd.nombre, cd.email, cd.telefono])).rows[0];
      await c.query('insert into relacion_laboral(trabajador_id,empresa_id,unidad_id,cargo,requisicion_id) values($1,$2,$3,$4,$5)', [t.id, r.empresa_id, r.unidad_id, r.cargo, r.id]);
      const n = (await c.query('select count(*)::int n from candidatura where requisicion_id=$1 and etapa=$2', [r.id, nxt.clave])).rows[0].n;
      const rpl = await PL.resolver(r.empresa_id, 'requisicion', c);
      if (n >= r.plazas && r.estado !== rpl.exito.clave) await RS.cambiar(c, u, r, rpl.exito.clave, 'plazas_cubiertas');
    }
  });
}
async function rechazar(u, id, motivo) {
  ghOnly(u); if (!String(motivo || '').trim()) throw E(400, 'El motivo del rechazo es obligatorio');
  return tx(async c => {
    const ca = (await c.query('select * from candidatura where id=$1 for update', [id])).rows[0]; if (!ca) throw E(404, 'No encontrada');
    const r = (await c.query('select * from requisicion where id=$1', [ca.requisicion_id])).rows[0], pl = await PL.resolver(r.empresa_id, 'seleccion', c);
    const et = pl.flujo.find(e => e.clave === ca.etapa); if (!et || et.clase === 'exito') throw E(400, 'No se puede rechazar en esta etapa');
    await c.query('update candidatura set etapa=$2, motivo_rechazo=$3, actualizada_en=now() where id=$1', [id, pl.cierre.clave, motivo.trim()]);
    await histC(c, u, id, 'rechazar', { de: ca.etapa, motivo: motivo.trim() });
    const cd = (await c.query('select * from candidato where id=$1', [ca.candidato_id])).rows[0];
    await evento(c, 'candidatura.' + pl.cierre.clave, { candidatura_id: id, requisicion_id: r.id, codigo: r.codigo, candidato: cd.nombre, email: cd.email });
  });
}
module.exports = { tablero, crearCandidato, detalle, registrar, avanzar, rechazar };
