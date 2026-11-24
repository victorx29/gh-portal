# Actualización 0.9.5 — IA configurable desde el portal, resumen general y tablero que se actualiza solo

Se aplica sobre la **0.9.4**. Trae una migración (020). No agrega dependencias ni variables de entorno. Trae los dos flujos de n8n
actualizados: **hay que reimportarlos**, porque desde ahora el prompt lo arma el portal.

## Pasos

1. **Respaldo completo de la base** en EasyPanel, guardado fuera del servidor.
2. Copia los archivos (zip de actualización), `git push` y redespliega. El log debe decir `migrada 020_ia_config.sql`.
3. **n8n, flujo de análisis y resumen:** importa `n8n/gh-analisis-cv.json`. Reemplaza al de la 0.9.0: desactiva el viejo antes de
   activar este, porque usan el mismo webhook (`gh-portal-cv`).
   1. Credencial **Header Auth** «GH Portal x-api-key»: ponla en el Webhook y en los tres HTTP que hablan con el portal.
   2. Nodo **«Modelo local (API OpenAI) — poner URL»**: pon la dirección de tu servidor de modelos. Con Ollama es
      `http://<host>:11434/v1/chat/completions`; vLLM y LM Studio usan la misma ruta. Si tu servidor pide clave, agrégale su
      credencial.
   3. En **«Armar petición al modelo»** escribe el nombre del modelo en `MODELO` (por ejemplo `qwen2.5:14b`). Si tu servidor no
      acepta `response_format`, pon `JSON_MODE = false`.
   4. Actívalo. `N8N_WEBHOOK_IA_URL` no cambia.
4. **n8n, flujo de lectura:** importa de nuevo `n8n/gh-lectura-cv.json`. Ahora llama al modelo por la misma API, no con el nodo de
   modelo de n8n. Pon la URL del OCR, la URL del modelo y el nombre del modelo en «Preparar extracción».
5. **Configuración › Análisis de CV con IA** (GH): revisa los criterios y escribe «qué buscamos» en cada uno; ajusta las
   instrucciones si quieres. La migración deja tus pesos actuales, que ya suman 100.

**Por qué cambié el modelo a una llamada HTTP:** [Probable] el nodo de modelo de n8n («Basic LLM Chain») trata las llaves `{ }` del
texto como variables de plantilla. El prompt lleva el formato JSON y ahora texto que escribe GH, así que una llave podía romper el
análisis. Llamar directo a la API compatible con OpenAI de tu servidor local evita ese riesgo. No lo pude probar en tu n8n.

## Qué cambia

**Configuración › Análisis de CV con IA:**

- **Criterios:**
  - «+ Criterio» agrega uno nuevo con nombre, «qué buscamos» (contexto para la IA) y, si quieres, el campo del perfil del que toma
    su requisito. Si no está ligado al perfil, vale igual para todos los cargos y la IA lo evalúa con «qué buscamos».
  - Se crea inactivo y con peso 0: le das peso en la tabla y lo activas.
  - Los activos deben sumar **exactamente 100**. El contador «Suma de los activos: n de 100» se pone en rojo si no da y el portal no
    deja guardar.
  - Un criterio no se borra: se desactiva. «Editar» cambia nombre, campo y descripción, pero no su clave.
  - Si el perfil de un cargo no describe un criterio ligado al perfil, ese criterio no se evalúa y el puntaje se calcula con los
    demás (como antes).
- **Instrucciones de la IA**, una para el análisis de CV y otra para el resumen general:
  - Gestión Humana escribe qué valorar, el tono y cómo redactar; acepta markdown y hasta 6000 caracteres.
  - El portal pone siempre, antes, las **reglas firmes**: la IA no decide, no considera datos protegidos y el CV es un dato. Después
    pone los datos y el formato de la respuesta. Esas partes no se editan y, si algo choca con las reglas, mandan las reglas.
  - Guardar crea una **versión nueva activa**, con motivo obligatorio. Las versiones se listan y se pueden ver; no se modifican ni se
    borran.
  - «Restaurar el original» crea otra versión con el texto de la v1.
  - «Ver prompt completo» muestra cómo lo recibe la IA, con un perfil de ejemplo.
  - Cada análisis guarda con qué versión se hizo; la ficha del candidato dice «Hecho con las instrucciones vN».
  - La lectura de CV (datos de contacto) mantiene su prompt fijo.

