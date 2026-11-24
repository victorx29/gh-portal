# Actualización 0.9.5.2 — Menú «Selección», botones por su lugar y fase visual 2 (Requisiciones y Selección)

Se aplica sobre la **0.9.5.1**. Sin migración, sin dependencias ni variables nuevas, sin cambios en n8n. Agrega una vista
(`seleccion_bandeja.ejs`) y una consulta de solo lectura (la bandeja). Los formularios conservan los mismos campos, nombres y
rutas que en la 0.9.5.1: cambia cómo se ven y dónde están, no qué guardan.

## Pasos

1. Copia los archivos (zip de actualización), `git push` y redespliega. No hace falta respaldo de base por esta versión.
2. **Recarga sin caché** (Ctrl + F5): el CSS cambió.
3. Entra como GH: el menú tiene **«Selección»** entre Pipeline y Organigrama.

## Qué cambia

**1. Menú «Selección» y bandeja de selección** (solo GH)

- Muestra una caja por cada requisición que está en Selección, ordenadas por antigüedad:
  - código y **días en selección** (desde que entró a la etapa, según el historial);
  - cargo, razón social y unidad;
  - **barra de ingresos frente a plazas** («0 de 2»);
  - chips: candidatos activos, «IA n de N» (análisis listos), lecturas o análisis **en curso** (con la «O» pequeña) y
    candidatos **con alertas** por revisar;
  - cuántos candidatos hay en cada etapa.
- Botones: «Resumen general» (abre el modal del resumen) y «Abrir tablero».
- El tablero marca «Selección» en el menú y su botón «← Selección» vuelve a la bandeja (antes volvía al pipeline).
- Gerentes, directores y Presidencia no ven el menú; si escriben la dirección, reciben 403.

**2. Botones por su lugar**, como en la previa y con reglas comunes del CSS (no marqué botón por botón):

- en la fila de acciones del encabezado de una página → **secundario** (azul suave);
- dentro de una caja, una fila de acciones, los filtros o una sección de formulario → **secundario**;
- en las acciones de una tabla → secundario compacto;
- «Cancelar» / «Cerrar» en una fila de acciones y «Limpiar» de los filtros → **discreto** (solo texto);
- el **principal** sigue siendo uno por grupo, azul sólido. Un botón que ya tenía su papel lo conserva.

Esto se nota en todo el portal, no solo en las pantallas de esta fase: por ejemplo, «Aplicar» de los filtros, «Comentar»,
«Subir» o «Registrar» pasan de blanco con borde a azul suave.

**3. Fase visual 2: Requisiciones y Selección en cajas y secciones**

- **Formulario de requisición:** 6 secciones numeradas (Cargo · una plaza por requisición, Requisitos, Contratación, Equipos
  requeridos, Accesos y correo, Justificación) y la barra de acciones al pie.
- **Detalle de requisición:**
  - «Datos de la requisición» en su caja;
  - **«Tu decisión»** en una caja con borde ámbar para quien aprueba (Aprobar, Devolver, Rechazar);
  - registro de la etapa en su caja;
  - barra de acciones al pie (Editar, Enviar, Pasar a…, Abrir tablero), que no aparece si el usuario no tiene ninguna;
  - «Cancelar la requisición» dentro de un desplegable, con su motivo, para que no quede al lado del botón principal.
- **Ficha del candidato**, en cajas y en el orden en que GH trabaja:
  1. Datos del candidato (con «Otras postulaciones» y «Editar datos», que viene abierto si el nombre es provisional o falta la
     cédula);
  2. Lectura del CV (con chip de alertas);
  3. CV y consentimiento (con chip de estado);
  4. Análisis con IA (puntaje en la cabecera; el botón «Analizar» queda al final, después del resultado);
  5. Datos adicionales (se ven sin abrir nada; «Editar datos adicionales» en un desplegable);
  6. Ingreso (en caja ámbar mientras está por confirmar);
  7. registro de la etapa;
  8. **«Decisión sobre la candidatura»** (caja ámbar): «Avanzar a …» y, en un desplegable, «Rechazar la candidatura» con el
     **motivo obligatorio** en el formulario (antes lo exigía solo el servidor).
- **Nuevo candidato:** secciones Identificación, Contacto y Datos adicionales.
- **Cargar CV:** secciones Archivos y Consentimiento.
- **Resumen general:** el comparativo y el resumen de la IA, cada uno en su caja.

## Archivos que cambian

