const r = require('express').Router(), bcrypt = require('bcryptjs'), P = require('../services/perm'), { q, tx } = require('../db'), { w, E, flash } = require('../util');
r.use(['/usuarios', '/perfiles'], (req, res, next) => P.esGH(req.user) ? next() : next(E(403, 'Solo Gestión Humana')));
const ROLES = ['gerente', 'director', 'presidencia', 'gh'];

r.get('/usuarios', w(async (req, res) => {
  const us = (await q(`select u.id,u.nombre,u.email,u.activo, coalesce(json_agg(json_build_object('id',ur.id,'rol',ur.rol,'empresa',e.nombre)) filter (where ur.id is not null),'[]') roles
    from usuario u left join usuario_rol ur on ur.usuario_id=u.id left join empresa e on e.id=ur.empresa_id group by u.id order by u.nombre`)).rows;
  res.render('usuarios', { title: 'Usuarios', nav: 'usuarios', us, ROLES, empresas: (await q('select id,nombre from empresa order by nombre')).rows });
}));
r.post('/usuarios', w(async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre || !email || String(password || '').length < 10) throw E(400, 'Nombre, correo y clave de al menos 10 caracteres');
  await q('insert into usuario(nombre,email,pass_hash) values($1,$2,$3)', [nombre.trim(), email.toLowerCase().trim(), await bcrypt.hash(password, 10)]);
  flash(req, 'ok', 'Usuario creado'); res.redirect('/usuarios');
}));
r.post('/usuarios/:id/rol', w(async (req, res) => {
  if (!ROLES.includes(req.body.rol)) throw E(400, 'Rol inválido');
  const emp = req.body.rol === 'gh' || !req.body.empresa_id ? null : +req.body.empresa_id;   // GH siempre global
  await q('insert into usuario_rol(usuario_id,rol,empresa_id) values($1,$2,$3) on conflict do nothing', [+req.params.id, req.body.rol, emp]);
  flash(req, 'ok', 'Rol asignado'); res.redirect('/usuarios');
}));
r.post('/usuarios/rol/:rid/borrar', w(async (req, res) => { await q('delete from usuario_rol where id=$1', [+req.params.rid]); flash(req, 'ok', 'Rol retirado'); res.redirect('/usuarios'); }));
r.post('/usuarios/:id/activo', w(async (req, res) => {
  if (+req.params.id === req.user.id) throw E(400, 'No puedes desactivarte a ti mismo');
  await q('update usuario set activo = not activo where id=$1', [+req.params.id]); res.redirect('/usuarios');
}));

r.get('/perfiles', w(async (req, res) => {
  const ps = (await q(`select p.*, e.nombre empresa, (select max(version) from perfil_version where perfil_id=p.id) version from perfil p left join empresa e on e.id=p.empresa_id order by p.nombre`)).rows;
  res.render('perfiles', { title: 'Perfiles', nav: 'perfiles', ps, empresas: (await q('select id,nombre from empresa order by nombre')).rows });
}));
// Mismo código = nueva versión (las versiones son inmutables)
r.post('/perfiles', w(async (req, res) => {
  const b = req.body; if (!b.codigo || !b.nombre) throw E(400, 'Código y nombre son obligatorios');
  const contenido = { objetivo: b.objetivo || '', requisitos: b.requisitos || '', criterios: String(b.criterios || '').split('\n').map(s => s.trim()).filter(Boolean) };
  await tx(async c => {
    let p = (await c.query('select id from perfil where codigo=$1', [b.codigo.trim()])).rows[0];
    if (!p) p = (await c.query('insert into perfil(codigo,nombre,empresa_id) values($1,$2,$3) returning id', [b.codigo.trim(), b.nombre.trim(), b.empresa_id || null])).rows[0];
    const v = (await c.query('select coalesce(max(version),0)+1 v from perfil_version where perfil_id=$1', [p.id])).rows[0].v;
    await c.query('insert into perfil_version(perfil_id,version,contenido,creado_por) values($1,$2,$3,$4)', [p.id, v, contenido, req.user.id]);
  });
  flash(req, 'ok', 'Perfil guardado'); res.redirect('/perfiles');
}));
module.exports = r;
