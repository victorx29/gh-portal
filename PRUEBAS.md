# PRUEBAS.md — Pruebas de regresión del Portal de Gestión Humana

Lista acumulada de las pruebas críticas de todas las entregas (0.3 a 0.9.0), ordenada por módulo. Mientras
el portal no tenga pruebas automáticas, esta lista es la única forma de saber si una versión rompió algo que
antes funcionaba.

## Cómo se usa

- **Humo (H):** en cada entrega, antes de darla por buena. Son pocas y cubren lo que no puede romperse.
- **Completa (C):** en la versión de estabilización, antes de la 1.0 y antes de cualquier migración grande.
- **Automatizar (A):** candidatas a prueba automática en la versión de estabilización.
- Usar siempre **datos ficticios** (unidades, personas y empresas de prueba). Nunca datos del Listado de
  Activos.
- Cada entrega agrega sus pruebas aquí y marca como obsoletas las que dejan de aplicar (no se borran).
- Resultado de cada ejecución en «Registro de ejecuciones», al final.

**Usuarios de prueba necesarios:** superadmin, GH, gerente de una gerencia, director de su dirección
(«Aprueba»), Presidencia y un segundo gerente de otra rama.

---

## 1. Instalación, actualización y arranque

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| INS-01 | Instalación desde cero en una base vacía: arranca, el log muestra todas las migraciones (001 a la última) y `/health` responde «ok». | H · A | Instrucciones |
| INS-02 | Actualización desde la versión anterior con datos: arranca, el log muestra solo las migraciones nuevas y los datos previos siguen visibles. | H | Instrucciones |
| INS-03 | Arrancar dos veces seguidas: la segunda no aplica ninguna migración. | C · A | 0.3 |
| INS-04 | La zona horaria de la base es `America/Caracas` (o el aviso de permisos aparece en el log). | C | 0.5 |
| INS-05 | Un adjunto subido sobrevive a un redespliegue (volumen persistente de `uploads`). | C | 0.4 |

## 2. Acceso y permisos

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| SEG-01 | Sin sesión, cualquier página interna redirige a `/login`. | H · A | 0.3 |
| SEG-02 | Un POST sin el token `_csrf` correcto es rechazado. | C · A | 0.3 |
| SEG-03 | Un gerente no puede abrir rutas de Configuración (estructura, plantilla, perfiles, usuarios) aunque escriba la URL: «Solo Gestión Humana». | H · A | 0.5 |
| SEG-04 | Un usuario desactivado no puede entrar. | C · A | 0.3 |
| SEG-08 | GH no puede desactivar a un superadmin ni quitarle roles; nadie retira ni desactiva al último superadmin activo; crear usuario, asignar o retirar rol y activar o desactivar quedan en el historial. | H · A | 0.8.0 |
| SEG-05 | APB no muestra datos de ARO y viceversa (filtros, listas, eventos). Solo aplica cuando exista la instalación ARO. | C | Instrucciones |
| SEG-06 | **(1.0)** Una cuenta del tenant que no está dada de alta en el portal es rechazada con «No tienes acceso» y queda registrado el intento. | H · A | 1.0, pendiente |
| SEG-07 | **(1.0)** Un usuario desactivado en Entra ID no puede entrar al portal. | C | 1.0, pendiente |

