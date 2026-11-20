# Actualización 0.9.0 — Base de empleados, organigrama de empleados y análisis de CV con IA

Se aplica sobre la **0.8.0**. Reúne en una sola entrega lo planificado como 0.8.1 (importación del Listado de Activos),
0.8.2 (organigrama de empleados) y 0.9 (postulados con IA). Trae dos migraciones (014 y 015), un flujo de n8n para
importar y dos variables de entorno nuevas. No agrega dependencias.

## Pasos

1. **Respaldo de la base** en EasyPanel. Es obligatorio: la importación del Listado **no se deshace** con
   `npm run limpiar`. Si el resultado no es el esperado, se restaura este respaldo.
2. Copia los archivos, `git push` y redespliega. El log debe decir `migrada 014_empleados.sql` y
   `migrada 015_postulados_ia.sql`.
3. **Variables del servicio del portal** (EasyPanel › Environment):
   - `PORTAL_URL`: ya existe (URL pública).
   - `PORTAL_URL_INTERNA` (nueva): cómo llega n8n al portal **por la red interna** de EasyPanel, igual que el portal
     llega a n8n por `http://autoretain_n8n:5678`. Tiene la forma `http://<proyecto>_<servicio>:<puerto>`
     (por ejemplo `http://sistemas_gh-portal:3000`; usa el nombre que muestra EasyPanel). Sin ella, n8n usa `PORTAL_URL`.
   - `N8N_API_KEY`: ya existe. El **mismo valor** va en la credencial de n8n del paso 4. No lo pegues en el chat.
   - `N8N_WEBHOOK_IA_URL` (nueva): se llena en el paso 4.
4. **n8n** (proyecto «autoretain»):
   1. Credenciales › nueva **Header Auth** llamada «GH Portal x-api-key»: nombre `x-api-key`, valor = `N8N_API_KEY`.
   2. Importa `n8n/gh-analisis-cv.json`. Asigna esa credencial al Webhook y a los tres nodos HTTP.
   3. Reemplaza el nodo **«Modelo de chat (reemplazar por el tuyo)»** por el modelo que ya tienes configurado en n8n
      (OpenAI, Anthropic, Gemini, Ollama…), conéctalo a la entrada *Model* de «Analizar CV (IA)» y deja la
      temperatura baja (0 a 0,3). En el nodo «Validar respuesta» escribe el nombre del modelo en `MODELO`: queda
      guardado con cada análisis.
   4. Activa el flujo. Copia la **Production URL** del Webhook, cambia el dominio público por el interno
      (`http://autoretain_n8n:5678/webhook/gh-portal-cv`) y ponla en `N8N_WEBHOOK_IA_URL`. Redespliega el portal.
5. **Equivalencias** (GH, antes de importar): Empleados › Importar › «Descargar equivalencias» o usa el borrador
   `4-equivalencias-borrador.xlsx` (carpeta `carga-organigramas`). GH revisa las dudas de abajo, se sube, se revisa
   la vista previa y se aplica.
6. **Importar el Listado** (GH): sube el Listado de Activos y revisa la vista previa. Con el borrador, en una copia de
   tu base, dio: 252 personas nuevas, 186 ocupan una plaza existente, 66 plazas «por regularizar», 13 perfiles mínimos
   nuevos, 38 puestos nuevos, 106 pendientes (98 por estructura: Silos de Portuguesa 42, Inversiones Occidente 23,
   Corpomax 16, Llano Camiones 15, Transauto 2; 8 por equivalencia: INCES, UCLA y Logística de MDV), 4 excluidos;
   supervisor inmediato vinculado en 223 y como texto en 28.
   **Antes de aplicar**, valida tu propia dirección (ver «Validación sugerida»). Luego aplica y vuelve a subir el mismo
   archivo: debe decir «Sin cambios» para las 252.
7. Configuración › **Análisis de CV con IA**: revisa los pesos con GH.

## Qué cambia

