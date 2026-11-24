const r = require('express').Router(), S = require('../services/seleccion'), EM = require('../services/empleados'), P = require('../services/perm'), { w, E, flash, modal } = require('../util');
const hacer = (fn, ok) => w(async (req, res) => {
  const id = +req.params.id; let reqId = req.body.req;
  try { await fn(req.user, id, req.body); flash(req, 'ok', ok); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  // Volver a la ficha del candidato (también desde «Confirmar ingreso», que lleva cand): no se pierde el contexto
  const cand = req.path.startsWith('/candidaturas/') ? id : /^\d+$/.test(String(req.body.cand || '')) ? +req.body.cand : null;
  res.redirect(reqId ? '/requisiciones/' + reqId + '/seleccion' + (cand ? '?modal=' + encodeURIComponent('/candidaturas/' + cand) : '') : '/pipeline');
});
r.get('/requisiciones/:id/seleccion', w(async (req, res) => res.render('seleccion', { title: 'Selección', nav: 'pipeline', ...await S.tablero(req.user, +req.params.id) })));
r.get('/requisiciones/:id/candidatos/nuevo', w(async (req, res) => { if (!P.esGH(req.user)) throw E(403, 'Solo Gestión Humana gestiona la selección');
  modal(req, res, 'cand_form', { title: 'Nuevo candidato', reqId: +req.params.id, defsCand: await require('../services/ficha').campos('candidato') }); }));
r.post('/requisiciones/:id/candidatos', w(async (req, res) => {
  try { await S.crearCandidato(req.user, +req.params.id, req.body); flash(req, 'ok', 'Candidato agregado'); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect('/requisiciones/' + req.params.id + '/seleccion');
}));
r.get('/candidaturas/:id', w(async (req, res) => modal(req, res, 'cand_detalle', { title: 'Candidato', ...await S.detalle(req.user, +req.params.id) })));
r.post('/candidaturas/:id/registro', hacer((u, id, b) => S.registrar(u, id, b), 'Registro guardado'));
r.post('/candidaturas/:id/avanzar', hacer((u, id) => S.avanzar(u, id), 'Candidato avanzó de etapa'));
r.post('/candidaturas/:id(\\d+)/campos', hacer((u, id, b) => S.guardarCampos(u, id, b), 'Datos del candidato guardados'));
r.post('/candidaturas/:id/rechazar', hacer((u, id, b) => S.rechazar(u, id, b.motivo), 'Candidatura rechazada'));
// ---- CV, consentimiento y análisis con IA (0.9) ----
const multer = require('multer'), path = require('path'), fs = require('fs'), crypto = require('crypto'), IA = require('../services/ia'), cfg = require('../config'), { nombreArchivo } = require('../util');
const LE = require('../services/lectura'), EXT_CV = LE.EXT, MB = LE.MAX_MB * 1024 * 1024;
const subeCv = multer({ storage: multer.diskStorage({ destination: (req, f, cb) => cb(null, cfg.uploads), filename: (req, f, cb) => cb(null, 'cv-' + crypto.randomUUID() + path.extname(f.originalname).toLowerCase()) }),
  limits: { fileSize: MB, files: 1 }, fileFilter: (req, f, cb) => EXT_CV.includes(path.extname(f.originalname).toLowerCase()) ? cb(null, true) : cb(E(400, 'El CV debe ser PDF, Word, texto o imagen (JPG, PNG)')) });
// Carga masiva (0.9.4): los formatos no admitidos se omiten (se informan) sin cancelar el resto
const subeLote = multer({ storage: subeCv.storage, limits: { fileSize: MB, files: LE.MAX_ARCHIVOS },
  fileFilter: (req, f, cb) => { if (EXT_CV.includes(path.extname(f.originalname).toLowerCase())) return cb(null, true); (req.omitidos = req.omitidos || []).push({ nombre: nombreArchivo(f), motivo: 'formato no admitido' }); cb(null, false); } });
const soloGH = (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana gestiona la selección'));
const volverA = (req, id) => /^\d+$/.test(String(req.body.req || '')) ? '/requisiciones/' + req.body.req + '/seleccion?modal=' + encodeURIComponent('/candidaturas/' + id) : '/pipeline';
// El permiso se valida ANTES de recibir el archivo: nadie fuera de GH escribe en el disco
r.post('/candidaturas/:id(\\d+)/cv', soloGH, (req, res, next) => subeCv.single('cv')(req, res, e => {
  if (e) { flash(req, 'err', e.code === 'LIMIT_FILE_SIZE' ? 'El CV supera 5 MB' : e.message); return res.redirect('back'); }
  next();
}), w(async (req, res) => {
  try { const cv = await IA.subirCv(req.user, +req.params.id, req.file, nombreArchivo(req.file)); const leer = await LE.pedir(req.user, cv);
    flash(req, 'ok', leer ? 'CV guardado: n8n lo lee y avisa si falta algo' : 'CV guardado'); }
  catch (e) { if (req.file) fs.unlink(req.file.path, () => {}); if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect(volverA(req, req.params.id));
}));
// ---- Carga masiva de CV, lectura en n8n y «Analizar todos» (0.9.4) ----
r.get('/requisiciones/:id(\\d+)/cv-lote', w(async (req, res) => { if (!P.esGH(req.user)) throw E(403, 'Solo Gestión Humana gestiona la selección');
  modal(req, res, 'cv_lote', { title: 'Cargar CV', reqId: +req.params.id, lectura: LE.configurada(), EXT: EXT_CV, MAX: LE.MAX_ARCHIVOS, MAX_MB: LE.MAX_MB }); }));
r.post('/requisiciones/:id(\\d+)/cv-lote', soloGH, (req, res, next) => subeLote.array('cvs', LE.MAX_ARCHIVOS)(req, res, e => {
  if (e) { (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
    flash(req, 'err', e.code === 'LIMIT_FILE_SIZE' ? `Un archivo supera ${LE.MAX_MB} MB: no se cargó ninguno. Quítalo y vuelve a intentar` : e.code === 'LIMIT_FILE_COUNT' || e.code === 'LIMIT_UNEXPECTED_FILE' ? `Máximo ${LE.MAX_ARCHIVOS} archivos por carga` : e.message);
    return res.redirect('/requisiciones/' + req.params.id + '/seleccion'); }
  next();
}), w(async (req, res) => {
  const files = (req.files || []).map(f => Object.assign(f, { nombreOk: nombreArchivo(f) }));
  try {
    const x = await LE.subirLote(req.user, +req.params.id, files, req.body, req.omitidos);
    const om = x.omitidos.map(o => `${o.nombre} (${o.motivo})`).join('; '), n = x.creados.length;
    const msg = (n ? `${n === 1 ? 'Se creó 1 candidato' : 'Se crearon ' + n + ' candidatos'} (${x.creados[0]}${n > 1 ? ' a ' + x.creados[n - 1] : ''}). ` +
      (x.lectura ? 'Los datos de cada CV llegan en unos minutos.' : 'La lectura automática no está configurada: completa los datos de cada candidato.') : '') + (om ? ' No se cargaron: ' + om : '');
    flash(req, om ? 'err' : 'ok', msg.trim());   // con omitidos el aviso queda hasta cerrarlo
  } catch (e) { files.filter(f => !f.guardado).forEach(f => fs.unlink(f.path, () => {})); if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect('/requisiciones/' + req.params.id + '/seleccion');
}));
// Estado para el tablero (0.9.5): con ?html=1 devuelve además el tablero ya dibujado, para actualizarlo sin recargar la página
r.get('/requisiciones/:id(\\d+)/seleccion/estado', w(async (req, res) => {
  if (!req.query.html) return res.json(await LE.estado(req.user, +req.params.id));
  const t = await S.tablero(req.user, +req.params.id);
  res.render('partials/seleccion_tablero', t, (e, html) => e ? res.status(500).json({ error: 'Error interno' }) : res.json({ firma: t.firma, pendientes: t.sondeo ? 1 : 0, html }));
}));
// ---- Resumen general de la selección (0.9.5): tabla comparativa + resumen y terna orientativa de la IA ----
const RES = require('../services/resumen');
r.get('/requisiciones/:id(\\d+)/resumen', w(async (req, res) => modal(req, res, 'resumen', { title: 'Resumen general', ...await RES.comparativo(req.user, +req.params.id) })));
r.post('/requisiciones/:id(\\d+)/resumen', w(async (req, res) => {
  try { await RES.solicitar(req.user, +req.params.id); flash(req, 'ok', 'Resumen pedido a la IA: llega en unos minutos y el tablero avisa'); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect('/requisiciones/' + req.params.id + '/seleccion?modal=' + encodeURIComponent('/requisiciones/' + req.params.id + '/resumen'));
}));
r.post('/requisiciones/:id(\\d+)/analizar-todos', w(async (req, res) => {
  try {
    const x = await LE.analizarTodos(req.user, +req.params.id), om = Object.entries(x.omitidos).map(([m, l]) => `${m}: ${l.join(', ')}`).join(' · '), n = x.pedidos.length;
    flash(req, n ? 'ok' : 'err', n ? `Análisis pedido para ${n} candidato${n > 1 ? 's' : ''}: los resultados llegan en unos minutos.` + (om ? ' Omitidos — ' + om : '')
      : om ? 'No se pidió ningún análisis — ' + om : 'No hay candidatos activos para analizar');
  } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect('/requisiciones/' + req.params.id + '/seleccion');
}));
r.post('/candidaturas/:id(\\d+)/datos', hacer((u, id, b) => S.editarDatos(u, id, b), 'Datos del candidato guardados'));
r.post('/cv/:id(\\d+)/leer', w(async (req, res) => {
  try { await LE.releer(req.user, +req.params.id); flash(req, 'ok', 'Lectura pedida: los datos llegan en unos minutos'); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect(volverA(req, req.body.cand));
}));
r.post('/cv/:id(\\d+)/alertas-revisadas', w(async (req, res) => {
  try { await LE.alertasRevisadas(req.user, +req.params.id); flash(req, 'ok', 'Alertas marcadas como revisadas'); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect(volverA(req, req.body.cand));
}));
r.get('/cv/:id(\\d+)', w(async (req, res) => { const a = await IA.cvDe(req.user, +req.params.id); res.download(path.join(cfg.uploads, a.ruta), a.nombre_original); }));
r.post('/candidaturas/:id(\\d+)/consentimiento', hacer((u, id, b) => IA.consentimiento(u, id, b.confirmo === 'on' ? 'GH confirmó haber notificado al postulado sobre el uso de sus datos' : b.ref, b.retirar === '1'), 'Consentimiento actualizado'));
r.post('/candidaturas/:id(\\d+)/analizar', hacer((u, id) => IA.solicitar(u, id), 'Análisis solicitado: el resultado llega en unos minutos (recarga la ficha)'));
r.post('/candidaturas/:id(\\d+)/reintentar', hacer((u, id) => IA.reintentar(u, id), 'Análisis pedido de nuevo: el resultado llega en unos minutos'));
// ---- Configuración › Análisis de CV con IA: criterios (pesos que suman 100) e instrucciones de la IA con versiones (0.9.5) ----
const PR = require('../services/ia_prompt'), soloGHc = (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana'));
const hacerU = require('../util').hacer, aConfig = (fn, ok) => hacerU(async req => { await fn(req); }, ok, '/config/ia');   // siempre vuelve a la configuración
r.get('/config/ia', soloGHc, w(async (req, res) => res.render('config_ia', { title: 'Análisis de CV con IA', nav: 'config', sub: 'ia', rs: await IA.rubricaConfig(), CAMPOS: IA.CAMPOS,
  TIPOS: PR.TIPOS, MAX: PR.MAX_INSTRUCCIONES, prompts: { analisis: await PR.activo('analisis'), resumen: await PR.activo('resumen') },
  versiones: { analisis: await PR.versiones('analisis'), resumen: await PR.versiones('resumen') } })));
r.post('/config/ia', soloGHc, aConfig(req => IA.guardarRubrica(req.user, req.body), 'Criterios guardados: se usan en los análisis nuevos'));
r.get('/config/ia/criterios/nuevo', soloGHc, w(async (req, res) => modal(req, res, 'ia_criterio', { title: 'Nuevo criterio', x: null, CAMPOS: IA.CAMPOS })));
r.post('/config/ia/criterios', soloGHc, aConfig(req => IA.crearCriterio(req.user, req.body), 'Criterio creado (inactivo y con peso 0): dale peso en la tabla y actívalo'));
r.get('/config/ia/criterios/:clave', soloGHc, w(async (req, res) => {
  const x = (await IA.rubricaConfig()).find(d => d.clave === req.params.clave); if (!x) throw E(404, 'Criterio no encontrado');
  modal(req, res, 'ia_criterio', { title: 'Editar criterio', x, CAMPOS: IA.CAMPOS });
}));
r.post('/config/ia/criterios/:clave', soloGHc, aConfig(req => IA.editarCriterio(req.user, req.params.clave, req.body), 'Criterio guardado'));
r.post('/config/ia/prompt/:tipo(analisis|resumen)', soloGHc, aConfig(req => PR.guardar(req.user, req.params.tipo, req.body), 'Instrucciones guardadas como versión nueva: se usan desde ahora'));
r.post('/config/ia/prompt/:tipo(analisis|resumen)/restaurar', soloGHc, aConfig(req => PR.guardar(req.user, req.params.tipo, {}, true), 'Original restaurado como versión nueva'));
r.get('/config/ia/prompt/:tipo(analisis|resumen)/vista', soloGHc, w(async (req, res) => modal(req, res, 'ia_prompt_vista', { title: 'Prompt completo', tipo: req.params.tipo, TIPOS: PR.TIPOS,
  ...await PR.vistaPrevia(req.user, req.params.tipo, await IA.rubricaConfig()) })));
r.get('/config/ia/prompt/:tipo(analisis|resumen)/v/:v(\\d+)', soloGHc, w(async (req, res) => modal(req, res, 'ia_prompt_version', { title: 'Versión de las instrucciones', tipo: req.params.tipo, TIPOS: PR.TIPOS,
  p: await PR.version(req.user, req.params.tipo, +req.params.v) })));

// Ingreso: GH confirma la fecha real (la persona ocupa la plaza) o registra que no se presentó
r.post('/ingresos/:id/confirmar', hacer((u, id, b) => EM.confirmarIngreso(u, id, b), 'Ingreso confirmado: la persona ocupa la plaza y su ficha quedó completa'));
r.post('/ingresos/:id/no-ingreso', hacer((u, id, b) => EM.noIngreso(u, id, b.motivo), 'Registrado: no se presentó. La plaza queda libre'));
module.exports = r;