## 3. Estructura organizativa

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| EST-01 | Hacer que una dirección dependa de una de sus gerencias: se rechaza por ciclo. | H · A | 0.5 |
| EST-02 | Cambiar la dependencia de una unidad: se cierra la anterior con fecha de hoy y se abre la nueva; «Ver estructura al» con fecha de ayer muestra la anterior. | C · A | 0.5 |
| EST-03 | Una dependencia no se puede borrar ni modificar después de cerrada (también por fuera del portal, directo en la base). | C · A | 0.5 |
| EST-04 | Una unidad corporativa sin empresas hereda las de su superior; el detalle dice «hereda de su superior …». | C | 0.5.1 |
| EST-05 | Filtro por división en Estructura: incluye los servicios compartidos que atienden a sus empresas. | C | 0.6 |
| EST-06 | Listas de unidades en escalera; el buscador encuentra «admin» y un código (UO-…), conservando los superiores. | C | 0.6.2 |
| EST-07 | Desactivar una unidad con dependientes, puestos, roles o requisiciones en curso: se rechaza y el detalle lista qué falta. | H · A | 0.7.7 |
| EST-08 | Crear una unidad vacía y desactivarla: pide confirmación y se desactiva. | C | 0.7.7 |

## 4. Aprobación

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| APR-01 | Gerente solicita en su gerencia → aprueba el director de la primera unidad «Aprueba» hacia arriba. | H · A | 0.5 |
| APR-02 | El detalle muestra la foto de la cadena («Gerencia › Dirección (aprobó)»); cambiar luego la estructura no altera la foto. | C · A | 0.5 |
| APR-03 | Unidad aprobadora sin director: la requisición queda «Sin aprobador», se emite `requisicion.sin_aprobador` y avanza al asignar el director. | C | 0.5 |
| APR-04 | Unidad aprobadora inactiva: la requisición queda retenida con el motivo visible para GH y no sube sola. Al reactivarla, el director la recibe. | C · A | 0.7.7 |
| APR-05 | Cargo nuevo: aprueba el director y después Presidencia; reemplazo: solo el director. | H · A | 0.5 |
| APR-06 | Nadie aprueba su propia requisición; GH no puede aprobar. | C · A | 0.3 |
| APR-07 | Devolver exige comentario y vuelve a borrador; rechazar cierra y pide confirmación. | C | 0.4 / 0.7.3 |
| APR-08 | Regla de transición: un director con rol por empresa sigue aprobando si ninguna unidad de la cadena «Aprueba». | C | 0.5 |

## 5. Requisiciones

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| REQ-01 | Reemplazo: al elegir la unidad aparecen sus plazas; las congeladas y cerradas no aparecen; el cargo sale del puesto. | H | 0.7.2 |
| REQ-02 | Dos requisiciones con la misma plaza: la segunda se rechaza («en proceso con REQ-…»). | H · A | 0.7.2 |
| REQ-03 | Anular un borrador libera su plaza. | C · A | 0.7.2 |
| REQ-04 | Cargo nuevo aprobado por Presidencia crea la plaza (y el puesto si no existía) enlazada a la requisición. | H · A | 0.7.2 |
| REQ-05 | Plaza «Por definir» toma la empresa de la requisición al aprobarse. | C | 0.7.2 |
| REQ-06 | GH cambia la empresa de una requisición aprobada por Presidencia: pide confirmación, cambia también la plaza, la línea de tiempo muestra «CIM → MDV» y la foto de aprobación no cambia. | C | 0.7.2 |
| REQ-07 | El solicitante solo ve perfiles de la empresa y unidad elegidas; el servidor lo valida al guardar. | C · A | 0.6 |
| REQ-08 | La requisición guarda la versión activa del perfil; editar después el perfil no cambia la versión de la requisición. | C · A | 0.6 |
| REQ-09 | Requisición temporal con equipos y accesos: los datos aparecen en el detalle y en la línea de tiempo. | C | 0.4 |
| REQ-10 | Adjuntar un PDF con acentos en el nombre: otro usuario involucrado lo descarga con el nombre correcto. | C | 0.4 / 0.7.1 |
| REQ-11 | Comentarios no editables; la nota interna solo la ve GH. | C · A | 0.4 |
| REQ-12 | Eliminar solo un borrador nunca enviado y sin comentarios; en otro caso, solo anular. | C | 0.4 |

