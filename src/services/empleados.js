// Trabajadores y su relación laboral (ingreso a una plaza). Base de la 0.8: la importación del Listado usará estas mismas reglas.
const { q, tx } = require('../db'), P = require('./perm'), RS = require('./requisiciones'), { E } = require('../util');

// Cédula: solo los dígitos («V-12.345.678» → «12345678»), igual que cedula_norm() en la base (migración 013)
const cedulaNorm = t => String(t == null ? '' : t).replace(/\D/g, '') || null;
const fechaOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s));
const ghOnly = u => { if (!P.esGH(u)) throw E(403, 'Solo Gestión Humana gestiona los ingresos'); };
const hist = (c, u, id, accion, detalle) => c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)',
  [u && u.id, 'relacion_laboral', String(id), accion, detalle || {}]);
const CERRADOS = ['egresado', 'movido', 'no_ingreso'];

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

module.exports = { cedulaNorm, porIngresarC, deCandidatura, confirmarIngreso, noIngreso, CERRADOS };
