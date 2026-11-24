# Actualización 0.9.4 — Carga masiva de CV, lectura en n8n y número de candidato

Se aplica sobre la **0.9.3**. Trae una migración (019) y una variable de entorno nueva (`N8N_WEBHOOK_LECTURA_URL`).
No agrega dependencias. Trae un flujo nuevo de n8n: `n8n/gh-lectura-cv.json`.

## Pasos

1. **Respaldo completo de la base** en EasyPanel, guardado fuera del servidor.
2. Copia los archivos (zip de actualización), `git push` y redespliega. El log debe decir `migrada 019_carga_cv.sql`.
3. **n8n, flujo de lectura** (importa `n8n/gh-lectura-cv.json`; es aparte del de análisis):
   1. Credencial **Header Auth** «GH Portal x-api-key» (la misma del flujo de análisis): ponla en el Webhook y en los tres
      HTTP que hablan con el portal («Leer CV del portal», «Enviar datos al portal», «Informar error al portal»).
   2. Nodo **«OCR local (Mistral) — reemplazar URL»**: pon la dirección de tu Mistral OCR. Si tu servidor pide clave,
      agrégale su credencial. El flujo arma la petición con el formato de la API de Mistral (`POST /v1/ocr` con
      `document_url` o `image_url` en base64). Si tu servidor usa otro formato, ajusta «Preparar OCR» (petición) y «Unir
      páginas del OCR» (respuesta). En «Preparar OCR» pon el nombre del modelo en `MODELO_OCR`.
   3. Nodo **«Modelo local (reemplazar por el tuyo)»**: cámbialo por tu modelo de chat local (Ollama, vLLM, LM Studio…),
      conectado a la entrada *Model* de «Extraer datos (IA)». Temperatura 0.
   4. En «Validar datos», escribe el nombre de tus modelos en `MODELO`.
   5. Activa el flujo y copia la **Production URL** del Webhook, por la red interna de EasyPanel. Ejemplo:
      `http://autoretain_n8n:5678/webhook/gh-portal-cv-lectura`.
4. **Variables del portal** en EasyPanel:
   - `N8N_WEBHOOK_LECTURA_URL` = la URL del paso 3.5.
   - `N8N_API_KEY` y `PORTAL_URL_INTERNA` (o `PORTAL_URL`) ya deben estar desde la 0.9.0.

   Redespliega. Sin esta variable, la carga masiva funciona igual, pero no lee los CV: GH completa los datos a mano y el
   modal lo avisa.
5. **n8n, eventos generales:** los eventos de candidatura traen el campo nuevo `candidatura_codigo` (REQ-00001-C03).
   Úsalo en los correos si quieres.

## Qué cambia

**«Cargar CV»** (Selección, solo GH, requisición en Selección):

- Se suben hasta 30 CV a la vez: PDF y Word (.doc, .docx) de preferencia, también texto e imágenes (JPG, PNG); 5 MB c/u.
- La casilla «Confirmo haber notificado a los postulados sobre el uso de sus datos» es obligatoria y queda como
  consentimiento de cada uno.
- Por cada CV se crea un candidato con su número y un **nombre provisional** sacado del archivo
  («CV_Juan-Pérez.pdf» → «Juan Pérez»).
- Se omiten, y el aviso dice cuáles y por qué: formatos no admitidos, el mismo archivo dos veces y un CV ya cargado en esa
  requisición. Si un archivo pasa de 5 MB, no se carga ninguno.

**Número de candidato:** `REQ-00001-C03` = requisición + correlativo. Lo asigna la base al crearlo (también en «+ Candidato»)
y no cambia. Las candidaturas que ya existen se numeran por orden de creación. Aparece en la tarjeta, en la ficha y en los
eventos.

**Lectura en n8n:**

- Cada CV se manda a n8n (evento `cv.leer`). El OCR local lee el texto y el modelo local saca nombre, cédula, correo y
  teléfono.
- El portal **solo llena lo que está vacío**: nunca pisa lo que escribió GH.
- Guarda el texto leído: el análisis con IA lo usa después, sin volver a hacer OCR.
- **Alertas** (en la tarjeta y en la ficha):
  - lo que n8n no pudo leer (páginas sin texto, por ejemplo);
  - nombre, cédula o correo no encontrados;
  - cédula que no parece válida o que no coincide con la registrada;
  - muy poco texto (¿escaneado de baja calidad?);
  - **ya postuló antes** (con sus postulaciones), **duplicado en esta requisición**, o **es empleado activo**.