### Base de empleados (solo Gestión Humana)
- Menú **Empleados**: lista con búsqueda por nombre o cédula (con o sin puntos y «V-»), empresa y estado.
- **Ficha**: datos personales, la fila completa del Listado (todas las columnas), trayectoria (plaza, unidad,
  supervisor inmediato), a quién supervisa y las **últimas consultas** de la ficha: cada vez que alguien la abre, queda
  registrado quién y cuándo.
- **Egreso**: fecha real (no futura ni anterior al ingreso), tipo y motivo. La plaza queda libre para su reemplazo.
  Aviso a n8n `egreso.registrado` (para que TI retire accesos y equipos) **sin** el tipo ni el motivo.
- Un reemplazo se puede pedir con el ocupante aún activo (preaviso); el ingreso del nuevo no se confirma hasta
  registrar el egreso.

### Importación del Listado de Activos
- Lee todas las hojas (APB GROUP, Becarios, Pasantes, Aprendiz, Acarigua). Cada hoja puede traer varias tablas con su
  propio encabezado; los títulos de sección y los encabezados repetidos se ignoran. Socios y «APB/ARO GROUP» se excluyen.
- **Equivalencias** en Excel: departamento (de una empresa o de todas) → unidad; cargo → perfil. Quedan en el
  historial con su valor anterior.
- Cada persona ocupa una plaza libre del mismo cargo en su unidad (o en las que dependen de ella). Si no la hay, se crea
  una **plaza «por regularizar»**: no cuenta en el HC autorizado, se marca ⚑ y no admite reemplazo ni ingreso.
- Cargos sin ficha: se crea un perfil mínimo «Sin descripción».
- Empresas sin estructura propia en el portal y departamentos sin equivalencia: quedan como **pendientes** (no se
  importan) y se ven en la vista previa.
- Volver a subir el Listado actualiza los datos de la ficha; **no mueve** a nadie de plaza (si la plaza difiere, avisa).

### Plazas por regularizar
- Configuración › **Plazas por regularizar**: lista con cargo, unidad, empresa y ocupante. Regularizar pide quién la
  autorizó y con qué soporte, y exige que el perfil tenga descripción. Después cuenta en el HC.

### Organigrama de empleados (ISO)
- Diagrama «Ver: Cargos» + **«Personas»**: nombre de quien ocupa cada plaza, «Vacante» donde no hay nadie,
  Ocupadas y Vacantes en el título, y bloque de control (elaborado, revisado, aprobado) al imprimir.
- Menú **Organigrama** para todos los usuarios, de solo consulta y solo nombre y cargo: GH y Presidencia ven todo; un
  director o gerente con rol de empresa ve las plazas de su empresa; con rol de unidad, su unidad y las que dependen de ella.

### Postulados con análisis de CV por IA
- En la ficha del postulado: **consentimiento** (cómo autorizó el tratamiento de sus datos; se puede retirar),
  **CV** (PDF, Word o texto, hasta 5 MB) y botón **«Analizar con IA»**.
- n8n compara el CV con el perfil del cargo, dimensión por dimensión (educación, experiencia, conocimientos,
  competencias, idiomas y certificaciones, criterios del perfil), con puntaje 0 a 5 y la evidencia del CV, más resumen,
  fortalezas, brechas, **preguntas para la entrevista** y alertas. El portal calcula un **puntaje orientativo 0–100** con
  los pesos de la rúbrica. Las tarjetas de Selección muestran «IA n/100» y se ordenan por ese puntaje.
- Reglas firmes: la IA **no decide** (no mueve ni descarta postulados); el portal tacha del CV fecha de nacimiento,
  edad, estado civil, sexo, nacionalidad, religión, salud, hijos y cédula antes de enviarlo; el modelo tiene prohibido
  considerarlos; el contenido del CV es un dato, nunca una instrucción (si trae instrucciones para la IA, sale en
  «Alertas»).
- El evento `cv.analizar` no lleva datos personales: n8n lee el CV con su clave y un token propio de cada análisis.
  Un análisis terminado no se modifica ni se borra. Sin respuesta de n8n en 30 minutos, vence y se puede pedir otra vez.

## Supuestos que GH debe validar
1. Regularizar = perfil con descripción + soporte escrito; no pasa por el flujo de aprobación.
2. Tipos de egreso: renuncia, despido justificado, despido injustificado, fin de contrato, mutuo acuerdo, jubilación,
   otro. Validar con legal (LOTTT) antes de usarlos en reportes.
