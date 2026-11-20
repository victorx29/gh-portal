# Actualización 0.8.0 — Ingreso ligado a la plaza, candidatos por cédula y protección del superadmin

Se aplica sobre la **0.7.13**. Trae una migración (013) y un script nuevo; no agrega dependencias.

## Pasos
1. **Respaldo de la base** en EasyPanel.
2. Copia los archivos, `git push` y redespliega. El log debe decir `migrada 013_ingreso_plaza.sql`.
3. **Limpieza de los datos de prueba** (consola del servicio en EasyPanel):
   1. `npm run limpiar -- transacciones` → muestra qué borraría. Debe listar las 5 requisiciones de prueba, sus
      aprobaciones, comentarios, candidatos, el ingreso de prueba y los avisos a n8n. Nada de estructura, perfiles,
      plantilla ni usuarios.
   2. `PERMITIR_LIMPIEZA=si npm run limpiar -- transacciones --aplicar`
   3. `npm run limpiar -- perfil GH-PF-001` (muestra) y luego `PERMITIR_LIMPIEZA=si npm run limpiar -- perfil GH-PF-001 --aplicar`.
   La variable va delante del comando solo para esa ejecución: no la agregues a las variables del servicio.
   El historial no se borra (es inmutable y encadenado): queda una entrada «limpieza» con lo que se borró.
   El contador de requisiciones vuelve a empezar en REQ-00001. El de perfiles sigue en el número más alto
   (GH-PF-127): un código ya usado en documentos no se reutiliza, salvo que el borrado sea el último.

## Qué cambia
- **Ingreso ligado a la plaza** (proceso APB-GHU-FL-002, etapa de ingreso):
  - Cuando el candidato llega a «Ingreso», queda **«por ingresar»** en la plaza de la requisición. La ficha del
    puesto lo muestra en la nueva columna **Ocupante**.
  - En la ficha del candidato, GH pulsa **«Confirmar ingreso»** con la **fecha real** (no puede ser futura): ahí la
    persona ocupa la plaza. Si la plaza estaba «Por definir», toma la empresa de la requisición.
  - **«No se presentó»** (con motivo): la plaza queda libre. La requisición no se reabre; si hace falta, se pide otra.
  - **Movimiento interno:** si quien ingresa ya trabaja en otra plaza, esa relación se cierra como «movido» el día
    anterior. Nunca hay dos relaciones activas para la misma persona.
  - Una plaza tiene a lo sumo una persona activa y una por ingresar. El reemplazo puede quedar «por ingresar»,
    pero no se confirma mientras el ocupante siga activo (el egreso llega en la 0.8.1).
  - Nuevo aviso a n8n **`ingreso.confirmado`** (persona, cargo, plaza, fecha, equipos y accesos de la requisición;
    sin cédula). Si el flujo de n8n no lo conoce, lo ignora.
  - Las relaciones laborales no se borran y una cerrada no se modifica (disparadores en la base).
- **Candidatos por cédula:** la cédula es obligatoria. «V-12.345.678», «12.345.678» y «12345678» son la misma
  persona: si ya postuló, se reutiliza su ficha y GH ve sus otras postulaciones; si ya es empleado, la ficha lo
  avisa (movimiento interno). La misma cédula no se postula dos veces a la misma requisición.
- **Plaza «por regularizar»** (la crea la importación del Listado en la 0.8.1): no se puede pedir su reemplazo ni
  confirmar un ingreso en ella.
- **Usuarios:** solo un superadmin modifica a otro superadmin (roles o estado); nadie retira ni desactiva al último
  superadmin activo. Crear usuario, asignar o retirar rol y activar o desactivar quedan en el historial. Correo
  repetido o unidad inexistente dan un aviso en lugar de «Error interno».
- **Descripción de cargo imprimible:** el nombre del grupo sale de la base (Configuración › Empresas › Grupo). Hoy
  ese grupo se llama «APB Group»: la descripción dirá eso, no «Grupo APB». Si prefieres otro nombre, cámbialo ahí.

