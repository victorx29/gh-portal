// Ficha del empleado (0.9.3): datos que pide Gestión Humana al confirmar un ingreso o dar un alta manual, catálogos de la ficha
// y campos personalizados que define GH (candidato, empleado o ambos). Los campos personalizados nunca van a la IA ni a n8n.
const { q, tx } = require('../db'), P = require('./perm'), { E } = require('../util');
const ghOnly = u => { if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana'); };
const fechaOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s));
const SEXOS = ['Femenino', 'Masculino'];
const TIPOS_CAMPO = { texto: 'Texto', numero: 'Número', fecha: 'Fecha', lista: 'Lista de opciones', si_no: 'Sí / No' };
const APLICA = { candidato: 'Candidato', empleado: 'Empleado', ambos: 'Candidato y empleado' };
// Datos obligatorios de la ficha (decisión del 23-11-2026). «Fin de contrato» solo si el tipo de empleado lo pide.
const OBLIGATORIOS = { fecha_nacimiento: 'Fecha de nacimiento', sexo: 'Sexo', nivel_academico: 'Nivel académico', titulo: 'Título', hijos: 'Hijos',
  ubicacion: 'Ubicación', tipo_empleado: 'Tipo de empleado' };

async function catalogos() {
  const [ub, te, gr] = [await q('select nombre from ubicacion where activo order by nombre'), await q('select nombre, requiere_fin from tipo_empleado where activo order by nombre'),
    await q('select nombre from grado_instruccion where activo order by orden, nombre')];
  return { ubicaciones: ub.rows.map(r => r.nombre), tipos: te.rows, grados: gr.rows.map(r => r.nombre), sexos: SEXOS };
}
// Campos personalizados activos para el candidato o el empleado
const campos = aplica => q(`select * from campo_personalizado where activo and aplica in ($1, 'ambos') order by orden, id`, [aplica]).then(r => r.rows);

// Lee y valida los campos personalizados del formulario (cp_<id>). Con exigir, los obligatorios no pueden quedar vacíos.
function leerCampos(defs, b, previos = {}, exigir = false) {
  const out = { ...previos };
  for (const d of defs) {
    const k = 'cp_' + d.id; if (!(k in b) && d.tipo !== 'si_no') { if (exigir && d.obligatorio && (out[d.id] == null || out[d.id] === '')) throw E(400, `Completa «${d.etiqueta}»`); continue; }
    let v = d.tipo === 'si_no' ? (b[k] === 'si' ? true : b[k] === 'no' ? false : null) : String(b[k] == null ? '' : b[k]).trim();
    if (v === '') v = null;
    if (v != null) {
      if (d.tipo === 'numero') { const n = Number(String(v).replace(',', '.')); if (!isFinite(n)) throw E(400, `«${d.etiqueta}» debe ser un número`); v = n; }
      if (d.tipo === 'fecha' && !fechaOk(v)) throw E(400, `«${d.etiqueta}» debe ser una fecha`);
      if (d.tipo === 'lista' && !d.opciones.includes(v)) throw E(400, `«${d.etiqueta}»: elige una opción de la lista`);
      if (d.tipo === 'texto' && v.length > 500) throw E(400, `«${d.etiqueta}»: máximo 500 caracteres`);
    }
    if (exigir && d.obligatorio && v == null) throw E(400, `Completa «${d.etiqueta}»`);
    if (v == null) delete out[d.id]; else out[d.id] = v;
  }
  return out;
}

