// Trabajadores y su relación laboral (ingreso a una plaza). Base de la 0.8: la importación del Listado usará estas mismas reglas.
const { q, tx } = require('../db'), P = require('./perm'), RS = require('./requisiciones'), PT = require('./plantilla'), ES = require('./estructura'), { E } = require('../util');

// Cédula: solo los dígitos («V-12.345.678» → «12345678»), igual que cedula_norm() en la base (migración 013)
const cedulaNorm = t => String(t == null ? '' : t).replace(/\D/g, '') || null;
const fechaOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s));
const ghOnly = u => { if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana gestiona los ingresos'); };
const hist = (c, u, id, accion, detalle) => c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)',
  [u && u.id, 'relacion_laboral', String(id), accion, detalle || {}]);
const CERRADOS = ['egresado', 'movido', 'no_ingreso', 'corregida'];

// Al llegar el candidato a «Ingreso»: la persona queda «por ingresar» en la plaza de la requisición (dentro de la transacción de avanzar)
async function porIngresarC(c, u, ca, cd, r) {
  const ced = cedulaNorm(cd.cedula);
  if (!ced) throw E(400, 'Registra la cédula del candidato antes de pasarlo a Ingreso');
  if (r.plaza_id) {
    const z = (await c.query('select codigo, por_regularizar from plaza where id=$1 for update', [r.plaza_id])).rows[0];
    if (z && z.por_regularizar) throw E(400, `La plaza ${z.codigo} está «por regularizar»: Gestión Humana debe regularizarla antes del ingreso`);
    const otro = (await c.query(`select t.nombres from relacion_laboral rl join trabajador t on t.id=rl.trabajador_id where rl.plaza_id=$1 and rl.estado='por_ingresar'`, [r.plaza_id])).rows[0];
    if (otro) throw E(400, `La plaza ${z.codigo} ya tiene a ${otro.nombres} por ingresar`);
  }
  let t = (await c.query('select id from trabajador where cedula=$1', [ced])).rows[0];
  if (!t) t = (await c.query('insert into trabajador(cedula,nombres,email,telefono) values($1,$2,$3,$4) returning id', [ced, cd.nombre, cd.email, cd.telefono])).rows[0];
  const id = (await c.query(`insert into relacion_laboral(trabajador_id,empresa_id,unidad_id,cargo,requisicion_id,plaza_id,perfil_version_id,candidatura_id,origen)
    values($1,$2,$3,$4,$5,$6,$7,$8,'seleccion') returning id`, [t.id, r.empresa_id, r.unidad_id, r.cargo, r.id, r.plaza_id || null, r.perfil_version_id, ca.id])).rows[0].id;
  await hist(c, u, id, 'por_ingresar', { requisicion: r.codigo, candidatura_id: ca.id });
  return id;
}

// Relación de una candidatura (para la ficha del candidato)
const deCandidatura = id => q(`select rl.*, z.codigo plaza_codigo, uc.nombre confirmado_por_nombre from relacion_laboral rl left join plaza z on z.id=rl.plaza_id
  left join usuario uc on uc.id=rl.confirmado_por where rl.candidatura_id=$1 order by rl.id desc limit 1`, [id]).then(r => r.rows[0] || null);

