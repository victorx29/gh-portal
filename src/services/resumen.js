// Resumen general de la selección (0.9.5): comparativo de los candidatos de una requisición y terna orientativa.
// La tabla la arma el portal con los análisis ya hechos (al instante). El texto comparativo y la terna los genera la IA en n8n
// cuando GH lo pide; cada resumen queda guardado con lo que se comparó. La IA no decide: decide Gestión Humana.
// A la IA solo viajan los números de candidato y sus análisis: nunca nombres, cédulas, correos ni teléfonos.
const crypto = require('crypto'), { q, tx } = require('../db'), P = require('./perm'), PL = require('./pipelines'), IA = require('./ia'), PR = require('./ia_prompt'), { E } = require('../util');
const ghOnly = u => { if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana gestiona la selección'); };
const VENCE_MIN = 30, MIN_CANDIDATOS = 2, MAX_TERNA = 3;
const corto = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const firmaRubrica = r => JSON.stringify((r || []).map(d => [d.clave, d.peso, d.descripcion || ''])).slice(0, 2000);

async function requisicion(c, reqId) {
  const r = (await c.query(`select r.id, r.codigo, r.estado, r.empresa_id, r.perfil_version_id, pv.contenido, pf.nombre cargo, pf.codigo perfil_codigo
    from requisicion r join perfil_version pv on pv.id=r.perfil_version_id join perfil pf on pf.id=pv.perfil_id where r.id=$1`, [reqId])).rows[0];
  if (!r) throw E(404, 'Requisición no encontrada'); return r;
}
// Candidatos activos (no rechazados ni ingresados) con el último análisis de su CV actual
async function candidatos(c, r) {
  const pl = await PL.resolver(r.empresa_id, 'seleccion', c), activas = new Map(pl.flujo.filter(e => e.clase !== 'exito').map(e => [String(e.clave), e.nombre]));
  const L = (await c.query(`select ca.id, ca.codigo, ca.etapa, cd.nombre, a.id analisis_id, a.estado ia_estado, a.puntaje, a.resultado, a.rubrica, a.prompt_id, a.solicitado_en,
      p.version prompt_version
    from candidatura ca join candidato cd on cd.id=ca.candidato_id
    left join lateral (select * from ia_analisis x where x.candidatura_id=ca.id and x.cv_archivo_id=ca.cv_archivo_id order by x.id desc limit 1) a on true
    left join ia_prompt p on p.id=a.prompt_id
    where ca.requisicion_id=$1 order by ca.correlativo`, [r.id])).rows;
  const act = L.filter(x => activas.has(String(x.etapa)));
  act.forEach(x => { x.etapa_nombre = activas.get(String(x.etapa)); x.puntaje = x.puntaje == null ? null : Number(x.puntaje); });
  return { act, fuera: L.length - act.length };
}

// ---------- Tabla comparativa (al instante, sin IA) ----------
async function comparativo(u, reqId) {
  ghOnly(u);
  const r = await requisicion({ query: q }, reqId), { act, fuera } = await candidatos({ query: q }, r);
  const listos = act.filter(x => x.ia_estado === 'listo').sort((a, b) => b.puntaje - a.puntaje || a.id - b.id);
  const resto = act.filter(x => x.ia_estado !== 'listo');
  // Columnas: los criterios de los análisis, en el orden de la rúbrica actual
  const orden = (await IA.rubricaConfig()).map(d => d.clave), cols = new Map();
  listos.forEach(x => (x.rubrica || []).forEach(d => { if (!cols.has(d.clave)) cols.set(d.clave, d.nombre); }));
  const columnas = [...cols].sort((a, b) => (orden.indexOf(a[0]) + 1 || 999) - (orden.indexOf(b[0]) + 1 || 999)).map(([clave, nombre]) => ({ clave, nombre }));
  listos.forEach(x => { const R = x.resultado || {}; x.porCriterio = Object.fromEntries((R.criterios || []).map(cr => [cr.clave, cr.puntaje]));
    x.n_alertas = (R.alertas || []).length; x.n_brechas = (R.brechas || []).length; });
  // Comparables solo si se analizaron con las mismas instrucciones y la misma rúbrica
  const avisos = [];
  const versiones = [...new Set(listos.map(x => x.prompt_version || 'anterior a 0.9.5'))];
  if (versiones.length > 1) avisos.push(`Los análisis se hicieron con versiones distintas de las instrucciones de la IA (${versiones.map(v => typeof v === 'number' ? 'v' + v : v).join(', ')}): no son del todo comparables. «Reintentar análisis» los hace con la versión activa.`);
  if (new Set(listos.map(x => firmaRubrica(x.rubrica))).size > 1) avisos.push('Los análisis se hicieron con criterios o pesos distintos: no son del todo comparables.');
  // Nombres por número de candidato (para mostrar la terna; a la IA solo viajan los números)
  const nombres = Object.fromEntries((await q('select ca.codigo, ca.id, cd.nombre from candidatura ca join candidato cd on cd.id=ca.candidato_id where ca.requisicion_id=$1', [reqId])).rows.map(x => [x.codigo, x]));
  const resumenes = await listar(reqId), actuales = new Set(listos.map(x => x.analisis_id));
  // ¿El último resumen listo compara lo mismo que hay hoy?
  const ult = resumenes.find(x => x.estado === 'listo');
  if (ult) { const antes = new Set(ult.incluidos.map(i => i.analisis_id)); ult.desactualizado = antes.size !== actuales.size || [...antes].some(i => !actuales.has(i)); }
  return { r, listos, resto, fuera, columnas, avisos, nombres, resumenes, puedePedir: listos.length >= MIN_CANDIDATOS, MIN_CANDIDATOS,
    pendiente: resumenes.some(x => x.estado === 'pendiente' && !x.vencido) };
}

// ---------- Resumen con IA (n8n) ----------
async function solicitar(u, reqId) {
  ghOnly(u);
  if (!IA.BASE()) throw E(400, 'Falta configurar PORTAL_URL (o PORTAL_URL_INTERNA): n8n no sabría dónde leer los análisis ni dónde devolver el resumen');
  return tx(async c => {
    const r = await requisicion(c, reqId); await c.query('select id from requisicion where id=$1 for update', [reqId]);
    if (r.estado !== 'seleccion') throw E(400, 'La requisición no está en Selección');
    await c.query(`update ia_resumen set estado='error', error='Sin respuesta de n8n en ${VENCE_MIN} minutos', recibido_en=now()
      where requisicion_id=$1 and estado='pendiente' and solicitado_en < now() - interval '${VENCE_MIN} minutes'`, [reqId]);
    if ((await c.query("select 1 from ia_resumen where requisicion_id=$1 and estado='pendiente'", [reqId])).rowCount) throw E(400, 'Ya hay un resumen en curso para esta requisición');
    const listos = (await candidatos(c, r)).act.filter(x => x.ia_estado === 'listo');
    if (listos.length < MIN_CANDIDATOS) throw E(400, `Hacen falta al menos ${MIN_CANDIDATOS} candidatos activos con análisis listo para comparar (hay ${listos.length})`);
    const pr = await PR.activo('resumen', c), token = crypto.randomBytes(24).toString('hex');
    const incluidos = listos.map(x => ({ candidatura_id: x.id, codigo: x.codigo, analisis_id: x.analisis_id, puntaje: x.puntaje }));
    const id = (await c.query('insert into ia_resumen(requisicion_id,prompt_id,incluidos,token,solicitado_por) values($1,$2,$3,$4,$5) returning id', [reqId, pr.id, JSON.stringify(incluidos), token, u.id])).rows[0].id;
    const url = s => IA.BASE() + '/api/ia/resumen/' + id + s + '?t=' + token;
    await c.query('insert into evento_outbox(tipo,payload) values($1,$2)', ['cv.resumen', { resumen_id: id, requisicion: r.codigo, url_datos: url(''), url_resultado: url('/resultado'), url_error: url('/error') }]);
    await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'requisicion', String(reqId), 'ia.resumen', { resumen_id: id, candidatos: incluidos.length }]);
    return id;
  });
}
async function autorizado(id, token) {
  const a = (await q('select * from ia_resumen where id=$1', [id])).rows[0];
  if (!a || !IA.iguales(a.token, token)) throw E(404, 'Resumen no encontrado');
  if (a.estado !== 'pendiente') throw E(409, 'El resumen ya terminó');
  return a;
}
async function datosParaN8n(id, token) {
  const a = await autorizado(id, token), r = await requisicion({ query: q }, a.requisicion_id);
  const ids = a.incluidos.map(x => x.analisis_id), an = new Map((await q('select id, resultado, rubrica from ia_analisis where id = any($1)', [ids])).rows.map(x => [x.id, x]));
  const cands = a.incluidos.map(x => { const R = (an.get(x.analisis_id) || {}).resultado || {};
    return { codigo: x.codigo, puntaje: x.puntaje, criterios: (R.criterios || []).map(cr => ({ nombre: cr.nombre, puntaje: cr.puntaje, evidencia: corto(cr.evidencia, 300) })),
      resumen: corto(R.resumen, 1200), fortalezas: (R.fortalezas || []).slice(0, 6), brechas: (R.brechas || []).slice(0, 6), alertas: (R.alertas || []).slice(0, 3) }; });
  const c = r.contenido || {}, perfil = { codigo: r.perfil_codigo, cargo: r.cargo, objetivo: c.objetivo || '' };
  const dims = IA.dimsDe(await IA.rubricaConfig(), c), pr = (await q('select * from ia_prompt where id=$1', [a.prompt_id])).rows[0];
  return { resumen_id: a.id, tipo: 'resumen', requisicion: r.codigo, codigos: cands.map(x => x.codigo), prompt: PR.armarResumen(pr, perfil, dims, cands) };
}
async function recibirResultado(id, token, b) {
  const a = await autorizado(id, token); b = b || {};
  const x = b.respuesta && typeof b.respuesta === 'object' ? b.respuesta : b, validos = new Set(a.incluidos.map(i => i.codigo));
  const resumen = corto(x.resumen, 3000); if (!resumen) throw E(400, 'Falta el resumen');
  const terna = [], vistos = new Set();
  for (const t of (Array.isArray(x.terna) ? x.terna : []).slice(0, MAX_TERNA)) {
    const cod = corto(t && t.candidato, 40);
    if (!validos.has(cod)) throw E(400, `La terna nombra un candidato que no está en la comparación: «${cod}»`);
    if (vistos.has(cod)) continue; vistos.add(cod);
    terna.push({ candidato: cod, motivo: corto(t.motivo, 600) });
  }
  const arr = (v, n, m) => (Array.isArray(v) ? v : []).slice(0, n).map(s => corto(s, m)).filter(Boolean);
  const resultado = { resumen, terna, verificar: arr(x.verificar, 8, 300), alertas: arr(x.alertas, 5, 300) };
  await q(`update ia_resumen set estado='listo', resultado=$2, modelo=$3, recibido_en=now() where id=$1`, [id, resultado, corto(b.modelo || x.modelo, 120) || null]);
  return { ok: true, terna: terna.length };
}
async function recibirError(id, token, b) {
  await autorizado(id, token);
  await q(`update ia_resumen set estado='error', error=$2, recibido_en=now() where id=$1`, [id, corto((b || {}).mensaje || 'Error sin detalle', 1000)]);
  return { ok: true };
}
const listar = reqId => q(`select s.*, u.nombre solicitado_por_nombre, p.version prompt_version,
    (s.estado='pendiente' and s.solicitado_en < now() - interval '${VENCE_MIN} minutes') vencido
  from ia_resumen s left join usuario u on u.id=s.solicitado_por join ia_prompt p on p.id=s.prompt_id where s.requisicion_id=$1 order by s.id desc`, [reqId]).then(r => r.rows);

module.exports = { comparativo, solicitar, datosParaN8n, recibirResultado, recibirError, listar, VENCE_MIN };
