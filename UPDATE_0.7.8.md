# Actualización 0.7.8 — Organigrama de cargos por niveles jerárquicos

Se aplica sobre la **0.7.7**. Trae una migración nueva (011) y no agrega dependencias.

## Pasos
1. **Backup de la base de datos.**
2. Copia los archivos, `git push` y redespliega. El log debe decir `migrada 011_nivel_jerarquico.sql`.
3. **Configuración › Niveles jerárquicos:** revisa y ordena los niveles con ↑ ↓. Vienen precargados: Presidencia, Dirección, Gerencia, Jefatura, Coordinación, Especialista, Analista, Asistente / Auxiliar, Operativo. Puedes agregar o desactivar.
4. **Asigna el nivel a cada perfil.** Una por una en Gestión de cargos › Ver › Datos, o todas a la vez con el Excel de perfiles (columna «Nivel jerárquico», con el nombre del nivel).

## Qué cambia
- **Diagrama › Ver: Cargos**, en disposición horizontal: **cada nivel es una fila**.
  - Los cargos del mismo nivel quedan alineados aunque reporten a jefes distintos. Por ejemplo, un analista que reporta directo al gerente queda en la fila de los analistas, con una línea más larga, como en los organigramas de GH.
  - **Becarios, pasantes, aprendices y outsourcing** van debajo del último nivel, en ese orden. Se deduce de la modalidad de sus plazas: no hace falta asignarles nivel.
  - **Un perfil sin nivel** se ubica una fila debajo de su jefe, como antes.
  - Si un cargo tiene un nivel **igual o superior al de su jefe** (dato mal cargado), se dibuja una fila debajo de él con **borde naranja punteado**, y el tooltip explica qué revisar. Solo se marca ese puesto, no sus dependientes.
- **Quién reporta a quién no cambia**: sigue saliendo de la plantilla. El nivel solo decide la fila.
- Las disposiciones «Compacta» y «Cascada por columnas» no cambian.
- **Gestión de cargos:** columna «Jerarquía» en la lista, selector de nivel al crear y editar, y nueva columna en el Excel. Un nivel que no existe da error por fila.

## Pruebas críticas
1. Asigna niveles a los cargos de Tecnología (Director, gerentes, jefe, analistas). En Ver: Cargos desde la Dirección, cada nivel es una fila y los analistas quedan alineados.
2. Marca «Becario» y «Pasante» en Modalidades: aparecen en filas propias, debajo de los analistas.
3. Pon a un jefe el mismo nivel que su gerente: se marca en naranja punteado y sus analistas no.
4. Sube o baja un nivel en Configuración: el diagrama cambia de orden.
5. Descarga el Excel de perfiles y súbelo sin cambios: «No hay nada que aplicar».
