# Actualización 0.9.3 — Ficha completa al ingresar, campos personalizados, alta manual y conciliación

Se aplica sobre la **0.9.2**: despliégala y pruébala antes. Trae una migración (018). No agrega dependencias ni
variables de entorno.

## Pasos

1. **Respaldo completo de la base** en EasyPanel, guardado fuera del servidor.
2. Copia los archivos (zip de actualización), `git push` y redespliega. El log debe decir `migrada 018_ficha_campos.sql`.
3. Revisa los catálogos nuevos (superadmin):
   - **Configuración › Ubicaciones:** arranca con las sedes que trae el Listado importado. Corrige los nombres repetidos o mal
     escritos: desactiva el malo y deja el bueno.
   - **Configuración › Tipos de empleado:** trae los valores del Listado, más «Fijo» y «Contratado». Marca cuáles piden fecha de
     fin de contrato.
4. **Configuración › Campos personalizados** (GH): crea los que GH necesite, por ejemplo la talla del uniforme o la
   disponibilidad para viajar.
5. **n8n:** dos eventos nuevos.
   - `empleado.alta_manual`: TI decide si la persona necesita equipo o accesos.
   - `egreso.anulado`: si no lo agregaste con la 0.9.2.

   Los eventos de selección ya no incluyen los campos personalizados del candidato.
6. **Datos** (sin código), en este orden:
   - **Conciliación** (Configuración › Conciliación): revisa las sugerencias de las 64 plazas «por regularizar».
   - **Regularizar varias** (Plazas por regularizar): pasantes, becarios y aprendices, con un solo soporte. Antes, completa la
     descripción de esos perfiles.
   - **Alta manual** (Empleados › Alta manual): la Directora de Finanzas, cuando GH confirme qué empresa paga su nómina.

## Qué cambia

**Ficha completa al confirmar un ingreso.** Para confirmar, GH completa estos datos; sin ellos no se confirma:

- fecha de nacimiento;
- sexo;
- hijos (0 es válido);
- nivel académico (del catálogo «Grados de instrucción») y título;
- ubicación;
- tipo de empleado;
- fin de contrato, solo si el tipo lo pide (el navegador lo marca como obligatorio al elegir ese tipo);
- los campos personalizados obligatorios del empleado.

El candidato no da estos datos y la IA nunca los ve. Si la persona ya tenía ficha (un reingreso), los datos vienen precargados.

**Ficha incompleta y edición:**

- Cada empleado activo al que le falta un dato obligatorio lleva el chip «Ficha incompleta» en la lista y en su ficha. La ficha
  dice qué le falta, y en la lista hay un filtro «Solo fichas incompletas». Los importados aparecerán así hasta que GH los
  complete.
- «Editar ficha» (solo GH) corrige nombre, correo, teléfono, datos personales y laborales y campos personalizados. Se puede
  guardar a medias.
- El historial registra qué datos se tocaron, sin sus valores.

**Campos personalizados** (Configuración › Campos personalizados, solo GH):

- Tipos: texto, número, fecha, lista o sí/no.
- Aplican al candidato, al empleado o a ambos. Cada uno puede ser obligatorio o sensible (solo GH).
- Un campo no se borra: se desactiva y sus valores quedan guardados. El tipo no cambia y las opciones de una lista solo se
  agregan.
- En el candidato aparecen al agregarlo y en «Datos adicionales» de su ficha. En el empleado, al confirmar el ingreso, en el
  alta manual y en «Editar ficha».
- Nunca viajan a la IA ni a n8n.

**Alta manual** (Empleados › Alta manual, solo GH):

- Para quien ya trabaja y no está en el portal. Todo ingreso nuevo de personal sigue entrando por requisición.
- Pide cédula, nombre, fecha real (no futura), quién la autorizó con su soporte, y la ficha completa.
- Va a una plaza vacante autorizada o, si no hay, crea una plaza «por regularizar» en el puesto elegido.
- Si la cédula ya tiene una relación activa, no se permite: hay que usar «Reubicar». Si es de alguien que egresó, se reutiliza
  su ficha.
