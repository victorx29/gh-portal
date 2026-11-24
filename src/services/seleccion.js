const { q, tx } = require('../db'), P = require('./perm'), PL = require('./pipelines'), RS = require('./requisiciones'), EM = require('./empleados'), IA = require('./ia'), FI = require('./ficha'), LE = require('./lectura'), { E } = require('../util');
const ghOnly = u => { if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana gestiona la selección'); };
const histC = (c, u, id, accion, detalle) => c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'candidatura', String(id), accion, detalle || {}]);
const evento = (c, tipo, p) => c.query('insert into evento_outbox(tipo,payload) values($1,$2)', [tipo, p]);
// Los campos personalizados nunca salen del portal (0.9.3): se quitan de los datos del candidato que viajan a n8n
const sinCampos = cd => { const { campos, ...resto } = cd; void campos; return resto; };
const CA = `select ca.*, ca.codigo cand_codigo, c.nombre, c.email, c.telefono, c.cedula, c.campos, c.consentimiento_en, c.consentimiento_ref, cv.nombre_original cv_nombre, cv.subido_en cv_subido_en, cv.lectura, cv.lectura_error, cv.lectura_modelo, cv.lectura_recibida_en, cv.lectura_pedida_en, cv.lectura_datos, cv.alertas, cv.alertas_revisadas_en, c.nombre_provisional, r.empresa_id, r.codigo, r.plazas, r.estado req_estado, pf.nombre cargo
  from candidatura ca join candidato c on c.id=ca.candidato_id join requisicion r on r.id=ca.requisicion_id left join cv_archivo cv on cv.id=ca.cv_archivo_id
  join perfil_version pv on pv.id=r.perfil_version_id join perfil pf on pf.id=pv.perfil_id`;

