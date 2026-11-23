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
const EXT_CV = ['.pdf', '.docx', '.txt'];
const subeCv = multer({ storage: multer.diskStorage({ destination: (req, f, cb) => cb(null, cfg.uploads), filename: (req, f, cb) => cb(null, 'cv-' + crypto.randomUUID() + path.extname(f.originalname).toLowerCase()) }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (req, f, cb) => EXT_CV.includes(path.extname(f.originalname).toLowerCase()) ? cb(null, true) : cb(E(400, 'El CV debe ser PDF, Word (.docx) o texto')) });
const soloGH = (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana gestiona la selección'));
const volverA = (req, id) => /^\d+$/.test(String(req.body.req || '')) ? '/requisiciones/' + req.body.req + '/seleccion?modal=' + encodeURIComponent('/candidaturas/' + id) : '/pipeline';
// El permiso se valida ANTES de recibir el archivo: nadie fuera de GH escribe en el disco
r.post('/candidaturas/:id(\\d+)/cv', soloGH, (req, res, next) => subeCv.single('cv')(req, res, e => {
  if (e) { flash(req, 'err', e.code === 'LIMIT_FILE_SIZE' ? 'El CV supera 5 MB' : e.message); return res.redirect('back'); }
  next();
}), w(async (req, res) => {
  try { await IA.subirCv(req.user, +req.params.id, req.file, nombreArchivo(req.file)); flash(req, 'ok', 'CV guardado'); }
  catch (e) { if (req.file) fs.unlink(req.file.path, () => {}); if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect(volverA(req, req.params.id));
}));
r.get('/cv/:id(\\d+)', w(async (req, res) => { const a = await IA.cvDe(req.user, +req.params.id); res.download(path.join(cfg.uploads, a.ruta), a.nombre_original); }));
r.post('/candidaturas/:id(\\d+)/consentimiento', hacer((u, id, b) => IA.consentimiento(u, id, b.ref, b.retirar === '1'), 'Consentimiento actualizado'));
r.post('/candidaturas/:id(\\d+)/analizar', hacer((u, id) => IA.solicitar(u, id), 'Análisis solicitado: el resultado llega en unos minutos (recarga la ficha)'));
r.get('/config/ia', w(async (req, res) => { if (!P.esGH(req.user)) throw E(403, 'Solo Gestión Humana'); res.render('config_ia', { title: 'Análisis de CV con IA', nav: 'config', sub: 'ia', rs: await IA.rubricaConfig() }); }));
r.post('/config/ia', w(async (req, res) => {
  try { await IA.guardarRubrica(req.user, req.body); flash(req, 'ok', 'Rúbrica guardada: se usa en los análisis nuevos'); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect('/config/ia');
}));

// Ingreso: GH confirma la fecha real (la persona ocupa la plaza) o registra que no se presentó
r.post('/ingresos/:id/confirmar', hacer((u, id, b) => EM.confirmarIngreso(u, id, b), 'Ingreso confirmado: la persona ocupa la plaza y su ficha quedó completa'));
r.post('/ingresos/:id/no-ingreso', hacer((u, id, b) => EM.noIngreso(u, id, b.motivo), 'Registrado: no se presentó. La plaza queda libre'));
module.exports = r;
