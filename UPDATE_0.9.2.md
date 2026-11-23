# Actualización 0.9.2 — Reglas de plazas y egreso, y formularios que no te sacan de la vista

Se aplica sobre la **0.9.1**. Trae una migración (017). No agrega dependencias ni variables de entorno.

## Pasos

1. **Respaldo completo de la base** en EasyPanel, guardado fuera del servidor.
2. **Antes de desplegar, revisa si hay plazas congeladas con alguien adentro.** Desde la 0.9.2 eso ya no se puede crear, pero
   las que existan siguen así hasta que GH decida. En la consola de PostgreSQL de EasyPanel:
   ```sql
   select z.codigo, t.nombres from plaza z join relacion_laboral r on r.plaza_id=z.id and r.estado in ('activo','por_ingresar')
   join trabajador t on t.id=r.trabajador_id where z.congelada and (z.hasta is null or z.hasta > current_date);
   ```
   Si sale alguna, GH decide en cada caso: descongelarla o mover a la persona.
3. Copia los archivos (zip de actualización), `git push` y redespliega. El log debe decir `migrada 017_egreso_anulado.sql`.
4. En el portal (datos, sin código):
   - Desactiva el puesto «Analista de Software» de la Dirección de Tecnología: Plantilla › el puesto › «Desactivar puesto»,
     marcando «Fue creado por error», con motivo. Su plaza ya está cerrada.
   - Si el organigrama oficial no tiene las 2 plazas que sobran de Analista de Servicios Tecnológicos en la Gerencia de
     Tecnología, ciérralas con motivo desde «Acciones».
5. Prueba la «O» de carga y dame tu visto bueno final. Ya quedó escrita en DESIGN.md con lo que aprobaste en principio.

## Qué cambia

**Congelar solo plazas vacías** (decisión del 23-11-2026). Congelar significa que la plaza existe, pero no se autoriza usarla
ni pedir su requisición.

- Se rechaza congelar una plaza que tenga cualquiera de estas cosas:
  - una persona activa;
  - alguien por ingresar;
  - una requisición abierta;
  - el estado «por regularizar».
- El mensaje dice el motivo y el nombre de quien la ocupa.
- Lo mismo vale en la **carga masiva de plantilla**: si la columna «Congeladas» pide más plazas que las vacías, la fila da
  error y no se aplica nada.
- **No se confirma un ingreso en una plaza congelada.** Primero hay que descongelarla.

**Egreso:**

- **Confirmación por nombre.** Para registrar el egreso hay que escribir el nombre completo de la persona. No importan
  mayúsculas, acentos ni espacios de más.
- **Casilla «Congelar la plaza al quedar vacía».** Es opcional y pide el motivo. Aplica la misma regla de arriba: si la plaza
  tiene una requisición abierta (un reemplazo pedido con preaviso), se rechaza todo y no se registra nada.

**Anular egreso**, en la ficha, sobre la relación egresada. Solo GH, con motivo y confirmación por nombre.

- La relación egresada queda «Egreso anulado». Se abre otra activa en la misma plaza, con la misma fecha de ingreso, así
  que en el organigrama la persona nunca aparece fuera.
- Solo se puede anular si la plaza sigue libre: ni otra persona activa, ni alguien por ingresar, ni otra persona que la haya
  ocupado después, ni una requisición abierta.
- Si la plaza se congeló al egresar, se descongela sola, con motivo.
- n8n recibe el evento **`egreso.anulado`**, sin cédula, para que TI devuelva accesos y equipos. Hay que agregar ese tipo de
  evento al flujo de n8n que hoy atiende `egreso.registrado`.

**Puesto creado por error:**

- El organigrama y «Ver: Cargos» no dibujan un puesto cuyas plazas están todas cerradas. Un puesto que nunca tuvo plazas,
  como Presidente, se sigue viendo.
- «Desactivar puesto» tiene la casilla «Fue creado por error», que exige motivo. Queda marcado en el puesto y en el historial.
  Nada se borra.

**Interfaz.** Estas reglas quedaron en DESIGN.md:

- **Acciones en modal propio.** «Acciones» de cada plaza se abre en un segundo modal, completo, con un bloque por acción:
  congelar o descongelar, empresa, cerrar. Ya no se corta dentro de la tabla. «Regularizar» en «Plazas por regularizar»
  también se abre en un modal.
- **Volver a la misma vista.** Al guardar cualquier formulario, el portal vuelve a la página donde estabas, con los mismos
  filtros y el modal abierto. Esto aplica en Plantilla, Empleados, Por regularizar y el organigrama. Desde el diagrama:
  - en modo edición, vuelve al panel, como antes;
  - fuera de él, abre el modal sobre el mismo diagrama.

  También intenta volver a la misma altura de la página. Solo se aceptan direcciones internas del portal.
- **La «O» de carga.** Si guardar o abrir un modal tarda, aparece la «O» del logo girando con «Guardando…», encima de todo, y
  el botón queda deshabilitado para no enviar dos veces. Con «reducir movimiento» no gira.

