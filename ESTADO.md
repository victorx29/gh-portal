# ESTADO.md — actualizar en cada entrega

Última revisión: 14-11-2026, contra el código `gh-portal` 0.7.11 (package.json 0.7.11, migraciones 001–012).

## Versión
- **Última entregada:** 0.7.11 (13-11-2026).
- **Desplegada en el entorno de desarrollo (EasyPanel):** (confirmar: ¿0.7.11 o anterior?)
- **Probada completa:** (confirmar hasta qué versión pasaron las pruebas críticas)
- **Producción:** no existe. Se crea con la 1.0.

## Hecho por versión
- **0.5:** estructura con vigencia, roles por unidad, aprobación por ascenso, carga masiva Excel, Configuración.
- **0.6 (incluye 0.5.1):** divisiones; razón social como nombre principal; dirección fiscal; Perfiles y Cargos
  (GH-PF-NNN, versiones GH-PF-NNN-VV, versión activa, alcance); carga masiva de cargos; eventos completos con
  `url` y `detalle`; variable PORTAL_URL. Migración 006.
- **0.6.1:** diagrama visual de la estructura (filtros, PDF e imagen); razón social en todo el portal.
- **0.6.2:** listas de unidades en escalera con buscador.
- **0.6.3:** diagrama: tipos a mostrar, disposición horizontal, pantalla completa.
- **0.6.4:** disposición «Cascada por columnas»; título según lo que se ve; impresión en una hoja.
- **0.7:** puestos y plazas (plantilla autorizada): HC, congeladas, proyectadas, modalidades, «Reporta a» con
  excepciones, carga masiva, diagrama «Ver: Cargos». Migración 007.
- **0.7.1:** perfiles con el formato de GH; importación de Word (.docx); descripción de cargo imprimible;
  control documental ISO simple. Migración 008. Corrige nombres de archivo con acentos.
- **0.7.2:** una plaza por requisición; reemplazo elige plaza; cargo nuevo crea la plaza al aprobar
  Presidencia; empresa «Por definir»; GH cambia la empresa con motivo. Migración 009.
- **0.7.3:** modalidades en el diagrama; perfiles «Sin descripción»; avisos flotantes; modal de confirmación.
- **0.7.4:** filtro de perfiles por alcance (área).
- **0.7.5:** «Nuevo puesto» filtra perfiles por la unidad elegida.
- **0.7.6:** mover un puesto a otra unidad sin cerrar sus plazas.
- **0.7.7:** una unidad solo se desactiva vacía; aprobación retenida si la unidad aprobadora está inactiva.
  Migración 010.
- **0.7.8:** niveles jerárquicos configurables; «Ver: Cargos» por filas de nivel. Migración 011.
- **0.7.9:** modo edición del diagrama (panel lateral, acciones rápidas, crear cargo mínimo); corrige el clic
  que abría otra área.
- **0.7.10:** desplazamiento del panel de edición.
- **0.7.11:** dependencia funcional (línea punteada) entre puestos; columna «Funcional de» en la carga
  masiva. Migración 012.

## Pendiente para la siguiente entrega
- Propuesto en 0.7.9 y sin clasificar: arrastrar y soltar cajas en el diagrama, con «Deshacer».
  (confirmar si es Nuevo para el plan o entra antes de la 0.8)

## Decisiones abiertas
- **Siglas o razón social en espacios cortos:** el código ya aplica razón social como nombre principal y
  siglas donde el espacio es corto (0.6, 0.6.1). Confirmar que es la decisión aprobada.
- **Administración de concesionarios:** el código las muestra con línea punteada hacia la Dirección de
  Contraloría (0.6.1). Confirmar con la Directora de GH: ¿línea sólida al Gerente General y punteada a
  Contraloría? Define quién aprueba.
- **Siglas «AM» del organigrama de Administración:** ¿existe esa empresa o es IM?
- **Nombre de la vista «Ver: Cargos»:** las notas de entrega la llaman «organigrama de cargos», pero
  «organigrama» se reserva para el de empleados (ISO). Definir el nombre.

## Pendientes técnicos fuera de entrega
- Pasar el repo gh-portal a privado; antes, revisar el historial completo en busca de claves y cambiar las
  que aparezcan. (La versión 0.7.11 no contiene claves; el historial no se revisó.)
- Configurar token o deploy key de GitHub en EasyPanel para el repo privado.
- README desactualizado: sitúa el SSO «antes de abrir el portal a todos los gerentes»; la decisión vigente es
  SSO dentro de la 1.0.
- Subir una copia del Listado de Activos sin valores sensibles (solo encabezados en esas columnas).
- Confirmar con la Directora de GH que autoriza usar el Listado de Activos con Claude.
- Antes de producción: backups programados de PostgreSQL y prueba de restauración.

## Plan
- Diagnóstico de código (revision-codigo-gh, modo diagnóstico): antes de empezar la 0.8.
- 0.9.x Estabilización: sin funciones nuevas; hallazgos «Ahora» pendientes y pruebas automáticas mínimas
  (aprobación por estructura, reserva de plazas, nada se borra, rechazo de usuarios no registrados).
- **0.8** Empleados: importar Listado de Activos (equivalencias departamento → unidad, supervisor inmediato,
  ocupadas y vacantes por plaza); enlace usuario ↔ ficha de empleado; organigrama de empleados (ISO) por
  división, empresa y unidad.
- **0.9** Postulados con IA (análisis de CV con la rúbrica del perfil).
- **1.0** Notificaciones, plantillas y SSO Microsoft 365 (enlace por `oid`, sin alta automática, rechazo de
  cuentas no registradas) = salida a producción.
- **Después:** instalación ARO.

## Datos conocidos del Excel de empleados
364 personas; sin cédulas duplicadas; supervisores: 56 de 63 vinculables; 71 cargos usados sin ficha en
«Cargos»; los 3 registros «APB/ARO GROUP» (presidentes/socios) se excluyen.