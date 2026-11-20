// API para n8n (sin sesión ni CSRF): clave compartida en la cabecera x-api-key (N8N_API_KEY) y token propio de cada análisis (?t=…).
// Solo expone lo que el análisis de CV necesita.
const r = require('express').Router(), IA = require('../services/ia'), cfg = require('../config'), { E } = require('../util');
r.use((req, res, next) => {
  if (!cfg.n8n.key) return res.status(503).json({ error: 'La API está desactivada: falta N8N_API_KEY' });
  if (!IA.iguales(req.get('x-api-key'), cfg.n8n.key)) return res.status(401).json({ error: 'Clave inválida' });
  next();
});
const j = fn => async (req, res) => {
  try { res.json(await fn(+req.params.id, String(req.query.t || ''), req.body)); }
  catch (e) { const st = e.status || 500; if (st >= 500) console.error('api:', e); res.status(st).json({ error: st >= 500 ? 'Error interno' : e.message }); }
};
r.get('/ia/analisis/:id(\\d+)', j((id, t) => IA.datosParaN8n(id, t)));
r.post('/ia/analisis/:id(\\d+)/resultado', j((id, t, b) => IA.recibirResultado(id, t, b)));
r.post('/ia/analisis/:id(\\d+)/error', j((id, t, b) => IA.recibirError(id, t, b)));
r.use((req, res) => res.status(404).json({ error: 'No encontrado' }));
module.exports = r;
