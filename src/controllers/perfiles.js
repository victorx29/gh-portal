const r = require('express').Router(), multer = require('multer'), path = require('path'), PF = require('../services/perfiles'), IDX = require('../services/importar_docx'), PL = require('../services/plantilla'), ES = require('../services/estructura'), P = require('../services/perm'), { q } = require('../db'), { w, E, flash, modal, hacer, subidaXlsx, VISTA_PREVIA_MS, nombreArchivo } = require('../util');
const gh = (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana'));
const aPerfil = id => '/perfiles?modal=' + encodeURIComponent('/perfiles/' + id);
const opciones = async () => ({ niveles: await PF.nivelesJ(), empresas: (await q('select id,nombre,razon_social,siglas from empresa where activa order by coalesce(razon_social,nombre)')).rows, unidades: await ES.opciones() });
const NIVELES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

r.get('/perfiles', gh, w(async (req, res) => {
  const f = { buscar: req.query.buscar || '', empresa: req.query.empresa || '', nivel: req.query.nivel || '', estado: req.query.estado || 'activos',
    alcance: /^(general|sin|u\d+)$/.test(req.query.alcance || '') ? req.query.alcance : '', sub: req.query.alcance ? req.query.sub === '1' : true };
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
    res.render('perfiles_carga', { title: 'Carga masiva de cargos', nav: 'config', sub: 'cargos', res: { ...out, archivo: nombreArchivo(req.file) } });
  } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); res.redirect('/perfiles/carga'); }
}));
r.post('/perfiles/carga/aplicar', gh, hacer(async req => {
  const c = req.session.cargaPerfiles; if (!c || Date.now() - c.en > VISTA_PREVIA_MS) throw E(400, 'La vista previa expiró. Sube el archivo de nuevo');
  delete req.session.cargaPerfiles; await PF.aplicarCarga(c.filas, req.user);
}, 'Carga de cargos aplicada', '/perfiles'));
// ---- Importar descripciones de cargo (.docx) ----
const docs = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: IDX.MAX },
  fileFilter: (req, f, cb) => path.extname(f.originalname).toLowerCase() === '.docx' ? cb(null, true) : cb(E(400, '«' + f.originalname + '» no es .docx')) });
r.get('/perfiles/importar-docx', gh, w(async (req, res) => {
  const s = req.session.importDocx, vigente = s && Date.now() - s.en < VISTA_PREVIA_MS;
  res.render('perfiles_docx', { title: 'Importar descripciones de cargo', nav: 'config', sub: 'cargos', res: vigente ? await IDX.evaluar(s.filas) : null, alc: vigente ? s.alcance : {}, ...await opciones() });
}));
r.post('/perfiles/importar-docx', gh, (req, res, next) => docs.array('archivos', IDX.MAX)(req, res, e => {
  if (e) { flash(req, 'err', e.code === 'LIMIT_FILE_SIZE' ? 'Un archivo supera 5 MB' : e.code === 'LIMIT_FILE_COUNT' ? 'Máximo ' + IDX.MAX + ' archivos por carga' : e.message); return res.redirect('/perfiles/importar-docx'); } next();
}), hacer(async req => { const out = await IDX.analizar(req.files || []); req.session.importDocx = { filas: out.filas, en: Date.now(), alcance: {} }; }, 'Documentos leídos: revisa la vista previa', '/perfiles/importar-docx'));
const alcanceDe = b => ({ general: b.alcance === 'general', empresas: [], unidades: b.alcance === 'unidad' && b.unidad_id ? [+b.unidad_id] : [], tipo: b.alcance, unidad_id: b.unidad_id });
r.post('/perfiles/importar-docx/revisar', gh, hacer(async req => {
  const s = req.session.importDocx; if (!s) throw E(400, 'La vista previa expiró. Sube los documentos de nuevo');
  s.filas.forEach(f => { if (f.ok && req.body['nombre_' + f.i] != null) f.nombre = String(req.body['nombre_' + f.i]).trim(); }); s.alcance = alcanceDe(req.body);
}, 'Vista previa actualizada', '/perfiles/importar-docx'));
r.post('/perfiles/importar-docx/aplicar', gh, w(async (req, res) => {
  const s = req.session.importDocx;
  if (!s || Date.now() - s.en > VISTA_PREVIA_MS) { flash(req, 'err', 'La vista previa expiró. Sube los documentos de nuevo'); return res.redirect('/perfiles/importar-docx'); }
  const alc = alcanceDe(req.body);
  if (alc.tipo === 'unidad' && !alc.unidades.length) { flash(req, 'err', 'Elige la unidad para el alcance de los perfiles nuevos'); return res.redirect('/perfiles/importar-docx'); }
  try { const x = await IDX.aplicar(s.filas, req.body, alc, req.user); delete req.session.importDocx; flash(req, 'ok', `Importación aplicada: ${x.nuevos} perfil(es) nuevo(s) y ${x.versiones} versión(es) nueva(s)`); res.redirect('/perfiles'); }
  catch (e) { if (!e.status || e.status >= 500) throw e; s.filas.forEach(f => { if (f.ok && req.body['nombre_' + f.i] != null) f.nombre = String(req.body['nombre_' + f.i]).trim(); }); s.alcance = alc; flash(req, 'err', e.message); res.redirect('/perfiles/importar-docx'); }
}));
r.post('/perfiles/importar-docx/descartar', gh, hacer(async req => { delete req.session.importDocx; }, 'Importación descartada', '/perfiles/importar-docx'));

