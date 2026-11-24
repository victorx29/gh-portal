# Portal de Gestión Humana

Aplicación MVC (Node.js + Express + EJS) con PostgreSQL. n8n queda para notificaciones, IA de CV y documentos; la app nunca depende de n8n para confirmar un estado.

## Estructura
```
db/migrations/   esquema SQL versionado (se aplica solo al arrancar)
src/controllers/ rutas HTTP (auth, pipeline, requisiciones, admin)
src/services/    reglas de negocio (requisiciones, permisos, outbox hacia n8n)
src/views/       plantillas EJS (modales como fragmentos)
scripts/seed.js  catálogos iniciales y usuario administrador
scripts/limpiar.js  limpieza de datos de prueba (vista previa; borra solo con --aplicar y PERMITIR_LIMPIEZA=si)
```

## Roles y alcance
| Rol | Qué hace | Alcance |
|---|---|---|
| gerente | Crea y envía requisiciones | Su unidad y sus dependientes (o una empresa, regla de transición) |
| director | Aprueba (si él solicita, se aprueba automática) | La unidad marcada «Aprueba» que tiene asignada |
| presidencia | Aprueba solo cargos nuevos, después del Director | Empresas asignadas |
| gh | Ve todo, mueve Aprobado→Selección, cancela, administra estructura, usuarios y perfiles | Siempre global; no aprueba |

Nadie aprueba su propia requisición. Devolver exige comentario y regresa a borrador; rechazar cierra.

## Estructura organizativa
Grupos → empresas → unidades de profundidad libre, con dependencia sólida (una vigente) y funcional (varias), ambas con vigencia `[desde, hasta)`.
Los cambios cierran la dependencia y abren otra; nunca se edita ni se borra (lo impiden disparadores en la base). La aprobación sube por la línea
sólida hasta la primera unidad «Aprueba» (`unidad_aprobadora()`), y cada aprobación guarda una foto inmutable de la cadena (`aprobacion.estructura`).

## Desarrollo local
```
cp .env.example .env            # ajusta SESSION_SECRET
docker compose up -d db
npm install                     # genera package-lock.json: súbelo a Git
DATABASE_URL=postgres://gh:gh@localhost:5432/gh npm run migrate
SEED_ADMIN_EMAIL=tu@correo SEED_ADMIN_PASSWORD='clave-larga-1' SEED_DEMO=true DATABASE_URL=... npm run seed
DATABASE_URL=postgres://gh:gh@localhost:5432/gh npm run dev
```

## GitHub y EasyPanel
1. Repositorio **privado** en GitHub y `git push`.
2. EasyPanel → proyecto → servicio **PostgreSQL** (anota usuario, clave y host interno).
3. Servicio **App** desde GitHub (build con Dockerfile). Variables: `DATABASE_URL`, `SESSION_SECRET` (largo y aleatorio), `COOKIE_SECURE=true`, `NODE_ENV=production`, `N8N_WEBHOOK_URL`, `N8N_API_KEY`, `PORTAL_URL`; desde la 0.9, `N8N_WEBHOOK_IA_URL` y `PORTAL_URL_INTERNA` (análisis de CV); desde la 0.9.4, `N8N_WEBHOOK_LECTURA_URL` (lectura de CV de la carga masiva).
4. Dominio con HTTPS. Health check: `/health`.
5. Consola del servicio: `npm run seed` con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. Las migraciones corren solas al arrancar.
6. Backups programados del servicio PostgreSQL y prueba de restauración antes de producción.

## Contrato con n8n
La app guarda cada cambio en `evento_outbox` y lo envía por POST al webhook (`x-api-key`), con reintentos (hasta 10). Cuerpo: `{ id, tipo, payload }`. Usa `id` para no duplicar avisos. Todos los eventos de requisición traen `url`, `detalle.plaza` (requiere `PORTAL_URL`) y `detalle` completo. Tipos actuales: `requisicion.empresa_cambiada`, `requisicion.sin_aprobador`, `requisicion.pend_director` (con `aprobadores`), `pend_presidencia`, `aprobado`, `publicacion`, `convocatoria`, `seleccion`, `rechazada`, `borrador` (devuelta), `cancelado`, `ingreso`. Desde la 0.8: `ingreso.confirmado` y `egreso.registrado` (sin tipo ni motivo del egreso). Desde la 0.9: `cv.analizar` (va a `N8N_WEBHOOK_IA_URL` si existe). Desde la 0.9.5: `cv.resumen` (va a `N8N_WEBHOOK_IA_URL`, como `cv.analizar`). Desde la 0.9.4: `cv.leer` (solo a `N8N_WEBHOOK_LECTURA_URL`; sin ella espera sin gastar intentos) y `candidatura_codigo` (REQ-xxxxx-Cnn) en los eventos de candidatura.

