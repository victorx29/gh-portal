# Actualización 0.3 — pipelines configurables, selección, superadmin, empresas

## Archivos
**Nuevos:** db/migrations/002_superadmin.sql, 003_pipelines.sql · src/services/pipelines.js, seleccion.js · src/controllers/seleccion.js, config.js · src/views/seleccion.ejs, cand_form.ejs, cand_detalle.ejs, config_pipelines.ejs, empresas.ejs, usuario_eliminar.ejs, partials/registro.ejs
**Reemplazar:** src/util.js, server.js · src/services/perm.js, requisiciones.js · src/controllers/requisiciones.js, pipeline.js, admin.js · src/views/req_detalle.ejs, usuarios.ejs, partials/head.ejs · public/css/app.css · scripts/seed.js

## Pasos
1. Copia los archivos respetando las rutas, `git commit` y `git push`; EasyPanel redespliega.
2. Las migraciones 002 y 003 corren solas al arrancar (requiere PostgreSQL 12 o superior). Haz un backup antes: 003 convierte los estados en texto.
3. Dale el rol superadmin a tu usuario (consola de PostgreSQL en EasyPanel):
   `insert into usuario_rol(usuario_id,rol,empresa_id) select id,'superadmin',null from usuario where email='TU_CORREO' on conflict do nothing;`
4. Cierra sesión y vuelve a entrar. Verás los menús Pipelines y Empresas.

## Prueba mínima
Empresas → crea una empresa → Pipelines → «Personalizar para esta empresa» → agrega una columna con «Requiere resultado Apto» → crea una requisición en esa empresa, apruébala, y comprueba que GH no puede pasarla de columna hasta registrar el resultado.
