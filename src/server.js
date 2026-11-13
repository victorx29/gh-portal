const express = require('express'), session = require('express-session'), PgStore = require('connect-pg-simple')(session), helmet = require('helmet'), path = require('path'), crypto = require('crypto');
const cfg = require('./config'), { pool, q } = require('./db'), P = require('./services/perm'), outbox = require('./services/outbox'), { w } = require('./util');
require('fs').mkdirSync(cfg.uploads, { recursive: true });
const app = express();
app.locals.ic = require('./icons'); app.locals.CONFIG_NAV = require('./confignav');
app.set('trust proxy', 1); app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, 'views'));
app.use(helmet()); app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', async (_q, res) => { try { await q('select 1'); res.send('ok'); } catch (e) { res.status(500).send('db'); } });
app.use(session({ store: new PgStore({ pool }), secret: cfg.secret, resave: false, saveUninitialized: false, name: 'gh.sid',
  cookie: { httpOnly: true, sameSite: 'lax', secure: cfg.secure, maxAge: 8 * 3600e3 } }));
app.use(w(async (req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  Object.assign(res.locals, { csrf: req.session.csrf, flash: req.session.flash || null, user: null, nav: '', sub: '' }); delete req.session.flash;
  if (req.session.uid) { const u = await P.cargarUsuario(req.session.uid); if (u) req.user = res.locals.user = u; }
  if (req.method === 'POST' && ((req.body && req.body._csrf) || req.query._csrf) !== req.session.csrf) { const e = new Error('Solicitud no válida'); e.status = 403; throw e; }
  next();
}));
app.use(require('./controllers/auth'));
app.use((req, res, next) => req.user ? next() : res.redirect('/login'));
// Formularios del panel de edición del diagrama: al guardar se vuelve al mismo diagrama (mismos filtros y zoom).
// Si la acción redirigía a un modal (por ejemplo, el puesto recién creado), ese modal se abre en el panel.
app.use((req, res, next) => {
  const v = req.method === 'POST' && req.body && typeof req.body._volver === 'string' ? req.body._volver : '';
  if (/^\/config\/estructura\/diagrama(\?|$)/.test(v)) {
    const red = res.redirect.bind(res);
    res.redirect = (...args) => {
      const url = String(args[args.length - 1]), m = /[?&]modal=([^&]+)/.exec(url), u = new URL(v, 'http://portal');
      if (m) { const panel = decodeURIComponent(m[1]); if (/^\/config\/[a-z]/.test(panel)) u.searchParams.set('panel', panel); }
      return red(u.pathname + u.search);
    };
  }
  next();
});
app.use(require('./controllers/pipeline')); app.use(require('./controllers/seleccion')); app.use(require('./controllers/comunicacion')); app.use(require('./controllers/requisiciones')); app.use(require('./controllers/perfiles')); app.use(require('./controllers/estructura')); app.use(require('./controllers/plantilla')); app.use(require('./controllers/config')); app.use(require('./controllers/admin'));
app.use((req, res, next) => { const e = new Error('Página no encontrada'); e.status = 404; next(e); });
app.use((e, req, res, _n) => { if (!e.status) console.error(e); res.status(e.status || 500).render('error', { title: 'Error', msg: e.status ? e.message : 'Error interno', user: res.locals.user || null, flash: null, csrf: res.locals.csrf || '', nav: '', sub: '' }); });
app.listen(cfg.port, () => console.log('GH portal en :' + cfg.port));
outbox.start();
