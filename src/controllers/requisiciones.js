const r = require('express').Router(), S = require('../services/requisiciones'), P = require('../services/perm'), { q } = require('../db'), { w, E, flash } = require('../util');
// Fragmento para el modal (X-Modal) o página completa si se abre el enlace directamente
const modal = (req, res, view, data) => req.get('X-Modal') ? res.render(view, data) : res.render('shell', { ...data, inner: view, nav: 'pipeline' });
const volver = (res, est) => res.redirect('/pipeline?tab=' + (['borrador', 'pend_director', 'pend_presidencia', 'rechazada'].includes(est) ? 'aprobacion' : 'principal'));

async function datosForm(u) {
  const [emp, per, are] = await Promise.all([q('select id,nombre from empresa where activa order by nombre'), q('select id,codigo,nombre from perfil where activo order by nombre'), q('select id,empresa_id,nombre from area order by nombre')]);
  return { emps: emp.rows.filter(e => P.tiene(u, 'gerente', e.id) || P.tiene(u, 'director', e.id)), pers: per.rows, areas: are.rows };
}
r.get('/requisiciones/nueva', w(async (req, res) => modal(req, res, 'req_form', { title: 'Nueva requisición', v: {}, ...await datosForm(req.user) })));
r.post('/requisiciones', w(async (req, res) => { const id = await S.crear(req.user, req.body); flash(req, 'ok', 'Requisición creada como borrador'); res.redirect('/pipeline?tab=aprobacion'); }));
r.get('/requisiciones/:id', w(async (req, res) => { const x = await S.obtener(req.user, +req.params.id); modal(req, res, 'req_detalle', { title: x.codigo, x, a: S.acciones(req.user, x) }); }));
r.get('/requisiciones/:id/editar', w(async (req, res) => {
  const x = await S.obtener(req.user, +req.params.id); if (!S.acciones(req.user, x).editar) throw E(403, 'No puedes editar');
  modal(req, res, 'req_form', { title: 'Editar', v: x, ...await datosForm(req.user) });
}));
r.post('/requisiciones/:id/editar', w(async (req, res) => { await S.actualizar(req.user, +req.params.id, req.body); flash(req, 'ok', 'Borrador actualizado'); res.redirect('/pipeline?tab=aprobacion'); }));
const accion = {
  enviar: (u, id) => S.enviar(u, id), mover: (u, id) => S.mover(u, id),
  decidir: (u, id, b) => S.decidir(u, id, b.d, b.comentario), cancelar: (u, id, b) => S.cancelar(u, id, b.motivo)
};
r.post('/requisiciones/:id/:accion', w(async (req, res) => {
  const f = accion[req.params.accion]; if (!f) throw E(404, 'Acción desconocida');
  await f(req.user, +req.params.id, req.body);
  const x = await S.obtener(req.user, +req.params.id).catch(() => null);
  flash(req, 'ok', 'Listo'); volver(res, x && x.estado);
}));
module.exports = r;
