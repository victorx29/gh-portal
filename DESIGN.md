# DESIGN.md — Portal de Gestión Humana (Grupo APB)

Diseño vigente desde la **0.9.5.1: dirección «A + B»**, aprobada por Victor el 24-11-2026 sobre la previa
`propuesta-AB-0.9.5.1.html`. Toma de **A (Institucional APB)** la marca del grupo y de **B (Claro y moderno)** las cajas, las
sombras suaves y los formularios por secciones. Los colores salen del logo y del sitio del grupo (apbgroup.net).

**Regla de uso:** las pantallas usan las variables CSS (`var(--pr)`), nunca valores sueltos. Si algo nuevo no está cubierto
aquí, se propone agregarlo a este archivo antes de usarlo.

## Carácter

Herramienta de trabajo interna para Gestión Humana, gerentes y aprobadores: seria y reconocible como del grupo, legible
durante muchas horas y densa en información. El **azul profundo APB** es el color de acción; el **ámbar** del logo es solo
acento (nunca un botón con texto blanco: no alcanza el contraste); el **carbón** del sitio viste el menú y la cabecera de los
modales. Los colores de estado (verde, ámbar oscuro, rojo) no se usan como decoración.

## Color

Tokens en `:root`. Tema claro y oscuro (por preferencia del sistema o con el botón del menú, `data-theme`). Todos los pares
texto/fondo pasan AA (4,5:1); se comprobaron al definirlos.

| Token | Claro | Oscuro | Función |
|---|---|---|---|
| `--pg` | `#f3f5f8` | `#0f1418` | Fondo de la página (detrás de cajas y tarjetas) |
| `--bg` | `#ffffff` | `#182027` | Cajas, tarjetas, campos y modales |
| `--sf` | `#eaeef3` | `#1f2830` | Superficie secundaria: columnas del tablero, encabezado de tabla, hover |
| `--bd` | `#dde3ea` | `#2b3640` | Bordes y divisiones |
| `--bdf` | `#c5cfd9` | `#3a4754` | Borde de campos y de botones normales |
| `--tx` | `#1C242A` | `#e7ecf0` | Texto principal (carbón APB) |
| `--mu` | `#5A5B5F` | `#9aa6b2` | Texto secundario (gris APB) |
| `--pr` | `#005791` | `#7cc0ff` | Acción como texto: enlaces, foco, activo |
| `--pl` | `#e6f0f8` | `#16304a` | Fondo suave de acción: chips, botón secundario, anillo de foco |
| `--bt` / `--bth` | `#005791` / `#00466f` | `#1a6bbf` / `#2479d1` | Fondo del botón principal y su hover |
| `--on` | `#ffffff` | `#ffffff` | Texto sobre el botón principal |
| `--ac` | `#FFB600` | `#FFB600` | Ámbar APB: acento (indicador del menú, números de sección, borde de indicadores y de la cabecera del modal) |
| `--wa` / `--wl` | `#7A5600` / `#fff4d6` | `#ffcf5c` / `#2e2715` | Advertencia: texto e iconos / fondo |
| `--rd` / `--rdl` / `--rdb` | `#B3261E` / `#fbe9e7` / `#efc3bf` | `#ff8a80` / `#2d1b1b` / `#5a2c2a` | Error y peligro: texto / fondo / borde |
| `--ok` / `--okl` | `#1B7A40` / `#e3f4ea` | `#6fdc9a` / `#13261b` | Éxito: texto / fondo |
| `--nav`, `--navt`, `--navon` | `#1C242A`, `#c9d1d9`, `#2a343c` | `#0b1014`, `#a9b4bf`, `#1b232a` | Menú lateral: fondo, texto, ítem activo |
| `--mh` | `#1C242A` | `#0b1014` | Cabecera de los modales |

**Botón de peligro** (`.btn.peligro`): fondo `#B3261E` fijo en los dos temas (texto blanco 6,5:1).

**Franja de marca:** 5 px arriba de cada página interna con los colores del logo: azul (`--bt`) 72 %, ámbar 14 %, gris
`#7A7A7A` 14 %.