// GH confirma el ingreso con la fecha real: la persona ocupa la plaza. Si ya trabajaba en otra plaza, esa relación se cierra (movimiento interno).
async function confirmarIngreso(u, relId, fecha) {
  ghOnly(u);
  if (!fechaOk(fecha)) throw E(400, 'Indica la fecha real de ingreso');
  return tx(async c => {
    const hoy = (await c.query('select current_date::text d')).rows[0].d;
    if (fecha > hoy) throw E(400, 'La fecha de ingreso no puede ser futura: confirma el ingreso cuando la persona ya empezó');
    const rl = (await c.query('select * from relacion_laboral where id=$1 for update', [relId])).rows[0]; if (!rl) throw E(404, 'Ingreso no encontrado');
    if (rl.estado !== 'por_ingresar') throw E(400, 'Este ingreso ya fue confirmado o cerrado');
    let z = null;
    if (rl.plaza_id) {
      z = (await c.query('select * from plaza where id=$1 for update', [rl.plaza_id])).rows[0];
      if (z.por_regularizar) throw E(400, `La plaza ${z.codigo} está «por regularizar»: Gestión Humana debe regularizarla antes de confirmar el ingreso`);
      if (z.hasta && z.hasta <= fecha) throw E(400, `La plaza ${z.codigo} está cerrada a esa fecha`);
      const ocupa = (await c.query(`select t.nombres from relacion_laboral x join trabajador t on t.id=x.trabajador_id where x.plaza_id=$1 and x.estado='activo' and x.trabajador_id<>$2`, [z.id, rl.trabajador_id])).rows[0];
      if (ocupa) throw E(400, `La plaza ${z.codigo} sigue ocupada por ${ocupa.nombres}: registra primero su egreso`);
      if (!z.empresa_id) await c.query('update plaza set empresa_id=$2 where id=$1', [z.id, rl.empresa_id]);   // «Por definir» toma la empresa al ingresar la persona
    }
    // Movimiento interno: la relación activa anterior de la misma persona se cierra el día antes del nuevo ingreso
    for (const prev of (await c.query(`select * from relacion_laboral where trabajador_id=$1 and estado='activo' and id<>$2 for update`, [rl.trabajador_id, relId])).rows) {
      const egreso = (await c.query('select greatest($1::date - 1, $2::date)::text d', [fecha, prev.fecha_ingreso || fecha])).rows[0].d;
      await c.query(`update relacion_laboral set estado='movido', fecha_egreso=$2, cerrado_por=$3, motivo_cierre=$4 where id=$1`, [prev.id, egreso, u.id, 'Movimiento interno' + (z ? ' a la plaza ' + z.codigo : '')]);
      await hist(c, u, prev.id, 'movido', { a_relacion: relId, fecha_egreso: egreso });
    }
    await c.query(`update relacion_laboral set estado='activo', fecha_ingreso=$2, confirmado_por=$3, confirmado_en=now() where id=$1`, [relId, fecha, u.id]);
    await hist(c, u, relId, 'ingreso', { fecha_ingreso: fecha, plaza: z && z.codigo });
    // Aviso para TI y GH (equipos, accesos, correo): sin datos personales sensibles
    const t = (await c.query('select nombres, apellidos, email from trabajador where id=$1', [rl.trabajador_id])).rows[0];
    await c.query('insert into evento_outbox(tipo,payload) values($1,$2)', ['ingreso.confirmado', { relacion_id: relId, requisicion_id: rl.requisicion_id,
      persona: { nombre: [t.nombres, t.apellidos].filter(Boolean).join(' '), email: t.email }, cargo: rl.cargo, plaza: z && z.codigo, fecha_ingreso: fecha, confirmado_por: u.nombre,
      url: rl.requisicion_id ? RS.urlReq(rl.requisicion_id) : null, detalle: rl.requisicion_id ? await RS.detalleEvento(c, rl.requisicion_id) : null }]);
  });
}

// La persona no se presentó: la plaza queda libre (la requisición no se reabre; GH pide otra si hace falta)
async function noIngreso(u, relId, motivo) {
  ghOnly(u);
  motivo = String(motivo || '').trim(); if (!motivo) throw E(400, 'Indica el motivo');
  return tx(async c => {
    const rl = (await c.query('select * from relacion_laboral where id=$1 for update', [relId])).rows[0]; if (!rl) throw E(404, 'Ingreso no encontrado');
    if (rl.estado !== 'por_ingresar') throw E(400, 'Solo un ingreso pendiente se puede marcar como «no se presentó»');
    await c.query(`update relacion_laboral set estado='no_ingreso', cerrado_por=$2, motivo_cierre=$3 where id=$1`, [relId, u.id, motivo]);
    await hist(c, u, relId, 'no_ingreso', { motivo });
  });
}

