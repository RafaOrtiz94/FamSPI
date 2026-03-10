# MATRIZ DE TRAZABILIDAD DE REQUERIMIENTOS (RTM)

## 1. Alcance
- Area evaluada: Gobierno, Seguridad y Cumplimiento.
- Documentos contrastados: `validacion_sistema/URS/areas/area_01_gobierno_seguridad.md`, `validacion_sistema/FRS/areas/FRS_area_01_gobierno_seguridad.md`, `validacion_sistema/DDS/DDS_area_01_gobierno_seguridad.md`.
- Evidencia tecnica usada: implementacion real en `backend/src/modules/*`, `backend/src/middlewares/*`, `backend/src/app.js`, `spi_front/src/core/api/*`, `spi_front/src/modules/*`, `backend/src/actualsindatos.sql`.
- Regla aplicada: si la funcionalidad no puede ejecutarse de forma verificable desde el codigo actual, la clasificacion prioriza el comportamiento operativo real.

## 2. RTM URS/FRS contra implementacion real
| URS | FRS | Requerimiento | Estado | Evidencia de codigo | Observacion tecnica | Propuesta de correccion |
|---|---|---|---|---|---|---|
| REQ-GSC-001 | FR-GSC-001 | Autenticar usuarios internos antes de habilitar acceso | COINCIDE CON IMPLEMENTACION | `backend/src/modules/auth/auth.routes.js`, `backend/src/modules/auth/auth.controller.js`, `backend/src/app.js:191` | Existe flujo Google OAuth, emision de JWT y consulta de perfil autenticado. | Mantener; agregar pruebas automatizadas de callback, dominio permitido y usuario sin email verificado. |
| REQ-GSC-002 | FR-GSC-002 | Controlar sesiones activas, refresh y logout seguro | PARCIALMENTE IMPLEMENTADO | `backend/src/modules/auth/session.repository.js`, `backend/src/modules/auth/auth.controller.js:496`, `backend/src/modules/auth/auth.controller.js:528`, `backend/src/modules/auth/auth.controller.js:535`, `backend/src/actualsindatos.sql:6928` | Se crean, actualizan y cierran sesiones, pero `refresh` acepta JWT de refresh aun cuando la sesion pudo haber sido cerrada; si no actualiza una sesion existente, crea otra nueva. | Hacer que `refresh` valide sesion activa por token o session id y rechace refresh token revocado o sin fila activa. |
| REQ-GSC-003 | FR-GSC-003 | Autorizar operaciones segun rol, perfil y permiso | PARCIALMENTE IMPLEMENTADO | `backend/src/middlewares/auth.js:75`, `backend/src/middlewares/roles.js`, `backend/src/modules/auth/auth.routes.js`, `backend/src/modules/approvals/approvals.routes.js`, `backend/src/modules/management/management.routes.js` | Hay control por rol, pero no existe matriz de permisos independiente. Ademas conviven dos middlewares distintos de RBAC y `middlewares/auth.js` permite bypass por roles fuera de su jerarquia fija. | Unificar RBAC en un solo middleware, negar roles desconocidos por defecto y documentar la matriz real soportada. |
| REQ-GSC-004 | FR-GSC-004 | Registrar eventos de seguridad y auditoria con actor, fecha, accion y contexto | PARCIALMENTE IMPLEMENTADO | `backend/src/utils/audit.js`, `backend/src/modules/auth/auth.controller.js:356`, `backend/src/modules/auditoria/auditoria.service.js`, `backend/src/modules/approvals/approvals.service.js` | `auth` y `auditoria` registran/consultan bitacora. En `approvals` el uso de `audit.logAction` pasa claves incorrectas (`module`, `action`, `user_id`) y degrada el log. `signature` depende de tablas/funciones propias, no de `auditoria.logs`. | Estandarizar contrato de auditoria y corregir todas las invocaciones para grabar `usuario_id`, `modulo`, `accion` y contexto real. |
| REQ-GSC-005 | FR-GSC-005 | Soportar flujos de aprobacion para procesos con control jerarquico | PARCIALMENTE IMPLEMENTADO | `backend/src/modules/approvals/approvals.routes.js`, `backend/src/modules/approvals/approvals.service.js`, `backend/src/actualsindatos.sql:6361` | Existe flujo de pendientes, aprobar y rechazar sobre `requests` y `request_approvals`, pero el rol recibido por `listPending` no se usa para segmentar la cola y el alcance es solo para solicitudes tecnicas visibles en codigo. | Documentar alcance real del workflow y filtrar pendientes por rol, tipo o paso de aprobacion. |
| REQ-GSC-006 | FR-GSC-006 | Gestionar firma o formalizacion final de documentos | NO IMPLEMENTADO | `backend/src/modules/signature/signature.routes.js`, `backend/src/modules/signature/signature.controller.js:103`, `backend/src/modules/signature/signature.controller.js:189`, `backend/src/actualsindatos.sql:4418`, `spi_front/src/core/api/signatureApi.js` | El backend expone endpoints de firma, pero la insercion usa `consent_text`, columna ausente en `document_signatures_advanced`, omite `signer_email` obligatorio y el frontend consume rutas `/api/signature/*` que no coinciden con el montaje real `/api/*`. | Corregir modelo de datos y contrato API antes de considerar el modulo operativo; alinear frontend, backend y esquema. |
| REQ-GSC-007 | FR-GSC-007 | Consultar trazabilidad de decisiones y cambios | PARCIALMENTE IMPLEMENTADO | `backend/src/modules/auditoria/*`, `backend/src/modules/management/management.service.js`, `backend/src/modules/security/security.controller.js`, `backend/src/app.js:232`, `backend/src/app.js:234` | `auditoria` si consulta/exporta logs. `management/trace` usa tabla `audit_logs` inexistente. `security` define consultas de timeline, pero el modulo no esta montado y contiene columnas mal nombradas (`created_en`). | Limitar la documentacion a la trazabilidad efectiva de `auditoria`, y corregir `management` y `security` antes de reactivar esos alcances. |
| REQ-GSC-008 | FR-GSC-008 | Bloquear operaciones no autorizadas | PARCIALMENTE IMPLEMENTADO | `backend/src/middlewares/auth.js:75`, `backend/src/middlewares/roles.js`, `backend/src/modules/security/security.routes.js`, `backend/src/modules/audit-prep/auditPrep.routes.js` | El sistema si rechaza muchas operaciones sin token o sin rol, pero el `requireRole` de `middlewares/auth.js` no es deny-by-default real y puede autorizar roles desconocidos. | Reemplazar `middlewares/auth.js::requireRole` por version estricta y agregar pruebas negativas para roles no mapeados. |

