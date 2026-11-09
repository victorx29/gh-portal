const { q, tx } = require('../db'), { E } = require('../util');
// «Hoy» lo decide la base de datos (zona horaria America/Caracas, ver migración 005), no el servidor de la app
const hoy = async () => (await q('select current_date::text d')).rows[0].d;
const histU = (c, u, id, accion, detalle) => c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u && u.id, 'unidad', String(id), accion, detalle || {}]);
const fechaValida = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || '')) && !isNaN(new Date(f));

// ---------- Lectura ----------
const UN = `select u.*, t.nombre tipo, t.nivel, e.siglas emp_siglas, coalesce(e.razon_social,e.nombre) emp_nombre, g.siglas grupo_siglas, g.nombre grupo_nombre
  from unidad u join tipo_unidad t on t.id=u.tipo_id join grupo g on g.id=u.grupo_id left join empresa e on e.id=u.empresa_id`;

// Relaciones vigentes en una fecha: [desde, hasta)
async function relacionesEn(fecha) {
  return (await q(`select r.*, p.nombre padre_nombre, p.codigo padre_codigo from unidad_relacion r join unidad p on p.id=r.padre_id
    where r.desde <= $1 and (r.hasta is null or r.hasta > $1)`, [fecha])).rows;
}
// Carga completa en memoria: la estructura de un grupo son cientos de nodos, no millones
async function grafo(fecha) {
  const f = fecha || await hoy();
  const [us, rels, sirve, dirs] = await Promise.all([
    q(UN + ' where u.creada_en::date <= $1 order by t.nivel, u.nombre', [f]).then(r => r.rows), relacionesEn(f),
    q('select ue.unidad_id, e.id, e.siglas, coalesce(e.razon_social,e.nombre) nombre from unidad_empresa ue join empresa e on e.id=ue.empresa_id').then(r => r.rows),
    q("select ur.unidad_id, us.id, us.nombre, us.activo from usuario_rol ur join usuario us on us.id=ur.usuario_id where ur.rol='director' and ur.unidad_id is not null").then(r => r.rows)]);
  const by = new Map(us.map(u => [u.id, Object.assign(u, { hijos: [], funcional: [], sirve: [], aprobadores: [], padre_id: null })]));
  for (const r of rels) {
    const u = by.get(r.unidad_id); if (!u) continue;
    if (r.tipo === 'solida') { u.padre_id = r.padre_id; u.rel_id = r.id; u.rel_desde = r.desde; } else u.funcional.push({ id: r.id, padre_id: r.padre_id, nombre: r.padre_nombre, codigo: r.padre_codigo, desde: r.desde });
  }
  for (const u of by.values()) { const p = by.get(u.padre_id); if (p) p.hijos.push(u); else u.padre_id = null; }
  for (const s of sirve) { const u = by.get(s.unidad_id); if (u) u.sirve.push(s); }
  for (const d of dirs) { const u = by.get(d.unidad_id); if (u && d.activo) u.aprobadores.push(d); }
  // Empresas efectivas: las propias (dueña + «Sirve a»); una unidad corporativa sin ninguna hereda las de su superior
  const efectivas = (u, n = 0) => {
    if (u.efectivas) return u.efectivas;
    const propias = [u.empresa_id ? { id: u.empresa_id, siglas: u.emp_siglas, nombre: u.emp_nombre } : null, ...u.sirve].filter(Boolean);
    const p = by.get(u.padre_id);
    u.hereda = !propias.length && !!p && n < 60;
    return (u.efectivas = u.hereda ? efectivas(p, n + 1) : propias);
  };
  for (const u of by.values()) efectivas(u);
  return { fecha: f, by };
}
const empresasDe = u => [...new Set((u.efectivas || [{ id: u.empresa_id }, ...u.sirve]).map(e => e.id).filter(Boolean))];
function descendientes(by, id) {
  const out = new Set(), st = [id];
  while (st.length) { const x = st.pop(); if (out.has(x)) continue; out.add(x); const u = by.get(x); if (u) u.hijos.forEach(h => st.push(h.id)); }
  return out;
}
// Lista plana para pintar el árbol. Con filtros, se conservan los ancestros como contexto (atenuados).
async function arbol({ fecha, empresa, grupo, buscar, division } = {}) {
  const g = await grafo(fechaValida(fecha) ? fecha : null), by = g.by, txt = String(buscar || '').trim().toLowerCase();
  // División: sus empresas y las empresas de servicio que la atienden; entran las unidades que atienden a cualquiera de ellas
  const empDiv = division ? new Set((await q('select id from empresa where division_id=$1 union select empresa_id from empresa_division_servicio where division_id=$1', [+division])).rows.map(x => x.id)) : null;
  const coincide = u => (!empresa || empresasDe(u).includes(+empresa)) && (!grupo || u.grupo_id === +grupo) && (!empDiv || empresasDe(u).some(e => empDiv.has(e)))
    && (!txt || u.nombre.toLowerCase().includes(txt) || u.codigo.toLowerCase().includes(txt));
  const filtrado = !!(empresa || grupo || txt || division), visibles = new Set(), match = new Set();
  for (const u of by.values()) if (!filtrado || coincide(u)) {
    match.add(u.id); let p = u, n = 0;
    while (p && n++ < 60) { visibles.add(p.id); p = by.get(p.padre_id); }
  }
  const orden = (a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre, 'es');
  const filas = [], vistos = new Set();
  const pintar = (u, nivel) => {
    if (vistos.has(u.id) || !visibles.has(u.id)) return; vistos.add(u.id);
    filas.push({ u, nivel, ctx: filtrado && !match.has(u.id), nHijos: u.hijos.length });
    u.hijos.sort(orden).forEach(h => pintar(h, nivel + 1));
  };
  [...by.values()].filter(u => !u.padre_id).sort(orden).forEach(u => pintar(u, 0));
  const alertas = [...by.values()].filter(u => u.activa && u.aprueba && !u.aprobadores.length);
  return { fecha: g.fecha, esHoy: g.fecha === await hoy(), filas, total: by.size, alertas };
}
async function detalle(id) {
  const u = (await q(UN + ' where u.id=$1', [id])).rows[0]; if (!u) throw E(404, 'Unidad no encontrada');
  const [rels, sirve, aprob, hijos, reqs] = await Promise.all([
    q(`select r.*, p.nombre padre_nombre, p.codigo padre_codigo, uc.nombre creado_por_nombre, ux.nombre cerrado_por_nombre from unidad_relacion r join unidad p on p.id=r.padre_id
      left join usuario uc on uc.id=r.creado_por left join usuario ux on ux.id=r.cerrado_por where r.unidad_id=$1 order by r.desde desc, r.id desc`, [id]).then(r => r.rows),
    q('select empresa_id from unidad_empresa where unidad_id=$1', [id]).then(r => r.rows.map(x => x.empresa_id)),
    q("select us.nombre, us.email, us.activo from usuario_rol ur join usuario us on us.id=ur.usuario_id where ur.rol='director' and ur.unidad_id=$1 order by us.nombre", [id]).then(r => r.rows),
    q(`select h.codigo, h.nombre from unidad_relacion r join unidad h on h.id=r.unidad_id where r.padre_id=$1 and r.tipo='solida' and r.hasta is null order by h.nombre`, [id]).then(r => r.rows),
    q("select count(*)::int n from requisicion where unidad_id=$1", [id]).then(r => r.rows[0].n)]);
  const g = await grafo(), gu = g.by.get(id);
  return { u, heredadas: gu && gu.hereda ? gu.efectivas : [], rels, sirve, aprob, hijos, reqs, padre: rels.find(r => r.tipo === 'solida' && !r.hasta) || null, funcionales: rels.filter(r => r.tipo === 'funcional' && !r.hasta) };
}
// Datos para el diagrama visual. Filtros: raíz (esa unidad hacia abajo), empresas (una o varias) y división (suma sus empresas).
// Las unidades que coinciden se muestran completas; sus superiores aparecen atenuados como contexto, hasta la raíz elegida.
async function diagrama({ fecha, raiz, empresas, division } = {}) {
  const g = await grafo(fechaValida(fecha) ? fecha : null), by = g.by;
  const sel = new Set([].concat(empresas || []).map(Number).filter(Boolean));
  if (division) (await q('select id from empresa where division_id=$1 union select empresa_id from empresa_division_servicio where division_id=$1', [+division])).rows.forEach(r => sel.add(r.id));
  const filtraEmp = sel.size > 0 || !!division;
  const base = raiz && by.has(+raiz) ? descendientes(by, +raiz) : new Set(by.keys());
  const match = new Set([...base].filter(id => { const u = by.get(id); return u.activa && (!filtraEmp || empresasDe(u).some(e => sel.has(e))); }));
  const vis = new Set(match);
  for (const id of match) { let p = by.get(by.get(id).padre_id), n = 0; while (p && n++ < 60 && base.has(p.id) && p.activa) { vis.add(p.id); p = by.get(p.padre_id); } }
  // Con una raíz elegida, también entran las unidades de fuera que dependen FUNCIONALMENTE de ella (líneas punteadas hacia la vista)
  const externas = new Set();
  if (raiz && by.has(+raiz)) for (const u of by.values()) if (!vis.has(u.id) && u.activa && u.funcional.some(f => vis.has(f.padre_id)) && (!filtraEmp || empresasDe(u).some(e => sel.has(e)))) { vis.add(u.id); externas.add(u.id); }
  const emp = new Map((await q('select id, siglas, coalesce(razon_social,nombre) razon from empresa')).rows.map(e => [e.id, e]));
  const ref = e => { const x = emp.get(e.id) || {}; return { s: x.siglas || '', r: x.razon || e.nombre || '' }; };
  const usadas = new Map();
  const nodes = [...vis].map(id => {
    const u = by.get(id), efs = (u.efectivas || []).map(ref); efs.forEach(e => usadas.set(e.s || e.r, e.r));
    return { id, padre: vis.has(u.padre_id) ? u.padre_id : null, nombre: u.nombre, tipo: u.tipo, nivel: u.nivel, codigo: u.codigo, aprueba: u.aprueba,
      aprobadores: u.aprobadores.map(d => d.nombre), ctx: !match.has(id) && !externas.has(id), externa: externas.has(id), propia: !!u.empresa_id, hereda: !!u.hereda, comparte: u.sirve.length > 0, empresas: efs,
      funcionalFuera: u.funcional.filter(f => !vis.has(f.padre_id)).map(f => f.nombre) };
  });
  const links = []; for (const id of vis) for (const f of by.get(id).funcional) if (vis.has(f.padre_id)) links.push({ de: id, a: f.padre_id });
  return { fecha: g.fecha, esHoy: g.fecha === await hoy(), nodes, links, leyenda: [...usadas].filter(([s]) => s).sort().map(([s, r]) => ({ s, r })), total: by.size };
}
const tipos = (todos) => q(`select * from tipo_unidad ${todos ? '' : 'where activo'} order by nivel, nombre`).then(r => r.rows);
const grupos = () => q('select * from grupo order by nombre').then(r => r.rows);
const empresas = () => q(`select e.*, coalesce(e.razon_social,e.nombre) mostrar, g.siglas grupo_siglas, g.nombre grupo_nombre, d.nombre division,
  coalesce((select array_agg(division_id) from empresa_division_servicio where empresa_id=e.id),'{}') sirve_divisiones
  from empresa e join grupo g on g.id=e.grupo_id left join division d on d.id=e.division_id order by coalesce(e.razon_social,e.nombre)`).then(r => r.rows);
