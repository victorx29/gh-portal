const ExcelJS = require('exceljs'), { q, tx } = require('../db'), ES = require('./estructura'), { E } = require('../util');
// Carga masiva de grupos, empresas y unidades. Reglas:
// - La plantilla trae los datos actuales: descargar, editar y volver a subir.
// - Lo que no está en el archivo no se toca (nunca borra). Lo que está, queda como dice el archivo.
// - Las dependencias que cambian se CIERRAN hoy y se abren nuevas: la historia se conserva.
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const key = s => String(s == null ? '' : s).trim().toLowerCase();
const lista = s => String(s || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
const RIF = /^([VJGEPC])-?(\d{8})-?(\d)$/i;
const rifNorm = s => { const m = RIF.exec(String(s || '').replace(/\s/g, '')); return m ? `${m[1].toUpperCase()}-${m[2]}-${m[3]}` : null; };
const siNo = s => { const k = norm(s); if (!k || k === 'no' || k === 'n' || k === 'falso' || k === 'false' || k === '0') return false; if (k === 'si' || k === 's' || k === 'x' || k === 'verdadero' || k === 'true' || k === '1') return true; return null; };
const COLS = {
  Grupos: [['Nombre *', 'nombre', 34], ['Siglas', 'siglas', 12]],
  Empresas: [['Grupo', 'grupo', 16], ['Nombre *', 'nombre', 30], ['Razón social', 'razon_social', 40], ['Siglas', 'siglas', 10], ['RIF', 'rif', 16], ['Estado', 'estado', 18], ['Ciudad', 'ciudad', 18]],
  Unidades: [['Código *', 'codigo', 12], ['Nombre *', 'nombre', 38], ['Tipo *', 'tipo', 18], ['Grupo', 'grupo', 12], ['Empresa', 'empresa', 14], ['Depende de', 'depende', 13],
    ['Dependencia funcional', 'funcional', 22], ['Aprueba', 'aprueba', 9], ['Sirve a', 'sirve', 18]]
};

async function plantilla() {
  const [grupos, empresas, tipos, g] = await Promise.all([ES.grupos(), ES.empresas(), ES.tipos(), ES.grafo()]);
  const wb = new ExcelJS.Workbook(); wb.creator = 'Portal de Gestión Humana';
  const ins = wb.addWorksheet('Instrucciones'); ins.getColumn(1).width = 110;
  ['Carga masiva de la estructura organizativa', '',
    '1. Este archivo trae los datos actuales. Edítalo y súbelo en Configuración › Estructura › Carga masiva.',
    '2. Las columnas con * son obligatorias. No cambies los encabezados ni el nombre de las hojas.',
    '3. Lo que no aparece en el archivo no se modifica ni se borra. Lo que aparece queda exactamente como dice el archivo.',
    '4. Unidades: el Código identifica cada unidad. Para una unidad nueva, inventa un código que no exista (por ejemplo DIR-TEC).',
    '5. «Depende de» = código de la unidad superior por línea sólida (jerárquica). Vacío = unidad sin superior.',
    '6. «Dependencia funcional» = códigos de líneas punteadas, separados por coma.',
    '7. «Empresa» = siglas o nombre de la empresa dueña. Vacío = unidad corporativa del grupo.',
    '8. «Sirve a» = siglas de las empresas que atiende (servicios compartidos), separadas por coma.',
    '9. «Aprueba» = Sí si las requisiciones de esa unidad y sus dependientes se aprueban aquí (luego asigna su director en Usuarios).',
    '10. Cambiar «Depende de» cierra la dependencia anterior con fecha de hoy y abre la nueva: el historial se conserva.',
    '11. Antes de aplicar verás una vista previa con los cambios y los errores por fila.'].forEach((t, i) => { const c = ins.getCell(i + 1, 1); c.value = t; if (!i) c.font = { bold: true, size: 14 }; });
  const hoja = (nombre, filas) => {
    const ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = COLS[nombre].map(([header, k, width]) => ({ header, key: k, width }));
    const h = ws.getRow(1); h.font = { bold: true }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FD' } };
    filas.forEach(f => ws.addRow(f)); return ws;
  };
  const gs = id => { const x = grupos.find(y => y.id === id); return x ? (x.siglas || x.nombre) : ''; };
  const es = id => { const x = empresas.find(y => y.id === id); return x ? (x.siglas || x.nombre) : ''; };
  hoja('Grupos', grupos.map(x => ({ nombre: x.nombre, siglas: x.siglas || '' })));
  hoja('Empresas', empresas.map(x => ({ grupo: gs(x.grupo_id), nombre: x.nombre, razon_social: x.razon_social || '', siglas: x.siglas || '', rif: x.rif || '', estado: x.estado || '', ciudad: x.ciudad || '' })));
  const us = [...g.by.values()].sort((a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre, 'es'));
  const ws = hoja('Unidades', us.map(u => ({ codigo: u.codigo, nombre: u.nombre, tipo: u.tipo, grupo: gs(u.grupo_id), empresa: es(u.empresa_id),
    depende: u.padre_id ? g.by.get(u.padre_id).codigo : '', funcional: u.funcional.map(f => f.codigo).join(', '), aprueba: u.aprueba ? 'Sí' : 'No', sirve: u.sirve.map(s => s.siglas || s.nombre).join(', ') })));
  const tw = wb.addWorksheet('Tipos'); tw.getColumn(1).width = 26; tw.getCell('A1').value = 'Tipos de unidad (referencia)'; tw.getCell('A1').font = { bold: true };
  tipos.forEach((t, i) => { tw.getCell(i + 2, 1).value = t.nombre; });
  ws.dataValidations.add('C2:C3000', { type: 'list', allowBlank: true, formulae: [`Tipos!$A$2:$A$${tipos.length + 1}`], showErrorMessage: true, errorTitle: 'Tipo', error: 'Elige un tipo de la hoja Tipos' });
  ws.dataValidations.add('H2:H3000', { type: 'list', allowBlank: true, formulae: ['"Sí,No"'] });
  return wb.xlsx.writeBuffer();
}

// Lee el Excel a filas normalizadas (serializables: se guardan en la sesión hasta confirmar)
async function leer(buffer) {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); } catch (e) { throw E(400, 'No se pudo leer el archivo. Usa la plantilla en formato .xlsx'); }
  const out = { Grupos: [], Empresas: [], Unidades: [] };
  for (const nombre of Object.keys(out)) {
    const ws = wb.getWorksheet(nombre); if (!ws) continue;
    const idx = {}; ws.getRow(1).eachCell((c, i) => { const h = norm(c.text); const col = COLS[nombre].find(([hd]) => norm(hd) === h); if (col) idx[col[1]] = i; });
    const faltan = COLS[nombre].filter(([hd]) => hd.includes('*')).filter(([, k]) => !idx[k]);
    if (faltan.length) throw E(400, `La hoja «${nombre}» no tiene la columna «${faltan[0][0].replace(' *', '')}». Descarga la plantilla y no cambies los encabezados`);
    ws.eachRow((row, n) => {
      if (n === 1) return; const f = { fila: n };
      for (const [k, i] of Object.entries(idx)) f[k] = String(row.getCell(i).text || '').trim();
      if (Object.keys(idx).some(k => f[k])) out[nombre].push(f);
    });
  }
  if (!out.Grupos.length && !out.Empresas.length && !out.Unidades.length) throw E(400, 'El archivo no tiene filas en las hojas Grupos, Empresas o Unidades');
  if (out.Grupos.length + out.Empresas.length + out.Unidades.length > 5000) throw E(400, 'Máximo 5.000 filas por carga');
  return out;
}

