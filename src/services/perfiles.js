const ExcelJS = require('exceljs'), { q, tx } = require('../db'), ES = require('./estructura'), { E } = require('../util');
// Código del perfil: GH-PF-NNN (correlativo). Código de versión: GH-PF-NNN-VV.
const pad = (n, w) => String(n).padStart(w, '0');
const codigoV = (codigo, v) => codigo + '-' + pad(v, 2);
// Contenido del perfil con el formato de las descripciones de cargo de GH. Una sola normalización para formulario, Excel y Word.
// «Departamento», «Reporta a» y «Trabajador ocupante» NO viven aquí: salen de la plantilla (puesto) y de los empleados.
const TEXTOS = ['objetivo', 'educacion', 'experiencia', 'conocimientos', 'certificaciones', 'idiomas'];
const RESP = { dinero: 'Dinero', informacion: 'Información confidencial', decisiones: 'Toma de decisiones', supervision: 'Supervisión' };
const lineas = v => (Array.isArray(v) ? v : String(v || '').split(/\n|;/)).map(x => String(typeof x === 'object' && x ? (x.nombre + (x.descripcion ? ': ' + x.descripcion : '')) : x).replace(/^[\s•\-–·*\d.)]+/, '').trim()).filter(Boolean);
const competencia = t => { const m = /^([^:]{2,60}):\s*(.+)$/.exec(t); return m ? { nombre: m[1].trim(), descripcion: m[2].trim() } : { nombre: t }; };
const entero = v => { const n = parseInt(v, 10); return Number.isInteger(n) && n >= 0 && n <= 60 ? n : null; };
// Años de experiencia a partir del texto: «entre 4 y 5» → 4–5; «Más de 6» / «Mínimo 15» / «3 años» → mínimo
const anios = t => { const s = String(t || '').toLowerCase(), m = /entre\s+(\d+)\s*(?:y|a|-)\s*(\d+)/.exec(s) || /(\d+)\s*(?:a|-)\s*(\d+)\s*a[ñn]os/.exec(s); if (m) return [+m[1], +m[2]]; const k = /(\d+)\s*a[ñn]os|(?:m[aá]s de|m[ií]nimo|al menos)\s*(\d+)/.exec(s); return k ? [+(k[1] || k[2]), null] : [null, null]; };
const contenidoDe = b => {
  b = b || {}; const c = {};
  TEXTOS.forEach(k => { c[k] = String(b[k] || '').trim(); });
  if (!c.educacion && b.requisitos) c.educacion = String(b.requisitos).trim();          // versiones anteriores a 0.7.1: «Requisitos» pasa a «Educación»
  c.funciones = lineas(b.funciones);
  const [mn, mx] = anios(c.experiencia);
  c.experiencia_min = entero(b.experiencia_min) != null ? entero(b.experiencia_min) : mn;
  c.experiencia_max = entero(b.experiencia_max) != null ? entero(b.experiencia_max) : mx;
  c.competencias_conductuales = (Array.isArray(b.competencias_conductuales) ? b.competencias_conductuales : String(b.competencias_conductuales || '').split(/\n|;|,/)).map(x => String(x).replace(/\.$/, '').trim()).filter(Boolean);
  c.competencias = lineas(b.competencias).map(competencia);
  const r = b.responsabilidades || {}; c.responsabilidades = {}; Object.keys(RESP).forEach(k => { c.responsabilidades[k] = String(r[k] != null ? r[k] : b['resp_' + k] || '').trim(); });
  c.criterios = lineas(b.criterios);
  return c;
};
const igual = (a, b) => JSON.stringify(contenidoDe(a || {})) === JSON.stringify(contenidoDe(b || {}));
const hist = (c, u, id, accion, detalle) => c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u && u.id, 'perfil', String(id), accion, detalle || {}]);
const ids = v => [...new Set([].concat(v || []).map(Number).filter(Boolean))];

