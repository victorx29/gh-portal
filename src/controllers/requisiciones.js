const r = require('express').Router(), S = require('../services/requisiciones'), ES = require('../services/estructura'), PF = require('../services/perfiles'), C = require('../services/comunicacion'), P = require('../services/perm'), { q } = require('../db'), { w, E, flash, modal } = require('../util');
const APROB = ['borrador', 'pend_director', 'pend_presidencia', 'rechazada', 'anulada'];
// El formulario ofrece solo las unidades (y empresas) para las que el usuario puede solicitar
async function datosForm(u) {
  const [emp, per, gra, eqp, acc, unidades] = await Promise.all([q('select id,coalesce(razon_social,nombre) nombre,siglas from empresa where activa order by 2'), PF.paraFormulario().then(rows => ({ rows })),
    q('select id,nombre from grado_instruccion where activo order by orden,nombre'), q('select id,nombre,requiere_linea from catalogo_equipo where activo order by nombre'), q('select id,nombre from catalogo_acceso where activo order by nombre'), ES.alcanceSolicitud(u)]);
  const ids = new Set(unidades.flatMap(x => x.empresas));
  return { emps: emp.rows.filter(e => ids.has(e.id)), pers: per.rows, unidades, grados: gra.rows, equipos: eqp.rows, accesos: acc.rows };
}
r.get('/requisiciones/nueva', w(async (req, res) => modal(req, res, 'req_form', { title: 'Nueva requisición', v: {}, ...await datosForm(req.user) })));
r.post('/requisiciones', w(async (req, res) => {
  try { await S.guardar(req.user, null, req.body); flash(req, 'ok', 'Requisición creada como borrador'); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect('/pipeline?tab=aprobacion');
}));
r.get('/requisiciones/:id', w(async (req, res) => {
  const x = await S.obtener(req.user, +req.params.id);
  const [a, com, adj, linea, aps] = await Promise.all([S.acciones(req.user, x), C.comentarios(req.user, x.id), C.adjuntos(x.id), C.lineaTiempo(req.user, x), S.aprobaciones(x.id)]);
  modal(req, res, 'req_detalle', { title: x.codigo, x, a, com, adj, linea, aps });
}));
r.get('/requisiciones/:id/editar', w(async (req, res) => {
  const x = await S.obtener(req.user, +req.params.id); if (!(await S.acciones(req.user, x)).editar) throw E(403, 'No puedes editar');
  modal(req, res, 'req_form', { title: 'Editar', v: x, ...await datosForm(req.user) });
}));
r.post('/requisiciones/:id/editar', w(async (req, res) => {
  try { await S.guardar(req.user, +req.params.id, req.body); flash(req, 'ok', 'Borrador actualizado'); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect('/pipeline?tab=aprobacion');
}));
// Vista previa del perfil (segundo modal) y solicitud de un perfil nuevo a GH
r.get('/perfiles/:id/vista', w(async (req, res) => {
  const p = (await q(`select p.id,p.codigo,p.nombre,p.nivel,pv.version,pv.contenido from perfil p join perfil_version pv on pv.id=p.version_activa_id where p.id=$1 and p.activo`, [+req.params.id])).rows[0];
  if (p) p.codigoV = PF.codigoV(p.codigo, p.version);
  res.locals.RESP = PF.RESP;
  if (!p) throw E(404, 'Perfil no encontrado'); modal(req, res, 'perfil_vista', { title: p.nombre, p });
}));
r.post('/perfiles/:id/solicitar', w(async (req, res) => {
  const p = (await q('select nombre, codigo from perfil where id=$1', [+req.params.id])).rows[0]; if (!p) throw E(404, 'Perfil no encontrado');
  const nota = String(req.body.nota || '').trim(); if (!nota) { flash(req, 'err', 'Explica qué debe cambiar o crearse'); return res.redirect('/pipeline'); }
  await q('insert into evento_outbox(tipo,payload) values($1,$2)', ['perfil.solicitado', { perfil_id: +req.params.id, perfil: p.nombre, perfil_codigo: p.codigo, solicitante: req.user.nombre, email: req.user.email, nota, url: process.env.PORTAL_URL ? String(process.env.PORTAL_URL).replace(/\/+$/, '') + '/perfiles?modal=' + encodeURIComponent('/perfiles/' + req.params.id) : null }]);
  await q('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [req.user.id, 'perfil', String(req.params.id), 'solicitar', { nota }]);
  flash(req, 'ok', 'Solicitud enviada a Gestión Humana'); res.redirect('/pipeline');
}));
const accion = { enviar: (u, id) => S.enviar(u, id), mover: (u, id) => S.mover(u, id), decidir: (u, id, b) => S.decidir(u, id, b.d, b.comentario), cancelar: (u, id, b) => S.cancelar(u, id, b.motivo),
  registro: (u, id, b) => S.registrar(u, id, b), eliminar: (u, id) => S.eliminar(u, id), anular: (u, id, b) => S.anular(u, id, b.motivo) };
r.post('/requisiciones/:id/:accion', w(async (req, res) => {
  const f = accion[req.params.accion]; if (!f) throw E(404, 'Acción desconocida');
  try { await f(req.user, +req.params.id, req.body); flash(req, 'ok', req.params.accion === 'eliminar' ? 'Borrador eliminado' : 'Listo'); }
  catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  const x = await S.obtener(req.user, +req.params.id).catch(() => null);
  res.redirect('/pipeline?tab=' + (!x || APROB.includes(x.estado) ? 'aprobacion' : 'principal'));
}));
module.exports = r;