// Analiza (y si aplicar=true, aplica dentro de la misma transacción). Devuelve resumen, cambios y errores por fila.
async function procesar(c, data, usr, aplicar) {
  const errs = [], err = (hoja, fila, msg) => errs.push({ hoja, fila, msg });
  const cambios = { grupos: [], empresas: [], unidades: [] }, rel = { cerrar: 0, abrir: 0 };
  const [gDB, eDB, tDB, uDB, rDB, sDB] = await Promise.all([
    c.query('select * from grupo').then(r => r.rows), c.query('select * from empresa').then(r => r.rows), c.query('select * from tipo_unidad where activo').then(r => r.rows),
    c.query('select * from unidad').then(r => r.rows), c.query('select * from unidad_relacion where hasta is null').then(r => r.rows), c.query('select * from unidad_empresa').then(r => r.rows)]);

  // --- Grupos ---
  const grupoRef = new Map(); gDB.forEach(g => { grupoRef.set(key(g.nombre), g); if (g.siglas) grupoRef.set(key(g.siglas), g); });
  const vistosG = new Set(), planG = [];
  for (const f of data.Grupos) {
    if (!f.nombre) { err('Grupos', f.fila, 'Falta el nombre'); continue; }
    if (vistosG.has(key(f.nombre))) { err('Grupos', f.fila, `«${f.nombre}» está repetido en el archivo`); continue; } vistosG.add(key(f.nombre));
    const ex = gDB.find(g => key(g.nombre) === key(f.nombre)), sig = f.siglas || null;
    if (sig) { const otro = grupoRef.get(key(sig)); if (otro && (!ex || otro.id !== ex.id)) { err('Grupos', f.fila, `Las siglas «${sig}» ya las usa «${otro.nombre}»`); continue; } }
    const g = ex ? { ...ex } : { id: null, nombre: f.nombre, siglas: sig, _nuevo: true };
    if (!ex) cambios.grupos.push({ accion: 'nuevo', txt: f.nombre });
    else if ((ex.siglas || null) !== sig) { cambios.grupos.push({ accion: 'cambia', txt: f.nombre, detalle: `siglas: ${ex.siglas || '—'} → ${sig || '—'}` }); g.siglas = sig; g._cambia = true; }
    planG.push(g); grupoRef.set(key(g.nombre), g); if (g.siglas) grupoRef.set(key(g.siglas), g);
  }
  // --- Empresas ---
  const empRef = new Map(); const regE = e => { empRef.set(key(e.nombre), e); if (e.razon_social) empRef.set(key(e.razon_social), e); if (e.siglas) empRef.set(key(e.siglas), e); if (e.rif) empRef.set(key(e.rif), e); };
  eDB.forEach(regE);
  const planE = [], vistosE = new Set();
  for (const f of data.Empresas) {
    const fila = f.fila; if (!f.nombre) { err('Empresas', fila, 'Falta el nombre'); continue; }
    const g = grupoRef.get(key(f.grupo)) || (!f.grupo && gDB.length === 1 ? gDB[0] : null); if (!g) { err('Empresas', fila, f.grupo ? `El grupo «${f.grupo}» no existe` : 'Falta el grupo'); continue; }
    let rif = null; if (f.rif) { rif = rifNorm(f.rif); if (!rif) { err('Empresas', fila, `RIF «${f.rif}» inválido (formato J-12345678-9)`); continue; } }
    const ex = (rif && eDB.find(e => e.rif && rifNorm(e.rif) === rif)) || (f.siglas && eDB.find(e => e.siglas && key(e.siglas) === key(f.siglas))) || eDB.find(e => key(e.nombre) === key(f.nombre));
    const k = ex ? 'id' + ex.id : 'n' + key(f.nombre); if (vistosE.has(k)) { err('Empresas', fila, `«${f.nombre}» está repetida en el archivo`); continue; } vistosE.add(k);
    const conflicto = (campo, v) => { const o = empRef.get(key(v)); return o && (!ex || o.id !== ex.id) && o !== undefined && o._fila !== fila ? o : null; };
    if (f.siglas && conflicto('siglas', f.siglas)) { err('Empresas', fila, `Las siglas «${f.siglas}» ya las usa «${conflicto('siglas', f.siglas).nombre}»`); continue; }
    if (rif && conflicto('rif', rif)) { err('Empresas', fila, `El RIF ${rif} ya lo usa «${conflicto('rif', rif).nombre}»`); continue; }
    const v = { nombre: f.nombre, razon_social: f.razon_social || null, siglas: f.siglas || null, rif, estado: f.estado || null, ciudad: f.ciudad || null, grupo: g };
    const e = ex ? { ...ex, ...v } : { id: null, _nuevo: true, activa: true, ...v }; e._fila = fila;
    if (!ex) cambios.empresas.push({ accion: 'nuevo', txt: f.nombre });
    else {
      const dif = ['nombre', 'razon_social', 'siglas', 'rif', 'estado', 'ciudad'].filter(x => (ex[x] || null) !== (v[x] || null)).concat(ex.grupo_id !== g.id ? ['grupo'] : []);
      if (dif.length) { cambios.empresas.push({ accion: 'cambia', txt: ex.nombre, detalle: dif.join(', ') }); e._cambia = true; }
    }
    planE.push(e); regE(e);
  }
  // --- Unidades ---
  const tipoRef = new Map(tDB.map(t => [norm(t.nombre), t])), uByCod = new Map(uDB.map(u => [key(u.codigo), u]));
  const solida = new Map(rDB.filter(r => r.tipo === 'solida').map(r => [r.unidad_id, r])), funcDB = rDB.filter(r => r.tipo === 'funcional');
  const filasU = new Map(), planU = [];
  for (const f of data.Unidades) { const k = key(f.codigo); if (!k) { err('Unidades', f.fila, 'Falta el código'); continue; } if (filasU.has(k)) { err('Unidades', f.fila, `El código «${f.codigo}» está repetido en el archivo`); continue; } filasU.set(k, f); }
  const existeCod = k => uByCod.has(k) || filasU.has(k);
  for (const [k, f] of filasU) {
    const n0 = errs.length, fila = f.fila;
    if (!f.nombre) err('Unidades', fila, 'Falta el nombre');
    const t = tipoRef.get(norm(f.tipo)); if (!t) err('Unidades', fila, f.tipo ? `El tipo «${f.tipo}» no existe (ver hoja Tipos)` : 'Falta el tipo');
    const g = grupoRef.get(key(f.grupo)) || (!f.grupo && gDB.length === 1 ? gDB[0] : null); if (!g) err('Unidades', fila, f.grupo ? `El grupo «${f.grupo}» no existe` : 'Falta el grupo');
    const e = f.empresa ? empRef.get(key(f.empresa)) : null; if (f.empresa && !e) err('Unidades', fila, `La empresa «${f.empresa}» no existe`);
    const dep = key(f.depende); if (dep && !existeCod(dep)) err('Unidades', fila, `«Depende de»: el código «${f.depende}» no existe`); if (dep && dep === k) err('Unidades', fila, 'Una unidad no puede depender de sí misma');
    const fun = [...new Set(lista(f.funcional).map(key))]; fun.filter(x => !existeCod(x)).forEach(x => err('Unidades', fila, `«Dependencia funcional»: el código «${x}» no existe`)); if (fun.includes(k)) err('Unidades', fila, 'Una unidad no puede depender funcionalmente de sí misma');
    const sir = lista(f.sirve).map(x => ({ x, e: empRef.get(key(x)) })); sir.filter(s => !s.e).forEach(s => err('Unidades', fila, `«Sirve a»: la empresa «${s.x}» no existe`));
    const ap = siNo(f.aprueba); if (ap === null) err('Unidades', fila, `«Aprueba» debe ser Sí o No (vino «${f.aprueba}»)`);
    if (errs.length > n0) continue;
    planU.push({ k, f, t, g, e, dep, fun, sir: sir.map(s => s.e), ap, ex: uByCod.get(k) || null });
  }
  // Ciclos: grafo final = vigente en BD, reemplazado por lo que dice el archivo
  const padreFinal = new Map(); uDB.forEach(u => { const r = solida.get(u.id); padreFinal.set(key(u.codigo), r ? key(uDB.find(x => x.id === r.padre_id).codigo) : ''); });
  planU.forEach(p => padreFinal.set(p.k, p.dep));
  const enCiclo = new Set();
  for (const ini of padreFinal.keys()) { const vis = []; let x = ini; while (x && !vis.includes(x) && vis.length < 500) { vis.push(x); x = padreFinal.get(x); } if (x && x === ini) vis.forEach(v => enCiclo.add(v)); }
  planU.filter(p => enCiclo.has(p.k)).forEach(p => err('Unidades', p.f.fila, `«${p.f.codigo}» queda en un ciclo de dependencias (${[...enCiclo].join(' → ')})`));

  // Diferencias por unidad
  const codDe = id => key((uDB.find(u => u.id === id) || {}).codigo);
  for (const p of planU) {
    const ex = p.ex, d = [];
    const padreAct = ex && solida.get(ex.id) ? codDe(solida.get(ex.id).padre_id) : '';
    const funAct = ex ? funcDB.filter(r => r.unidad_id === ex.id).map(r => codDe(r.padre_id)) : [];
    const sirAct = ex ? sDB.filter(s => s.unidad_id === ex.id).map(s => s.empresa_id).sort() : [];
    p.cambiaPadre = padreAct !== p.dep; p.funCerrar = funAct.filter(x => !p.fun.includes(x)); p.funAbrir = p.fun.filter(x => !funAct.includes(x));
    p.sirIds = [...new Set(p.sir.map(e => e.id || e))]; p.cambiaSir = !ex || p.sir.some(e => !e.id) || sirAct.join() !== [...p.sirIds].sort().join();
    if (!ex) { cambios.unidades.push({ accion: 'nuevo', txt: `${p.f.codigo} · ${p.f.nombre}` }); }
    else {
      if (ex.nombre !== p.f.nombre) d.push('nombre'); if (ex.tipo_id !== p.t.id) d.push('tipo'); if (ex.grupo_id !== p.g.id) d.push('grupo');
      if ((ex.empresa_id || null) !== (p.e ? p.e.id : null) || (p.e && !p.e.id)) d.push('empresa'); if (ex.aprueba !== p.ap) d.push(p.ap ? 'ahora aprueba' : 'deja de aprobar');
      if (p.cambiaPadre) d.push(`depende de: ${padreAct || '—'} → ${p.dep || '—'}`); if (p.funCerrar.length || p.funAbrir.length) d.push('dependencia funcional'); if (p.cambiaSir && (sirAct.length || p.sirIds.length)) d.push('sirve a');
      p.campos = d.filter(x => ['nombre', 'tipo', 'grupo', 'empresa', 'ahora aprueba', 'deja de aprobar'].includes(x)).length > 0;
      if (d.length) cambios.unidades.push({ accion: 'cambia', txt: `${p.f.codigo} · ${ex.nombre}`, detalle: d.join(', ') });
    }
    if (p.cambiaPadre) { if (padreAct) rel.cerrar++; if (p.dep) rel.abrir++; }
    rel.cerrar += p.funCerrar.length; rel.abrir += p.funAbrir.length;
  }
  const resumen = { grupos: cambios.grupos.length, empresas: cambios.empresas.length, unidades: cambios.unidades.length, sinCambio: planU.filter(p => p.ex).length - cambios.unidades.filter(x => x.accion === 'cambia').length, rel };
  if (!aplicar || errs.length) return { errs, cambios, resumen };

  // ---------- Aplicar ----------
  for (const g of planG) {
    if (g._nuevo) g.id = (await c.query('insert into grupo(nombre,siglas) values($1,$2) returning id', [g.nombre, g.siglas])).rows[0].id;
    else if (g._cambia) await c.query('update grupo set siglas=$2 where id=$1', [g.id, g.siglas]);
  }
  for (const e of planE) {
    const v = [e.nombre, e.razon_social, e.siglas, e.rif, e.estado, e.ciudad, e.grupo.id];
    if (e._nuevo) e.id = (await c.query('insert into empresa(nombre,razon_social,siglas,rif,estado,ciudad,grupo_id) values($1,$2,$3,$4,$5,$6,$7) returning id', v)).rows[0].id;
    else if (e._cambia) await c.query('update empresa set nombre=$2,razon_social=$3,siglas=$4,rif=$5,estado=$6,ciudad=$7,grupo_id=$8 where id=$1', [e.id, ...v]);
  }
  const idDe = new Map(uDB.map(u => [key(u.codigo), u.id]));
  for (const p of planU) {
    const v = [p.f.nombre, p.t.id, p.g.id, p.e ? p.e.id : null, p.ap];
    if (!p.ex) { const id = (await c.query('insert into unidad(codigo,nombre,tipo_id,grupo_id,empresa_id,aprueba) values($1,$2,$3,$4,$5,$6) returning id', [p.f.codigo.trim(), ...v])).rows[0].id; idDe.set(p.k, id); await ES.histU(c, usr, id, 'crear', { origen: 'carga masiva' }); }
    else if (p.campos) { await c.query('update unidad set nombre=$2,tipo_id=$3,grupo_id=$4,empresa_id=$5,aprueba=$6 where id=$1', [p.ex.id, ...v]); await ES.histU(c, usr, p.ex.id, 'editar', { origen: 'carga masiva' }); }
  }
  // Primero se cierran todas las dependencias que cambian y luego se abren las nuevas: así un intercambio A↔B no se ve como ciclo a mitad de camino
  for (const p of planU.filter(x => x.ex && x.cambiaPadre)) { const r = solida.get(p.ex.id); if (r) await c.query('update unidad_relacion set hasta=current_date, cerrado_por=$2 where id=$1', [r.id, usr.id]); }
  for (const p of planU.filter(x => x.cambiaPadre && x.dep)) {
    const id = idDe.get(p.k);
    await c.query("insert into unidad_relacion(unidad_id,padre_id,tipo,motivo,creado_por) values($1,$2,'solida','Carga masiva',$3)", [id, idDe.get(p.dep), usr.id]);
    await ES.histU(c, usr, id, 'dependencia', { a: idDe.get(p.dep), origen: 'carga masiva' });
  }
  for (const p of planU) {
    const id = idDe.get(p.k);
    for (const x of p.funCerrar) { const r = funcDB.find(r => r.unidad_id === id && codDe(r.padre_id) === x); if (r) await c.query('update unidad_relacion set hasta=current_date, cerrado_por=$2 where id=$1', [r.id, usr.id]); }
    for (const x of p.funAbrir) await c.query("insert into unidad_relacion(unidad_id,padre_id,tipo,motivo,creado_por) values($1,$2,'funcional','Carga masiva',$3)", [id, idDe.get(x), usr.id]);
    if (p.cambiaSir) await ES.sirveAC(c, usr, id, p.sir.map(e => e.id));
  }
  // Los códigos UO-NNNN de la carga no deben chocar con los que genera la pantalla
  await c.query(`select setval('unidad_seq', greatest(1, (select coalesce(max(substring(codigo from '^UO-([0-9]+)$')::int), 0) from unidad), (select last_value from unidad_seq)))`);
  await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [usr.id, 'estructura', 'carga', 'importar', resumen]);
  return { errs, cambios, resumen };
}
const analizar = data => tx(c => procesar(c, data, null, false));
async function aplicar(data, usr) {
  return tx(async c => {
    await c.query('lock table unidad_relacion in share row exclusive mode');
    const r = await procesar(c, data, usr, true);
    if (r.errs.length) throw E(400, 'La estructura cambió desde la vista previa y el archivo ya no es válido. Vuelve a subirlo');
    return r;
  });
}
module.exports = { plantilla, leer, analizar, aplicar };
