# ESTADO.md — actualizar en cada entrega

Última revisión: 24-11-2026, contra el código `gh-portal` 0.9.4 (package.json 0.9.4, migraciones 001–019).

## Versión
- **Última entregada:** 0.9.4 (24-11-2026): carga masiva de CV con lectura en n8n (OCR local), número de candidato
  REQ-xxxxx-Cnn, alertas, «Analizar todos con IA», «Reintentar análisis» y «Reintentar lectura».
- **Desplegada en EasyPanel:** 0.9.3 (según Victor, 23-11-2026). Pendiente: configurar en n8n el flujo de análisis
  (`gh-analisis-cv.json`) y, con la 0.9.4, el de lectura (`gh-lectura-cv.json`).
- **Antes:** 0.9.1 en EasyPanel (visto en el navegador el 23-11-2026; Maria Yajure y los dos analistas de desarrollo ya
  reubicados por Victor). La importación de la 0.9.0 se aplicó sin respaldo previo: respaldo antes de cada despliegue.
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
- **0.9.1:** «Reubicar en otra plaza» (solo GH), para corregir a las personas que la importación dejó en la plaza
  equivocada y para traslados reales. Corrección (conserva la fecha de ingreso; la relación anterior queda «corregida» y no
  aparece en el organigrama a ninguna fecha; hacia una plaza ocupada intercambia a las dos personas) o Traslado (fecha real;
  la anterior queda «movido» el día antes). Formulario → revisar → confirmar; la plaza «por regularizar» que queda vacía se
  cierra sola con motivo; supervisor: mantener, el sugerido por la plantilla o ninguno. Acceso desde la ficha y desde
  «Plazas por regularizar». Migración 016.
- **0.9.2:** solo se congela una plaza vacía (sin ocupante, ingreso ni requisición abierta; tampoco «por regularizar»), también
  en la carga masiva; no se confirma un ingreso en una plaza congelada; egreso con confirmación escribiendo el nombre y casilla
  «congelar la plaza al quedar vacía»; anular egreso (motivo + nombre, solo con la plaza libre; descongela; evento
  `egreso.anulado`); el organigrama no dibuja puestos con todas sus plazas cerradas; desactivar puesto con «creado por error»;
  acciones de plaza y «Regularizar» en modal propio; al guardar se vuelve a la misma vista (filtros, modal y posición);
  indicador de carga con la «O» del logo. Migración 017.
- **0.9.3:** ficha del empleado completa al confirmar un ingreso (nacimiento, sexo, hijos, nivel académico, título, ubicación,
  tipo de empleado; fin de contrato si el tipo lo pide), «Ficha incompleta» y «Editar ficha»; catálogos Ubicaciones y Tipos de
  empleado; campos personalizados de GH (candidato, empleado o ambos; nunca a la IA ni a n8n); alta manual por GH (plaza vacante
  o plaza «por regularizar»); «Regularizar varias»; Conciliación de personas y plazas con sugerencias; Reubicar con «la plaza toma
  la empresa de la persona»; aviso en la importación por equivalencias generales; solo se cierra una plaza vacía (también en la
  carga masiva); «O» al navegar; leyenda del organigrama. Migración 018.

- **0.9.4:** «Cargar CV» en Selección (varios archivos; PDF, Word .doc/.docx, texto e imágenes; 5 MB c/u; hasta 30): un candidato
  por CV con nombre provisional sacado del archivo, consentimiento con una casilla («Confirmo haber notificado…»), repetidos
  omitidos; número de candidato por requisición (REQ-00001-C03) asignado por la base; lectura en n8n (evento `cv.leer`, API
  `/api/cv/lectura`, flujo `n8n/gh-lectura-cv.json` con OCR local y modelo local) que llena solo datos vacíos y deja alertas;
  cruce de cédula con postulados anteriores (unir con la ficha anterior, decide GH) y empleados activos; «Editar datos del
  candidato»; el nombre provisional no pasa a Ingreso; «Analizar todos con IA»; «Reintentar análisis» y «Reintentar lectura»;
  aviso de resultados nuevos en el tablero. Corrige el deadlock del historial con escrituras en paralelo. Migración 019.

## Carga de datos de prueba (19-11-2026)
- Archivos en `C:\Automatizaciones\carga-organigramas` (fuera del repo), generados de los organigramas 2026 (GH 2025):
  1 unidad nueva (UO-0061, Gerencia de Ventas de IM), 50 perfiles mínimos y la plantilla (214 plazas, 9 vacantes).
  Probados en una copia de la base de EasyPanel. Son para validar el sistema con GH: la plantilla 2027 cambiará.
- Fuera de esta carga: Silos de Portuguesa, Corpomax y F21 (sin organigrama ni unidades).

