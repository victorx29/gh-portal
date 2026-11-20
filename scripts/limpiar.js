// Limpieza de datos de PRUEBA (consola del servicio en EasyPanel). Primero muestra qué borraría; borra solo con --aplicar
// y con la variable PERMITIR_LIMPIEZA=si (ponla solo mientras limpias y quítala después).
//
//   npm run limpiar -- transacciones            → requisiciones, aprobaciones, comentarios, adjuntos, selección,
//                                                  ingresos de selección y todos los avisos a n8n. No toca estructura, perfiles,
//                                                  plantilla (salvo plazas creadas por requisiciones) ni usuarios.
//   npm run limpiar -- perfil GH-PF-001         → borra un perfil que nadie usa (sin puestos ni requisiciones).
//   ... --aplicar                               → ejecuta.
//
// El historial NO se borra: es inmutable y encadenado (hash). Se agrega una entrada «limpieza» con lo que se borró.
// Los contadores (REQ-, GH-PF-) vuelven al número más alto que quede: si se borra el último, se reutiliza su número.
const fs = require('fs'), path = require('path'), { pool, tx } = require('../src/db'), cfg = require('../src/config');
const [modo, arg] = process.argv.slice(2).filter(a => !a.startsWith('--')), aplicar = process.argv.includes('--aplicar');
const sinTriggers = async (c, tablas, on) => { for (const t of tablas) await c.query(`alter table ${t} ${on ? 'enable' : 'disable'} trigger user`); };

async function transacciones(c) {
  const ids = (await c.query('select id from requisicion')).rows.map(r => r.id);
  const rel = (await c.query("select id, trabajador_id from relacion_laboral where origen='seleccion'")).rows;
  const n = {
    requisiciones: ids.length,
    aprobaciones: +(await c.query('select count(*) from aprobacion')).rows[0].count,
    comentarios: +(await c.query('select count(*) from comentario')).rows[0].count,
    adjuntos: +(await c.query('select count(*) from adjunto')).rows[0].count,
    candidatos: +(await c.query('select count(*) from candidato')).rows[0].count,
    candidaturas: +(await c.query('select count(*) from candidatura')).rows[0].count,
    analisis_ia: +(await c.query('select count(*) from ia_analisis')).rows[0].count,
    ingresos_de_seleccion: rel.length,
    plazas_de_requisiciones: +(await c.query("select count(*) from plaza where origen='requisicion'")).rows[0].count,
    avisos_n8n: +(await c.query('select count(*) from evento_outbox')).rows[0].count
  };
  // Movimientos internos de prueba: no se pueden deshacer solos
  const movidos = (await c.query(`select count(*) from relacion_laboral where estado='movido' and origen<>'seleccion'`)).rows[0].count;
  if (+movidos) throw new Error(`Hay ${movidos} relación(es) reales cerradas por un movimiento interno: esta limpieza no las restaura. Revisa con TI`);
  if (!aplicar) return n;
  await sinTriggers(c, ['aprobacion', 'comentario', 'relacion_laboral', 'plaza', 'ia_analisis'], false);
  await c.query('delete from ia_analisis');
  const archivos = (await c.query('delete from adjunto returning ruta')).rows.map(r => r.ruta);
  await c.query("delete from relacion_laboral where origen='seleccion'");
  const huerfanos = (await c.query('select id from trabajador t where not exists (select 1 from relacion_laboral r where r.trabajador_id=t.id) and t.id = any($1)', [rel.map(r => r.trabajador_id)])).rows.map(r => r.id);
  await c.query('update relacion_laboral set supervisor_id=null where supervisor_id = any($1)', [huerfanos]);
  await c.query('delete from consulta_ficha where trabajador_id = any($1)', [huerfanos]);
  await c.query('delete from trabajador where id = any($1)', [huerfanos]);
  await c.query('delete from etapa_registro'); await c.query('update candidatura set cv_archivo_id=null'); await c.query('delete from candidatura');
  archivos.push(...(await c.query('delete from cv_archivo returning ruta')).rows.map(r => r.ruta));
  await c.query('delete from candidato');
  await c.query('delete from comentario'); await c.query('delete from aprobacion');
  await c.query('delete from requisicion_equipo'); await c.query('delete from requisicion_acceso');
  await c.query("update plaza set requisicion_id=null where origen<>'requisicion' and requisicion_id is not null");
  await c.query('update requisicion set plaza_id=null');
  await c.query("delete from plaza where origen='requisicion'");
  await c.query('delete from requisicion');
  await c.query('delete from evento_outbox');   // todos los avisos son de las pruebas
  await sinTriggers(c, ['aprobacion', 'comentario', 'relacion_laboral', 'plaza', 'ia_analisis'], true);
  await c.query(`select setval('req_seq', greatest(1, coalesce((select max(substring(codigo from '^REQ-([0-9]+)$')::int) from requisicion), 0)), (select count(*) > 0 from requisicion))`);
  n.archivos = archivos; return n;
}

