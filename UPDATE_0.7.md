# Actualización 0.7 — Puestos y plazas (plantilla autorizada)

Se aplica sobre la **0.6.4**. Trae una migración nueva (007) y no agrega dependencias.

## Pasos
1. **Backup de la base de datos.**
2. Copia los archivos, `git push` y redespliega. El log debe decir `migrada 007_puestos_plazas.sql`.
3. Configuración › **Plantilla de puestos** › Descargar Excel. Completa la plantilla con tu listado y súbela en Carga masiva.
   - Los perfiles de cada puesto deben existir: cárgalos antes en Gestión de cargos.

## Conceptos
- **Puesto** = un perfil (GH-PF) dentro de una unidad. Un puesto por unidad puede ser el **jefe** (★).
- **Plaza** = cada posición autorizada del puesto. La plaza tiene:
  - **empresa de nómina**: la empresa vive en la plaza, no en la unidad; una unidad corporativa puede tener plazas de varias empresas;
  - **modalidad**: nómina propia, outsourcing, pasante, becario o aprendiz. Las externas se cuentan aparte del HC;
  - **estado de plan**, calculado a cualquier fecha:
    - **vigente**;
    - **congelada**: autorizada, pero no se cubre por ahora, y no suma al HC;
    - **proyectada**: con fecha de inicio futura; pasa sola a vigente ese día;
    - **cerrada**: queda en el historial.
- **HC** = plazas de nómina propia vigentes. Ocupadas y vacantes llegan en la 0.8, con los empleados.
- **Reporta a:**
  - regla por defecto: cada puesto reporta al jefe de su unidad, y el jefe, al jefe de la unidad superior más cercana que tenga jefe;
  - las excepciones (como el Analista que reporta al Especialista) se registran aparte;
  - el sistema impide ciclos.
- Nada se borra: los puestos se desactivan (solo sin plazas abiertas) y las plazas se cierran con fecha y motivo. La base de datos lo impide aunque se intente por fuera del portal.

## Qué cambia
- **Configuración › Plantilla de puestos:**
  - filtros por unidad (incluye dependientes), empresa de nómina, modalidad y fecha (pasada o futura, para ver lo proyectado);
  - indicadores de HC, congeladas, proyectadas, outsourcing y pasantes, becarios y aprendices;
  - modal del puesto para ver y gestionar sus plazas (congelar, descongelar o cerrar, siempre con motivo), agregar plazas, cambiar el jefe o la línea de reporte, consultar el historial y desactivar.
- **Carga masiva de plantilla** por Excel:
  - una fila por puesto y grupo de plazas (empresa + modalidad);
  - la vista previa muestra lo que se abre, se cierra, se congela o se proyecta;
  - errores por fila (bloquean) y advertencias (no bloquean), como una plaza de una empresa que la unidad no atiende;
  - **lo que el archivo dice de un puesto queda así**: si pones menos plazas, las sobrantes se cierran con fecha de hoy; si borras «Reporta a», el puesto vuelve a la regla por defecto. Los puestos que no están en el archivo no se tocan.
- **Diagrama › Ver: Cargos.** Es el organigrama de cargos de los PDF: puestos con su número de plazas, ★ para el jefe, ❄ para las congeladas, ⏳ para las proyectadas y las plazas por empresa.
  - El filtro de empresas se aplica a la empresa de cada plaza: al filtrar CORMAX aparece el puesto de Tecnología con plazas de CORMAX, aunque Tecnología sea corporativa.
- **Diagrama › Ver: Unidades** y **árbol de estructura**: cada unidad muestra su HC («HC 5 · ❄1 · ⏳2 · +1 ext.»). Al filtrar por empresa, una unidad también entra si tiene plazas de esa empresa.
- **Detalle de unidad:** nueva sección «Puestos y plazas», con acceso directo a su plantilla y a «Agregar puesto».
- **Código:** los ayudantes de acciones y de subida de Excel, y la vista previa de carga, pasan a ser componentes compartidos (también los usa Perfiles).

## Limitaciones conocidas
- El estado «congelada» es el actual: al consultar una fecha pasada, la plaza se ve con su congelamiento de hoy. El historial del puesto sí guarda cuándo se congeló y descongeló.
- La requisición todavía no se liga a la plaza: llega en la 0.7.1.

## Pruebas críticas
1. Crea un puesto jefe en una unidad corporativa sin empresa: debe pedirte la empresa de nómina. Con empresa, se crea.
2. Crea un segundo puesto jefe en la misma unidad: debe rechazarse.
3. Crea un puesto que reporte a otro (excepción) e intenta lo contrario: debe rechazarse por ciclo.
4. Agrega 2 plazas con fecha futura: salen como proyectadas. Con «Plantilla al» en esa fecha, cuentan en el HC.
5. Congela y cierra plazas (piden motivo). Una plaza cerrada no se puede modificar.
6. Carga masiva: descarga el Excel, sube una plaza y baja otra, agrega un puesto y mete un error. La vista previa lo muestra; aplica y vuelve a subir el mismo archivo: «No hay nada que aplicar».
7. Diagrama › Ver: Cargos desde una unidad: los puestos cuelgan de su jefe y se ve la excepción de reporte.
8. Filtra por una empresa que solo tiene plazas en una unidad corporativa: esa unidad y su puesto aparecen.
