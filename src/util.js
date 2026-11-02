const w = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);
const E = (status, msg) => Object.assign(new Error(msg), { status });
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };
// Fragmento para el modal (cabecera X-Modal) o página completa si se abre el enlace directamente
const modal = (req, res, view, data) => req.get('X-Modal') ? res.render(view, data) : res.render('shell', { ...data, inner: view, nav: data.nav || 'pipeline' });
module.exports = { w, E, flash, modal };
