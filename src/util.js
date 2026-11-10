const w = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);
const E = (status, msg) => Object.assign(new Error(msg), { status });
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };
// Fragmento para el modal (cabecera X-Modal) o página completa si se abre el enlace directamente
const modal = (req, res, view, data) => req.get('X-Modal') ? res.render(view, data) : res.render('shell', { ...data, inner: view, nav: data.nav || 'pipeline' });
// Acción de formulario: ejecuta, deja el aviso y redirige. Los errores de negocio (4xx) vuelven como aviso, no como página de error.
// fn puede devolver una ruta para redirigir a otro lugar.
const hacer = (fn, ok, volver) => w(async (req, res) => {
  let dest = typeof volver === 'function' ? volver(req) : volver;
  try { const x = await fn(req); if (typeof x === 'string') dest = x; flash(req, 'ok', ok); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect(dest);
});
// Subida de un Excel .xlsx en memoria (máx. 5 MB). Si falla, vuelve a `volver` con el motivo.
const subidaXlsx = volver => {
  const multer = require('multer'), path = require('path');
  const m = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, f, cb) => path.extname(f.originalname).toLowerCase() === '.xlsx' ? cb(null, true) : cb(E(400, 'Sube la plantilla en formato .xlsx')) });
  return (req, res, next) => m.single('archivo')(req, res, e => { if (e) { flash(req, 'err', e.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera 5 MB' : e.message); return res.redirect(volver); } next(); });
};
// Una vista previa de carga vive 30 minutos en la sesión
const VISTA_PREVIA_MS = 30 * 60e3;
module.exports = { w, E, flash, modal, hacer, subidaXlsx, VISTA_PREVIA_MS };