## 6. Plantilla de puestos y plazas

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| PL-01 | Segundo puesto jefe en la misma unidad: se rechaza. | C · A | 0.7 |
| PL-02 | Excepción de reporte que crea un ciclo: se rechaza. | C · A | 0.7 |
| PL-03 | Plazas con fecha futura salen como proyectadas; con «Plantilla al» en esa fecha, cuentan en el HC. | C · A | 0.7 |
| PL-04 | Congelar y cerrar plazas piden motivo; una plaza cerrada no se modifica. | H · A | 0.7 |
| PL-05 | Puestos y plazas no se pueden borrar, tampoco directo en la base. | C · A | 0.7 |
| PL-06 | Crear un puesto con un cargo que ya existe en la unidad abre ese puesto con «Agregar plazas». | C | 0.7.3 |
| PL-07 | «Nuevo puesto» filtra perfiles por la unidad (su alcance, superiores y generales); «Mostrar perfiles de otras áreas» muestra todos. | C | 0.7.5 |
| PL-08 | Mover un puesto: conserva sus plazas y códigos, queda en el historial; mover un jefe a una unidad con jefe se rechaza. | C | 0.7.6 |
| PL-09 | Línea punteada entre puestos: se crea con motivo, no cambia a quién reporta, no se repite ni apunta a sí misma; cerrada no se modifica. | C · A | 0.7.11 |
| PL-10 | Un puesto con líneas punteadas vigentes no se desactiva sin cerrarlas. | C | 0.7.11 |
| PL-12 | Línea punteada hacia el jefe directo se rechaza, tanto si es jefe por la regla de la unidad como por excepción; hacia otro puesto se acepta. | C · A | 0.7.12 |
| PL-11 | Pasantes, becarios, aprendices y outsourcing no suman al HC de nómina. | C · A | 0.7 / 0.7.3 |

## 7. Perfiles y cargos

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| PF-01 | Código automático GH-PF-NNN; editar el contenido crea la versión siguiente y la deja activa. | H · A | 0.6 |
| PF-02 | Activar una versión anterior y luego desactivar el perfil: deja de aparecer en el formulario de requisición. | C | 0.6 |
| PF-03 | Las versiones de perfil no se pueden modificar (también directo en la base). | C · A | 0.6 |
| PF-04 | Importar Word: perfiles nuevos; dos documentos con el mismo cargo bloquean hasta renombrar uno en la vista previa; reimportar da «Sin cambios». | C | 0.7.1 |
| PF-05 | Descripción imprimible: «Departamento» y «Reporta a» salen de la plantilla, no del Word; incluye versión y control documental. | C | 0.7.1 |
| PF-06 | Control documental: la fecha de aprobación no puede ser anterior a la de revisión. | C · A | 0.7.1 |
| PF-07 | Filtros: «Activos sin descripción», «Alcance (área)» con y sin dependientes, «General» y «Sin alcance». | C | 0.7.3 / 0.7.4 |
| PF-08 | Nivel jerárquico inexistente en el Excel de perfiles: error por fila. | C | 0.7.8 |
| PF-09 | Perfiles: un Excel descargado (también uno anterior a la 0.7.13) subido sin cambios no crea versiones, aunque una función tenga «;» dentro; editar una función crea una sola versión y deja las demás enteras; una línea escrita a mano «A; B; C» da tres funciones. | H · A | 0.7.13 |
| PF-10 | Descripción de cargo imprimible: el nombre del grupo sale de la base (Configuración › Empresas › Grupo), no del código. | C | 0.8.0 |

