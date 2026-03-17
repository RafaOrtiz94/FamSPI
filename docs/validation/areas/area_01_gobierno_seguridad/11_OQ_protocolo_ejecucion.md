# PROTOCOLO OQ - CALIFICACION OPERACIONAL
## Area 01: Gobierno, Seguridad y Cumplimiento

## 1. Objetivo
Verificar que los modulos del area 01 funcionen de acuerdo con la especificacion funcional vigente, bajo condiciones normales y de error controlado.

## 2. Referencias
- `01_URS_requerimientos_usuario.md`
- `02_FRS_requerimientos_funcionales.md`
- `03_DDS_diseno_tecnico.md`
- `05_OQ_validacion_funcionamiento.md`
- `09_informe_hallazgos_area_01.md`

## 3. Datos de ejecucion
| Campo | Valor |
|---|---|
| Sistema | SPI |
| Area | Gobierno, Seguridad y Cumplimiento |
| Ambiente | __________________ |
| Fecha de ejecucion | __________________ |
| Ejecutado por | __________________ |
| Revisado por | __________________ |

## 4. Precondiciones generales
- IQ aprobado o aprobado con observaciones controladas.
- Usuarios de prueba configurados con roles requeridos.
- Datos de prueba disponibles para `requests`, `documents`, `audit-prep` y `notifications`.
- Acceso a evidencia de DB o logs para validar side effects.

