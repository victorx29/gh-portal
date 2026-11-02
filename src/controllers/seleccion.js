const r = require('express').Router(), S = require('../services/seleccion'), { w, E, flash, modal } = require('../util');
const hacer = (fn, ok) => w(async (req, res) => {
  const id = +req.params.id; let reqId = req.body.req;
  try { await fn(req.user, id, req.body); flash(req, 'ok', ok); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect(reqId ? '/requisiciones/' + reqId + '/seleccion' : '/pipeline');
});
r.get('/requisiciones/:id/seleccion', w(async (req, res) => res.render('seleccion', { title: 'Selección', nav: 'pipeline', ...await S.tablero(req.user, +req.params.id) })));
r.get('/requisiciones/:id/candidatos/nuevo', w(async (req, res) => modal(req, res, 'cand_form', { title: 'Nuevo candidato', reqId: +req.params.id })));
r.post('/requisiciones/:id/candidatos', w(async (req, res) => {
  try { await S.crearCandidato(req.user, +req.params.id, req.body); flash(req, 'ok', 'Candidato agregado'); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect('/requisiciones/' + req.params.id + '/seleccion');
}));
r.get('/candidaturas/:id', w(async (req, res) => modal(req, res, 'cand_detalle', { title: 'Candidato', ...await S.detalle(req.user, +req.params.id) })));
r.post('/candidaturas/:id/registro', hacer((u, id, b) => S.registrar(u, id, b), 'Registro guardado'));
r.post('/candidaturas/:id/avanzar', hacer((u, id) => S.avanzar(u, id), 'Candidato avanzó de etapa'));
r.post('/candidaturas/:id/rechazar', hacer((u, id, b) => S.rechazar(u, id, b.motivo), 'Candidatura rechazada'));
module.exports = r;
