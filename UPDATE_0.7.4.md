# Actualización 0.7.4 — Filtro de perfiles por alcance (área)

Se aplica sobre la **0.7.3**. No tiene migraciones ni dependencias: copiar, `git push` y redesplegar.

## Qué cambia
Gestión de cargos › nuevo filtro **«Alcance (área)»**, en escalera y con buscador:
- **Una unidad:** los perfiles cuyo alcance es esa unidad. Con «Incluir las unidades que dependen de ella» (marcada por defecto) también salen los de sus gerencias, jefaturas y coordinaciones. Los perfiles generales no aparecen aquí.
- **General:** los que ven todas las áreas.
- **Sin alcance:** los que nadie puede elegir al solicitar (no son generales ni tienen empresas o unidades).

Se combina con los filtros que ya había: búsqueda, empresa, nivel y estado.

## Pruebas críticas
1. Filtra «Dirección de Finanzas» con la casilla marcada: salen sus perfiles y los de sus unidades dependientes.
2. Desmarca la casilla: quedan solo los de la Dirección.
3. «General» y «Sin alcance» muestran sus grupos.
4. Escribe parte del nombre de un área en el buscador del filtro: la lista se reduce, conservando sus superiores.
