# Actualización 0.9.1 — Reubicar a un empleado en otra plaza

Se aplica sobre la **0.9.0**. Sirve para corregir a las personas que la importación del Listado dejó en la plaza
equivocada (por ejemplo, una Analista de Calidad de Software que quedó como «Analista de Software» bajo la Dirección)
y para registrar traslados reales. Trae una migración (016). No agrega dependencias ni variables de entorno.

## Pasos

1. **Respaldo completo de la base** en EasyPanel. Es obligatorio. Hoy no tienes punto de retorno: la importación
   de la 0.9.0 se aplicó sin respaldo y no se deshace con `npm run limpiar`. Guarda el archivo fuera del servidor.
2. Copia los archivos (zip de actualización), `git push` y redespliega. El log debe decir `migrada 016_reubicar.sql`.
3. Corrige los casos (GH), uno por uno: **Empleados** › busca a la persona › ficha › **Reubicar en otra plaza**.
   También desde **Configuración › Plazas por regularizar**: cada fila con ocupante tiene **Reubicar**.
4. Después de cada corrección, revisa el organigrama de esa dirección (Personas): la persona debe salir solo en su
   plaza correcta, y el ⚑ de su plaza anterior debe desaparecer.
5. Si un puesto creado por la importación (por ejemplo, «Analista de Software» en la Dirección) queda sin plazas
   abiertas, desactívalo en Plantilla. No se hace solo.

## Qué cambia

**Reubicar en otra plaza** (solo Gestión Humana). Tiene tres pasos: formulario, «Revisar» (no guarda nada) y «Reubicar»
(con confirmación). Puede ser de dos tipos:

- **Corrección:** la persona quedó en la plaza equivocada.
  - Conserva su fecha de ingreso, su supervisor (si eliges «Mantener») y los datos del Listado.
  - Toma el cargo del perfil de la plaza correcta.
  - La relación anterior queda «Corregida»: no cuenta como movimiento y no aparece en el organigrama en ninguna fecha.
  - Si la plaza correcta está ocupada, se **intercambian** las dos personas. Es el caso típico de dos analistas del mismo
    cargo que la importación cruzó entre unidades. La otra persona pasa a la plaza actual y conserva su supervisor.
- **Traslado:** un cambio real, con fecha.
  - Solo va a una plaza vacante.
  - La fecha es obligatoria, no puede ser futura y debe ser posterior al ingreso.
  - La relación anterior queda «Movido» hasta el día antes y la nueva empieza ese día.
  - El supervisor sugerido viene marcado.

**Reglas comunes:**

- **Plazas que se ofrecen como destino:** solo vigentes, sin congelar, autorizadas (no «por regularizar»), sin
  requisición abierta y sin nadie por ingresar. Si la plaza correcta no existe, primero créala o mueve su puesto en
  Plantilla.
- **Plaza anterior:** si era «por regularizar» y queda vacía, **se cierra sola** con motivo y sale de «Plazas por
  regularizar». Si era autorizada, queda vacante.
- **Empresa:**
  - Una plaza «Por definir» toma la empresa de la persona (aviso informativo).
  - Una plaza de otra empresa avisa el cambio antes de confirmar. Si la empresa correcta es la de la persona, cambia
    primero la empresa de la plaza.
- **Supervisor inmediato:** mantener el actual, el sugerido o ninguno. El sugerido es quien ocupa el puesto al que
  reporta la plaza destino, cuando es una sola persona.
- **Historial:** queda todo («reubicar», «reubicado» y el cierre automático de la plaza).
- **Ficha:** la trayectoria muestra «Corregida» o «Movido a otra plaza» y, en la relación nueva, «Corrección desde la
  plaza …» o «Traslado desde la plaza …».
- **Reimportar el Listado:** volver a subirlo no deshace una corrección. La persona sale como aviso «ocupa otra plaza o
  cargo».

**No cambia:** las reglas de ingreso, egreso, regularización, congelamiento y la importación. No se envía evento a n8n
por una reubicación (TI no recibe aviso de un traslado; ver «Propuestas»).

## Archivos que cambian

