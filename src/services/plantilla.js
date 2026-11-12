const ExcelJS = require('exceljs'), { q, tx } = require('../db'), ES = require('./estructura'), { E } = require('../util');
const MODALIDADES = { nomina: 'Nómina propia', outsourcing: 'Outsourcing', pasante: 'Pasante', becario: 'Becario', aprendiz: 'Aprendiz' };
const EXTERNAS = ['outsourcing', 'pasante', 'becario', 'aprendiz'];   // no forman parte de la nómina: se cuentan aparte
const hist = (c, u, entidad, id, accion, detalle) => c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u && u.id, entidad, String(id), accion, detalle || {}]);
const ABIERTA = `r.estado not in ('rechazada','anulada','cancelado') and r.estado not in (select clave from etapa where clase in ('exito','cierre'))`;
const POR_DEFINIR = 'Por definir';
const fechaOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(new Date(s));

// Estado de plan de una plaza a una fecha (las fechas llegan como 'YYYY-MM-DD', se comparan como texto)
const estado = (z, f) => (z.hasta && (z.hasta <= f || z.hasta <= z.desde)) ? 'cerrada' : z.desde > f ? 'proyectada' : z.congelada ? 'congelada' : 'vigente';
const ESTADOS = { vigente: 'Vigente', congelada: 'Congelada', proyectada: 'Proyectada', cerrada: 'Cerrada' };

// Conteo de un conjunto de plazas. HC = nómina propia vigente. Congeladas y proyectadas: nómina. Externas: vigentes, aparte.
function contar(plazas, f, empSet, modSet) {   // modSet: modalidades a contar (sin él, todas)
  const k = { hc: 0, cong: 0, proy: 0, porDefinir: 0, enProceso: 0, ext: { outsourcing: 0, pasante: 0, becario: 0, aprendiz: 0 }, porEmp: {} };
  for (const z of plazas) {
    if (empSet && !empSet.has(z.empresa_id)) continue; if (modSet && !modSet.has(z.modalidad)) continue;
    const e = estado(z, f); if (e === 'cerrada') continue;
    if (z.modalidad !== 'nomina') { if (e === 'vigente') k.ext[z.modalidad]++; continue; }
    if (e === 'vigente') { k.hc++; const s = z.empresa_id ? (z.siglas || z.empresa) : POR_DEFINIR; k.porEmp[s] = (k.porEmp[s] || 0) + 1; if (!z.empresa_id) k.porDefinir++; if (z.req) k.enProceso++; }
    else if (e === 'congelada') k.cong++; else k.proy++;
  }
  k.externas = EXTERNAS.reduce((s, m) => s + k.ext[m], 0);
  return k;
}
// Texto corto de un conteo: «HC 5 · ❄1 · ⏳2 · +3 ext.»
const resumenTxt = k => [k.hc || k.cong || k.proy ? 'HC ' + k.hc : '', k.enProceso ? '↻' + k.enProceso : '', k.cong ? '❄' + k.cong : '', k.proy ? '⏳' + k.proy : '', k.externas ? '+' + k.externas + ' ext.' : ''].filter(Boolean).join(' · ');

async function cargar(fecha) {
  const f = fechaOk(fecha) ? fecha : await ES.hoy();
  const [ps, pz, g] = await Promise.all([
    q(`select p.*, pf.codigo perfil_codigo, pf.nombre perfil, pf.nivel perfil_nivel, nj.orden nivel_orden, nj.nombre nivel_nombre, u.nombre unidad, u.codigo unidad_codigo
       from puesto p join perfil pf on pf.id=p.perfil_id join unidad u on u.id=p.unidad_id left join nivel_jerarquico nj on nj.id=pf.nivel_jerarquico_id and nj.activo where p.activo`).then(r => r.rows),
    q(`select z.*, e.siglas, coalesce(e.razon_social,e.nombre) empresa from plaza z left join empresa e on e.id=z.empresa_id join puesto p on p.id=z.puesto_id
       where p.activo and z.creado_en::date <= $1::date and (z.hasta is null or z.hasta > $1 or z.desde > $1)`, [f]).then(r => r.rows),   // creado_en <= fecha: a esa fecha la plaza ya existía en el plan
    ES.grafo(f)]);
  const byP = new Map(ps.map(p => [p.id, Object.assign(p, { plazas: [] })]));
  const reqs = new Map((await q(`select r.plaza_id, r.id, r.codigo, r.estado from requisicion r where r.plaza_id is not null and ${ABIERTA}`)).rows.map(r => [r.plaza_id, r]));
  for (const z of pz) { const p = byP.get(z.puesto_id); if (p) { z.req = reqs.get(z.id) || null; p.plazas.push(z); } }
  resolver(byP, g.by);
  return { f, byP, g };
}
// Reporte: excepción explícita; si no, el jefe de la propia unidad; y el jefe de la unidad, al jefe de la unidad superior más cercana que tenga jefe.
function resolver(byP, byU) {
  const jefeDe = new Map(); for (const p of byP.values()) if (p.jefe) jefeDe.set(p.unidad_id, p.id);
  const jefeArriba = uid => { let u = byU.get(uid), n = 0; while (u && n++ < 60) { u = byU.get(u.padre_id); if (u && jefeDe.has(u.id)) return jefeDe.get(u.id); } return null; };
  for (const p of byP.values()) {
    if (p.reporta_a && byP.has(p.reporta_a)) { p.reporta_id = p.reporta_a; p.regla = 'excepcion'; continue; }
    p.reporta_id = p.jefe ? jefeArriba(p.unidad_id) : (jefeDe.get(p.unidad_id) !== p.id && jefeDe.get(p.unidad_id)) || jefeArriba(p.unidad_id);
    p.regla = 'defecto';
  }
}
const cicla = (byP, id) => { let x = byP.get(id), n = 0; while (x && n++ < 200) { x = byP.get(x.reporta_id); if (x && x.id === id) return true; } return false; };

// Resumen por unidad (árbol y diagrama de unidades)
async function resumenUnidades(fecha, empresas, modalidades) {
  const { f, byP } = await cargar(fecha), empSet = empresas && empresas.length ? new Set(empresas.map(Number)) : null, por = new Map(), modSet = modalidades && modalidades.length ? new Set(modalidades) : null;
  for (const p of byP.values()) { const a = por.get(p.unidad_id) || []; a.push(...p.plazas); por.set(p.unidad_id, a); }
  const out = new Map(); for (const [uid, pl] of por) { const k = contar(pl, f, empSet, modSet); out.set(uid, Object.assign(k, { txt: resumenTxt(k) })); }
  return out;
}

