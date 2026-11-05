# Actualización 0.5 — Estructura organizativa, roles por unidad y Configuración

## Archivos
**Nuevos:** db/migrations/005_estructura.sql · src/confignav.js, src/icons.js · src/services/estructura.js, importar.js · src/controllers/estructura.js ·
src/views/config_inicio.ejs, estructura.ejs, unidad_form.ejs, unidad_detalle.ejs, importar.ejs, empresa_form.ejs, usuario_rol.ejs, partials/config_nav.ejs, partials/crumb.ejs · UPDATE_0.5.md

**Reemplazar:** package.json · public/css/app.css, public/js/app.js · scripts/seed.js · src/db.js, server.js ·
src/controllers/admin.js, config.js, requisiciones.js · src/services/comunicacion.js, perm.js, requisiciones.js, seleccion.js ·
src/views/config_pipelines.ejs, empresas.ejs, maestros.ejs, perfiles.ejs, pipeline.ejs, req_detalle.ejs, req_form.ejs, usuarios.ejs, partials/head.ejs

Ningún archivo se elimina. La tabla `area` y la columna `requisicion.area_id` quedan como referencia histórica; ya no se usan.

## Pasos
1. **Backup de la base de datos.** La migración 005 transforma las áreas en unidades.
2. Copia los archivos, `npm install` (agrega `exceljs`), sube el `package-lock.json` y `git push`.
3. Redespliega. La migración corre sola al arrancar. Revisa el log: debe decir `migrada 005_estructura.sql`.
4. La migración fija la zona horaria de la base en `America/Caracas` (las fechas de vigencia dependen de ella). Si el log muestra
   «Sin permiso para fijar la zona horaria», agrega `TZ=America/Caracas` y `PGTZ=America/Caracas` al servicio PostgreSQL en EasyPanel.
5. **Configuración › Empresas y grupos:** completa siglas (MDV, CIM…), razón social y RIF. Las siglas son las que usa la carga masiva.
6. **Configuración › Estructura › Descargar Excel:** completa la estructura y súbela en Carga masiva. Revisa la vista previa y aplica.
7. Marca como «Aprueba» las unidades donde se aprueban requisiciones (direcciones, gerencias generales de concesionarios).
8. **Usuarios y roles:** asigna a cada director su unidad y a cada gerente la suya. Cuando todo funcione, retira los roles «por empresa».

## Qué cambia
- **Estructura con vigencia.** Grupos (APB, ARO…) → empresas → unidades de profundidad libre. Dependencia sólida (una vigente) y funcional/punteada (varias).
  Ningún cambio edita ni borra: cierra la dependencia con fecha de hoy y abre la nueva. «Ver estructura al» muestra cualquier fecha pasada.
  La base de datos impide ciclos y borrados de dependencias.
- **Servicios compartidos.** Una unidad puede pertenecer a una empresa o ser corporativa, y atender a varias empresas («Sirve a»).
- **Aprobación por ascenso.** Aprueba el director de la primera unidad marcada «Aprueba» subiendo por la línea sólida, aunque sea de otra empresa.
  Presidencia sigue igual (solo cargos nuevos). GH no aprueba.
- **Regla de transición.** Si ninguna unidad de la cadena aprueba, aprueba el director con rol por empresa, como en la 0.4. Nada se rompe al actualizar.
- **Sin aprobador = retenida.** Si la unidad que aprueba no tiene director, la requisición queda en «Director» con la marca «Sin aprobador»,
  se envía el evento `requisicion.sin_aprobador` y avanza sola cuando se asigna el director. No se reasigna a otra persona en silencio.
- **Foto de cada aprobación.** Se guarda la cadena de mando de ese momento (inmutable). Se ve en el detalle de la requisición, sección «Aprobaciones».
- **Roles por unidad.** Gerente y director alcanzan a su unidad y a sus dependientes. El formulario de requisición solo ofrece esas unidades.
- **Configuración** reorganizada con iconos: Organización, Personas y acceso, Procesos y Catálogos (cada catálogo en su pestaña, más Tipos de unidad).
- **Carga masiva** con plantilla Excel que trae los datos actuales: errores por fila, vista previa y aplicación en una sola transacción.
  Lo que no está en el archivo no se toca ni se borra.
- **Eventos para n8n:** `requisicion.pend_director` y `pend_presidencia` traen `aprobadores: [{nombre, email}]`. Nuevo: `requisicion.sin_aprobador`.
- Corregida la doble barra de desplazamiento: el documento ya no se desplaza; solo el área de contenido.

## Prueba mínima
1. Abre una requisición que estaba pendiente antes de actualizar: debe seguir aprobable por el mismo director (regla de transición).
2. Crea Dirección X (Aprueba) → Gerencia Y. Asigna un gerente a Y y un director a X. El gerente solicita en Y → el director recibe «Te toca» → aprueba.
3. En el detalle, «Aprobaciones» muestra «Gerencia Y › Dirección X (aprobó)». Cambia la dependencia de Y: la foto no cambia.
4. Intenta que X dependa de Y: debe rechazarse por ciclo.
