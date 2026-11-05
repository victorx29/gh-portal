const { q, tx } = require('../db'), P = require('./perm'), PL = require('./pipelines'), ES = require('./estructura'), { E } = require('../util');
const SEL = `select r.*, e.nombre empresa, un.nombre unidad, un.codigo unidad_codigo, unidad_aprobadora(r.unidad_id) aprob_uid, (select nombre from unidad where id=unidad_aprobadora(r.unidad_id)) aprob_nombre, pf.id perfil_id, pf.nombre cargo, pv.version perfil_v, s.nombre solicitante, s.email solicitante_email, g.nombre grado
  from requisicion r join empresa e on e.id=r.empresa_id left join unidad un on un.id=r.unidad_id
  join perfil_version pv on pv.id=r.perfil_version_id join perfil pf on pf.id=pv.perfil_id join usuario s on s.id=r.solicitante_id
  left join grado_instruccion g on g.id=r.grado_id`;

const hist = (c, u, id, accion, detalle) => c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u && u.id, 'requisicion', String(id), accion, detalle || {}]);
async function lock(c, id) {
  const r = (await c.query('select * from requisicion where id=$1 for update', [id])).rows[0];
  if (!r) throw E(404, 'Requisición no encontrada');
  return r;
}
const extras = async (c, id) => ({
  equipos: (await c.query('select re.equipo_id, re.requiere_linea, ce.nombre from requisicion_equipo re join catalogo_equipo ce on ce.id=re.equipo_id where re.requisicion_id=$1 order by ce.nombre', [id])).rows,
  accesos: (await c.query('select ra.acceso_id, ra.nivel, ca.nombre from requisicion_acceso ra join catalogo_acceso ca on ca.id=ra.acceso_id where ra.requisicion_id=$1 order by ca.nombre', [id])).rows
});
// Contenido completo que recibe n8n al aprobarse (aviso a TI para planificar) y al ingresar (entrega)
async function detalleEvento(c, id) {
  const r = (await c.query(SEL + ' where r.id=$1', [id])).rows[0], x = await extras(c, id);
  return { empresa: r.empresa, unidad: r.unidad, unidad_codigo: r.unidad_codigo, cargo: r.cargo, tipo: r.tipo, sustituye_a: r.sustituye_a, plazas: r.plazas, contratacion: r.contratacion, desde: r.vigencia_desde, hasta: r.vigencia_hasta,
    profesion: r.profesion, grado: r.grado, experiencia: r.experiencia, fecha_requerida: r.fecha_requerida, solicitante: r.solicitante, solicitante_email: r.solicitante_email,
    correo_corporativo: r.correo_corporativo, equipos: x.equipos.map(e => ({ nombre: e.nombre, con_linea: e.requiere_linea })), equipos_otros: r.equipos_otros, accesos: x.accesos.map(a => ({ nombre: a.nombre, nivel: a.nivel })) };
}
async function cambiar(c, u, r, est, accion, extra) {
  await c.query('update requisicion set estado=$2, actualizada_en=now() where id=$1', [r.id, est]);
  await hist(c, u, r.id, accion, { de: r.estado, a: est, ...(extra || {}) });
  const pl = await PL.resolver(r.empresa_id, 'requisicion', c), base = { requisicion_id: r.id, codigo: r.codigo, estado: est, empresa_id: r.empresa_id, solicitante_id: r.solicitante_id };
  const rico = est === 'aprobado' || (pl.exito && est === pl.exito.clave);
  if (est === 'pend_director') { const ap = await ES.aprobacion(c, r); base.aprobadora = ap.unidad && ap.unidad.nombre; base.aprobadores = ap.aprobadores.map(a => ({ nombre: a.nombre, email: a.email })); }
  if (est === 'pend_presidencia') base.aprobadores = (await c.query("select distinct us.nombre, us.email from usuario_rol ur join usuario us on us.id=ur.usuario_id where ur.rol='presidencia' and ur.unidad_id is null and (ur.empresa_id is null or ur.empresa_id=$1) and us.activo", [r.empresa_id])).rows;
  await c.query('insert into evento_outbox(tipo,payload) values($1,$2)', ['requisicion.' + est, rico ? { ...base, detalle: await detalleEvento(c, r.id) } : base]);
}
const pasoDe = r => ({ pend_director: 'director', pend_presidencia: 'presidencia' })[r.estado];
// Director: quien tenga el rol en la unidad aprobadora (subiendo por la línea sólida); sin unidad aprobadora en la cadena,
// regla de transición 0.4 (director con alcance de empresa). Presidencia: alcance de empresa. Nadie aprueba lo suyo.
const puedeDecidir = (u, r) => {
  const p = pasoDe(r); if (!p || r.solicitante_id == u.id) return false;
  if (p === 'presidencia') return P.tiene(u, 'presidencia', r.empresa_id);
  return r.aprob_uid ? P.unidadesDe(u, 'director').includes(r.aprob_uid) : P.tiene(u, 'director', r.empresa_id);
};
async function contextoAprob() {
  const rs = (await q("select ur.unidad_id, ur.empresa_id from usuario_rol ur join usuario us on us.id=ur.usuario_id where ur.rol='director' and us.activo")).rows;
  return { uni: new Set(rs.filter(x => x.unidad_id).map(x => x.unidad_id)), emp: new Set(rs.filter(x => !x.unidad_id).map(x => x.empresa_id)) };
}
const sinAprobador = (r, k) => r.estado === 'pend_director' && (r.aprob_uid ? !k.uni.has(r.aprob_uid) : !(k.emp.has(null) || k.emp.has(r.empresa_id)));

