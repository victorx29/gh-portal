# Parche 0.5.1 — sobre la 0.5

**Reemplazar:** package.json · src/services/estructura.js, requisiciones.js · src/views/usuario_rol.ejs, unidad_form.ejs, unidad_detalle.ejs, req_form.ejs
Sin migraciones ni dependencias nuevas: copiar, `git push` y redesplegar.

- Las listas de unidades muestran «Nombre · superior inmediato · empresas», y «✓ aprueba» cuando corresponde, en lugar del código.
- Una unidad corporativa sin empresas propias **hereda** las de su superior. Antes no se podía solicitar personal para ella.
  En el detalle de la unidad se ve «hereda de su superior …», o un aviso si no tiene ni puede heredar ninguna.
- Mensaje más claro cuando una unidad no está en el alcance del solicitante o no atiende a ninguna empresa.
