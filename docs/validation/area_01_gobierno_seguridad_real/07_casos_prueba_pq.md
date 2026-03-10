# CASOS DE PRUEBA PQ

## 1. Objetivo
Definir la calificacion de desempeno (PQ) del area Gobierno, Seguridad y Cumplimiento basandose en el comportamiento esperado del sistema en condiciones representativas de uso real, segun la implementacion verificable.

## 2. Alcance
- Validar estabilidad operativa, consistencia de seguridad y trazabilidad funcional.
- No se asumen metricas no implementadas; si el monitoreo no existe en codigo, se marca como `DESCONOCIDO`.

## 3. Criterios PQ
- El sistema debe sostener el flujo funcional bajo uso repetido.
- Los controles de acceso deben mantenerse estables bajo distintos perfiles.
- Los registros de auditoria deben conservar consistencia en escenarios nominales y de error.
- Los modulos documentados como operativos deben responder sin errores estructurales en escenarios de negocio frecuentes.

## 4. Casos PQ
| ID | Modulo | Escenario de desempeno | Entrada / volumen | Resultado esperado |
|---|---|---|---|---|
| PQ-GSC-001 | auth | Repetir 20 consultas consecutivas a `/api/v1/auth/me` con token valido | 20 solicitudes secuenciales del mismo usuario | Respuestas consistentes; no debe crear mas de un registro diario en `user_attendance_records` por usuario/fecha |
| PQ-GSC-002 | auth | Ejecutar 10 renovaciones de token consecutivas con el ultimo refresh valido | 10 solicitudes `POST /auth/refresh` encadenadas | El sistema debe responder sin corrupcion de sesion; registrar si crea sesiones adicionales no deseadas |
| PQ-GSC-003 | auth | Simular 5 logouts y reintentos de refresh con el token previo | Logout seguido de refresh del token anterior | El comportamiento seguro esperado seria rechazo; el resultado real debe registrarse para evidenciar la debilidad actual |
| PQ-GSC-004 | auth | Simular logins fuera de horario en varios usuarios | 5 callbacks validos clasificados como off-hours | Deben generarse sesiones y eventos `offhours_login`; confirmar que las notificaciones no bloquean el flujo principal |
| PQ-GSC-005 | auditoria | Consultar auditoria con filtros amplios y luego detallados | 3 consultas de listado + 10 consultas por id | Respuesta estable, sin degradacion funcional ni errores de filtrado |
| PQ-GSC-006 | auditoria | Exportar CSV despues de generar actividad en `auth` y `approvals` | 1 export con datos recientes | El CSV debe contener filas consistentes con los logs realmente persistidos |
| PQ-GSC-007 | audit-prep | Listar secciones y documentos repetidamente durante una ventana de auditoria activa | 10 lecturas de secciones + 10 lecturas de documentos | `sections` debe permanecer estable; `documents` actualmente puede fallar por defecto estructural y debe registrarse como no conforme |
| PQ-GSC-008 | audit-prep | Cargar 5 documentos validos consecutivos a distintas secciones | 5 archivos validos dentro del limite | Cada carga debe persistirse y mantenerse descargable; si la integracion Drive falla, registrar degradacion |
| PQ-GSC-009 | audit-prep | Crear y revocar accesos externos repetidamente | 2 altas + 2 revocaciones + 1 intento de tercera alta activa | El sistema debe respetar el limite de 2 accesos activos y mantener consistencia en `audit_access_grants` |
| PQ-GSC-010 | approvals | Consultar pendientes con diferentes roles permitidos | Tokens de tecnico, gerencia, calidad y jefaturas | El resultado actual puede ser la misma cola para varios roles; registrar esa falta de segmentacion como no conformidad funcional |
| PQ-GSC-011 | approvals | Ejecutar aprobaciones y rechazos consecutivos sobre distintas solicitudes | 5 aprobaciones y 5 rechazos validos | Deben actualizarse estados y registrarse decisiones; verificar si la auditoria queda degradada por payload incorrecto |
| PQ-GSC-012 | management | Consultar dashboard gerencial repetidamente | 10 lecturas de `stats` y `requests` | `stats` y `requests` deben responder, aunque `stats` puede mostrar conteos incorrectos; registrar desalineacion |
| PQ-GSC-013 | management | Consultar trazabilidad y documentos de solicitudes en uso real | 5 llamadas a `trace/:id` y 5 a `documents/:id` | En el estado actual se espera no conformidad por errores SQL estructurales |
| PQ-GSC-014 | signature | Ejecutar 5 verificaciones publicas consecutivas de token QR valido | 5 consultas `GET /api/verificar/:token` | Respuestas consistentes si la funcion SQL existe y el token es valido |
| PQ-GSC-015 | signature | Ejecutar firma documental completa desde backend real | 3 intentos de `POST /api/documents/:id/sign` con payload valido | En el estado actual se espera no conformidad por incompatibilidad entre controller y esquema |
| PQ-GSC-016 | signature | Ejecutar flujo real desde UI de firma | Navegacion a `/dashboard/signatures/:documentId/sign` y firma | En el estado actual se espera no conformidad por desacople de ruta API y `documentId` no inyectado |
| PQ-GSC-017 | security | Ejecutar consultas reales del centro de seguridad | 5 llamadas a endpoints de `security` | En el estado actual se espera no conformidad porque el modulo no esta montado |
| PQ-GSC-018 | area | Validar estabilidad de RBAC frente a roles no previstos | Intentos repetidos con JWT de roles no incluidos en la jerarquia hardcoded | El resultado real debe registrarse; si se concede acceso, la PQ del area queda no conforme en seguridad |

## 5. Resultado PQ esperado por estado actual
- Conformidad parcial en `auth`, `auditoria` y parte de `approvals`.
- No conformidad esperada en escenarios de `security`, `management/trace`, `management/documents` y firma documental completa.
- Riesgo alto de no conformidad transversal por el bypass de RBAC y la revocacion incompleta de refresh tokens.

## 6. Conclusion PQ
El area no puede calificarse como plenamente apta para desempeno operativo controlado. Puede sostener parte de los flujos nucleares, pero presenta fallas estructurales que impiden una PQ conforme en seguridad, trazabilidad gerencial y firma documental.
