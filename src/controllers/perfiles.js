const r = require('express').Router(), PF = require('../services/perfiles'), ES = require('../services/estructura'), P = require('../services/perm'), { q } = require('../db'), { w, E, flash, modal, hacer, subidaXlsx, VISTA_PREVIA_MS } = require('../util');
const gh = (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana'));
const aPerfil = id => '/perfiles?modal=' + encodeURIComponent('/perfiles/' + id);
const opciones = async () => ({ empresas: (await q('select id,nombre,razon_social,siglas from empresa where activa order by coalesce(razon_social,nombre)')).rows, unidades: await ES.opciones() });
const NIVELES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

r.get('/perfiles', gh, w(async (req, res) => {
  const f = { buscar: req.query.buscar || '', empresa: req.query.empresa || '', nivel: req.query.nivel || '', estado: req.query.estado || 'activos' };
  res.render('perfiles', { title: 'Perfiles y Cargos', nav: 'config', sub: 'cargos', ps: await PF.listar(f), f, NIVELES, codigoV: PF.codigoV, ...await opciones() });
}));
r.get('/perfiles/nuevo', gh, w(async (req, res) => modal(req, res, 'perfil_form', { title: 'Nuevo perfil', nav: 'config', sub: 'cargos', NIVELES, ...await opciones() })));
r.post('/perfiles', gh, hacer(async req => aPerfil(await PF.crear(req.user, req.body)), 'Perfil creado con su versión 01 activa', '/perfiles'));
r.get('/perfiles/plantilla.xlsx', gh, w(async (req, res) => {
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.set('Content-Disposition', 'attachment; filename="perfiles-gh.xlsx"');
  res.send(Buffer.from(await PF.plantilla()));
}));
r.get('/perfiles/carga', gh, (req, res) => res.render('perfiles_carga', { title: 'Carga masiva de cargos', nav: 'config', sub: 'cargos', res: null }));
r.post('/perfiles/carga', gh, subidaXlsx('/perfiles/carga'), w(async (req, res) => {
  try {
    if (!req.file) throw E(400, 'Selecciona el archivo');
    const filas = await PF.leer(req.file.buffer), out = await PF.analizar(filas);
    req.session.cargaPerfiles = out.errs.length ? null : { filas, en: Date.now() };
    res.render('perfiles_carga', { title: 'Carga masiva de cargos', nav: 'config', sub: 'cargos', res: { ...out, archivo: req.file.originalname } });
  } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); res.redirect('/perfiles/carga'); }
}));
r.post('/perfiles/carga/aplicar', gh, hacer(async req => {
  const c = req.session.cargaPerfiles; if (!c || Date.now() - c.en > VISTA_PREVIA_MS) throw E(400, 'La vista previa expiró. Sube el archivo de nuevo');
  delete req.session.cargaPerfiles; await PF.aplicarCarga(c.filas, req.user);
}, 'Carga de cargos aplicada', '/perfiles'));
r.get('/perfiles/:id', gh, w(async (req, res) => modal(req, res, 'perfil_detalle', { title: 'Perfil', nav: 'config', sub: 'cargos', p: await PF.detalle(+req.params.id), NIVELES, codigoV: PF.codigoV, ...await opciones() })));
r.post('/perfiles/:id/editar', gh, hacer(req => PF.editar(req.user, +req.params.id, req.body), 'Datos y alcance actualizados', req => aPerfil(req.params.id)));
r.post('/perfiles/:id/version', gh, hacer(async req => { const v = await PF.nuevaVersion(req.user, +req.params.id, req.body, req.body.activar === 'on'); return aPerfil(req.params.id); },
  'Nueva versión guardada', req => aPerfil(req.params.id)));
r.post('/perfiles/:id/versiones/:vid/activar', gh, hacer(req => PF.activarVersion(req.user, +req.params.id, +req.params.vid), 'Versión activada: las requisiciones nuevas usarán esta', req => aPerfil(req.params.id)));
r.post('/perfiles/:id/activo', gh, hacer(req => PF.activo(req.user, +req.params.id), 'Estado del perfil actualizado', req => aPerfil(req.params.id)));
module.exports = r;