// ---------- Base de empleados (solo Gestión Humana) ----------
const TIPOS_EGRESO = { renuncia: 'Renuncia (retiro voluntario)', despido_justificado: 'Despido justificado', despido_injustificado: 'Despido injustificado',
  fin_contrato: 'Fin del contrato (tiempo u obra determinada)', mutuo_acuerdo: 'Mutuo acuerdo', jubilacion: 'Jubilación', otro: 'Otro' };
const ESTADOS_REL = { por_ingresar: 'Por ingresar', activo: 'Activo', egresado: 'Egresado', movido: 'Movido a otra plaza', no_ingreso: 'No se presentó', corregida: 'Corregida (plaza equivocada)' };
// Lista con la relación más reciente de cada persona
async function listar(u, f = {}) {
  ghOnly(u);
  const w = [], p = [], add = (cond, v) => { p.push(v); w.push(cond.replace('$?', '$' + p.length)); };
  if (f.q) { const t = String(f.q).trim(); if (/^[\d.\sVvEe-]+$/.test(t) && cedulaNorm(t)) add('t.cedula = $?', cedulaNorm(t)); else add("t.nombres ilike '%' || $? || '%'", t); }
  if (f.empresa) add('x.empresa_id = $?', +f.empresa);
  if (f.estado === 'activo' || !f.estado) w.push("x.estado = 'activo'"); else if (f.estado === 'egresado') w.push("x.estado in ('egresado','no_ingreso')");
  if (f.unidad) add('x.unidad_id = any($?)', f.unidades || [+f.unidad]);
  return (await q(`select t.id, t.nombres, x.cargo, x.estado, x.fecha_ingreso, x.fecha_egreso, x.origen, z.codigo plaza, z.por_regularizar, un.nombre unidad, un.codigo unidad_codigo,
      coalesce(e.siglas, e.razon_social) empresa
    from trabajador t join lateral (select * from relacion_laboral r where r.trabajador_id=t.id order by (r.estado='activo') desc, r.id desc limit 1) x on true
    left join plaza z on z.id=x.plaza_id left join unidad un on un.id=x.unidad_id left join empresa e on e.id=x.empresa_id
    ${w.length ? 'where ' + w.join(' and ') : ''} order by t.nombres limit 2000`, p)).rows;
}
// Ficha completa: cada consulta queda registrada (quién y cuándo), porque trae datos personales
async function ficha(u, id) {
  ghOnly(u);
  const t = (await q('select * from trabajador where id=$1', [id])).rows[0]; if (!t) throw E(404, 'Empleado no encontrado');
  await q('insert into consulta_ficha(trabajador_id, usuario_id) values($1,$2)', [id, u.id]);
  const rels = (await q(`select r.*, z.codigo plaza, z.por_regularizar, un.nombre unidad, un.codigo unidad_codigo, coalesce(e.razon_social, e.nombre) empresa, e.siglas,
      s.nombres supervisor, uc.nombre confirmado_por_nombre, ux.nombre cerrado_por_nombre, q.codigo requisicion, zd.codigo reubicada_de_plaza
    from relacion_laboral r left join plaza z on z.id=r.plaza_id left join relacion_laboral rd on rd.id=r.reubicada_desde left join plaza zd on zd.id=rd.plaza_id left join unidad un on un.id=r.unidad_id left join empresa e on e.id=r.empresa_id
    left join trabajador s on s.id=r.supervisor_id left join usuario uc on uc.id=r.confirmado_por left join usuario ux on ux.id=r.cerrado_por
    left join requisicion q on q.id=r.requisicion_id where r.trabajador_id=$1 order by r.id desc`, [id])).rows;
  const consultas = (await q(`select c.fecha, us.nombre from consulta_ficha c join usuario us on us.id=c.usuario_id where c.trabajador_id=$1 order by c.id desc limit 10`, [id])).rows;
  const aCargo = (await q(`select t.id, t.nombres, r.cargo from relacion_laboral r join trabajador t on t.id=r.trabajador_id where r.supervisor_id=$1 and r.estado='activo' order by t.nombres`, [id])).rows;
  return { t, rels, consultas, aCargo };
}
// Egreso: la persona deja la plaza (queda libre para un reemplazo). La fecha es la real y no puede ser futura.
async function egresar(u, relId, b) {
  ghOnly(u);
  const fecha = String(b.fecha || ''), tipo = String(b.tipo || ''), motivo = String(b.motivo || '').trim();
  if (!fechaOk(fecha)) throw E(400, 'Indica la fecha de egreso');
  if (!TIPOS_EGRESO[tipo]) throw E(400, 'Elige el tipo de egreso');
  return tx(async c => {
    const hoy = (await c.query('select current_date::text d')).rows[0].d; if (fecha > hoy) throw E(400, 'La fecha de egreso no puede ser futura: regístralo cuando ocurra');
    const rl = (await c.query('select * from relacion_laboral where id=$1 for update', [relId])).rows[0]; if (!rl) throw E(404, 'Relación laboral no encontrada');
    if (rl.estado !== 'activo') throw E(400, 'Solo se registra el egreso de una persona activa');
    if (rl.fecha_ingreso && fecha < rl.fecha_ingreso) throw E(400, 'La fecha de egreso no puede ser anterior a la de ingreso');
    await c.query(`update relacion_laboral set estado='egresado', fecha_egreso=$2, tipo_egreso=$3, motivo_cierre=$4, cerrado_por=$5 where id=$1`, [relId, fecha, tipo, motivo || null, u.id]);
    await hist(c, u, relId, 'egreso', { fecha_egreso: fecha, tipo, motivo: motivo || undefined });
    const d = (await c.query(`select t.nombres, t.email, z.codigo plaza, un.nombre unidad from relacion_laboral r join trabajador t on t.id=r.trabajador_id
      left join plaza z on z.id=r.plaza_id left join unidad un on un.id=r.unidad_id where r.id=$1`, [relId])).rows[0];
    // Aviso a n8n (TI retira accesos y equipos): sin el tipo ni el motivo del egreso
    await c.query('insert into evento_outbox(tipo,payload) values($1,$2)', ['egreso.registrado', { relacion_id: relId, persona: { nombre: d.nombres, email: d.email }, cargo: rl.cargo,
      plaza: d.plaza, unidad: d.unidad, fecha_egreso: fecha, registrado_por: u.nombre }]);
  });
}
// ---------- Reubicar en otra plaza (0.9.1, solo Gestión Humana) ----------
// Corrección: la persona quedó en la plaza equivocada (por ejemplo, en la carga inicial). La relación se cierra como «corregida»
//   y se abre otra en la plaza correcta con la MISMA fecha de ingreso: a cualquier fecha, el organigrama la muestra en la plaza correcta.
//   Si la plaza correcta la ocupa otra persona, se intercambian (las dos relaciones se corrigen).
// Traslado: cambio real en una fecha. La relación anterior se cierra como «movido» el día antes y la nueva empieza ese día.
// En los dos casos: la plaza «por regularizar» que queda vacía se cierra sola con motivo, y todo queda en el historial.
const TIPOS_REUBICACION = { correccion: 'Corrección', traslado: 'Traslado' };
const SEL_PLAZAS = `select z.id, z.codigo, z.desde, z.hasta, z.congelada, z.por_regularizar, z.modalidad, z.empresa_id, z.puesto_id, coalesce(e.siglas, e.razon_social) empresa,
    coalesce(e.razon_social, e.nombre) empresa_razon, pf.nombre perfil, pf.codigo perfil_codigo, pf.version_activa_id, p.unidad_id, un.nombre unidad, un.codigo unidad_codigo,
    oc.id ocupante_rel, oc.trabajador_id ocupante_trab, oc.nombres ocupante,
    (select t.nombres from relacion_laboral x join trabajador t on t.id=x.trabajador_id where x.plaza_id=z.id and x.estado='por_ingresar' limit 1) por_ingresar,
    (select r.codigo from requisicion r where r.plaza_id=z.id and ${PT.ABIERTA} limit 1) requisicion
  from plaza z join puesto p on p.id=z.puesto_id and p.activo join perfil pf on pf.id=p.perfil_id join unidad un on un.id=p.unidad_id left join empresa e on e.id=z.empresa_id
  left join lateral (select x.id, x.trabajador_id, t.nombres from relacion_laboral x join trabajador t on t.id=x.trabajador_id where x.plaza_id=z.id and x.estado='activo' limit 1) oc on true`;
