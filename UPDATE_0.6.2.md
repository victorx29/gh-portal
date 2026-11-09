# Actualización 0.6.2 — Listas de unidades en escalera con buscador

Se aplica sobre la **0.6.1**. No tiene migraciones ni dependencias nuevas: copiar, `git push` y redesplegar.

## Qué cambia
- Todas las listas de unidades se muestran en **escalera** (sangría por nivel y «└»): cambiar dependencia, dependencia funcional,
  nueva unidad, asignar rol, «Desde la unidad» del diagrama y el formulario de requisición.
- Ya no se repite el superior en cada línea, porque se ve por la posición. Cada línea muestra el nombre, las empresas en siglas
  («hereda …» si las hereda, «+N» si son muchas) y «✓ aprueba» cuando corresponde.
- **Buscador encima de cada lista:** filtra por nombre o código, sin importar los acentos, y conserva los superiores de cada coincidencia para no perder la escalera.
- En el formulario de requisición, la escalera del gerente empieza en su propia unidad.
- En Safari (Mac/iPhone), las opciones que no coinciden se ven en gris en lugar de ocultarse: Safari no permite ocultarlas.

## Pruebas críticas
1. En una unidad, abre «Cambiar dependencia»: la lista se ve en escalera.
2. Escribe «admin» en el buscador: quedan las unidades de administración con sus superiores. Al borrar el texto vuelven todas.
3. Busca por código (por ejemplo UO-0016): aparece esa unidad.
4. En Usuarios › Rol › Director, busca «gerencia general»: aparecen las gerencias generales con su escalera.
5. Como gerente, en «Nueva requisición», la lista de unidades empieza en tu unidad. Al cambiar de empresa se filtra como antes.