## 5. Protocolos OQ
| ID | Modulo | Caso de prueba | Precondiciones | Pasos de ejecucion | Evidencia esperada | Cambios esperados en BD | Registro/auditoria esperada | Resultado | Estado |
|---|---|---|---|---|---|---|---|---|---|
| OQP-GSC-001 | auth | Inicio de OAuth | Navegador o cliente HTTP | 1. Invocar `/api/v1/auth/google`. | Redireccion valida a Google. | Ninguno. | Ninguno. | ______ | ______ |
| OQP-GSC-002 | auth | Callback exitoso | `code` valido | 1. Completar login Google. 2. Validar redireccion al frontend con tokens. | Login exitoso. | `users` insert/update, `user_sessions` insert. | `auditoria.logs` con `login_success` u `offhours_login`. | ______ | ______ |
| OQP-GSC-003 | auth | Perfil autenticado | Access token valido | 1. Invocar `/api/v1/auth/me`. | Perfil y metadatos del usuario. | Ninguno en `auth`. | Sin side effect de asistencia en `/auth/me`. | ______ | ______ |
| OQP-GSC-004 | auth | Refresh valido | Refresh token activo | 1. Invocar `/api/v1/auth/refresh`. | Nuevos tokens. | `user_sessions.refresh_token` actualizado. | Sin auditoria funcional obligatoria. | ______ | ______ |
| OQP-GSC-005 | auth | Refresh invalido | Refresh token revocado o ajeno | 1. Invocar `/api/v1/auth/refresh` con token no asociado a sesion activa. | `401`. | Ninguno. | Ninguno. | ______ | ______ |
| OQP-GSC-006 | auth | Logout | Access token o refresh token valido | 1. Invocar `/api/v1/auth/logout`. | Confirmacion de cierre. | `user_sessions.logout_time` actualizado. | Ninguno obligatorio. | ______ | ______ |
| OQP-GSC-007 | auth | Aceptacion LOPDP interna | Usuario autenticado y payload valido | 1. Enviar firma y PDF base64. | Respuesta exitosa con usuario actualizado. | `users` update, `user_lopdp_consents` insert. | Evidencia de Drive y/o auditoria interna del modulo. | ______ | ______ |
| OQP-GSC-008 | security | Consulta de eventos off-hours | Usuario TI y eventos existentes o dataset vacio | 1. Invocar `/api/v1/security/offhours-logins`. | Lista saneada y paginada. | Ninguno. | Ninguno adicional. | ______ | ______ |
| OQP-GSC-009 | security | Revision de evento off-hours | Usuario TI y `correlation_id` existente | 1. Invocar `/api/v1/security/offhours-logins/{id}/review`. | Confirmacion de revision. | `notifications.read_at` actualizado. | `auditoria.logs` con accion de revision de seguridad. | ______ | ______ |
| OQP-GSC-010 | security | Export de eventos | Usuario TI | 1. Invocar `/api/v1/security/offhours-logins/export`. | CSV o JSON exportado. | Ninguno. | `auditoria.logs` con export de seguridad. | ______ | ______ |
| OQP-GSC-011 | auditoria | Listado con filtros | Usuario autorizado | 1. Invocar `/api/v1/auditoria` con filtros. | Respuesta paginada. | Ninguno. | Ninguno. | ______ | ______ |
| OQP-GSC-012 | auditoria | Export CSV | TI o Gerencia | 1. Invocar `/api/v1/auditoria/export/csv`. | Archivo CSV. | Ninguno. | Ninguno. | ______ | ______ |
| OQP-GSC-013 | audit-prep | Activacion/desactivacion de ventana | Jefe TI o admin TI | 1. Invocar `PUT /api/v1/audit-prep/status`. | Estado actualizado. | `audit_settings` update. | `auditoria.logs` del modulo `audit_prep`. | ______ | ______ |
| OQP-GSC-014 | audit-prep | Alta/actualizacion de seccion | Jefe TI o admin TI | 1. Invocar `POST /api/v1/audit-prep/sections`. | Seccion persistida. | `audit_sections` insert/update. | `auditoria.logs` del modulo `audit_prep`. | ______ | ______ |
| OQP-GSC-015 | audit-prep | Carga documental valida | Auditoria activa, seccion permitida, archivo permitido | 1. Subir archivo valido. | Confirmacion y metadata del documento. | `audit_documents` insert. | `auditoria.logs` del modulo `audit_prep`. | ______ | ______ |
| OQP-GSC-016 | audit-prep | Carga documental invalida | Archivo >15 MB o MIME no permitido | 1. Intentar carga invalida. | `413` o `415`. | Ninguno. | Error controlado. | ______ | ______ |
| OQP-GSC-017 | audit-prep | Creacion de acceso externo | Menos de 2 accesos activos | 1. Invocar `POST /api/v1/audit-prep/external-access`. | Acceso creado. | `audit_access_grants` insert. | `auditoria.logs` del modulo `audit_prep`. | ______ | ______ |
| OQP-GSC-018 | audit-prep | Exceso de accesos externos | Ya existen 2 accesos activos | 1. Intentar tercer alta. | Rechazo de negocio. | Ninguno. | Error controlado. | ______ | ______ |
| OQP-GSC-019 | approvals | Consulta de pendientes | Rol autorizado | 1. Invocar `/api/v1/approvals/pending`. | Lista de pendientes. | Ninguno. | Ninguno. | ______ | ______ |
| OQP-GSC-020 | approvals | Aprobacion de solicitud | Solicitud pendiente valida | 1. Invocar `/api/v1/approvals/{id}/approve`. | Confirmacion de aprobacion. | `requests.status` update, `request_approvals` insert. | Evidencia de auditoria y/o correo. | ______ | ______ |
| OQP-GSC-021 | approvals | Rechazo de solicitud | Solicitud pendiente valida | 1. Invocar `/api/v1/approvals/{id}/reject`. | Confirmacion de rechazo. | `requests.status` update, `request_approvals` insert. | Evidencia de auditoria y/o correo. | ______ | ______ |
| OQP-GSC-022 | management | Consulta de metricas | Usuario gerencial | 1. Invocar `/api/v1/management/stats`. | Resumen global y conteo por tipo. | Ninguno. | Ninguno. | ______ | ______ |
| OQP-GSC-023 | management | Consulta de requests | Usuario gerencial | 1. Invocar `/api/v1/management/requests`. | Lista paginada. | Ninguno. | Ninguno. | ______ | ______ |
| OQP-GSC-024 | management | Consulta de trazabilidad | Usuario gerencial y request existente | 1. Invocar `/api/v1/management/trace/{id}`. | Timeline desde `auditoria.logs`. | Ninguno. | Ninguno. | ______ | ______ |
| OQP-GSC-025 | management | Consulta de documentos/versiones | Usuario gerencial y request existente | 1. Invocar `/api/v1/management/documents/{id}`. | Adjuntos y versiones. | Ninguno. | Ninguno. | ______ | ______ |
| OQP-GSC-026 | signature | Firma documental completa | Usuario autenticado, documento existente, payload valido | 1. Invocar `POST /api/v1/signature/documents/{id}/sign`. 2. Verificar compatibilidad opcional con `POST /api/signature/documents/{id}/sign`. | Firma exitosa y documento bloqueado. | `document_hashes`, `document_signatures_advanced`, `document_seals`, `document_qr_codes`, `documents` update. | `document_signature_logs` y/o evidencia del modulo. | ______ | ______ |
| OQP-GSC-027 | signature | Verificacion publica | Token de verificacion valido | 1. Invocar `GET /api/verificar/{token}`. 2. Verificar compatibilidad con `GET /api/v1/signature/verificar/{token}`. | Estado de verificacion. | Posible tracking en QR. | Evidencia de acceso QR. | ______ | ______ |
| OQP-GSC-028 | signature | Audit trail del documento | Firmante, bloqueador o admin | 1. Invocar `/api/v1/signature/documents/{id}/audit-trail`. 2. Verificar compatibilidad opcional con `/api/signature/documents/{id}/audit-trail`. | Trail completo. | Ninguno. | `document_signature_logs` legibles. | ______ | ______ |
| OQP-GSC-029 | signature | Dashboard de firma | Usuario autenticado | 1. Invocar `/api/v1/signature/dashboard`. 2. Verificar compatibilidad opcional con `/api/signature/dashboard`. | Dashboard con metricas. | Ninguno. | Ninguno. | ______ | ______ |

## 6. Criterio global de aceptacion OQ
- Aprobado: todos los flujos core del area ejecutan conforme a URS/FRS vigentes.
- Aprobado con desviaciones: existen defectos conocidos no bloqueantes con control documental.
- Rechazado: falla algun flujo critico de autenticacion, seguridad, auditoria, preparacion de auditoria, trazabilidad gerencial o firma.

## 7. Resultado final OQ
| Campo | Valor |
|---|---|
| Estado global OQ | __________________ |
| Total ejecutado | __________________ |
| Total aprobado | __________________ |
| Total con desviacion | __________________ |
| Total rechazado | __________________ |
| Aprobacion final | __________________ |
