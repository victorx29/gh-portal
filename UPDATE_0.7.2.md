# Actualización 0.7.2 — Requisición ligada a la plaza y empresa «Por definir»

Se aplica sobre la **0.7.1**. Trae una migración nueva (009) y no agrega dependencias.

## Pasos
1. **Backup de la base de datos.**
2. Copia los archivos, `git push` y redespliega. El log debe decir `migrada 009_requisicion_plaza.sql`.
3. Antes de que los gerentes pidan reemplazos, revisa que la **plantilla tenga las plazas**. Sin plaza en la plantilla, solo se puede pedir «Cargo nuevo».

## Qué cambia
- **Una plaza por requisición.** El campo «Plazas» desaparece del formulario y vale siempre 1. Si algún workflow de n8n usaba `plazas`, ya no hace falta.
- **Reemplazo:** el solicitante elige la plaza de su unidad.
  - El cargo (perfil) sale del puesto de esa plaza: no se elige.
  - Si la plaza ya es de una empresa, la requisición toma esa empresa.
  - No se pueden pedir plazas congeladas ni cerradas.
  - Una plaza con otra requisición abierta sale como «en proceso con REQ-…» y no se puede elegir. Un borrador también la reserva; al **anularlo**, se libera.
- **Cargo nuevo** (el cargo no existe, o existe pero no hay plaza libre): se elige el perfil. Al aprobarlo **Presidencia**, el sistema crea la plaza en la plantilla, y el puesto si la unidad no lo tenía, y la enlaza a la requisición.
- **Empresa «Por definir»:**
  - en unidades corporativas, una plaza puede crearse sin empresa (también en la carga masiva, dejando «Empresa» vacía);
  - toma la empresa de la requisición al aprobarse;
  - en la plantilla aparece como «Por definir», con su propio indicador.
- **GH cambia la empresa** en cualquier momento, siempre con motivo:
  - **De una plaza libre:** desde el detalle del puesto.
  - **De una requisición:** desde su detalle (sección «Cambiar empresa»). Cambia también su plaza.
    - Queda en la línea de tiempo («CIM → MDV») y genera el evento `requisicion.empresa_cambiada` para n8n.
    - La foto de la aprobación no se toca.
    - Si la aprobó alguien con alcance de empresa (Presidencia o un director de empresa), pide confirmación: el cambio no repite la aprobación.
    - Se bloquea si el pipeline de la empresa nueva no tiene la etapa en que está la requisición, porque la tarjeta desaparecería del tablero.
  - Una plaza con requisición abierta solo se cambia desde la requisición, para que las dos digan lo mismo.
- **Plantilla:** indicadores «En proceso (↻)» y «Empresa por definir». El detalle del puesto marca cada plaza con su requisición abierta.
- **Eventos:** `detalle.plaza` con el código de la plaza.

## Requisiciones anteriores a esta versión
- Las que ya están enviadas siguen igual, sin plaza.
- Un **borrador de reemplazo** creado antes y sin plaza pedirá elegir la plaza al editarlo o enviarlo.

## Pruebas críticas
1. Crea un puesto con plazas en una unidad corporativa sin indicar empresa: quedan «Por definir».
2. Como gerente, «Reemplazo de una plaza existente»: al elegir la unidad aparecen sus plazas; las congeladas no aparecen.
3. Crea la requisición con una plaza e intenta otra con la misma plaza: debe rechazarse («en proceso con REQ-…»).
4. Envíala y apruébala: la plaza toma la empresa de la requisición.
5. «Cargo nuevo», aprobado por el director y por Presidencia: aparece una plaza nueva en la plantilla, enlazada a la requisición.
6. Como GH, cambia la empresa de la requisición del punto 5: pide confirmación (la aprobó Presidencia). La plaza cambia también y la línea de tiempo lo muestra.
7. Anula un borrador: su plaza vuelve a estar disponible.
