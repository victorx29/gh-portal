const { q } = require('../db'), P = require('./perm'), PL = require('./pipelines'), RS = require('./requisiciones'), { E } = require('../util');
// Comentarios del proceso: visibles para todos los involucrados. Notas internas (ambito gh): solo GH.
async function comentarios(u, id) {
  return (await q(`select c.*, us.nombre autor from comentario c join usuario us on us.id=c.autor_id where c.entidad='requisicion' and c.entidad_id=$1 ${P.esGH(u) ? '' : "and c.ambito='proceso'"} order by c.id`, [id])).rows;
}
async function comentar(u, id, b) {
  const x = await RS.obtener(u, id), t = String(b.texto || '').trim(); if (!t) throw E(400, 'Escribe un comentario');
  const ambito = b.ambito === 'gh' && P.esGH(u) ? 'gh' : 'proceso';
  await q('insert into comentario(entidad,entidad_id,ambito,autor_id,texto) values($1,$2,$3,$4,$5)', ['requisicion', id, ambito, u.id, t]);
  if (ambito === 'proceso') await q('insert into evento_outbox(tipo,payload) values($1,$2)', ['requisicion.comentario', { requisicion_id: id, codigo: x.codigo, empresa_id: x.empresa_id, autor: u.nombre, texto: t }]);
}
const adjuntos = id => q("select a.*, us.nombre autor from adjunto a join usuario us on us.id=a.subido_por where a.entidad='requisicion' and a.entidad_id=$1 order by a.id", [id]).then(r => r.rows);
async function adjuntar(u, id, files) {
  await RS.obtener(u, id); if (!files || !files.length) throw E(400, 'Selecciona al menos un archivo');
  for (const f of files) await q('insert into adjunto(entidad,entidad_id,nombre_original,ruta,mime,tamano,subido_por) values($1,$2,$3,$4,$5,$6,$7)', ['requisicion', id, f.originalname, f.filename, f.mimetype, f.size, u.id]);
  await RS.hist({ query: q }, u, id, 'adjuntar', { archivos: files.map(f => f.originalname) });
}
async function descargar(u, adjId) {
  const a = (await q('select * from adjunto where id=$1', [adjId])).rows[0]; if (!a) throw E(404, 'Archivo no encontrado');
  await RS.obtener(u, a.entidad_id); return a;   // mismo permiso que la requisición
}
const PASO = { director: 'Director', presidencia: 'Presidencia' }, DEC = { aprobada: 'aprobó', devuelta: 'devolvió', rechazada: 'rechazó' };
function etiqueta(h, nom) {
  const d = h.detalle || {}, n = k => nom[k] || k, m = /^(director|presidencia)\.(aprobada|devuelta|rechazada)$/.exec(h.accion);
  if (m) return [PASO[m[1]] + ' ' + DEC[m[2]], d.comentario || ''];
  switch (h.accion) {
    case 'crear': return ['Creó la requisición', ''];
    case 'editar': return ['Editó el borrador', ''];
    case 'enviar': return ['Envió a aprobación', ['Estado: ' + n(d.a), d.aprobadora ? 'Aprueba: ' + d.aprobadora : d.regla === 'empresa' ? 'Aprueba: director de la empresa (regla de transición)' : ''].filter(Boolean).join(' · ')];
    case 'mover': return ['Avanzó a «' + n(d.a) + '»', 'Desde «' + n(d.de) + '»'];
    case 'registro': return ['Registró la etapa «' + d.etapa + '»', [d.resultado && 'Resultado: ' + d.resultado, ...(d.checklist || []).map(x => '✓ ' + x), d.nota].filter(Boolean).join(' · ')];
    case 'cancelar': return ['Canceló la requisición', d.motivo || ''];
    case 'anular': return ['Anuló el borrador', d.motivo || ''];
    case 'plazas_cubiertas': return ['Plazas cubiertas: pasó a Ingreso', ''];
    case 'adjuntar': return ['Adjuntó archivos', (d.archivos || []).join(', ')];
    default: return [h.accion, ''];
  }
}
async function lineaTiempo(u, x) {
  const pl = await PL.resolver(x.empresa_id, 'requisicion');
  const nom = { borrador: 'Borrador', pend_director: 'Pendiente de Director', pend_presidencia: 'Pendiente de Presidencia', rechazada: 'Rechazada', anulada: 'Anulada' };
  pl.etapas.forEach(e => { nom[e.clave] = e.nombre; });
  const hs = (await q("select h.*, us.nombre autor from historial h left join usuario us on us.id=h.usuario_id where h.entidad='requisicion' and h.entidad_id=$1", [String(x.id)])).rows
    .map(h => { const [titulo, detalle] = etiqueta(h, nom); return { fecha: h.fecha, autor: h.autor, titulo, detalle }; });
  const cs = (await comentarios(u, x.id)).map(c => ({ fecha: c.creado_en, autor: c.autor, titulo: c.ambito === 'gh' ? 'Nota interna de GH' : 'Comentó', detalle: c.texto }));
  return hs.concat(cs).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}
module.exports = { comentarios, comentar, adjuntos, adjuntar, descargar, lineaTiempo };
