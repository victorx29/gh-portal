// Empleados (0.8.1): base de empleados, ficha (solo GH), importación del Listado, equivalencias y egreso.
// Organigrama de empleados de consulta (0.8.2): todos los usuarios, cada uno en su alcance.
const r = require('express').Router(), EM = require('../services/empleados'), IE = require('../services/importar_empleados'), PL = require('../services/plantilla'),
  ES = require('../services/estructura'), P = require('../services/perm'), { q } = require('../db'),
  { w, E, flash, modal, hacer, subidaXlsx, VISTA_PREVIA_MS, nombreArchivo } = require('../util');
const gh = (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana'));
const empresasActivas = async () => (await q('select id, siglas, coalesce(razon_social, nombre) nombre from empresa where activa order by 3')).rows;

r.get('/empleados', gh, w(async (req, res) => {
  const f = { q: String(req.query.q || '').trim(), empresa: req.query.empresa || '', estado: ['activo', 'egresado', 'todos'].includes(req.query.estado) ? req.query.estado : 'activo', incompleta: req.query.incompleta === '1' };
  res.render('empleados', { title: 'Empleados', nav: 'empleados', f, es: (await EM.listar(req.user, f)).filter(x => !f.incompleta || x.incompleta), empresas: await empresasActivas(),
    porReg: (await q("select count(*)::int n from plaza where por_regularizar and (hasta is null or hasta > current_date)")).rows[0].n });
}));
r.get('/empleados/:id(\\d+)', gh, w(async (req, res) => modal(req, res, 'empleado_ficha', { title: 'Empleado', nav: 'empleados', d: await EM.ficha(req.user, +req.params.id),
  TIPOS: EM.TIPOS_EGRESO, ESTADOS: EM.ESTADOS_REL })));
r.post('/empleados/relacion/:id(\\d+)/egreso', gh, w(async (req, res) => {
  const t = (await q('select trabajador_id from relacion_laboral where id=$1', [+req.params.id])).rows[0];
  try { await EM.egresar(req.user, +req.params.id, req.body); flash(req, 'ok', 'Egreso registrado: la plaza queda libre'); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect(t ? '/empleados?estado=todos&modal=' + encodeURIComponent('/empleados/' + t.trabajador_id) : '/empleados');
}));

// ---- Anular un egreso registrado por error (0.9.2) ----
r.post('/empleados/relacion/:id(\\d+)/anular-egreso', gh, w(async (req, res) => {
  const t = (await q('select trabajador_id from relacion_laboral where id=$1', [+req.params.id])).rows[0];
  try { const x = await EM.anularEgreso(req.user, +req.params.id, req.body); flash(req, 'ok', 'Egreso anulado: la persona vuelve a su plaza' + (x.descongelada ? ' y la plaza se descongeló' : '')); }
  catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect(t ? '/empleados?estado=todos&modal=' + encodeURIComponent('/empleados/' + t.trabajador_id) : '/empleados');
}));

// ---- Reubicar en otra plaza (0.9.1): formulario → revisar → confirmar ----
const fichaDe = tid => '/empleados?estado=todos&modal=' + encodeURIComponent('/empleados/' + tid);
const formReubicar = id => '/empleados?estado=todos&modal=' + encodeURIComponent('/empleados/relacion/' + id + '/reubicar');
const errNegocio = (req, res, e, volver) => { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); res.redirect(volver); };
r.get('/empleados/relacion/:id(\\d+)/reubicar', gh, w(async (req, res) => modal(req, res, 'empleado_reubicar', { title: 'Reubicar', nav: 'empleados', paso: 'form',
  o: await EM.opcionesReubicar(req.user, +req.params.id), TIPOS: EM.TIPOS_REUBICACION })));
r.post('/empleados/relacion/:id(\\d+)/reubicar/revisar', gh, w(async (req, res) => {
  try { res.render('shell', { title: 'Revisar reubicación', nav: 'empleados', inner: 'empleado_reubicar', paso: 'revisar', p: await EM.revisarReubicacion(req.user, +req.params.id, req.body), b: req.body, TIPOS: EM.TIPOS_REUBICACION }); }
  catch (e) { errNegocio(req, res, e, formReubicar(+req.params.id)); }
}));
r.post('/empleados/relacion/:id(\\d+)/reubicar', gh, w(async (req, res) => {
  try {
    const x = await EM.reubicar(req.user, +req.params.id, req.body);
    flash(req, 'ok', 'Persona reubicada' + (x.intercambio ? '; ' + x.intercambio + ' pasó a su plaza anterior' : '') + (x.cerrada ? '. La plaza ' + x.cerrada + ' («por regularizar») quedó vacía y se cerró' : ''));
    res.redirect(fichaDe(x.trabajador_id));
  } catch (e) { errNegocio(req, res, e, formReubicar(+req.params.id)); }
}));

// ---- Alta manual (0.9.3) ----
r.get('/empleados/nuevo', gh, w(async (req, res) => res.render('empleado_alta', { title: 'Alta manual', nav: 'empleados', o: await EM.opcionesAlta() })));
r.post('/empleados/nuevo', gh, w(async (req, res) => {
  try {
    const x = await EM.altaManual(req.user, req.body);
    flash(req, 'ok', 'Empleado registrado en la plaza ' + x.plaza + (x.porRegularizar ? ' («por regularizar»: no cuenta en el HC hasta regularizarla)' : ''));
    res.redirect('/empleados?estado=todos&modal=' + encodeURIComponent('/empleados/' + x.trabajador_id));
  } catch (e) {
    if (!e.status || e.status >= 500) throw e;
    // Se vuelve a mostrar el formulario con lo escrito (sin perder datos)
    res.status(400).render('empleado_alta', { title: 'Alta manual', nav: 'empleados', o: await EM.opcionesAlta(), b: req.body, error: e.message });
  }
}));

// ---- Campos personalizados (0.9.3): los define GH para el candidato, el empleado o ambos ----
const FI = require('../services/ficha');
r.get('/config/campos', gh, w(async (req, res) => res.render('config_campos', { title: 'Campos personalizados', nav: 'config', sub: 'campos', cs: await FI.listarCampos(), TIPOS: FI.TIPOS_CAMPO, APLICA: FI.APLICA })));
r.get('/config/campos/:id(\\d+)', gh, w(async (req, res) => {
  const c = (await q('select * from campo_personalizado where id=$1', [+req.params.id])).rows[0]; if (!c) throw E(404, 'Campo no encontrado');
  modal(req, res, 'campo_form', { title: 'Editar campo', nav: 'config', sub: 'campos', c, TIPOS: FI.TIPOS_CAMPO, APLICA: FI.APLICA });
}));
r.post('/config/campos', gh, hacer(req => FI.crearCampo(req.user, req.body), 'Campo creado', '/config/campos'));
r.post('/config/campos/:id(\\d+)', gh, hacer(req => FI.editarCampo(req.user, +req.params.id, req.body), 'Campo actualizado', '/config/campos'));
r.post('/config/campos/:id(\\d+)/activo', gh, hacer(req => FI.activarCampo(req.user, +req.params.id), 'Campo actualizado', '/config/campos'));
// Editar la ficha del empleado (completar datos)
r.get('/empleados/:id(\\d+)/editar', gh, w(async (req, res) => {
  const t = (await q('select * from trabajador where id=$1', [+req.params.id])).rows[0]; if (!t) throw E(404, 'Empleado no encontrado');
  const r0 = (await q("select ubicacion, tipo_empleado, fecha_fin_contrato from relacion_laboral where trabajador_id=$1 and estado='activo' order by id desc limit 1", [t.id])).rows[0] || {};
  modal(req, res, 'empleado_editar', { title: 'Editar ficha', nav: 'empleados', t, v: { ...t, ...r0 }, activo: !!r0.tipo_empleado || !!r0.ubicacion || !!(await q("select 1 from relacion_laboral where trabajador_id=$1 and estado='activo'", [t.id])).rowCount,
    cat: await FI.catalogos(), defs: await FI.campos('empleado') });
}));
r.post('/empleados/:id(\\d+)/editar', gh, hacer(async req => { await FI.editarFicha(req.user, +req.params.id, req.body); return '/empleados?estado=todos&modal=' + encodeURIComponent('/empleados/' + req.params.id); },
  'Ficha actualizada', req => '/empleados?estado=todos&modal=' + encodeURIComponent('/empleados/' + req.params.id + '/editar')));

// ---- Importación del Listado de Activos ----
const pagina = (req, res, extra) => {
  // Una vista previa vencida no se queda en la sesión (trae datos personales)
  if (req.session.importEmpleados && Date.now() - req.session.importEmpleados.en > VISTA_PREVIA_MS) delete req.session.importEmpleados;
  return res.render('empleados_importar', { title: 'Importar Listado de Activos', nav: 'empleados', res: null, eq: null, hayListado: !!req.session.importEmpleados, ...extra });
};
r.get('/empleados/importar', gh, (req, res) => pagina(req, res));
r.post('/empleados/importar', gh, subidaXlsx('/empleados/importar'), w(async (req, res) => {
  try {
    if (!req.file) throw E(400, 'Selecciona el archivo');
    const filas = await IE.leer(req.file.buffer), out = await IE.analizar(filas), archivo = nombreArchivo(req.file);
    // La vista previa (con datos personales) vive 30 minutos en la sesión del usuario de GH; se borra al aplicar o descartar
    req.session.importEmpleados = { filas, archivo, en: Date.now(), ok: !out.errs.length };
    pagina(req, res, { res: { ...out, archivo } });
  } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); res.redirect('/empleados/importar'); }
}));
r.post('/empleados/importar/aplicar', gh, hacer(async req => {
  const c = req.session.importEmpleados; if (!c || !c.ok || Date.now() - c.en > VISTA_PREVIA_MS) throw E(400, 'La vista previa expiró. Sube el Listado de nuevo');
  delete req.session.importEmpleados; await IE.aplicar(c.filas, req.user, c.archivo);
}, 'Listado importado', '/empleados'));
r.post('/empleados/importar/descartar', gh, hacer(async req => { delete req.session.importEmpleados; delete req.session.importEquiv; }, 'Importación descartada', '/empleados/importar'));
// Equivalencias: se descargan (con lo que falta del último Listado subido) y se suben como cualquier carga masiva
r.get('/empleados/equivalencias.xlsx', gh, w(async (req, res) => {
  const c = req.session.importEmpleados;
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.set('Content-Disposition', 'attachment; filename="equivalencias-' + await ES.hoy() + '.xlsx"');
  res.send(Buffer.from(await IE.plantillaEquivalencias(c && Date.now() - c.en < VISTA_PREVIA_MS ? c.filas : null)));
}));
r.post('/empleados/equivalencias', gh, subidaXlsx('/empleados/importar'), w(async (req, res) => {
  try {
    if (!req.file) throw E(400, 'Selecciona el archivo');
    const filas = await IE.leerEquivalencias(req.file.buffer), out = await IE.analizarEquivalencias(filas);
    req.session.importEquiv = out.errs.length ? null : { filas, en: Date.now() };
    pagina(req, res, { eq: { ...out, archivo: nombreArchivo(req.file) } });
  } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); res.redirect('/empleados/importar'); }
}));
r.post('/empleados/equivalencias/aplicar', gh, hacer(async req => {
  const c = req.session.importEquiv; if (!c || Date.now() - c.en > VISTA_PREVIA_MS) throw E(400, 'La vista previa expiró. Sube el archivo de nuevo');
  delete req.session.importEquiv; await IE.aplicarEquivalencias(c.filas, req.user);
}, 'Equivalencias guardadas. Vuelve a subir el Listado para revisarlo con ellas', '/empleados/importar'));

