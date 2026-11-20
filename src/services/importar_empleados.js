// Importación del Listado de Activos de Gestión Humana (0.8.1). Lee el Excel tal como lo lleva GH (varias hojas:
// nómina, becarios, pasantes, aprendices…), cruza cada persona con la estructura y la plantilla del portal y, al aplicar,
// crea su ficha y su relación laboral activa en una plaza. Reglas (decisiones del 18 y 19-11-2026):
//  - Departamento → unidad y cargo → perfil por la tabla de equivalencias (o por el nombre exacto del perfil).
//  - Sin plaza libre del cargo en esa área: se crea una plaza «por regularizar» (no cuenta en el HC autorizado).
//  - Empresas sin estructura propia (sin equivalencias de sus departamentos): sus filas quedan «pendientes por estructura»,
//    salvo las de departamentos corporativos con equivalencia general (por ejemplo, Tecnología).
//  - Se guarda la fila completa del Listado. Nada se borra; volver a subir el mismo archivo no cambia nada.
const ExcelJS = require('exceljs'), { q, tx } = require('../db'), ES = require('./estructura'), PF = require('./perfiles'), PT = require('./plantilla'), EM = require('./empleados'), { E } = require('../util');

const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const limpio = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
// Encabezados del Listado → campo del portal (se comparan sin acentos, espacios ni «:»)
const CAMPOS = { empresa: 'empresa', ubicacion: 'ubicacion', trabajador: 'nombre', nivelacademico: 'nivel_academico', titulo: 'titulo', sexo: 'sexo',
  cedula: 'cedula', fechadeingreso: 'fecha_ingreso', culminaciondecontrato: 'fin_contrato', cargo: 'cargo', supervisorinmediato: 'supervisor',
  direcciondedependencia: 'direccion', departamento: 'departamento', tipodeempleado: 'tipo_empleado', fechadenacimiento: 'fecha_nacimiento', hijos: 'hijos' };
const MOD_HOJA = { becarios: 'becario', becario: 'becario', pasantes: 'pasante', pasante: 'pasante', aprendiz: 'aprendiz', aprendices: 'aprendiz' };
const EXCLUIDAS = new Set(['apbarogroup']);   // presidentes y socios del grupo: no son plazas de la plantilla

const iso = d => d.toISOString().slice(0, 10);
function fecha(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : iso(v);
  const s = String(v).trim(), m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) { const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); return isNaN(d) ? null : iso(d); }
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}
const textoCelda = c => { const v = valorCelda(c); return v == null ? '' : (v instanceof Date ? iso(v) : String(v)); };
const valorCelda = c => { const v = c.value; if (v == null) return null; if (v instanceof Date) return v; if (typeof v === 'object') return v.result != null ? v.result : (v.text || (v.richText ? v.richText.map(t => t.text).join('') : null)); return v; };

// ---------- Lectura del Excel ----------
async function leer(buffer) {
  const wb = new ExcelJS.Workbook(); try { await wb.xlsx.load(buffer); } catch (e) { throw E(400, 'No se pudo leer el archivo. Usa el Listado en formato .xlsx'); }
  const filas = [];
  wb.eachSheet(ws => {
    // Una hoja puede traer varias tablas (por ejemplo «Personal fijo» y «Personal contratado»), cada una con su fila de encabezados
    // y su propio orden de columnas: cada fila se lee con el último encabezado visto. Las hojas sin encabezado (resúmenes) se ignoran.
    const modHoja = MOD_HOJA[norm(ws.name)] || null, socio = norm(ws.name) === 'socio';
    let idx = null;
    ws.eachRow((row, n) => {
      const m = {}, orig = {}; row.eachCell((c, i) => { const t = textoCelda(c), k = norm(t); if (k) { m[k] = i; orig[i] = limpio(t).replace(/:$/, ''); } });
      if (m.trabajador && m.cedula) { idx = { m, orig }; return; }
      if (!idx) return;
      const f = { hoja: ws.name, fila: n, datos: {} };
      for (const [k, i] of Object.entries(idx.m)) {
        const v = valorCelda(row.getCell(i)), campo = CAMPOS[k];
        if (idx.orig[i] && v != null && v !== '') f.datos[idx.orig[i]] = v instanceof Date ? iso(v) : limpio(v);
        if (campo) f[campo] = v instanceof Date ? v : (v == null ? null : limpio(v));
      }
      if (!f.nombre && !f.cedula) return;
      if (Object.keys(f.datos).length <= 1) return;   // título de sección («Personal contratado»), no una persona
      // Encabezado corrido dentro de la hoja: varias celdas son nombres de columna
      if (Object.values(f.datos).filter(v => CAMPOS[norm(v)] || norm(v) === 'edad').length >= 2) return;
      f.cedula_norm = EM.cedulaNorm(f.cedula);
      f.fecha_ingreso = fecha(f.fecha_ingreso); f.fin_contrato = fecha(f.fin_contrato); f.fecha_nacimiento = fecha(f.fecha_nacimiento);
      f.hijos = /^\d+$/.test(String(f.hijos || '')) ? +f.hijos : null;
      const tipo = norm(f.tipo_empleado);
      f.modalidad = modHoja || MOD_HOJA[tipo] || 'nomina';
      f.excluido = socio || tipo === 'socio' || EXCLUIDAS.has(norm(f.empresa));
      filas.push(f);
    });
  });
  if (!filas.length) throw E(400, 'No encontré filas de personal: el archivo debe tener hojas con las columnas «Trabajador» y «Cédula»');
  if (filas.length > 5000) throw E(400, 'Máximo 5.000 personas por carga');
  return filas;
}