3. Rúbrica única para todos los cargos (no por perfil).
4. Consentimiento registrado por GH; falta definir cuánto tiempo se guardan los CV de no seleccionados.
5. Ordenar las tarjetas por el puntaje de la IA (si GH prefiere el orden de llegada, es un cambio pequeño).

## Dudas de equivalencias para GH (cargo del Listado → perfil del portal)
- Cambian de nombre o de nivel: Gerente de Comercialización → Gerente de Ventas; Analista de Importaciones (y
  «-Comex») → Analista de Importaciones Senior; Gerente de Crédito → Gerente de Planificación y Créditos; Coordinador
  de Importaciones → Coordinador COMEX; Técnico Mecánico Master → Técnico Mecánico; Auditor de Calidad y PDI Junior →
  Auditor de Calidad y PDI; Gerente de Control de Calidad → Gerente de Gestión de Calidad; Especialista de Créditos →
  Especialista de Créditos Corporativo; Especialista de la Planificación de la demanda → Especialista en Planificación
  (Automotriz).
- Sin ficha (quedan como perfil mínimo si no se les asigna uno): Analista Administrativo, Asistente de Presidencia,
  Coordinador Administrativo, Analista de Guiado, Asistente de Guiado, Analista Admon-Contable, Coordinador
  Administrativo-Contable, Jefe de Contraloría Agroindustrial, Jefe de Servicios, Coordinador de Taller, Analista de
  Software, Tesorera, Aprendiz INCES (Práctica).
- Departamentos sin unidad: INCES y UCLA (aprendices y becarios: ¿a qué unidad pertenecen?) y Logística de MDV.
- De las 66 plazas «por regularizar», 44 tienen un perfil «Sin descripción»: GH debe completar esos perfiles (o
  importar su Word) antes de regularizarlas.

## Validación sugerida antes de aplicar en EasyPanel
Tu propia dirección sirve de prueba: el organigrama oficial de Tecnología (10-2026) dice HC 11, 11 ocupados y 0
vacantes. En la copia, el portal da **HC 11 · Ocupadas 10 · Vacantes 3** (2 analistas de desarrollo y 1 de calidad)
y **2 personas en plazas «por regularizar»** colgadas de la Dirección («Analista de Software», perfil mínimo nuevo, y
«Analista de Servicios Tecnológicos y Telecomunicaciones»). Si esas dos personas son los analistas de desarrollo o de
calidad del organigrama, se corrige con la equivalencia de cargo **antes** de aplicar (después, la importación no
mueve a nadie). La persona que falta para llegar a 11 puede estar en otro departamento del Listado o en una hoja de
becarios o pasantes: revísalo en la vista previa.

## Archivos que cambian
- Nuevos: `db/migrations/014_empleados.sql`, `db/migrations/015_postulados_ia.sql`, `src/services/importar_empleados.js`,
  `src/services/ia.js`, `src/controllers/empleados.js`, `src/controllers/api.js`, `src/views/empleados.ejs`,
  `src/views/empleado_ficha.ejs`, `src/views/empleados_importar.ejs`, `src/views/por_regularizar.ejs`,
  `src/views/organigrama.ejs`, `src/views/config_ia.ejs`, `src/views/partials/dg_control.ejs`,
  `n8n/gh-analisis-cv.json`, `UPDATE_0.9.0.md`.
- Modificados: `src/server.js`, `src/config.js`, `src/confignav.js`, `src/services/empleados.js`,
  `src/services/plantilla.js`, `src/services/perfiles.js`, `src/services/seleccion.js`, `src/services/outbox.js`,
  `src/controllers/seleccion.js`, `src/controllers/estructura.js`, `src/views/cand_detalle.ejs`,
  `src/views/seleccion.ejs`, `src/views/estructura_diagrama.ejs`, `src/views/partials/head.ejs`,
  `public/js/diagrama.js`, `scripts/limpiar.js`, `package.json` (0.9.0), `.env.example`, `README.md`, `ESTADO.md`,
  `PRUEBAS.md`.