## 8. Cargas masivas (estructura, perfiles, plantilla)

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| CM-01 | Descargar el Excel y subirlo sin cambios: «No hay nada que aplicar» (estructura, perfiles y plantilla). | H · A | 0.5 / 0.6 / 0.7 |
| CM-02 | Un error en una fila bloquea toda la carga; una advertencia no. | C · A | 0.5 |
| CM-03 | La carga se aplica en una sola transacción: si falla a mitad, no queda nada a medias. | C · A | 0.5 |
| CM-04 | Plantilla: menos plazas en el archivo cierra las sobrantes con fecha de hoy; los puestos ausentes del archivo no se tocan. | C · A | 0.7 |
| CM-05 | Plantilla: columna «Funcional de» vacía cierra las líneas punteadas; un Excel antiguo sin esa columna no las toca. | C | 0.7.11 |
| CM-06 | Archivo que no es .xlsx o mayor de 5 MB: se rechaza con mensaje. | C | 0.5 |
| CM-07 | Plantilla: «Funcional de» con una referencia inexistente da error por fila mostrando la referencia como se escribió; hacia el jefe directo, el aplicar se rechaza («apunta a su jefe directo») y no queda nada aplicado. | C | 0.7.12 |

## 9. Diagrama de estructura

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| DG-01 | «Ver diagrama» carga toda la estructura sin errores. | H | 0.6.1 |
| DG-02 | CIM + MDV muestra la administración compartida una sola vez; el título lleva ambas razones sociales. | C | 0.6.1 / 0.6.4 |
| DG-03 | «Desde la unidad» = Dirección de Contraloría: aparecen las administraciones de los concesionarios con borde punteado. | C | 0.6.1 |
| DG-04 | Tipos a mostrar: ocultar Gerencia conecta las jefaturas a su dirección con línea gris discontinua. | C | 0.6.3 |
| DG-05 | Disposiciones horizontal, compacta y cascada; imprimir sale en una sola hoja con la orientación correcta. | C | 0.6.3 / 0.6.4 |
| DG-06 | «Ver: Cargos»: clic en una caja abre el puesto, no otra área; «Ver: Unidades» abre la unidad. | H | 0.7.9 |
| DG-07 | Modalidades: por defecto solo nómina propia; al marcar Pasante aparecen y el título lo indica. | C | 0.7.3 |
| DG-08 | Niveles jerárquicos: cada nivel es una fila; un cargo con nivel igual o superior a su jefe se marca en naranja punteado. | C | 0.7.8 |
| DG-09 | Modo edición: «+ Cargo que le reporta» crea el cargo y vuelve al diagrama con el mismo zoom y la caja abierta en el panel. | C | 0.7.9 |
| DG-10 | El panel de edición se desplaza hasta el historial en página normal, pantalla completa y móvil. | C | 0.7.10 |
| DG-11 | Filtro por una empresa que solo tiene plazas en una unidad corporativa: la unidad y su puesto aparecen. | C | 0.7 |
| DG-12 | Línea punteada entre dos cajas de la misma fila con otra caja en medio: va por el pasillo de arriba o de abajo, nunca por debajo de la caja intermedia (en Ver: Cargos y Ver: Unidades, las tres disposiciones). | H | 0.7.12 |

## 10. Pipelines y selección

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| SEL-01 | Pipeline personalizado con columna «Requiere resultado Apto»: GH no puede mover la tarjeta sin registrar el resultado. | C · A | 0.3 |
| SEL-02 | Cambiar la empresa de una requisición a una cuyo pipeline no tiene su etapa: se bloquea. | C | 0.7.2 |
| SEL-03 | El tablero, Pipelines y Selección muestran la razón social, no el nombre comercial. | C | 0.6.1 |
| SEL-04 | Candidato: la cédula es obligatoria; «V-12.345.678» y «12345678» son la misma persona; la misma cédula en la misma requisición se rechaza y en otra reutiliza la ficha y muestra sus postulaciones anteriores. | H · A | 0.8.0 |

