const r = require('express').Router(), bcrypt = require('bcryptjs'), { q } = require('../db'), { w } = require('../util');
const intentos = new Map();
r.get('/', (req, res) => res.redirect('/pipeline'));
r.get('/login', (req, res) => res.render('login', { title: 'Ingresar', error: null }));
r.post('/login', w(async (req, res, next) => {
  const email = String(req.body.email || '').toLowerCase().trim(), k = req.ip + '|' + email, n = intentos.get(k) || { c: 0, t: Date.now() };
  if (Date.now() - n.t > 9e5) { n.c = 0; n.t = Date.now(); }
  if (n.c >= 5) return res.status(429).render('login', { title: 'Ingresar', error: 'Demasiados intentos. Espera 15 minutos.' });
  const u = (await q('select id,pass_hash,activo from usuario where email=$1', [email])).rows[0];
  const ok = u && u.activo && await bcrypt.compare(String(req.body.password || ''), u.pass_hash);
  if (!ok) { n.c++; intentos.set(k, n); return res.status(401).render('login', { title: 'Ingresar', error: 'Credenciales inválidas' }); }
  intentos.delete(k);
  req.session.regenerate(e => { if (e) return next(e); req.session.uid = u.id; res.redirect('/pipeline'); });
}));
r.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));
module.exports = r;
