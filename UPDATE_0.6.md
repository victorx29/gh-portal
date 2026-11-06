# Actualización 0.6 — Divisiones, Perfiles y Cargos, eventos completos (incluye la 0.5.1)

Se aplica sobre la **0.5**. Trae también los cambios de la 0.5.1, así que no hace falta aplicar esa antes.

## Pasos
1. **Backup de la base de datos.** La migración 006 renumera los códigos de perfil.
2. Copia los archivos y haz `git push`. No hay dependencias nuevas, pero si cambió `package.json`, ejecuta `npm install` y sube el `package-lock.json`.
3. **Variable nueva** en Entorno del portal: `PORTAL_URL=https://tu-dominio-del-portal` (sin barra final). Con ella, cada evento lleva el enlace directo a la requisición.
4. Redespliega. El log debe decir `migrada 006_divisiones_perfiles.sql`.
5. **Configuración › Divisiones:** crea Automotriz, Agroindustrial, etc.
6. **Configuración › Empresas:** completa la razón social (ahora es el nombre principal), la dirección fiscal y la división. Las empresas de servicio, como la de transporte, marcan las divisiones que atienden.
7. **Gestión de cargos:** revisa el alcance de cada perfil. Descarga el Excel, complétalo con tu hoja «Cargos» y súbelo en Carga masiva.

## Qué hace la migración con lo que ya tienes
- Cada perfil recibe un código automático `GH-PF-NNN`, por orden de creación. El código anterior se conserva y se muestra como «antes …».
- La última versión de cada perfil queda como **versión activa**.
- Un perfil que tenía empresa queda con esa empresa como alcance. Un perfil sin empresa queda como **general**.
- Las requisiciones existentes no cambian: siguen apuntando a la versión con la que se crearon.

## Qué cambia
- **Perfiles y Cargos:**
  - código automático `GH-PF-NNN` y versión `GH-PF-NNN-VV`; el correlativo usa 3 dígitos porque ya hay más de 99 cargos;
  - modal para ver la versión activa, editar (crea versión nueva), revisar todas las versiones, activar cualquiera, cambiar datos y alcance, y desactivar el perfil;
  - nivel I–VIII;
  - **alcance:** general, por empresas, por unidades o ambas. Una unidad incluye a sus dependientes;
  - el solicitante solo ve los perfiles que corresponden a la empresa y la unidad elegidas, y el servidor lo vuelve a validar al guardar;
  - las requisiciones nuevas usan la versión **activa**, no la última creada.
- **Carga masiva de cargos** desde Excel:
  - un código vacío crea un perfil nuevo;
  - si cambia el contenido, se crea una versión nueva y queda activa;
  - errores por fila (bloquean) y advertencias (no bloquean): posible duplicado o perfil que nadie verá.
- **Empresas:**
  - la razón social es el nombre principal en todo el portal; las siglas se usan donde el espacio es corto (tarjetas, árbol);
  - nuevos campos de dirección fiscal y división;
  - empresas de servicio que atienden varias divisiones.
- **Divisiones:** catálogo propio y filtro «División» en Estructura, que incluye los servicios compartidos que atienden a sus empresas.
- **Grupo:** se oculta en la interfaz cuando la instalación tiene un solo grupo (APB o ARO). En la carga masiva, la columna Grupo pasa a ser opcional.
- **De la 0.5.1:**
  - las listas de unidades muestran «nombre · superior · empresas»;
  - una unidad corporativa sin empresas hereda las de su superior.

## Eventos hacia n8n: ahora con todos los datos
Ninguna clave existente cambia; solo se agregan.
- **Todos los `requisicion.*`** (incluidos `sin_aprobador` y `comentario`) traen `url` y `detalle` completo:
  - código, estado y tipo;
  - cargo y perfil (código de versión, nivel y contenido);
  - empresa (razón social y `empresa_datos`: siglas, RIF, dirección fiscal, división);
  - unidad y su cadena de mando, aprobadora, aprobaciones con autor y fecha;
  - plazas y contratación, solicitante, equipos, accesos y justificación.
- **`candidatura.*`** traen además `candidato_datos`, `etapa_anterior`, `motivo` (en rechazo), `url` y `requisicion` (el mismo detalle).
- **`perfil.solicitado`** trae `perfil_codigo` y `url`.

## Pruebas críticas
1. Arranque: el log muestra `migrada 006`. En Gestión de cargos, tus perfiles aparecen como GH-PF-001… con «antes …».
2. Crea un perfil para una empresa y una unidad. Un gerente de esa unidad lo ve al elegir esa empresa y esa unidad, y no lo ve con otra empresa.
3. Edita el contenido de un perfil: aparece la versión 02 activa. Una requisición creada antes sigue mostrando la 01.
4. Activa de nuevo la 01, y luego desactiva el perfil: deja de aparecer en el formulario.
5. Carga masiva: descarga el Excel, agrega 2 cargos y cambia el contenido de 1. La vista previa muestra 2 nuevos y 1 con cambios. Aplica y vuelve a subir el mismo archivo: debe decir «No hay nada que aplicar».
6. Empresas: completa razón social, dirección fiscal y división. Las listas y los formularios muestran la razón social.
7. Estructura: filtra por una división.
8. n8n: envía una requisición a aprobación. El evento trae `url` y `detalle.perfil.codigo`.
