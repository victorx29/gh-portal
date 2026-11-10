const r = require('express').Router(), multer = require('multer'), path = require('path'), fs = require('fs'), crypto = require('crypto'), C = require('../services/comunicacion'), cfg = require('../config'), { w, E, flash } = require('../util');
const EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
const upload = multer({
  storage: multer.diskStorage({ destination: (req, f, cb) => cb(null, cfg.uploads), filename: (req, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase()) }),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, f, cb) => EXT.includes(path.extname(f.originalname).toLowerCase()) ? cb(null, true) : cb(E(400, 'Tipo de archivo no permitido (' + EXT.join(' ') + ')'))
});
const abrir = (res, id) => res.redirect('/pipeline?abrir=' + id);
r.post('/requisiciones/:id/comentarios', w(async (req, res) => {
  try { await C.comentar(req.user, +req.params.id, req.body); flash(req, 'ok', 'Comentario agregado'); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  abrir(res, req.params.id);
}));
r.post('/requisiciones/:id/adjuntos', (req, res, next) => upload.array('archivos', 5)(req, res, err => {
  if (err) { flash(req, 'err', err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera 10 MB' : err.message); return abrir(res, req.params.id); }
  next();
}), w(async (req, res) => {
  try { await C.adjuntar(req.user, +req.params.id, req.files); flash(req, 'ok', 'Archivos adjuntados'); }
  catch (e) { (req.files || []).forEach(f => fs.unlink(f.path, () => {})); if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }   // sin archivos huérfanos
  abrir(res, req.params.id);
}));
r.get('/adjuntos/:id', w(async (req, res) => { const a = await C.descargar(req.user, +req.params.id); res.download(path.join(cfg.uploads, a.ruta), a.nombre_original); }));
module.exports = r;
