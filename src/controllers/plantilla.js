const r = require('express').Router(), PL = require('../services/plantilla'), PF = require('../services/perfiles'), ES = require('../services/estructura'), P = require('../services/perm'), { q } = require('../db'),
  { w, E, flash, modal, hacer, subidaXlsx, VISTA_PREVIA_MS, nombreArchivo } = require('../util');
// Plantilla de puestos: solo Gestión Humana (todo se valida aquí, en el servidor)
const gh = (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana'));
r.use(['/config/plantilla', '/config/plazas'], gh);
const aPuesto = id => '/config/plantilla?modal=' + encodeURIComponent('/config/plantilla/puesto/' + id);
const datosForm = async () => ({
  unidades: await ES.opciones(), empresas: (await q('select id, siglas, coalesce(razon_social,nombre) mostrar from empresa where activa order by 3')).rows,
  perfiles: await PF.paraFormulario(), puestos: await PL.opcionesPuestos(), MODALIDADES: PL.MODALIDADES });

r.get('/config/plantilla', w(async (req, res) => {
  const f = { buscar: req.query.buscar || '', unidad: req.query.unidad || '', empresa: req.query.empresa || '', modalidad: PL.MODALIDADES[req.query.modalidad] ? req.query.modalidad : '', fecha: ES.fechaValida(req.query.fecha) ? req.query.fecha : '' };
  const [L, d] = await Promise.all([PL.listar(f), datosForm()]);
  res.render('plantilla', { title: 'Plantilla de puestos', nav: 'config', sub: 'plantilla', f, L, ...d, esHoy: L.f === await ES.hoy() });
}));
r.get('/config/plantilla/puesto/nuevo', w(async (req, res) => {
  // «+ Cargo que le reporta»: si quien queda arriba es el jefe de esa misma unidad, basta la regla por defecto (sin excepción)
  const uid = +req.query.unidad || null, rep = +req.query.reporta || null;
  const jefe = rep ? (await q('select unidad_id, jefe from puesto where id=$1 and activo', [rep])).rows[0] : null;
  const reporta_a = jefe && !(jefe.jefe && jefe.unidad_id === uid) ? rep : null;
  modal(req, res, 'puesto_form', { title: 'Nuevo puesto', nav: 'config', sub: 'plantilla', v: { unidad_id: uid, reporta_a }, niveles: await PF.nivelesJ(), ...await datosForm() });
}));
r.post('/config/plantilla/puesto', w(async (req, res) => {
  try { const id = await PL.crearPuesto(req.user, req.body); flash(req, 'ok', 'Puesto creado'); res.redirect(aPuesto(id)); }
  catch (e) {
    if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message);
    res.redirect(e.puestoId ? '/config/plantilla?modal=' + encodeURIComponent('/config/plantilla/puesto/' + e.puestoId + '?agregar=1') : '/config/plantilla');
  }
}));
r.get('/config/plantilla/puesto/:id', w(async (req, res) => modal(req, res, 'puesto_detalle', { title: 'Puesto', nav: 'config', sub: 'plantilla', d: await PL.detalle(+req.params.id), agregar: req.query.agregar === '1', funcional: req.query.funcional === '1', ...await datosForm() })));
r.post('/config/plantilla/puesto/:id/editar', hacer(req => PL.editarPuesto(req.user, +req.params.id, req.body), 'Puesto actualizado', req => aPuesto(req.params.id)));
r.post('/config/plantilla/puesto/:id/plazas', hacer(async req => { const c = await PL.agregarPlazas(req.user, +req.params.id, req.body); return aPuesto(req.params.id); }, 'Plazas agregadas', req => aPuesto(req.params.id)));
r.post('/config/plantilla/puesto/:id/mover', w(async (req, res) => {
  try {
    const x = await PL.moverPuesto(req.user, +req.params.id, req.body.unidad_id, req.body.motivo);
    flash(req, 'ok', 'Puesto movido con sus plazas' + (x.excepcion ? '. Se quitó su excepción de reporte: ahora reporta al jefe de su unidad nueva' : '') + (x.fijadas ? '. ' + x.fijadas + ' plaza(s) «Por definir» tomaron la empresa de la unidad' : ''));
    res.redirect(aPuesto(req.params.id));
  } catch (e) {
    if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message);
    res.redirect(e.puestoId ? '/config/plantilla?modal=' + encodeURIComponent('/config/plantilla/puesto/' + e.puestoId + '?agregar=1') : aPuesto(req.params.id));
  }
}));
r.post('/config/plantilla/puesto/:id/funcional', hacer(req => PL.agregarFuncional(req.user, +req.params.id, req.body.funcional_de, req.body.motivo), 'Dependencia funcional agregada', req => aPuesto(req.params.id)));
r.post('/config/plantilla/funcional/:id/cerrar', hacer(async req => aPuesto(await PL.cerrarFuncional(req.user, +req.params.id, req.body.motivo)), 'Dependencia funcional cerrada con fecha de hoy', '/config/plantilla'));
r.post('/config/plantilla/puesto/:id/desactivar', hacer(req => PL.desactivarPuesto(req.user, +req.params.id), 'Puesto desactivado', req => aPuesto(req.params.id)));
r.post('/config/plazas/:id/congelar', hacer(async req => aPuesto(await PL.congelar(req.user, +req.params.id, req.body.on === '1', req.body.motivo)), 'Plaza actualizada', '/config/plantilla'));
r.post('/config/plazas/:id/empresa', hacer(async req => aPuesto(await PL.cambiarEmpresaPlaza(req.user, +req.params.id, req.body.empresa_id, req.body.motivo)), 'Empresa de la plaza actualizada', '/config/plantilla'));
r.post('/config/plazas/:id/cerrar', hacer(async req => aPuesto(await PL.cerrarPlaza(req.user, +req.params.id, req.body.motivo)), 'Plaza cerrada con fecha de hoy', '/config/plantilla'));
// Carga masiva
r.get('/config/plantilla/plantilla.xlsx', w(async (req, res) => {
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.set('Content-Disposition', 'attachment; filename="plantilla-puestos-' + await ES.hoy() + '.xlsx"');
  res.send(Buffer.from(await PL.plantilla()));
}));
r.get('/config/plantilla/carga', (req, res) => res.render('plantilla_carga', { title: 'Carga masiva de plantilla', nav: 'config', sub: 'plantilla', res: null }));
r.post('/config/plantilla/carga', subidaXlsx('/config/plantilla/carga'), w(async (req, res) => {
  try {
    if (!req.file) throw E(400, 'Selecciona el archivo');
    const filas = await PL.leer(req.file.buffer), out = await PL.analizar(filas);
    req.session.cargaPlantilla = out.errs.length ? null : { filas, en: Date.now() };
    res.render('plantilla_carga', { title: 'Carga masiva de plantilla', nav: 'config', sub: 'plantilla', res: { ...out, archivo: nombreArchivo(req.file) } });
  } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); res.redirect('/config/plantilla/carga'); }
}));
r.post('/config/plantilla/carga/aplicar', hacer(async req => {
  const c = req.session.cargaPlantilla; if (!c || Date.now() - c.en > VISTA_PREVIA_MS) throw E(400, 'La vista previa expiró. Sube el archivo de nuevo');
  delete req.session.cargaPlantilla; await PL.aplicarCarga(c.filas, req.user);
}, 'Plantilla aplicada', '/config/plantilla'));
module.exports = r;