const LISTA = `select p.*, nj.nombre nivel_j, nj.orden nivel_j_orden, pv.version v_activa, pv.contenido, (select count(*)::int from perfil_version where perfil_id=p.id) n_versiones,
  coalesce((select json_agg(json_build_object('empresa_id',a.empresa_id,'unidad_id',a.unidad_id,'empresa',coalesce(e.siglas,e.razon_social,e.nombre),'unidad',un.nombre,'unidad_codigo',un.codigo))
    from perfil_alcance a left join empresa e on e.id=a.empresa_id left join unidad un on un.id=a.unidad_id where a.perfil_id=p.id),'[]') alcance
  from perfil p left join perfil_version pv on pv.id=p.version_activa_id left join nivel_jerarquico nj on nj.id=p.nivel_jerarquico_id`;
// Perfil «mínimo» (solo nombre): sin objetivo, funciones ni educación. Útil para pasantes, outsourcing o Presidencia; ISO pide documentar el resto.
const sinDescripcion = c => { c = c || {}; return !String(c.objetivo || '').trim() && !(Array.isArray(c.funciones) ? c.funciones.length : String(c.funciones || '').trim()) && !String(c.educacion || c.requisitos || '').trim(); };
async function listar(f = {}) {
  const w = [], p = [];
  if (f.buscar) { p.push('%' + f.buscar.trim() + '%'); w.push(`(p.nombre ilike $${p.length} or p.codigo ilike $${p.length} or p.codigo_anterior ilike $${p.length})`); }
  if (f.nivel) { p.push(f.nivel); w.push(`p.nivel=$${p.length}`); }
  if (f.estado === 'activos' || f.estado === 'sindesc') w.push('p.activo'); if (f.estado === 'inactivos') w.push('not p.activo');
  if (f.empresa) { p.push(+f.empresa); w.push(`(p.general or exists(select 1 from perfil_alcance a where a.perfil_id=p.id and a.empresa_id=$${p.length}))`); }
  // Alcance: 'general', 'sin' (ni general ni empresas/unidades) o 'u<ID>' = perfiles cuyo alcance es esa unidad (y sus dependientes, si f.sub)
  if (f.alcance === 'general') w.push('p.general');
  if (f.alcance === 'sin') w.push('not p.general and not exists(select 1 from perfil_alcance a where a.perfil_id=p.id)');
  const uid = /^u(\d+)$/.exec(f.alcance || '');
  if (uid) {
    const g = await ES.grafo(), ids = f.sub ? [...ES.descendientes(g.by, +uid[1])] : [+uid[1]];
    p.push(ids); w.push(`exists(select 1 from perfil_alcance a where a.perfil_id=p.id and a.unidad_id = any($${p.length}))`);
  }
  const rows = (await q(LISTA + (w.length ? ' where ' + w.join(' and ') : '') + ' order by p.correlativo', p)).rows;
  rows.forEach(r => { r.sinDesc = sinDescripcion(r.contenido); });
  return f.estado === 'sindesc' ? rows.filter(r => r.sinDesc) : rows;
}
async function detalle(id) {
  const p = (await q(LISTA + ' where p.id=$1', [id])).rows[0]; if (!p) throw E(404, 'Perfil no encontrado');
  p.versiones = (await q(`select v.*, u.nombre autor, (select count(*)::int from requisicion r where r.perfil_version_id=v.id) n_req
    from perfil_version v join usuario u on u.id=v.creado_por where v.perfil_id=$1 order by v.version desc`, [id])).rows;
  return p;
}
async function guardarAlcance(c, id, b) {
  await c.query('delete from perfil_alcance where perfil_id=$1', [id]);
  for (const e of ids(b.empresas)) await c.query('insert into perfil_alcance(perfil_id,empresa_id) values($1,$2)', [id, e]);
  for (const un of ids(b.unidades)) await c.query('insert into perfil_alcance(perfil_id,unidad_id) values($1,$2)', [id, un]);
}
// Nivel jerárquico: id del catálogo (o vacío = sin nivel)
const nivelJ = b => b.nivel_jerarquico_id ? +b.nivel_jerarquico_id || null : null;
function datos(b) {
  const nombre = String(b.nombre || '').trim(); if (!nombre) throw E(400, 'El nombre del cargo es obligatorio');
  return { nombre, nivel: String(b.nivel || '').trim() || null, general: b.general === 'on' || b.general === true };
}
async function crearC(c, u, b) {
  const d = datos(b), n = (await c.query("select nextval('perfil_seq')::int n")).rows[0].n, codigo = 'GH-PF-' + pad(n, 3);
  const id = (await c.query('insert into perfil(codigo,correlativo,nombre,nivel,general,nivel_jerarquico_id) values($1,$2,$3,$4,$5,$6) returning id', [codigo, n, d.nombre, d.nivel, d.general, nivelJ(b)])).rows[0].id;
  await guardarAlcance(c, id, b);
  const vid = (await c.query('insert into perfil_version(perfil_id,version,contenido,creado_por) values($1,1,$2,$3) returning id', [id, contenidoDe(b), u.id])).rows[0].id;
  await c.query('update perfil set version_activa_id=$2 where id=$1', [id, vid]);
  await hist(c, u, id, 'crear', { codigo: codigoV(codigo, 1) }); return id;
}
const crear = (u, b) => tx(c => crearC(c, u, b));
async function editarC(c, u, id, b) {
  const d = datos(b), a = (await c.query('select * from perfil where id=$1 for update', [id])).rows[0]; if (!a) throw E(404, 'Perfil no encontrado');
  await c.query('update perfil set nombre=$2, nivel=$3, general=$4, nivel_jerarquico_id=$5 where id=$1', [id, d.nombre, d.nivel, d.general, nivelJ(b)]);
  await guardarAlcance(c, id, b); await hist(c, u, id, 'editar', d);
}
const editar = (u, id, b) => tx(c => editarC(c, u, id, b));
// Editar el contenido = nueva versión (inmutable). Por defecto queda activa; las requisiciones ya creadas conservan la suya.
async function nuevaVersionC(c, u, id, b, activar = true) {
  const p = (await c.query('select * from perfil where id=$1 for update', [id])).rows[0]; if (!p) throw E(404, 'Perfil no encontrado');
  const v = (await c.query('select coalesce(max(version),0)+1 v from perfil_version where perfil_id=$1', [id])).rows[0].v;
  const vid = (await c.query('insert into perfil_version(perfil_id,version,contenido,creado_por) values($1,$2,$3,$4) returning id', [id, v, contenidoDe(b), u.id])).rows[0].id;
  if (activar) await c.query('update perfil set version_activa_id=$2 where id=$1', [id, vid]);
  await hist(c, u, id, 'version', { codigo: codigoV(p.codigo, v), activa: activar }); return v;
}
const nuevaVersion = (u, id, b, activar) => tx(c => nuevaVersionC(c, u, id, b, activar));
async function activarVersion(u, id, vid) {
  return tx(async c => {
    const v = (await c.query('select v.version, p.codigo from perfil_version v join perfil p on p.id=v.perfil_id where v.id=$1 and v.perfil_id=$2', [vid, id])).rows[0];
    if (!v) throw E(404, 'Versión no encontrada');
    await c.query('update perfil set version_activa_id=$2 where id=$1', [id, vid]); await hist(c, u, id, 'activar_version', { codigo: codigoV(v.codigo, v.version) });
  });
}
async function activo(u, id) {
  return tx(async c => { const r = (await c.query('update perfil set activo = not activo where id=$1 returning activo', [id])).rows[0]; if (!r) throw E(404, 'Perfil no encontrado'); await hist(c, u, id, r.activo ? 'activar' : 'desactivar'); });
}