async function tablero(u, reqId) {
  ghOnly(u); const req = await RS.obtener(u, reqId), pl = await PL.resolver(req.empresa_id, 'seleccion');
  // 0.9.4: número del candidato, lectura del CV en n8n y alertas sin revisar
  const cands = (await q(`select ca.*, c.nombre, c.email, c.cedula, c.nombre_provisional, cv.lectura, cv.lectura_error,
      (cv.lectura='pendiente' and cv.lectura_pedida_en < now() - interval '${LE.VENCE_MIN} minutes') lectura_vencida,
      case when cv.alertas_revisadas_en is null then jsonb_array_length(coalesce(cv.alertas,'[]')) else 0 end alertas
    from candidatura ca join candidato c on c.id=ca.candidato_id left join cv_archivo cv on cv.id=ca.cv_archivo_id where ca.requisicion_id=$1 order by ca.correlativo`, [reqId])).rows;
  // Puntaje orientativo de la IA: ordena las tarjetas de cada columna (mayor primero); GH decide
  const pts = await IA.puntajes(reqId); cands.forEach(x => { const a = pts.get(x.id); x.ia = a || null; });
  cands.sort((a, b) => ((b.ia && b.ia.estado === 'listo' ? +b.ia.puntaje : -1) - (a.ia && a.ia.estado === 'listo' ? +a.ia.puntaje : -1)) || a.id - b.id);
  const ing = cands.filter(x => pl.exito && x.etapa === pl.exito.clave).length;
  const activas = new Set(pl.flujo.filter(e => e.clase !== 'exito').map(e => String(e.clave))), act = cands.filter(x => activas.has(String(x.etapa)));
  const resumen = { leyendo: act.filter(x => x.lectura === 'pendiente' && !x.lectura_vencida).length, fallas: act.filter(x => x.lectura === 'error' || x.lectura_vencida).length,
    alertas: act.filter(x => x.alertas > 0).length, sinCedula: act.filter(x => !x.cedula).length, sinLectura: act.filter(x => x.lectura === 'sin_lectura').length };
  // 0.9.5: avance de lo que está en curso («Lectura: 7 de 10 CV») y estado del resumen general con IA
  const enCurso = x => x.ia && x.ia.estado === 'pendiente' && !x.ia.vencido;
  const conLectura = act.filter(x => ['pendiente', 'lista', 'error'].includes(x.lectura)), conIA = act.filter(x => x.ia);
  const avance = { lectura: { n: conLectura.filter(x => x.lectura !== 'pendiente' || x.lectura_vencida).length, N: conLectura.length },
    analisis: { n: conIA.filter(x => !enCurso(x)).length, N: conIA.length } };
  const ult = (await q(`select estado, recibido_en, (estado='pendiente' and solicitado_en < now() - interval '30 minutes') vencido,
    (estado='listo' and recibido_en > now() - interval '15 minutes') reciente from ia_resumen where requisicion_id=$1 order by id desc limit 1`, [reqId])).rows[0] || null;
  const st = await LE.estado(u, reqId);
  return { req, pl, cands, ing, resumen, avance, enCurso, ultimoResumen: ult, lectura: LE.configurada(), firma: st.firma, sondeo: st.pendientes > 0 };
}
// Bandeja de selección (0.9.5.2): las requisiciones en Selección con su avance; cada una abre su tablero. Solo GH.
async function bandeja(u) {
  ghOnly(u);
  // «desde»: última entrada a Selección según el historial (una sola lectura del historial, no una por requisición)
  const R = (await q(`with sel as (select h.entidad_id, max(h.fecha) f from historial h where h.entidad='requisicion' and h.detalle->>'a'='seleccion' group by h.entidad_id)
    select r.id, r.codigo, r.plazas, r.empresa_id, coalesce(e.razon_social, e.nombre) empresa, e.siglas, un.nombre unidad, pf.nombre cargo, coalesce(sel.f, r.creada_en) desde
    from requisicion r join empresa e on e.id=r.empresa_id left join unidad un on un.id=r.unidad_id left join sel on sel.entidad_id=r.id::text
    join perfil_version pv on pv.id=r.perfil_version_id join perfil pf on pf.id=pv.perfil_id
    where r.estado='seleccion' order by desde`)).rows;
  if (!R.length) return { reqs: [] };
  const C = (await q(`select ca.requisicion_id, ca.etapa, cv.lectura, (cv.lectura='pendiente' and cv.lectura_pedida_en > now() - interval '${LE.VENCE_MIN} minutes') leyendo,
      (cv.alertas_revisadas_en is null and jsonb_array_length(coalesce(cv.alertas,'[]')) > 0) alertas,
      (select a.estado from ia_analisis a where a.candidatura_id=ca.id and a.cv_archivo_id=ca.cv_archivo_id order by a.id desc limit 1) ia
    from candidatura ca left join cv_archivo cv on cv.id=ca.cv_archivo_id where ca.requisicion_id = any($1)`, [R.map(r => r.id)])).rows;
  const pls = new Map();
  for (const r of R) {
    if (!pls.has(r.empresa_id)) pls.set(r.empresa_id, await PL.resolver(r.empresa_id, 'seleccion'));
    const pl = pls.get(r.empresa_id), L = C.filter(c => c.requisicion_id === r.id);
    const activas = pl.flujo.filter(e => e.clase !== 'exito'), act = L.filter(c => activas.some(e => String(e.clave) === String(c.etapa)));
    r.ingresos = L.filter(c => pl.exito && String(c.etapa) === String(pl.exito.clave)).length;
    r.activos = act.length; r.analizados = act.filter(c => c.ia === 'listo').length;
    r.enCurso = act.filter(c => c.leyendo || c.ia === 'pendiente').length; r.alertas = act.filter(c => c.alertas).length;
    r.etapas = activas.map(e => ({ nombre: e.nombre, n: act.filter(c => String(c.etapa) === String(e.clave)).length })).filter(e => e.n);
    r.dias = Math.max(0, Math.floor((Date.now() - new Date(r.desde).getTime()) / 864e5));
  }
  return { reqs: R };
}
async function crearCandidato(u, reqId, b) {
  ghOnly(u); const nombre = String(b.nombre || '').trim(); if (!nombre) throw E(400, 'El nombre es obligatorio');
  const cedula = EM.cedulaNorm(b.cedula); if (!cedula) throw E(400, 'La cédula es obligatoria: identifica al candidato en todas sus postulaciones');
  const t = k => String(b[k] || '').trim() || null;
  const defs = await FI.campos('candidato');
  return tx(async c => {
    const r = await RS.lock(c, reqId); if (r.estado !== 'seleccion') throw E(400, 'La requisición no está en Selección');
    const pl = await PL.resolver(r.empresa_id, 'seleccion', c);
    // Un candidato por cédula: si ya existe se reutiliza su ficha (se actualizan correo y teléfono si vienen)
    let cd = (await c.query('select id from candidato where cedula=$1 for update', [cedula])).rows[0];
    if (cd) {
      if ((await c.query('select 1 from candidatura where requisicion_id=$1 and candidato_id=$2', [reqId, cd.id])).rowCount) throw E(400, 'Esa cédula ya está postulada en esta requisición');
      const prev = (await c.query('select campos from candidato where id=$1', [cd.id])).rows[0].campos;
      await c.query('update candidato set email=coalesce($2,email), telefono=coalesce($3,telefono), campos=$4 where id=$1', [cd.id, t('email'), t('telefono'), FI.leerCampos(defs, b, prev, true)]);
    } else cd = (await c.query('insert into candidato(nombre,email,telefono,cedula,campos) values($1,$2,$3,$4,$5) returning id', [nombre, t('email'), t('telefono'), cedula, FI.leerCampos(defs, b, {}, true)])).rows[0];
    const ca = (await c.query('insert into candidatura(requisicion_id,candidato_id,etapa) values($1,$2,$3) returning id', [reqId, cd.id, pl.flujo[0].clave])).rows[0];
    await histC(c, u, ca.id, 'crear', { requisicion: reqId }); return ca.id;
  });
}
async function detalle(u, id) {
  ghOnly(u); const ca = (await q(CA + ' where ca.id=$1', [id])).rows[0]; if (!ca) throw E(404, 'Candidatura no encontrada');
  const pl = await PL.resolver(ca.empresa_id, 'seleccion'), i = pl.flujo.findIndex(e => e.clave === ca.etapa), et = pl.etapas.find(e => e.clave === ca.etapa);
  const activa = i >= 0 && et.clase !== 'exito', nxt = activa ? pl.flujo[i + 1] : null;
  const registro = activa ? (await q('select * from etapa_registro where tipo=$1 and entidad_id=$2 and etapa=$3', ['candidatura', id, et.clave])).rows[0] || null : null;
  const bloqueos = nxt ? await PL.problemas({ query: q }, 'candidatura', id, et) : [];
  // Otras postulaciones de la misma persona y si ya es empleado (movimiento interno)
  const otras = (await q(`select ca.id, ca.etapa, ca.codigo, pf.nombre cargo, ca.actualizada_en from candidatura ca join requisicion r on r.id=ca.requisicion_id
    join perfil_version pv on pv.id=r.perfil_version_id join perfil pf on pf.id=pv.perfil_id where ca.candidato_id=$1 and ca.id<>$2 order by ca.id desc`, [ca.candidato_id, id])).rows;
  const empleado = ca.cedula ? (await q(`select rl.cargo, un.nombre unidad, rl.fecha_ingreso from relacion_laboral rl join trabajador t on t.id=rl.trabajador_id left join unidad un on un.id=rl.unidad_id
    where t.cedula=$1 and rl.estado='activo' order by rl.fecha_ingreso desc limit 1`, [ca.cedula])).rows[0] || null : null;
  const ingreso = et && et.clase === 'exito' ? await EM.deCandidatura(id) : null;
  // 0.9.3: ficha que GH completa al confirmar el ingreso (si la persona ya tuvo ficha, viene precargada) y campos personalizados
  const ficha = ingreso ? (await q('select t.*, r.ubicacion, r.tipo_empleado, r.fecha_fin_contrato from trabajador t join relacion_laboral r on r.trabajador_id=t.id where r.id=$1', [ingreso.id])).rows[0] : null;
  // 0.9.4: ficha anterior con la misma cédula que leyó n8n (para unir si GH confirma que es la misma persona)
  const dup = !ca.cedula && ca.lectura_datos && ca.lectura_datos.duplicado_de ? (await q('select id, nombre, cedula from candidato where id=$1', [ca.lectura_datos.duplicado_de])).rows[0] || null : null;
  const lecturaVencida = ca.lectura === 'pendiente' && ca.lectura_pedida_en < new Date(Date.now() - LE.VENCE_MIN * 60000);
  return { EXT: LE.EXT, dup, lecturaVencida, lecturaOk: LE.configurada(), ca, et, activa, siguiente: nxt, registro, bloqueos, otras, empleado, ingreso, ia: await IA.ultimo(id), ficha,
    cat: ficha ? await FI.catalogos() : null, defsEmp: ficha ? await FI.campos('empleado') : [], defsCand: await FI.campos('candidato'), mostrar: FI.mostrar };
}
// Campos personalizados del candidato (GH)
async function guardarCampos(u, id, b) {
  ghOnly(u); const defs = await FI.campos('candidato');
  return tx(async c => {
    const ca = (await c.query('select candidato_id from candidatura where id=$1', [id])).rows[0]; if (!ca) throw E(404, 'Candidatura no encontrada');
    const prev = (await c.query('select campos from candidato where id=$1 for update', [ca.candidato_id])).rows[0].campos;
    await c.query('update candidato set campos=$2 where id=$1', [ca.candidato_id, FI.leerCampos(defs, b, prev, true)]);
    await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'candidato', String(ca.candidato_id), 'campos', { campos: Object.keys(b).filter(k => k.startsWith('cp_')).length }]);
  });
}
// Datos del candidato (0.9.4): nombre, cédula, correo y teléfono. Si la cédula ya tiene ficha de otra postulación y GH confirma
// que es la misma persona («unir»), esta candidatura pasa a esa ficha; la provisional queda marcada como unida (no se borra).
async function editarDatos(u, id, b) {
  ghOnly(u);
  const nombre = String(b.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (nombre.length < 3) throw E(400, 'Escribe el nombre completo');
  const ced = EM.cedulaNorm(b.cedula), t = k => String(b[k] || '').trim().slice(0, 160) || null, email = t('email');
  if (ced && (ced.length < 6 || ced.length > 10)) throw E(400, 'La cédula debe tener entre 6 y 10 dígitos');
  if (email && !LE.RX_EMAIL.test(email)) throw E(400, 'El correo no es válido');
  return tx(async c => {
    const ca = (await c.query('select * from candidatura where id=$1 for update', [id])).rows[0]; if (!ca) throw E(404, 'Candidatura no encontrada');
    const cd = (await c.query('select * from candidato where id=$1 for update', [ca.candidato_id])).rows[0];
    const conIngreso = async cid => (await c.query('select 1 from relacion_laboral where candidatura_id in (select id from candidatura where candidato_id=$1)', [cid])).rowCount > 0;
    if (cd.cedula && ced !== cd.cedula && await conIngreso(cd.id)) throw E(400, 'La cédula no se cambia: la persona ya tiene un ingreso registrado');
    if (cd.cedula && !ced) throw E(400, 'La cédula no se puede dejar vacía una vez registrada');
    const otro = ced && ced !== cd.cedula ? (await c.query('select * from candidato where cedula=$1 and id<>$2 for update', [ced, cd.id])).rows[0] : null;
    if (otro) {
      const pos = (await c.query('select codigo, requisicion_id from candidatura where candidato_id=$1 order by id desc', [otro.id])).rows;
      const aqui = pos.find(p => p.requisicion_id === ca.requisicion_id);
      if (aqui) throw E(400, `Esa persona ya está en esta requisición como ${aqui.codigo}: rechaza esta candidatura como duplicada`);
      if (b.unir !== 'on') throw E(400, `La cédula ya tiene ficha de candidato (${otro.nombre}${pos.length ? ', postuló a ' + pos.slice(0, 3).map(p => p.codigo).join(', ') : ''}). Si es la misma persona, marca «Unir con esa ficha»`);
      if ((await c.query('select count(*)::int n from candidatura where candidato_id=$1', [cd.id])).rows[0].n > 1) throw E(400, 'Esta ficha tiene otras postulaciones: no se puede unir desde aquí');
      // Unir: la candidatura y su CV pasan a la ficha anterior; se completan sus datos vacíos y el consentimiento si no lo tenía
      await c.query('update candidatura set candidato_id=$2, actualizada_en=now() where id=$1', [id, otro.id]);
      await c.query('update cv_archivo set candidato_id=$2 where candidato_id=$1', [cd.id, otro.id]);
      await c.query(`update candidato set email=coalesce(email,$2), telefono=coalesce(telefono,$3),
        consentimiento_en=coalesce(consentimiento_en,$4), consentimiento_por=case when consentimiento_en is null then $5 else consentimiento_por end, consentimiento_ref=case when consentimiento_en is null then $6 else consentimiento_ref end where id=$1`,
        [otro.id, email || cd.email, t('telefono') || cd.telefono, cd.consentimiento_en, cd.consentimiento_por, cd.consentimiento_ref]);
      await c.query('update candidato set unido_a=$2 where id=$1', [cd.id, otro.id]);
      await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'candidato', String(cd.id), 'unir', { con: otro.id, candidatura: ca.codigo }]);
      await histC(c, u, id, 'unir', { de: cd.id, a: otro.id });
      return { unido: otro.nombre };
    }
    await c.query('update candidato set nombre=$2, cedula=$3, email=$4, telefono=$5, nombre_provisional=false where id=$1', [cd.id, nombre, ced || cd.cedula, email, t('telefono')]);
    const cambios = ['nombre', 'cedula', 'email', 'telefono'].filter(k => String((k === 'cedula' ? ced || cd.cedula : k === 'nombre' ? nombre : k === 'email' ? email : t(k)) || '') !== String(cd[k] || ''));
    await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [u.id, 'candidato', String(cd.id), 'datos', { campos: cambios }]);
    return {};
  });
}
async function registrar(u, id, b) { const d = await detalle(u, id); if (!d.activa) throw E(400, 'Esta etapa no admite registro'); await PL.registrar(u, 'candidatura', id, d.et, b); }