// ¿Se puede llevar a la persona a esta plaza? null = sí; si no, el motivo. Con intercambio (corrección), la plaza puede estar ocupada.
function impedimento(z, rl, tipo, hoy) {
  if (z.id === rl.plaza_id) return 'Es la plaza que ya ocupa';
  if (z.hasta && z.hasta <= hoy) return `La plaza ${z.codigo} está cerrada`;
  if (z.desde > hoy) return `La plaza ${z.codigo} es proyectada: todavía no está vigente`;
  if (z.congelada) return `La plaza ${z.codigo} está congelada`;
  if (z.por_regularizar) return `La plaza ${z.codigo} está «por regularizar»: no está autorizada`;
  if (z.por_ingresar) return `La plaza ${z.codigo} tiene a ${z.por_ingresar} por ingresar`;
  if (z.requisicion) return `La plaza ${z.codigo} tiene abierta la requisición ${z.requisicion}`;
  if (z.ocupante_rel && tipo !== 'correccion') return `La plaza ${z.codigo} la ocupa ${z.ocupante}: un traslado solo va a una plaza vacante`;
  return null;
}
const etiquetaPlaza = z => [z.codigo, z.perfil, z.unidad + ' (' + z.unidad_codigo + ')', z.empresa || 'Empresa por definir'].join(' · ') + (z.modalidad !== 'nomina' ? ' · ' + z.modalidad : '');