- Si hay un error, el formulario vuelve con lo escrito.

**Escenarios del organigrama:**

- **Conciliación** (Configuración › Conciliación):
  - Lista a cada persona en una plaza «por regularizar» con hasta 3 plazas vacantes parecidas de su misma área (misma
    dirección o gerencia de primer nivel). El parecido se mide por el nombre del cargo, la empresa y la unidad.
  - «Corregir aquí» abre la revisión de Reubicar, ya llena. Al confirmar, vuelves a Conciliación.
  - Abajo, las vacantes que no le corresponden a nadie.
- **Regularizar varias:** casillas en «Plazas por regularizar», «marcar todas» y un solo soporte. Se regularizan las que cumplen
  y se informan las que no (perfil sin descripción).
- **Reubicar a una plaza de otra empresa:** la casilla «La plaza toma la empresa de la persona» cambia la empresa de la plaza,
  con motivo en su historial.
- **Importación del Listado:** si una persona de una empresa sin estructura propia entra a una unidad corporativa por una
  equivalencia general, la vista previa lo avisa.

**Solo se cierra una plaza vacía.** No se cierra con ocupante, con un ingreso en curso ni con una requisición abierta; el modal de
Acciones explica el motivo. La carga masiva cierra solo plazas vacías y da error en la fila si no alcanzan.

**Interfaz:**

- La «O» con «Cargando…» aparece al cambiar de página, si tarda más de 300 ms. No aparece en descargas (Excel, CV, adjuntos) ni
  en pestañas nuevas.
- La leyenda del organigrama explica ⚑ y el borde naranja punteado.
- Después de confirmar un ingreso, o si falla, vuelves a la ficha del candidato.

## Archivos que cambian

| Archivo | Cambio |
|---|---|
| `db/migrations/018_ficha_campos.sql` | Nuevo: catálogos `ubicacion` y `tipo_empleado` (llenos con el Listado), `campo_personalizado`, `campos` en candidato y trabajador. |
| `src/services/ficha.js` | Nuevo: datos obligatorios de la ficha, catálogos, campos personalizados, «Editar ficha». |
| `src/services/empleados.js` | Confirmar ingreso con ficha; «Ficha incompleta»; alta manual; conciliación; Reubicar con empresa de la persona. |
| `src/services/seleccion.js` | Campos personalizados del candidato; datos de la ficha para el ingreso; eventos sin campos personalizados. |
| `src/services/plantilla.js` | Solo se cierra una plaza vacía (manual y carga masiva); regularizar varias. |
| `src/services/importar_empleados.js` | Aviso por equivalencia general de una empresa sin estructura. |
| `src/controllers/empleados.js` | Rutas: alta manual, editar ficha, campos personalizados, conciliación, regularizar varias. |
| `src/controllers/seleccion.js`, `src/controllers/config.js` | Campos del candidato; volver a la ficha del candidato; catálogos nuevos. |
| `src/confignav.js` | Conciliación, Campos personalizados, Ubicaciones y Tipos de empleado. |
| Vistas nuevas | `empleado_alta`, `empleado_editar`, `config_campos`, `campo_form`, `conciliacion`; parciales `ficha_form`, `campos_form`, `campo_campos`. |
| Vistas modificadas | `cand_detalle`, `cand_form`, `empleado_ficha`, `empleados`, `por_regularizar`, `plaza_acciones`, `empleado_reubicar`, `maestros`, `organigrama`. |
| `public/js/app.js` | «O» al navegar; fin de contrato obligatorio según el tipo; marcar todas. |
| `package.json` | Versión 0.9.3. |

## Migraciones

- **018_ficha_campos.sql:** crea tres tablas y agrega una columna `campos` a `candidato` y `trabajador`. No modifica datos
  existentes, salvo llenar los catálogos.
