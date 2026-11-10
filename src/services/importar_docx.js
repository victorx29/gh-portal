// Importación de descripciones de cargo (.docx). Reglas acordadas con GH:
// - El nombre del perfil es el del cargo del documento (GH puede renombrarlo en la vista previa).
// - «Reporta a» y «Departamento» del Word NO se guardan: los da la plantilla. Si no coinciden, se avisa.
// - «Trabajador ocupante» no se guarda: sale de la plaza ocupada.
// - Si el perfil ya existe (mismo nombre) y el contenido cambió, se crea una versión nueva activa; si no cambió, no se toca.
const { q, tx } = require('../db'), D = require('./docx_cargo'), PF = require('./perfiles'), PL = require('./plantilla'), { E, nombreArchivo } = require('../util');
const MAX = 300;

// Reporte según la plantilla de cada perfil (para avisar diferencias con el documento)
async function reportesPorPerfil() {
  const { byP } = await PL.__cargar(), m = new Map();
  for (const p of byP.values()) { const r = byP.get(p.reporta_id), a = m.get(p.perfil_id) || []; a.push({ unidad: p.unidad, reporta: r ? r.perfil : null }); m.set(p.perfil_id, a); }
  return m;
}
async function analizar(archivos) {
  if (!archivos.length) throw E(400, 'Selecciona al menos un archivo .docx');
  if (archivos.length > MAX) throw E(400, 'Máximo ' + MAX + ' archivos por carga');
  const filas = [];
  for (const [i, f] of archivos.entries()) {
    try { const r = await D.leer(f.buffer); filas.push({ i, archivo: nombreArchivo(f), ok: true, nombre: r.cargo, departamento: r.departamento || '', reporta_doc: r.reporta_doc || '', contenido: PF.contenidoDe(r), control: r.control, avisos: r.avisos }); }
    catch (e) { filas.push({ i, archivo: nombreArchivo(f), ok: false, error: e.message }); }
  }
  return evaluar(filas);
}
// Evalúa (o reevalúa tras renombrar) contra los perfiles existentes
async function evaluar(filas) {
  const ps = (await q('select p.id, p.codigo, p.nombre, p.activo, v.contenido, v.version from perfil p left join perfil_version v on v.id=p.version_activa_id')).rows;
  const porNombre = new Map(ps.map(p => [D.norm(p.nombre), p])), rep = await reportesPorPerfil(), cuenta = new Map();
  filas.filter(f => f.ok).forEach(f => cuenta.set(D.norm(f.nombre), (cuenta.get(D.norm(f.nombre)) || 0) + 1));
  for (const f of filas) {
    if (!f.ok) continue;
    f.errores = []; f.avisosEval = [];
    if (!String(f.nombre || '').trim()) f.errores.push('Falta el nombre del cargo');
    if (cuenta.get(D.norm(f.nombre)) > 1) f.errores.push('Hay otro documento con el mismo cargo: renombra uno de los dos');
    const ex = porNombre.get(D.norm(f.nombre)); f.existe = ex ? { id: ex.id, codigo: ex.codigo, version: ex.version, activo: ex.activo } : null;
    f.accion = !ex ? 'nuevo' : PF.__igual(ex.contenido, f.contenido) ? 'igual' : 'version';
    if (ex && !ex.activo) f.avisosEval.push('El perfil existe pero está inactivo: la versión nueva se crea igual');
    const pls = ex ? rep.get(ex.id) || [] : [];
    if (f.reporta_doc) {
      if (!pls.length) f.avisosEval.push(`El documento dice «Reporta a: ${f.reporta_doc}». Aún no tiene puesto en la plantilla: ahí se define a quién reporta`);
      else pls.filter(x => !x.reporta || !D.norm(x.reporta).includes(D.norm(f.reporta_doc).replace(/^(la|el)/, '').slice(0, 12)))
        .forEach(x => f.avisosEval.push(`El documento dice «Reporta a: ${f.reporta_doc}», pero en la plantilla (${x.unidad}) reporta a ${x.reporta || 'nadie'}. Manda la plantilla`));
    }
  }
  const ok = filas.filter(f => f.ok);
  return { filas, resumen: { archivos: filas.length, nuevos: ok.filter(f => f.accion === 'nuevo').length, versiones: ok.filter(f => f.accion === 'version').length,
    iguales: ok.filter(f => f.accion === 'igual').length, ilegibles: filas.filter(f => !f.ok).length, conflictos: ok.filter(f => f.errores.length).length } };
}
// Aplica: nombres posiblemente corregidos en la vista previa y alcance elegido para los perfiles nuevos
async function aplicar(filas, nombres, alcance, usr) {
  filas.forEach(f => { if (f.ok && nombres['nombre_' + f.i] != null) f.nombre = String(nombres['nombre_' + f.i]).trim(); });
  const ev = await evaluar(filas);
  if (ev.resumen.conflictos) throw E(400, 'Todavía hay conflictos de nombres: corrígelos antes de aplicar');
  const res = { nuevos: 0, versiones: 0 };
  await tx(async c => {
    for (const f of ev.filas.filter(x => x.ok && x.accion !== 'igual')) {
      const origen = 'Word: ' + f.archivo.slice(0, 120);
      if (f.accion === 'nuevo') {
        const b = { ...f.contenido, responsabilidades: f.contenido.responsabilidades, nombre: f.nombre, general: alcance.general, empresas: alcance.empresas, unidades: alcance.unidades };
        const id = await PF.crearC(c, usr, b), vid = (await c.query('select version_activa_id v from perfil where id=$1', [id])).rows[0].v;
        await PF.guardarControlC(c, usr, vid, f.control || {}, origen); res.nuevos++;
      } else {
        await PF.nuevaVersionC(c, usr, f.existe.id, f.contenido, true);
        const vid = (await c.query('select version_activa_id v from perfil where id=$1', [f.existe.id])).rows[0].v;
        await PF.guardarControlC(c, usr, vid, f.control || {}, origen); res.versiones++;
      }
    }
  });
  return res;
}
module.exports = { analizar, evaluar, aplicar, MAX };
