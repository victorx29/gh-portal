# DESIGN.md — Portal de Gestión Humana (Grupo APB)

Documenta el diseño **actual** del portal (versión 0.7.11, `public/css/app.css`). No es un rediseño: ordena
lo que ya existe para que toda pantalla nueva lo siga. Las secciones «Pendiente de decidir» y «Problemas
detectados» son propuestas: no se aplican hasta que Victor las apruebe.

**Regla de uso:** las pantallas usan las variables CSS (`var(--pr)`), nunca valores sueltos. Si algo nuevo
no está cubierto aquí, se propone agregarlo a este archivo antes de usarlo.

## Carácter

Herramienta de trabajo interna para Gestión Humana, gerentes y aprobadores: sobria, densa en información y
legible. Prioriza tablas, formularios y estados claros sobre lo decorativo. Un solo color de acción (azul),
colores de estado para avisos y nada más.

## Color

Tokens en `:root`. Tema claro y oscuro: el oscuro se activa por preferencia del sistema o con el botón del
menú (`data-theme`).

| Token | Claro | Oscuro | Función |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0f141b` | Fondo de página, tarjetas, campos y modales |
| `--sf` | `#f6f8fb` | `#161d27` | Superficie secundaria: columnas del tablero, hover de filas y botones, etiquetas |
| `--bd` | `#e3e8ef` | `#2a3442` | Bordes y líneas divisorias (decorativo, no transmite información) |
| `--tx` | `#111827` | `#e8ecf0` | Texto principal |
| `--mu` | `#5b6573` | `#9aa5b3` | Texto secundario: etiquetas, ayudas, encabezados de tabla, códigos |
| `--pr` | `#1d5fd1` | `#7aa7ff` | Color de acción: enlaces, foco, elemento activo, acentos |
| `--pl` | `#e8f0fd` | `#18253d` | Fondo suave del color de acción: navegación activa, chips, iconos de acceso |
| `--bt` | `#c9dcfb` | `#2b4a80` | Fondo del botón primario |
| `--on` | `#0d2a5c` | `#e8f0ff` | Texto sobre el botón primario |
| `--wa` | `#b36b00` | `#f0a63a` | Advertencia: texto e iconos |
| `--wl` | `#fdf0dc` | `#33260f` | Fondo de advertencia y de errores en avisos y filas |
| `--rd` | `#c0392b` | `#ef7b6e` | Error y peligro: texto, botón de acción irreversible |
| `--ok` | `#0f7a5c` | `#4cc79f` | Éxito: texto e iconos |
| `--okl` | `#e3f5ee` | `#10291f` | Fondo de éxito |

**Hoja blanca siempre:** el diagrama de estructura y la descripción de cargo imprimible usan fondo `#fff` y
texto oscuro también en tema oscuro, porque representan un documento.

**Colores de etapa del tablero** (borde superior de cada columna). Hoy están escritos directamente en el CSS
y en `diagrama.js`, fuera de los tokens:
gris `#9aa3ad` (sin etapa), azul `#1d5fd1` (aprobado, pendiente de director), azul claro `#3b82f6`
(publicación), celeste `#0ea5e9` (convocatoria, pendiente de Presidencia), índigo `#6366f1` (selección),
verde `#0f9d78` (ingreso), rojo `#c0392b` (cancelado, rechazado).

## Tipografía

- **Familia:** `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`. Inter no se carga desde el portal:
  se usa si el equipo la tiene instalada; si no, la fuente del sistema.
- **Base:** 14 px, interlineado 1.5. Números de códigos y conteos con cifras tabulares (`.cod`).
- **Escala en uso:**

| Uso | Tamaño | Peso |
|---|---|---|
| Título de página (`h1`) | 24 px, interletra −0.4 px | 700 |
| Marca del menú | 22 px | 700 |
| Indicador (`.kpi strong`) | 22 px | 700 |
| Título de modal | 18 px | 700 |
| Subtítulo de sección (`.h2s`) | 17 px | 700 |
| Encabezado de bloque (`h3`), tarjetas | 15 px / 14 px | 600–700 |
| Texto | 14 px | 400 |
| Secundario, migas, comentarios, pestañas de configuración | 13 px | 400 |
| Etiquetas de campo, chips, etiquetas, leyendas | 12 px | 400–500 |
| Tipo de unidad en el árbol (`.tchip`) | 11 px | 400 |

