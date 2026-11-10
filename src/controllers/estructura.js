const r = require('express').Router(), ES = require('../services/estructura'), PL = require('../services/plantilla'), IM = require('../services/importar'), P = require('../services/perm'), { q, tx } = require('../db'), { w, E, flash, modal, hacer, subidaXlsx, VISTA_PREVIA_MS } = require('../util');
const gh = (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana'));
const sup = (req, res, next) => P.esSuper(req.user) ? next() : next(E(403, 'Solo el superadmin'));
const ESTADOS = ['Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda',
  'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia'];
// Ejecuta la acción, deja el mensaje y vuelve a donde corresponde (errores de negocio = aviso, no página de error)
const aUnidad = id => '/config/estructura?modal=' + encodeURIComponent('/config/estructura/' + id);

// ---- Inicio de Configuración ----
r.get('/config', gh, (req, res) => res.render('config_inicio', { title: 'Configuración', nav: 'config', sub: '' }));

// ---- Estructura organizativa (GH) ----
r.get('/config/estructura', gh, w(async (req, res) => {
  const f = { fecha: ES.fechaValida(req.query.fecha) ? req.query.fecha : '', empresa: req.query.empresa || '', grupo: req.query.grupo || '', buscar: req.query.buscar || '', division: req.query.division || '' };
  const [a, empresas, grupos, divisiones, hc, pendientes] = await Promise.all([ES.arbol(f), ES.empresas(), ES.grupos(), ES.divisiones(), PL.resumenUnidades(f.fecha, f.empresa ? [f.empresa] : null),
    q("select count(*)::int n from requisicion where estado='pend_director' and unidad_id is not null and unidad_aprobadora(unidad_id) is not null and unidad_aprobadora(unidad_id) not in (select ur.unidad_id from usuario_rol ur join usuario us on us.id=ur.usuario_id where ur.rol='director' and ur.unidad_id is not null and us.activo)").then(x => x.rows[0].n)]);
  res.render('estructura', { title: 'Estructura organizativa', nav: 'config', sub: 'estructura', a, f, empresas, grupos, divisiones, hc, pendientes });
}));
const datosModal = async () => ({ tipos: await ES.tipos(), grupos: await ES.grupos(), empresas: await ES.empresas(), opciones: await ES.opciones() });
r.get('/config/estructura/diagrama', gh, w(async (req, res) => {
  const f = { fecha: ES.fechaValida(req.query.fecha) ? req.query.fecha : '', raiz: req.query.raiz || '', division: req.query.division || '',
    empresas: [].concat(req.query.empresas || []).map(Number).filter(Boolean), punteadas: req.query.punteadas !== '0',
    tipos: [].concat(req.query.tipos || []).map(Number).filter(Boolean), disp: ['c', 'k'].includes(req.query.disp) ? req.query.disp : 'h', ver: req.query.ver === 'puestos' ? 'puestos' : 'unidades' };
  // El HC respeta el filtro de empresas (y las empresas de la división elegida): se cuenta por la empresa de cada plaza
  const empHC = f.empresas.concat(f.division ? (await q('select id from empresa where division_id=$1 union select empresa_id from empresa_division_servicio where division_id=$1', [+f.division])).rows.map(x => x.id) : []);
  const extra = f.ver === 'unidades' ? await PL.unidadesConPlazas(empHC, f.fecha) : null;
  const [dg, empresas, divisiones, opciones, tipos] = await Promise.all([f.ver === 'puestos' ? PL.diagramaPuestos(f) : ES.diagrama({ ...f, extra }), ES.empresas(), ES.divisiones(), ES.opciones(), ES.tipos()]);
  if (f.ver === 'unidades') { const hc = await PL.resumenUnidades(f.fecha, empHC); dg.nodes.forEach(n => { const k = hc.get(n.id); if (k && k.txt) n.hcTxt = k.txt; }); }
  res.render('estructura_diagrama', { title: 'Diagrama de estructura', nav: 'config', sub: 'estructura', dg, f, empresas, divisiones, opciones, tipos });
}));
r.get('/config/estructura/nueva', gh, w(async (req, res) => modal(req, res, 'unidad_form', { title: 'Nueva unidad', nav: 'config', sub: 'estructura', v: { padre_id: +req.query.padre || null }, ...await datosModal() })));
r.post('/config/estructura', gh, hacer(async req => aUnidad(await ES.crear(req.user, req.body)), 'Unidad creada', '/config/estructura'));
r.get('/config/estructura/plantilla.xlsx', gh, w(async (req, res) => {
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', 'attachment; filename="estructura-gh-' + await ES.hoy() + '.xlsx"'); res.send(Buffer.from(await IM.plantilla()));
}));
r.get('/config/estructura/importar', gh, (req, res) => res.render('importar', { title: 'Carga masiva', nav: 'config', sub: 'estructura', res: null }));
r.post('/config/estructura/importar', gh, subidaXlsx('/config/estructura/importar'), w(async (req, res) => {
  try {
    if (!req.file) throw E(400, 'Selecciona el archivo');
    const data = await IM.leer(req.file.buffer), out = await IM.analizar(data);
    req.session.carga = out.errs.length ? null : { data, archivo: req.file.originalname, en: Date.now() };
    res.render('importar', { title: 'Carga masiva', nav: 'config', sub: 'estructura', res: { ...out, archivo: req.file.originalname } });
  } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); res.redirect('/config/estructura/importar'); }
}));
r.post('/config/estructura/importar/aplicar', gh, hacer(async req => {
  const c = req.session.carga; if (!c || Date.now() - c.en > VISTA_PREVIA_MS) throw E(400, 'La vista previa expiró. Sube el archivo de nuevo');
  delete req.session.carga; await IM.aplicar(c.data, req.user);
}, 'Carga aplicada. Los cambios de dependencia quedaron con fecha de hoy', '/config/estructura'));
r.get('/config/estructura/:id', gh, w(async (req, res) => modal(req, res, 'unidad_detalle', { title: 'Unidad', nav: 'config', sub: 'estructura', d: await ES.detalle(+req.params.id), hc: (await PL.resumenUnidades()).get(+req.params.id) || null, ...await datosModal() })));
r.post('/config/estructura/:id/editar', gh, hacer(req => ES.editar(req.user, +req.params.id, req.body), 'Unidad actualizada', req => aUnidad(req.params.id)));
r.post('/config/estructura/:id/activa', gh, hacer(req => ES.activar(req.user, +req.params.id), 'Estado actualizado', req => aUnidad(req.params.id)));
r.post('/config/estructura/:id/dependencia', gh, hacer(async req => {
  if (!String(req.body.motivo || '').trim()) throw E(400, 'Indica el motivo del cambio: queda en el historial');
  if (!(await ES.cambiarPadre(req.user, +req.params.id, req.body.padre_id ? +req.body.padre_id : null, req.body.motivo))) throw E(400, 'Esa ya es la dependencia vigente');
}, 'Dependencia actualizada: la anterior quedó cerrada con fecha de hoy', req => aUnidad(req.params.id)));
r.post('/config/estructura/:id/funcional', gh, hacer(req => ES.agregarFuncional(req.user, +req.params.id, +req.body.padre_id, req.body.motivo), 'Dependencia funcional agregada', req => aUnidad(req.params.id)));
r.post('/config/estructura/:id/sirve', gh, hacer(req => ES.sirveA(req.user, +req.params.id, req.body.empresas), 'Empresas atendidas actualizadas', req => aUnidad(req.params.id)));
r.post('/config/relaciones/:rid/cerrar', gh, hacer(async req => aUnidad(await ES.cerrarRelacion(req.user, +req.params.rid)), 'Dependencia cerrada con fecha de hoy', '/config/estructura'));

