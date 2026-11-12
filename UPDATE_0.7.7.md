# Actualización 0.7.7 — Desactivación segura de unidades y aprobación retenida

Se aplica sobre la **0.7.6**. Trae una migración nueva (010) y no agrega dependencias.

## Pasos
1. **Backup de la base de datos.**
2. Copia los archivos, `git push` y redespliega. El log debe decir `migrada 010_aprobadora_inactiva.sql`.
3. Revisa en el tablero si alguna requisición aparece **«Sin aprobador»**. Si una unidad que aprueba ya estaba inactiva antes de esta versión, sus requisiciones pendientes quedan retenidas (antes subían solas a la siguiente unidad).

## Qué cambia
- **Una unidad solo se desactiva vacía.** No se puede mientras tenga:
  - unidades dependientes activas;
  - puestos (con o sin plazas);
  - roles de usuario asignados;
  - requisiciones en curso;
  - dependencias funcionales que apunten a ella.

  El detalle de la unidad muestra la lista exacta y qué hacer con cada elemento (mover, cerrar, reasignar). El botón «Desactivar» solo aparece cuando está vacía, y pide confirmación.
- Si al desactivar una unidad hay **perfiles con alcance en ella**, se avisa: dejarán de ofrecerse por esa unidad.
- **Aprobación retenida:** la aprobación se detiene en la primera unidad marcada «Aprueba», **esté activa o no**. Si está inactiva, la requisición queda retenida «sin aprobador» y GH ve el motivo: «la unidad que aprueba está inactiva». Ya no sube sola a la siguiente unidad, como acordamos: nunca reasignar en silencio. Al reactivarla, el director vuelve a recibirla.

## Pruebas críticas
1. Intenta desactivar una dirección con gerencias o roles: se rechaza y el detalle lista qué falta.
2. Abre una unidad con puestos, roles y requisiciones: aparece la lista y no hay botón de desactivar.
3. Crea una unidad vacía y desactívala: pide confirmación y se desactiva.
4. Con una requisición pendiente, deja inactiva su unidad aprobadora (solo posible en datos anteriores a esta versión): queda «sin aprobador» y el director no puede aprobarla. Al reactivarla, vuelve a aparecerle.