// ---------- Contexto: estructura, plantilla, equivalencias y personas ----------
async function contexto(c) {
  const f = (await c.query('select current_date::text d')).rows[0].d;
  // Consultas una tras otra: dentro de una transacción el cliente no admite consultas en paralelo
  const sql = t => c.query(t), emps = await sql('select id, nombre, razon_social, siglas from empresa where activa');
  const perfiles = await sql('select id, codigo, nombre, version_activa_id from perfil where activo'), eqs = await sql('select * from equivalencia');
  const puestos = await sql('select p.id, p.unidad_id, p.perfil_id from puesto p where p.activo');
  const plazas = await sql('select z.* from plaza z join puesto p on p.id=z.puesto_id where p.activo');
  const ocup = await sql("select plaza_id from relacion_laboral where estado in ('activo','por_ingresar') and plaza_id is not null");
  const reqs = await sql(`select plaza_id from requisicion r where r.plaza_id is not null and ${PT.ABIERTA}`);
  const trabs = await sql('select id, cedula, nombres, datos, sexo, hijos, nivel_academico, titulo, fecha_nacimiento from trabajador');
  const rels = await sql("select rl.*, z.puesto_id from relacion_laboral rl left join plaza z on z.id=rl.plaza_id where rl.estado in ('activo','por_ingresar')");
  const g = await ES.grafo(f);
  const empRef = new Map(); emps.rows.forEach(e => [e.razon_social, e.nombre, e.siglas].filter(Boolean).forEach(k => empRef.set(norm(k), e)));
  const pfNom = new Map(); perfiles.rows.forEach(p => pfNom.set(norm(p.nombre), (pfNom.get(norm(p.nombre)) || []).concat(p)));
  const eq = new Map(eqs.rows.map(e => [e.tipo + '|' + (e.empresa_id || 0) + '|' + e.origen_norm, e]));
  const conEstructura = new Set(eqs.rows.filter(e => e.tipo === 'departamento' && e.empresa_id).map(e => e.empresa_id));
  return { f, empRef, perfiles: new Map(perfiles.rows.map(p => [p.id, p])), pfNom, eq, conEstructura, g,
    puestos: puestos.rows, plazas: plazas.rows, ocupadas: new Set(ocup.rows.map(r => r.plaza_id).concat(reqs.rows.map(r => r.plaza_id))),
    trabPorCed: new Map(trabs.rows.map(t => [t.cedula, t])), relPorTrab: rels.rows.reduce((m, r) => m.set(r.trabajador_id, (m.get(r.trabajador_id) || []).concat(r)), new Map()) };
}
const busca = (cx, tipo, empresaId, texto) => cx.eq.get(tipo + '|' + (empresaId || 0) + '|' + norm(texto)) || cx.eq.get(tipo + '|0|' + norm(texto)) || null;
const vigente = (z, f) => PT.estado(z, f) === 'vigente';
// Datos personales y del Listado: ¿cambió algo respecto a la ficha?
const fichaDe = f => ({ nombres: f.nombre, sexo: f.sexo || null, hijos: f.hijos, nivel_academico: f.nivel_academico || null, titulo: f.titulo || null, fecha_nacimiento: f.fecha_nacimiento, datos: f.datos });
const ordenado = o => JSON.stringify(Object.keys(o || {}).sort().reduce((a, k) => (a[k] = o[k], a), {}));
const fichaCambia = (t, f) => t.nombres !== f.nombre || (t.sexo || null) !== (f.sexo || null) || (t.hijos ?? null) !== f.hijos || (t.nivel_academico || null) !== (f.nivel_academico || null)
  || (t.titulo || null) !== (f.titulo || null) || (t.fecha_nacimiento || null) !== f.fecha_nacimiento || ordenado(t.datos) !== ordenado(f.datos);