// Listado de puestos para la página de plantilla (orden del árbol; el jefe primero dentro de cada unidad)
async function listar(fl = {}) {
  const { f, byP, g } = await cargar(fl.fecha), empSet = fl.empresa ? new Set([+fl.empresa]) : null, txt = String(fl.buscar || '').trim().toLowerCase();
  const sub = fl.unidad && g.by.has(+fl.unidad) ? ES.descendientes(g.by, +fl.unidad) : null;
  const orden = new Map((await ES.arbol({ fecha: f })).filas.map((x, i) => [x.u.id, [i, x.nivel]]));
  const rows = [...byP.values()].filter(p => (!sub || sub.has(p.unidad_id)) && (!txt || (p.perfil + ' ' + p.perfil_codigo + ' ' + p.unidad + ' ' + p.unidad_codigo).toLowerCase().includes(txt))
    && (!fl.modalidad || p.plazas.some(z => z.modalidad === fl.modalidad && estado(z, f) !== 'cerrada'))
    && (!empSet || p.plazas.some(z => empSet.has(z.empresa_id) && estado(z, f) !== 'cerrada')))
    .map(p => Object.assign(p, { k: contar(p.plazas, f, empSet), reporta: byP.get(p.reporta_id) || null, ord: orden.get(p.unidad_id) || [1e9, 0] }))
    .sort((a, b) => a.ord[0] - b.ord[0] || (b.jefe - a.jefe) || a.perfil.localeCompare(b.perfil, 'es'));
  const tot = contar(rows.flatMap(p => p.plazas), f, empSet);
  return { f, rows, tot };
}
async function detalle(id, fecha) {
  const { f, byP } = await cargar(fecha), p = byP.get(+id);
  if (!p) { const x = (await q('select activo from puesto where id=$1', [id])).rows[0]; throw E(404, x ? 'El puesto está desactivado' : 'Puesto no encontrado'); }
  const plazas = (await q(`select z.*, e.siglas, coalesce(e.razon_social,e.nombre) empresa, uc.nombre creado_por_nombre, ux.nombre cerrado_por_nombre
    from plaza z left join empresa e on e.id=z.empresa_id left join usuario uc on uc.id=z.creado_por left join usuario ux on ux.id=z.cerrado_por where z.puesto_id=$1 order by z.id`, [id])).rows;
  const rq = (await q(`select r.plaza_id, r.id, r.codigo, r.estado, (${ABIERTA}) abierta from requisicion r where r.plaza_id = any($1) order by r.id desc`, [plazas.map(z => z.id)])).rows;
  plazas.forEach(z => { z.estado = estado(z, f); z.reqs = rq.filter(r => r.plaza_id === z.id); z.req = z.reqs.find(r => r.abierta) || null; });
  const historial = (await q(`select h.*, u.nombre autor from historial h left join usuario u on u.id=h.usuario_id
    where (h.entidad='puesto' and h.entidad_id=$1) or (h.entidad='plaza' and h.entidad_id = any($2)) order by h.id desc limit 100`, [String(id), plazas.map(z => String(z.id))])).rows;
  return { f, p, plazas, historial, k: contar(plazas, f), reporta: byP.get(p.reporta_id) || null };
}
// Opciones para «reporta a»: todos los puestos activos, en orden del árbol
async function opcionesPuestos() {
  const { byP, g } = await cargar(), orden = new Map((await ES.arbol()).filas.map((x, i) => [x.u.id, i]));
  return [...byP.values()].sort((a, b) => (orden.get(a.unidad_id) || 0) - (orden.get(b.unidad_id) || 0) || (b.jefe - a.jefe) || a.perfil.localeCompare(b.perfil, 'es'))
    .map(p => ({ id: p.id, etiqueta: (p.jefe ? '★ ' : '') + p.perfil + ' · ' + p.unidad, unidad_id: p.unidad_id }));
}