## 10b. Ingreso y empleados

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| ING-01 | Candidato llega a «Ingreso»: queda «por ingresar» en la plaza de la requisición; la ficha del puesto lo muestra. Un segundo candidato a la misma plaza se rechaza. | H · A | 0.8.0 |
| ING-02 | «Confirmar ingreso»: solo GH; fecha futura se rechaza; con la fecha real la persona ocupa la plaza (aparece en la ficha del puesto con su fecha) y sale el evento `ingreso.confirmado` sin cédula. | H · A | 0.8.0 |
| ING-03 | Reemplazo de una plaza ocupada: el nuevo queda «por ingresar», pero no se confirma mientras el ocupante siga activo. | C · A | 0.8.0 |
| ING-04 | «No se presentó» exige motivo y libera la plaza; una relación cerrada no se modifica ni se borra (también en la base). | C · A | 0.8.0 |
| ING-05 | Movimiento interno: un empleado que ingresa a otra plaza deja la anterior como «movido»; nunca hay dos relaciones activas para la misma persona. | C · A | 0.8.0 |
| ING-06 | Plaza «por regularizar»: no se puede pedir su reemplazo ni confirmar un ingreso en ella. | C · A | 0.8.0 |
| LIM-01 | `npm run limpiar -- transacciones` sin `--aplicar` solo muestra; con `--aplicar` exige PERMITIR_LIMPIEZA=si; borra requisiciones, selección e ingresos de selección; no toca estructura, perfiles, plantilla ni usuarios; el historial queda encadenado y registra la limpieza. | C | 0.8.0 |

## 10c. Base de empleados, importación del Listado y organigrama (0.9.0)

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| EMP-01 | `/empleados`, la ficha y el egreso son solo de GH: un gerente recibe 403 (también por URL directa). | H · A | 0.9.0 |
| EMP-02 | Abrir una ficha registra la consulta (quién y cuándo) y la ficha muestra las últimas consultas. | C · A | 0.9.0 |
| EMP-03 | Búsqueda por cédula con o sin puntos y «V-» encuentra a la persona; por nombre, por coincidencia parcial. | C | 0.9.0 |
| IMP-01 | Importar el Listado: vista previa con resumen, pendientes por estructura y por equivalencia, advertencias; los títulos de sección y los encabezados repetidos de una hoja no son errores; socios y «APB/ARO GROUP» excluidos. | H | 0.9.0 |
| IMP-02 | Aplicar y volver a subir el mismo Listado: «Sin cambios» para todos, nada que aplicar. | H · A | 0.9.0 |
| IMP-03 | Persona sin plaza autorizada: queda en una plaza «por regularizar» (no cuenta en el HC, ⚑ en el diagrama); con plaza libre del mismo cargo, la ocupa. | C · A | 0.9.0 |
| IMP-04 | Equivalencias: descargar (trae lo que falta del último Listado), subir, vista previa, aplicar; unidad o perfil inexistente es error; queda en el historial con el valor anterior. | C | 0.9.0 |
| IMP-05 | Supervisor inmediato: se vincula por nombre cuando es único; si no, se guarda el texto. | C | 0.9.0 |
| REG-01 | Regularizar exige el soporte (quién autorizó) y un perfil con descripción; después cuenta en el HC y admite reemplazo; no se regulariza dos veces; queda en el historial. | H · A | 0.9.0 |
| EGR-01 | Egreso: solo GH; fecha futura, anterior al ingreso o sin tipo se rechazan; la plaza queda libre; el evento `egreso.registrado` no lleva tipo ni motivo; no se egresa dos veces. | H · A | 0.9.0 |
| EGR-02 | Reemplazo pedido con el ocupante activo (preaviso): el ingreso del nuevo se bloquea hasta registrar el egreso; después se confirma. | C · A | 0.9.0 |
| ORG-01 | Diagrama «Ver: Cargos» + «Personas»: nombre de quien ocupa cada plaza, «Vacante», Ocupadas y Vacantes en el título, bloque de control (elaborado, revisado, aprobado) al imprimir. | H | 0.9.0 |
| ORG-02 | `/organigrama`: GH y Presidencia ven todo; director o gerente con rol de empresa, solo las plazas de su empresa; con rol de unidad, solo su rama (una raíz ajena por URL vuelve a la suya); sin rol, aviso. Solo nombre y cargo. | H · A | 0.9.0 |
| ORG-03 | El día del relevo (egreso y nuevo ingreso en la misma fecha) la plaza muestra solo a quien queda. | C | 0.9.0 |
| LIM-02 | `npm run limpiar -- transacciones` también borra análisis de IA y CV; conserva los empleados importados y sus plazas. | C | 0.9.0 |