- Texto largo limitado a 80 caracteres por línea (`.sub`, `.pasos`).

## Espaciado

Base de 2 px en la práctica. Valores frecuentes: 4, 6, 8, 10, 12, 14, 16, 18, 22 y 26 px.
- Página (`main`): 22 px arriba, 26 px a los lados, 40 px abajo; en móvil, 16 px.
- Separación entre botones y elementos en fila: 8 px. Entre columnas de formulario: 14 px.
- Formularios: ancho máximo 720 px (`.form-max`); paneles 640 px; modales 760 px; confirmaciones 440 px.

## Forma y profundidad

- **Radios en uso:** 6 px (chips, etiquetas), 8 px (campos), 10 px (botones, navegación, avisos),
  12 px (tarjetas, árbol, paneles, `details`), 14 px (columnas del tablero, indicadores),
  16 px (modales, login), 999 px (pastillas de configuración).
- **Sombras:** solo en elementos flotantes. Aviso flotante `0 10px 30px #0003`; menú emergente
  `0 8px 24px #0002`. Fondo de modal `#0008`.
- Separación por bordes de 1 px (`--bd`), no por sombras.

## Componentes

**Botones** (`.btn`): alto mínimo 44 px, radio 10 px, padding 8 × 16 px, peso 500, icono opcional a la
izquierda con 8 px de separación.
- **Normal** (`.btn`): fondo `--bg`, borde `--bd`; hover `--sf`.
- **Primario** (`.btn.p`): fondo `--bt`, texto `--on`, peso 600. Uno por grupo de acciones: la acción
  principal.
- **Peligro suave** (`.btn.d`): texto `--rd`. Para enlaces a acciones destructivas (desactivar, eliminar).
- **Peligro** (`.btn.peligro`): fondo `--rd`, texto blanco. Solo en el botón de confirmar de una acción
  irreversible.
- **Foco:** contorno de 2 px `--pr` separado 2 px, en todos los elementos interactivos.
- No hay estado deshabilitado definido (ver Pendiente de decidir).

**Campos** (`input`, `select`, `textarea`): ancho completo, alto mínimo 44 px, padding 10 px, radio 8 px,
borde `--bd`. Etiqueta encima en 12 px `--mu`. Casillas con `.chk` (casilla a la izquierda, texto 14 px).
Agrupación con `fieldset` (radio 12 px, leyenda 12 px `--mu`). Formularios en dos columnas con `.g2`, que
pasan a una en móvil. Filtros en rejilla `.filtros` con el botón alineado abajo.

**Tablas:** ancho completo, celdas de 10 px, línea inferior `--bd`, encabezado `--mu` peso 500. Acciones a
la derecha (`td.acts`). Filas inactivas en `--mu` (`tr.off`); filas con error en fondo `--wl`. Tablas
anchas dentro de `.tw` con desplazamiento horizontal. En móvil, `table.mid` se convierte en tarjetas.

**Navegación:** menú lateral de 236 px (64 px colapsado) con marca, usuario y rol, enlaces de 44 px de alto
y radio 10 px; activo con fondo `--pl` y texto `--pr` en 600. En móvil pasa a barra horizontal desplazable.
Configuración usa pastillas (`.pill`) agrupadas y tarjetas de acceso (`.hub-i`). Migas (`.crumb`) en 13 px.
Pestañas (`.tab`) con la activa en `--pl`.

**Tarjetas del tablero** (`.card`): fondo `--bg`, borde `--bd` con borde izquierdo de 4 px, radio 12 px;
hover con borde `--pr`. Las propias del usuario llevan el borde izquierdo en `--wa`.

**Chips y etiquetas:** `.chip` (fondo `--pl`, texto `--pr`, 12 px, radio 6 px; variante advertencia
`.chip.w`); `.tag` (fondo `--sf`, texto `--mu`; variantes `.ok`, `.warn` y `.dot` punteada); `.tchip`
(borde, 11 px) para el tipo de unidad.

**Avisos:** `.flash` en línea (fondo `--pl`; error `--wl` con texto `--rd`; éxito `--okl` con `--ok`).
Flotantes (`.toast`) arriba a la derecha: el de éxito se cierra solo; el de error queda hasta cerrarlo.