## Migraciones
- **014:** ficha del trabajador (todas las columnas del Listado), datos de la relación laboral (ubicación, tipo,
  supervisor, tipo de egreso, importación), registro de consultas de fichas, equivalencias, importaciones, origen de
  plaza «carga_inicial» y datos de regularización.
- **015:** consentimiento del postulado, texto del CV, rúbrica configurable (con sus pesos iniciales) y análisis de IA
  (con disparadores: terminado no se modifica; nunca se borra).
- **No son reversibles** sin el respaldo del paso 1.

## Pruebas críticas
1. **IMP-01/02:** vista previa con los números del paso 6; aplicar; volver a subir → «Sin cambios».
2. **REG-01:** regulariza una plaza con perfil descrito; la Plantilla la cuenta en el HC.
3. **EGR-01/02:** registra un egreso de prueba (con una persona ficticia, no real: un egreso no se anula); la plaza
   queda libre.
4. **ORG-01/02:** Organigrama con «Personas» en tu dirección, impresión en PDF; entra con un usuario gerente y
   comprueba que solo ve su rama.
5. **EMP-01/02:** un gerente no entra a Empleados; abrir una ficha deja la consulta registrada.
6. **IA-01 a IA-06 e IA-08:** con un postulado de prueba: consentimiento, CV en Word, «Analizar con IA», resultado en
   la ficha en uno o dos minutos; repite con un PDF; prueba un PDF escaneado (debe llegar el error).
7. **EV-05:** en n8n, el flujo de notificaciones sigue recibiendo los avisos de requisición; `cv.analizar` llega al
   flujo de IA.

## Revisión de código
- **Corregido antes de entregar:**
  - `/organigrama`: un director o gerente con rol de empresa veía todo el grupo; ahora ve solo las plazas de su empresa.
  - Subida de CV: el permiso se validaba después de recibir el archivo; ahora un usuario que no es de GH recibe 403
    sin escribir nada en el disco.
  - Rutas nuevas con identificador no numérico daban «Error interno»: ahora 404.
  - Las equivalencias se sobrescribían sin dejar rastro: ahora quedan en el historial con el valor anterior.
  - Consultas en paralelo sobre la transacción en la carga de equivalencias (dejará de funcionar con pg 9).
  - Fechas con hora mostraban «Fri Nov 20» en la ficha del postulado: ahora 20/11/2026.
  - Un análisis sin respuesta de n8n bloqueaba al postulado para siempre: ahora vence a los 30 minutos.
  - El día del relevo la plaza mostraba a la persona que egresa y a la que ingresa.
  - La vista previa vencida de la importación (con datos personales) quedaba en la sesión.
- **Ordenado de paso:** nada fuera del código de esta entrega.
- **Visto y no tocado:**
  - Ahora: no hay forma de **reubicar** a un empleado importado en otra plaza ni de **anular un egreso** registrado
    por error (propuesta para la 0.9.1).
  - Después: consultas en paralelo en `requisiciones.js` (detalleEvento) y en la carga masiva de `plantilla.js` y
    `perfiles.js`; el registro de consultas de fichas no tiene disparador contra borrado; la API de n8n no limita
    intentos; índice en `relacion_laboral.supervisor_id`; en la copia de la base, 449 entradas antiguas del historial
    (anteriores a esta entrega) no recalculan su hash, probablemente por cómo reconstruí la copia (las 170 nuevas sí).
- **No se pudo verificar:** EasyPanel; el flujo de n8n dentro de n8n con un modelo real (los nodos de código se
  probaron fuera de n8n con datos reales de la API); extracción de texto de un PDF real; imprimir o PDF del
  organigrama; Safari.

## Documentos actualizados
- `UPDATE_0.9.0.md` (este), `ESTADO.md`, `PRUEBAS.md` (secciones 10c y 10d, EV-05 y registro), `README.md`
  (variables, contrato y API de n8n, empleados y organigrama), `.env.example`.
- `ARQUITECTURA.md` (en el proyecto): API n8n → portal y variables nuevas.
- Sin cambios: `DESIGN.md` (se usan componentes existentes).