// Datos de la ficha que vienen del formulario. Con exigir, todos los obligatorios deben venir (confirmar ingreso, alta manual).
async function leerDatos(b, { exigir, fechaIngreso, cat }) {
  cat = cat || await catalogos();
  const t = k => { const v = String(b[k] == null ? '' : b[k]).replace(/\s+/g, ' ').trim(); return v || null; };
  const d = { fecha_nacimiento: t('fecha_nacimiento'), sexo: t('sexo'), nivel_academico: t('nivel_academico'), titulo: t('titulo'),
    hijos: t('hijos'), ubicacion: t('ubicacion'), tipo_empleado: t('tipo_empleado'), fecha_fin_contrato: t('fecha_fin_contrato') };
  const hoy = (await q('select current_date::text d')).rows[0].d;
  if (d.fecha_nacimiento && (!fechaOk(d.fecha_nacimiento) || d.fecha_nacimiento >= hoy)) throw E(400, 'La fecha de nacimiento no es válida');
  if (d.sexo && !cat.sexos.includes(d.sexo)) throw E(400, 'Sexo: elige una opción de la lista');
  if (d.hijos != null) { if (!/^\d{1,2}$/.test(d.hijos)) throw E(400, 'Hijos: escribe un número entero (0 si no tiene)'); d.hijos = +d.hijos; }
  if (d.ubicacion && !cat.ubicaciones.includes(d.ubicacion)) throw E(400, 'Ubicación: elige una sede de la lista (Configuración › Ubicaciones)');
  const te = d.tipo_empleado && cat.tipos.find(x => x.nombre === d.tipo_empleado);
  if (d.tipo_empleado && !te) throw E(400, 'Tipo de empleado: elige una opción de la lista');
  if (d.fecha_fin_contrato && !fechaOk(d.fecha_fin_contrato)) throw E(400, 'La fecha de fin de contrato no es válida');
  if (d.fecha_fin_contrato && fechaIngreso && d.fecha_fin_contrato < fechaIngreso) throw E(400, 'El fin de contrato no puede ser anterior al ingreso');
  if (exigir) {
    const falta = Object.entries(OBLIGATORIOS).filter(([k]) => d[k] == null || d[k] === '').map(([, n]) => n);
    if (te && te.requiere_fin && !d.fecha_fin_contrato) falta.push('Fin de contrato (el tipo «' + te.nombre + '» lo pide)');
    if (falta.length) throw E(400, 'Completa la ficha: ' + falta.join(', '));
  }
  return d;
}
// Qué le falta a una ficha (para marcarla «Ficha incompleta»): t = trabajador, r = relación activa
function faltantes(t, r, defs = []) {
  const v = { ...t, ubicacion: r && r.ubicacion, tipo_empleado: r && r.tipo_empleado };
  const falta = Object.entries(OBLIGATORIOS).filter(([k]) => v[k] == null || v[k] === '').map(([, n]) => n);
  for (const d of defs) if (d.obligatorio && (t.campos || {})[d.id] == null) falta.push(d.etiqueta);
  return falta;
}
// Escribe los datos en la ficha y en la relación laboral (dentro de la transacción del llamador)
async function guardarC(c, trabajadorId, relId, d, camposObj) {
  await c.query(`update trabajador set fecha_nacimiento=coalesce($2,fecha_nacimiento), sexo=coalesce($3,sexo), nivel_academico=coalesce($4,nivel_academico),
      titulo=coalesce($5,titulo), hijos=coalesce($6,hijos), campos=coalesce($7,campos), actualizado_en=now() where id=$1`,
    [trabajadorId, d.fecha_nacimiento, d.sexo, d.nivel_academico, d.titulo, d.hijos, camposObj || null]);
  if (relId) await c.query(`update relacion_laboral set ubicacion=coalesce($2,ubicacion), tipo_empleado=coalesce($3,tipo_empleado), fecha_fin_contrato=coalesce($4,fecha_fin_contrato) where id=$1`,
    [relId, d.ubicacion, d.tipo_empleado, d.fecha_fin_contrato]);
}
// GH edita la ficha de un empleado (completar datos de un importado o de quien entró antes de la 0.9.3). Admite guardarla incompleta.
async function editarFicha(u, trabajadorId, b) {
  ghOnly(u);
  const defs = await campos('empleado'), cat = await catalogos();
  return tx(async c => {
    const t = (await c.query('select * from trabajador where id=$1 for update', [trabajadorId])).rows[0]; if (!t) throw E(404, 'Empleado no encontrado');
    const r = (await c.query("select * from relacion_laboral where trabajador_id=$1 and estado='activo' order by id desc limit 1", [trabajadorId])).rows[0];
    const d = await leerDatos(b, { exigir: false, fechaIngreso: r && r.fecha_ingreso, cat }), cp = leerCampos(defs, b, t.campos, false);
    const nombres = String(b.nombres || '').replace(/\s+/g, ' ').trim(); if (!nombres) throw E(400, 'El nombre es obligatorio');
    const email = String(b.email || '').trim() || null, tel = String(b.telefono || '').trim() || null;
    await c.query('update trabajador set nombres=$2, email=$3, telefono=$4 where id=$1', [trabajadorId, nombres, email, tel]);
    await guardarC(c, trabajadorId, r && r.id, d, cp);
    // Historial sin valores (son datos personales): solo qué se tocó
    await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'trabajador', String(trabajadorId), 'ficha',
      { campos: Object.keys(d).filter(k => d[k] != null).concat(Object.keys(cp).length ? ['personalizados'] : []) }]);
  });
}