// ---------- Escritura ----------
async function empresaPorDefecto(c, unidadId) {
  const u = (await c.query('select empresa_id from unidad where id=$1', [unidadId])).rows[0]; return u && u.empresa_id;
}
function datosPlazas(b) {
  const n = parseInt(b.cantidad, 10); if (!n || n < 1 || n > 200) throw E(400, 'Indica cuántas plazas (de 1 a 200)');
  if (!MODALIDADES[b.modalidad || 'nomina']) throw E(400, 'Modalidad inválida');
  const desde = b.desde ? String(b.desde) : null; if (desde && !fechaOk(desde)) throw E(400, 'Fecha «desde» inválida');
  const motivo = String(b.motivo || '').trim(); if (!motivo) throw E(400, 'Indica el motivo: queda en el historial');
  return { n, modalidad: b.modalidad || 'nomina', desde, motivo, congelada: b.congelada === 'on', empresa_id: b.empresa_id ? +b.empresa_id : null };
}
async function crearPlazasC(c, u, puestoId, d, origen = 'manual', requisicionId = null) {
  const p = (await c.query('select * from puesto where id=$1 and activo for update', [puestoId])).rows[0]; if (!p) throw E(404, 'Puesto no encontrado o desactivado');
  // Empresa: la indicada; si no, la propia de la unidad; si la unidad es corporativa, «Por definir» (NULL)
  const emp = d.empresa_id || await empresaPorDefecto(c, p.unidad_id) || null;
  if (emp && !(await c.query('select 1 from empresa where id=$1 and activa', [emp])).rowCount) throw E(400, 'La empresa no existe o está inactiva');
  const filas = [];
  for (let i = 0; i < d.n; i++) filas.push((await c.query(`insert into plaza(puesto_id,empresa_id,modalidad,desde,congelada,origen,motivo,requisicion_id,creado_por)
    values($1,$2,$3,coalesce($4::date,current_date),$5,$6,$7,$8,$9) returning id, codigo`, [puestoId, emp, d.modalidad, d.desde, d.congelada, origen, d.motivo, requisicionId, u && u.id])).rows[0]);
  const codigos = filas.map(x => x.codigo);
  await hist(c, u, 'puesto', puestoId, 'plazas.alta', { cantidad: d.n, empresa_id: emp, modalidad: d.modalidad, desde: d.desde, congelada: d.congelada, motivo: d.motivo, codigos, requisicion_id: requisicionId || undefined });
  return Object.assign(codigos, { filas });
}
async function validarReporte(c, id, reportaA, jefe) {
  if (!reportaA) return;
  const t = (await c.query('select id from puesto where id=$1 and activo', [reportaA])).rows[0]; if (!t) throw E(400, 'El puesto al que reporta no existe o está desactivado');
  if (id && +reportaA === +id) throw E(400, 'Un puesto no puede reportarse a sí mismo');
  const { byP } = await cargar(); if (id && byP.has(id)) { const p = byP.get(id); p.reporta_a = +reportaA; p.jefe = jefe; resolver(byP, (await ES.grafo()).by); if (cicla(byP, id)) throw E(400, 'Esa línea de reporte forma un ciclo'); }
}
const dup = e => { if (e.code === '23505') return E(400, /jefe/.test(e.constraint) ? 'Esa unidad ya tiene un puesto jefe: desmárcalo primero' : 'Ese perfil ya tiene un puesto en esa unidad'); return e; };
async function crearPuesto(u, b) {
  const unidad = +b.unidad_id, perfil = +b.perfil_id, jefe = b.jefe === 'on', reportaA = b.reporta_a ? +b.reporta_a : null;
  if (!unidad || !perfil) throw E(400, 'Elige la unidad y el perfil del puesto');
  return tx(async c => {
    if (!(await c.query('select 1 from unidad where id=$1 and activa', [unidad])).rowCount) throw E(400, 'La unidad no existe o está inactiva');
    if (!(await c.query('select 1 from perfil where id=$1 and activo', [perfil])).rowCount) throw E(400, 'El perfil no existe o está inactivo');
    // El mismo cargo en la misma unidad es UN puesto: las demás empresas o modalidades son plazas de ese puesto
    const ya = (await c.query('select id from puesto where unidad_id=$1 and perfil_id=$2 and activo', [unidad, perfil])).rows[0];
    if (ya) throw Object.assign(E(400, 'Ese cargo ya existe en esa unidad: te abrí su puesto para que le agregues las plazas (por ejemplo, de otra empresa)'), { puestoId: ya.id });
    await validarReporte(c, null, reportaA, jefe);
    await c.query('savepoint sp'); let id;
    try { id = (await c.query('insert into puesto(unidad_id,perfil_id,jefe,reporta_a,creado_por) values($1,$2,$3,$4,$5) returning id', [unidad, perfil, jefe, reportaA, u.id])).rows[0].id; }
    catch (e) { await c.query('rollback to savepoint sp'); throw dup(e); }
    await hist(c, u, 'puesto', id, 'crear', { unidad_id: unidad, perfil_id: perfil, jefe, reporta_a: reportaA });
    if (parseInt(b.cantidad, 10) > 0) await crearPlazasC(c, u, id, datosPlazas(b));
    return id;
  });
}
async function editarPuesto(u, id, b) {
  const jefe = b.jefe === 'on', reportaA = b.reporta_a ? +b.reporta_a : null;
  return tx(async c => {
    const a = (await c.query('select * from puesto where id=$1 and activo for update', [id])).rows[0]; if (!a) throw E(404, 'Puesto no encontrado');
    await validarReporte(c, id, reportaA, jefe);
    await c.query('savepoint sp');
    try { await c.query('update puesto set jefe=$2, reporta_a=$3 where id=$1', [id, jefe, reportaA]); } catch (e) { await c.query('rollback to savepoint sp'); throw dup(e); }
    await hist(c, u, 'puesto', id, 'editar', { jefe: { de: a.jefe, a: jefe }, reporta_a: { de: a.reporta_a, a: reportaA } });
  });
}
// Mover un puesto (con sus plazas) a otra unidad: corrige una unidad equivocada sin cerrar ni recrear plazas.
// La excepción de reporte se quita (vuelve a la regla por defecto en su unidad nueva). Las requisiciones ya creadas no se tocan.
async function moverPuesto(u, id, destino, motivo) {
  motivo = String(motivo || '').trim(); if (!motivo) throw E(400, 'Indica el motivo del traslado: queda en el historial');
  destino = +destino; if (!destino) throw E(400, 'Elige la unidad destino');
  return tx(async c => {
    const p = (await c.query('select p.*, u.nombre unidad from puesto p join unidad u on u.id=p.unidad_id where p.id=$1 and p.activo for update of p', [id])).rows[0]; if (!p) throw E(404, 'Puesto no encontrado o desactivado');
    if (p.unidad_id === destino) throw E(400, 'El puesto ya está en esa unidad');
    const d = (await c.query('select id, nombre, empresa_id from unidad where id=$1 and activa', [destino])).rows[0]; if (!d) throw E(400, 'La unidad destino no existe o está inactiva');
    const ya = (await c.query('select id from puesto where unidad_id=$1 and perfil_id=$2 and activo', [destino, p.perfil_id])).rows[0];
    if (ya) throw Object.assign(E(400, 'Ese cargo ya existe en «' + d.nombre + '»: agrégale allí las plazas y cierra estas'), { puestoId: ya.id });
    if (p.jefe && (await c.query('select 1 from puesto where unidad_id=$1 and jefe and activo', [destino])).rowCount) throw E(400, '«' + d.nombre + '» ya tiene un puesto jefe: desmarca «jefe» en este puesto antes de moverlo');
    await c.query('update puesto set unidad_id=$2, reporta_a=null where id=$1', [id, destino]);
    // En una unidad con empresa propia no hay plazas «Por definir»: toman esa empresa
    const fijadas = d.empresa_id ? (await c.query('update plaza set empresa_id=$2 where puesto_id=$1 and empresa_id is null and (hasta is null or hasta > current_date) returning codigo', [id, d.empresa_id])).rows.map(x => x.codigo) : [];
    await hist(c, u, 'puesto', id, 'mover', { de: p.unidad, a: d.nombre, de_id: p.unidad_id, a_id: destino, motivo, excepcion_quitada: !!p.reporta_a, plazas_con_empresa: fijadas.length ? fijadas : undefined });
    return { excepcion: !!p.reporta_a, fijadas: fijadas.length };
  });
}
async function desactivarPuesto(u, id) {
  return tx(async c => {
    const n = (await c.query('select count(*)::int n from plaza where puesto_id=$1 and (hasta is null or hasta > current_date)', [id])).rows[0].n;
    if (n) throw E(400, 'Tiene ' + n + ' plaza(s) abiertas: ciérralas antes de desactivar el puesto');
    const dep = (await c.query('select count(*)::int n from puesto where reporta_a=$1 and activo', [id])).rows[0].n;
    if (dep) throw E(400, dep + ' puesto(s) le reportan como excepción: cámbialos antes');
    await c.query('update puesto set activo=false, jefe=false where id=$1', [id]); await hist(c, u, 'puesto', id, 'desactivar');
  });
}
const agregarPlazas = (u, puestoId, b) => tx(c => crearPlazasC(c, u, puestoId, datosPlazas(b)));
async function congelar(u, plazaId, on, motivo) {
  motivo = String(motivo || '').trim(); if (!motivo) throw E(400, 'Indica el motivo');
  return tx(async c => {
    const z = (await c.query('select * from plaza where id=$1 for update', [plazaId])).rows[0]; if (!z) throw E(404, 'Plaza no encontrada');
    if (z.hasta) throw E(400, 'La plaza está cerrada');
    await c.query('update plaza set congelada=$2 where id=$1', [plazaId, on]); await hist(c, u, 'plaza', plazaId, on ? 'congelar' : 'descongelar', { codigo: z.codigo, motivo }); return z.puesto_id;
  });
}
async function cerrarPlaza(u, plazaId, motivo) {
  motivo = String(motivo || '').trim(); if (!motivo) throw E(400, 'Indica el motivo del cierre');
  return tx(async c => {
    const z = (await c.query('select * from plaza where id=$1 for update', [plazaId])).rows[0]; if (!z) throw E(404, 'Plaza no encontrada');
    if (z.hasta) throw E(400, 'La plaza ya está cerrada');
    await c.query('update plaza set hasta=greatest(current_date, desde), cerrado_por=$2, motivo_cierre=$3 where id=$1', [plazaId, u.id, motivo]);
    await hist(c, u, 'plaza', plazaId, 'cerrar', { codigo: z.codigo, motivo }); return z.puesto_id;
  });
}