### API para n8n (0.9)
`cv.analizar` no lleva datos personales: trae `analisis_id`, `requisicion`, `url_datos`, `url_resultado` y `url_error` (con `?t=` token propio del análisis).
n8n llama con la cabecera `x-api-key` (= `N8N_API_KEY`):
- `GET url_datos` → perfil, rúbrica, escala 0–5, reglas y el CV (texto ya tachado de datos protegidos; si es PDF, el archivo en base64).
  Desde la 0.9.5 trae además `prompt: { version, sistema, usuario, marca_cv }`: el prompt lo arma el portal (reglas firmes + instrucciones
  de Gestión Humana editables en Configuración › Análisis de CV con IA + datos y formato). n8n reemplaza `marca_cv` por el texto del CV y llama al modelo.
- `POST url_resultado` con `{ resumen, criterios: [{ clave, puntaje 0–5, evidencia }], fortalezas, brechas, preguntas, alertas, modelo, texto_cv? }`
  o, desde la 0.9.5, `{ respuesta: <ese mismo JSON del modelo>, modelo, texto_cv? }`.
  El portal calcula el puntaje 0–100 con los pesos de la rúbrica. Un análisis terminado no se modifica.
- `POST url_error` con `{ mensaje }`. Sin respuesta en 30 minutos, el análisis vence y GH puede pedirlo de nuevo.
Flujo importable: `n8n/gh-analisis-cv.json` (ver `UPDATE_0.9.0.md`). La IA analiza y resume; nunca mueve ni descarta postulados.

### Resumen general de la selección (0.9.5)
`cv.resumen` trae `resumen_id`, `requisicion`, `url_datos`, `url_resultado` y `url_error` (con `?t=`).
- `GET url_datos` → `{ tipo: 'resumen', codigos, prompt: { sistema, usuario } }`. Solo números de candidato y sus análisis: sin nombres ni datos personales.
- `POST url_resultado` con `{ respuesta: { resumen, terna: [{ candidato, motivo }] (máx. 3, solo de `codigos`), verificar, alertas }, modelo }`. La terna es orientativa: decide GH.
- `POST url_error` con `{ mensaje }`.
Flujo importable (análisis y resumen, el mismo webhook): `n8n/gh-analisis-cv.json` 0.9.5. Desde la 0.9.5 los dos flujos llaman al modelo local por la
API compatible con OpenAI (`/v1/chat/completions`: Ollama, vLLM, LM Studio), no con el nodo de modelo de n8n: así el JSON del prompt no se interpreta como plantilla.

### Lectura de CV (0.9.4)
`cv.leer` trae `cv_id`, `requisicion`, `url_datos`, `url_resultado` y `url_error` (con `?t=` token propio de la lectura).
- `GET url_datos` → qué extraer (nombre, cédula, correo, teléfono), reglas y el CV: texto si el portal lo leyó (Word, texto); si no, el archivo en base64 con su extensión (PDF, .doc, imagen). Este texto no va tachado: sirve para leer los datos de contacto.
- `POST url_resultado` con `{ datos: { nombre, cedula, email, telefono }, alertas: [texto], texto?, modelo }`. El portal solo llena los datos vacíos, cruza la cédula con postulados anteriores y empleados, y guarda alertas; nunca une fichas solo.
- `POST url_error` con `{ mensaje }`. GH puede pedir la lectura de nuevo en cualquier momento («Reintentar lectura»); el token anterior deja de valer.
Flujo importable: `n8n/gh-lectura-cv.json` (OCR local tipo Mistral `/v1/ocr` + modelo local de extracción; ver `UPDATE_0.9.4.md`).