| Archivo | Cambio |
|---|---|
| `db/migrations/016_reubicar.sql` | Nuevo. Estado «corregida», origen «traslado», columnas `reubicada_desde` y `tipo_reubicacion`. |
| `src/services/empleados.js` | Reubicar: opciones, revisar y aplicar. Estado «Corregida». |
| `src/controllers/empleados.js` | Rutas `/empleados/relacion/:id/reubicar` (formulario, revisar, aplicar). Solo GH. |
| `src/views/empleado_reubicar.ejs` | Nuevo: formulario y pantalla «Revisar reubicación». |
| `src/views/empleado_ficha.ejs` | Botón «Reubicar en otra plaza»; datos de la reubicación; «Hasta» en lugar de «Egreso» para una relación movida. |
| `src/views/por_regularizar.ejs` | El ocupante abre su ficha; botón «Reubicar». |
| `src/views/empleados.ejs` | Etiqueta del estado «Corregida». |
| `src/services/plantilla.js` | `porRegularizar` devuelve también el ocupante (id de ficha y de relación). |
| `scripts/limpiar.js` | Se detiene si un traslado depende de un ingreso de selección (evita dejar datos huérfanos). |
| `package.json` | Versión 0.9.1. |

## Migraciones

- **016_reubicar.sql:**
  - Amplía dos restricciones de `relacion_laboral`: estado «corregida» y origen «traslado».
  - Agrega `reubicada_desde` y `tipo_reubicacion`, con índice.
  - Actualiza el disparador que impide modificar relaciones cerradas para que incluya «corregida».
- **Reversible:** solo mientras no se haya reubicado a nadie. Después, volver a la 0.9.0 exige restaurar el respaldo
  del paso 1.

## Pruebas críticas (las que te tocan)

Con datos ficticios en una copia, o directamente con los casos reales si ya tienes el respaldo:

1. **REU-02, REU-03 y REU-04 (caso Maria Yajure):**
   - Corrección a la plaza vacante de Analista de Calidad de Software bajo la Gerencia de Automatización de Procesos.
   - Su plaza «por regularizar» se cierra sola y sale de «Plazas por regularizar».
   - En el organigrama de Tecnología aparece solo bajo esa gerencia.
2. **REU-05:** si dos personas del mismo cargo quedaron cruzadas, haz una corrección hacia la plaza ocupada y verifica
   el intercambio.
3. **REU-01:** con un usuario gerente, abre `/empleados/relacion/1/reubicar` por URL: debe dar 403.
4. **INS-02:** el log de EasyPanel muestra solo `migrada 016_reubicar.sql`.
5. **ORG-01:** imprime o guarda en PDF el organigrama de Tecnología después de las correcciones.

## Revisión de código

- **Corregido antes de entregar:**
  - Al aplicar, las plazas se bloqueaban después de leerlas. Ahora se bloquean primero (evita que otro ingreso entre
    en la misma plaza durante la operación).
  - La fecha de fin de la relación anterior se calculaba en la vista. Ahora la calcula el servicio, que es el mismo
    valor que se guarda.
- **Ordenado de paso:**
  - La consulta «¿la plaza estuvo ocupada después de esa fecha?» estaba repetida. Ahora es una sola función,
    `ocupadaDesde`, en `empleados.js`.
  - Se quitó un valor calculado que no se usaba.
- **Visto y no tocado:**
  - [Después] El organigrama en una fecha pasada solo muestra plazas creadas antes de esa fecha (`creado_en`). Como la
    plantilla y las plazas «por regularizar» se crearon al cargarlas (19-11-2026 y el día de la importación), el organigrama anterior sale
    vacío aunque las personas tengan fecha de ingreso antigua. Es el comportamiento de la 0.7 («la plaza no existía en
    el plan»). [Seguro]
  - [Después] `limpiar -- transacciones` se detiene en cuanto hay un traslado de una persona importada (regla de la
    0.8.0 para movimientos reales). Se conserva. [Seguro]
- **No se pudo verificar:**
  - La base real de EasyPanel: no llegó el volcado. Se probó con una estructura de Tecnología y un Listado ficticios,
    cargados con el código 0.9.0.
  - Despliegue en EasyPanel y Safari.

## Propuestas (sin aplicar; esperan tu visto bueno)

- Evento `empleado.trasladado` a n8n para que TI ajuste accesos y equipos en un traslado (no en una corrección).
- Desactivar solo el puesto creado por la importación cuando se queda sin plazas abiertas.

## Documentos actualizados

- `ESTADO.md`: versión, 0.9.1 en «Hecho», pendiente 0.9.2, decisiones del 23-11-2026, plan.
- `PRUEBAS.md`: REU-01 a REU-10 y el registro de ejecución de la 0.9.1.
- `UPDATE_0.9.1.md`: este documento.
- Sin cambios: `README.md` (no cambian arquitectura, instalación ni variables), `DESIGN.md` (solo componentes
  existentes: formularios, `fieldset`, `.flash`, `.kv`, botones y confirmación). `DECISIONES.md` no existe en el repo:
  las decisiones siguen en `ESTADO.md`.
