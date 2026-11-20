# ESTADO.md — actualizar en cada entrega

Última revisión: 20-11-2026, contra el código `gh-portal` 0.9.0 (package.json 0.9.0, migraciones 001–015).

## Versión
- **Última entregada:** 0.9.0 (20-11-2026): incluye 0.8.1, 0.8.2 y 0.9 en una sola entrega.
- **Desplegada en el entorno de desarrollo (EasyPanel):** 0.7.11 según el respaldo del 19-11-2026 (migración 012);
  0.7.12 subida a GitHub (commit «Update 0.7.12»). (confirmar despliegue de 0.7.12 y 0.7.13)
- **Probada:** 0.7.11 y 0.7.12 por Claude en entorno aislado (PostgreSQL 16 real, navegador de escritorio y móvil):
  pruebas críticas de ambas versiones y humo. Falta la prueba en EasyPanel (despliegue real y eventos hacia n8n).
  Ver «Registro de ejecuciones» en PRUEBAS.md.
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
- **0.7.12:** las líneas punteadas ya no pasan por debajo de otras cajas; no se acepta una línea punteada hacia
  el jefe directo (tampoco cuando lo es por la regla del jefe de la unidad); el error de «Funcional de» muestra
  la referencia como se escribió. Sin migración.
- **0.7.13:** corrige la carga masiva de perfiles: subir sin cambios el Excel descargado ya no crea versiones nuevas
  (funciones con «;» dentro y saltos de línea de Windows). El Excel lista funciones, competencias y criterios uno por
  línea. Sin migración. **Cierra la 0.7:** a partir de aquí solo fallos.
- **0.8.0:** ingreso ligado a la plaza (GH confirma la fecha real; «no se presentó»; movimiento interno; la plaza
  muestra su ocupante); candidatos únicos por cédula; plaza «por regularizar» bloquea reemplazo e ingreso;
  GH ya no puede modificar a un superadmin y los cambios de usuarios quedan en el historial; el nombre del grupo
  en la descripción de cargo sale de la base; script de limpieza de datos de prueba (`npm run limpiar`).
  Migración 013.
- **0.9.0 (entrega única de 0.8.1 + 0.8.2 + 0.9):**
  - 0.8.1 Base de empleados (solo GH): importación del Listado de Activos con todas sus columnas, equivalencias
    departamento → unidad y cargo → perfil (Excel), supervisor inmediato, plazas «por regularizar» (no cuentan en el HC)
    y su regularización con soporte, egreso con tipo y fecha real, ficha con registro de consultas. Migración 014.
  - 0.8.2 Organigrama de empleados (ISO): nombres y vacantes sobre el diagrama de cargos, bloque de control
    (elaborado, revisado, aprobado) y `/organigrama` de consulta para todos en su alcance (solo nombre y cargo).
  - 0.9 Postulados con IA: consentimiento, CV (PDF, Word o texto), análisis en n8n con rúbrica configurable
    (puntaje 0–5 por criterio, resumen, brechas, preguntas y alertas; puntaje orientativo 0–100), API protegida
    para n8n, flujo importable `n8n/gh-analisis-cv.json`. La IA no decide. Migración 015.

## Carga de datos de prueba (19-11-2026)
- Archivos en `C:\Automatizaciones\carga-organigramas` (fuera del repo), generados de los organigramas 2026 (GH 2025):
  1 unidad nueva (UO-0061, Gerencia de Ventas de IM), 50 perfiles mínimos y la plantilla (214 plazas, 9 vacantes).
  Probados en una copia de la base de EasyPanel. Son para validar el sistema con GH: la plantilla 2027 cambiará.
- Fuera de esta carga: Silos de Portuguesa, Corpomax y F21 (sin organigrama ni unidades).

## Pendiente para la siguiente entrega
- Propuesto en 0.7.9 y sin clasificar: arrastrar y soltar cajas en el diagrama, con «Deshacer».
  Recomendación del asesor: dejarlo para después de la 1.0 (solo visual). (confirmar)

## Después de desplegar la 0.9.0
- Seguir UPDATE_0.9.0.md: respaldo, variables nuevas, flujo de n8n, equivalencias revisadas por GH y luego la importación.
- Con mi borrador de equivalencias, en una copia de la base: 252 personas importadas, 66 plazas «por regularizar»
  (44 con perfil «Sin descripción»), 106 pendientes (98 por estructura: Silos, Occidente, Corpomax, Llano, Transauto;
  8 por equivalencia: INCES, UCLA, Logística de MDV), 4 excluidos.
- Validación sugerida antes de aplicar: la Dirección de Tecnología da en la copia «HC 11 · Ocupadas 10 · Vacantes 3» y
  2 personas en plazas «por regularizar»; el organigrama oficial (10-2026) dice HC 11, 11 ocupados y 0 vacantes. La
  diferencia sale de las equivalencias de cargo («Analista de Software» y analistas de desarrollo y calidad). (confirmar)

## Después de desplegar la 0.8.0
- Limpiar los datos de prueba en EasyPanel con `npm run limpiar -- transacciones` y `npm run limpiar -- perfil GH-PF-001`
  (ver UPDATE_0.8.0.md). Antes, respaldo de la base.

## Supuestos de la 0.9.0 (validar con GH)
- Regularizar = perfil con descripción + texto de quién autorizó y con qué soporte; no pasa por el flujo de aprobación.
- Tipos de egreso (renuncia, despido justificado o injustificado, fin de contrato, mutuo acuerdo, jubilación, otro):
  validar con legal (LOTTT). El tipo y el motivo no viajan a n8n.
