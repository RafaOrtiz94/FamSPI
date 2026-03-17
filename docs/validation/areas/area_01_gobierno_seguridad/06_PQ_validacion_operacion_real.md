# PQ - AREA 01 GOBIERNO, SEGURIDAD Y CUMPLIMIENTO

## 1. Objetivo
Definir escenarios de calificacion de desempeno y uso real del area 01 segun la implementacion vigente.

## 2. Casos PQ
| ID | Modulo | Escenario | Resultado esperado |
|---|---|---|---|
| PQ-GSC-001 | auth | 20 consultas consecutivas a `/api/v1/auth/me` con el mismo token | respuestas consistentes sin crear efectos secundarios de asistencia |
| PQ-GSC-002 | auth | 10 refresh encadenados usando siempre el ultimo refresh token valido | no debe aceptar tokens ya reemplazados o sin sesion activa |
| PQ-GSC-003 | auth | login repetido de un mismo usuario en un mismo dia | no debe duplicar entradas de asistencia del dia |
| PQ-GSC-004 | security | consulta repetida de eventos off-hours con filtros y export | respuestas estables, saneadas y sin filtrar datos crudos no deseados |
| PQ-GSC-005 | auditoria | listados amplios + detalle + export CSV | paginacion y export estables |
| PQ-GSC-006 | audit-prep | 5 cargas consecutivas de documentos validos | persistencia coherente en `audit_documents` y continuidad de descarga |
| PQ-GSC-007 | audit-prep | altas y revocaciones repetidas de accesos externos | se respeta limite de 2 activos y el estado permanece consistente |
| PQ-GSC-008 | approvals | consultas repetidas de pendientes con distintos roles permitidos | la cola responde, pero debe documentarse si varios roles ven el mismo universo de solicitudes |
| PQ-GSC-009 | approvals | serie de aprobaciones y rechazos validos | `requests` y `request_approvals` se mantienen consistentes |
| PQ-GSC-010 | management | cargas repetidas de `stats`, `requests`, `trace` y `documents` | operacion estable; verificar total real y trazabilidad consistente |
| PQ-GSC-011 | signature | multiples verificaciones de token QR valido | respuesta estable y tracking de acceso coherente |
| PQ-GSC-012 | signature | intentos repetidos de firma sobre documentos validos | firma estable solo si funciones/vistas SQL requeridas existen en el entorno |
| PQ-GSC-013 | area | combinacion de login, evento off-hours, revision TI y consulta auditoria | la trazabilidad debe poder seguirse de `auth` a `security` y `auditoria` |

## 3. Riesgos PQ vigentes
- `auth` mantiene un acoplamiento transversal con `attendance` durante login.
- `approvals` puede degradar la segregacion funcional al no segmentar la cola por aprobador real.
- `management/requests` no expone un total global confiable para volumenes altos.
- `signature` depende de funciones/vistas SQL sin fallback en codigo.

## 4. Conclusion PQ
El area 01 puede sostener sus flujos core en runtime si el entorno tiene correctamente disponibles Google OAuth, Drive, correo y los artefactos SQL de firma. La PQ no queda plenamente cerrada mientras sigan abiertos los hallazgos de segmentacion en `approvals`, totalizacion en `management` y dependencia fuerte de SQL especializado en `signature`.