**Confirmaciones:** modal propio con `data-confirm`, `data-ok` y `data-peligro`. El foco empieza en
«Cancelar» y Esc cancela. Nunca `confirm()` del navegador.

**Modales** (`dialog`): radio 16 px, padding 20 px, ancho hasta 760 px, alto hasta 90 % con desplazamiento
propio. Encabezado `.mh` con título y botón de cerrar.

**Indicadores** (`.kpi`): fila con borde y radio 14 px; etiqueta pequeña `--mu` y valor en 22 px.

**Estados vacíos** (`.empty`): texto `--mu` centrado dentro de un borde punteado.

**Historial** (`.log`): línea izquierda `--bd` y texto 13 px con fecha en `--mu`.

**Árbol de estructura:** guías verticales por nivel (22 px por nivel, 14 px en móvil); unidades inactivas
tachadas; nodos de contexto atenuados.

**Diagrama:** área de hoja blanca con zoom y arrastre, barra de herramientas, leyenda en 12 px, panel lateral
de edición (460 px, 42 % máximo) que en pantallas de menos de 900 px pasa debajo.

## Iconos

Un solo juego: iconos de trazo de 24 × 24 al estilo Lucide/Feather (licencia MIT), definidos en
`src/icons.js` y usados con `<%- ic('nombre') %>`. Tamaño 18 px (16 px en pastillas, 14 px en etiquetas),
trazo 1.8, color heredado del texto. Sin emojis como iconos de interfaz; los símbolos ★ ❄ ⏳ del diagrama son
marcas de estado documentadas en su leyenda.

## Adaptación

- **Móvil (hasta 760 px):** menú horizontal, formularios y filtros en una columna, tablas `mid` como
  tarjetas, menús emergentes en línea.
- **Pantallas medianas (hasta 900 px):** panel del diagrama debajo.
- **Áreas táctiles:** mínimo 44 px de alto en botones, navegación y campos.
- **Movimiento reducido:** se desactivan animaciones si el sistema lo pide.
- **Impresión:** se ocultan menú, avisos y barras; el diagrama y la descripción de cargo salen en hoja
  blanca.

## Problemas detectados (propuestas, sin aplicar)

1. **Contraste insuficiente en advertencias, tema claro.** Texto `--wa` sobre `--wl` da 3.7:1 (mínimo 4.5:1
   para texto de 12 px). Afecta a `.chip.w` y `.tag.warn`. Propuesta: oscurecer `--wa` en claro a un tono
   cercano a `#8f5600`.
2. **Contraste insuficiente del botón de peligro, tema oscuro.** Texto blanco sobre `--rd` oscuro da 2.7:1.
   Propuesta: en oscuro, texto `--bg` sobre `--rd`, o un `--rd` más oscuro solo para el fondo del botón.
3. **Colores de etapa fuera de los tokens.** Los siete colores del tablero y varios de `diagrama.js` están
   escritos directamente. Propuesta: tokens `--etapa-*` con valor en claro y en oscuro.
4. **Siete radios distintos.** Propuesta: reducir a cuatro (6, 10, 14 y 999 px) cuando se toquen esos
   componentes.
5. **Espaciado sin escala fija.** Propuesta: escala de 4 px (4, 8, 12, 16, 24, 32) para lo nuevo, sin
   reformatear lo existente.
6. **Inter no se carga.** La tipografía cambia según el equipo. Propuesta: aceptar la fuente del sistema
   como decisión, o servir Inter desde el propio portal (sin depender de servicios externos).

## Pendiente de decidir

- **Tamaño de texto base.** 14 px es habitual en herramientas administrativas densas; la recomendación
  general para lectura es 16 px. Mantener 14 px en el portal y usar 16 px en la futura web pública de
  vacantes.
- **Estado deshabilitado de botones y campos.** No existe; definirlo (opacidad, cursor, sin hover) antes de
  usarlo.
- **Identidad de marca.** El portal usa azul y la marca «GH»; el logotipo de APB usa azul y naranja. Decidir
  si el naranja entra como acento (solo marca, no estados) o queda para documentos impresos y la web pública.