## 3. Implementado pero no documentado
| Tipo | Evidencia de codigo | Clasificacion | Observacion |
|---|---|---|---|
| `auth/me` genera auto clock-in en asistencia | `backend/src/modules/auth/auth.controller.js:444`, `backend/src/modules/auth/auth.controller.js:451`, `backend/src/actualsindatos.sql:6636` | IMPLEMENTADO PERO NO DOCUMENTADO | Un endpoint de lectura de identidad crea registros en `user_attendance_records`. No aparece en URS/FRS/DDS del area. |
| Header de prueba para forzar login fuera de horario | `backend/src/modules/auth/auth.controller.js` (bloque `x-security-test`) | IMPLEMENTADO PERO NO DOCUMENTADO | Hay comportamiento especial de seguridad para pruebas/desarrollo que altera la clasificacion off-hours. |
| Limite maximo de 2 auditores externos activos | `backend/src/modules/audit-prep/auditPrep.service.js` | IMPLEMENTADO PERO NO DOCUMENTADO | Regla de negocio real del modulo `audit-prep` no declarada en URS/FRS del area. |
| Alias legacy de verificacion `/api/verify/:token` | `backend/src/modules/signature/signature.routes.js` | IMPLEMENTADO PERO NO DOCUMENTADO | Existe compatibilidad hacia atras no reflejada en la documentacion del area. |
| Sanitizacion de privacidad para IP y user-agent en `security` | `backend/src/modules/security/security.privacy.js` | IMPLEMENTADO PERO NO DOCUMENTADO | La privacidad de logs existe en codigo, pero no fue trazada en URS/FRS/DDS. |

## 4. Documentado pero no implementado
| Documento | Declaracion documental | Estado real | Evidencia |
|---|---|---|---|
| URS/FRS/DDS del area | Politicas de seguridad operativas y consultables del modulo `security` | DOCUMENTADO PERO NO IMPLEMENTADO | `backend/src/modules/security/*` existe, pero `backend/src/app.js` no monta el modulo. |
| FRS `FR-GSC-003` | Autorizacion centralizada por permisos | DOCUMENTADO PERO NO IMPLEMENTADO | Solo hay RBAC por rol. No se verifico motor de permisos separado ni tablas de permisos en el alcance analizado. |
| FRS `FR-GSC-006` | Firma ejecutable de hitos con salida operativa consistente | DOCUMENTADO PERO NO IMPLEMENTADO | La implementacion actual de `signature` no es operacional por incompatibilidad entre rutas, payload y esquema SQL. |
| DDS del area | Dependencia de migraciones `017`, `026`, `027`, `029`, `048`, `050`, `105` | DOCUMENTADO PERO NO IMPLEMENTADO / DESCONOCIDO | En el repositorio actual no existe `backend/src/migrations`; la unica evidencia de esquema revisable es `backend/src/actualsindatos.sql`. |
| FRS `FR-GSC-007` | Trazabilidad exportable segun permisos para todo el area | DOCUMENTADO PERO NO IMPLEMENTADO | Solo `auditoria` exporta desde codigo verificable. `security` no esta montado y `management` consulta objetos inexistentes. |

## 5. Consistencia DDS contra implementacion
| Tema DDS | Verificacion | Estado |
|---|---|---|
| Montaje de `auth`, `auditoria`, `audit-prep`, `management`, `signature` | Coincide con `backend/src/app.js:191`, `:232`, `:233`, `:234`, `:263` | COINCIDE CON IMPLEMENTACION |
| Montaje operativo de `security` | No existe en `backend/src/app.js` | NO IMPLEMENTADO |
| Capa repositorio consistente por modulo | Solo se verifico repositorio explicito en `auth/session.repository.js` | PARCIALMENTE IMPLEMENTADO |
| Integridad de `signature` entre frontend/backend | Frontend usa `/api/signature/*`; backend esta montado en `/api/*` | NO IMPLEMENTADO |
| Uso correcto de tablas de `management` | `management.service.js` usa `audit_logs` y `attachments`; el esquema real contiene `auditoria.logs` y `request_attachments` | NO IMPLEMENTADO |

## 6. Conclusiones de trazabilidad
- La documentacion previa describe correctamente el objetivo del area, pero sobrestima el nivel de madurez operativa real de `security`, `management` y `signature`.
- La cobertura mas consistente en codigo real se concentra en `auth`, `auditoria`, `audit-prep` y parte de `approvals`.
- La mayor brecha documental esta en controles de autorizacion, revocacion de sesiones y firma documental.
- Cualquier nueva version de URS/FRS/DDS del area debe rebajarse al alcance efectivamente ejecutable y separar funcionalidades planificadas de funcionalidades operativas.
