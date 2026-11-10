# Actualización 0.6.4 — Cascada por columnas y título según lo que se ve

Se aplica sobre la **0.6.3**. No tiene migraciones ni dependencias nuevas: copiar, `git push` y redesplegar.

## Qué cambia
- **Disposición «Cascada por columnas (cabe en una hoja)»:**
  - Presidencia y las direcciones quedan en horizontal (norma), y todo lo que cuelga de cada dirección baja en cascada con sangría, una columna por dirección;
  - las cajas de la cascada son más bajas (nombre y empresa); el tipo y el aprobador quedan en el tooltip;
  - con 55 unidades de prueba: horizontal 8.546 × 728 px; cascada 1.686 × 2.044 px.
- **Título según lo que estás viendo**, en pantalla, PDF e imagen:
  - ejemplos: «Estructura organizativa · Dirección de Contraloría · Direcciones y Gerencias» o «Estructura organizativa · Comercializadora Inter Mundial 2020, C.A + Multinacional de Vehiculos, C.A»;
  - con más de dos empresas, el título usa las siglas;
  - el subtítulo lleva la fecha de vigencia, el número de unidades y la disposición.
- **Impresión:** la hoja se orienta sola (horizontal si el diagrama es ancho, vertical si es alto, como la cascada) y siempre sale en **una sola página**. Se corrigió una página en blanco que salía al final.

## Pruebas críticas
1. Disposición «Cascada por columnas»: las direcciones van en fila y sus dependientes bajan en cascada.
2. Imprimir o PDF en cascada: una sola hoja, vertical, con título, fecha y leyenda.
3. Imprimir o PDF en horizontal: una sola hoja, horizontal.
4. Filtra CIM + MDV: el título muestra ambas razones sociales. Filtra desde Contraloría con solo Direcciones y Gerencias: el título lo dice.
5. Descarga la imagen: lleva el mismo título.
