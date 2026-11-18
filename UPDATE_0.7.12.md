# Actualización 0.7.12 — Correcciones de las líneas punteadas

Se aplica sobre la **0.7.11**. No tiene migraciones ni dependencias nuevas: copiar, `git push` y redesplegar.
El log no debe mostrar ninguna línea «migrada».

Con esta entrega se cierra la 0.7: desde aquí, solo correcciones de fallos hasta empezar la 0.8.

## Qué cambia
- **Fallo corregido: las líneas punteadas ya no pasan por debajo de otras cajas.** Antes, una línea entre dos
  cargos de la misma fila con otro cargo en medio cruzaba por debajo de ese cargo, y parecía salir de él. Ahora
  el diagrama prueba varias rutas (de lado a lado, por el pasillo de arriba o por el de abajo) y usa la primera
  que no atraviesa ninguna caja. Aplica a «Ver: Cargos» y «Ver: Unidades», en las tres disposiciones.
- **No se acepta una línea punteada hacia el jefe directo.** Antes solo se rechazaba si el jefe estaba puesto
  como excepción en «Reporta a». Ahora también cuando es el jefe por la regla de la unidad: la línea punteada se
  dibujaba encima de la sólida y no aportaba nada.
  - En la ficha del puesto: «Ya le reporta directamente (línea sólida, por ser el jefe de la unidad)…».
  - En la carga masiva: al aplicar, «Fila N: «Funcional de» apunta a su jefe directo…»; no se aplica nada del
    archivo (igual que con los ciclos de «Reporta a»).
- **Carga masiva:** el error de una referencia inexistente en «Funcional de» muestra la referencia tal como se
  escribió en el archivo (antes salía en minúsculas).

## Archivos que cambian
- `public/js/diagrama.js`: ruta de las líneas punteadas.
- `src/services/plantilla.js`: validación de la línea punteada hacia el jefe (ficha y carga masiva) y texto
  del error de referencia.
- `package.json`: versión 0.7.12.

## Pruebas críticas
1. **Rutas (DG-12):** con tres cargos en la misma fila (A, B, C), agrega una línea punteada de C hacia A. La
   línea va por encima (o por debajo) de las cajas, no por debajo de B. Revisa también «Ver: Unidades».
2. **Jefe por regla (PL-12):** en la ficha del Analista Contable, «Agregar dependencia funcional» → el Jefe de
   Contabilidad (jefe de su unidad): se rechaza. Hacia el Contador: se acepta.
3. **Jefe por excepción (PL-12):** un puesto con «Reporta a» = X: la línea punteada hacia X se rechaza.
4. **Excel (CM-07):** en «Funcional de» escribe `No-Existe/GH-PF-999`: el error muestra exactamente eso.
   Pon como «Funcional de» al jefe de la unidad: al aplicar se rechaza y nada queda aplicado.
5. **Regresión:** las cinco pruebas críticas de la 0.7.11 siguen pasando.

## Documentos actualizados
- `ESTADO.md`: versión 0.7.12, resultado de las pruebas, requisitos antes de la 0.8 y dos pendientes técnicos.
- `PRUEBAS.md`: nuevas PL-12, CM-07 y DG-12; registro de ejecuciones de la 0.7.11 y la 0.7.12.
- `UPDATE_0.7.12.md`: este documento.
- Sin cambios: `README.md`, `DESIGN.md` (no hay elementos visuales nuevos; la línea punteada ya existía).

## Revisión de código
- Corregido antes de entregar: nada pendiente en el código nuevo.
- Ordenado de paso: en `plantilla.js`, la lectura de «Funcional de» se separa en líneas y ya no divide el
  texto dos veces. Sin cambio de comportamiento.
- Visto y no tocado:
  - Después: consultas en paralelo sobre la misma transacción en `requisiciones.js` (detalleEvento),
    `perfiles.js` y `plantilla.js` (cargas masivas). Hoy funciona con pg 8 y deja un aviso en el log; con pg 9
    fallaría. No actualizar pg a la 9 antes de corregirlo.
  - Después: poner una excepción «Reporta a» hacia un puesto que ya tiene una línea punteada desde el mismo
    puesto deja las dos (redundante, no rompe nada).
  - Después: una línea punteada vigente se puede modificar directo en la base (el disparador protege solo las
    cerradas). El portal nunca lo hace.
  - Después: la línea punteada hacia el jefe por Excel se detecta al aplicar, no en la vista previa (igual que
    los ciclos de «Reporta a»).
- No se pudo verificar: despliegue en EasyPanel, envío real a n8n, imprimir o PDF, exportar imagen y Safari.
  Probado en PostgreSQL 16 real: instalación desde cero, actualización desde la 0.7.11 con datos, críticas de
  la 0.7.11 y la 0.7.12, y humo (permisos, aprobación, requisiciones, cargas masivas, diagrama en escritorio y
  móvil).