// ---- Disponibilidad para la requisición ----
// Visible si: activo, con versión activa y (general, o [sin empresas o la empresa está] y [sin unidades o la unidad es esa o un superior])
async function paraFormulario() {
  return (await q(LISTA + ' where p.activo and p.version_activa_id is not null order by p.nombre')).rows.map(p => ({
    id: p.id, codigo: p.codigo, version: p.v_activa, nombre: p.nombre, nivel: p.nivel, general: p.general,
    emps: p.alcance.filter(a => a.empresa_id).map(a => a.empresa_id), unis: p.alcance.filter(a => a.unidad_id).map(a => a.unidad_id) }));
}
async function ancestros(unidadId) {
  return (await q(`with recursive up(id,prof) as (select $1::int,0 union all select r.padre_id, up.prof+1 from unidad_relacion r join up on r.unidad_id=up.id
    where r.tipo='solida' and r.hasta is null and up.prof<50) select id from up`, [unidadId])).rows.map(x => x.id);
}
const aplica = (p, emp, anc) => p.general || ((p.emps.length || p.unis.length) && (!p.emps.length || p.emps.includes(emp)) && (!p.unis.length || p.unis.some(x => anc.includes(x))));
async function validarParaRequisicion(perfilId, emp, unidadId) {
  const p = (await paraFormulario()).find(x => x.id === +perfilId); if (!p) throw E(400, 'Selecciona un perfil activo');
  if (!aplica(p, emp, await ancestros(unidadId))) throw E(400, 'Ese perfil no corresponde a la empresa y unidad elegidas');
  return (await q('select version_activa_id id from perfil where id=$1', [p.id])).rows[0].id;
}