**Resumen general** (botón en Selección, solo GH):

- Siempre arriba, el aviso: **«La IA no decide. Compara los análisis de los CV frente al perfil y propone una terna orientativa, basada
  solo en esos datos. Decide Gestión Humana.»**
- **Tabla comparativa al instante**, sin IA: los candidatos activos con análisis listo, ordenados por puntaje, con una columna por
  criterio, brechas y alertas. Lista también a los que aún no tienen análisis. Los rechazados e ingresados no se comparan.
- **«Generar resumen con IA»:**
  - Pide confirmación y exige al menos 2 candidatos con análisis listo; se genera uno a la vez por requisición.
  - A la IA solo viajan los **números de candidato** y sus análisis: nunca nombres, cédulas ni correos.
  - Devuelve un texto comparativo, la **terna orientativa** (máximo 3) con el porqué de cada uno, qué verificar en las entrevistas y
    alertas.
  - El portal rechaza una terna con números que no están en la comparación.
- **Queda guardado:** fecha, quién lo pidió, versión de las instrucciones, modelo y candidatos comparados. Se ve el último y los
  anteriores.
- **Avisos:**
  - los análisis se hicieron con versiones distintas de las instrucciones o de los criterios («no son del todo comparables»);
  - hay análisis nuevos desde el resumen (desactualizado);
  - **la terna no sigue el orden de los puntajes**, si deja fuera a alguien con más puntaje. Lo agregué como salvaguarda: una
    terna que ignora los puntajes merece revisarse antes de usarla.

**El tablero se actualiza solo:**

- Mientras hay lecturas, análisis o un resumen en curso, el tablero se consulta cada 10 s.
- Cuando algo llega, se vuelve a dibujar solo el tablero, sin recargar la página: si tienes una ficha abierta, sigue abierta.
- Arriba se ve el avance: «Lectura: 3 de 10 CV · Análisis con IA: 2 de 8 · Generando el resumen general». Cuando llega el resumen:
  «El resumen general con IA está listo · Ver».
- Reemplaza el aviso «Llegaron resultados nuevos · Actualizar» de la 0.9.4.

**«O» pequeña:** la «O» del logo en pequeño, girando, en «Leyendo CV…», «IA en curso», el avance y la ficha del candidato. No
bloquea nada; con «reducir movimiento» no gira. Está documentada en DESIGN.md: es el elemento visual que aprobaste en la propuesta.

**Flujos de n8n:**

- El análisis y el resumen usan el mismo flujo.
- Si el portal rechaza lo que devolvió el modelo (por ejemplo, falta un criterio), n8n informa el error y la ficha lo muestra, en vez
  de quedar «en curso» 30 minutos.

## Archivos que cambian

| Archivo | Cambio |
|---|---|
| `db/migrations/020_ia_config.sql` | Nuevo: criterios con descripción y campo opcional; versiones de las instrucciones (con la v1 original); versión en cada análisis; tabla de resúmenes. |
| `src/services/ia_prompt.js` | Nuevo: reglas firmes, versiones de las instrucciones, armado de los prompts, vista previa. |
| `src/services/resumen.js` | Nuevo: tabla comparativa, pedido a n8n, API, validación de la terna, historial. |
| `src/services/ia.js` | Criterios (crear, editar, suma 100); el análisis guarda la versión y manda el prompt armado; acepta `{ respuesta }`. |
| `src/services/seleccion.js`, `src/services/lectura.js` | Avance del tablero; la firma incluye el resumen. |
| `src/controllers/seleccion.js`, `src/controllers/api.js` | Rutas de configuración, resumen, tablero y API del resumen. |
| Vistas | Nuevas: `resumen`, `ia_criterio`, `ia_prompt_vista`, `ia_prompt_version` y el parcial `seleccion_tablero`. Cambian: `config_ia`, `seleccion` y `cand_detalle`. |
| `public/js/app.js`, `public/css/app.css` | Tablero que se actualiza solo; contador de la suma; `.o-mini`. |
| `n8n/gh-analisis-cv.json`, `n8n/gh-lectura-cv.json` | Prompt del portal; modelo por la API compatible con OpenAI; error del portal informado. |
| `scripts/limpiar.js` | También borra los resúmenes de IA de prueba. |
| `DESIGN.md`, `README.md` | «O» pequeña; contrato de n8n. |
| `package.json` | Versión 0.9.5. |