async function avanzar(u, id) {
  ghOnly(u);
  return tx(async c => {
    const ca = (await c.query('select * from candidatura where id=$1 for update', [id])).rows[0]; if (!ca) throw E(404, 'No encontrada');
    const r = (await c.query('select r.*, pf.nombre cargo from requisicion r join perfil_version pv on pv.id=r.perfil_version_id join perfil pf on pf.id=pv.perfil_id where r.id=$1 for update of r', [ca.requisicion_id])).rows[0];
    const pl = await PL.resolver(r.empresa_id, 'seleccion', c), i = pl.flujo.findIndex(e => e.clave === ca.etapa), nxt = pl.flujo[i + 1];
    if (i < 0 || !nxt) throw E(400, 'No se puede avanzar desde esta etapa');
    const pr = await PL.problemas(c, 'candidatura', id, pl.flujo[i]); if (pr.length) throw E(400, pr.join('. '));
    await c.query('update candidatura set etapa=$2, actualizada_en=now() where id=$1', [id, nxt.clave]);
    await histC(c, u, id, 'avanzar', { de: ca.etapa, a: nxt.clave });
    const cd = (await c.query('select * from candidato where id=$1', [ca.candidato_id])).rows[0];
    await evento(c, 'candidatura.' + nxt.clave, { candidatura_id: id, candidatura_codigo: ca.codigo, requisicion_id: r.id, codigo: r.codigo, etapa: nxt.nombre, etapa_anterior: ca.etapa, candidato: cd.nombre, email: cd.email, candidato_datos: sinCampos(cd), url: RS.urlReq(r.id), requisicion: await RS.detalleEvento(c, r.id) });
    // 0.9.4: el nombre que vino del archivo no llega a la ficha del empleado
    if (nxt.clase === 'exito' && cd.nombre_provisional) throw E(400, 'El nombre del candidato es el del archivo del CV: corrígelo en «Editar datos» antes de pasarlo a Ingreso');
    if (nxt.clase === 'exito') {   // ingreso: la persona queda «por ingresar» en la plaza; GH confirma después la fecha real
      await EM.porIngresarC(c, u, { id }, cd, r);
      const n = (await c.query('select count(*)::int n from candidatura where requisicion_id=$1 and etapa=$2', [r.id, nxt.clave])).rows[0].n;
      const rpl = await PL.resolver(r.empresa_id, 'requisicion', c);
      if (n >= r.plazas && r.estado !== rpl.exito.clave) await RS.cambiar(c, u, r, rpl.exito.clave, 'plazas_cubiertas');
    }
  });
}
async function rechazar(u, id, motivo) {
  ghOnly(u); if (!String(motivo || '').trim()) throw E(400, 'El motivo del rechazo es obligatorio');
  return tx(async c => {
    const ca = (await c.query('select * from candidatura where id=$1 for update', [id])).rows[0]; if (!ca) throw E(404, 'No encontrada');
    const r = (await c.query('select * from requisicion where id=$1', [ca.requisicion_id])).rows[0], pl = await PL.resolver(r.empresa_id, 'seleccion', c);
    const et = pl.flujo.find(e => e.clave === ca.etapa); if (!et || et.clase === 'exito') throw E(400, 'No se puede rechazar en esta etapa');
    await c.query('update candidatura set etapa=$2, motivo_rechazo=$3, actualizada_en=now() where id=$1', [id, pl.cierre.clave, motivo.trim()]);
    await histC(c, u, id, 'rechazar', { de: ca.etapa, motivo: motivo.trim() });
    const cd = (await c.query('select * from candidato where id=$1', [ca.candidato_id])).rows[0];
    await evento(c, 'candidatura.' + pl.cierre.clave, { candidatura_id: id, candidatura_codigo: ca.codigo, requisicion_id: r.id, codigo: r.codigo, etapa_anterior: ca.etapa, motivo: motivo.trim(), candidato: cd.nombre, email: cd.email, candidato_datos: sinCampos(cd), url: RS.urlReq(r.id), requisicion: await RS.detalleEvento(c, r.id) });
  });
}
module.exports = { bandeja, editarDatos, guardarCampos, tablero, crearCandidato, detalle, registrar, avanzar, rechazar };