- «Marcar alertas como revisadas» quita el chip de la tarjeta; las alertas quedan en la ficha.
- Si la lectura falla o n8n no responde: «Reintentar lectura». Se puede pedir aunque esté en curso, para probar el flujo.

**Cédula y elegibles:**

- Si la cédula ya tiene ficha de otra postulación, el portal **no une solo**. En la ficha aparece «Unir con la ficha de…»: la
  candidatura y su CV pasan a la ficha anterior, que se completa con los datos que le falten. La ficha provisional queda
  marcada como unida; no se borra.
- Si la persona ya está en la misma requisición, la alerta dice «Duplicado»: se rechaza la candidatura repetida.

**«Editar datos del candidato»** (en la ficha):

- Nombre, cédula, correo y teléfono, con la casilla «unir con esa ficha».
- La cédula no se deja vacía una vez registrada y no cambia si la persona ya tuvo un ingreso.
- **Un candidato con nombre provisional no pasa a Ingreso.** La cédula sigue siendo obligatoria para Ingreso.

**«Analizar todos con IA»** (con confirmación):

- Pide el análisis de los candidatos activos con CV y consentimiento que aún no tienen análisis de su CV actual.
- Dice a quiénes omitió y por qué: sin CV, sin consentimiento, CV leyéndose, ya analizado o análisis en curso.
- No analiza rechazados ni ingresados. La IA sigue sin decidir ni mover a nadie.

**«Reintentar análisis»** (lo pediste):

- Aparece en la ficha con un análisis en curso o fallido.
- El análisis en curso queda como error «Reintentado por Gestión Humana» y se pide otro.
- Si n8n responde después al anterior, el portal lo rechaza.

**Consentimiento en la ficha:** ahora también es la casilla «Confirmo haber notificado al postulado…» en vez del texto
«¿cómo autorizó?».

**Tablero:**

- Un resumen arriba: CV leyéndose, con alertas, lecturas fallidas y candidatos sin cédula.
- Mientras haya lecturas o análisis en curso, consulta cada 15 s. Cuando llega algo, muestra «Llegaron resultados nuevos ·
  Actualizar», sin recargar sola.

**Corrección encontrada en las pruebas: el historial se trababa.**

- Dos operaciones que guardaban historial al mismo tiempo podían bloquearse entre sí («deadlock»), y una fallaba con «Error
  interno».
- Antes era raro; con n8n devolviendo varias lecturas a la vez pasaba siempre: en la prueba, 25 de 30 fallaban.
- La migración 019 cambia el disparador del historial. La cadena de hash queda igual de íntegra (probado con 30 escrituras
  simultáneas: sin fallos, sin huecos ni bifurcaciones).
- Toca un disparador que ya existía. Lo corregí porque sin esto la carga masiva falla.

## Archivos que cambian

| Archivo | Cambio |
|---|---|
| `db/migrations/019_carga_cv.sql` | Nuevo: número de candidato (con relleno), nombre provisional y «unido a», lectura y alertas del CV, corrección del disparador del historial. |
| `src/services/lectura.js` | Nuevo: carga masiva, lectura en n8n (API), alertas y cruce de cédula, «Analizar todos», aviso de resultados nuevos. |
| `src/services/ia.js` | «Reintentar análisis»; no se analiza mientras el CV se lee; huella del archivo al subir. |
| `src/services/seleccion.js` | Tablero con lectura, alertas y resumen; «Editar datos» y unir; nombre provisional no pasa a Ingreso; número en los eventos. |
| `src/services/outbox.js` | `cv.leer` va a `N8N_WEBHOOK_LECTURA_URL`; sin ella espera sin gastar intentos. |
| `src/controllers/seleccion.js` | Rutas: cargar CV, analizar todos, editar datos, leer, alertas revisadas, reintentar, estado; más formatos de CV. |
| `src/controllers/api.js` | API de lectura para n8n. |
| `src/config.js`, `.env.example` | `N8N_WEBHOOK_LECTURA_URL`. |
| Vistas | Nueva `cv_lote`; modificadas `seleccion` y `cand_detalle`. |
| `public/js/app.js` | Aviso de resultados nuevos; texto propio de la «O» al subir («Subiendo los CV…»). |
| `n8n/gh-lectura-cv.json` | Nuevo flujo: OCR local + extracción con modelo local. |
| `README.md` | Variable nueva y contrato de la API de lectura. |
| `package.json` | Versión 0.9.4. |

## Migraciones