## Pendiente después de la 0.9.3 (antes de la 1.0)
- Datos en el portal (sin código): Directora de Finanzas por alta manual (falta la empresa que paga su nómina en APB);
  Gerente General de Concesionario (GH-PF-052) al nivel «Gerencia General» (aprobación de Victor pendiente); Gerente de
  Mercadeo (CIM) bajo Gerente de Mercadeo (MDV): decisión de GH; 36 perfiles sin nivel jerárquico; las 64 plazas «por
  regularizar» con Conciliación y Regularizar varias; desactivar como «creado por error» los puestos que queden vacíos.
- Estructura de Contraloría Agroindustrial y SDP (GH) para reubicar a su personal.
- Plantilla 2027: cargarla y pasar por Conciliación.
- Después: módulo de egreso (Victor lo detallará), reportería en vistas y exportación puntual solo GH.

## Pendiente sin clasificar
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

## Decisiones del 23/24-11-2026 (Victor), 0.9.4
- Carga masiva de CV: un candidato por CV; «Analizar todos con IA» es un botón (no automático al subir).
- Número de candidato = requisición + correlativo (REQ-00001-C03), independiente de la cédula. La cédula se valida cuando
  existe, contra postulados anteriores (base de elegibles) y empleados actuales.
- Consentimiento: una casilla «Confirmo haber notificado al postulado sobre el uso de sus datos», y ya.
- Todo el CV va a n8n; allí lo leen los modelos locales (Mistral OCR ya instalado). Formatos: PDF y Word de preferencia;
  se aceptan otros si hace falta (texto, JPG, PNG).
- Botón para reintentar el análisis (también para probar el flujo en n8n).

## Decisiones del 23-11-2026 (Victor), 0.9.3
- Los datos del Listado (nacimiento, sexo, hijos, nivel académico, título, ubicación, tipo de empleado) se piden al CONFIRMAR EL
  INGRESO, no al candidato; todos obligatorios; fin de contrato solo si el tipo lo pide.
- Campos personalizados: los define GH para el candidato, el empleado o ambos; nunca van a la IA ni a n8n.
- Alta manual sin plaza vacante: crea una plaza «por regularizar». Solo se cierra una plaza vacía.
- Nivel jerárquico «Gerencia General» por encima de «Gerencia» (aplicado al Gerente de Post Venta).

## Decisiones del 23-11-2026 (Victor), continuación
- Congelar = la plaza existe pero no se autoriza usarla ni pedir su requisición: solo una plaza vacía.
- Egreso: confirmación escribiendo el nombre de la persona. Anular egreso: solo con motivo y confirmación por nombre.
- Directora de Finanzas: atiende APB y ARO; se registra por separado en cada instalación (alta manual, 0.9.3).
- Un puesto creado por error no se borra: se desactiva marcado «creado por error» y no se dibuja.
- Interfaz: toda acción que cambia datos se abre en modal; al guardar se vuelve a la misma vista; «O» del logo como carga.

## Decisiones del 23-11-2026 (Victor)
- Reubicar: dos tipos, «Corrección» (error de carga, no cuenta como movimiento) y «Traslado» (real, con fecha); solo GH,
  con motivo; el historial conserva la plaza anterior. La plaza «por regularizar» que queda vacía se cierra sola.
- La base de pruebas de la 0.9.1 iba a ser un volcado de EasyPanel; no llegó y se probó con datos ficticios.

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
- 0.9.4, supuestos a validar: la casilla de consentimiento reemplaza el texto «cómo lo autorizó» también en la ficha individual;
  los candidatos de la carga masiva no exigen los campos personalizados obligatorios hasta que GH guarda sus «Datos
  adicionales»; el texto que va a n8n para la lectura no va tachado (debe leer la cédula). (confirmar)
- 0.9.4, para después: el formato de la API del OCR local quedó como el de Mistral (`/v1/ocr`); si el servidor de Victor usa
  otro, se ajustan dos nodos del flujo. El nombre provisional puede quedar con palabras del archivo («perfil», «otro»).
- Consultas en paralelo sobre la misma transacción (aviso de pg en el log; dejará de funcionar con pg 9):
  `requisiciones.js` (detalleEvento), `perfiles.js` (carga masiva), `plantilla.js` (carga masiva). Para la
  versión de estabilización; no actualizar pg a la 9 antes. (El código nuevo de la 0.9.0 ya no lo hace.)
- 0.9.0, para después (anular egreso y reubicar quedaron resueltos en la 0.9.2 y la 0.9.1): el registro de consultas de fichas
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
- **0.9.1 (entregada):** reubicar empleados (corrige el organigrama tras la importación).
- **0.9.2 y 0.9.3 (entregadas).** Después, versiones propias antes de la 1.0: módulo de egreso, reportería y exportación.
- **1.0** Notificaciones, plantillas y SSO Microsoft 365 (enlace por `oid`, sin alta automática, rechazo de
  cuentas no registradas) = salida a producción.
- **Después:** instalación ARO.

## Datos conocidos del Excel de empleados
364 personas; sin cédulas duplicadas; supervisores: 56 de 63 vinculables; 71 cargos usados sin ficha en
«Cargos»; los 3 registros «APB/ARO GROUP» (presidentes/socios) se excluyen.