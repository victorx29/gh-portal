// Menú de Configuración: [clave, ruta, título, icono, descripción, quién lo ve]
module.exports = [
  { sec: 'Organización', items: [
    ['estructura', '/config/estructura', 'Estructura organizativa', 'estructura', 'Unidades, dependencias sólidas y funcionales, y dónde se aprueba', 'gh'],
    ['empresas', '/config/empresas', 'Empresas y grupos', 'empresa', 'Razón social, siglas, RIF y ubicación de cada empresa', 'super']] },
  { sec: 'Personas y acceso', items: [
    ['usuarios', '/usuarios', 'Usuarios y roles', 'usuarios', 'Cuentas y roles por empresa o por unidad', 'gh']] },
  { sec: 'Procesos', items: [
    ['pipelines', '/config/pipelines', 'Pipelines', 'flujo', 'Columnas y validaciones de cada tablero, por empresa', 'gh'],
    ['cargos', '/perfiles', 'Gestión de cargos', 'cargo', 'Perfiles y cargos que usan las requisiciones', 'gh']] },
  { sec: 'Catálogos', items: [
    ['grados', '/config/maestros?m=grados', 'Grados de instrucción', 'grado', 'Opciones del formulario de requisición', 'super'],
    ['equipos', '/config/maestros?m=equipos', 'Equipos', 'equipo', 'Equipos que puede pedir el solicitante', 'super'],
    ['accesos', '/config/maestros?m=accesos', 'Accesos a sistemas', 'acceso', 'Sistemas a los que se solicita acceso', 'super'],
    ['tipos', '/config/maestros?m=tipos', 'Tipos de unidad', 'tipos', 'Presidencia, dirección, gerencia, coordinación…', 'super']] }
];
