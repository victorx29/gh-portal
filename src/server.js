const express = require('express'), session = require('express-session'), PgStore = require('connect-pg-simple')(session), helmet = require('helmet'), path = require('path'), crypto = require('crypto');
const cfg = require('./config'), { pool, q } = require('./db'), P = require('./services/perm'), outbox = require('./services/outbox'), { w } = require('./util');
const app = express();
app.set('trust proxy', 1); app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, 'views'));
app.use(helmet()); app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', async (_q, res) => { try { await q('select 1'); res.send('ok'); } catch (e) { res.status(500).send('db'); } });
app.use(session({ store: new PgStore({ pool }), secret: cfg.secret, resave: false, saveUninitialized: false, name: 'gh.sid',
  cookie: { httpOnly: true, sameSite: 'lax', secure: cfg.secure, maxAge: 8 * 3600e3 } }));
app.use(w(async (req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  Object.assign(res.locals, { csrf: req.session.csrf, flash: req.session.flash || null, user: null, nav: '' }); delete req.session.flash;
  if (req.session.uid) { const u = await P.cargarUsuario(req.session.uid); if (u) req.user = res.locals.user = u; }
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) { const e = new Error('Solicitud no válida'); e.status = 403; throw e; }
  next();
}));
app.use(require('./controllers/auth'));
app.use((req, res, next) => req.user ? next() : res.redirect('/login'));
app.use(require('./controllers/pipeline')); app.use(require('./controllers/requisiciones')); app.use(require('./controllers/admin'));
app.use((req, res, next) => { const e = new Error('Página no encontrada'); e.status = 404; next(e); });
app.use((e, req, res, _n) => { if (!e.status) console.error(e); res.status(e.status || 500).render('error', { title: 'Error', msg: e.status ? e.message : 'Error interno', user: res.locals.user || null, flash: null, csrf: res.locals.csrf || '', nav: '' }); });
app.listen(cfg.port, () => console.log('GH portal en :' + cfg.port));
outbox.start();
