# PQ - VALIDACION DE DESEMPENO

## 1. Introduccion
La calificacion de desempeno del Area 02 evalua el comportamiento del dominio en condiciones representativas de uso real. La intencion es verificar estabilidad, consistencia y repetibilidad de los procesos mas frecuentes del ciclo laboral interno.

## 2. Objetivo
Demostrar que el area mantiene funcionamiento consistente durante la operacion diaria de colaboradores, talento humano y jefaturas.

## 3. Escenarios PQ
| ID | Escenario | Criterio de observacion |
|---|---|---|
| PQ-PT-001 | Uso diario del widget de asistencia | Las marcas del dia se mantienen consistentes y sin duplicidad indebida |
| PQ-PT-002 | Solicitudes concurrentes de permisos y vacaciones | Los resumentes y estados se mantienen estables |
| PQ-PT-003 | Uso continuo del workspace de personal | El expediente de solicitud conserva perfil, comentarios, documentos y linea de tiempo sin perder consistencia entre backend y frontend |
| PQ-PT-003A | Uso movil del workspace de personal | El selector de contexto sigue permitiendo navegar y editar sin perdida de usabilidad |
| PQ-PT-003B | Uso continuo del hub administrativo | Talento Humano y TI mantienen acceso estable a usuarios y departamentos desde un unico punto sin duplicidad de navegacion |
| PQ-PT-004 | Consulta de perfiles y certificaciones | La informacion permanece recuperable y coherente, incluyendo descarga del consolidado de certificaciones desde la vista propia |
| PQ-PT-004D | Perfil propio y revision anual | El colaborador puede completar y cerrar la revision anual solo con datos criticos completos |
| PQ-PT-004E | Certificaciones en touch | Las acciones principales siguen disponibles y entendibles en equipos tactiles |
| PQ-PT-004A | Flujo de solicitud de personal con varias etapas | El progreso, responsable y tiempo por etapa permanecen visibles y coherentes en uso real |
| PQ-PT-004B | Comentarios y reasignacion en solicitudes activas | Las notas y cambios de responsable quedan trazables sin perder el historial |
| PQ-PT-004C | Contratacion con checklist completo | La contratacion solo se habilita cuando el expediente y documentos estan completos |
| PQ-PT-005 | Reportes de asistencia por rango | El PDF responde para periodos operativos habituales sin exponer terceros no autorizados y exige usuario especifico |
| PQ-PT-006 | Consulta administrativa de asistencia por estado | Los filtros por estado mantienen coherencia entre resumen y resultado, y respetan el alcance de roles administrativos autorizados |
| PQ-PT-007 | Procesamiento de jobs del area | Overtime y coordinaciones vencidas no quedan indefinidamente pendientes |
| PQ-PT-008 | Consulta recurrente de auditoria del dominio | La trazabilidad nueva del area permanece legible y no vuelve a registrar eventos operativos como `anon/core/desconocida` |

## 4. Riesgos de desempeno relevantes
- dependencia cruzada entre login y autoentrada de asistencia
- necesidad de coherencia entre estado derivado y datos persistidos de asistencia
- coexistencia de dos fuentes de vacaciones
- coexistencia de componentes legacy y modernos dentro del dominio de talento y control laboral
- avance de solicitudes de personal con validaciones por bloque, comentarios y reasignacion operativa
- consistencia entre usuarios activos/inactivos y su disponibilidad para operaciones administrativas
- perdida de usabilidad si la navegacion movil del workspace o las acciones tactiles no se mantienen visibles

## 5. Criterio de aceptacion PQ
La PQ se considera satisfactoria cuando el area responde de forma estable a cargas operativas normales, no pierde trazabilidad de datos y no deja procesos diarios o administrativos en estados inconsistentes.

## 6. Conclusion
La PQ del Area 02 debe demostrar que el dominio soporta el uso continuo del personal sin degradar registros de jornada, trazabilidad de solicitudes o consistencia de saldos y perfiles.
