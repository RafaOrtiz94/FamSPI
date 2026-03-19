# OQ - VALIDACION OPERACIONAL

## 1. Introduccion
La calificacion operacional del Area 02 comprueba que las funciones del dominio respondan de forma coherente bajo condiciones normales y de error controlado. El foco de esta fase no es solo verificar que existan rutas, sino demostrar que el sistema soporta adecuadamente los procesos de personas y control laboral.

## 2. Objetivo
Validar el comportamiento funcional observable del area en usuarios, colaboradores, perfil, certificaciones, solicitudes de personal, asistencia, permisos y vacaciones.

## 3. Escenarios operacionales
| ID | Modulo | Escenario | Resultado esperado |
|---|---|---|---|
| OQ-PT-001 | users/departments | Listado, filtros, activacion y desactivacion administrativa | El sistema devuelve o persiste informacion sin romper relaciones, respeta el alcance por rol y preserva el historico con estados activos/inactivos |
| OQ-PT-001A | users/departments | Navegacion unificada del hub administrativo | Talento Humano y TI ven `Usuarios y Departamentos` en la barra, pueden abrir usuarios o departamentos desde la misma vista y otros roles no ven ni acceden a esa entrada |
| OQ-PT-002 | collaborators | Consulta y actualizacion de perfil de colaborador | El workspace refleja cambios y documentos asociados |
| OQ-PT-002A | collaborators | Uso del workspace en movil | El usuario puede seleccionar contexto y operar sin depender de un sidebar oculto |
| OQ-PT-003 | user-profile | Actualizacion del perfil propio | Metadata, preferencias y avatar quedan persistidos |
| OQ-PT-003A | user-profile | Cierre de revision anual | El sistema impide cerrar la revision si faltan campos criticos y muestra con claridad los pendientes |
| OQ-PT-004 | user-certifications | Alta, consulta, baja logica y PDF | Las certificaciones se administran y exportan correctamente desde la vista propia del colaborador y para los roles autorizados |
| OQ-PT-004A | user-certifications | Uso tactil y responsive | Las acciones de ver y eliminar permanecen visibles en touch y el formulario se adapta a movil |
| OQ-PT-005 | personnel-requests | Creacion y seguimiento de solicitud de personal | La solicitud cambia de estado y conserva historial, comentarios, actor por etapa y expediente sincronizado |
| OQ-PT-005F | personnel-requests | Apertura por ruta del hub de talento | Cada ruta del hub abre la vista esperada sin desviar al usuario a otro contexto |
| OQ-PT-005G | auditoria | Trazabilidad del workspace de talento | Los nuevos eventos de solicitudes, usuarios y departamentos muestran actor, modulo y accion identificables; los registros historicos no normalizados se presentan con etiquetas explicitas y no con placeholders tecnicos crudos |
| OQ-PT-005A | personnel-requests | Avance por bloque de captura | El formulario no permite pasar de paso si faltan datos obligatorios del bloque actual |
| OQ-PT-005B | personnel-requests | Estado, responsable y progreso | El workspace muestra estado actual, responsable, siguiente accion, tiempo por etapa y estancamiento |
| OQ-PT-005C | personnel-requests | Reasignacion operativa | El rol autorizado puede cambiar o liberar el colaborador operativo vinculado a la solicitud |
| OQ-PT-005D | personnel-requests | Comentarios trazables | El sistema registra comentarios con autor, fecha y marca de visibilidad interna |
| OQ-PT-005E | personnel-requests | Checklist y documentos | El sistema muestra avance documental y habilita la contratacion solo con expediente completo |
| OQ-PT-006 | attendance | Registro diario de jornada | La secuencia entrada-almuerzo-salida queda validada |
| OQ-PT-007 | attendance | Excepcion, overtime y control de acceso a reportes | La excepcion cambia de estado, overtime queda consultable y la lectura de terceros se limita a roles autorizados |
| OQ-PT-008 | attendance | Consulta administrativa por rango y estado | El sistema separa la vista administrativa del PDF oficial, responde con estados derivados correctos y restringe el alcance a roles de reporte autorizados |
| OQ-PT-009 | permisos | Permiso con aprobacion y justificantes | La solicitud recorre la etapa correspondiente y acepta evidencia |
| OQ-PT-010 | permisos | Coordinacion de recuperacion | La coordinacion puede cerrarse por acuerdo o vencimiento |
| OQ-PT-011 | vacaciones | Solicitud, aprobacion o cancelacion | El saldo y estado quedan consistentes |

## 4. Criterio de error controlado
La OQ tambien debe observar la respuesta del sistema cuando:
- faltan archivos requeridos
- el rol no tiene permiso para una accion
- se intenta consultar asistencia de otro usuario sin autorizacion de reporte
- se intenta consultar asistencia administrativa sin estado valido
- se intenta romper la secuencia de asistencia
- se solicitan permisos con informacion incompleta
- se pretende aprobar o cancelar fuera del estado esperado
- se intenta avanzar un bloque de la solicitud sin completar los datos obligatorios
- se intenta asignar o reasignar responsable sin rol autorizado
- se intenta agregar comentario vacio o sin formato minimo
- se intenta contratar sin checklist y documentos completos
- se intenta cerrar revision anual sin telefono, direccion o contacto de emergencia
- se intenta usar certificaciones desde interfaz tactil sin accion visible de borrado

## 5. Criterio de aceptacion OQ
La OQ se considera satisfactoria cuando el area ejecuta sus procesos principales, responde con errores controlados en escenarios invalidos y conserva trazabilidad suficiente de los cambios funcionales relevantes.

## 6. Conclusion
La OQ del Area 02 demuestra que el sistema debe ser evaluado como un dominio operativo continuo, donde la consistencia entre talento, asistencia, permisos y vacaciones es tan importante como la respuesta individual de cada endpoint.
