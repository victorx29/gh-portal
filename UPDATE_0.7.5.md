# Actualización 0.7.5 — «Nuevo puesto» muestra los perfiles del área elegida

Se aplica sobre la **0.7.4**. No tiene migraciones ni dependencias: copiar, `git push` y redesplegar.

## Qué cambia
En Plantilla › **Nuevo puesto**, la lista de perfiles se filtra según la unidad elegida. Aparecen:
- los perfiles cuyo alcance es **esa unidad o una superior** (un perfil de la Dirección sirve en sus gerencias);
- los de una **empresa que la unidad atiende**, cuando el perfil no tiene unidades;
- los **generales**, marcados « · general».

Además:
- **«Mostrar perfiles de otras áreas»** permite elegir cualquier perfil, para colocar un cargo en un área que todavía no está en su alcance.
- Sin unidad elegida, la lista dice «Elige primero la unidad».
- El buscador del perfil sigue funcionando dentro de lo filtrado.
- Al abrir «Agregar puesto» desde una unidad, la lista ya viene filtrada por ella.

## Pruebas críticas
1. Nuevo puesto › elige una gerencia: salen sus perfiles, los de su dirección y los generales.
2. Elige otra unidad: la lista cambia. Un perfil que ya estaba elegido y no aplica se desmarca.
3. Marca «Mostrar perfiles de otras áreas»: aparecen todos.
4. Desde el detalle de una unidad, «Agregar puesto»: la lista ya viene filtrada.