const divisiones = () => q('select * from division order by nombre').then(r => r.rows);
// Para selects: unidades activas con sangría según la línea sólida vigente
// Etiqueta legible: «Gerencia de Repuestos · Dirección de Comercialización · MDV» (superior inmediato y empresa o «Corporativa»)
async function opciones() {
  const a = await arbol(), by = new Map(a.filas.map(f => [f.u.id, f.u]));
  return a.filas.filter(f => f.u.activa).map(f => {
    const u = f.u, p = by.get(u.padre_id), ef = (u.efectivas || []).map(e => e.siglas || e.nombre).join(', '), emp = u.emp_siglas || u.emp_nombre || (ef ? (u.hereda ? 'hereda ' : '') + ef : 'sin empresas');
    const anc = []; for (let x = u, n = 0; x && n < 60; x = by.get(x.padre_id), n++) anc.push(x.id);
    return { id: u.id, codigo: u.codigo, nombre: u.nombre, nivel: f.nivel, empresas: empresasDe(u), aprueba: u.aprueba, anc,
      etiqueta: [u.nombre, p && p.nombre, emp].filter(Boolean).join(' · ') + (u.aprueba ? ' ✓ aprueba' : '') };
  });
}

// ---------- Escritura ----------
function datosUnidad(b) {
  const nombre = String(b.nombre || '').trim(); if (!nombre) throw E(400, 'El nombre es obligatorio');
  if (!b.tipo_id) throw E(400, 'Selecciona el tipo de unidad'); if (!b.grupo_id) throw E(400, 'Selecciona el grupo');
  return { nombre, tipo_id: +b.tipo_id, grupo_id: +b.grupo_id, empresa_id: b.empresa_id ? +b.empresa_id : null, aprueba: b.aprueba === 'on' };
}
async function crear(u, b) {
  const d = datosUnidad(b);
  return tx(async c => {
    const id = (await c.query('insert into unidad(nombre,tipo_id,grupo_id,empresa_id,aprueba) values($1,$2,$3,$4,$5) returning id', [d.nombre, d.tipo_id, d.grupo_id, d.empresa_id, d.aprueba])).rows[0].id;
    await histU(c, u, id, 'crear', d);
    if (b.padre_id) await cambiarPadreC(c, u, id, +b.padre_id, b.motivo || 'Alta de la unidad');
    return id;
  });
}
async function editar(u, id, b) {
  const d = datosUnidad(b);
  return tx(async c => {
    const a = (await c.query('select * from unidad where id=$1 for update', [id])).rows[0]; if (!a) throw E(404, 'Unidad no encontrada');
    await c.query('update unidad set nombre=$2,tipo_id=$3,grupo_id=$4,empresa_id=$5,aprueba=$6 where id=$1', [id, d.nombre, d.tipo_id, d.grupo_id, d.empresa_id, d.aprueba]);
    const cambios = {}; for (const k of Object.keys(d)) if (a[k] !== d[k]) cambios[k] = { de: a[k], a: d[k] };
    if (Object.keys(cambios).length) await histU(c, u, id, 'editar', cambios);
  });
}
async function activar(u, id) {
  return tx(async c => {
    const a = (await c.query('select * from unidad where id=$1 for update', [id])).rows[0]; if (!a) throw E(404, 'Unidad no encontrada');
    if (a.activa) {
      const n = (await c.query("select count(*)::int n from unidad_relacion r join unidad h on h.id=r.unidad_id where r.padre_id=$1 and r.tipo='solida' and r.hasta is null and h.activa", [id])).rows[0].n;
      if (n) throw E(400, 'Tiene ' + n + ' unidad(es) dependientes activas: reasígnalas antes de desactivarla');
    }
    await c.query('update unidad set activa = not activa where id=$1', [id]); await histU(c, u, id, a.activa ? 'desactivar' : 'activar');
  });
}
const errPg = e => {
  if (e.code === '23514' || /ciclo/.test(e.message)) return E(400, 'Ese cambio crea un ciclo: la unidad elegida ya depende (directa o indirectamente) de esta');
  if (e.code === '23505') return E(400, 'Esa dependencia ya está vigente');
  return e;
};
// Cambiar la dependencia sólida = cerrar la vigente (hasta hoy) y abrir la nueva desde hoy. padreId null = queda como raíz.
async function cambiarPadreC(c, u, id, padreId, motivo) {
  const act = (await c.query("select * from unidad_relacion where unidad_id=$1 and tipo='solida' and hasta is null for update", [id])).rows[0];
  if ((act ? act.padre_id : null) === (padreId || null)) return false;
  if (padreId) { const p = (await c.query('select activa from unidad where id=$1', [padreId])).rows[0]; if (!p) throw E(400, 'La unidad superior no existe'); if (!p.activa) throw E(400, 'La unidad superior está inactiva'); }
  if (act) await c.query('update unidad_relacion set hasta=current_date, cerrado_por=$2 where id=$1', [act.id, u && u.id]);
  if (padreId) {
    await c.query('savepoint sp_rel');
    try { await c.query("insert into unidad_relacion(unidad_id,padre_id,tipo,motivo,creado_por) values($1,$2,'solida',$3,$4)", [id, padreId, (motivo || '').trim() || null, u && u.id]); }
    catch (e) { await c.query('rollback to savepoint sp_rel'); throw errPg(e); }
  }
  await histU(c, u, id, 'dependencia', { de: act ? act.padre_id : null, a: padreId || null, motivo: (motivo || '').trim() || undefined });
  return true;
}
const cambiarPadre = (u, id, padreId, motivo) => tx(c => cambiarPadreC(c, u, id, padreId, motivo));
async function agregarFuncionalC(c, u, id, padreId, motivo) {
  if (!padreId) throw E(400, 'Selecciona la unidad'); if (padreId === id) throw E(400, 'Una unidad no depende de sí misma');
  await c.query('savepoint sp_fun');
  try { await c.query("insert into unidad_relacion(unidad_id,padre_id,tipo,motivo,creado_por) values($1,$2,'funcional',$3,$4)", [id, padreId, (motivo || '').trim() || null, u && u.id]); }
  catch (e) { await c.query('rollback to savepoint sp_fun'); throw errPg(e); }
  await histU(c, u, id, 'funcional.abrir', { padre: padreId });
}
const agregarFuncional = (u, id, padreId, motivo) => tx(c => agregarFuncionalC(c, u, id, padreId, motivo));
async function cerrarRelacion(u, relId) {
  return tx(async c => {
    const r = (await c.query('select * from unidad_relacion where id=$1 for update', [relId])).rows[0];
    if (!r || r.hasta) throw E(400, 'La dependencia no existe o ya está cerrada');
    await c.query('update unidad_relacion set hasta=current_date, cerrado_por=$2 where id=$1', [relId, u.id]);
    await histU(c, u, r.unidad_id, r.tipo === 'solida' ? 'dependencia' : 'funcional.cerrar', { de: r.padre_id, a: null }); return r.unidad_id;
  });
}
async function sirveAC(c, u, id, ids) {
  const nuevos = [...new Set([].concat(ids || []).map(Number).filter(Boolean))].sort((a, b) => a - b);
  const prev = (await c.query('select empresa_id from unidad_empresa where unidad_id=$1 order by 1', [id])).rows.map(x => x.empresa_id);
  if (prev.join() === nuevos.join()) return false;
  await c.query('delete from unidad_empresa where unidad_id=$1', [id]);
  for (const e of nuevos) await c.query('insert into unidad_empresa(unidad_id,empresa_id) values($1,$2)', [id, e]);
  await histU(c, u, id, 'sirve_a', { de: prev, a: nuevos }); return true;
}
const sirveA = (u, id, ids) => tx(c => sirveAC(c, u, id, ids));