async function relacionActiva(c, relId, lock) {
  const rl = (await c.query(`select r.*, t.nombres, z.codigo plaza_codigo, z.por_regularizar plaza_por_regularizar, coalesce(e.siglas, e.razon_social) empresa, un.nombre unidad,
      s.nombres supervisor_nombre from relacion_laboral r join trabajador t on t.id=r.trabajador_id left join plaza z on z.id=r.plaza_id left join empresa e on e.id=r.empresa_id
      left join unidad un on un.id=r.unidad_id left join trabajador s on s.id=r.supervisor_id where r.id=$1${lock ? ' for update of r' : ''}`, [relId])).rows[0];
  if (!rl) throw E(404, 'Relación laboral no encontrada');
  if (rl.estado !== 'activo') throw E(400, 'Solo se reubica a una persona activa');
  return rl;
}
// Formulario: la relación y las plazas posibles (vacantes; para corrección también las ocupadas, con intercambio)
async function opcionesReubicar(u, relId) {
  ghOnly(u);   // fuera de transacción: q tiene la misma firma que c.query
  const rl = await relacionActiva({ query: q }, relId), hoy = (await q('select current_date::text d')).rows[0].d;
  const orden = new Map((await ES.arbol()).filas.map((x, i) => [x.u.id, i]));
  const zs = (await q(SEL_PLAZAS + ' where (z.hasta is null or z.hasta > current_date)')).rows
    .filter(z => !impedimento(z, rl, 'correccion', hoy))
    .sort((a, b) => (orden.get(a.unidad_id) ?? 1e9) - (orden.get(b.unidad_id) ?? 1e9) || a.perfil.localeCompare(b.perfil, 'es') || a.codigo.localeCompare(b.codigo))
    .map(z => ({ id: z.id, etiqueta: etiquetaPlaza(z), ocupante: z.ocupante_rel ? z.ocupante : null, codigos: [z.codigo, z.perfil_codigo, z.unidad_codigo].join(' ') }));
  return { rl, vacantes: zs.filter(z => !z.ocupante), ocupadas: zs.filter(z => z.ocupante) };
}
// Última persona que ocupó la plaza y salió en esa fecha o después (para no superponer dos personas en la misma plaza)
const ocupadaDesde = (c, plazaId, fecha) => c.query(`select t.nombres, x.fecha_egreso::text f from relacion_laboral x join trabajador t on t.id=x.trabajador_id
  where x.plaza_id=$1 and x.estado in ('egresado','movido') and x.fecha_egreso >= $2 order by x.fecha_egreso desc limit 1`, [plazaId, fecha]).then(r => r.rows[0]);