## Empleados y organigrama (0.8–0.9)
`/empleados` (solo GH): base de empleados, ficha con registro de consultas, egreso e importación del Listado de Activos con equivalencias
(departamento → unidad, cargo → perfil). Las personas sin plaza autorizada quedan en plazas «por regularizar»
(`/config/plantilla/por-regularizar`), que no cuentan en el HC ni admiten reemplazo o ingreso hasta que GH las regulariza.
`/organigrama`: organigrama de empleados de consulta para todos, cada uno en su alcance (solo nombre y cargo).

## Diagrama de estructura
`/config/estructura/diagrama` (solo GH): vista de cajas con filtros por unidad, empresas, división y fecha; impresión o PDF e imagen. Sin librerías externas (`public/js/diagrama.js`).

## Avisos y confirmaciones (componente propio, sin dependencias)
Los avisos aparecen flotantes: los de éxito se cierran solos y los de error quedan hasta cerrarlos. Cualquier `<form>` o `<button>` con
`data-confirm="mensaje"` pide confirmación en un modal del portal (`data-ok` = texto del botón, `data-peligro` = acción irreversible, botón rojo).

## Plantilla de puestos
Puesto = perfil en una unidad (un jefe por unidad); plaza = posición autorizada con empresa de nómina, modalidad y vigencia.
Estado de plan calculado a cualquier fecha (vigente, congelada, proyectada, cerrada). Reporte: jefe directo por defecto más excepciones, sin ciclos.
Puestos y plazas no se borran (disparadores en la base). Ver `UPDATE_0.7.md`.
Una plaza por requisición: el reemplazo elige una plaza de su unidad; el cargo nuevo crea su plaza al aprobarse. Plaza de unidad corporativa con empresa
«Por definir» hasta que se aprueba la requisición; GH puede cambiar la empresa de la plaza o de la requisición (con motivo). Ver `UPDATE_0.7.2.md`.

## Perfiles y Cargos
Contenido con el formato de la descripción de cargo de GH: objetivo, funciones, educación, experiencia (con años mín./máx.), conocimientos, certificaciones, idiomas,
competencias conductuales y organizacionales, y responsabilidades. «Departamento», «Reporta a» y «Trabajador ocupante» no se guardan en el perfil:
salen de la plantilla y de los empleados. Importación de .docx (`/perfiles/importar-docx`), descripción imprimible (`/perfiles/:id/descripcion`)
y control documental ISO simple por versión (`perfil_version_control`).
Código automático `GH-PF-NNN` y versiones inmutables `GH-PF-NNN-VV`; el perfil marca su versión activa (`perfil.version_activa_id`).
Alcance en `perfil_alcance`: general, empresas, unidades (incluye dependientes) o ambas. La requisición guarda la versión activa al crearse.

## Ingreso y empleados (0.8)
Cuando un candidato llega a «Ingreso» queda «por ingresar» en la plaza de la requisición (`relacion_laboral`). GH confirma la fecha real
y entonces la persona ocupa la plaza; o registra que no se presentó. Una plaza tiene a lo sumo una persona activa y una por ingresar; una
persona, una relación activa (el ingreso a otra plaza cierra la anterior como «movido»). Las relaciones no se borran. Candidatos y
trabajadores se identifican por cédula normalizada (solo dígitos). Una plaza «por regularizar» no admite reemplazo ni ingreso.

## Limpieza de datos de prueba
En la consola del servicio, con respaldo previo: `npm run limpiar -- transacciones` muestra qué borraría; para borrar, define
`PERMITIR_LIMPIEZA=si`, ejecuta con `--aplicar` y quita la variable. `npm run limpiar -- perfil GH-PF-NNN` borra un perfil sin uso.
El historial no se borra: queda encadenado y registra la limpieza.

## Pendiente (siguientes entregas)
0.8.1 Importación del Listado de Activos. 0.8.2 Organigrama de empleados (ISO). 0.9 Postulados con IA.
1.0 Notificaciones, plantillas y SSO Microsoft 365 (salida a producción).