// ---------- Alcance y aprobación ----------
// Unidades para las que un usuario puede solicitar: rol con unidad = esa unidad y sus dependientes;
// rol solo con empresa (heredado de 0.4) = todas las unidades que pertenecen a esa empresa o le sirven.
async function alcanceSolicitud(usr) {
  const roles = usr.roles.filter(r => r.rol === 'gerente' || r.rol === 'director'); if (!roles.length) return [];
  const g = await grafo(), perm = new Map();   // unidad → empresas permitidas para solicitar
  const dar = (id, emps) => { const s = perm.get(id) || new Set(); emps.forEach(e => s.add(e)); perm.set(id, s); };
  for (const r of roles) {
    if (r.unidad_id) descendientes(g.by, r.unidad_id).forEach(x => { const u = g.by.get(x); if (u) dar(x, empresasDe(u)); });
    else for (const u of g.by.values()) { const es = empresasDe(u); if (r.empresa_id == null) dar(u.id, es); else if (es.includes(r.empresa_id)) dar(u.id, [r.empresa_id]); }
  }
  return (await opciones()).filter(o => perm.has(o.id)).map(o => ({ ...o, empresas: [...perm.get(o.id)].filter(e => o.empresas.includes(e)) })).filter(o => o.empresas.length);
}
// Quién aprueba (paso Director): la unidad «aprueba» más cercana subiendo por la línea sólida.
// Si ninguna unidad de la cadena aprueba, regla de transición 0.4: director con alcance de empresa.
async function aprobacion(c, r) {
  const f = c.query.bind(c);
  const uid = r.unidad_id ? (await f('select unidad_aprobadora($1) id', [r.unidad_id])).rows[0].id : null;
  if (uid) {
    const un = (await f('select id,codigo,nombre from unidad where id=$1', [uid])).rows[0];
    const ap = (await f("select us.id,us.nombre,us.email from usuario_rol ur join usuario us on us.id=ur.usuario_id where ur.rol='director' and ur.unidad_id=$1 and us.activo", [uid])).rows;
    return { regla: 'estructura', unidad: un, aprobadores: ap };
  }
  const ap = (await f("select distinct us.id,us.nombre,us.email from usuario_rol ur join usuario us on us.id=ur.usuario_id where ur.rol='director' and ur.unidad_id is null and (ur.empresa_id is null or ur.empresa_id=$1) and us.activo", [r.empresa_id])).rows;
  return { regla: 'empresa', unidad: null, aprobadores: ap };
}
// Foto inmutable: con qué estructura se tomó la decisión
async function foto(c, r, ap) {
  const cadena = r.unidad_id ? (await c.query('select unidad_cadena($1) j', [r.unidad_id])).rows[0].j : [];
  return { fecha: new Date().toISOString(), regla: ap.regla, aprobadora: ap.unidad, cadena };
}
module.exports = { diagrama, hoy, fechaValida, grafo, arbol, detalle, tipos, grupos, empresas, divisiones, opciones, empresasDe, descendientes, crear, editar, activar,
  cambiarPadre, cambiarPadreC, agregarFuncional, agregarFuncionalC, cerrarRelacion, sirveA, sirveAC, alcanceSolicitud, aprobacion, foto, histU, errPg };
