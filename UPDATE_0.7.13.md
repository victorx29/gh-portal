# Actualización 0.7.13 — Carga masiva de perfiles sin versiones falsas

Se aplica sobre la **0.7.12**. No tiene migraciones ni dependencias nuevas: copiar, `git push` y redesplegar.
El log no debe mostrar ninguna línea «migrada».

## Qué cambia
- **Fallo corregido:** descargar el Excel de perfiles y subirlo sin tocarlo mostraba «Con cambios» en 13 perfiles y,
  al aplicar, creaba una versión 02 en cada uno. Había dos causas:
  - Una función con «;» dentro (por ejemplo, «Cumplir la normativa…; así como también…») se partía en dos.
  - Los saltos de línea de Windows de los textos importados de Word contaban como cambio.
- **El Excel de perfiles trae funciones, competencias y criterios uno por línea** dentro de la celda (Alt+Enter para
  agregar otro). Escribir varios en una sola línea separados por «;» sigue funcionando como antes.
- **Un Excel descargado antes de esta versión** también se puede subir sin crear versiones falsas.

## Archivos que cambian
- `src/services/perfiles.js`: lectura y exportación de listas en la carga masiva; normalización de saltos de línea.
- `package.json`: versión 0.7.13.

## Pruebas críticas
1. **PF-09:** descarga el Excel de perfiles y súbelo sin cambios: «Con cambios 0».
2. Sube el Excel viejo (el que descargaste antes de actualizar): «Con cambios 0».
3. En el Excel nuevo, cambia una palabra de una función del Operador de Mantenimiento (GH-PF-054) y súbelo:
   1 cambio. Aplica: la versión nueva conserva entera la función «…afines; así como también…».
4. **CM-01 y PF-04:** la carga de estructura y la de plantilla siguen diciendo «No hay nada que aplicar»;
   «Importar Word» sigue leyendo las funciones.

## Documentos actualizados
- `ESTADO.md`: versión 0.7.13, decisión de plazas «por regularizar» (18-11) y carga de datos de prueba.
- `PRUEBAS.md`: nueva PF-09 y registro de la ejecución.
- `UPDATE_0.7.13.md`: este documento.
- Sin cambios: `README.md`, `DESIGN.md`.

## Revisión de código
- Corregido antes de entregar: nada pendiente en el código nuevo.
- Ordenado de paso: las cuatro listas del perfil (funciones, competencias conductuales, competencias y criterios)
  se exportan desde un solo lugar (`LISTAS`) en vez de repetir la misma lógica en cada campo. Sin cambio de
  comportamiento.
- Visto y no tocado:
  - Después: en el formulario del perfil, una sola función escrita en una línea con «;» dentro se sigue partiendo
    en dos (con dos o más líneas ya no pasa). Es raro y la etiqueta pide «una por línea».
  - Después: subir dos veces el mismo Excel con perfiles nuevos (código vacío) los duplica; la vista previa avisa
    «Ya existe…» pero no bloquea.
- No se pudo verificar: despliegue en EasyPanel. Probado contra una copia de la base de EasyPanel en PostgreSQL 16
  real: instalación desde cero, actualización sin migraciones, las pruebas críticas y la carga de organigramas
  (214 plazas, sin cierres).
