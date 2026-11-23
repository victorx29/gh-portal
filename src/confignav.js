// Menú de Configuración: [clave, ruta, título, icono, descripción, quién lo ve]
module.exports = [
  { sec: 'Organización', items: [
    ['estructura', '/config/estructura', 'Estructura organizativa', 'estructura', 'Unidades, dependencias sólidas y funcionales, y dónde se aprueba', 'gh'],
    ['plantilla', '/config/plantilla', 'Plantilla de puestos', 'plantilla', 'Puestos y plazas autorizadas, congeladas y proyectadas por unidad', 'gh'],
    ['porreg', '/config/plantilla/por-regularizar', 'Plazas por regularizar', 'alerta', 'Plazas creadas por la carga inicial del Listado que GH debe regularizar', 'gh'],
    ['conciliacion', '/config/plantilla/conciliacion', 'Conciliación', 'compartida', 'Personas en plazas por regularizar y las plazas vacantes que les corresponderían', 'gh'],
    ['empresas', '/config/empresas', 'Empresas', 'empresa', 'Razón social, siglas, RIF, dirección fiscal y división', 'super'],
    ['divisiones', '/config/maestros?m=divisiones', 'Divisiones', 'division', 'Automotriz, Agroindustrial… y a cuál pertenece cada empresa', 'super']] },
  { sec: 'Personas y acceso', items: [
    ['usuarios', '/usuarios', 'Usuarios y roles', 'usuarios', 'Cuentas y roles por empresa o por unidad', 'gh'],
    ['campos', '/config/campos', 'Campos personalizados', 'mas', 'Datos adicionales del candidato y del empleado que define GH', 'gh']] },
  { sec: 'Procesos', items: [
    ['pipelines', '/config/pipelines', 'Pipelines', 'flujo', 'Columnas y validaciones de cada tablero, por empresa', 'gh'],
    ['cargos', '/perfiles', 'Gestión de cargos', 'cargo', 'Perfiles y cargos que usan las requisiciones', 'gh'],
    ['ia', '/config/ia', 'Análisis de CV con IA', 'flujo', 'Pesos de la rúbrica con la que la IA compara el CV con el perfil', 'gh']] },
  { sec: 'Catálogos', items: [
    ['grados', '/config/maestros?m=grados', 'Grados de instrucción', 'grado', 'Opciones del formulario de requisición', 'super'],
    ['equipos', '/config/maestros?m=equipos', 'Equipos', 'equipo', 'Equipos que puede pedir el solicitante', 'super'],
    ['accesos', '/config/maestros?m=accesos', 'Accesos a sistemas', 'acceso', 'Sistemas a los que se solicita acceso', 'super'],
    ['tipos', '/config/maestros?m=tipos', 'Tipos de unidad', 'tipos', 'Presidencia, dirección, gerencia, coordinación…', 'super'],
    ['niveles', '/config/maestros?m=niveles', 'Niveles jerárquicos', 'estructura', 'Orden de los cargos en el organigrama (una fila por nivel)', 'super'],
    ['ubicaciones', '/config/maestros?m=ubicaciones', 'Ubicaciones', 'empresa', 'Sedes donde trabaja cada empleado (ficha del empleado)', 'super'],
    ['tiposemp', '/config/maestros?m=tiposemp', 'Tipos de empleado', 'usuarios', 'Fijo, contratado…; cuáles piden fecha de fin de contrato', 'super']] }
];
