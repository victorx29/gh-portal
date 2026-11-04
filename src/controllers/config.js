const r = require('express').Router(), PL = require('../services/pipelines'), P = require('../services/perm'), { q } = require('../db'), { w, E, flash } = require('../util');
const TIPOS = ['requisicion', 'seleccion'];
r.use(['/config', '/empresas'], (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana')));
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
  const empresas = (await q('select id,nombre from empresa where activa order by nombre')).rows;
  const p = (await q('select * from pipeline where tipo=$1 and empresa_id is not distinct from $2', [tipo, emp])).rows[0] || null;
  const etapas = p ? (await q('select * from etapa where pipeline_id=$1 and activa order by orden', [p.id])).rows : [];
  res.render('config_pipelines', { title: 'Pipelines', nav: 'config', tipo, emp, empresas, p, etapas, editable: !!p && (p.empresa_id != null || P.esSuper(req.user)) });
}));
r.post('/config/pipelines/clonar', guardado(req => PL.clonar(+req.body.empresa, req.body.tipo), 'Pipeline personalizado creado'));
r.post('/config/etapas', guardado(async req => { await puedePipeline(req.user, +req.body.pipeline_id); await PL.agregar(+req.body.pipeline_id, req.body.nombre, +req.body.despues_id); }, 'Columna agregada'));
r.post('/config/etapas/:id/editar', guardado(async req => { await puedePipeline(req.user, await deEtapa(+req.params.id)); await PL.editar(+req.params.id, req.body); }, 'Columna actualizada'));
r.post('/config/etapas/:id/mover', guardado(async req => { await puedePipeline(req.user, await deEtapa(+req.params.id)); await PL.mover(+req.params.id, req.body.dir); }, 'Orden actualizado'));
r.post('/config/etapas/:id/quitar', guardado(async req => { await puedePipeline(req.user, await deEtapa(+req.params.id)); await PL.quitar(+req.params.id); }, 'Columna quitada'));

// Maestro de empresas (superadmin)
r.get('/empresas', sup, w(async (req, res) => {
  const es = (await q(`select e.*, coalesce((select string_agg(nombre, ', ' order by nombre) from area where empresa_id=e.id), '') areas from empresa e order by e.nombre`)).rows;
  res.render('empresas', { title: 'Empresas', nav: 'empresas', es });
}));
r.post('/empresas', sup, w(async (req, res) => {
  const n = String(req.body.nombre || '').trim(); if (!n) throw E(400, 'El nombre es obligatorio');
  await q('insert into empresa(nombre) values($1) on conflict do nothing', [n]); flash(req, 'ok', 'Empresa guardada'); res.redirect('/empresas');
}));
r.post('/empresas/:id/activa', sup, w(async (req, res) => { await q('update empresa set activa = not activa where id=$1', [+req.params.id]); res.redirect('/empresas'); }));
r.post('/empresas/:id/areas', sup, w(async (req, res) => {
  const n = String(req.body.nombre || '').trim(); if (!n) throw E(400, 'El nombre del área es obligatorio');
  await q('insert into area(empresa_id,nombre) values($1,$2) on conflict do nothing', [+req.params.id, n]); flash(req, 'ok', 'Área agregada'); res.redirect('/empresas');
}));
// Maestros configurables (superadmin): nada de listas fijas en el código
const MAESTROS = { grados: ['grado_instruccion', 'Grados de instrucción'], equipos: ['catalogo_equipo', 'Equipos'], accesos: ['catalogo_acceso', 'Accesos a sistemas'] };
r.get('/config/maestros', sup, w(async (req, res) => {
  const d = {}; for (const [k, [t]] of Object.entries(MAESTROS)) d[k] = (await q(`select * from ${t} order by nombre`)).rows;
  res.render('maestros', { title: 'Maestros', nav: 'maestros', MAESTROS, d });
}));
r.post('/config/maestros/:m', sup, w(async (req, res) => {
  const m = MAESTROS[req.params.m]; if (!m) throw E(404, 'Maestro desconocido');
  const n = String(req.body.nombre || '').trim(); if (!n) throw E(400, 'El nombre es obligatorio');
  if (req.params.m === 'equipos') await q('insert into catalogo_equipo(nombre,requiere_linea) values($1,$2) on conflict do nothing', [n, req.body.requiere_linea === 'on']);
  else await q(`insert into ${m[0]}(nombre) values($1) on conflict do nothing`, [n]);
  flash(req, 'ok', 'Elemento agregado'); res.redirect('/config/maestros');
}));
r.post('/config/maestros/:m/:id/activo', sup, w(async (req, res) => {
  const m = MAESTROS[req.params.m]; if (!m) throw E(404, 'Maestro desconocido');
  await q(`update ${m[0]} set activo = not activo where id=$1`, [+req.params.id]); res.redirect('/config/maestros');
}));
module.exports = r;
