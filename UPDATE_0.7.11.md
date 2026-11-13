# Actualización 0.7.11 — Líneas punteadas entre puestos

Se aplica sobre la **0.7.10**. Trae una migración nueva (012) y no agrega dependencias.

## Pasos
1. **Backup de la base de datos.**
2. Copia los archivos, `git push` y redespliega. El log debe decir `migrada 012_puesto_funcional.sql`.

## Qué cambia
- **Dependencia funcional entre puestos (línea punteada):** por ejemplo, el Analista Contable reporta al Jefe de Contabilidad (línea sólida) y responde funcionalmente al Contador (línea punteada).
  - Se agrega en la ficha del puesto (sección «Dependencias funcionales») o, en modo edición, con el botón **«+ Línea punteada»** del panel.
  - Lleva motivo y fechas. Se **cierra** con fecha y motivo; nunca se borra, y una cerrada no se modifica.
  - **Solo documenta el organigrama:** no cambia a quién reporta el puesto ni quién aprueba sus requisiciones.
  - La ficha del puesto destino muestra quién le responde funcionalmente. Un puesto con líneas punteadas vigentes no se puede desactivar sin cerrarlas antes.
- **Líneas punteadas rectas en ángulo**, como en los organigramas de GH, también entre unidades. Giran junto al cargo de destino, por el pasillo entre cajas, para no atravesar otras cajas.
- **Carga masiva de plantilla:** nueva columna **«Funcional de»** (`UNIDAD/PERFIL`; varias separadas por «;»). Lo que dice el archivo queda así: vacía = ninguna, y las que hubiera se cierran con fecha de hoy. **Un Excel anterior, sin esa columna, no toca las líneas punteadas.**

## Pruebas críticas
1. En la ficha del Analista Contable, «Agregar dependencia funcional» → Contador: aparece la línea punteada recta en Ver: Cargos, y el analista sigue reportando al Jefe.
2. Repetirla o hacerla sobre sí mismo: se rechaza.
3. Ciérrala con motivo: desaparece del diagrama y queda en el historial.
4. Excel de plantilla: la columna «Funcional de» trae la relación; súbelo sin cambios: «No hay nada que aplicar».
5. Modo edición → clic en un puesto → «+ Línea punteada»: se abre el formulario ya desplegado.
