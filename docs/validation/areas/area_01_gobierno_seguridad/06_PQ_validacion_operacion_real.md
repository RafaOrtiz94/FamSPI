# PQ - AREA 01 GOBIERNO, SEGURIDAD, CUMPLIMIENTO Y GESTION DOCUMENTAL

## 1. Introduccion
La calificacion de desempeno del Area 01 tiene como proposito demostrar que los modulos comprendidos dentro del dominio de Gobierno, Seguridad, Cumplimiento y Gestion Documental mantienen un comportamiento estable, consistente y trazable cuando operan en condiciones representativas de uso real.

## 2. Casos PQ
| ID | Modulo | Escenario | Resultado esperado |
|---|---|---|---|
| PQ-GD-001 | auth | 20 consultas consecutivas a `/api/v1/auth/me` con el mismo token | respuestas consistentes sin efectos secundarios inesperados |
| PQ-GD-002 | auth | 10 refresh encadenados usando siempre el ultimo refresh token valido | no acepta tokens ya reemplazados o sin sesion activa |
| PQ-GD-003 | security | consulta repetida de eventos off-hours con filtros y export | respuestas estables, saneadas y exportables |
| PQ-GD-004 | auditoria | listados amplios, detalle y export CSV | paginacion y export estables |
| PQ-GD-005 | audit-prep | 5 cargas consecutivas de documentos validos | persistencia coherente en `audit_documents` y continuidad de descarga |
| PQ-GD-006 | approvals | serie de aprobaciones y rechazos validos | `requests` y `request_approvals` se mantienen consistentes |
| PQ-GD-007 | management | cargas repetidas de `stats`, `requests`, `trace` y `documents` | operacion estable con trazabilidad gerencial consistente |
| PQ-GD-008 | documents | 10 creaciones desde plantilla y 10 consultas por solicitud | creacion y lectura consistentes sin perdida de referencia |
| PQ-GD-009 | files | 10 cargas y 10 descargas de adjuntos por lote | stream y metadata consistentes |
| PQ-GD-010 | notifications | 30 operaciones mixtas de listar, leer y limpiar | bandeja consistente y conteo no leido correcto |
| PQ-GD-011 | dashboard | 20 consultas al resumen comercial con y sin `fresh=1` | respuesta funcional sostenida y sin degradacion critica |
| PQ-GD-012 | gmail | 5 envios sucesivos con autorizacion valida | envio estable y trazabilidad del modulo |
| PQ-GD-013 | signature | multiples verificaciones de token QR valido | respuesta estable y tracking coherente |
| PQ-GD-014 | area | combinacion de login, evento off-hours, notificacion, generacion documental y firma | la trazabilidad debe poder seguirse de extremo a extremo |

## 3. Riesgos PQ vigentes
- `auth` mantiene un acoplamiento transversal con `attendance` durante login.
- `approvals` requiere seguimiento para asegurar segmentacion consistente del universo visible.
- `management` debe mantener consistencia entre metricas, listados y trazabilidad gerencial.
- `signature` depende de funciones y vistas SQL especializadas cuya ausencia afecta el flujo completo.
- `gmail` depende de autorizacion previa valida del usuario y de integracion Google operativa.

## 4. Conclusiones de PQ
La incorporacion de gestion documental, archivos, notificaciones, dashboard y Gmail exige que la PQ confirme no solo estabilidad de seguridad y auditoria, sino tambien consistencia del soporte documental transversal del sistema.
