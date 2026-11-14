# PRUEBAS.md — Pruebas de regresión del Portal de Gestión Humana

Lista acumulada de las pruebas críticas de todas las entregas (0.3 a 0.7.11), ordenada por módulo. Mientras
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

## 8. Cargas masivas (estructura, perfiles, plantilla)

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| CM-01 | Descargar el Excel y subirlo sin cambios: «No hay nada que aplicar» (estructura, perfiles y plantilla). | H · A | 0.5 / 0.6 / 0.7 |
| CM-02 | Un error en una fila bloquea toda la carga; una advertencia no. | C · A | 0.5 |
| CM-03 | La carga se aplica en una sola transacción: si falla a mitad, no queda nada a medias. | C · A | 0.5 |
| CM-04 | Plantilla: menos plazas en el archivo cierra las sobrantes con fecha de hoy; los puestos ausentes del archivo no se tocan. | C · A | 0.7 |
| CM-05 | Plantilla: columna «Funcional de» vacía cierra las líneas punteadas; un Excel antiguo sin esa columna no las toca. | C | 0.7.11 |
| CM-06 | Archivo que no es .xlsx o mayor de 5 MB: se rechaza con mensaje. | C | 0.5 |

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

## 10. Pipelines y selección

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| SEL-01 | Pipeline personalizado con columna «Requiere resultado Apto»: GH no puede mover la tarjeta sin registrar el resultado. | C · A | 0.3 |
| SEL-02 | Cambiar la empresa de una requisición a una cuyo pipeline no tiene su etapa: se bloquea. | C | 0.7.2 |
| SEL-03 | El tablero, Pipelines y Selección muestran la razón social, no el nombre comercial. | C | 0.6.1 |

## 11. Eventos hacia n8n

| ID | Prueba | Tipo | Origen |
|---|---|---|---|
| EV-01 | Enviar una requisición a aprobación: n8n recibe `requisicion.pend_director` con `aprobadores`, `url` y `detalle.perfil.codigo`. | H | 0.5 / 0.6 |
| EV-02 | Con n8n caído, el portal sigue funcionando y los eventos se envían al volver (reintentos hasta 10). | C | 0.3 |
| EV-03 | Cambiar la empresa de una requisición emite `requisicion.empresa_cambiada`; el evento lleva `detalle.plaza`. | C | 0.7.2 |
| EV-04 | Un evento no se envía dos veces con el mismo `id`. | C · A | 0.3 |

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
| | | | | | |
