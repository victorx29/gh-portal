# Actualización 0.7.1 — Perfiles con el formato de GH, importación de Word e impresión de la descripción de cargo

Se aplica sobre la **0.7**. Trae una migración nueva (008). `jszip` pasa a estar declarado en `package.json`: ya estaba instalado como parte de `exceljs`, pero conviene ejecutar `npm install` y subir el `package-lock.json`.

## Pasos
1. **Backup de la base de datos.**
2. Copia los archivos, ejecuta `npm install`, haz `git push` y redespliega. El log debe decir `migrada 008_perfil_control.sql`.
3. **Gestión de cargos › Importar Word:** sube las descripciones de cargo (puedes hacerlo por dirección). Revisa la vista previa, corrige los nombres repetidos y aplica.
4. **Plantilla de puestos:** crea los puestos de los cargos importados. Es lo que define «Departamento» y «Reporta a» en el documento impreso.

## Qué cambia
- **Contenido del perfil con tu formato:** objetivo, funciones (lista), educación, experiencia (texto, más años mínimo y máximo que el portal calcula solo: «entre 4 y 5» → 4–5, «más de 6» → 6), conocimientos, certificaciones, idiomas, competencias conductuales, competencias (con descripción opcional) y responsabilidades (dinero, información confidencial, toma de decisiones, supervisión). Además, los criterios de evaluación de CV que usará la IA.
  - Las versiones anteriores se siguen leyendo: su «Requisitos» se muestra como «Educación».
  - **No se guardan en el perfil** «Departamento», «Reporta a» ni «Trabajador ocupante». Salen de la plantilla (el puesto) y, desde la 0.8, de los empleados.
- **Importar Word (.docx):** hasta 300 documentos de 5 MB por carga. Lee la plantilla de GH, incluidas sus variantes (con o sin la tabla de control, y «Competencias clave» con descripciones).
  - La vista previa muestra, por documento: perfil nuevo, nueva versión (el cargo ya existe y su contenido cambió) o sin cambios, más lo leído y los avisos.
  - **Puedes corregir el nombre del cargo en la vista previa**, sin editar el Word. Dos documentos con el mismo cargo bloquean la importación hasta renombrar uno.
  - Si el «Reporta a» del Word no coincide con la plantilla, se avisa. **Manda la plantilla.**
  - La fecha de actualización del Word se guarda en el control documental.
  - Alcance de los perfiles nuevos: sin alcance (GH lo asigna después), general, o una unidad y sus dependientes.
- **Descripción de cargo para imprimir (PDF):** desde el perfil, con el formato de GH.
  - Departamento, unidad y «Reporta a» salen de la plantilla vigente; si el perfil está en varios puestos, eliges cuál.
  - Incluye el código de versión y el control documental.
- **Control documental ISO (registro simple)**, por versión: fecha de actualización, revisado por, fecha de revisión, aprobado por y fecha de aprobación. La aprobación no puede ser anterior a la revisión. Queda en el historial.
- **Excel de perfiles** con las columnas del formato nuevo. El Excel anterior ya no coincide: descarga el nuevo antes de editar.
- **Correcciones:**
  - los nombres de archivo con acentos se deformaban («TecnologÃ­a») en las cargas y en los **adjuntos de las requisiciones**;
  - un adjunto rechazado dejaba el archivo huérfano en el disco.

## Pruebas críticas
1. Importa las 8 descripciones de Tecnología: 8 perfiles nuevos, los dos «Analista de Servicios Tecnológicos» bloqueados hasta renombrarlos.
2. Renómbralos en la vista previa («(Plataforma y soporte)» y «(Telecomunicaciones)») y aplica.
3. Vuelve a importar los mismos documentos: «Sin cambios».
4. Crea el puesto del Jefe de Gestión de Aplicaciones en la plantilla e imprime su descripción: «Reporta a» sale de la plantilla, no del Word.
5. Registra la revisión y la aprobación de una versión: aparecen en la descripción impresa.
6. Crea un perfil por formulario con los campos nuevos. Un gerente lo ve completo en el formulario de requisición.
7. Adjunta a una requisición un archivo con acentos en el nombre: se ve y se descarga con su nombre correcto.
