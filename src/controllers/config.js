const r = require('express').Router(), PL = require('../services/pipelines'), P = require('../services/perm'), { q } = require('../db'), { w, E, flash } = require('../util');
const TIPOS = ['requisicion', 'seleccion'];
r.use('/config', (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana')));
const sup = (req, res, next) => P.esSuper(req.user) ? next() : next(E(403, 'Solo el superadmin'));
const back = (res, b) => res.redirect('/config/pipelines?tipo=' + (TIPOS.includes(b.tipo) ? b.tipo : 'requisicion') + '&empresa=' + (b.empresa || ''));
async function puedePipeline(u, pid) {   // el pipeline estándar del grupo solo lo edita el superadmin
  const p = (await q('select empresa_id from pipeline where id=$1', [pid])).rows[0]; if (!p) throw E(404, 'Pipeline no encontrado');
  if (p.empresa_id == null && !P.esSuper(u)) throw E(403, 'Solo el superadmin edita el estándar del grupo');
}
const guardado = (fn, ok) => w(async (req, res) => {
  try { await fn(req); flash(req, 'ok', ok); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  back(res, req.body);
});
const deEtapa = async id => { const e = (await q('select pipeline_id from etapa where id=$1', [id])).rows[0]; if (!e) throw E(404, 'Etapa no encontrada'); return e.pipeline_id; };

r.get('/config/pipelines', w(async (req, res) => {
  const tipo = TIPOS.includes(req.query.tipo) ? req.query.tipo : 'requisicion', emp = req.query.empresa ? +req.query.empresa : null;
  const empresas = (await q('select id,coalesce(razon_social,nombre) nombre,siglas from empresa where activa order by 2')).rows;
  const p = (await q('select * from pipeline where tipo=$1 and empresa_id is not distinct from $2', [tipo, emp])).rows[0] || null;
  const etapas = p ? (await q('select * from etapa where pipeline_id=$1 and activa order by orden', [p.id])).rows : [];
  res.render('config_pipelines', { title: 'Pipelines', nav: 'config', sub: 'pipelines', tipo, emp, empresas, p, etapas, editable: !!p && (p.empresa_id != null || P.esSuper(req.user)) });
}));
r.post('/config/pipelines/clonar', guardado(req => PL.clonar(+req.body.empresa, req.body.tipo), 'Pipeline personalizado creado'));
r.post('/config/etapas', guardado(async req => { await puedePipeline(req.user, +req.body.pipeline_id); await PL.agregar(+req.body.pipeline_id, req.body.nombre, +req.body.despues_id); }, 'Columna agregada'));
r.post('/config/etapas/:id/editar', guardado(async req => { await puedePipeline(req.user, await deEtapa(+req.params.id)); await PL.editar(+req.params.id, req.body); }, 'Columna actualizada'));
r.post('/config/etapas/:id/mover', guardado(async req => { await puedePipeline(req.user, await deEtapa(+req.params.id)); await PL.mover(+req.params.id, req.body.dir); }, 'Orden actualizado'));
r.post('/config/etapas/:id/quitar', guardado(async req => { await puedePipeline(req.user, await deEtapa(+req.params.id)); await PL.quitar(+req.params.id); }, 'Columna quitada'));

// Maestros configurables (superadmin): nada de listas fijas en el código. Una pestaña por catálogo.
const MAESTROS = { grados: ['grado_instruccion', 'Grados de instrucción', 'orden, nombre'], equipos: ['catalogo_equipo', 'Equipos', 'nombre'],
  accesos: ['catalogo_acceso', 'Accesos a sistemas', 'nombre'], tipos: ['tipo_unidad', 'Tipos de unidad', 'nivel, nombre'], divisiones: ['division', 'Divisiones', 'nombre'] };
const volverM = m => '/config/maestros?m=' + (MAESTROS[m] ? m : 'grados');
r.get('/config/maestros', sup, w(async (req, res) => {
  const m = MAESTROS[req.query.m] ? req.query.m : 'grados', [t, titulo, orden] = MAESTROS[m];
  res.render('maestros', { title: titulo, nav: 'config', sub: m, m, titulo, filas: (await q(`select * from ${t} order by ${orden}`)).rows });
}));
r.post('/config/maestros/:m', sup, w(async (req, res) => {
  const m = MAESTROS[req.params.m]; if (!m) throw E(404, 'Catálogo desconocido');
  const n = String(req.body.nombre || '').trim();
  if (!n) flash(req, 'err', 'El nombre es obligatorio');
  else {
    let ins;
    if (req.params.m === 'equipos') ins = await q('insert into catalogo_equipo(nombre,requiere_linea) values($1,$2) on conflict do nothing', [n, req.body.requiere_linea === 'on']);
    else if (req.params.m === 'tipos') ins = await q('insert into tipo_unidad(nombre,nivel) values($1,$2) on conflict do nothing', [n, Math.min(999, Math.max(1, parseInt(req.body.nivel) || 50))]);
    else ins = await q(`insert into ${m[0]}(nombre) values($1) on conflict do nothing`, [n]);
    flash(req, ins.rowCount ? 'ok' : 'err', ins.rowCount ? 'Elemento agregado' : '«' + n + '» ya existe');
  }
  res.redirect(volverM(req.params.m));
}));
r.post('/config/maestros/:m/:id/activo', sup, w(async (req, res) => {
  const m = MAESTROS[req.params.m]; if (!m) throw E(404, 'Catálogo desconocido');
  await q(`update ${m[0]} set activo = not activo where id=$1`, [+req.params.id]); res.redirect(volverM(req.params.m));
}));
module.exports = r;