// ---------- Análisis (vista previa) y aplicación: una sola lógica ----------
async function procesar(c, filas, usr, aplicar, archivo) {
  const cx = await contexto(c), errs = [], avisos = [], pend = { estructura: new Map(), departamento: new Map() };
  const err = (f, m) => errs.push({ fila: f.hoja + ' · ' + f.fila, msg: m }), aviso = (f, m) => avisos.push({ fila: f.hoja + ' · ' + f.fila, msg: m });
  const r = { nuevos: [], actualizan: [], sinCambio: 0, difieren: [], excluidos: 0, perfilesNuevos: new Map(), puestosNuevos: new Map(), plazasNuevas: [], plazasExistentes: 0 };
  // Cédulas repetidas en el archivo: error (cada persona una sola vez)
  const vistas = new Map();
  for (const f of filas) {
    if (f.excluido) { r.excluidos++; continue; }
    if (!f.cedula_norm) { err(f, `«${f.nombre || 'Sin nombre'}» no tiene cédula`); continue; }
    if (!f.nombre) { err(f, 'Falta el nombre del trabajador'); continue; }
    if (vistas.has(f.cedula_norm)) { err(f, `La cédula de «${f.nombre}» se repite (también en ${vistas.get(f.cedula_norm)})`); continue; }
    vistas.set(f.cedula_norm, f.hoja + ' · ' + f.fila);
  }
  const libres = new Map();   // plazas que esta carga ya asignó (para no dar la misma plaza a dos personas)
  for (const f of filas) {
    if (f.excluido || !f.cedula_norm || !f.nombre || vistas.get(f.cedula_norm) !== f.hoja + ' · ' + f.fila) continue;
    const emp = cx.empRef.get(norm(f.empresa)) || null;
    // Departamento → unidad; si el departamento no tiene equivalencia, se intenta con la «Dirección de dependencia» del Listado
    const eqDep = (f.departamento && busca(cx, 'departamento', emp && emp.id, f.departamento)) || (f.direccion && busca(cx, 'departamento', emp && emp.id, f.direccion)) || null;
    if (!eqDep) {
      if (!emp || !cx.conEstructura.has(emp.id)) { const k = limpio(f.empresa) || 'Sin empresa'; pend.estructura.set(k, (pend.estructura.get(k) || 0) + 1); }
      else { const k = (emp.siglas || emp.nombre) + ' · ' + (limpio(f.departamento) || 'Sin departamento'); pend.departamento.set(k, (pend.departamento.get(k) || 0) + 1); }
      continue;
    }
    if (!emp) { const k = limpio(f.empresa) || 'Sin empresa'; pend.estructura.set(k, (pend.estructura.get(k) || 0) + 1); continue; }   // empresa que el portal no tiene
    if (!f.fecha_ingreso) aviso(f, `«${f.nombre}»: sin fecha de ingreso válida; queda vacía`);
    // Cargo → perfil: equivalencia, o nombre exacto; si no hay, se crea un perfil mínimo con ese nombre
    const cargo = limpio(f.cargo) || 'Sin cargo', eqC = busca(cx, 'cargo', emp.id, cargo);
    let perfil = eqC ? cx.perfiles.get(eqC.perfil_id) : null;
    if (!perfil) { const l = cx.pfNom.get(norm(cargo)) || []; perfil = l.length === 1 ? l[0] : null; if (l.length > 1) aviso(f, `Hay varios perfiles «${cargo}»: se usa ${l[0].codigo}. Defínelo en las equivalencias`); if (l.length > 1) perfil = l[0]; }
    const pk = perfil ? 'p' + perfil.id : 'n' + norm(cargo);
    if (!perfil && !r.perfilesNuevos.has(pk)) r.perfilesNuevos.set(pk, { nombre: cargo, unidad_id: eqDep.unidad_id, personas: 0 });
    if (!perfil) r.perfilesNuevos.get(pk).personas++;
    // Persona ya registrada en el portal
    const t = cx.trabPorCed.get(f.cedula_norm), rels = t ? (cx.relPorTrab.get(t.id) || []) : [];
    if (t && rels.length) {
      const act = rels.find(x => x.estado === 'activo'), desc = ES.descendientes(cx.g.by, eqDep.unidad_id);
      const pu = act && act.puesto_id && cx.puestos.find(p => p.id === act.puesto_id);
      const igual = act && pu && perfil && pu.perfil_id === perfil.id && desc.has(pu.unidad_id);
      if (!igual) r.difieren.push({ f, motivo: !act ? 'tiene un ingreso pendiente en el portal' : 'en el portal ocupa otra plaza o cargo: regístralo como movimiento' });
      if (fichaCambia(t, f)) r.actualizan.push({ f, t }); else if (igual) r.sinCambio++;
      continue;
    }
    // Puesto: el del perfil dentro del área (la unidad equivalente o sus dependientes); si no existe, uno nuevo en la unidad
    const desc = ES.descendientes(cx.g.by, eqDep.unidad_id);
    const candidatos = perfil ? cx.puestos.filter(p => p.perfil_id === perfil.id && desc.has(p.unidad_id)) : [];
    candidatos.sort((a, b) => (a.unidad_id === eqDep.unidad_id ? 0 : 1) - (b.unidad_id === eqDep.unidad_id ? 0 : 1));
    let puesto = null, plaza = null;
    for (const p of candidatos) { const z = cx.plazas.filter(z => z.puesto_id === p.id && z.modalidad === f.modalidad && vigente(z, cx.f) && !cx.ocupadas.has(z.id) && !libres.has(z.id)).sort((a, b) => (b.empresa_id === emp.id) - (a.empresa_id === emp.id)).find(z => z.empresa_id === emp.id || !z.empresa_id); if (z) { puesto = p; plaza = z; break; } }
    if (!puesto && candidatos.length) puesto = candidatos[0];
    if (plaza) { libres.set(plaza.id, true); r.plazasExistentes++; }
    else {
      const pkPuesto = puesto ? 'e' + puesto.id : pk + '|' + eqDep.unidad_id;
      if (!puesto && !r.puestosNuevos.has(pkPuesto)) r.puestosNuevos.set(pkPuesto, { unidad_id: eqDep.unidad_id, perfil: perfil ? perfil.nombre : cargo, pk });
      r.plazasNuevas.push({ pkPuesto, puesto_id: puesto && puesto.id, empresa_id: emp.id, modalidad: f.modalidad, f });
    }
    r.nuevos.push({ f, emp, eqDep, perfil, pk, puesto, plaza, pkPuesto: plaza ? null : (puesto ? 'e' + puesto.id : pk + '|' + eqDep.unidad_id) });
  }
  // Supervisor inmediato: el Listado suele traer nombre y apellido cortos («Laura Guevara») y la persona su nombre completo.
  // Se vincula si las palabras del supervisor están todas en el nombre de UNA sola persona (del archivo o del portal).
  const palabras = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-zñ]+/).filter(w => w.length > 2 && !['del', 'las', 'los'].includes(w));
  const personas = new Map();
  for (const f of filas) if (f.nombre && f.cedula_norm && !f.excluido) personas.set(f.cedula_norm, palabras(f.nombre));
  for (const t of cx.trabPorCed.values()) if (!personas.has(t.cedula)) personas.set(t.cedula, palabras(t.nombres));
  const cacheSup = new Map(), supDe = txt => {
    const k = norm(txt); if (cacheSup.has(k)) return cacheSup.get(k);
    const ws = palabras(txt), hits = ws.length >= 2 ? [...personas].filter(([, p]) => ws.every(w => p.includes(w))).map(([c]) => c) : [];
    const r = hits.length === 1 ? hits[0] : null; cacheSup.set(k, r); return r;
  };
  let supOk = 0, supNo = 0;
  for (const n of r.nuevos) { n.supervisorCed = n.f.supervisor ? supDe(n.f.supervisor) : null; if (n.f.supervisor) (n.supervisorCed ? supOk++ : supNo++); }
  const unidadNom = id => { const u = cx.g.by.get(id); return u ? u.nombre + ' (' + u.codigo + ')' : '—'; };
  const resumen = { personas: filas.length, nuevas: r.nuevos.length, actualizan: r.actualizan.length, sinCambio: r.sinCambio, difieren: r.difieren.length, excluidas: r.excluidos,
    pendEstructura: [...pend.estructura.values()].reduce((a, b) => a + b, 0), pendDepartamento: [...pend.departamento.values()].reduce((a, b) => a + b, 0),
    perfilesNuevos: r.perfilesNuevos.size, puestosNuevos: r.puestosNuevos.size, plazasPorRegularizar: r.plazasNuevas.length, plazasExistentes: r.plazasExistentes, supervisores: supOk, supervisoresSinVinculo: supNo };
  const cambios = [
    ...[...r.perfilesNuevos.values()].map(p => ({ accion: 'nuevo', txt: 'Perfil mínimo «' + p.nombre + '»', detalle: p.personas + ' persona(s) · alcance ' + unidadNom(p.unidad_id) })),
    ...[...r.puestosNuevos.values()].map(p => ({ accion: 'nuevo', txt: 'Puesto «' + p.perfil + '» en ' + unidadNom(p.unidad_id) })),
    ...r.nuevos.map(n => ({ accion: 'nuevo', txt: n.f.nombre, detalle: [n.perfil ? n.perfil.nombre : limpio(n.f.cargo), unidadNom(n.puesto ? n.puesto.unidad_id : n.eqDep.unidad_id), n.plaza ? 'plaza ' + n.plaza.codigo : 'plaza nueva «por regularizar»'].join(' · ') })),
    ...r.actualizan.map(a => ({ accion: 'cambia', txt: a.f.nombre, detalle: 'actualiza datos de la ficha' }))];
  r.difieren.forEach(d => aviso(d.f, `«${d.f.nombre}» ${d.motivo}; la importación no lo cambia`));
  const pendientes = { estructura: [...pend.estructura].sort((a, b) => b[1] - a[1]), departamento: [...pend.departamento].sort((a, b) => b[1] - a[1]) };
  if (!aplicar || errs.length) return { errs, avisos, cambios, resumen, pendientes };

  // ---- Aplicar (todo en la misma transacción) ----
  const imp = (await c.query('insert into importacion(tipo,archivo,resumen,usuario_id) values($1,$2,$3,$4) returning id', ['listado_activos', archivo || null, resumen, usr.id])).rows[0].id;
  const perfilId = new Map();
  for (const [pk, p] of r.perfilesNuevos) perfilId.set(pk, await PF.crearC(c, usr, { nombre: p.nombre, unidades: [p.unidad_id] }));
  const perfilDe = n => n.perfil ? n.perfil.id : perfilId.get(n.pk);
  const puestoId = new Map();
  for (const [k, p] of r.puestosNuevos) {
    const pid = p.pk.startsWith('p') ? +p.pk.slice(1) : perfilId.get(p.pk);
    let id = (await c.query('select id from puesto where unidad_id=$1 and perfil_id=$2 and activo', [p.unidad_id, pid])).rows[0];
    if (!id) { id = (await c.query('insert into puesto(unidad_id,perfil_id,creado_por) values($1,$2,$3) returning id', [p.unidad_id, pid, usr.id])).rows[0];
      await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [usr.id, 'puesto', String(id.id), 'crear', { origen: 'carga inicial del Listado', importacion: imp }]); }
    puestoId.set(k, id.id);
  }
  const trabId = new Map();
  for (const n of r.nuevos) {
    const fi = fichaDe(n.f);
    const t = (await c.query(`insert into trabajador(cedula,nombres,sexo,hijos,nivel_academico,titulo,fecha_nacimiento,datos,actualizado_en) values($1,$2,$3,$4,$5,$6,$7,$8,now()) returning id`,
      [n.f.cedula_norm, fi.nombres, fi.sexo, fi.hijos, fi.nivel_academico, fi.titulo, fi.fecha_nacimiento, fi.datos])).rows[0].id;
    trabId.set(n.f.cedula_norm, t);
    let plaza = n.plaza;
    if (!plaza) {
      const pu = n.puesto ? n.puesto.id : puestoId.get(n.pkPuesto);
      const nueva = (await PT.crearPlazasC(c, usr, pu, { n: 1, modalidad: n.f.modalidad, desde: n.f.fecha_ingreso, congelada: false, empresa_id: n.emp.id,
        motivo: 'Carga inicial del Listado de Activos: plaza ocupada sin autorización registrada' }, 'carga_inicial')).filas[0];
      await c.query('update plaza set por_regularizar=true where id=$1', [nueva.id]);
      plaza = { id: nueva.id, codigo: nueva.codigo, puesto_id: pu, empresa_id: n.emp.id };
    } else if (!plaza.empresa_id) await c.query('update plaza set empresa_id=$2 where id=$1', [plaza.id, n.emp.id]);
    const pu = (await c.query('select p.unidad_id, p.perfil_id, pf.version_activa_id, pf.nombre from plaza z join puesto p on p.id=z.puesto_id join perfil pf on pf.id=p.perfil_id where z.id=$1', [plaza.id])).rows[0];
    const rel = (await c.query(`insert into relacion_laboral(trabajador_id,empresa_id,unidad_id,cargo,plaza_id,perfil_version_id,origen,estado,fecha_ingreso,fecha_fin_contrato,
        ubicacion,tipo_empleado,departamento_origen,supervisor_texto,importacion_id,confirmado_por,confirmado_en)
      values($1,$2,$3,$4,$5,$6,'carga_inicial','activo',$7,$8,$9,$10,$11,$12,$13,$14,now()) returning id`,
      [t, n.emp.id, pu.unidad_id, limpio(n.f.cargo) || pu.nombre, plaza.id, pu.version_activa_id, n.f.fecha_ingreso, n.f.fin_contrato, n.f.ubicacion || null,
        n.f.tipo_empleado || null, n.f.departamento || null, n.f.supervisor || null, imp, usr.id])).rows[0].id;
    n.relId = rel;
  }
  for (const n of r.nuevos) if (n.supervisorCed) {
    const sup = trabId.get(n.supervisorCed) || (cx.trabPorCed.get(n.supervisorCed) || {}).id;
    if (sup && sup !== trabId.get(n.f.cedula_norm)) await c.query('update relacion_laboral set supervisor_id=$2 where id=$1', [n.relId, sup]);
  }
  for (const a of r.actualizan) {
    const fi = fichaDe(a.f);
    await c.query('update trabajador set nombres=$2, sexo=$3, hijos=$4, nivel_academico=$5, titulo=$6, fecha_nacimiento=$7, datos=$8, actualizado_en=now() where id=$1',
      [a.t.id, fi.nombres, fi.sexo, fi.hijos, fi.nivel_academico, fi.titulo, fi.fecha_nacimiento, fi.datos]);
  }
  await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [usr.id, 'importacion', String(imp), 'listado_activos', resumen]);
  return { errs, avisos, cambios, resumen, pendientes, importacion: imp };
}
const analizar = filas => tx(c => procesar(c, filas, null, false));
async function aplicar(filas, usr, archivo) {
  return tx(async c => { const r = await procesar(c, filas, usr, true, archivo); if (r.errs.length) throw E(400, 'El Listado tiene errores: vuelve a subirlo y revísalo'); return r; });
}