**Hoja blanca siempre:** el diagrama de estructura, el organigrama y la descripción de cargo imprimible usan fondo `#fff` y
texto oscuro también en tema oscuro, porque representan un documento.

**Colores de etapa del tablero** (borde inferior del título de cada columna), de la paleta del grupo: gris `#9aa3ad` (sin
etapa), azul profundo `#005791` (aprobado, pendiente de director), azul `#0071CE` (publicación), turquesa `#05AEB6`
(convocatoria, pendiente de Presidencia), índigo `#6366f1` (selección), verde `#23A455` (ingreso), rojo `#B3261E`
(cancelado, rechazado). `diagrama.js` conserva sus colores de hoja blanca.

## Tipografía

- **Familia:** `Roboto, system-ui, -apple-system, "Segoe UI", sans-serif`. Roboto (la del sitio del grupo) se sirve desde el
  propio portal (`public/fonts`, pesos 400, 500 y 700, latín; licencia SIL OFL 1.1 en `LICENSE-Roboto.txt`): la política de
  seguridad no permite cargarla de Google.
- **Base:** 14 px, interlineado 1.5. Números de códigos y conteos con cifras tabulares (`.cod`).
- **Escala en uso:**

| Uso | Tamaño | Peso |
|---|---|---|
| Título de página (`h1`) | 26 px, interletra −0.4 px | 700 |
| Marca del menú | 22 px | 700 |
| Indicador (`.kpi strong`) | 22 px | 700 |
| Título de modal | 18 px | 700 |
| Subtítulo de sección (`.h2s`) | 17 px | 700 |
| Encabezado de bloque (`h3`), tarjetas | 15 px / 14 px | 600–700 |
| Texto | 14 px | 400 |
| Secundario, migas, comentarios, pestañas de configuración | 13 px | 400 |
| Etiquetas de campo | 13 px | 500 |
| Chips, etiquetas, encabezados de tabla (mayúsculas, interletra 0,04 em) | 12 px | 500–600 |
| Leyenda de sección (`fieldset`) | 14 px | 700 |
| Tipo de unidad en el árbol (`.tchip`) | 11 px | 400 |

- Texto largo limitado a 80 caracteres por línea (`.sub`, `.pasos`).

## Espaciado

Base de 2 px en la práctica. Valores frecuentes: 4, 6, 8, 10, 12, 14, 16, 18, 22 y 26 px.
- Página (`main`): 22 px arriba, 26 px a los lados, 40 px abajo; en móvil, 16 px.
- Separación entre botones y elementos en fila: 8 px. Entre columnas de formulario: 14 px.
- Formularios: ancho máximo 720 px (`.form-max`); paneles 640 px; modales 760 px; confirmaciones 440 px.

## Forma y profundidad

- **Radios:** 6 px (etiquetas), 10 px (botones, campos, navegación, avisos), 12 px (tarjetas, árbol, `details`),
  14 px (cajas, columnas del tablero, indicadores, filtros, `fieldset`), 16 px (modales, inicio de sesión), 999 px (chips y
  pastillas).
- **Sombras suaves (B):** `--sh` en botones; `--shc` en cajas, tarjetas, indicadores y filtros; `--shm` en modales y menús
  emergentes. En oscuro, sombras más densas y cortas.
- Las cajas se separan del fondo de la página (`--pg`) por color y sombra; dentro de una caja se separa con bordes `--bd`.

## Componentes

**Botones** (`.btn`): alto mínimo 44 px (34 px en tablas densas), radio 10 px, padding 8 × 16 px, peso 500, icono opcional
a la izquierda con 8 px de separación. Jerarquía, de más a menos:
- **Principal** (`.btn.p`): fondo `--bt`, texto blanco, peso 600. Uno por grupo de acciones.
- **Secundario** (`.btn.s`): fondo `--pl`, texto `--pr`, sin borde. Acción importante que no es la principal (por ejemplo,
  «Cargar CV», «+ Criterio»).