- Rúbrica de IA global (no por perfil). Consentimiento del postulado registrado por GH (cómo lo autorizó); la retención
  y el borrado de CV de no seleccionados quedan por definir.
- Vista previa de la importación con datos personales en la sesión de GH hasta 30 minutos (se borra al aplicar,
  descartar o vencer).
- Perfiles mínimos creados por la importación para cargos sin ficha (13 con el borrador): quedan «Sin descripción».
- Las tarjetas de Selección se ordenan por el puntaje de la IA (orientativo). (confirmar)

## Requisitos de la 0.8.1 (importación del Listado) — cumplidos en la 0.9.0
- Diagnóstico de código: hecho el 19-11-2026 (hallazgos «Después» en «Pendientes técnicos»).
- Repo gh-portal en privado: el historial se revisó el 19-11-2026 y no tiene claves ni datos personales (solo el
  correo del autor de los commits); se puede pasar a privado sin reescribirlo.
- Autorización de la Directora de GH para usar el Listado de Activos; copia sin valores sensibles.
- GH prepara la tabla de equivalencias departamento → unidad y decide qué hacer con los 71 cargos sin ficha y
  los 7 supervisores no vinculables.
- **Decidido (18-11-2026):** empleado del Listado cuyo puesto no existe en la plantilla → se crea la plaza
  «por regularizar» (origen «carga inicial»), que no cuenta en el HC autorizado. GH la regulariza (perfil con
  sus datos y plaza autorizada; si es cargo nuevo, pasa por aprobación). Mientras no esté regularizada, no se
  puede pedir su reemplazo ni confirmar un ingreso en ella. Se rechaza la fila si la unidad o la empresa no se
  reconocen. Solo aplica a la carga inicial: después, todo ingreso entra por requisición.

## Decisiones de alcance de la 0.8 (19-11-2026)
- Se importan solo los empleados de empresas con estructura cargada. Silos de Portuguesa, Corpomax y F21 quedan en un
  informe «pendientes por estructura» hasta que GH entregue sus organigramas.
- La ficha del empleado guarda **todos** los datos del Listado de Activos: será la base de empleados de la empresa.
  Los datos personales (cédula, nacimiento, hijos y similares) solo los ve GH.
- La ficha completa es solo de GH; gerentes y directores ven nombre y cargo de quien ocupa cada plaza en el organigrama.
- Organigrama de empleados (ISO) sobre el diagrama de cargos: nombre del ocupante en cada plaza y «vacante» donde no hay
  nadie; filtros por división, empresa y unidad; imprimible con bloque de control (elaborado, revisado, aprobado).

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
- Consultas en paralelo sobre la misma transacción (aviso de pg en el log; dejará de funcionar con pg 9):
  `requisiciones.js` (detalleEvento), `perfiles.js` (carga masiva), `plantilla.js` (carga masiva). Para la
  versión de estabilización; no actualizar pg a la 9 antes. (El código nuevo de la 0.9.0 ya no lo hace.)
- 0.9.0, para después: no hay forma de reubicar a un empleado importado en otra plaza (corregir una equivalencia
  después de aplicar no lo mueve) ni de anular un egreso registrado por error; el registro de consultas de fichas
  no tiene disparador contra borrado; la API de n8n no limita intentos por minuto; índice en
  `relacion_laboral.supervisor_id` cuando crezca la base.
- Una excepción «Reporta a» puesta después de una línea punteada hacia ese mismo puesto deja las dos líneas
  (redundante, no rompe nada). Para la versión de estabilización.
- Diagnóstico 19-11-2026, para la versión de estabilización: el resultado de cada etapa de selección se
  sobrescribe sin historial; los eventos de selección envían a n8n todos los datos del candidato (cédula,
  teléfono); el envío a n8n mantiene la transacción abierta y un aviso que falla 10 veces se pierde sin alerta;
  `multer` 1.x → 2.x; Dockerfile con `npm ci`; ayudante `hacer` y normalizaciones duplicados.
- Pasar el repo gh-portal a privado (historial revisado: sin claves).
- Configurar token o deploy key de GitHub en EasyPanel para el repo privado.
- README desactualizado: sitúa el SSO «antes de abrir el portal a todos los gerentes»; la decisión vigente es
  SSO dentro de la 1.0.
- Subir una copia del Listado de Activos sin valores sensibles (solo encabezados en esas columnas).
- Confirmar con la Directora de GH que autoriza usar el Listado de Activos con Claude.
- Antes de producción: backups programados de PostgreSQL y prueba de restauración.

## Plan
- 0.9.x Estabilización: sin funciones nuevas; hallazgos «Ahora» pendientes y pruebas automáticas mínimas
  (aprobación por estructura, reserva de plazas, nada se borra, rechazo de usuarios no registrados).
- **0.8 y 0.9: entregadas en la 0.9.0.** Pendiente de la 0.8.2: enlace usuario ↔ ficha de empleado (no entró).
- **0.9.1** Correcciones de GH sobre la 0.9.0 (equivalencias, pantallas, supuestos).
- **1.0** Notificaciones, plantillas y SSO Microsoft 365 (enlace por `oid`, sin alta automática, rechazo de
  cuentas no registradas) = salida a producción.
- **Después:** instalación ARO.

## Datos conocidos del Excel de empleados
364 personas; sin cédulas duplicadas; supervisores: 56 de 63 vinculables; 71 cargos usados sin ficha en
«Cargos»; los 3 registros «APB/ARO GROUP» (presidentes/socios) se excluyen.