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
| gerente | Crea y envía requisiciones | Empresas asignadas |
| director | Aprueba (si él solicita, se aprueba automática) | Empresas asignadas |
| presidencia | Aprueba solo cargos nuevos, después del Director | Empresas asignadas |
| gh | Ve todo, mueve Aprobado→Selección, cancela, administra usuarios y perfiles | Siempre global; no aprueba |

Nadie aprueba su propia requisición. Devolver exige comentario y regresa a borrador; rechazar cierra.

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
La app guarda cada cambio en `evento_outbox` y lo envía por POST al webhook (`x-api-key`), con reintentos (hasta 10). Cuerpo: `{ id, tipo, payload }`. Usa `id` para no duplicar avisos. Tipos actuales: `requisicion.pend_director`, `pend_presidencia`, `aprobado`, `publicacion`, `convocatoria`, `seleccion`, `rechazada`, `borrador` (devuelta), `cancelado`, `ingreso`.

## Pendiente (siguiente entrega)
Selección por candidato (4.1 a 4.8), carga de CV en modal y callback de la IA local, creación de trabajador al ingresar, ficha completa del trabajador, catálogos de empresas y áreas desde la interfaz, límite de intentos de login compartido entre réplicas.