// ---- Carga masiva de cargos ----
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const key = s => String(s == null ? '' : s).trim().toLowerCase();
const lista = s => String(s || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
const COLS = [['Código', 'codigo', 14], ['Cargo *', 'nombre', 34], ['Nivel', 'nivel', 8], ['Nivel jerárquico', 'nivel_j', 18], ['General', 'general', 9], ['Empresas', 'empresas', 18], ['Unidades', 'unidades', 26],
  ['Objetivo', 'objetivo', 40], ['Funciones', 'funciones', 50], ['Educación', 'educacion', 30], ['Experiencia', 'experiencia', 30], ['Años mín.', 'experiencia_min', 9], ['Años máx.', 'experiencia_max', 9],
  ['Conocimientos', 'conocimientos', 40], ['Certificaciones', 'certificaciones', 20], ['Idiomas', 'idiomas', 14], ['Competencias conductuales', 'competencias_conductuales', 30], ['Competencias', 'competencias', 40],
  ['Dinero', 'resp_dinero', 20], ['Información confidencial', 'resp_informacion', 26], ['Toma de decisiones', 'resp_decisiones', 30], ['Supervisión', 'resp_supervision', 30], ['Criterios', 'criterios', 30]];
const aFila = c => ({ objetivo: c.objetivo || '', funciones: (c.funciones || []).join('; '), educacion: c.educacion || c.requisitos || '', experiencia: c.experiencia || '', experiencia_min: c.experiencia_min ?? '', experiencia_max: c.experiencia_max ?? '',
  conocimientos: c.conocimientos || '', certificaciones: c.certificaciones || '', idiomas: c.idiomas || '', competencias_conductuales: (c.competencias_conductuales || []).join('; '),
  competencias: (c.competencias || []).map(x => x.nombre + (x.descripcion ? ': ' + x.descripcion : '')).join('; '), resp_dinero: (c.responsabilidades || {}).dinero || '', resp_informacion: (c.responsabilidades || {}).informacion || '',
  resp_decisiones: (c.responsabilidades || {}).decisiones || '', resp_supervision: (c.responsabilidades || {}).supervision || '', criterios: (c.criterios || []).join('; ') });
async function plantilla() {
  const ps = await listar(), wb = new ExcelJS.Workbook(); wb.creator = 'Portal de Gestión Humana';
  const ins = wb.addWorksheet('Instrucciones'); ins.getColumn(1).width = 110;
  ['Carga masiva de Perfiles y Cargos', '', '1. Este archivo trae los perfiles actuales con su versión activa. Edítalo y súbelo en Configuración › Gestión de cargos › Carga masiva.',
    '2. Código vacío = perfil nuevo: el sistema le asigna el siguiente GH-PF-NNN. No inventes códigos.',
    '3. Si cambias Objetivo, Funciones, Requisitos, Competencias, Conocimientos o Criterios, se crea una versión nueva y queda activa. Las requisiciones ya hechas conservan la suya.',
    '4. General = Sí: lo ven todas las empresas y unidades. Si es No, indica Empresas (siglas o razón social) y/o Unidades (código o nombre exacto), separadas por coma.',
    '4b. «Nivel jerárquico» = nombre de un nivel de Configuración › Niveles jerárquicos (fila del cargo en el organigrama). Vacío = sin nivel.',
    '5. Una unidad incluye a todas las que dependen de ella. Funciones, competencias y criterios: separados por punto y coma. Competencias con descripción: «Nombre: descripción».',
    '6. Lo que no está en el archivo no se modifica ni se borra. Antes de aplicar verás una vista previa con errores y advertencias.'].forEach((t, i) => { const c = ins.getCell(i + 1, 1); c.value = t; if (!i) c.font = { bold: true, size: 14 }; });
  const ws = wb.addWorksheet('Cargos', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLS.map(([header, k, width]) => ({ header, key: k, width }));
  const h = ws.getRow(1); h.font = { bold: true }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FD' } };
  for (const p of ps) { const c = p.contenido || {};
    ws.addRow({ codigo: p.codigo, nombre: p.nombre, nivel: p.nivel || '', nivel_j: p.nivel_j || '', general: p.general ? 'Sí' : 'No', empresas: p.alcance.filter(a => a.empresa_id).map(a => a.empresa).join(', '),
      unidades: p.alcance.filter(a => a.unidad_id).map(a => a.unidad_codigo).join(', '), ...aFila(contenidoDe(c)) }); }
  ws.dataValidations.add('D2:D5000', { type: 'list', allowBlank: true, formulae: ['"Sí,No"'] });
  return wb.xlsx.writeBuffer();
}
async function leer(buffer) {
  const wb = new ExcelJS.Workbook(); try { await wb.xlsx.load(buffer); } catch (e) { throw E(400, 'No se pudo leer el archivo. Usa la plantilla en formato .xlsx'); }
  const ws = wb.getWorksheet('Cargos'); if (!ws) throw E(400, 'El archivo no tiene la hoja «Cargos». Descarga la plantilla');
  const idx = {}; ws.getRow(1).eachCell((c, i) => { const col = COLS.find(([hd]) => norm(hd) === norm(c.text)); if (col) idx[col[1]] = i; });
  if (!idx.nombre) throw E(400, 'La hoja «Cargos» no tiene la columna «Cargo». No cambies los encabezados');
  const filas = []; ws.eachRow((row, n) => { if (n === 1) return; const f = { fila: n }; for (const [k, i] of Object.entries(idx)) f[k] = String(row.getCell(i).text || '').trim(); if (Object.keys(idx).some(k => f[k])) filas.push(f); });
  if (!filas.length) throw E(400, 'La hoja «Cargos» no tiene filas'); if (filas.length > 3000) throw E(400, 'Máximo 3.000 cargos por carga');
  return filas;
}
async function procesar(c, filas, usr, aplicar) {
  const errs = [], avisos = [], err = (f, m) => errs.push({ fila: f, msg: m }), aviso = (f, m) => avisos.push({ fila: f, msg: m });
  const [ps, es, us] = await Promise.all([c.query(LISTA).then(r => r.rows), c.query('select * from empresa').then(r => r.rows), c.query('select id,codigo,nombre from unidad where activa').then(r => r.rows)]);
  const empRef = new Map(); es.forEach(e => [e.siglas, e.razon_social, e.nombre].filter(Boolean).forEach(k => empRef.set(key(k), e)));
  const uCod = new Map(us.map(u => [key(u.codigo), u])), uNom = new Map(); us.forEach(u => uNom.set(key(u.nombre), (uNom.get(key(u.nombre)) || []).concat(u)));
  const porCod = new Map(ps.map(p => [key(p.codigo), p])), vistos = new Set(), plan = [], cambios = [];
  const njs = (await c.query('select id, nombre from nivel_jerarquico where activo')).rows, njRef = new Map(njs.map(n => [norm(n.nombre), n.id]));
  for (const f of filas) {
    const n0 = errs.length; if (!f.nombre) err(f.fila, 'Falta el nombre del cargo');
    const ex = f.codigo ? porCod.get(key(f.codigo)) : null; if (f.codigo && !ex) err(f.fila, `El código «${f.codigo}» no existe. Déjalo vacío para crear un perfil nuevo`);
    if (ex) { if (vistos.has(ex.id)) err(f.fila, `El código «${f.codigo}» está repetido en el archivo`); vistos.add(ex.id); }
    const g = norm(f.general); if (g && !['si', 'no', 's', 'n'].includes(g)) err(f.fila, `«General» debe ser Sí o No (vino «${f.general}»)`);
    const empresas = lista(f.empresas).map(x => { const e = empRef.get(key(x)); if (!e) err(f.fila, `La empresa «${x}» no existe`); return e && e.id; }).filter(Boolean);
    const unidades = lista(f.unidades).map(x => {
      const u = uCod.get(key(x)) || ((uNom.get(key(x)) || []).length === 1 ? uNom.get(key(x))[0] : null);
      if (!u) err(f.fila, (uNom.get(key(x)) || []).length > 1 ? `La unidad «${x}» existe varias veces: usa su código` : `La unidad «${x}» no existe`); return u && u.id; }).filter(Boolean);
    if (errs.length > n0) continue;
    const nj = f.nivel_j ? njRef.get(norm(f.nivel_j)) : null; if (f.nivel_j && !nj) err(f.fila, `El nivel jerárquico «${f.nivel_j}» no existe (ver Configuración › Niveles jerárquicos)`);
    if (errs.length > n0) continue;
    const b = { ...f, general: g === 'si' || g === 's', empresas, unidades, nivel_jerarquico_id: nj };
    if (!b.general && !empresas.length && !unidades.length) aviso(f.fila, `«${f.nombre}» no es general ni tiene empresas o unidades: ningún solicitante lo verá`);
    if (!ex) { const mismo = ps.find(p => key(p.nombre) === key(f.nombre)); if (mismo) aviso(f.fila, `Ya existe «${mismo.nombre}» (${mismo.codigo}). Si es el mismo cargo, pon su código para no duplicarlo`);
      cambios.push({ accion: 'nuevo', txt: f.nombre }); plan.push({ b, ex: null }); continue; }
    const d = [], alcA = JSON.stringify([ex.alcance.filter(a => a.empresa_id).map(a => a.empresa_id).sort(), ex.alcance.filter(a => a.unidad_id).map(a => a.unidad_id).sort()]);
    if (ex.nombre !== f.nombre) d.push('nombre'); if ((ex.nivel || '') !== (f.nivel || '')) d.push('nivel'); if ((ex.nivel_jerarquico_id || null) !== (b.nivel_jerarquico_id || null)) d.push('nivel jerárquico'); if (ex.general !== b.general) d.push('general');
    if (alcA !== JSON.stringify([[...empresas].sort(), [...unidades].sort()])) d.push('alcance');
    const contenido = !igual(ex.contenido, f); if (contenido) d.push('contenido → nueva versión ' + pad((ex.n_versiones || 0) + 1, 2));
    if (d.length) { cambios.push({ accion: 'cambia', txt: `${ex.codigo} · ${ex.nombre}`, detalle: d.join(', ') }); plan.push({ b, ex, datos: d.some(x => !x.startsWith('contenido')), contenido }); }
  }
  const resumen = { nuevos: cambios.filter(x => x.accion === 'nuevo').length, cambian: cambios.filter(x => x.accion === 'cambia').length, sinCambio: filas.length - cambios.length - errs.length };
  if (aplicar && !errs.length) {
    for (const p of plan) {
      if (!p.ex) { await crearC(c, usr, p.b); continue; }
      if (p.datos) await editarC(c, usr, p.ex.id, p.b);
      if (p.contenido) await nuevaVersionC(c, usr, p.ex.id, p.b, true);
    }
    await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [usr.id, 'perfil', 'carga', 'importar', resumen]);
  }
  return { errs, avisos, cambios, resumen };
}
const analizar = filas => tx(c => procesar(c, filas, null, false));
async function aplicarCarga(filas, usr) {
  return tx(async c => { const r = await procesar(c, filas, usr, true); if (r.errs.length) throw E(400, 'Los perfiles cambiaron desde la vista previa. Vuelve a subir el archivo'); return r; });
}
// ---- Control documental (ISO), registro simple por versión ----
async function guardarControlC(c, u, versionId, b, origen) {
  const f = k => /^\d{4}-\d{2}-\d{2}$/.test(String(b[k] || '')) ? b[k] : null, t = k => String(b[k] || '').trim() || null;
  const v = [versionId, f('fecha_actualizacion'), t('revisado_por'), f('fecha_revision'), t('aprobado_por'), f('fecha_aprobacion'), origen || 'manual', u && u.id];
  if (v[3] && v[5] && v[5] < v[3]) throw E(400, 'La fecha de aprobación no puede ser anterior a la de revisión');
  await c.query(`insert into perfil_version_control(version_id,fecha_actualizacion,revisado_por,fecha_revision,aprobado_por,fecha_aprobacion,origen,registrado_por) values($1,$2,$3,$4,$5,$6,$7,$8)
    on conflict (version_id) do update set fecha_actualizacion=excluded.fecha_actualizacion, revisado_por=excluded.revisado_por, fecha_revision=excluded.fecha_revision,
    aprobado_por=excluded.aprobado_por, fecha_aprobacion=excluded.fecha_aprobacion, registrado_por=excluded.registrado_por, registrado_en=now()`, v);
  const pid = (await c.query('select perfil_id, version from perfil_version where id=$1', [versionId])).rows[0];
  await hist(c, u, pid.perfil_id, 'control', { version: pid.version, revisado_por: v[2], fecha_revision: v[3], aprobado_por: v[4], fecha_aprobacion: v[5], origen: v[6] });
}
async function guardarControl(u, perfilId, versionId, b) {
  return tx(async c => {
    if (!(await c.query('select 1 from perfil_version where id=$1 and perfil_id=$2', [versionId, perfilId])).rowCount) throw E(404, 'Versión no encontrada');
    await guardarControlC(c, u, versionId, b, 'manual');
  });
}
const controles = ids => ids.length ? q('select * from perfil_version_control where version_id = any($1)', [ids]).then(r => new Map(r.rows.map(x => [x.version_id, x]))) : Promise.resolve(new Map());
const nivelesJ = () => q('select * from nivel_jerarquico where activo order by orden, nombre').then(r => r.rows);
module.exports = { nivelesJ, __igual: igual, guardarControl, guardarControlC, controles, crearC, nuevaVersionC, codigoV, contenidoDe, RESP, anios, listar, detalle, crear, editar, nuevaVersion, activarVersion, activo, paraFormulario, ancestros, aplica, validarParaRequisicion, plantilla, leer, analizar, aplicarCarga };
