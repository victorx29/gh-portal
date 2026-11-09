# Actualización 0.6.1 — Diagrama visual de la estructura y razón social en todo el portal

Se aplica sobre la **0.6**. No tiene migraciones ni dependencias nuevas: copiar los archivos, `git push` y redesplegar.

## Qué cambia
- **Diagrama de estructura** (Configuración › Estructura › «Ver diagrama»):
  - cajas de arriba hacia abajo como los organigramas, con línea sólida para la jerarquía y punteada (con flecha) para la dependencia funcional;
  - **filtros:** toda la estructura, desde una unidad hacia abajo, una o varias empresas juntas (CIM + MDV muestran la administración compartida una sola vez), división y fecha;
  - con «Desde la unidad» también aparecen, con borde punteado, las unidades de fuera que dependen funcionalmente de ella; por ejemplo, desde Contraloría se ven las administraciones de los concesionarios;
  - **empresa en cada caja:** razón social si cabe; si no, siglas (con «+N» si son muchas); la razón social completa queda en el tooltip y en la leyenda;
  - cada caja muestra el tipo, el nombre, la empresa (propia, «Sirve a» o «Hereda») y quién aprueba; el borde es verde si aprueba con director y naranja si aprueba sin director;
  - las unidades con 4 o más dependientes sin hijos los apilan en vertical, como en los organigramas de Servicios y Repuestos;
  - zoom con rueda o botones, arrastre para moverse, teclado (flechas, + y −, 0 para ajustar) y clic en una caja para abrir la unidad;
  - **Imprimir o PDF** (horizontal, con título y fecha) e **Imagen** (PNG con título y fecha); el diagrama se ve sobre hoja blanca también en tema oscuro.
- **Razón social en todo el portal:** tablero, filtro de empresas, Pipelines, Selección, requisición, roles, perfiles, Excel y eventos. Las siglas se usan solo donde el espacio es corto.
- **Árbol:** una unidad sin empresas propias muestra «Hereda MDV, CIM» en lugar de «Corporativa».

## Pruebas críticas
1. Abre «Ver diagrama»: aparece toda la estructura, sin errores.
2. Elige CIM y MDV en Empresas: aparece la Gerencia de Administración compartida una sola vez, con sus jefaturas.
3. «Desde la unidad» = Dirección de Contraloría: aparecen sus dependientes y, con borde punteado, las administraciones de los concesionarios.
4. Clic en una caja: abre el detalle de la unidad. Arrastrar y hacer zoom funcionan.
5. «Imprimir o PDF»: hoja horizontal con título, fecha y diagrama completo. «Imagen»: se descarga un PNG.
6. Pipelines, el tablero y el formulario de requisición muestran la razón social, no el nombre comercial.
