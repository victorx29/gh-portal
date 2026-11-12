# Actualización 0.7.6 — Mover un puesto a otra unidad

Se aplica sobre la **0.7.5**. No tiene migraciones ni dependencias: copiar, `git push` y redesplegar.

## Qué cambia
En el detalle del puesto (Plantilla › Ver), nueva sección **«Mover a otra unidad»**, para corregir un puesto que quedó en la unidad equivocada **sin cerrar ni recrear sus plazas**:
- Se elige la unidad destino (en escalera, con buscador) y el **motivo**. Pide confirmación y queda en el historial del puesto («Movió el puesto de … a …»).
- **Las plazas viajan con el puesto**: mismos códigos y mismo estado.
- Si tenía una **excepción de reporte**, se quita: pasa a reportar al jefe de su unidad nueva, según la regla por defecto.
- Si la unidad destino tiene empresa propia, las plazas «Por definir» toman esa empresa.
- **No se permite** si:
  - la unidad destino ya tiene ese mismo cargo: el portal abre ese puesto para que le agregues las plazas;
  - el puesto es jefe (★) y la unidad destino ya tiene jefe: desmárcalo antes.
- Las **requisiciones ya creadas no se tocan**: conservan la unidad con la que se solicitaron.

## Ver el organigrama como el de los PDF
Diagrama › **Ver: Cargos (puestos y plazas)**: cajas con el cargo y sus plazas, colgando de su jefe. **Ver: Unidades**: las áreas con su HC.

## Pruebas críticas
1. Mueve los Analistas de Servicios Tecnológicos (Desarrollo) de la Gerencia de Automatización a la Jefatura de Gestión de Aplicaciones: pide confirmación, sus plazas siguen siendo las mismas y el historial lo registra.
2. Diagrama › Ver: Cargos desde la Gerencia: los analistas cuelgan del Jefe, y el Jefe y el Analista de Calidad, del Gerente.
3. Ver: Unidades: la Gerencia baja su HC y la Jefatura lo sube.
4. Intenta mover un puesto jefe a una unidad que ya tiene jefe: debe rechazarse.