// ---------- Empresa de la plaza ----------
async function cambiarEmpresaC(c, u, plazaId, empresaId, motivo, origen) {
  const z = (await c.query('select z.*, p.unidad_id from plaza z join puesto p on p.id=z.puesto_id where z.id=$1 for update of z', [plazaId])).rows[0]; if (!z) throw E(404, 'Plaza no encontrada');
  if (z.hasta && (z.hasta <= (await c.query('select current_date::text d')).rows[0].d || z.hasta <= z.desde)) throw E(400, 'La plaza está cerrada');
  const emp = empresaId ? +empresaId : null;
  if (!emp && await empresaPorDefecto(c, z.unidad_id)) throw E(400, '«Por definir» solo aplica a plazas de unidades corporativas');
  if (emp && !(await c.query('select 1 from empresa where id=$1 and activa', [emp])).rowCount) throw E(400, 'La empresa no existe o está inactiva');
  if ((z.empresa_id || null) === emp) return z;
  await c.query('update plaza set empresa_id=$2 where id=$1', [plazaId, emp]);
  await hist(c, u, 'plaza', plazaId, 'empresa', { codigo: z.codigo, de: z.empresa_id, a: emp, motivo, origen });
  return z;
}
// Desde la plantilla: si la plaza tiene una requisición abierta, se cambia desde la requisición (para mantener ambas iguales)
async function cambiarEmpresaPlaza(u, plazaId, empresaId, motivo) {
  motivo = String(motivo || '').trim(); if (!motivo) throw E(400, 'Indica el motivo');
  return tx(async c => {
    const r = (await c.query(`select r.codigo from requisicion r where r.plaza_id=$1 and ${ABIERTA}`, [plazaId])).rows[0];
    if (r) throw E(400, 'La plaza está en proceso con la requisición ' + r.codigo + ': cambia la empresa desde la requisición (se actualizan ambas)');
    return (await cambiarEmpresaC(c, u, plazaId, empresaId, motivo, 'plantilla')).puesto_id;
  });
}
// ---------- Requisición ligada a la plaza ----------
// Plazas que se pueden pedir como reemplazo en esas unidades: abiertas, no congeladas; las que tienen otra requisición abierta salen marcadas
async function plazasParaSolicitud(unidadIds, reqId) {
  if (!unidadIds.length) return [];
  const f = await ES.hoy();
  const rows = (await q(`select z.id, z.codigo, z.empresa_id, z.desde, z.hasta, z.congelada, z.modalidad, e.siglas, coalesce(e.razon_social,e.nombre) empresa, p.id puesto_id, p.unidad_id, pf.id perfil_id, pf.nombre perfil, pf.codigo perfil_codigo,
      (select r.codigo from requisicion r where r.plaza_id=z.id and ${ABIERTA} and r.id <> coalesce($2, 0) limit 1) ocupada_por
    from plaza z join puesto p on p.id=z.puesto_id join perfil pf on pf.id=p.perfil_id left join empresa e on e.id=z.empresa_id
    where p.activo and pf.activo and pf.version_activa_id is not null and p.unidad_id = any($1) order by pf.nombre, z.codigo`, [unidadIds, reqId || null])).rows;
  return rows.filter(z => { const e = estado(z, f); return e === 'vigente' || e === 'proyectada'; });
}
// Validación al guardar una requisición de reemplazo (dentro de su transacción; bloquea la plaza para que no la tomen dos a la vez)
async function validarPlazaC(c, plazaId, unidadId, empresaId, reqId) {
  const z = (await c.query(`select z.*, p.unidad_id, p.activo puesto_activo, pf.version_activa_id, pf.activo perfil_activo, e.siglas from plaza z join puesto p on p.id=z.puesto_id join perfil pf on pf.id=p.perfil_id
    left join empresa e on e.id=z.empresa_id where z.id=$1 for update of z`, [plazaId])).rows[0];
  if (!z || !z.puesto_activo) throw E(400, 'Elige una plaza de la plantilla');
  if (z.unidad_id !== unidadId) throw E(400, 'Esa plaza no pertenece a la unidad elegida');
  const e = estado(z, (await c.query('select current_date::text d')).rows[0].d);
  if (e === 'cerrada') throw E(400, 'Esa plaza está cerrada'); if (e === 'congelada') throw E(400, 'Esa plaza está congelada: GH debe descongelarla antes de pedirla');
  if (!z.perfil_activo || !z.version_activa_id) throw E(400, 'El perfil de ese puesto está inactivo o sin versión activa');
  if (z.empresa_id && z.empresa_id !== empresaId) throw E(400, `Esa plaza es de nómina ${z.siglas || 'de otra empresa'}: elige esa empresa (Gestión Humana puede cambiarla después)`);
  const otra = (await c.query(`select r.codigo from requisicion r where r.plaza_id=$1 and ${ABIERTA} and r.id <> coalesce($2,0)`, [plazaId, reqId || null])).rows[0];
  if (otra) throw E(400, 'Esa plaza ya está en proceso con la requisición ' + otra.codigo);
  return { perfilVersionId: z.version_activa_id };
}
// Al quedar aprobada: el reemplazo fija la empresa de su plaza si estaba «Por definir»; el cargo nuevo crea (si hace falta) el puesto y su plaza
async function alAprobar(c, u, r) {
  if (r.plaza_id) {
    const z = (await c.query('select empresa_id from plaza where id=$1', [r.plaza_id])).rows[0];
    if (z && !z.empresa_id) await cambiarEmpresaC(c, u, r.plaza_id, r.empresa_id, 'Requisición ' + r.codigo + ' aprobada', 'requisicion');
    return null;
  }
  if (r.tipo !== 'nuevo') return null;   // reemplazos anteriores a la 0.7.2, sin plaza
  const perfilId = (await c.query('select perfil_id from perfil_version where id=$1', [r.perfil_version_id])).rows[0].perfil_id;
  let p = (await c.query('select id from puesto where unidad_id=$1 and perfil_id=$2 and activo for update', [r.unidad_id, perfilId])).rows[0];
  if (!p) { p = (await c.query('insert into puesto(unidad_id,perfil_id,creado_por) values($1,$2,$3) returning id', [r.unidad_id, perfilId, u && u.id])).rows[0]; await hist(c, u, 'puesto', p.id, 'crear', { origen: 'requisición ' + r.codigo }); }
  const nuevas = await crearPlazasC(c, u, p.id, { n: 1, modalidad: 'nomina', desde: null, congelada: false, motivo: 'Cargo nuevo aprobado: requisición ' + r.codigo, empresa_id: r.empresa_id }, 'requisicion', r.id);
  await c.query('update requisicion set plaza_id=$2 where id=$1', [r.id, nuevas.filas[0].id]);
  return nuevas.filas[0];
}

