const { tx } = require('../db'), cfg = require('../config');
// Destino de cada evento: la lectura de CV (cv.leer) a su flujo; el análisis (cv.*) al flujo de IA o, si no hay, al general; el resto al general
const destino = tipo => tipo === 'cv.leer' ? cfg.n8n.urlLectura : tipo.startsWith('cv.') ? (cfg.n8n.urlIa || cfg.n8n.url) : cfg.n8n.url;
async function despachar() {
  // Solo se toman los eventos que tienen destino configurado: los demás esperan (no gastan intentos)
  const filtros = [];
  if (cfg.n8n.url) filtros.push("tipo not like 'cv.%'");
  if (cfg.n8n.urlIa || cfg.n8n.url) filtros.push("(tipo like 'cv.%' and tipo <> 'cv.leer')");
  if (cfg.n8n.urlLectura) filtros.push("tipo = 'cv.leer'");
  if (!filtros.length) return;
  await tx(async c => {
    const ev = (await c.query(`select * from evento_outbox where enviado_en is null and intentos<10 and (${filtros.join(' or ')}) order by id limit 20 for update skip locked`)).rows;
    for (const e of ev) {
      try {
        const r = await fetch(destino(e.tipo), { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': cfg.n8n.key },
          body: JSON.stringify({ id: e.id, tipo: e.tipo, payload: e.payload }), signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        await c.query('update evento_outbox set enviado_en=now() where id=$1', [e.id]);
      } catch (x) {
        await c.query('update evento_outbox set intentos=intentos+1, ultimo_error=$2 where id=$1', [e.id, String(x.message).slice(0, 300)]);
      }
    }
  });
}
exports.destino = destino;
exports.despachar = despachar;
exports.start = () => setInterval(() => despachar().catch(e => console.error('outbox:', e.message)), 15000);
