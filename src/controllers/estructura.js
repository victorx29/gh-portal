const r = require('express').Router(), multer = require('multer'), path = require('path'), ES = require('../services/estructura'), IM = require('../services/importar'), P = require('../services/perm'), { q, tx } = require('../db'), { w, E, flash, modal } = require('../util');
const gh = (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana'));
const sup = (req, res, next) => P.esSuper(req.user) ? next() : next(E(403, 'Solo el superadmin'));
const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, f, cb) => path.extname(f.originalname).toLowerCase() === '.xlsx' ? cb(null, true) : cb(E(400, 'Sube la plantilla en formato .xlsx')) });
const ESTADOS = ['Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda',
  'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia'];
// Ejecuta la acción, deja el mensaje y vuelve a donde corresponde (errores de negocio = aviso, no página de error)
const hacer = (fn, ok, volver) => w(async (req, res) => {
  let dest = typeof volver === 'function' ? volver(req) : volver;
  try { const x = await fn(req); if (typeof x === 'string') dest = x; flash(req, 'ok', ok); } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); }
  res.redirect(dest);
});
const aUnidad = id => '/config/estructura?modal=' + encodeURIComponent('/config/estructura/' + id);

// ---- Inicio de Configuración ----
r.get('/config', gh, (req, res) => res.render('config_inicio', { title: 'Configuración', nav: 'config', sub: '' }));

// ---- Estructura organizativa (GH) ----
r.get('/config/estructura', gh, w(async (req, res) => {
  const f = { fecha: ES.fechaValida(req.query.fecha) ? req.query.fecha : '', empresa: req.query.empresa || '', grupo: req.query.grupo || '', buscar: req.query.buscar || '' };
  const [a, empresas, grupos, pendientes] = await Promise.all([ES.arbol(f), ES.empresas(), ES.grupos(),
    q("select count(*)::int n from requisicion where estado='pend_director' and unidad_id is not null and unidad_aprobadora(unidad_id) is not null and unidad_aprobadora(unidad_id) not in (select ur.unidad_id from usuario_rol ur join usuario us on us.id=ur.usuario_id where ur.rol='director' and ur.unidad_id is not null and us.activo)").then(x => x.rows[0].n)]);
  res.render('estructura', { title: 'Estructura organizativa', nav: 'config', sub: 'estructura', a, f, empresas, grupos, pendientes });
}));
const datosModal = async () => ({ tipos: await ES.tipos(), grupos: await ES.grupos(), empresas: await ES.empresas(), opciones: await ES.opciones() });
r.get('/config/estructura/nueva', gh, w(async (req, res) => modal(req, res, 'unidad_form', { title: 'Nueva unidad', nav: 'config', sub: 'estructura', v: { padre_id: +req.query.padre || null }, ...await datosModal() })));
r.post('/config/estructura', gh, hacer(async req => aUnidad(await ES.crear(req.user, req.body)), 'Unidad creada', '/config/estructura'));
r.get('/config/estructura/plantilla.xlsx', gh, w(async (req, res) => {
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', 'attachment; filename="estructura-gh-' + await ES.hoy() + '.xlsx"'); res.send(Buffer.from(await IM.plantilla()));
}));
r.get('/config/estructura/importar', gh, (req, res) => res.render('importar', { title: 'Carga masiva', nav: 'config', sub: 'estructura', res: null }));
r.post('/config/estructura/importar', gh, (req, res, next) => subida.single('archivo')(req, res, e => {
  if (e) { flash(req, 'err', e.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera 5 MB' : e.message); return res.redirect('/config/estructura/importar'); } next();
}), w(async (req, res) => {
  try {
    if (!req.file) throw E(400, 'Selecciona el archivo');
    const data = await IM.leer(req.file.buffer), out = await IM.analizar(data);
    req.session.carga = out.errs.length ? null : { data, archivo: req.file.originalname, en: Date.now() };
    res.render('importar', { title: 'Carga masiva', nav: 'config', sub: 'estructura', res: { ...out, archivo: req.file.originalname } });
  } catch (e) { if (!e.status || e.status >= 500) throw e; flash(req, 'err', e.message); res.redirect('/config/estructura/importar'); }
}));
r.post('/config/estructura/importar/aplicar', gh, hacer(async req => {
  const c = req.session.carga; if (!c || Date.now() - c.en > 30 * 60e3) throw E(400, 'La vista previa expiró. Sube el archivo de nuevo');
  delete req.session.carga; await IM.aplicar(c.data, req.user);
}, 'Carga aplicada. Los cambios de dependencia quedaron con fecha de hoy', '/config/estructura'));
r.get('/config/estructura/:id', gh, w(async (req, res) => modal(req, res, 'unidad_detalle', { title: 'Unidad', nav: 'config', sub: 'estructura', d: await ES.detalle(+req.params.id), ...await datosModal() })));
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
  const [es, gs, n] = await Promise.all([ES.empresas(), ES.grupos(), q('select empresa_id, count(*)::int n from unidad where empresa_id is not null group by empresa_id').then(x => x.rows)]);
  es.forEach(e => { e.unidades = (n.find(x => x.empresa_id === e.id) || {}).n || 0; });
  res.render('empresas', { title: 'Empresas y grupos', nav: 'config', sub: 'empresas', es, gs });
}));
r.get('/config/empresas/nueva', sup, w(async (req, res) => modal(req, res, 'empresa_form', { title: 'Nueva empresa', nav: 'config', sub: 'empresas', v: {}, gs: await ES.grupos(), ESTADOS })));
r.get('/config/empresas/:id', sup, w(async (req, res) => {
  const v = (await q('select * from empresa where id=$1', [+req.params.id])).rows[0]; if (!v) throw E(404, 'Empresa no encontrada');
  modal(req, res, 'empresa_form', { title: v.nombre, nav: 'config', sub: 'empresas', v, gs: await ES.grupos(), ESTADOS });
}));
const RIF = /^([VJGEPC])-?(\d{8})-?(\d)$/i;
function datosEmpresa(b) {
  const t = s => String(s || '').trim() || null, nombre = t(b.nombre); if (!nombre) throw E(400, 'El nombre es obligatorio'); if (!b.grupo_id) throw E(400, 'Selecciona el grupo');
  let rif = t(b.rif); if (rif) { const m = RIF.exec(rif.replace(/\s/g, '')); if (!m) throw E(400, 'RIF inválido: usa el formato J-12345678-9'); rif = `${m[1].toUpperCase()}-${m[2]}-${m[3]}`; }
  return [nombre, t(b.razon_social), t(b.siglas) && t(b.siglas).toUpperCase(), rif, t(b.estado), t(b.ciudad), +b.grupo_id];
}
const dup = e => { if (e.code === '23505') return E(400, /rif/.test(e.constraint) ? 'Ese RIF ya está registrado' : /siglas/.test(e.constraint) ? 'Esas siglas ya las usa otra empresa' : 'Ya existe una empresa con ese nombre'); return e; };
r.post('/config/empresas', sup, hacer(async req => {
  try { await q('insert into empresa(nombre,razon_social,siglas,rif,estado,ciudad,grupo_id) values($1,$2,$3,$4,$5,$6,$7)', datosEmpresa(req.body)); } catch (e) { throw dup(e); }
}, 'Empresa creada', '/config/empresas'));
r.post('/config/empresas/:id/editar', sup, hacer(async req => {
  try { await q('update empresa set nombre=$2,razon_social=$3,siglas=$4,rif=$5,estado=$6,ciudad=$7,grupo_id=$8 where id=$1', [+req.params.id, ...datosEmpresa(req.body)]); } catch (e) { throw dup(e); }
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