async function perfil(c, codigo) {
  const p = (await c.query('select * from perfil where codigo=$1', [String(codigo || '').trim()])).rows[0];
  if (!p) throw new Error('No existe el perfil «' + codigo + '»');
  const usos = (await c.query(`select (select count(*) from puesto where perfil_id=$1) puestos,
    (select count(*) from requisicion r join perfil_version v on v.id=r.perfil_version_id where v.perfil_id=$1) requisiciones,
    (select count(*) from relacion_laboral r join perfil_version v on v.id=r.perfil_version_id where v.perfil_id=$1) relaciones`, [p.id])).rows[0];
  if (+usos.puestos || +usos.requisiciones || +usos.relaciones)
    throw new Error(`${p.codigo} está en uso (${usos.puestos} puesto(s), ${usos.requisiciones} requisición(es), ${usos.relaciones} ingreso(s)). Desactívalo en el portal o limpia antes las transacciones`);
  const n = { perfil: p.codigo + ' · ' + p.nombre, versiones: +(await c.query('select count(*) from perfil_version where perfil_id=$1', [p.id])).rows[0].count };
  if (!aplicar) return n;
  await sinTriggers(c, ['perfil_version'], false);
  await c.query('update perfil set version_activa_id=null where id=$1', [p.id]);
  await c.query('delete from perfil_version_control where version_id in (select id from perfil_version where perfil_id=$1)', [p.id]);
  await c.query('delete from perfil_version where perfil_id=$1', [p.id]);
  await c.query('delete from perfil_alcance where perfil_id=$1', [p.id]);
  await c.query('delete from perfil where id=$1', [p.id]);
  await sinTriggers(c, ['perfil_version'], true);
  await c.query(`select setval('perfil_seq', greatest(1, coalesce((select max(correlativo) from perfil), 0)), (select count(*) > 0 from perfil))`);
  return n;
}

(async () => {
  if (!['transacciones', 'perfil'].includes(modo)) throw new Error('Uso: npm run limpiar -- transacciones|perfil GH-PF-NNN [--aplicar]');
  if (aplicar && process.env.PERMITIR_LIMPIEZA !== 'si') throw new Error('Para borrar define PERMITIR_LIMPIEZA=si en el servicio (y quítala al terminar)');
  const r = await tx(async c => {
    const n = modo === 'perfil' ? await perfil(c, arg) : await transacciones(c);
    if (aplicar) await c.query('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values(null,$1,$2,$3,$4)',
      ['sistema', 'limpieza', 'limpiar.' + modo, { ...n, archivos: n.archivos ? n.archivos.length : undefined }]);
    return n;
  });
  (r.archivos || []).forEach(f => fs.unlink(path.join(cfg.uploads, f), () => {}));
  console.log(aplicar ? 'BORRADO:' : 'Se borraría (vista previa; agrega --aplicar para ejecutar):');
  console.log(JSON.stringify({ ...r, archivos: r.archivos ? r.archivos.length : undefined }, null, 2));
  await pool.end();
})().catch(async e => { console.error('No se hizo nada:', e.message); await pool.end(); process.exit(1); });
