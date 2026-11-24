# Actualización 0.9.5.1 — Rediseño visual «A + B» (marca APB, Roboto, claro y oscuro)

Se aplica sobre la **0.9.5**. Es **solo visual**: no cambia servicios, rutas, base de datos ni n8n. Sin migración, sin
dependencias ni variables nuevas. Agrega la carpeta `public/fonts` (Roboto).

## Pasos

1. Copia los archivos (zip de actualización), `git push` y redespliega. No hace falta respaldo de base por esta versión, pero si
   vienes de la 0.9.4, primero aplica la 0.9.5 con su respaldo.
2. Abre el portal y **recarga sin caché** (Ctrl + F5): el navegador puede tener guardado el CSS anterior.
3. Revisa en claro y en oscuro: el botón «Tema claro u oscuro» del menú cambia entre los dos.

## Qué cambia

**En todo el portal**, desde el CSS común:

- **Colores del grupo**, tomados de apbgroup.net:
  - azul profundo `#005791` como color de acción;
  - **ámbar `#FFB600` solo como acento**: indicador del menú, números de sección, borde de los indicadores y de la cabecera de los
    modales, pestaña activa;
  - carbón `#1C242A` en el menú y en la cabecera de los modales;
  - fondo de página gris claro con cajas blancas.
- **Tema oscuro** con los mismos papeles y contraste revisado (AA).
- **Roboto** (la del sitio del grupo), servida por el propio portal. La política de seguridad no permite cargarla de Google. Su
  licencia es la **SIL OFL 1.1** (`public/fonts/LICENSE-Roboto.txt`), que permite incluirla. Corrijo lo que te dije antes: no es
  Apache 2.0.
- **Botones con jerarquía:**
  - principal (azul sólido, texto blanco);
  - secundario (azul suave);
  - normal;
  - discreto (solo texto);
  - rechazar (rojo suave);
  - peligro (rojo sólido, ahora legible también en oscuro);
  - deshabilitado.
- **Campos:** borde más visible, anillo de foco azul y borde rojo cuando tienen error. Etiquetas en 13 px.
- **Tablas:** encabezado en mayúsculas sobre gris y hover en la fila.
- **Avisos:** borde izquierdo de color.
- **Chips:** redondeados (atención, error, éxito, neutro).
- **Tarjetas** del tablero con sombra suave.
- **Indicadores** con borde ámbar.
- **Franja de marca** (azul, ámbar y gris del logo) arriba de cada página.
- **Modales:** cabecera carbón con borde ámbar, que se queda fija al desplazar.
- **Menú:** carbón; el activo, con una barra ámbar; grupo «Administración» antes de Configuración. En móvil sigue siendo la barra
  de arriba.
- Colores de las columnas del tablero con la paleta del grupo.

**Pantallas reorganizadas** (bajo riesgo), en cajas y secciones:

- **Inicio de sesión:** logo «GH» con la «O» ámbar y botón a todo el ancho.
- **Página de error.**
- **Configuración:**
  - catálogos (lista y «agregar» en una caja con conteo);
  - empresas (lista en caja; formulario en 3 secciones: Identificación, División y ubicación, Empresa de servicios);
  - usuarios (lista en caja; «Crear usuario» en su caja);
  - campos personalizados;
  - Análisis de CV con IA (criterios e instrucciones en cajas).
- **Listas de perfiles y empleados:** filtros en su caja y lista en caja con conteo.

Las demás pantallas ya reciben los colores y componentes nuevos. Su estructura se reorganiza por fases:

- fase 2: Requisiciones y Selección;
- fase 3: Empleados y Conciliación;
- fase 4: Estructura, plantilla, perfiles, organigrama, pipelines y cargas.

## Archivos que cambian

| Archivo | Cambio |
|---|---|
| `public/css/app.css` | Tokens nuevos (claro y oscuro), Roboto, componentes A + B, cajas, secciones numeradas, login, franja, modal, menú. |
| `public/fonts/` | Nuevo: Roboto 400, 500 y 700 (latín y latín extendido, woff2) y su licencia. |
| `src/views/partials/head.ejs` | Grupo «Administración» en el menú. |
| `src/views/login.ejs`, `error.ejs` | Nuevo diseño. |
| `src/views/maestros.ejs`, `empresas.ejs`, `empresa_form.ejs`, `usuarios.ejs`, `config_campos.ejs`, `config_ia.ejs`, `perfiles.ejs`, `empleados.ejs` | Cajas y secciones (sin cambiar campos, nombres ni rutas). |
| `DESIGN.md` | Reescrito con la dirección A + B. |
| `package.json` | Versión 0.9.5.1. |

## Pruebas críticas (las que te tocan, en tu navegador después de desplegar)

1. **VIS-01:** recorre Pipeline, Selección (con un modal abierto), Empleados y Configuración en claro y en oscuro.
2. **VIS-03:** agrega un elemento a un catálogo de prueba, edita una empresa, crea un usuario de prueba y filtra perfiles y
   empleados.
3. **VIS-04:** colapsa y expande el menú; ábrelo en el celular.
4. **VIS-06:** imprime el organigrama o una descripción de cargo: debe salir en hoja blanca, sin franja ni menú.
5. Si algo se ve desparejo en una pantalla que no está en la lista de reorganizadas, mándame la captura: la anoto para su fase.

## Revisión de código

- **Corregido antes de entregar:**
  - [Seguro] El botón de peligro en tema oscuro tenía texto blanco sobre rojo claro (2,7:1): ahora lleva fondo `#B3261E` fijo
    (6,5:1).
  - [Seguro] El texto de advertencia en claro no alcanzaba el contraste: `#7A5600` sobre `#fff4d6` da 6,1:1.
  - [Seguro] Los enlaces sin clase usaban el azul del navegador, que en oscuro casi no se leía: ahora usan el color de acción del
    tema.
  - [Seguro] En móvil se colaba el texto «Administración» en la barra del menú.
- **Ordenado de paso:**
  - Los tokens viejos se mantienen con el mismo nombre (`--pr`, `--bt`, `--on`…), así que no hubo que tocar las vistas que los
    usan.
  - Los nuevos (`--pg`, `--bdf`, `--ac`, `--rdl`, `--nav…`, sombras) están documentados en DESIGN.md.
- **Visto y no tocado:**
  - [Después] En móvil, las tablas `mid` muestran los valores sin su encabezado (ya estaba; queda en DESIGN.md como pendiente).
  - [Después] Los colores de etapa siguen escritos en el CSS y en `diagrama.js`, no como tokens.
  - [Probable] La versión de cuatro números (0.9.5.1) no es semver estricto. `npm install` la aceptó en la prueba, pero si
    EasyPanel se queja al construir, avísame y la renombro a `0.9.5-1`.
- **No se pudo verificar:**
  - La impresión (VIS-06), Safari, EasyPanel y tu caché.
  - Revisé 19 pantallas y 4 modales en claro y oscuro, y 6 en móvil, en Chromium, sin errores; el flujo completo de la 0.9.5 lo
    repetí con el diseño nuevo.

## Documentos actualizados

- `DESIGN.md`: reescrito (dirección A + B, tokens, componentes, problemas resueltos y pendientes).
- `ESTADO.md`: versión, 0.9.5.1 en «Hecho», decisiones y fases.
- `PRUEBAS.md`: VIS-01 a 06 y el registro de la ejecución.
- `UPDATE_0.9.5.1.md`: este documento.
- Sin cambios: `README.md` (no cambian la arquitectura, la instalación ni las variables).