- **Normal** (`.btn`): fondo `--bg`, borde `--bdf`, sombra `--sh`.
- **Discreto** (`.btn.g`): sin fondo ni borde, texto `--pr`. Volver, cancelar, «Ver ficha» en tablas.
- **Rechazar** (`.btn.d`): texto y borde rojos suaves. Para acciones destructivas que abren una confirmación.
- **Peligro** (`.btn.peligro`): fondo `#B3261E`, texto blanco. Solo para confirmar una acción irreversible.
- **Deshabilitado** (`[disabled]`): opacidad 0,5 y cursor «no permitido».
- **Foco:** contorno de 2 px `--pr` separado 2 px en todos los elementos interactivos.

**Campos** (`input`, `select`, `textarea`): ancho completo, alto mínimo 44 px, padding 10 px, radio 10 px, borde `--bdf`; al
enfocar, borde `--pr` y anillo de 3 px `--pl`. Con error (`aria-invalid="true"`), borde `--rd`. Etiqueta encima en 13 px peso
500 `--tx`. Casillas con `.chk` y color de acento `--bt`. Formularios en dos columnas con `.g2` (una en móvil).

**Secciones de formulario** (`fieldset.sec`): sin caja propia; leyenda de 14 px en negrita con número en un círculo ámbar
(`.n`) y, opcional, una aclaración corta en `small`. Entre secciones, línea punteada. Un `fieldset` sin `.sec` es una caja con
borde y radio 14 px.

**Cajas** (`.caja`, B): fondo `--bg`, borde `--bd`, radio 14 px, sombra `--shc`. Cabecera `.caja-h` (título de 16 px, conteo en
chip neutro, acciones a la derecha) y cuerpo `.caja-b`. Las listas y los formularios de página van en cajas; la tabla ocupa
todo el ancho de la caja.

**Filtros** (`.filtros`): caja propia sobre la lista, en rejilla con el botón alineado abajo.

**Tablas:** ancho completo, celdas de 10 px, línea inferior `--bd`. Encabezado en mayúsculas de 12 px peso 600 sobre `--sf`
(las tablas clave-valor `.kv` conservan su encabezado normal). Fila con hover suave. Acciones a la derecha (`td.acts`), filas
inactivas en `--mu` (`tr.off`), filas con error en `--wl`. Tablas anchas en `.tw` con desplazamiento horizontal; en móvil,
`table.mid` se convierte en tarjetas.

**Navegación (A):** menú lateral carbón (`--nav`) de 236 px (64 px colapsado): marca «GH» con la «O» ámbar, usuario y roles,
enlaces de 44 px en `--navt`; el activo con fondo `--navon`, texto blanco en 600 y una barra ámbar de 4 px a la izquierda.
Grupo «Administración» antes de Configuración. En móvil pasa a barra superior horizontal. Configuración usa pastillas
(`.pill`, activa en `--pl`) y tarjetas de acceso (`.hub-i`, caja con sombra). Migas (`.crumb`) en 13 px con enlaces `--pr`.
Pestañas (`.tab`) con la activa subrayada en ámbar.

**Tarjetas del tablero** (`.card`): fondo `--bg`, borde `--bd` con borde izquierdo de 4 px, radio 12 px, sombra `--shc`; en
hover, borde `--bdf` y sombra mayor. Las que le tocan al usuario llevan el borde izquierdo ámbar. Columnas sobre `--sf`, con el
conteo en una pastilla.

**Chips y etiquetas:** `.chip` redondeado (999 px), 12 px peso 500: acción (`--pl`/`--pr`), atención `.w`, error `.r`, éxito
`.ok`, neutro `.n`. `.tag` (radio 6 px; variantes `.ok`, `.warn`, `.dot`); `.tchip` para el tipo de unidad.

**Avisos:** `.flash` con borde izquierdo de 4 px del color del texto (A) sobre fondo suave (B): información (`--pl`), éxito
(`.ok`), advertencia (`.wa`), error (`.err`). Flotantes (`.toast`) arriba a la derecha: el de éxito se cierra solo; el de error
queda hasta cerrarlo.

