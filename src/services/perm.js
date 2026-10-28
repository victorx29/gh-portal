const { q } = require('../db');
async function cargarUsuario(id) {
  const u = (await q('select id,nombre,email,activo from usuario where id=$1', [id])).rows[0];
  if (!u || !u.activo) return null;
  u.roles = (await q('select rol,empresa_id from usuario_rol where usuario_id=$1', [id])).rows;
  u.rolesTxt = [...new Set(u.roles.map(r => r.rol))].join(', ') || 'sin rol';
  return u;
}
const esGH = u => u.roles.some(r => r.rol === 'gh');
// rol vigente para esa empresa (empresa_id NULL en el rol = todas las empresas)
const tiene = (u, rol, emp) => u.roles.some(r => r.rol === rol && (r.empresa_id == null || r.empresa_id == emp));
// null = todas las empresas; si no, arreglo de ids
const empresasDe = (u, roles) => {
  if (esGH(u)) return null;
  const rs = u.roles.filter(r => roles.includes(r.rol));
  return rs.some(r => r.empresa_id == null) ? null : rs.map(r => r.empresa_id);
};
const puedeVer = (u, r) => esGH(u) || r.solicitante_id == u.id || tiene(u, 'director', r.empresa_id) || tiene(u, 'presidencia', r.empresa_id);
module.exports = { cargarUsuario, esGH, tiene, empresasDe, puedeVer };