// ---------- Equivalencias (Excel) ----------
const HOJAS_EQ = { Departamentos: [['Empresa', 'empresa', 30], ['Departamento *', 'origen', 30], ['Unidad *', 'destino', 12], ['Unidad (nombre, referencia)', 'ref', 40], ['Personas', 'n', 9]],
  Cargos: [['Empresa', 'empresa', 30], ['Cargo *', 'origen', 40], ['Perfil *', 'destino', 12], ['Perfil (nombre, referencia)', 'ref', 40], ['Personas', 'n', 9]] };
// Excel con las equivalencias actuales y, si se subió un Listado, lo que falta (con la cantidad de personas)
async function plantillaEquivalencias(filas) {
  const [eqs, emps] = await Promise.all([q(`select e.*, em.siglas, coalesce(em.razon_social,em.nombre) empresa, u.codigo ucod, u.nombre unom, p.codigo pcod, p.nombre pnom
      from equivalencia e left join empresa em on em.id=e.empresa_id left join unidad u on u.id=e.unidad_id left join perfil p on p.id=e.perfil_id order by e.tipo, empresa nulls first, e.origen`),
    q('select id, nombre, razon_social, siglas from empresa')]);
  const empRef = new Map(); emps.rows.forEach(e => [e.razon_social, e.nombre, e.siglas].filter(Boolean).forEach(k => empRef.set(norm(k), e)));
  const filasDe = { Departamentos: [], Cargos: [] }, tiene = new Set();
  for (const e of eqs.rows) { const h = e.tipo === 'departamento' ? 'Departamentos' : 'Cargos'; filasDe[h].push({ empresa: e.empresa || '', origen: e.origen, destino: e.ucod || e.pcod, ref: e.unom || e.pnom, n: '' }); tiene.add(e.tipo + '|' + (e.empresa_id || 0) + '|' + e.origen_norm); }
  if (filas) {
    const cuenta = new Map();
    for (const f of filas) {
      if (f.excluido) continue; const emp = empRef.get(norm(f.empresa));
      for (const [tipo, txt] of [['departamento', f.departamento], ['cargo', f.cargo]]) {
        if (!txt || tiene.has(tipo + '|' + (emp ? emp.id : 0) + '|' + norm(txt)) || tiene.has(tipo + '|0|' + norm(txt))) continue;
        const k = tipo + '|' + (emp ? emp.razon_social || emp.nombre : limpio(f.empresa)) + '|' + norm(txt);
        const x = cuenta.get(k) || { tipo, empresa: emp ? emp.razon_social || emp.nombre : limpio(f.empresa), origen: limpio(txt), n: 0 }; x.n++; cuenta.set(k, x);
      }
    }
    for (const x of [...cuenta.values()].sort((a, b) => a.empresa.localeCompare(b.empresa) || b.n - a.n)) (x.tipo === 'departamento' ? filasDe.Departamentos : filasDe.Cargos).push({ empresa: x.empresa, origen: x.origen, destino: '', ref: '', n: x.n });
  }
  const wb = new ExcelJS.Workbook(); wb.creator = 'Portal de Gestión Humana';
  const ins = wb.addWorksheet('Instrucciones'); ins.getColumn(1).width = 120;
  ['Equivalencias del Listado de Activos con el portal', '',
    '1. Departamentos: cada departamento del Listado (de una empresa) corresponde a una unidad del portal. Escribe el código de la unidad (UO-…).',
    '   La persona se ubica en esa unidad o en una de sus dependientes, según su cargo. Empresa vacía = vale para todas las empresas (úsalo solo en áreas corporativas).',
    '2. Cargos: cada cargo del Listado corresponde a un perfil (código GH-PF-… o nombre exacto). Si el nombre ya es igual al del perfil, no hace falta la fila.',
    '   Un cargo sin equivalencia ni perfil con ese nombre crea un perfil mínimo «Sin descripción» al importar.',
    '3. Las filas con «Unidad» o «Perfil» vacíos se ignoran. Lo que no está en el archivo no se modifica.',
    '4. Una empresa sin ninguna equivalencia propia de departamento queda «pendiente por estructura» (sus áreas corporativas con equivalencia general sí se importan).'].forEach((t, i) => { const c = ins.getCell(i + 1, 1); c.value = t; if (!i) c.font = { bold: true, size: 14 }; });
  for (const [h, cols] of Object.entries(HOJAS_EQ)) {
    const ws = wb.addWorksheet(h, { views: [{ state: 'frozen', ySplit: 1 }] }); ws.columns = cols.map(([header, key, width]) => ({ header, key, width }));
    ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FD' } };
    filasDe[h].forEach(x => ws.addRow(x));
  }
  return wb.xlsx.writeBuffer();
}
async function leerEquivalencias(buffer) {
  const wb = new ExcelJS.Workbook(); try { await wb.xlsx.load(buffer); } catch (e) { throw E(400, 'No se pudo leer el archivo .xlsx'); }
  const filas = [];
  for (const [h, cols] of Object.entries(HOJAS_EQ)) {
    const ws = wb.getWorksheet(h); if (!ws) continue;
    const idx = {}; ws.getRow(1).eachCell((c, i) => { const col = cols.find(([hd]) => norm(hd) === norm(textoCelda(c))); if (col) idx[col[1]] = i; });
    if (!idx.origen || !idx.destino) throw E(400, `La hoja «${h}» no tiene las columnas obligatorias. Descarga el archivo de nuevo`);
    ws.eachRow((row, n) => { if (n === 1) return; const f = { hoja: h, fila: n, tipo: h === 'Departamentos' ? 'departamento' : 'cargo' };
      for (const [k, i] of Object.entries(idx)) f[k] = limpio(textoCelda(row.getCell(i)));
      if (f.origen && f.destino) filas.push(f); });
  }
  if (!filas.length) throw E(400, 'El archivo no tiene equivalencias completas (origen y destino)');
  return filas;
}
async function procesarEquivalencias(c, filas, usr, aplicar) {
  // Consultas en secuencia: un cliente de transacción no admite consultas en paralelo
  const emps = await c.query('select id, nombre, razon_social, siglas from empresa'), us = await c.query('select id, codigo, nombre from unidad where activa'),
    pfs = await c.query('select id, codigo, nombre from perfil where activo'), eqs = await c.query('select * from equivalencia');
  const empRef = new Map(); emps.rows.forEach(e => [e.razon_social, e.nombre, e.siglas].filter(Boolean).forEach(k => empRef.set(norm(k), e)));
  const uRef = new Map(us.rows.map(u => [norm(u.codigo), u])), pCod = new Map(pfs.rows.map(p => [norm(p.codigo), p])), pNom = new Map();
  pfs.rows.forEach(p => pNom.set(norm(p.nombre), (pNom.get(norm(p.nombre)) || []).concat(p)));
  const act = new Map(eqs.rows.map(e => [e.tipo + '|' + (e.empresa_id || 0) + '|' + e.origen_norm, e]));
  const errs = [], cambios = [], plan = [], vistos = new Set();
  for (const f of filas) {
    const fila = f.hoja + ' · ' + f.fila, emp = f.empresa ? empRef.get(norm(f.empresa)) : null;
    if (f.empresa && !emp) { errs.push({ fila, msg: `La empresa «${f.empresa}» no existe en el portal (déjala vacía o usa su razón social o siglas)` }); continue; }
    let destino = null;
    if (f.tipo === 'departamento') { destino = uRef.get(norm(f.destino)); if (!destino) { errs.push({ fila, msg: `La unidad «${f.destino}» no existe o está inactiva (usa su código UO-…)` }); continue; } }
    else { destino = pCod.get(norm(f.destino)) || ((pNom.get(norm(f.destino)) || []).length === 1 ? pNom.get(norm(f.destino))[0] : null);
      if (!destino) { errs.push({ fila, msg: `El perfil «${f.destino}» no existe o está repetido (usa su código GH-PF-…)` }); continue; } }
    const k = f.tipo + '|' + (emp ? emp.id : 0) + '|' + norm(f.origen);
    if (vistos.has(k)) { errs.push({ fila, msg: `«${f.origen}» está repetido en el archivo` }); continue; } vistos.add(k);
    const ex = act.get(k), campo = f.tipo === 'departamento' ? 'unidad_id' : 'perfil_id';
    if (ex && ex[campo] === destino.id) continue;
    cambios.push({ accion: ex ? 'cambia' : 'nuevo', txt: `${f.tipo === 'departamento' ? 'Departamento' : 'Cargo'} «${f.origen}»${emp ? ' (' + (emp.siglas || emp.nombre) + ')' : ' (todas)'}`, detalle: '→ ' + destino.codigo + ' · ' + destino.nombre });
    plan.push({ f, emp, destino, ex, campo });
  }
  if (aplicar && !errs.length) for (const p of plan) {
    if (p.ex) await c.query(`update equivalencia set ${p.campo}=$2, creado_por=$3, actualizado_en=now() where id=$1`, [p.ex.id, p.destino.id, usr.id]);
    else await c.query(`insert into equivalencia(tipo,empresa_id,origen,origen_norm,${p.campo},creado_por) values($1,$2,$3,$4,$5,$6)`, [p.f.tipo, p.emp ? p.emp.id : null, p.f.origen, norm(p.f.origen), p.destino.id, usr.id]);
  }
  // Trazabilidad: qué equivalencia se creó o cambió, y su valor anterior
  if (aplicar && !errs.length && plan.length) await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [usr.id, 'equivalencia', 'carga', 'aplicar',
    { cambios: plan.map(p => ({ tipo: p.f.tipo, empresa: p.emp ? p.emp.siglas || p.emp.nombre : null, origen: p.f.origen, a: p.destino.codigo, antes: p.ex ? p.ex[p.campo] : null })) }]);
  return { errs, avisos: [], cambios, resumen: { nuevas: cambios.filter(x => x.accion === 'nuevo').length, cambian: cambios.filter(x => x.accion === 'cambia').length } };
}
const analizarEquivalencias = filas => tx(c => procesarEquivalencias(c, filas, null, false));
const aplicarEquivalencias = (filas, usr) => tx(async c => { const r = await procesarEquivalencias(c, filas, usr, true); if (r.errs.length) throw E(400, 'Las equivalencias cambiaron: vuelve a subir el archivo'); return r; });

module.exports = { leer, analizar, aplicar, plantillaEquivalencias, leerEquivalencias, analizarEquivalencias, aplicarEquivalencias, norm };