- **019_carga_cv.sql:**
  - agrega columnas a `candidatura`, `candidato` y `cv_archivo`;
  - numera las candidaturas existentes;
  - crea dos disparadores (asignar el número y no cambiarlo);
  - reemplaza la función del disparador del historial.

  No borra datos.
- **Reversible:** antes de usar la 0.9.4, sí. Después, los números de candidato y las fichas unidas quedan en uso: volver atrás
  exige restaurar el respaldo.

## Pruebas críticas (las que te tocan, en tu navegador después de desplegar)

1. **INS-02:** el log muestra solo `migrada 019_carga_cv.sql`. Las candidaturas existentes muestran su número.
2. **CVL-01 y CVL-02:** en una requisición de prueba en Selección:
   - «Cargar CV» con los 6 CV de `cv-prueba.zip` más un archivo .zip o .gif.
   - Sin la casilla no se envía.
   - Con ella se crean 6 candidatos y el aviso dice que el .zip o el .gif no se cargó.
   - Repite con uno de los PDF: se omite por «ya está cargado».
3. **CVL-14:** con el flujo de lectura activo, en unos minutos el tablero avisa «Llegaron resultados nuevos». Revisa:
   - el PDF y el Word con sus datos;
   - el escaneado con alerta de poco texto o de OCR.
   - Apaga el OCR un momento, usa «Reintentar lectura» en uno y verifica «La lectura falló».
4. **CVL-07:** crea con «+ Candidato» a alguien con una cédula, en otra requisición. Sube un CV con esa misma cédula en esta:
   - sale «Ya postuló antes»;
   - «Unir con la ficha de…» lo une.
5. **CVL-09:** intenta avanzar a Ingreso a un candidato con «Nombre provisional»: no deja.
6. **CVL-12 y CVL-13:**
   - «Analizar todos con IA» y revisa el aviso de omitidos.
   - En una ficha con análisis en curso, usa «Reintentar análisis».
   - En n8n, revisa que la ejecución nueva llega.
7. Móvil: el tablero y el modal «Cargar CV».

## Revisión de código

- **Corregido antes de entregar:**
  - [Seguro] Deadlock del historial con escrituras en paralelo (ver arriba).
  - [Seguro] Si la carga masiva fallaba a la mitad con un error interno, se borraban del disco los CV de los candidatos que
    sí se habían creado. Ahora solo se borran los que no se guardaron.
  - [Seguro] Un candidato con el nombre del archivo podía llegar a Ingreso y crear la ficha del empleado con ese nombre.
    Ahora se bloquea.
  - [Seguro] La ficha mostraba el código de la requisición en lugar del número del candidato.
- **Ordenado de paso:**
  - `lectura.js` usa la dirección del portal y la validación de correo de un solo lugar (`ia.js` y `lectura.js`), en vez de
    copiarlas.
- **Visto y no tocado:**
  - [Ahora, propuesta; ya estaba en el diagnóstico] Los eventos de selección siguen llevando la cédula y el teléfono del
    candidato.
  - [Después] La numeración de las filas del historial queda con saltos (el número tomado antes del candado no se usa). No
    afecta la cadena. [Seguro]
  - [Después] `outbox.js` mantiene abierta la transacción mientras envía a n8n (diagnóstico del 19-11). Con la carga masiva
    son más eventos; con 30 CV el envío tarda unos segundos más. [Probable]
  - [Después] El chip `.chip.r` (rojo) ya existía en `app.css`, pero no está en DESIGN.md: lo uso para «La lectura falló».
    Propuesta: documentarlo en DESIGN.md (necesito tu visto bueno).
- **No se pudo verificar:**
  - EasyPanel.
  - Tu Mistral OCR y tu modelo local: probé con un n8n simulado por HTTP que responde como el flujo, y los nodos de código del
    flujo fuera de n8n.
  - El formato real de la API de tu OCR.
  - Safari.

## Documentos actualizados

- `ESTADO.md`: versión, 0.9.4 en «Hecho», decisiones del 23/24-11-2026 y supuestos por confirmar.
- `PRUEBAS.md`: IA-09, IA-10, CVL-01 a 14, EV-06, HIS-01; IA-01 e IA-02 pasan a «Obsoletas»; registro de la ejecución.
- `README.md`: variable `N8N_WEBHOOK_LECTURA_URL` y contrato de la API de lectura.
- `UPDATE_0.9.4.md`: este documento.
- Sin cambios: `DESIGN.md` (solo componentes existentes; ver la propuesta del chip rojo) y `DECISIONES.md` (no está en el
  repo; las decisiones quedan en ESTADO.md).