// ---------- Diagrama de cargos (puestos con su HC; reporta según la regla) ----------
const RANGO_EXT = { becario: 1, pasante: 2, aprendiz: 3, outsourcing: 4 }, PLURAL_EXT = { becario: 'Becarios', pasante: 'Pasantes', aprendiz: 'Aprendices', outsourcing: 'Outsourcing' };
async function diagramaPuestos(fl) {
  // Unidades: solo raíz, tipos y fecha. El filtro de empresas se aplica a las PLAZAS (la empresa vive en la plaza),
  // y el contexto sube por la línea de reporte (los jefes por encima de cada puesto que coincide).
  const dg = await ES.diagrama({ fecha: fl.fecha, raiz: fl.raiz, tipos: fl.tipos }), { f, byP } = await cargar(fl.fecha);
  const emp = new Map((await q('select id, siglas, coalesce(razon_social,nombre) razon from empresa')).rows.map(e => [e.id, e]));
  const empSet = new Set([].concat(fl.empresas || []).map(Number).filter(Boolean));
  if (fl.division) (await q('select id from empresa where division_id=$1 union select empresa_id from empresa_division_servicio where division_id=$1', [+fl.division])).rows.forEach(r => empSet.add(r.id));
  const filtra = empSet.size > 0, unidades = new Map(dg.nodes.filter(n => !n.ctx).map(n => [n.id, n]));
  const modSet = new Set((fl.mods && fl.mods.length ? fl.mods : ['nomina']));   // por defecto: solo nómina propia
  const abiertasTodas = p => p.plazas.filter(z => estado(z, f) !== 'cerrada' && (!filtra || empSet.has(z.empresa_id)));
  const abiertas = p => abiertasTodas(p).filter(z => modSet.has(z.modalidad));
  // Entra si tiene plazas de las modalidades elegidas; un puesto sin ninguna plaza (p. ej. Presidente) se muestra igual, salvo con filtro de empresa
  const match = new Set([...byP.values()].filter(p => unidades.has(p.unidad_id) && (abiertas(p).length || (!filtra && !abiertasTodas(p).length))).map(p => p.id));
  const vis = new Set(match);
  for (const id of match) { let s = byP.get(byP.get(id).reporta_id), n = 0; while (s && n++ < 60 && unidades.has(s.unidad_id)) { vis.add(s.id); s = byP.get(s.reporta_id); } }
  const nodes = [...vis].map(id => {
    const p = byP.get(id), un = unidades.get(p.unidad_id), k = contar(p.plazas, f, filtra ? empSet : null, modSet), pe = Object.entries(k.porEmp), total = k.hc + k.externas;
    let sup = byP.get(p.reporta_id), n = 0; while (sup && !vis.has(sup.id) && n++ < 60) sup = byP.get(sup.reporta_id);
    const empresas = [...new Set(abiertas(p).map(z => z.empresa_id))].map(eid => { const e = emp.get(eid) || {}; return { s: e.siglas || '', r: e.razon || '' }; });
    // Rango (fila del organigrama): el nivel jerárquico del perfil; si todas sus plazas son externas, debajo del último nivel (becario → pasante → aprendiz → outsourcing)
    const mods = abiertas(p).map(z => z.modalidad), ext = mods.length && mods.every(m => m !== 'nomina') ? Math.min(...mods.map(m => RANGO_EXT[m])) : null;
    const rango = ext != null ? 1e6 + ext : p.nivel_orden != null ? p.nivel_orden : null, rangoNombre = ext != null ? PLURAL_EXT[mods.find(m => RANGO_EXT[m] === ext)] : p.nivel_nombre;
    return { id: p.id, padre: sup ? sup.id : null, salta: !!p.reporta_id && !vis.has(p.reporta_id) && !!sup, rango, rangoNombre, nombre: p.perfil + (total > 1 ? ' (' + total + ')' : ''), tipo: (p.jefe ? '★ ' : '') + un.nombre,
      nivel: un.nivel * 10 + (p.jefe ? 0 : 5), nivelBanda: un.nivel, codigo: p.perfil_codigo, aprueba: false, aprobadores: [], ctx: !match.has(id), externa: false, propia: true, hereda: false, comparte: false,
      empresas, funcionalFuera: [], pie: [pe.length > 1 ? pe.map(([s, c]) => s + ' ' + c).join(' · ') : '', k.cong ? '❄ ' + k.cong + ' congelada' + (k.cong > 1 ? 's' : '') : '', k.proy ? '⏳ ' + k.proy + ' proyectada' + (k.proy > 1 ? 's' : '') : '', ...EXTERNAS.filter(m => k.ext[m]).map(m => k.ext[m] + ' ' + MODALIDADES[m].toLowerCase() + (k.ext[m] > 1 && m !== 'outsourcing' ? 's' : ''))].filter(Boolean).join(' · '),
      unidad_id: p.unidad_id };
  });
  const tot = contar([...match].flatMap(id => byP.get(id).plazas), f, filtra ? empSet : null, modSet);
  return { fecha: dg.fecha, esHoy: dg.esHoy, nodes, links: [], leyenda: dg.leyenda, tot };
}
// Unidades con plazas abiertas de alguna de esas empresas (para que entren al filtrar por empresa aunque no la «atiendan»)
async function unidadesConPlazas(empresas, fecha) {
  const set = new Set([].concat(empresas || []).map(Number).filter(Boolean)); if (!set.size) return null;
  const { f, byP } = await cargar(fecha), out = new Set();
  for (const p of byP.values()) if (p.plazas.some(z => set.has(z.empresa_id) && estado(z, f) !== 'cerrada')) out.add(p.unidad_id);
  return out;
}

// ---------- Carga masiva de plantilla ----------
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const key = s => String(s == null ? '' : s).trim().toLowerCase();
const COLS = [['Unidad *', 'unidad', 12], ['Unidad (nombre, referencia)', 'unidad_nombre', 34], ['Perfil *', 'perfil', 14], ['Cargo (referencia)', 'perfil_nombre', 30], ['Jefe de la unidad', 'jefe', 10],
  ['Reporta a', 'reporta', 22], ['Empresa', 'empresa', 12], ['Modalidad', 'modalidad', 15], ['Plazas *', 'plazas', 8], ['Congeladas', 'congeladas', 11], ['Proyectadas', 'proyectadas', 11], ['Fecha proyectada', 'fecha_proy', 15]];