## Archivos que cambian
- Nuevos: `db/migrations/013_ingreso_plaza.sql`, `src/services/empleados.js`, `scripts/limpiar.js`.
- `src/services/seleccion.js`, `src/controllers/seleccion.js`, `src/views/cand_detalle.ejs`, `src/views/cand_form.ejs`.
- `src/services/plantilla.js`, `src/views/puesto_detalle.ejs`.
- `src/controllers/admin.js`, `src/controllers/perfiles.js`, `src/views/perfil_descripcion.ejs`.
- `package.json` (0.8.0 y `npm run limpiar`), `.env.example`, `README.md`.

## Migración 013
Agrega a `relacion_laboral` la plaza, la versión del perfil, la candidatura, el origen, quién confirmó y cómo
terminó; índices de ocupación por plaza; disparadores para que no se borre ni se modifique cerrada; normaliza la
cédula de candidatos y trabajadores y la hace única en candidatos; agrega `plaza.por_regularizar`. **No es
reversible** sin respaldo: por eso el paso 1.

## Pruebas críticas
1. **Limpieza:** después del paso 3, el pipeline está vacío; Estructura, Gestión de cargos (126 perfiles, sin
   GH-PF-001) y la plantilla siguen iguales.
2. **SEG-08:** con un usuario solo GH, intenta desactivar al superadmin: «Solo un superadmin puede modificar a un
   superadmin».
3. **SEL-04:** en Selección agrega un candidato sin cédula (no deja), luego «V-12.345.678»; agrégalo otra vez con
   «12345678»: «Esa cédula ya está postulada en esta requisición».
4. **ING-01/02:** lleva el candidato a «Ingreso»; en su ficha confirma el ingreso con la fecha de hoy. En la ficha
   del puesto (Plantilla) aparece como ocupante de la plaza.
5. **PF-10:** la descripción de cargo imprimible muestra el nombre del grupo de Configuración.

## Documentos actualizados
- `ESTADO.md`: versión 0.8.0, pasos después del despliegue, requisitos de la 0.8.1 y hallazgos del diagnóstico.
- `PRUEBAS.md`: nuevas SEG-08, SEL-04, ING-01 a ING-06, LIM-01 y PF-10; registro de la ejecución.
- `README.md`: ingreso y empleados, script de limpieza, plan.
- `UPDATE_0.8.0.md`: este documento.
- Sin cambios: `DESIGN.md` (se usan componentes existentes: formulario, chip, aviso).

## Revisión de código
- Corregido antes de entregar: en la ficha del candidato en «Ingreso» salía también «Esta candidatura está cerrada»
  bajo el formulario de confirmar; ya no.
- Ordenado de paso: en `admin.js`, las acciones de usuarios usan el ayudante `hacer` (avisos en vez de página de
  error) y la regla del superadmin vive en un solo lugar (`tocaSuper`).
- Visto y no tocado:
  - Después: los eventos de selección siguen enviando a n8n todos los datos del candidato (cédula, teléfono).
    Cambiarlo puede romper flujos de n8n que los usen: va con la 1.0 (notificaciones).
  - Después: asignar un rol con datos inválidos todavía muestra la página de error (con el mensaje correcto) en
    lugar de un aviso.
  - Después: el egreso (registrar la salida de un empleado) llega con la 0.8.1; mientras tanto, un reemplazo no se
    puede confirmar en una plaza ocupada.
- No se pudo verificar: despliegue en EasyPanel y que el flujo de n8n acepte el aviso nuevo `ingreso.confirmado`.
  Probado en PostgreSQL 16 real contra una copia de la base de EasyPanel con los Excel de organigramas cargados:
  migración 013, limpieza (historial encadenado intacto), flujo completo de ingreso, instalación desde cero y humo
  de la 0.7.12 sin regresiones; escritorio y móvil sin errores de JavaScript.