| Archivo | Cambio |
|---|---|
| `src/services/seleccion.js` | Nuevo `bandeja(u)`: solo GH, solo lectura, dos consultas (más el pipeline de cada empresa, con caché). |
| `src/controllers/seleccion.js` | Ruta `GET /seleccion`; el tablero marca «Selección» en el menú. |
| `src/views/seleccion_bandeja.ejs` | Nueva: la bandeja. |
| `src/views/partials/head.ejs` | «Selección» en el menú (solo GH). |
| `src/icons.js` | Icono «seleccion». |
| `src/views/req_form.ejs`, `req_detalle.ejs`, `partials/registro.ejs` | Secciones y cajas (mismos campos y acciones). |
| `src/views/cand_detalle.ejs`, `cand_form.ejs`, `cv_lote.ejs`, `resumen.ejs`, `seleccion.ejs` | Cajas y secciones (mismos campos y acciones); «← Selección». |
| `public/css/app.css` | Bandeja, barra de avance, papel de los botones por lugar, cajas en modales, caja de decisión. |
| `DESIGN.md` | Papel del botón por lugar, barra de acciones, cajas en modales, caja de decisión, bandeja, barra de avance, icono. |
| `package.json` | Versión 0.9.5.2. |

## Pruebas críticas (las que te tocan, en tu navegador después de desplegar)

1. **BAN-01 a 03:** entra a «Selección», revisa que la caja de cada requisición tenga sus números y abre el tablero y el
   resumen desde ahí. En el tablero, «← Selección» vuelve.
2. **BAN-04:** entra con un usuario gerente o director: no ve «Selección».
3. **VIS-08 a 10:** abre un candidato: revisa el orden de las cajas, guarda un dato, avanza uno de prueba y rechaza otro (prueba
   primero sin motivo).
4. **VIS-12 y 13:** crea una requisición de prueba como gerente (las secciones que dependen del tipo deben aparecer y
   ocultarse) y apruébala como director desde «Tu decisión».
5. **VIS-07:** recorre en claro y oscuro las pantallas que más usas y mándame captura si un botón quedó con un papel que no
   corresponde: lo ajusto en la regla, no botón por botón.

## Revisión de código

- **Corregido antes de entregar:**
  - [Seguro] La bandeja leía el historial una vez por requisición para calcular los días en selección; ahora lo lee una sola
    vez para todas.
  - [Seguro] El chip «5 candidatos activos» de la bandeja usaba la variante `.n`, que también es el círculo numerado de 24 px, y
    el texto se desbordaba. Ahora usa el chip normal; DESIGN.md aclara que `.n` es solo para conteos cortos.
  - [Seguro] La barra de acciones vacía del detalle de requisición dibujaba una línea suelta para el director; ya no se dibuja si
    no hay acciones.
- **Ordenado de paso:** nada fuera de las vistas que esta fase reorganiza.
- **Visto y no tocado:**
  - [Después · Seguro] La cabecera del detalle de requisición muestra el estado técnico («seleccion», «pendiente director») en
    vez del nombre de la etapa del pipeline («Selección»). Viene de antes; propuesto para la próxima entrega.
  - [Después · Probable] El historial no tiene índice por `(entidad, entidad_id)`. Hoy no se nota; cuando crezca, lo sentirán
    el detalle, la línea de tiempo y la bandeja. Una migración de una línea para la versión de estabilización.
  - [Después · Seguro] Sigue el aviso de pg por consultas en paralelo sobre la misma transacción en `requisiciones.js`
    (`detalleEvento`), ya anotado en ESTADO.md. No actualizar pg a la 9 antes de corregirlo.
- **No se pudo verificar:**
  - EasyPanel, Safari, impresión y tu caché.
  - Confirmar un ingreso desde la ficha nueva (VIS-09): el formulario es el mismo de antes dentro de una caja, con los mismos
    campos (lo comprobé comparando las vistas), pero no lo envié en el navegador.
  - La prueba de reubicar (0.9.1) no encontró su base ficticia original; da el mismo resultado con el código 0.9.5.1 y el
    0.9.5.2, y esta entrega no toca empleados.
  - Lo que sí corrió: 24 pruebas de pantalla con GH, gerente y director (PostgreSQL 16, n8n simulado), regresión de servicios
    0.9.5 (11/11), 0.9.4 (15/15), 0.9.3 (14/14), 0.9.2 (13/13) y concurrencia del historial, instalación desde cero (20
    migraciones), y 12 pantallas y modales en claro, oscuro y móvil sin errores de consola.

## Documentos actualizados

- `DESIGN.md`: papel del botón por lugar, barra de acciones, cajas en modales, caja de decisión, bandeja, barra de avance,
  icono «Selección»; fase 2 sale de pendientes y entra el estado técnico de la requisición.
- `ESTADO.md`: versión, 0.9.5.2 en «Hecho», decisiones del 24-11-2026 y pendientes técnicos.
- `PRUEBAS.md`: BAN-01 a 05, VIS-07 a 14 y el registro de la ejecución.
- `UPDATE_0.9.5.2.md`: este documento.
- Sin cambios: `README.md` (no cambian la arquitectura, la instalación ni las variables). Las decisiones de esta versión quedaron
  en ESTADO.md, como en las anteriores.