## Archivos que cambian

| Archivo | Cambio |
|---|---|
| `db/migrations/017_egreso_anulado.sql` | Nuevo: estado «egreso_anulado» y sus datos; tipo «anulacion_egreso»; el disparador permite solo esa anulación; puesto con «creado por error», motivo y quién lo desactivó. |
| `src/services/plantilla.js` | Regla de congelar (manual y carga masiva); acciones de plaza; diagrama sin puestos con todas las plazas cerradas; desactivar con motivo. |
| `src/services/empleados.js` | Ingreso no en plaza congelada; egreso con nombre y casilla de congelar; anular egreso. |
| `src/controllers/plantilla.js` | Ruta `GET /config/plazas/:id/acciones`; desactivar recibe motivo. |
| `src/controllers/empleados.js` | Rutas `POST /empleados/relacion/:id/anular-egreso` y `GET /config/plazas/:id/regularizar`. |
| `src/views/plaza_acciones.ejs`, `src/views/plaza_regularizar.ejs` | Nuevos modales. |
| `src/views/puesto_detalle.ejs`, `src/views/por_regularizar.ejs` | Botones que abren los modales; «Desactivar puesto» con «creado por error». |
| `src/views/empleado_ficha.ejs`, `src/views/empleados.ejs` | Egreso con nombre y congelar; anular egreso; estado «Egreso anulado». |
| `src/views/partials/head.ejs`, `src/server.js`, `src/util.js` | Volver a la misma vista (`volverA`; `data-get` en las páginas abiertas con GET). |
| `public/js/app.js`, `public/css/app.css` | `_volver`, posición, «O» de carga. |
| `DESIGN.md` | «Acciones que cambian datos» e «Indicador de carga». |
| `package.json` | Versión 0.9.2. |

## Migraciones

- **017_egreso_anulado.sql:**
  - Amplía dos restricciones de `relacion_laboral`.
  - Agrega 3 columnas a `relacion_laboral` y 4 a `puesto`.
  - Reemplaza el disparador `relacion_cerrada`.
- **Reversible:** solo mientras no se haya anulado ningún egreso ni desactivado un puesto como «creado por error». Después,
  volver atrás exige restaurar el respaldo.

## Pruebas críticas (las que te tocan)

1. **CNG-01:** en un puesto con una plaza ocupada, «Acciones» explica que no se puede congelar. Congela y descongela una
   vacante.
2. **UI-06 y UI-07:**
   - En Plantilla, filtra por un texto, abre un puesto, entra a «Acciones» y guarda algo. Debes volver con el filtro puesto
     y el modal abierto.
   - Repite desde el diagrama «Ver: Cargos».
   - Revisa el modal en el teléfono.
3. **EGR-03 y EGR-04**, con un empleado de prueba, no uno real:
   - Registra el egreso con un nombre equivocado (se rechaza) y luego con el correcto.
   - Anúlalo y revisa en n8n que llegó `egreso.anulado`.
4. **PL-13:** desactiva «Analista de Software» como creado por error y revisa que desaparece del organigrama de Tecnología.
5. **INS-02:** el log muestra solo `migrada 017_egreso_anulado.sql`.

## Revisión de código

- **Corregido antes de entregar:**
  - La carga masiva podía congelar plazas ocupadas. Ahora aplica la misma regla y da error en la fila.
  - Desde el diagrama, fuera del modo edición, guardar te llevaba a Plantilla. Ahora vuelve al diagrama con el modal.
- **Ordenado de paso:**
  - La regla de congelar vive en un solo lugar (`congelarC` y `motivoNoCongelable`). La usan Plantilla, la carga masiva,
    el egreso y la anulación.
- **Visto y no tocado:**
  - [Ahora, propuesta] Cerrar una plaza ocupada, a mano o con la carga masiva (que cierra las sobrantes), hoy se permite y
    deja a la persona en una plaza cerrada. [Seguro] Propuesta: la misma regla que congelar. Espera tu visto bueno.
  - [Después] La carga masiva de plantilla sigue haciendo consultas en paralelo dentro de la transacción. Es el aviso de
    `pg` en el log, ya anotado para la estabilización.
- **No se pudo verificar:**
  - EasyPanel.
  - El envío real de `egreso.anulado` a n8n.
  - La restauración de la altura de la página.
  - El botón «Atrás» con la «O» puesta.
  - Anular con una requisición abierta (está en el código; no tiene prueba).
  - Safari.

## Documentos actualizados

- `ESTADO.md`: versión, 0.9.2 en «Hecho», pendientes de la 0.9.3, decisiones del 23-11-2026 y plan.
- `PRUEBAS.md`: CNG-01 a 03, EGR-03 a 05, PL-13, UI-06 a 08 y el registro de la ejecución.
- `DESIGN.md`: «Acciones que cambian datos» e «Indicador de carga».
- `UPDATE_0.9.2.md`: este documento.
- Sin cambios: `README.md`.
