# Portal de Gestión Humana

Aplicación MVC (Node.js + Express + EJS) con PostgreSQL. n8n queda para notificaciones, IA de CV y documentos; la app nunca depende de n8n para confirmar un estado.

## Estructura
```
db/migrations/   esquema SQL versionado (se aplica solo al arrancar)
src/controllers/ rutas HTTP (auth, pipeline, requisiciones, admin)
src/services/    reglas de negocio (requisiciones, permisos, outbox hacia n8n)
src/views/       plantillas EJS (modales como fragmentos)
scripts/seed.js  catálogos iniciales y usuario administrador
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
3. Servicio **App** desde GitHub (build con Dockerfile). Variables: `DATABASE_URL`, `SESSION_SECRET` (largo y aleatorio), `COOKIE_SECURE=true`, `NODE_ENV=production`, `N8N_WEBHOOK_URL`, `N8N_API_KEY`.
4. Dominio con HTTPS. Health check: `/health`.
5. Consola del servicio: `npm run seed` con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. Las migraciones corren solas al arrancar.
6. Backups programados del servicio PostgreSQL y prueba de restauración antes de producción.

## Contrato con n8n
La app guarda cada cambio en `evento_outbox` y lo envía por POST al webhook (`x-api-key`), con reintentos (hasta 10). Cuerpo: `{ id, tipo, payload }`. Usa `id` para no duplicar avisos. Todos los eventos de requisición traen `url`, `detalle.plaza` (requiere `PORTAL_URL`) y `detalle` completo. Tipos actuales: `requisicion.empresa_cambiada`, `requisicion.sin_aprobador`, `requisicion.pend_director` (con `aprobadores`), `pend_presidencia`, `aprobado`, `publicacion`, `convocatoria`, `seleccion`, `rechazada`, `borrador` (devuelta), `cancelado`, `ingreso`.

## Diagrama de estructura
`/config/estructura/diagrama` (solo GH): vista de cajas con filtros por unidad, empresas, división y fecha; impresión o PDF e imagen. Sin librerías externas (`public/js/diagrama.js`).

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

## Pendiente (siguientes entregas)
0.8 Empleados (importación del Excel) y organigrama por división, empresa y unidad.
0.9 Postulados con IA. 1.0 Notificaciones. SSO Microsoft 365 antes de abrir el portal a todos los gerentes.