## 10d. Postulados con análisis de CV por IA (0.9.0)

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| IA-01 | Sin consentimiento registrado no se analiza; el consentimiento exige indicar cómo se obtuvo; retirarlo impide análisis nuevos. | H · A | 0.9.0 |
| IA-02 | Subir CV: solo GH (un gerente recibe 403 y no se escribe nada en el disco); PDF, Word o texto hasta 5 MB; otro tipo se rechaza; el enlace descarga el archivo. | H · A | 0.9.0 |
| IA-03 | «Analizar con IA»: crea el evento `cv.analizar` sin datos personales; un segundo pedido en curso se rechaza; sin respuesta en 30 minutos vence y se puede pedir de nuevo. | H · A | 0.9.0 |
| IA-04 | API: sin `x-api-key` 401; token equivocado 404; datos del CV con fecha de nacimiento, estado civil y cédula tachados; reglas para el modelo incluidas. | H · A | 0.9.0 |
| IA-05 | Resultado: puntaje fuera de 0–5 o sin resumen → 400; válido → puntaje 0–100 ponderado por la rúbrica; repetido → 409; el análisis no se modifica ni se borra (base). | H · A | 0.9.0 |
| IA-06 | La ficha del postulado muestra puntaje, criterios con evidencia, resumen, brechas, preguntas y alertas, con el aviso de que la IA no decide; la tarjeta muestra «IA n/100». La IA no mueve al postulado. | H | 0.9.0 |
| IA-07 | Configuración › Análisis de CV con IA: pesos 0–100 (el servidor rechaza otros valores); al menos una dimensión activa con peso; cada análisis guarda la rúbrica con la que se hizo. | C | 0.9.0 |
| IA-08 | Flujo de n8n importado: con un CV en Word y otro en PDF, el resultado llega al portal; con un PDF escaneado, llega el error «sin texto legible». | H | 0.9.0 |

## 11. Eventos hacia n8n

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| EV-01 | Enviar una requisición a aprobación: n8n recibe `requisicion.pend_director` con `aprobadores`, `url` y `detalle.perfil.codigo`. | H | 0.5 / 0.6 |
| EV-02 | Con n8n caído, el portal sigue funcionando y los eventos se envían al volver (reintentos hasta 10). | C | 0.3 |
| EV-03 | Cambiar la empresa de una requisición emite `requisicion.empresa_cambiada`; el evento lleva `detalle.plaza`. | C | 0.7.2 |
| EV-04 | Un evento no se envía dos veces con el mismo `id`. | C · A | 0.3 |
| EV-05 | Con `N8N_WEBHOOK_IA_URL` definida, `cv.analizar` va a ese webhook y el resto al general; sin ella, todo al general. | C | 0.9.0 |

## 12. Interfaz común

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| UI-01 | Acciones irreversibles piden confirmación con botón rojo; Cancelar o Esc no ejecutan. | H | 0.7.3 |
| UI-02 | Aviso de éxito se cierra solo; el de error queda hasta cerrarlo. | C | 0.7.3 |
| UI-03 | Tema claro y oscuro: todas las pantallas legibles; el diagrama y la descripción de cargo en hoja blanca. | C | 0.6.1 |
| UI-04 | Móvil: menú horizontal, formularios en una columna, tablas como tarjetas, sin desplazamiento lateral del documento. | C | Instrucciones |
| UI-05 | Las pantallas nuevas respetan DESIGN.md (colores por token, componentes existentes). | H | DESIGN.md |

