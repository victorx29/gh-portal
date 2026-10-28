const r = require('express').Router(), S = require('../services/requisiciones'), P = require('../services/perm'), { q } = require('../db'), { w } = require('../util');
const COLS = {
  principal: [['aprobado', 'Aprobado'], ['publicacion', 'Publicación'], ['convocatoria', 'Convocatoria'], ['seleccion', 'Selección'], ['ingreso', 'Ingreso'], ['cancelado', 'Cancelado']],
  aprobacion: [['borrador', 'Borrador'], ['pend_director', 'Director'], ['pend_presidencia', 'Presidencia'], ['rechazada', 'Rechazada']]
};
r.get('/pipeline', w(async (req, res) => {
  const tab = req.query.tab === 'aprobacion' ? 'aprobacion' : 'principal', emp = req.query.empresa || '';
  const reqs = await S.listar(req.user, emp);
  const empresas = (await q('select id,nombre from empresa where activa order by nombre')).rows.filter(e => P.esGH(req.user) || req.user.roles.some(x => x.empresa_id == null || x.empresa_id == e.id));
  const n = f => reqs.filter(f).length;
  res.render('pipeline', { title: 'Pipeline', nav: 'pipeline', tab, emp, empresas, cols: COLS[tab], reqs,
    kpi: { activas: n(x => !['ingreso', 'cancelado', 'rechazada'].includes(x.estado)), aprob: n(x => ['pend_director', 'pend_presidencia'].includes(x.estado)),
      mias: n(x => x.pendiente), recl: n(x => ['aprobado', 'publicacion', 'convocatoria', 'seleccion'].includes(x.estado)) } });
}));
module.exports = r;