// ---- Plazas por regularizar (las crea la carga inicial) ----
r.get('/config/plantilla/conciliacion', gh, w(async (req, res) => res.render('conciliacion', { title: 'Conciliación de personas y plazas', nav: 'config', sub: 'conciliacion', c: await EM.conciliacion(req.user) })));
r.get('/config/plantilla/por-regularizar', gh, w(async (req, res) => res.render('por_regularizar', { title: 'Plazas por regularizar', nav: 'config', sub: 'porreg', zs: await PL.porRegularizar() })));
r.get('/config/plazas/:id(\\d+)/regularizar', gh, w(async (req, res) => {
  const z = (await PL.porRegularizar()).find(x => x.id === +req.params.id); if (!z) throw E(404, 'La plaza no está por regularizar');
  modal(req, res, 'plaza_regularizar', { title: 'Regularizar plaza', nav: 'config', sub: 'porreg', z });
}));
r.post('/config/plazas/regularizar-varias', gh, w(async (req, res) => {
  try {
    const x = await PL.regularizarVarias(req.user, req.body.ids, req.body.autorizado);
    flash(req, x.fallan.length ? 'err' : 'ok', (x.ok ? x.ok + ' plaza(s) regularizada(s).' : 'Ninguna plaza regularizada.') + (x.fallan.length ? ' No se pudo: ' + x.fallan.join(' · ') : ''));
  } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect('/config/plantilla/por-regularizar');
}));
r.post('/config/plazas/:id(\\d+)/regularizar', gh, hacer(async req => '/config/plantilla?modal=' + encodeURIComponent('/config/plantilla/puesto/' + await PL.regularizar(req.user, +req.params.id, req.body.autorizado)),
  'Plaza regularizada: ya cuenta en el HC autorizado', '/config/plantilla/por-regularizar'));

