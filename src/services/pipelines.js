const { q, tx } = require('../db'), { E } = require('../util');
const run = c => (t, p) => (c ? c.query(t, p) : q(t, p));
const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'etapa';

// Pipeline vigente de una empresa: el propio si existe; si no, el estándar del grupo
async function resolver(empresaId, tipo, c) {
  const f = run(c);
  const p = (await f('select id, empresa_id from pipeline where tipo=$1 and (empresa_id=$2 or empresa_id is null) order by empresa_id nulls last limit 1', [tipo, empresaId])).rows[0];
  const etapas = (await f('select * from etapa where pipeline_id=$1 and activa order by orden', [p.id])).rows;
  return { id: p.id, propio: p.empresa_id != null, etapas, flujo: etapas.filter(e => e.clase !== 'cierre'),
    cierre: etapas.find(e => e.clase === 'cierre'), exito: etapas.find(e => e.clase === 'exito') };
}
// Columnas para un tablero que mezcla empresas: unión por clave (cierre al final)
async function columnas(tipo, empresaId) {
  const rows = empresaId ? (await resolver(+empresaId, tipo)).etapas
    : (await q('select e.* from etapa e join pipeline p on p.id=e.pipeline_id where p.tipo=$1 and e.activa order by (p.empresa_id is not null), e.orden', [tipo])).rows;
  const m = new Map(); rows.forEach(e => { if (!m.has(e.clave)) m.set(e.clave, e); });
  return [...m.values()].sort((a, b) => ((a.clase === 'cierre') - (b.clase === 'cierre')) || a.orden - b.orden);
}
// Validaciones para SALIR de una etapa: los tipos viven en código; cuáles aplican se configura en pantalla
async function problemas(c, tipo, id, et) {
  const r = et.reglas || {}, out = [];
  const reg = (await c.query('select * from etapa_registro where tipo=$1 and entidad_id=$2 and etapa=$3', [tipo, id, et.clave])).rows[0];
  if (r.requiere_resultado && (!reg || reg.resultado !== 'apto')) out.push('Falta registrar resultado Apto en «' + et.nombre + '»');
  for (const it of r.checklist || []) if (!reg || !(reg.checklist || {})[it]) out.push('Pendiente: ' + it);
  return out;
}
async function registrar(u, tipo, id, et, b) {
  const permitidos = (et.reglas && et.reglas.checklist) || [], cl = {};
  [].concat(b.check || []).filter(i => permitidos.includes(i)).forEach(i => { cl[i] = true; });
  await q(`insert into etapa_registro(tipo,entidad_id,etapa,resultado,nota,checklist,registrado_por) values($1,$2,$3,$4,$5,$6,$7)
    on conflict(tipo,entidad_id,etapa) do update set resultado=excluded.resultado, nota=excluded.nota, checklist=excluded.checklist, registrado_por=excluded.registrado_por, actualizado_en=now()`,
    [tipo, id, et.clave, ['apto', 'no_apto'].includes(b.resultado) ? b.resultado : 'pendiente', (b.nota || '').trim() || null, cl, u.id]);
}

// ---- Configuración (pantalla de GH) ----
async function clonar(empresaId, tipo) {
  return tx(async c => {
    const ex = (await c.query('select id from pipeline where tipo=$1 and empresa_id=$2', [tipo, empresaId])).rows[0]; if (ex) return ex.id;
    const base = (await c.query('select id from pipeline where tipo=$1 and empresa_id is null', [tipo])).rows[0];
    const emp = (await c.query('select coalesce(razon_social,nombre) nombre from empresa where id=$1', [empresaId])).rows[0]; if (!emp) throw E(404, 'Empresa no encontrada');
    const p = (await c.query('insert into pipeline(tipo,empresa_id,nombre) values($1,$2,$3) returning id', [tipo, empresaId, 'Pipeline de ' + emp.nombre])).rows[0];
    await c.query('insert into etapa(pipeline_id,clave,nombre,orden,clase,reglas) select $1,clave,nombre,orden,clase,reglas from etapa where pipeline_id=$2 and activa', [p.id, base.id]);
    return p.id;
  });
}
async function agregar(pid, nombre, despuesId) {
  nombre = String(nombre || '').trim(); if (!nombre) throw E(400, 'Indica el nombre de la columna');
  return tx(async c => {
    const ref = (await c.query('select * from etapa where id=$1 and pipeline_id=$2 and activa', [despuesId, pid])).rows[0];
    if (!ref || !['inicio', 'normal'].includes(ref.clase)) throw E(400, 'Posición inválida');
    let clave = slug(nombre);
    if ((await c.query('select 1 from etapa where pipeline_id=$1 and clave=$2', [pid, clave])).rowCount) clave += '_' + Date.now().toString(36);
    await c.query('update etapa set orden=orden+1 where pipeline_id=$1 and orden>$2', [pid, ref.orden]);
    await c.query("insert into etapa(pipeline_id,clave,nombre,orden,clase) values($1,$2,$3,$4,'normal')", [pid, clave, nombre, ref.orden + 1]);
  });
}
async function editar(id, b) {
  const nombre = String(b.nombre || '').trim(); if (!nombre) throw E(400, 'El nombre es obligatorio');
  const reglas = { requiere_resultado: b.requiere_resultado === 'on', checklist: String(b.checklist || '').split('\n').map(s => s.trim()).filter(Boolean) };
  await q('update etapa set nombre=$2, reglas=$3 where id=$1', [id, nombre, reglas]);
}
async function mover(id, dir) {
  return tx(async c => {
    const e = (await c.query('select * from etapa where id=$1', [id])).rows[0];
    if (!e || e.clase !== 'normal') throw E(400, 'Solo las columnas intermedias se reordenan');
    const v = (await c.query("select id,orden from etapa where pipeline_id=$1 and clase='normal' and activa order by orden", [e.pipeline_id])).rows;
    const i = v.findIndex(x => x.id === id), j = dir === 'up' ? i - 1 : i + 1; if (j < 0 || j >= v.length) return;
    await c.query('update etapa set orden=$2 where id=$1', [v[i].id, v[j].orden]); await c.query('update etapa set orden=$2 where id=$1', [v[j].id, v[i].orden]);
  });
}
async function quitar(id) {
  const e = (await q('select * from etapa where id=$1', [id])).rows[0];
  if (!e || e.clase !== 'normal') throw E(400, 'Solo se quitan columnas intermedias');
  const n = (await q('select (select count(*) from requisicion where estado=$1)+(select count(*) from candidatura where etapa=$1) n', [e.clave])).rows[0].n;
  if (+n > 0) throw E(400, 'Hay tarjetas en esta columna; muévelas antes de quitarla');
  await q('update etapa set activa=false where id=$1', [id]);
}
module.exports = { resolver, columnas, problemas, registrar, clonar, agregar, editar, mover, quitar };