// ---- Empresas y grupos (superadmin) ----
r.get('/empresas', (req, res) => res.redirect('/config/empresas'));
r.get('/config/empresas', sup, w(async (req, res) => {
  const [es, gs, divs, n] = await Promise.all([ES.empresas(), ES.grupos(), ES.divisiones(), q('select empresa_id, count(*)::int n from unidad where empresa_id is not null group by empresa_id').then(x => x.rows)]);
  es.forEach(e => { e.unidades = (n.find(x => x.empresa_id === e.id) || {}).n || 0; });
  res.render('empresas', { title: 'Empresas', nav: 'config', sub: 'empresas', es, gs });
}));
r.get('/config/empresas/nueva', sup, w(async (req, res) => modal(req, res, 'empresa_form', { title: 'Nueva empresa', nav: 'config', sub: 'empresas', v: { sirve_divisiones: [] }, gs: await ES.grupos(), divs: await ES.divisiones(), ESTADOS })));
r.get('/config/empresas/:id', sup, w(async (req, res) => {
  const v = (await ES.empresas()).find(e => e.id === +req.params.id); if (!v) throw E(404, 'Empresa no encontrada');
  modal(req, res, 'empresa_form', { title: v.mostrar, nav: 'config', sub: 'empresas', v, gs: await ES.grupos(), divs: await ES.divisiones(), ESTADOS });
}));
const RIF = /^([VJGEPC])-?(\d{8})-?(\d)$/i;
function datosEmpresa(b) {
  const t = s => String(s || '').trim() || null, nombre = t(b.nombre); if (!nombre) throw E(400, 'El nombre es obligatorio'); if (!b.grupo_id) throw E(400, 'Selecciona el grupo');
  let rif = t(b.rif); if (rif) { const m = RIF.exec(rif.replace(/\s/g, '')); if (!m) throw E(400, 'RIF inválido: usa el formato J-12345678-9'); rif = `${m[1].toUpperCase()}-${m[2]}-${m[3]}`; }
  return [nombre, t(b.razon_social), t(b.siglas) && t(b.siglas).toUpperCase(), rif, t(b.estado), t(b.ciudad), +b.grupo_id, t(b.direccion_fiscal), b.division_id ? +b.division_id : null];
}
// Empresa de servicios (p. ej. transporte) que atiende a otras divisiones además de la suya
const sirveDiv = async (c, id, v) => { await c.query('delete from empresa_division_servicio where empresa_id=$1', [id]); for (const d of [...new Set([].concat(v || []).map(Number).filter(Boolean))]) await c.query('insert into empresa_division_servicio values($1,$2)', [id, d]); };
const dup = e => { if (e.code === '23505') return E(400, /rif/.test(e.constraint) ? 'Ese RIF ya está registrado' : /siglas/.test(e.constraint) ? 'Esas siglas ya las usa otra empresa' : 'Ya existe una empresa con ese nombre'); return e; };
r.post('/config/empresas', sup, hacer(async req => {
  try { await tx(async c => { const id = (await c.query('insert into empresa(nombre,razon_social,siglas,rif,estado,ciudad,grupo_id,direccion_fiscal,division_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id', datosEmpresa(req.body))).rows[0].id; await sirveDiv(c, id, req.body.sirve_divisiones); }); } catch (e) { throw dup(e); }
}, 'Empresa creada', '/config/empresas'));
r.post('/config/empresas/:id/editar', sup, hacer(async req => {
  try { await tx(async c => { await c.query('update empresa set nombre=$2,razon_social=$3,siglas=$4,rif=$5,estado=$6,ciudad=$7,grupo_id=$8,direccion_fiscal=$9,division_id=$10 where id=$1', [+req.params.id, ...datosEmpresa(req.body)]); await sirveDiv(c, +req.params.id, req.body.sirve_divisiones); }); } catch (e) { throw dup(e); }
}, 'Empresa actualizada', '/config/empresas'));
r.post('/config/empresas/:id/activa', sup, hacer(req => q('update empresa set activa = not activa where id=$1', [+req.params.id]), 'Estado actualizado', '/config/empresas'));
r.post('/config/grupos', sup, hacer(async req => {
  const n = String(req.body.nombre || '').trim(); if (!n) throw E(400, 'El nombre del grupo es obligatorio');
  try { await q('insert into grupo(nombre,siglas) values($1,$2)', [n, String(req.body.siglas || '').trim().toUpperCase() || null]); } catch (e) { if (e.code === '23505') throw E(400, 'Ese grupo ya existe'); throw e; }
}, 'Grupo creado', '/config/empresas'));
r.post('/config/grupos/:id/editar', sup, hacer(async req => {
  const n = String(req.body.nombre || '').trim(); if (!n) throw E(400, 'El nombre del grupo es obligatorio');
  try { await q('update grupo set nombre=$2, siglas=$3 where id=$1', [+req.params.id, n, String(req.body.siglas || '').trim().toUpperCase() || null]); } catch (e) { if (e.code === '23505') throw E(400, 'Ese grupo ya existe'); throw e; }
}, 'Grupo actualizado', '/config/empresas'));
module.exports = r;