## Obsoletas

| ID | Prueba | Motivo |
|---|---|---|
| — | Elegir el número de plazas en la requisición (0.4–0.7.1). | Desde la 0.7.2, una plaza por requisición. |

---

## Registro de ejecuciones

| Versión | Fecha | Tipo (H/C) | Resultado | Fallos (ID) | Quién |
|---|---|---|---|---|---|
| 0.7.11 | 17-11-2026 | H + críticas 0.7.11 + PL-09/10, CM-05 | Pasa con 1 fallo y 2 ajustes (corregidos en 0.7.12). Probado: INS-01/02/03, SEG-01/03, APR-01/02/05/06, REQ-02/04, PL-05/09/10, CM-01 (las tres cargas), CM-05, DG-01/06/10, UI-01/03/04. No probado: EasyPanel, n8n, imprimir/PDF, imagen, Safari. | Línea punteada bajo otra caja (DG-12); punteada hacia el jefe por regla aceptada (PL-12); referencia en minúsculas en el error (CM-07) | Claude (entorno aislado, PostgreSQL 16) |
| 0.7.12 | 18-11-2026 | H + críticas 0.7.11 y 0.7.12 | Pasa. INS-01, INS-02 (0.7.11 → 0.7.12 sin migraciones), SEG-01/03, APR-01/02/05/06, REQ-02/04, EV-01 (con PORTAL_URL), PL-05/09/10/12, CM-01, CM-03, CM-05, CM-07, DG-01/06/12 (tres disposiciones, escritorio y móvil), sin errores JS. No probado: EasyPanel, envío real a n8n, imprimir/PDF, imagen, Safari. | — | Claude (entorno aislado, PostgreSQL 16) |
| 0.7.13 | 19-11-2026 | PF-09, CM-01 (perfiles) con la base copiada de EasyPanel + carga de organigramas | Pasa. Instalación desde cero (12 migraciones) y actualización sin migraciones; PF-04 (Word, vista previa); carga de organigramas aplicada en la copia: 214 plazas, 0 cierres. No probado: EasyPanel, formulario de perfil con una sola línea que lleva «;». | — | Claude (entorno aislado, PostgreSQL 16) |
| 0.8.0 | 20-11-2026 | H + nuevas (SEG-08, SEL-04, ING-01 a 06, LIM-01, PF-10) | Pasa. Copia de la base de EasyPanel con los Excel de organigramas cargados: migración 013 sin errores, limpieza de prueba (5 requisiciones, 3 candidatos, 1 ingreso, avisos) con historial encadenado intacto, flujo completo de ingreso; instalación desde cero (13 migraciones); humo 0.7.12 sin regresiones; escritorio y móvil sin errores JS. No probado: EasyPanel, envío real a n8n. | — | Claude (entorno aislado, PostgreSQL 16) |
| 0.9.0 | 20-11-2026 | H + nuevas (EMP, IMP, REG, EGR, ORG, LIM-02, IA-01 a 07, EV-05) | Pasa. Copia de la base de EasyPanel (0.8.0) → migraciones 014 y 015 sin errores; importación del Listado real en la copia (252 personas, 66 por regularizar, 106 pendientes, idempotente); 50 pruebas de servicio, 38 de pantallas (escritorio y móvil, sin errores JS), 5 de alcance del organigrama, 3 de seguridad; código de los nodos de n8n probado fuera de n8n; envío de eventos a dos webhooks simulados (cv.* al de IA, el resto al general). Instalación desde cero (15 migraciones). Regresión: 0.8.0 (23/23) por la ruta de actualización, 0.7.12 (18/18) y humo de requisiciones en instalación nueva. No probado: EasyPanel, n8n real con un modelo (IA-08), imprimir/PDF, Safari. | — | Claude (entorno aislado, PostgreSQL 16) |
