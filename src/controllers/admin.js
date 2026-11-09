const r = require('express').Router(), bcrypt = require('bcryptjs'), P = require('../services/perm'), ES = require('../services/estructura'), { q, tx } = require('../db'), { w, E, flash, modal } = require('../util');
r.use('/usuarios', (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana')));
const ROLES = ['gerente', 'director', 'presidencia', 'gh', 'superadmin'];

r.get('/usuarios', w(async (req, res) => {
  const us = (await q(`select u.id,u.nombre,u.email,u.activo, coalesce(json_agg(json_build_object('id',ur.id,'rol',ur.rol,'empresa',coalesce(e.siglas,e.razon_social,e.nombre),'unidad',un.nombre,'aprueba',un.aprueba) order by ur.rol) filter (where ur.id is not null),'[]') roles
    from usuario u left join usuario_rol ur on ur.usuario_id=u.id left join empresa e on e.id=ur.empresa_id left join unidad un on un.id=ur.unidad_id group by u.id order by u.nombre`)).rows;
  res.render('usuarios', { title: 'Usuarios y roles', nav: 'config', sub: 'usuarios', us, isSuper: P.esSuper(req.user), ROLES: ROLES.filter(x => x !== 'superadmin' || P.esSuper(req.user)),
    empresas: (await q('select id,coalesce(razon_social,nombre) nombre,siglas from empresa where activa order by 2')).rows, unidades: await ES.opciones() });
}));
r.post('/usuarios', w(async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre || !email || String(password || '').length < 10) throw E(400, 'Nombre, correo y clave de al menos 10 caracteres');
  await q('insert into usuario(nombre,email,pass_hash) values($1,$2,$3)', [nombre.trim(), email.toLowerCase().trim(), await bcrypt.hash(password, 10)]);
  flash(req, 'ok', 'Usuario creado'); res.redirect('/usuarios');
}));
r.get('/usuarios/:id/rol', w(async (req, res) => {
  const u = (await q('select id,nombre,email from usuario where id=$1', [+req.params.id])).rows[0]; if (!u) throw E(404, 'Usuario no encontrado');
  modal(req, res, 'usuario_rol', { title: 'Asignar rol', nav: 'config', sub: 'usuarios', u, ROLES: ROLES.filter(x => x !== 'superadmin' || P.esSuper(req.user)),
    empresas: (await q('select id,coalesce(razon_social,nombre) nombre,siglas from empresa where activa order by 2')).rows, unidades: await ES.opciones() });
}));
// Alcance del rol: gerente y director por UNIDAD (recomendado) o por empresa (transición 0.4); presidencia por empresa; GH y superadmin, globales
r.post('/usuarios/:id/rol', w(async (req, res) => {
  const rol = req.body.rol; if (!ROLES.includes(rol)) throw E(400, 'Rol inválido');
  if (rol === 'superadmin' && !P.esSuper(req.user)) throw E(403, 'Solo un superadmin asigna ese rol');
  const global = ['gh', 'superadmin'].includes(rol), porUnidad = ['gerente', 'director'].includes(rol) && req.body.unidad_id;
  const uni = porUnidad ? +req.body.unidad_id : null, emp = global || porUnidad || !req.body.empresa_id ? null : +req.body.empresa_id;
  const ins = await q('insert into usuario_rol(usuario_id,rol,empresa_id,unidad_id) values($1,$2,$3,$4) on conflict do nothing', [+req.params.id, rol, emp, uni]);
  let msg = ins.rowCount ? 'Rol asignado' : 'Ese rol ya estaba asignado';
  if (ins.rowCount && rol === 'director' && uni && !(await q('select aprueba from unidad where id=$1', [uni])).rows[0].aprueba)
    msg += '. Ojo: esa unidad no está marcada como «aprueba»; márcala en Estructura para que sus requisiciones lleguen a este director';
  flash(req, 'ok', msg); res.redirect('/usuarios');
}));
r.post('/usuarios/rol/:rid/borrar', w(async (req, res) => { await q('delete from usuario_rol where id=$1', [+req.params.rid]); flash(req, 'ok', 'Rol retirado'); res.redirect('/usuarios'); }));
r.post('/usuarios/:id/activo', w(async (req, res) => {
  if (+req.params.id === req.user.id) throw E(400, 'No puedes desactivarte a ti mismo');
  await q('update usuario set activo = not activo where id=$1', [+req.params.id]); res.redirect('/usuarios');
}));

// Eliminar (solo superadmin): se borra si no tiene actividad; si la tiene, se anonimiza y el historial se conserva
r.get('/usuarios/:id/eliminar', w(async (req, res) => {
  if (!P.esSuper(req.user)) throw E(403, 'Solo el superadmin elimina usuarios');
  const u = (await q('select id,nombre,email from usuario where id=$1', [+req.params.id])).rows[0]; if (!u) throw E(404, 'Usuario no encontrado');
  modal(req, res, 'usuario_eliminar', { title: 'Eliminar usuario', u, nav: 'config', sub: 'usuarios' });
}));
r.post('/usuarios/:id/eliminar', w(async (req, res) => {
  if (!P.esSuper(req.user)) throw E(403, 'Solo el superadmin elimina usuarios');
  const id = +req.params.id; if (id === req.user.id) throw E(400, 'No puedes eliminarte a ti mismo');
  const esS = (await q("select 1 from usuario_rol where usuario_id=$1 and rol='superadmin'", [id])).rowCount;
  if (esS && +(await q("select count(*) n from usuario_rol ur join usuario u on u.id=ur.usuario_id where ur.rol='superadmin' and u.activo")).rows[0].n <= 1) throw E(400, 'No puedes eliminar al último superadmin');
  const out = await tx(async c => {
    await c.query('savepoint s1');
    try { await c.query('delete from usuario where id=$1', [id]); return 'eliminado'; }
    catch (e) {
      if (e.code !== '23503') throw e;   // tiene actividad: se conserva el historial
      await c.query('rollback to savepoint s1');
      await c.query("update usuario set nombre='Usuario eliminado #'||id, email='eliminado+'||id||'@invalid.local', pass_hash='!', activo=false where id=$1", [id]);
      await c.query('delete from usuario_rol where usuario_id=$1', [id]); return 'anonimizado';
    }
  });
  await q('insert into historial(usuario_id,entidad,entidad_id,accion,detalle) values($1,$2,$3,$4,$5)', [req.user.id, 'usuario', String(id), 'eliminar', { resultado: out }]);
  flash(req, 'ok', out === 'eliminado' ? 'Usuario eliminado' : 'El usuario tenía actividad: se anonimizó y se conservó el historial'); res.redirect('/usuarios');
}));
module.exports = r;