- **Reversible:** antes de usar la 0.9.3, sí. Después, los campos personalizados y los catálogos quedan referidos por las fichas:
  volver atrás exige restaurar el respaldo.

## Pruebas críticas (las que te tocan, en tu navegador después de desplegar)

1. **FIC-01 y CPE-02:**
   - Lleva un candidato de prueba hasta Ingreso.
   - Intenta confirmar sin completar la ficha: se rechaza.
   - Elige «Contratado» sin fin de contrato: el navegador lo pide.
   - Confirma con todo completo.
2. **FIC-03:** filtra «Solo fichas incompletas», abre un importado, completa un dato con «Editar ficha» y revisa el chip.
3. **ALT-01:** registra a una persona de prueba en una plaza vacante y otra sin plaza vacante, que debe quedar «por regularizar».
4. **CNC-01 y CNC-02:** en Conciliación, corrige un caso con «Corregir aquí». En Plazas por regularizar, regulariza dos de prueba
   a la vez.
5. **PL-14:** en Acciones de una plaza ocupada, comprueba que no deja cerrarla.
6. **UI-09:** navega entre Empleados y Configuración: la «O» aparece si tarda. Descarga un Excel: no aparece.
7. **INS-02:** el log muestra solo `migrada 018_ficha_campos.sql`.

## Revisión de código

- **Corregido antes de entregar:**
  - Los eventos de selección mandaban a n8n todos los datos del candidato, y ahora habrían incluido los campos personalizados.
    Ahora se quitan. [Seguro]
  - Un error al confirmar un ingreso cerraba la ficha del candidato y se perdía el formulario. Ahora vuelve a la ficha y el
    navegador valida el fin de contrato antes de enviar.
  - «Editar ficha» no dejaba guardar a medias porque marcaba como obligatorios los campos personalizados.
- **Ordenado de paso:** la ficha y los campos personalizados viven en un solo servicio (`ficha.js`). Los usan el ingreso, el
  alta manual y la edición.
- **Visto y no tocado:**
  - [Ahora, propuesta] Los eventos de selección siguen llevando la cédula y el teléfono del candidato (diagnóstico del
    19-11-2026). Propuesta para la estabilización: enviar solo nombre, correo e identificador.
  - [Después] Si el servidor rechaza la confirmación del ingreso, los datos escritos se pierden. Hoy solo pasa con reglas que el
    navegador no valida, como una ubicación desactivada mientras GH llenaba el formulario. [Probable]
  - [Después] Conciliación toma como «área» la unidad de primer nivel. Los concesionarios comparten la Dirección de División
    Automotriz, así que una sugerencia puede ser de otro concesionario. El puntaje por empresa lo atenúa. [Probable]
  - [Después] «Regularizar varias» aplica plaza por plaza, no todo o nada, para no bloquear a las que cumplen.
- **No se pudo verificar:**
  - EasyPanel.
  - n8n real.
  - Safari.
  - La «O» con «Atrás» del navegador.
  - Las pruebas en tu Chrome: el portal real tiene la 0.9.1 o la 0.9.2 hasta que despliegues. Lo probé en Chromium aislado con
    PostgreSQL 16.

## Documentos actualizados

- `ESTADO.md`: versión, 0.9.3 en «Hecho», pendientes, decisiones del 23-11-2026 y plan.
- `PRUEBAS.md`: FIC-01 a 03, CPE-01 a 03, ALT-01, CNC-01 a 04, PL-14, UI-09, ORG-04 y el registro de la ejecución.
- `UPDATE_0.9.3.md`: este documento.
- Sin cambios: `README.md` (no cambian la arquitectura, la instalación ni las variables) y `DESIGN.md` (solo componentes
  existentes: formularios, `fieldset`, chips, tablas, indicadores y la «O» de la 0.9.2).