// ---- Organigrama de empleados de consulta ----
// GH y Presidencia ven todo. Un gerente o director con rol de empresa (sin unidad) ve las plazas de esa empresa;
// con rol de unidad, su unidad y las que dependen de ella. Solo nombre y cargo: ningún dato personal.
const ROLES_ORG = ['gerente', 'director'];
r.get('/organigrama', w(async (req, res) => {
  const u = req.user, roles = u.roles || [];
  const global = P.esGH(u) || roles.some(x => x.rol === 'presidencia' || (ROLES_ORG.includes(x.rol) && !x.unidad_id && !x.empresa_id));
  const empresasRol = global ? [] : [...new Set(roles.filter(x => ROLES_ORG.includes(x.rol) && !x.unidad_id && x.empresa_id).map(x => x.empresa_id))];
  const propias = global ? [] : [...new Set(roles.filter(x => ROLES_ORG.includes(x.rol) && x.unidad_id).map(x => x.unidad_id))];
  const g = await ES.grafo();
  // Con rol de empresa la estructura es libre y el filtro va por empresa; con rol de unidad, solo su rama
  const permitidas = global || empresasRol.length ? null : new Set(propias.flatMap(id => [...ES.descendientes(g.by, id)]));
  const opciones = (await ES.opciones()).filter(o => !permitidas || permitidas.has(o.id));
  let raiz = /^\d+$/.test(String(req.query.raiz || '')) ? +req.query.raiz : (permitidas ? propias[0] || '' : '');
  if (raiz && permitidas && !permitidas.has(raiz)) raiz = propias[0];
  const fecha = ES.fechaValida(req.query.fecha) ? req.query.fecha : '';
  const conAlcance = global || empresasRol.length || propias.length;
  const dg = conAlcance && (raiz || !permitidas) ? await PL.diagramaPuestos({ fecha, raiz: raiz || '', personas: true, mods: ['nomina'], tipos: [], empresas: empresasRol }) : null;
  res.render('organigrama', { title: 'Organigrama', nav: 'organigrama', dg, opciones, f: { raiz, fecha }, sinAlcance: !conAlcance });
}));

module.exports = r;
