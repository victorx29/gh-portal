const { q, tx } = require('../db'), P = require('./perm'), { E } = require('../util');
const ORDEN = ['aprobado', 'publicacion', 'convocatoria', 'seleccion'];
const SEL = `select r.*, e.nombre empresa, a.nombre area, pf.nombre cargo, pv.version perfil_v, pv.contenido perfil, s.nombre solicitante
  from requisicion r join empresa e on e.id=r.empresa_id left join area a on a.id=r.area_id
  join perfil_version pv on pv.id=r.perfil_version_id join perfil pf on pf.id=pv.perfil_id join usuario s on s.id=r.solicitante_id`;

const hist = (c, u, id, accion, detalle) => c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u && u.id, 'requisicion', String(id), accion, detalle || {}]);
async function lock(c, id) {
  const r = (await c.query('select * from requisicion where id=$1 for update', [id])).rows[0];
  if (!r) throw E(404, 'Requisición no encontrada');
  return r;
}
async function cambiar(c, u, r, est, accion) {
  await c.query('update requisicion set estado=$2, actualizada_en=now() where id=$1', [r.id, est]);
  await hist(c, u, r.id, accion, { de: r.estado, a: est });
  await c.query('insert into evento_outbox(tipo,payload) values($1,$2)', ['requisicion.' + est,
    { requisicion_id: r.id, codigo: r.codigo, estado: est, empresa_id: r.empresa_id, solicitante_id: r.solicitante_id }]);
}
const pasoDe = r => ({ pend_director: 'director', pend_presidencia: 'presidencia' })[r.estado];
const puedeDecidir = (u, r) => { const p = pasoDe(r); return !!p && P.tiene(u, p, r.empresa_id) && r.solicitante_id != u.id; };

async function listar(u, empresaId) {
  const w = [], p = [];
  if (!P.esGH(u)) {
    const e = P.empresasDe(u, ['director', 'presidencia']);
    p.push(u.id); let c = `r.solicitante_id=$${p.length}`;
    if (e === null) c = 'true'; else if (e.length) { p.push(e); c += ` or r.empresa_id=any($${p.length})`; }
    w.push(`(${c})`);
  }
  if (empresaId) { p.push(+empresaId); w.push(`r.empresa_id=$${p.length}`); }
  const rows = (await q(SEL + (w.length ? ' where ' + w.join(' and ') : '') + ' order by r.id desc', p)).rows;
  rows.forEach(r => { r.pendiente = puedeDecidir(u, r); });
  return rows;
}
async function obtener(u, id) {
  const r = (await q(SEL + ' where r.id=$1', [id])).rows[0];
  if (!r || !P.puedeVer(u, r)) throw E(404, 'Requisición no encontrada');
  r.log = (await q('select ap.*, us.nombre from aprobacion ap join usuario us on us.id=ap.decidido_por where ap.requisicion_id=$1 order by ap.id', [id])).rows;
  return r;
}
function acciones(u, r) {
  const gh = P.esGH(u), i = ORDEN.indexOf(r.estado);
  return { enviar: r.estado === 'borrador' && r.solicitante_id == u.id, editar: r.estado === 'borrador' && r.solicitante_id == u.id,
    decidir: puedeDecidir(u, r), mover: gh && i >= 0 && i < ORDEN.length - 1, siguiente: ORDEN[i + 1], cancelar: gh && i >= 0 };
}
async function validarArea(areaId, emp) {
  if (areaId && !(await q('select 1 from area where id=$1 and empresa_id=$2', [areaId, emp])).rowCount) throw E(400, 'El área no pertenece a la empresa');
}
const campos = b => [b.tipo === 'nuevo' ? 'nuevo' : 'reemplazo', b.contratacion === 'Temporal' ? 'Temporal' : 'Permanente', Math.max(1, parseInt(b.plazas) || 1), (b.justificacion || '').trim() || null, b.fecha_requerida || null, b.area_id || null];

