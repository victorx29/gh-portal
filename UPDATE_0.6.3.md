# Actualización 0.6.3 — Diagrama: tipos a mostrar, disposición horizontal y pantalla completa

Se aplica sobre la **0.6.2**. No tiene migraciones ni dependencias nuevas: copiar, `git push` y redesplegar.

## Qué cambia
- **Tipos a mostrar:** casillas por tipo de unidad (Presidencia, Dirección, Gerencia, Jefatura, Coordinación…).
  - Si ocultas un tipo, sus dependientes no desaparecen: se conectan al superior visible más cercano con una línea gris discontinua, que indica que hay niveles ocultos entre ambas cajas.
  - Ejemplo: desmarca Jefatura y Coordinación para presentar solo direcciones y gerencias.
- **Disposición:** **Horizontal (norma)** por defecto o **Compacta (apilada)**, que apila en vertical las unidades con 4 o más dependientes sin hijos.
- **Pantalla completa:** botón en la barra del diagrama. Ocupa todo el monitor y mantiene el zoom, el arrastre y el clic en las cajas. Sales con el mismo botón o con Esc.
- Todos los filtros se combinan entre sí y se reflejan en el subtítulo, en la impresión y en la imagen.

## Pruebas críticas
1. Abre el diagrama: se ve en horizontal. Cambia a «Compacta» y aplica: se apilan las ramas largas.
2. En «Tipos a mostrar» deja solo Presidencia, Dirección y Gerencia: desaparecen jefaturas y coordinaciones.
3. Deja Jefatura marcada y quita Gerencia: las jefaturas cuelgan de su dirección con línea gris discontinua.
4. Pulsa «Pantalla completa»: el diagrama ocupa todo el monitor. Muévete, haz zoom y sal con Esc.
5. Imprime o descarga la imagen con un filtro de tipos: el subtítulo dice «Solo …».
