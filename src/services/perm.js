const { q } = require('../db');
async function cargarUsuario(id) {
  const u = (await q('select id,nombre,email,activo from usuario where id=$1', [id])).rows[0];
  if (!u || !u.activo) return null;
  u.roles = (await q('select ur.rol, ur.empresa_id, ur.unidad_id, un.nombre unidad from usuario_rol ur left join unidad un on un.id=ur.unidad_id where ur.usuario_id=$1', [id])).rows;
  u.rolesTxt = [...new Set(u.roles.map(r => r.rol))].join(', ') || 'sin rol';
  return u;
}
const esGH = u => u.roles.some(r => r.rol === 'gh' || r.rol === 'superadmin');   // superadmin incluye todo lo de GH
const esSuper = u => u.roles.some(r => r.rol === 'superadmin');
// Rol con alcance de EMPRESA (sin unidad): empresa_id NULL = todas. Los roles por unidad se evalúan con unidadesDe().
const tiene = (u, rol, emp) => u.roles.some(r => r.rol === rol && !r.unidad_id && (r.empresa_id == null || r.empresa_id == emp));
// Unidades donde el usuario tiene ese rol (alcance por estructura)
const unidadesDe = (u, rol) => u.roles.filter(r => r.rol === rol && r.unidad_id).map(r => r.unidad_id);
// null = todas las empresas; si no, arreglo de ids (solo roles con alcance de empresa)
const empresasDe = (u, roles) => {
  if (esGH(u)) return null;
  const rs = u.roles.filter(r => roles.includes(r.rol) && !r.unidad_id);
  return rs.some(r => r.empresa_id == null) ? null : rs.map(r => r.empresa_id);
};
// r.aprob_uid y r.decidio vienen de la consulta de requisiciones
const puedeVer = (u, r) => esGH(u) || r.solicitante_id == u.id || !!r.decidio || tiene(u, 'director', r.empresa_id) || tiene(u, 'presidencia', r.empresa_id)
  || (!!r.aprob_uid && unidadesDe(u, 'director').includes(r.aprob_uid));
module.exports = { cargarUsuario, esGH, esSuper, tiene, unidadesDe, empresasDe, puedeVer };