**Confirmaciones:** modal propio con `data-confirm`, `data-ok` y `data-peligro`. El foco empieza en
«Cancelar» y Esc cancela. Nunca `confirm()` del navegador.

**Modales** (`dialog`): radio 16 px, padding 20 px, ancho hasta 760 px, alto hasta 90 % con desplazamiento propio, sombra
`--shm`. La cabecera `.mh` (primer elemento del modal) va en carbón (`--mh`) a todo el ancho, con texto blanco, borde inferior
ámbar de 3 px y fija arriba al desplazarse; su botón «Cerrar» es transparente con borde blanco.

**Acciones que cambian datos** (0.9.2): siempre en un modal propio, nunca en un menú desplegable dentro de una tabla
(el contenedor con desplazamiento lo recorta). Desde un modal se abre en el segundo modal (`data-modal2`), con la plaza o
el registro y cada acción en su bloque, con su motivo. Al guardar, el portal vuelve a la misma vista: mismos filtros,
el modal que estaba abierto y la misma posición (campo `_volver` que agrega `app.js`; el servidor solo acepta rutas
internas). Un formulario que no debe volver lleva `data-sin-volver`.

**Indicador de carga** (`.carga`, 0.9.2): la «O» del logo (anillo de 40 px, borde 6 px `--bt` con un cuarto
transparente) girando 0,8 s por vuelta, con la etiqueta «Guardando…» (13 px `--mu` en una pastilla `--bg` con borde
`--bd`), centrada sobre un velo claro (`#ffffff59`; oscuro `#0006`) por encima de los modales. Aparece si el envío tarda
más de 250 ms (300 ms al abrir un modal) y el botón queda deshabilitado para no enviar dos veces. Con «reducir movimiento»
no gira. No se imprime.

**Indicador de trabajo en curso** (`.o-mini`, 0.9.5): la misma «O» en pequeño (anillo de 12 px, borde 2 px; 16 px dentro de
un aviso) girando 0,8 s por vuelta, del color del texto donde va (`currentColor`). Marca lo que n8n está procesando y **no
bloquea**: va dentro de un chip («Leyendo CV…», «IA en curso») o al inicio de un aviso («Lectura: 3 de 10 CV. Se actualiza
solo.»). Siempre acompañado de texto; el anillo es decorativo (`aria-hidden`). Con «reducir movimiento» no gira. Para
esperas de minutos se usa este indicador, nunca el velo de `.carga`.

**Indicadores** (`.kpi`): caja con borde superior ámbar de 3 px (A), radio 14 px y sombra (B); etiqueta pequeña `--mu` y
valor en 22 px.

**Inicio de sesión** (`.login`): tarjeta centrada de 400 px con la marca «GH» y la «O» ámbar, título, campos y botón principal a
todo el ancho.

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

## Problemas detectados

Resueltos en la 0.9.5.1: contraste de las advertencias en claro (`--wa` #7A5600 sobre `--wl`: 6,1:1); contraste del botón de
peligro en oscuro (fondo fijo `#B3261E`); tipografía fija (Roboto alojada); colores de etapa con la paleta
del grupo; estado deshabilitado definido; identidad de marca (ámbar como acento).

Pendientes:
1. **Colores de etapa fuera de los tokens.** Siguen escritos en el CSS y en `diagrama.js`. Propuesta: tokens `--etapa-*`.
2. **Pantallas aún sin reorganizar en cajas y secciones** (reciben el estilo nuevo, pero no la estructura): Requisiciones y
   Selección (fase 2), Empleados y Conciliación (fase 3), Estructura, plantilla, perfiles, organigrama, pipelines y cargas
   (fase 4).
3. **Tablas `mid` en móvil:** los valores se muestran sin su encabezado. Propuesta: etiqueta por celda en móvil.

## Pendiente de decidir

- **Tamaño de texto base.** 14 px en el portal (herramienta densa); 16 px en la futura web pública de vacantes.
