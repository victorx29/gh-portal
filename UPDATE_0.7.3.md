# Actualización 0.7.3 — Modalidades en el organigrama, avisos y confirmaciones, ajustes de plantilla

Se aplica sobre la **0.7.2**. No tiene migraciones ni dependencias nuevas: copiar, `git push` y redesplegar.

## Qué cambia
- **Diagrama › Modalidades a mostrar:** casillas de nómina propia, outsourcing, pasante, becario y aprendiz.
  - **Por defecto, solo nómina propia**: el organigrama base.
  - Al marcar otras modalidades aparecen sus puestos y suman a los conteos, y el título lo indica («… · Nómina propia + Pasantes»).
  - Un puesto sin plazas, como el de **Presidente**, se muestra siempre: no suma al HC.
- **Puesto duplicado:** si creas un puesto con un cargo que ya existe en esa unidad, el portal abre ese puesto con «Agregar plazas» desplegado, porque las otras empresas o modalidades son plazas del mismo puesto.
- **Perfiles «Sin descripción»:** la lista marca los perfiles que solo tienen nombre (sin objetivo, funciones ni educación), y el filtro «Activos sin descripción» los reúne. Sirve para los perfiles mínimos (Presidente, pasantes, outsourcing) y para saber qué falta documentar para ISO.
- **Avisos flotantes:** los mensajes aparecen arriba a la derecha. Los de éxito se cierran solos (salvo que pases el cursor encima); los de error quedan hasta cerrarlos.
- **Confirmaciones** con un modal del portal, en lugar del clic directo, en estas acciones:
  - **Irreversibles (botón rojo):**
    - cerrar una plaza, desactivar un puesto o cerrar una dependencia funcional;
    - cancelar, anular, eliminar o rechazar una requisición;
    - retirar un rol;
    - desactivar un usuario, una unidad, un perfil o una empresa.
  - **Normales:** cambiar una dependencia o una empresa, y aplicar o descartar las cargas masivas y la importación de Word.
  - El foco empieza en «Cancelar», y Esc también cancela.
- **Corrección:** en la importación de Word, la opción «Una unidad y sus dependientes» no mostraba el selector de unidad. La lógica que muestra u oculta campos no leía bien los botones de opción.

## Pasantes, becarios, aprendices y outsourcing
No necesitan descripción de cargo. Crea un perfil mínimo (solo el nombre, por ejemplo «Pasante de Tecnología») y su puesto con plazas de esa modalidad. Saldrán en el organigrama cuando marques su modalidad y no suman al HC de nómina.

## Pruebas críticas
1. Diagrama › Ver: Cargos: por defecto no aparecen los pasantes. Marca «Pasante»: aparecen y el título lo indica.
2. Crea un puesto con un cargo que ya existe en la unidad: se abre ese puesto con «Agregar plazas».
3. Cierra una plaza: pide confirmación. Cancelar o Esc no la cierran; Confirmar sí.
4. Rechaza una requisición: pide confirmación y queda rechazada.
5. Un aviso de éxito desaparece solo; uno de error queda hasta cerrarlo.
6. Importar Word › «Una unidad y sus dependientes»: aparece el selector de unidad.
7. Perfiles › Estado «Activos sin descripción»: aparecen los perfiles mínimos.
