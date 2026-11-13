# Actualización 0.7.9 — Modo edición del organigrama

Se aplica sobre la **0.7.8**. No tiene migraciones ni dependencias: copiar, `git push` y redesplegar.

## Qué cambia
- **Corrección:** en «Ver: Cargos», el clic en una caja abría la **unidad** con el mismo número interno, es decir, otra área. Ahora abre el **puesto**; en «Ver: Unidades» abre la unidad.
- **✎ Editar** (botón en la barra del diagrama, solo GH y en la fecha de hoy): el organigrama se arma **sin salir del diagrama**.
  - **Clic en una caja → panel lateral** con su ficha completa, la misma de siempre: plazas, jefe, mover, congelar, cerrar, dependencias, etc.
  - **Acciones rápidas** en el panel:
    - **Cargo (Ver: Cargos):** «+ Cargo que le reporta», «+ Plazas» y «Ficha del puesto».
    - **Unidad (Ver: Unidades):** «+ Unidad dependiente», «+ Puesto» y «Ficha de la unidad».
  - **«+ Cargo que le reporta»** trae la unidad elegida. Si quien queda arriba es el jefe de esa unidad, no crea excepción (la regla basta); si no, deja «Reporta a» ya puesto.
  - **«¿No existe el cargo? Créalo aquí»** en el formulario de puesto: nombre y nivel jerárquico. Se crea un perfil mínimo con alcance en la unidad («Sin descripción»), que se completa después en Gestión de cargos o importando su Word. Si ya existe un cargo con ese nombre, avisa y pide elegirlo de la lista.
  - **Al guardar, vuelves al mismo diagrama:** mismos filtros, **mismo zoom y posición**, y el panel muestra lo que acabas de crear o editar.
  - Los enlaces dentro del panel (por ejemplo, «Agregar puesto» en la ficha de una unidad) se abren en el mismo panel.
- El zoom y la posición del diagrama se recuerdan durante la sesión para cada combinación de filtros.

## Pendiente (siguiente entrega)
Arrastrar y soltar cajas para reorganizar, con «Deshacer» durante unos segundos antes de guardar.

## Pruebas críticas
1. Ver: Cargos, sin editar: clic en una caja → se abre ese puesto, no otra área.
2. ✎ Editar → clic en un gerente → «+ Cargo que le reporta» → «¿No existe el cargo?»: nombre, nivel, plazas y motivo → Crear. Vuelves al diagrama con el mismo zoom, y la caja nueva aparece en su fila y queda abierta en el panel.
3. Repite con el mismo nombre: avisa que ya existe.
4. Ver: Unidades + ✎ Editar → clic en una gerencia → «+ Unidad dependiente»: el superior ya viene elegido; crea y aparece en el diagrama.
5. En el panel de una unidad, «Agregar puesto» se abre en el panel, no en una ventana.
6. «✎ Editando · salir» vuelve a la vista normal.