// Validación común de «revisar» y «aplicar». Con lock, bloquea las filas que se van a tocar.
async function prepararC(c, u, relId, b, lock) {
  ghOnly(u);
  const tipo = String(b.tipo || ''), motivo = String(b.motivo || '').trim(), plazaId = +(tipo === 'traslado' ? b.plaza_traslado : b.plaza_correccion) || +b.plaza_id || 0;
  if (!TIPOS_REUBICACION[tipo]) throw E(400, 'Elige si es una corrección o un traslado');
  if (!plazaId) throw E(400, 'Elige la plaza destino');
  if (!motivo) throw E(400, 'Indica el motivo: queda en el historial');
  const hoy = (await c.query('select current_date::text d')).rows[0].d, rl = await relacionActiva(c, relId, lock);
  // Al aplicar, las dos plazas se bloquean antes de leerlas: nadie las ocupa mientras tanto
  if (lock) await c.query('select id from plaza where id = any($1) order by id for update', [[plazaId, rl.plaza_id].filter(Boolean)]);
  const z = (await c.query(SEL_PLAZAS + ' where z.id=$1', [plazaId])).rows[0]; if (!z) throw E(404, 'Plaza no encontrada');
  const imp = impedimento(z, rl, tipo, hoy); if (imp) throw E(400, imp);
  let fecha = null, otro = null, finAnterior = null;
  const ingreso = rl.fecha_ingreso || null;
  if (tipo === 'traslado') {
    fecha = String(b.fecha || '');
    if (!fechaOk(fecha)) throw E(400, 'Indica la fecha del traslado');
    if (fecha > hoy) throw E(400, 'La fecha del traslado no puede ser futura: regístralo cuando ocurra');
    if (ingreso && fecha <= ingreso) throw E(400, 'La fecha del traslado debe ser posterior a la fecha de ingreso. Si la persona siempre estuvo en esa plaza, es una corrección');
    if (z.desde > fecha) throw E(400, `La plaza ${z.codigo} no existía en esa fecha (vigente desde ${z.desde.split('-').reverse().join('/')})`);
    const antes = await ocupadaDesde(c, z.id, fecha);
    finAnterior = (await c.query('select ($1::date - 1)::text d', [fecha])).rows[0].d;
    if (antes) throw E(400, `La plaza ${z.codigo} estuvo ocupada por ${antes.nombres} hasta el ${antes.f.split('-').reverse().join('/')}: el traslado debe ser posterior`);
  } else if (z.ocupante_rel) {
    // Intercambio: la otra persona pasa a la plaza actual de esta (también es una corrección)
    if (!rl.plaza_id) throw E(400, 'Esta persona no tiene plaza: no hay con qué intercambiar');
    otro = await relacionActiva(c, z.ocupante_rel, lock);
    if (otro.trabajador_id === rl.trabajador_id) throw E(400, 'Es la misma persona');
    if ((await c.query("select 1 from relacion_laboral where plaza_id=$1 and estado='por_ingresar'", [rl.plaza_id])).rowCount) throw E(400, `La plaza ${rl.plaza_codigo} tiene a alguien por ingresar: no se puede intercambiar`);
  }
  // Plaza actual: ¿queda vacía y es «por regularizar»? Entonces se cierra sola.
  const quedaVacia = !otro && !!rl.plaza_id && !(await c.query("select 1 from relacion_laboral where plaza_id=$1 and estado in ('activo','por_ingresar') and id<>$2", [rl.plaza_id, rl.id])).rowCount;
  const cierra = quedaVacia && rl.plaza_por_regularizar ? rl.plaza_codigo : null;
  // Supervisor sugerido: quien ocupa el puesto al que reporta el puesto destino (si es una sola persona)
  const { byP } = await PT.__cargar(), pd = byP.get(z.puesto_id), sup = pd && byP.get(pd.reporta_id);
  const supZ = sup ? sup.plazas.map(x => x.id) : [];
  const sugeridos = supZ.length ? (await c.query("select distinct t.id, t.nombres from relacion_laboral x join trabajador t on t.id=x.trabajador_id where x.plaza_id = any($1) and x.estado='activo'", [supZ])).rows : [];
  const sugerido = sugeridos.length === 1 && sugeridos[0].id !== rl.trabajador_id ? sugeridos[0] : null;
  const avisos = [];
  if (z.empresa_id && z.empresa_id !== rl.empresa_id) avisos.push({ alerta: true, txt: `Cambia de empresa: de ${rl.empresa || '—'} a ${z.empresa}. Si la empresa correcta es la de la persona, cambia primero la empresa de la plaza ${z.codigo} y vuelve aquí.` });
  if (!z.empresa_id) avisos.push({ txt: `La plaza ${z.codigo} tiene la empresa «Por definir»: tomará la de la persona (${rl.empresa || '—'}).` });
  if (otro && otro.empresa_id !== rl.empresa_id) avisos.push({ alerta: true, txt: `${otro.nombres} y ${rl.nombres} son de empresas distintas: cada uno toma la empresa de su plaza nueva.` });
  if (tipo === 'correccion' && !otro && ingreso) {
    const antes = await ocupadaDesde(c, z.id, ingreso);
    if (antes) avisos.push({ alerta: true, txt: `La plaza ${z.codigo} la ocupó ${antes.nombres} hasta el ${antes.f.split('-').reverse().join('/')}, después del ingreso de ${rl.nombres}: revisa que sea la plaza correcta.` });
  }
  return { tipo, motivo, fecha, finAnterior, ingreso, rl, z, otro, cierra, sugerido, avisos };
}
// Vista previa (no guarda nada)
const revisarReubicacion = (u, relId, b) => tx(c => prepararC(c, u, relId, b, false));
// Aplicar: todo en una transacción
async function reubicar(u, relId, b) {
  return tx(async c => {
    const p = await prepararC(c, u, relId, b, true), { tipo, motivo, rl, z, otro } = p;
    // Supervisor de la relación nueva: mantener el actual (por defecto), el sugerido o ninguno
    let supId = rl.supervisor_id, supTxt = rl.supervisor_texto;
    if (b.supervisor === 'ninguno') { supId = null; supTxt = null; }
    else if (b.supervisor && b.supervisor !== 'mantener') { if (!p.sugerido || +b.supervisor !== p.sugerido.id) throw E(400, 'El supervisor elegido ya no corresponde: revisa de nuevo'); supId = p.sugerido.id; supTxt = null; }
    const etiqueta = TIPOS_REUBICACION[tipo];
    // 1) Cerrar la(s) relación(es) actual(es)
    const cerrar = async (r, destino) => {
      if (tipo === 'traslado') {
        await c.query(`update relacion_laboral set estado='movido', fecha_egreso=$2, cerrado_por=$3, motivo_cierre=$4 where id=$1`, [r.id, p.finAnterior, u.id, `Traslado a la plaza ${destino.codigo}: ${motivo}`]);
      } else await c.query(`update relacion_laboral set estado='corregida', cerrado_por=$2, motivo_cierre=$3 where id=$1`, [r.id, u.id, `Corrección: estaba en la plaza ${r.plaza_codigo || '—'} y corresponde a ${destino.codigo}. ${motivo}`]);
    };
    // 2) Abrir la nueva en la plaza destino (copia los datos de la relación anterior)
    const abrir = async (r, destino, sup) => {
      const pu = (await c.query('select p.unidad_id, pf.nombre, pf.version_activa_id, z.empresa_id from plaza z join puesto p on p.id=z.puesto_id join perfil pf on pf.id=p.perfil_id where z.id=$1', [destino.id])).rows[0];
      const emp = pu.empresa_id || r.empresa_id;
      if (!pu.empresa_id) await c.query('update plaza set empresa_id=$2 where id=$1', [destino.id, emp]);   // «Por definir» toma la empresa de la persona
      const corr = tipo === 'correccion';
      return (await c.query(`insert into relacion_laboral(trabajador_id,empresa_id,unidad_id,cargo,requisicion_id,plaza_id,perfil_version_id,candidatura_id,origen,estado,fecha_ingreso,
          fecha_fin_contrato,ubicacion,tipo_empleado,departamento_origen,supervisor_id,supervisor_texto,importacion_id,confirmado_por,confirmado_en,reubicada_desde,tipo_reubicacion)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,'activo',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) returning id`,
        [r.trabajador_id, emp, pu.unidad_id, pu.nombre, corr ? r.requisicion_id : null, destino.id, pu.version_activa_id, corr ? r.candidatura_id : null, corr ? r.origen : 'traslado',
          corr ? r.fecha_ingreso : p.fecha, r.fecha_fin_contrato, r.ubicacion, r.tipo_empleado, r.departamento_origen, sup.id, sup.txt, corr ? r.importacion_id : null,
          corr ? r.confirmado_por : u.id, corr ? r.confirmado_en : new Date(), r.id, tipo])).rows[0].id;
    };
    const anterior = { id: rl.plaza_id, codigo: rl.plaza_codigo };
    await cerrar(rl, z); if (otro) await cerrar(otro, anterior);
    const nueva = await abrir(rl, z, { id: supId, txt: supTxt });
    const nuevaOtro = otro ? await abrir(otro, anterior, { id: otro.supervisor_id, txt: otro.supervisor_texto }) : null;
    const det = { tipo, motivo, de_plaza: rl.plaza_codigo, a_plaza: z.codigo, fecha: p.fecha || undefined, intercambio_con: otro ? otro.nombres : undefined };
    await hist(c, u, rl.id, 'reubicar', { ...det, a_relacion: nueva });
    await hist(c, u, nueva, 'reubicado', { ...det, desde_relacion: rl.id });
    if (otro) { const d2 = { tipo, motivo, de_plaza: z.codigo, a_plaza: rl.plaza_codigo, intercambio_con: rl.nombres };
      await hist(c, u, otro.id, 'reubicar', { ...d2, a_relacion: nuevaOtro }); await hist(c, u, nuevaOtro, 'reubicado', { ...d2, desde_relacion: otro.id }); }
    // 3) La plaza «por regularizar» que quedó vacía se cierra sola
    if (p.cierra) {
      const m = `Cerrada al reubicar a ${rl.nombres} (${etiqueta.toLowerCase()} a la plaza ${z.codigo}): plaza por regularizar sin ocupante`;
      await c.query('update plaza set hasta=greatest(current_date, desde), cerrado_por=$2, motivo_cierre=$3 where id=$1', [rl.plaza_id, u.id, m]);
      await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'plaza', String(rl.plaza_id), 'cerrar', { codigo: rl.plaza_codigo, motivo: m, automatico: true }]);
    }
    return { trabajador_id: rl.trabajador_id, nueva, cerrada: p.cierra, intercambio: otro ? otro.nombres : null };
  });
}
module.exports = { cedulaNorm, porIngresarC, deCandidatura, confirmarIngreso, noIngreso, CERRADOS, listar, ficha, egresar, TIPOS_EGRESO, ESTADOS_REL,
  TIPOS_REUBICACION, opcionesReubicar, revisarReubicacion, reubicar };
