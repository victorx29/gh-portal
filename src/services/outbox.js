const { tx } = require('../db'), cfg = require('../config');
async function despachar() {
  if (!cfg.n8n.url) return;
  await tx(async c => {
    const ev = (await c.query('select * from evento_outbox where enviado_en is null and intentos<10 order by id limit 20 for update skip locked')).rows;
    for (const e of ev) {
      try {
        const r = await fetch(cfg.n8n.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': cfg.n8n.key },
          body: JSON.stringify({ id: e.id, tipo: e.tipo, payload: e.payload }), signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        await c.query('update evento_outbox set enviado_en=now() where id=$1', [e.id]);
      } catch (x) {
        await c.query('update evento_outbox set intentos=intentos+1, ultimo_error=$2 where id=$1', [e.id, String(x.message).slice(0, 300)]);
      }
    }
  });
}
exports.start = () => setInterval(() => despachar().catch(e => console.error('outbox:', e.message)), 15000);