// ---- Descripción de cargo para imprimir (formato de GH). Unidad, dirección y «Reporta a» salen de la plantilla. ----
r.get('/perfiles/:id/descripcion', gh, w(async (req, res) => {
  const p = await PF.detalle(+req.params.id), v = p.versiones.find(x => String(x.version) === String(req.query.v)) || p.versiones.find(x => x.id === p.version_activa_id) || p.versiones[0];
  if (!v) throw E(404, 'El perfil no tiene versiones');
  const { byP, g } = await PL.__cargar(), puestos = [...byP.values()].filter(x => x.perfil_id === p.id).map(x => {
    let u = g.by.get(x.unidad_id), dir = null, n = 0; while (u && n++ < 60) { if (/^(direcci|divisi|presidencia|gerencia general)/i.test(u.tipo)) { dir = u; break; } u = g.by.get(u.padre_id); }
    const r = byP.get(x.reporta_id); return { id: x.id, unidad: x.unidad, direccion: dir ? dir.nombre : null, reporta: r ? r.perfil : null };
  });
  const sel = puestos.find(x => String(x.id) === String(req.query.puesto)) || puestos[0] || null;
  res.render('perfil_descripcion', { title: 'Descripción de cargo · ' + p.nombre, p, v, ctl: (await PF.controles([v.id])).get(v.id) || {}, puestos, sel, codigoV: PF.codigoV, RESP: PF.RESP });
}));
r.post('/perfiles/:id/versiones/:vid/control', gh, hacer(req => PF.guardarControl(req.user, +req.params.id, +req.params.vid, req.body), 'Control documental guardado', req => aPerfil(req.params.id)));
r.get('/perfiles/:id', gh, w(async (req, res) => { const p = await PF.detalle(+req.params.id); modal(req, res, 'perfil_detalle', { title: 'Perfil', nav: 'config', sub: 'cargos', p, ctl: await PF.controles(p.versiones.map(v => v.id)), NIVELES, codigoV: PF.codigoV, RESP: PF.RESP, ...await opciones() }); }));
r.post('/perfiles/:id/editar', gh, hacer(req => PF.editar(req.user, +req.params.id, req.body), 'Datos y alcance actualizados', req => aPerfil(req.params.id)));
r.post('/perfiles/:id/version', gh, hacer(async req => { const v = await PF.nuevaVersion(req.user, +req.params.id, req.body, req.body.activar === 'on'); return aPerfil(req.params.id); },
  'Nueva versión guardada', req => aPerfil(req.params.id)));
r.post('/perfiles/:id/versiones/:vid/activar', gh, hacer(req => PF.activarVersion(req.user, +req.params.id, +req.params.vid), 'Versión activada: las requisiciones nuevas usarán esta', req => aPerfil(req.params.id)));
r.post('/perfiles/:id/activo', gh, hacer(req => PF.activo(req.user, +req.params.id), 'Estado del perfil actualizado', req => aPerfil(req.params.id)));
module.exports = r;
