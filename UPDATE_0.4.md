# Actualización 0.4 — requisición ampliada, maestros, comentarios, adjuntos y línea de tiempo

## Archivos
**Nuevos:** db/migrations/004_requisicion_ampliada.sql · src/services/comunicacion.js · src/controllers/comunicacion.js · src/views/maestros.ejs, perfil_vista.ejs
**Reemplazar:** package.json · src/config.js, server.js · src/services/requisiciones.js · src/controllers/requisiciones.js, config.js, pipeline.js, admin.js · src/views/req_form.ejs, req_detalle.ejs, perfiles.ejs, partials/head.ejs, partials/foot.ejs · public/js/app.js, public/css/app.css

## Pasos
1. Copia los archivos, `npm install` (agrega multer; sube el package-lock.json), `git push`.
2. EasyPanel → servicio de la app → Volúmenes: monta uno persistente en `/app/uploads`. Si al subir un archivo falla por permisos, en la consola del servicio: `chown -R node:node /app/uploads`.
3. La migración 004 corre sola al arrancar. Haz backup antes.
4. Entra como superadmin → Maestros: revisa grados, equipos y agrega los accesos a sistemas.
5. Variable opcional: `UPLOADS_DIR` (por defecto `/app/uploads`).

## Qué cambia
- Requisición: todos los campos editables en borrador; eliminar (solo si nunca se envió ni tiene comentarios) o anular (conserva el historial); sustituye a, profesión u oficio, grado, experiencia, fechas si es temporal, equipos (con línea telefónica), accesos con nivel y correo corporativo.
- Segundo modal con el perfil completo desde el formulario, y solicitud de perfil nuevo a GH (evento `perfil.solicitado`).
- Modal de la requisición con comentarios (traza, no editables; nota interna solo GH), adjuntos (10 MB; PDF, imágenes, Word, Excel, texto) y línea de tiempo completa.
- n8n recibe el detalle completo (equipos, accesos, correo) en `requisicion.aprobado` (aviso a TI para comprar) y en el evento de Ingreso (entrega), más `requisicion.comentario` y `perfil.solicitado`.

## Prueba mínima
Crea una requisición temporal con un teléfono con línea y un acceso → ábrela y mira «Ver perfil completo» → envíala, apruébala como Director y comprueba en la línea de tiempo cada paso; adjunta un PDF y descárgalo con otro usuario involucrado.