async function crear(u, b) {
  const emp = +b.empresa_id;
  if (!(P.tiene(u, 'gerente', emp) || P.tiene(u, 'director', emp))) throw E(403, 'No puedes solicitar para esa empresa');
  const pv = (await q('select id from perfil_version where perfil_id=$1 order by version desc limit 1', [+b.perfil_id])).rows[0];
  if (!pv) throw E(400, 'Perfil inválido');
  await validarArea(b.area_id, emp);
  const [tipo, contr, plazas, just, fecha, area] = campos(b);
  return tx(async c => {
    const r = (await c.query(`insert into requisicion(codigo,empresa_id,area_id,perfil_version_id,tipo,contratacion,plazas,justificacion,fecha_requerida,solicitante_id)
      values('REQ-'||lpad(nextval('req_seq')::text,5,'0'),$1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [emp, area, pv.id, tipo, contr, plazas, just, fecha, u.id])).rows[0];
    await hist(c, u, r.id, 'crear'); return r.id;
  });
}
async function actualizar(u, id, b) {
  return tx(async c => {
    const r = await lock(c, id);
    if (r.estado !== 'borrador' || r.solicitante_id != u.id) throw E(403, 'Solo el solicitante edita un borrador');
    await validarArea(b.area_id, r.empresa_id);
    const [tipo, contr, plazas, just, fecha, area] = campos(b);
    await c.query('update requisicion set tipo=$2,contratacion=$3,plazas=$4,justificacion=$5,fecha_requerida=$6,area_id=$7,actualizada_en=now() where id=$1', [id, tipo, contr, plazas, just, fecha, area]);
    await hist(c, u, id, 'editar');
  });
}
async function enviar(u, id) {
  return tx(async c => {
    const r = await lock(c, id);
    if (r.solicitante_id != u.id || r.estado !== 'borrador') throw E(400, 'No se puede enviar esta requisición');
    let est = 'pend_director';
    if (P.tiene(u, 'director', r.empresa_id)) {   // el Director que solicita se aprueba automáticamente
      await c.query('insert into aprobacion(requisicion_id,paso,decision,decidido_por,comentario) values($1,$2,$3,$4,$5)', [id, 'director', 'automatica', u.id, 'El solicitante es Director']);
      est = r.tipo === 'nuevo' ? 'pend_presidencia' : 'aprobado';
    }
    await cambiar(c, u, r, est, 'enviar');
  });
}
async function decidir(u, id, d, com) {
  if (!['aprobada', 'devuelta', 'rechazada'].includes(d)) throw E(400, 'Decisión inválida');
  if (d !== 'aprobada' && !String(com || '').trim()) throw E(400, 'El comentario es obligatorio al devolver o rechazar');
  return tx(async c => {
    const r = await lock(c, id), paso = pasoDe(r);
    if (!paso) throw E(400, 'La requisición no espera aprobación');
    if (!puedeDecidir(u, r)) throw E(403, 'No puedes decidir esta requisición');
    await c.query('insert into aprobacion(requisicion_id,paso,decision,decidido_por,comentario) values($1,$2,$3,$4,$5)', [id, paso, d, u.id, (com || '').trim() || null]);
    const est = d === 'devuelta' ? 'borrador' : d === 'rechazada' ? 'rechazada' : (paso === 'director' && r.tipo === 'nuevo' ? 'pend_presidencia' : 'aprobado');
    await cambiar(c, u, r, est, paso + '.' + d);
  });
}
async function mover(u, id) {
  if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana mueve la requisición');
  return tx(async c => {
    const r = await lock(c, id), i = ORDEN.indexOf(r.estado);
    if (i < 0 || i >= ORDEN.length - 1) throw E(400, 'No se puede avanzar desde este estado');
    await cambiar(c, u, r, ORDEN[i + 1], 'mover');
  });
}
async function cancelar(u, id, motivo) {
  if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana cancela');
  if (!String(motivo || '').trim()) throw E(400, 'El motivo es obligatorio');
  return tx(async c => {
    const r = await lock(c, id);
    if (ORDEN.indexOf(r.estado) < 0) throw E(400, 'No se puede cancelar en este estado');
    await c.query('update requisicion set motivo_cierre=$2 where id=$1', [id, motivo.trim()]);
    await cambiar(c, u, r, 'cancelado', 'cancelar');
  });
}
module.exports = { listar, obtener, acciones, crear, actualizar, enviar, decidir, mover, cancelar };