// ---------- Administración de los campos personalizados (GH) ----------
const listarCampos = () => q('select * from campo_personalizado order by activo desc, orden, id').then(r => r.rows);
function datosCampo(b) {
  const etiqueta = String(b.etiqueta || '').replace(/\s+/g, ' ').trim(); if (!etiqueta) throw E(400, 'Escribe el nombre del campo');
  if (etiqueta.length > 80) throw E(400, 'El nombre del campo admite hasta 80 caracteres');
  const tipo = String(b.tipo || ''), aplica = String(b.aplica || '');
  if (!TIPOS_CAMPO[tipo]) throw E(400, 'Elige el tipo de campo'); if (!APLICA[aplica]) throw E(400, 'Elige dónde aplica');
  const opciones = tipo === 'lista' ? [...new Set(String(b.opciones || '').split(/\r?\n|;/).map(s => s.trim()).filter(Boolean))] : [];
  if (tipo === 'lista' && !opciones.length) throw E(400, 'Escribe las opciones de la lista, una por línea');
  return { etiqueta, tipo, aplica, opciones, obligatorio: b.obligatorio === 'on', sensible: b.sensible === 'on', ayuda: String(b.ayuda || '').trim() || null, orden: parseInt(b.orden, 10) || 0 };
}
const dupCampo = e => { if (e.code === '23505') return E(400, 'Ya existe un campo activo con ese nombre'); return e; };
async function crearCampo(u, b) {
  ghOnly(u); const d = datosCampo(b);
  return tx(async c => {
    let id; try { id = (await c.query(`insert into campo_personalizado(etiqueta,tipo,opciones,aplica,obligatorio,sensible,ayuda,orden,creado_por) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [d.etiqueta, d.tipo, d.opciones, d.aplica, d.obligatorio, d.sensible, d.ayuda, d.orden, u.id])).rows[0].id; } catch (e) { throw dupCampo(e); }
    await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'campo_personalizado', String(id), 'crear', d]);
    return id;
  });
}
// Editar: el tipo no cambia (los valores guardados dependen de él); las opciones de una lista solo se agregan
async function editarCampo(u, id, b) {
  ghOnly(u);
  return tx(async c => {
    const a = (await c.query('select * from campo_personalizado where id=$1 for update', [id])).rows[0]; if (!a) throw E(404, 'Campo no encontrado');
    const d = datosCampo({ ...b, tipo: a.tipo });
    const quitadas = a.opciones.filter(o => !d.opciones.includes(o));
    if (quitadas.length) throw E(400, `No se pueden quitar opciones que ya pueden estar en uso (${quitadas.join(', ')}): desactiva el campo y crea otro`);
    try { await c.query('update campo_personalizado set etiqueta=$2, opciones=$3, aplica=$4, obligatorio=$5, sensible=$6, ayuda=$7, orden=$8 where id=$1',
      [id, d.etiqueta, d.opciones, d.aplica, d.obligatorio, d.sensible, d.ayuda, d.orden]); } catch (e) { throw dupCampo(e); }
    await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'campo_personalizado', String(id), 'editar', { antes: a, despues: d }]);
  });
}
async function activarCampo(u, id) {
  ghOnly(u);
  return tx(async c => {
    const a = (await c.query('select * from campo_personalizado where id=$1 for update', [id])).rows[0]; if (!a) throw E(404, 'Campo no encontrado');
    try { await c.query('update campo_personalizado set activo=not activo where id=$1', [id]); } catch (e) { throw dupCampo(e); }
    await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'campo_personalizado', String(id), a.activo ? 'desactivar' : 'activar', { etiqueta: a.etiqueta }]);
  });
}
// Valor legible de un campo personalizado
const mostrar = (d, v) => v == null ? '—' : d.tipo === 'si_no' ? (v ? 'Sí' : 'No') : d.tipo === 'fecha' ? String(v).split('-').reverse().join('/') : String(v);

module.exports = { SEXOS, TIPOS_CAMPO, APLICA, OBLIGATORIOS, catalogos, campos, leerCampos, leerDatos, faltantes, guardarC, editarFicha,
  listarCampos, crearCampo, editarCampo, activarCampo, mostrar, fechaOk };