async function listar(u, empresaId) {
  const w = [], p = [];
  if (!P.esGH(u)) {
    p.push(u.id); const c = ['r.solicitante_id=$1', 'exists(select 1 from aprobacion ap where ap.requisicion_id=r.id and ap.decidido_por=$1)'];
    const e = P.empresasDe(u, ['director', 'presidencia']), un = P.unidadesDe(u, 'director');
    if (e === null) c.push('true'); else if (e.length) { p.push(e); c.push(`r.empresa_id=any($${p.length})`); }
    if (un.length) { p.push(un); c.push(`unidad_aprobadora(r.unidad_id)=any($${p.length})`); }
    w.push('(' + c.join(' or ') + ')');
  }
  if (empresaId) { p.push(+empresaId); w.push(`r.empresa_id=$${p.length}`); }
  const rows = (await q(SEL + (w.length ? ' where ' + w.join(' and ') : '') + ' order by r.id desc', p)).rows;
  const k = await contextoAprob();
  rows.forEach(r => { r.pendiente = puedeDecidir(u, r); r.sin_aprobador = sinAprobador(r, k); });
  return rows;
}
async function obtener(u, id) {
  const r = (await q(SEL + ' where r.id=$1', [id])).rows[0];
  if (r) r.decidio = (await q('select 1 from aprobacion where requisicion_id=$1 and decidido_por=$2', [id, u.id])).rowCount > 0;
  if (!r || !P.puedeVer(u, r)) throw E(404, 'Requisición no encontrada');
  r.sin_aprobador = sinAprobador(r, await contextoAprob());
  return Object.assign(r, await extras({ query: q }, id));
}
async function sinHistorial(id) {
  return +(await q(`select (select count(*) from aprobacion where requisicion_id=$1)+(select count(*) from historial where entidad='requisicion' and entidad_id=$2 and accion not in ('crear','editar'))
    +(select count(*) from comentario where entidad='requisicion' and entidad_id=$1) n`, [id, String(id)])).rows[0].n === 0;
}
async function acciones(u, r) {
  const gh = P.esGH(u), pl = await PL.resolver(r.empresa_id, 'requisicion'), propio = r.estado === 'borrador' && r.solicitante_id == u.id;
  const i = pl.flujo.findIndex(e => e.clave === r.estado), et = i >= 0 ? pl.flujo[i] : null, nxt = i >= 0 ? pl.flujo[i + 1] : null;
  const mover = gh && !!nxt && nxt.clase !== 'exito';
  const a = { enviar: propio, editar: propio, decidir: puedeDecidir(u, r), mover, siguiente: nxt && nxt.nombre, cancelar: gh && !!et && et.clase !== 'exito', seleccion: gh && r.estado === 'seleccion',
    anular: r.estado === 'borrador' && (propio || gh), eliminar: propio && await sinHistorial(r.id), bloqueos: [], etapa: null, registro: null };
  if (gh && et) {
    a.etapa = et;
    a.registro = (await q('select * from etapa_registro where tipo=$1 and entidad_id=$2 and etapa=$3', ['requisicion', r.id, et.clave])).rows[0] || null;
    if (mover) a.bloqueos = await PL.problemas({ query: q }, 'requisicion', r.id, et);
  }
  return a;
}
// Las aprobaciones registradas, con la foto de la estructura de ese momento
const aprobaciones = id => q('select ap.*, us.nombre autor from aprobacion ap join usuario us on us.id=ap.decidido_por where ap.requisicion_id=$1 order by ap.id', [id]).then(r => r.rows);
// Crea (id null) o actualiza un borrador: todos los campos son editables mientras sea borrador
async function guardar(u, id, b) {
  const emp = +b.empresa_id, uid = +b.unidad_id;
  if (!uid) throw E(400, 'Selecciona la unidad que solicita');
  const op = (await ES.alcanceSolicitud(u)).find(o => o.id === uid);
  if (!op) throw E(403, 'No puedes solicitar para esa unidad');
  if (!op.empresas.includes(emp)) throw E(400, 'Esa unidad no pertenece ni presta servicio a la empresa elegida');
  const pv = (await q('select id from perfil_version where perfil_id=$1 order by version desc limit 1', [+b.perfil_id])).rows[0]; if (!pv) throw E(400, 'Selecciona un perfil');
  const tipo = b.tipo === 'nuevo' ? 'nuevo' : 'reemplazo', temp = b.contratacion === 'Temporal', t = s => (s || '').trim() || null;
  if (temp && (!b.vigencia_desde || !b.vigencia_hasta || b.vigencia_hasta < b.vigencia_desde)) throw E(400, 'En contratación temporal indica fechas válidas: «hasta» no puede ser anterior a «desde»');
  const v = [emp, uid, pv.id, tipo, temp ? 'Temporal' : 'Permanente', Math.max(1, parseInt(b.plazas) || 1), t(b.justificacion), b.fecha_requerida || null,
    tipo === 'reemplazo' ? t(b.sustituye_a) : null, t(b.profesion), b.grado_id || null, t(b.experiencia), temp ? b.vigencia_desde : null, temp ? b.vigencia_hasta : null, b.correo_corporativo === 'on', t(b.equipos_otros)];
  return tx(async c => {
    let rid = id;
    if (!id) {
      rid = (await c.query(`insert into requisicion(codigo,empresa_id,unidad_id,perfil_version_id,tipo,contratacion,plazas,justificacion,fecha_requerida,sustituye_a,profesion,grado_id,experiencia,vigencia_desde,vigencia_hasta,correo_corporativo,equipos_otros,solicitante_id)
        values('REQ-'||lpad(nextval('req_seq')::text,5,'0'),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`, [...v, u.id])).rows[0].id;
    } else {
      const r = await lock(c, id); if (r.estado !== 'borrador' || r.solicitante_id != u.id) throw E(403, 'Solo el solicitante edita un borrador');
      await c.query(`update requisicion set empresa_id=$2,unidad_id=$3,perfil_version_id=$4,tipo=$5,contratacion=$6,plazas=$7,justificacion=$8,fecha_requerida=$9,sustituye_a=$10,profesion=$11,grado_id=$12,experiencia=$13,
        vigencia_desde=$14,vigencia_hasta=$15,correo_corporativo=$16,equipos_otros=$17,actualizada_en=now() where id=$1`, [id, ...v]);
    }
    await c.query('delete from requisicion_equipo where requisicion_id=$1', [rid]); await c.query('delete from requisicion_acceso where requisicion_id=$1', [rid]);
    for (const e of [].concat(b.eq || [])) await c.query('insert into requisicion_equipo(requisicion_id,equipo_id,requiere_linea) values($1,$2,$3) on conflict do nothing', [rid, +e, b['linea_' + e] === 'on']);
    for (const a of [].concat(b.ac || [])) await c.query('insert into requisicion_acceso(requisicion_id,acceso_id,nivel) values($1,$2,$3) on conflict do nothing', [rid, +a, t(b['nivel_' + a])]);
    await hist(c, u, rid, id ? 'editar' : 'crear'); return rid;
  });
}
async function eliminar(u, id) {
  const rutas = await tx(async c => {
    const r = await lock(c, id);
    if (r.solicitante_id != u.id || r.estado !== 'borrador') throw E(403, 'Solo el solicitante elimina su borrador');
    if (!(await sinHistorial(id))) throw E(400, 'Ya tiene historial o comentarios: usa «Anular» para conservar la traza');
    const files = (await c.query("delete from adjunto where entidad='requisicion' and entidad_id=$1 returning ruta", [id])).rows.map(x => x.ruta);
    await c.query('delete from requisicion_equipo where requisicion_id=$1', [id]); await c.query('delete from requisicion_acceso where requisicion_id=$1', [id]);
    await c.query('delete from requisicion where id=$1', [id]); await hist(c, u, id, 'eliminar', { codigo: r.codigo }); return files;
  });
  const fs = require('fs'), path = require('path'), cfg = require('../config');
  rutas.forEach(f => fs.unlink(path.join(cfg.uploads, f), () => {}));
}
async function anular(u, id, motivo) {
  if (!String(motivo || '').trim()) throw E(400, 'El motivo es obligatorio');
  return tx(async c => {
    const r = await lock(c, id); if (r.estado !== 'borrador' || !(r.solicitante_id == u.id || P.esGH(u))) throw E(403, 'No puedes anular esta requisición');
    await c.query('update requisicion set motivo_cierre=$2 where id=$1', [id, motivo.trim()]); await cambiar(c, u, r, 'anulada', 'anular', { motivo: motivo.trim() });
  });
}
async function enviar(u, id) {
  return tx(async c => {
    const r = await lock(c, id);
    if (r.solicitante_id != u.id || r.estado !== 'borrador') throw E(400, 'No se puede enviar esta requisición');
    if (!r.unidad_id) throw E(400, 'Indica la unidad que solicita (edita el borrador) antes de enviarlo');
    const ap = await ES.aprobacion(c, r);
    let est = 'pend_director';
    if (ap.aprobadores.some(a => a.id === u.id)) {   // quien aprueba esa unidad y solicita, se aprueba automáticamente
      await c.query('insert into aprobacion(requisicion_id,paso,decision,decidido_por,comentario,estructura) values($1,$2,$3,$4,$5,$6)',
        [id, 'director', 'automatica', u.id, 'El solicitante es quien aprueba esa unidad', await ES.foto(c, r, ap)]);
      est = r.tipo === 'nuevo' ? 'pend_presidencia' : 'aprobado';
    }
    await cambiar(c, u, r, est, 'enviar', { aprobadora: ap.unidad ? ap.unidad.nombre : null, regla: ap.regla });
    if (est === 'pend_director' && !ap.aprobadores.length)   // queda retenida hasta que GH complete la estructura; no se reasigna sola
      await c.query('insert into evento_outbox(tipo,payload) values($1,$2)', ['requisicion.sin_aprobador', { requisicion_id: r.id, codigo: r.codigo, empresa_id: r.empresa_id, aprobadora: ap.unidad && ap.unidad.nombre, regla: ap.regla }]);
  });
}
async function decidir(u, id, d, com) {
  if (!['aprobada', 'devuelta', 'rechazada'].includes(d)) throw E(400, 'Decisión inválida');
  if (d !== 'aprobada' && !String(com || '').trim()) throw E(400, 'El comentario es obligatorio al devolver o rechazar');
  return tx(async c => {
    const r = await lock(c, id), paso = pasoDe(r);
    if (!paso) throw E(400, 'La requisición no espera aprobación');
    if (r.solicitante_id == u.id) throw E(403, 'Nadie aprueba su propia requisición');
    let ft;
    if (paso === 'director') {   // la autoridad se calcula con la estructura vigente en este momento y queda fotografiada
      const ap = await ES.aprobacion(c, r); if (!ap.aprobadores.some(a => a.id === u.id)) throw E(403, 'No eres quien aprueba esta unidad');
      ft = await ES.foto(c, r, ap);
    } else {
      if (!P.tiene(u, 'presidencia', r.empresa_id)) throw E(403, 'No puedes decidir esta requisición');
      ft = await ES.foto(c, r, { regla: 'presidencia', unidad: null });
    }
    await c.query('insert into aprobacion(requisicion_id,paso,decision,decidido_por,comentario,estructura) values($1,$2,$3,$4,$5,$6)', [id, paso, d, u.id, (com || '').trim() || null, ft]);
    const est = d === 'devuelta' ? 'borrador' : d === 'rechazada' ? 'rechazada' : (paso === 'director' && r.tipo === 'nuevo' ? 'pend_presidencia' : 'aprobado');
    await cambiar(c, u, r, est, paso + '.' + d, { comentario: (com || '').trim() || undefined });
  });
}
async function mover(u, id) {
  if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana mueve la requisición');
  return tx(async c => {
    const r = await lock(c, id), pl = await PL.resolver(r.empresa_id, 'requisicion', c), i = pl.flujo.findIndex(e => e.clave === r.estado), nxt = pl.flujo[i + 1];
    if (i < 0 || !nxt) throw E(400, 'No se puede avanzar desde este estado');
    if (nxt.clase === 'exito') throw E(400, 'El paso a Ingreso es automático al confirmar todas las plazas');
    const pr = await PL.problemas(c, 'requisicion', id, pl.flujo[i]); if (pr.length) throw E(400, pr.join('. '));
    await cambiar(c, u, r, nxt.clave, 'mover');
  });
}
async function cancelar(u, id, motivo) {
  if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana cancela');
  if (!String(motivo || '').trim()) throw E(400, 'El motivo es obligatorio');
  return tx(async c => {
    const r = await lock(c, id), pl = await PL.resolver(r.empresa_id, 'requisicion', c), et = pl.flujo.find(e => e.clave === r.estado);
    if (!et || et.clase === 'exito') throw E(400, 'No se puede cancelar en este estado');
    await c.query('update requisicion set motivo_cierre=$2 where id=$1', [id, motivo.trim()]);
    await cambiar(c, u, r, pl.cierre.clave, 'cancelar', { motivo: motivo.trim() });
  });
}
async function registrar(u, id, b) {
  if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana registra resultados');
  const r = (await q('select * from requisicion where id=$1', [id])).rows[0]; if (!r) throw E(404, 'No encontrada');
  const pl = await PL.resolver(r.empresa_id, 'requisicion'), et = pl.flujo.find(e => e.clave === r.estado);
  if (!et || et.clase === 'exito') throw E(400, 'Esta etapa no admite registro');
  await PL.registrar(u, 'requisicion', id, et, b);
  const ck = [].concat(b.check || []).filter(i => ((et.reglas && et.reglas.checklist) || []).includes(i));
  await hist({ query: q }, u, id, 'registro', { etapa: et.nombre, resultado: ['apto', 'no_apto'].includes(b.resultado) ? b.resultado : 'pendiente', checklist: ck, nota: (b.nota || '').trim() || undefined });
}
module.exports = { listar, obtener, aprobaciones, acciones, guardar, eliminar, anular, enviar, decidir, mover, cancelar, registrar, lock, cambiar, hist };