const modDe = s => { const k = norm(s); if (!k) return 'nomina'; return Object.keys(MODALIDADES).find(m => norm(MODALIDADES[m]) === k || m === k || (m === 'nomina' && k.startsWith('nomina'))) || null; };
async function plantilla() {
  const { f, byP } = await cargar(), wb = new ExcelJS.Workbook(); wb.creator = 'Portal de Gestión Humana';
  const ins = wb.addWorksheet('Instrucciones'); ins.getColumn(1).width = 115;
  ['Carga masiva de la plantilla de puestos', '',
    '1. Este archivo trae la plantilla actual. Cada fila es un puesto (Unidad + Perfil) con un grupo de plazas de una empresa y una modalidad.',
    '2. Unidad = código de la unidad (ver Estructura). Perfil = código GH-PF-NNN o nombre exacto del perfil. Las columnas «referencia» no se leen.',
    '3. Un mismo puesto puede ocupar varias filas si tiene plazas de varias empresas o modalidades (por ejemplo, Contador: 1 de MDV y 1 de CIM).',
    '4. Plazas = cuántas plazas vigentes o congeladas debe tener ese grupo. Congeladas = cuántas de ellas están congeladas.',
    '5. Proyectadas = plazas aprobadas que empiezan en una fecha futura; indica la «Fecha proyectada».',
    '6. Empresa vacía = la empresa propia de la unidad; en unidades corporativas, «Por definir» (se fija al aprobar la requisición o al ingresar la persona). Modalidad vacía = Nómina propia.',
    '7. Reporta a = solo para excepciones, como «UNIDAD/PERFIL» (por ejemplo J-CON/GH-PF-012). Vacío = regla por defecto: el jefe de la unidad.',
    '8. Lo que el archivo dice de un puesto queda así: si hay menos plazas de las que existen, las sobrantes se cierran con fecha de hoy.',
    '   Los puestos que no están en el archivo no se tocan. Nada se borra: las plazas se cierran y quedan en el historial.'].forEach((t, i) => { const c = ins.getCell(i + 1, 1); c.value = t; if (!i) c.font = { bold: true, size: 14 }; });
  const ws = wb.addWorksheet('Plantilla', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLS.map(([header, k, width]) => ({ header, key: k, width }));
  const h = ws.getRow(1); h.font = { bold: true }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FD' } };
  for (const p of [...byP.values()].sort((a, b) => a.unidad_codigo.localeCompare(b.unidad_codigo) || (b.jefe - a.jefe))) {
    const grupos = new Map();
    for (const z of p.plazas) { const e = estado(z, f); if (e === 'cerrada') continue; const k = z.empresa_id + '|' + z.modalidad; const g = grupos.get(k) || { z, plazas: 0, cong: 0, proy: 0, fp: null }; if (e === 'proyectada') { g.proy++; g.fp = g.fp && g.fp < z.desde ? g.fp : z.desde; } else { g.plazas++; if (e === 'congelada') g.cong++; } grupos.set(k, g); }
    const rep = p.reporta_a && byP.get(p.reporta_a), base = { unidad: p.unidad_codigo, unidad_nombre: p.unidad, perfil: p.perfil_codigo, perfil_nombre: p.perfil, jefe: p.jefe ? 'Sí' : 'No', reporta: rep ? rep.unidad_codigo + '/' + rep.perfil_codigo : '' };
    if (!grupos.size) ws.addRow({ ...base, plazas: 0 });
    for (const g of grupos.values()) ws.addRow({ ...base, empresa: g.z.siglas || g.z.empresa, modalidad: MODALIDADES[g.z.modalidad], plazas: g.plazas, congeladas: g.cong || '', proyectadas: g.proy || '', fecha_proy: g.fp || '' });
  }
  ws.dataValidations.add('E2:E5000', { type: 'list', allowBlank: true, formulae: ['"Sí,No"'] });
  ws.dataValidations.add('H2:H5000', { type: 'list', allowBlank: true, formulae: ['"' + Object.values(MODALIDADES).join(',') + '"'] });
  return wb.xlsx.writeBuffer();
}
const fechaCelda = c => { const v = c.value; if (v instanceof Date) return v.toISOString().slice(0, 10); const t = String(c.text || '').trim(); let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (m) return m[0]; m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : t; };
async function leer(buffer) {
  const wb = new ExcelJS.Workbook(); try { await wb.xlsx.load(buffer); } catch (e) { throw E(400, 'No se pudo leer el archivo. Usa la plantilla en formato .xlsx'); }
  const ws = wb.getWorksheet('Plantilla'); if (!ws) throw E(400, 'El archivo no tiene la hoja «Plantilla». Descarga la plantilla');
  const idx = {}; ws.getRow(1).eachCell((c, i) => { const col = COLS.find(([hd]) => norm(hd) === norm(c.text)); if (col) idx[col[1]] = i; });
  for (const k of ['unidad', 'perfil', 'plazas']) if (!idx[k]) throw E(400, `Falta la columna «${COLS.find(x => x[1] === k)[0].replace(' *', '')}». No cambies los encabezados`);
  const filas = []; ws.eachRow((row, n) => { if (n === 1) return; const f = { fila: n }; for (const [k, i] of Object.entries(idx)) f[k] = k === 'fecha_proy' ? fechaCelda(row.getCell(i)) : String(row.getCell(i).text || '').trim();
    if (f.unidad || f.perfil) filas.push(f); });
  if (!filas.length) throw E(400, 'La hoja «Plantilla» no tiene filas'); if (filas.length > 5000) throw E(400, 'Máximo 5.000 filas por carga');
  return filas;
}
async function procesar(c, filas, usr, aplicar) {
  const errs = [], avisos = [], err = (f, m) => errs.push({ fila: f, msg: m }), aviso = (f, m) => avisos.push({ fila: f, msg: m });
  const hoy = (await c.query('select current_date::text d')).rows[0].d;
  const [us, pfs, es, ps, pz] = await Promise.all([c.query('select u.id,u.codigo,u.nombre,u.empresa_id from unidad u where u.activa').then(r => r.rows), c.query('select id,codigo,nombre from perfil where activo').then(r => r.rows),
    c.query('select id,siglas,nombre,coalesce(razon_social,nombre) razon from empresa where activa').then(r => r.rows), c.query('select * from puesto where activo').then(r => r.rows),
    c.query("select z.* from plaza z join puesto p on p.id=z.puesto_id where p.activo and (z.hasta is null or (z.hasta > current_date and z.hasta > z.desde))").then(r => r.rows)]);
  const g = await ES.grafo(), efectivas = id => ES.empresasDe(g.by.get(id) || { sirve: [] });
  const uRef = new Map(us.map(u => [key(u.codigo), u])), pfCod = new Map(pfs.map(p => [key(p.codigo), p])), pfNom = new Map(); pfs.forEach(p => pfNom.set(key(p.nombre), (pfNom.get(key(p.nombre)) || []).concat(p)));
  const eRef = new Map(); es.forEach(e => [e.siglas, e.razon, e.nombre].filter(Boolean).forEach(k => eRef.set(key(k), e)));
  const pKey = (u, p) => u + '|' + p, puestoDe = new Map(ps.map(p => [pKey(p.unidad_id, p.perfil_id), p]));
  const plan = new Map(), vistosG = new Set();
  const ent = (s, nombre, f) => { if (s === '' || s == null) return 0; const n = Number(s); if (!Number.isInteger(n) || n < 0 || n > 500) { err(f, `«${nombre}» debe ser un número entero entre 0 y 500 (vino «${s}»)`); return null; } return n; };
  for (const f of filas) {
    const n0 = errs.length, u = uRef.get(key(f.unidad)); if (!u) err(f.fila, `La unidad «${f.unidad}» no existe o está inactiva (usa el código, p. ej. UO-0016)`);
    const pfL = pfNom.get(key(f.perfil)) || [], pf = pfCod.get(key(f.perfil)) || (pfL.length === 1 ? pfL[0] : null);
    if (!pf) err(f.fila, pfL.length > 1 ? `Hay varios perfiles «${f.perfil}»: usa el código GH-PF` : `El perfil «${f.perfil}» no existe o está inactivo`);
    const jefe = norm(f.jefe); if (jefe && !['si', 'no', 's', 'n'].includes(jefe)) err(f.fila, `«Jefe de la unidad» debe ser Sí o No (vino «${f.jefe}»)`);
    const mod = modDe(f.modalidad); if (!mod) err(f.fila, `Modalidad «${f.modalidad}» inválida: ${Object.values(MODALIDADES).join(', ')}`);
    const nP = ent(f.plazas, 'Plazas', f.fila), nC = ent(f.congeladas, 'Congeladas', f.fila), nY = ent(f.proyectadas, 'Proyectadas', f.fila);
    if (nP != null && nC != null && nC > nP) err(f.fila, 'Congeladas no puede ser mayor que Plazas');
    if (nY) { if (!fechaOk(f.fecha_proy)) err(f.fila, 'Indica la «Fecha proyectada» (AAAA-MM-DD o DD/MM/AAAA)'); else if (f.fecha_proy <= hoy) err(f.fila, 'La fecha proyectada debe ser futura'); }
    let e = null;
    if (f.empresa) { e = eRef.get(key(f.empresa)); if (!e) err(f.fila, `La empresa «${f.empresa}» no existe o está inactiva`); }
    if (errs.length > n0) continue;
    const empId = e ? e.id : (u.empresa_id || null), k = pKey(u.id, pf.id);   // sin empresa en una unidad corporativa = «Por definir»
    if (empId && !efectivas(u.id).includes(empId) && empId !== u.empresa_id) aviso(f.fila, `«${u.nombre}» no atiende ni hereda ${e ? (e.siglas || e.razon) : 'esa empresa'}: revisa si la nómina es correcta`);
    const gk = k + '|' + (empId || 0) + '|' + mod; if (vistosG.has(gk)) { err(f.fila, 'Este puesto ya tiene otra fila con la misma empresa y modalidad'); continue; } vistosG.add(gk);
    const pl = plan.get(k) || { u, pf, ex: puestoDe.get(k) || null, jefe: null, reporta: null, grupos: [], fila: f.fila };
    if (f.jefe) { const j = jefe === 'si' || jefe === 's'; if (pl.jefe != null && pl.jefe !== j) err(f.fila, 'El mismo puesto tiene «Jefe» distinto en otra fila'); pl.jefe = j; }
    if (f.reporta) { if (pl.reporta != null && key(pl.reporta) !== key(f.reporta)) err(f.fila, 'El mismo puesto tiene «Reporta a» distinto en otra fila'); pl.reporta = f.reporta; }
    pl.grupos.push({ empId, mod, nP: nP || 0, nC: nC || 0, nY: nY || 0, fp: f.fecha_proy, fila: f.fila });
    plan.set(k, pl);
  }
  // Un jefe por unidad (contando los puestos que no vienen en el archivo)
  const jefeUnidad = new Map(); ps.filter(p => p.jefe && !plan.has(pKey(p.unidad_id, p.perfil_id))).forEach(p => jefeUnidad.set(p.unidad_id, 'existente'));
  for (const pl of plan.values()) { const j = pl.jefe != null ? pl.jefe : !!(pl.ex && pl.ex.jefe); pl.jefeFinal = j; if (!j) continue;
    if (jefeUnidad.has(pl.u.id)) err(pl.fila, `«${pl.u.nombre}» tendría dos puestos jefe`); else jefeUnidad.set(pl.u.id, pl); }
  // Reporta a: «UNIDAD/PERFIL»
  for (const pl of plan.values()) {
    if (!pl.reporta) continue; const [uc, pc] = pl.reporta.split('/').map(s => (s || '').trim()), u2 = uRef.get(key(uc)), p2 = pfCod.get(key(pc)) || ((pfNom.get(key(pc)) || []).length === 1 ? pfNom.get(key(pc))[0] : null);
    if (!u2 || !p2) { err(pl.fila, `«Reporta a» = «${pl.reporta}»: usa UNIDAD/PERFIL con códigos existentes`); continue; }
    const k2 = pKey(u2.id, p2.id); if (k2 === pKey(pl.u.id, pl.pf.id)) { err(pl.fila, 'Un puesto no puede reportarse a sí mismo'); continue; }
    if (!puestoDe.has(k2) && !plan.has(k2)) { err(pl.fila, `«Reporta a» = «${pl.reporta}»: ese puesto no existe ni está en el archivo`); continue; }
    pl.reportaK = k2;
  }
  // Diferencias
  const cambios = []; let altas = 0, cierres = 0, cong = 0;
  for (const pl of plan.values()) {
    const actuales = pl.ex ? pz.filter(z => z.puesto_id === pl.ex.id) : [], d = [];
    if (!pl.ex) d.push('puesto nuevo'); else { if (pl.jefe != null && pl.jefe !== pl.ex.jefe) d.push(pl.jefe ? 'pasa a jefe' : 'deja de ser jefe'); }
    pl.ops = [];
    const claves = new Set(pl.grupos.map(x => x.empId + '|' + x.mod)); actuales.forEach(z => claves.add(z.empresa_id + '|' + z.modalidad));
    for (const ck of claves) {
      const e0 = ck.split('|')[0], gr = pl.grupos.find(x => x.empId + '|' + x.mod === ck) || { empId: e0 === 'null' ? null : +e0, mod: ck.split('|')[1], nP: 0, nC: 0, nY: 0 };
      const act = actuales.filter(z => z.empresa_id + '|' + z.modalidad === ck), vig = act.filter(z => z.desde <= hoy), pro = act.filter(z => z.desde > hoy);
      const op = { gr, abrir: Math.max(0, gr.nP - vig.length), cerrar: vig.length > gr.nP ? vig.filter(z => !z.congelada).concat(vig.filter(z => z.congelada)).slice(-(vig.length - gr.nP)) : [],
        abrirY: Math.max(0, gr.nY - pro.length), cerrarY: pro.length > gr.nY ? pro.slice(-(pro.length - gr.nY)) : [] };
      const quedan = vig.filter(z => !op.cerrar.includes(z)), congAct = quedan.filter(z => z.congelada).length;
      op.congelar = gr.nC > congAct ? quedan.filter(z => !z.congelada).slice(0, gr.nC - congAct) : []; op.descongelar = congAct > gr.nC ? quedan.filter(z => z.congelada).slice(0, congAct - gr.nC) : [];
      op.congelarNuevas = Math.max(0, gr.nC - congAct - op.congelar.length);
      const s = gr.empId ? (es.find(e => e.id === gr.empId) || {}).siglas || 'empresa ' + gr.empId : POR_DEFINIR.toLowerCase(), m = gr.mod === 'nomina' ? '' : ' ' + MODALIDADES[gr.mod].toLowerCase();
      if (op.abrir) d.push(`+${op.abrir} ${s}${m}`); if (op.cerrar.length) d.push(`cierra ${op.cerrar.length} ${s}${m}`); if (op.abrirY) d.push(`+${op.abrirY} proyectada ${s}${m}`); if (op.cerrarY.length) d.push(`cancela ${op.cerrarY.length} proyectada ${s}`);
      if (op.congelar.length + op.congelarNuevas) d.push(`congela ${op.congelar.length + op.congelarNuevas}`); if (op.descongelar.length) d.push(`descongela ${op.descongelar.length}`);
      altas += op.abrir + op.abrirY; cierres += op.cerrar.length + op.cerrarY.length; cong += op.congelar.length + op.congelarNuevas + op.descongelar.length;
      pl.ops.push(op);
    }
    if (pl.ex) {   // «Reporta a» vacío en el archivo = regla por defecto (se quita la excepción)
      const r = pl.ex.reporta_a && ps.find(x => x.id === pl.ex.reporta_a), actual = r ? pKey(r.unidad_id, r.perfil_id) : null;
      if (!pl.reporta) pl.reportaK = null;
      if ((pl.reportaK || null) !== actual) d.push(pl.reportaK ? 'cambia «reporta a»' : 'vuelve a la regla por defecto'); else pl.reportaK = undefined;
    }
    if (d.length) cambios.push({ accion: pl.ex ? 'cambia' : 'nuevo', txt: `${pl.u.codigo} · ${pl.pf.nombre}`, detalle: d.filter(x => x !== 'puesto nuevo').join(', ') });
  }
  const resumen = { puestos: cambios.filter(x => x.accion === 'nuevo').length, cambian: cambios.filter(x => x.accion === 'cambia').length, altas, cierres, cong };
  if (!aplicar || errs.length) return { errs, avisos, cambios, resumen };
  // ---- Aplicar (todo en la misma transacción) ----
  const idDe = new Map(ps.map(p => [pKey(p.unidad_id, p.perfil_id), p.id]));
  for (const pl of [...plan.values()].sort((a, b) => (a.jefeFinal ? 0 : 1) - (b.jefeFinal ? 0 : 1))) {
    if (!pl.ex) { const id = (await c.query('insert into puesto(unidad_id,perfil_id,jefe,creado_por) values($1,$2,$3,$4) returning id', [pl.u.id, pl.pf.id, !!pl.jefeFinal, usr.id])).rows[0].id; idDe.set(pKey(pl.u.id, pl.pf.id), id); await hist(c, usr, 'puesto', id, 'crear', { origen: 'carga masiva' }); }
  }
  for (const pl of plan.values()) if (pl.ex && pl.jefe != null && pl.jefe !== pl.ex.jefe && !pl.jefe) await c.query('update puesto set jefe=false where id=$1', [pl.ex.id]);
  for (const pl of plan.values()) if (pl.ex && pl.jefe && !pl.ex.jefe) { await c.query('update puesto set jefe=true where id=$1', [pl.ex.id]); await hist(c, usr, 'puesto', pl.ex.id, 'editar', { jefe: true, origen: 'carga masiva' }); }
  for (const pl of plan.values()) if (pl.reportaK !== undefined) await c.query('update puesto set reporta_a=$2 where id=$1', [idDe.get(pKey(pl.u.id, pl.pf.id)), idDe.get(pl.reportaK) || null]);
  for (const pl of plan.values()) {
    const pid = idDe.get(pKey(pl.u.id, pl.pf.id));
    for (const op of pl.ops) {
      const base = { empresa_id: op.gr.empId, modalidad: op.gr.mod, motivo: 'Carga masiva de plantilla', congelada: false };
      if (op.abrir) { const nCong = Math.min(op.congelarNuevas, op.abrir); if (op.abrir - nCong) await crearPlazasC(c, usr, pid, { ...base, n: op.abrir - nCong, desde: null }, 'carga'); if (nCong) await crearPlazasC(c, usr, pid, { ...base, n: nCong, desde: null, congelada: true }, 'carga'); }
      if (op.abrirY) await crearPlazasC(c, usr, pid, { ...base, n: op.abrirY, desde: op.gr.fp }, 'carga');
      for (const z of op.cerrar.concat(op.cerrarY)) { await c.query('update plaza set hasta=greatest(current_date, desde), cerrado_por=$2, motivo_cierre=$3 where id=$1', [z.id, usr.id, 'Carga masiva de plantilla']); await hist(c, usr, 'plaza', z.id, 'cerrar', { codigo: z.codigo, origen: 'carga masiva' }); }
      for (const z of op.congelar) { await c.query('update plaza set congelada=true where id=$1', [z.id]); await hist(c, usr, 'plaza', z.id, 'congelar', { codigo: z.codigo, origen: 'carga masiva' }); }
      for (const z of op.descongelar) { await c.query('update plaza set congelada=false where id=$1', [z.id]); await hist(c, usr, 'plaza', z.id, 'descongelar', { codigo: z.codigo, origen: 'carga masiva' }); }
    }
  }
  // Ningún ciclo de reporte tras aplicar
  const { byP } = await (async () => { const r = await c.query('select p.*, pf.nombre perfil from puesto p join perfil pf on pf.id=p.perfil_id where p.activo'); const m = new Map(r.rows.map(x => [x.id, x])); resolver(m, g.by); return { byP: m }; })();
  for (const id of byP.keys()) if (cicla(byP, id)) throw E(400, 'Las líneas «Reporta a» del archivo forman un ciclo. Revísalas');
  await hist(c, usr, 'plantilla', 'carga', 'importar', resumen);
  return { errs, avisos, cambios, resumen };
}
const analizar = filas => tx(c => procesar(c, filas, null, false));
async function aplicarCarga(filas, usr) {
  return tx(async c => { const r = await procesar(c, filas, usr, true); if (r.errs.length) throw E(400, 'La plantilla cambió desde la vista previa. Vuelve a subir el archivo'); return r; });
}
module.exports = { moverPuesto, ABIERTA, POR_DEFINIR, cambiarEmpresaC, cambiarEmpresaPlaza, plazasParaSolicitud, validarPlazaC, alAprobar, __cargar: cargar, unidadesConPlazas, MODALIDADES, ESTADOS, estado, contar, resumenTxt, resumenUnidades, listar, detalle, opcionesPuestos, crearPuesto, editarPuesto, desactivarPuesto, agregarPlazas, congelar, cerrarPlaza,
  diagramaPuestos, plantilla, leer, analizar, aplicarCarga };