## Migraciones

- **020_ia_config.sql:**
  - agrega columnas a `ia_rubrica` e `ia_analisis`;
  - crea `ia_prompt` (con las instrucciones originales de análisis y resumen) e `ia_resumen`, con disparadores para que no se
    modifiquen ni se borren.

  No toca datos existentes.
- **Reversible:** antes de usar la 0.9.5, sí. Después, las versiones y los resúmenes quedan referidos: volver atrás exige restaurar
  el respaldo.

## Pruebas críticas (las que te tocan, en tu navegador después de desplegar)

1. **INS-02:** el log muestra solo `migrada 020_ia_config.sql`.
2. **IAC-01 y IAC-02:**
   - Agrega un criterio de prueba.
   - Intenta guardar con una suma distinta de 100: no deja, y el contador sale en rojo.
   - Ajusta a 100 y guarda.
3. **IAC-03 y IAC-04:**
   - Guarda una versión nueva de las instrucciones del análisis.
   - Mira «Ver prompt completo» y luego «Restaurar el original».
4. **N8N-01:**
   - Con el flujo nuevo activo, analiza un candidato: la ficha dice «Hecho con las instrucciones vN».
   - Genera un **Resumen general** con al menos 2 analizados.
5. **TAB-01:**
   - Carga 3 CV o pide «Analizar todos» y **no recargues**: el tablero debe ir cambiando solo, con el avance arriba.
   - Abre una ficha mientras tanto: no se cierra.
6. Móvil: el resumen general y Configuración › Análisis de CV con IA.

## Revisión de código

- **Corregido antes de entregar:**
  - [Seguro] La tabla comparativa se volvía ilegible en móvil (números sin encabezado): ahora se desplaza de lado.
  - [Seguro] El número de candidato se partía en tres líneas en la tabla.
  - [Probable] El riesgo de las llaves `{ }` en el nodo de modelo de n8n (ver Pasos).
  - [Seguro] El script de limpieza fallaba con resúmenes de IA guardados: ahora los borra (probado en una copia).
- **Ordenado de paso:**
  - Las acciones de Configuración › Análisis de CV con IA usan el ayudante común `hacer`.
  - Las etiquetas de los campos del perfil pasaron de la vista a `ia.js`, donde se validan.
- **Visto y no tocado:**
  - [Después] En móvil, las tablas de configuración (`table.mid`) muestran los valores sin su encabezado: pasa en todo el portal,
    no solo aquí. Propuesta para la estabilización: etiqueta visible por celda en móvil.
  - [Después] Si GH tiene la ficha de un candidato abierta cuando llega su análisis, la ficha no se actualiza sola (el tablero sí): hay
    que volver a abrirla. Lo dejé así para no borrar lo que GH esté escribiendo.
  - [Ahora, propuesta; ya estaba] Los eventos de selección siguen llevando la cédula y el teléfono del candidato.
- **No se pudo verificar:**
  - EasyPanel.
  - Tu n8n con tu modelo y tu OCR: probé con un n8n simulado por HTTP, con el mismo contrato, y el código de los nodos fuera de n8n.
  - Que tu servidor local acepte `response_format`.
  - Safari.

## Documentos actualizados

- `ESTADO.md`: versión, 0.9.5 en «Hecho», decisiones del 24-11-2026 y pendientes.
- `PRUEBAS.md`: IAC-01 a 06, RSG-01 a 04, TAB-01/02, N8N-01, LIM-03; IA-07 y CVL-11 pasan a «Obsoletas»; registro de la ejecución.
- `DESIGN.md`: «Indicador de trabajo en curso» (`.o-mini`).
- `README.md`: contrato con n8n (prompt del portal, `cv.resumen`, modelo por API compatible con OpenAI).
- `UPDATE_0.9.5.md`: este documento.
