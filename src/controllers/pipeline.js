const r = require('express').Router(), S = require('../services/requisiciones'), PL = require('../services/pipelines'), P = require('../services/perm'), { q } = require('../db'), { w } = require('../util');
const APROB = [['borrador', 'Borrador'], ['pend_director', 'Director'], ['pend_presidencia', 'Presidencia'], ['rechazada', 'Rechazada'], ['anulada', 'Anulada']];
r.get('/pipeline', w(async (req, res) => {
  const tab = req.query.tab === 'aprobacion' ? 'aprobacion' : 'principal', emp = req.query.empresa || '';
  const reqs = await S.listar(req.user, emp);
  const cols = tab === 'aprobacion' ? APROB : (await PL.columnas('requisicion', emp)).map(e => [e.clave, e.nombre]);
  const empresas = (await q('select id,nombre from empresa where activa order by nombre')).rows.filter(e => P.esGH(req.user) || req.user.roles.some(x => x.empresa_id == null || x.empresa_id == e.id));
  const n = f => reqs.filter(f).length, previas = APROB.map(c => c[0]);
  res.render('pipeline', { title: 'Pipeline', nav: 'pipeline', tab, emp, empresas, cols, reqs,
    kpi: { activas: n(x => !['ingreso', 'cancelado', 'rechazada', 'anulada'].includes(x.estado)), aprob: n(x => ['pend_director', 'pend_presidencia'].includes(x.estado)),
      mias: n(x => x.pendiente), recl: n(x => !previas.includes(x.estado) && !['ingreso', 'cancelado'].includes(x.estado)) } });
}));
module.exports = r;
