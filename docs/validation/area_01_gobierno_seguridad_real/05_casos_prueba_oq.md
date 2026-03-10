# CASOS DE PRUEBA OQ

## 1. Criterios
- Los casos OQ se derivan exclusivamente del comportamiento verificable en el codigo actual.
- Cuando un endpoint esta roto por el estado real de la implementacion, el resultado esperado describe el comportamiento operativo actual, no el comportamiento deseado.
- Si el registro de auditoria no pudo verificarse de forma directa, se marca como `DESCONOCIDO`.

## 2. Casos OQ por modulo

### 2.1 Modulo `auth`
| ID de prueba | Modulo | Endpoint | Entrada | Comportamiento esperado | Cambios esperados en BD | Registro esperado en auditoria | Escenarios de error |
|---|---|---|---|---|---|---|---|
| OQ-AUTH-001 | auth | `GET /api/v1/auth/google` | Solicitud sin body | Redirecciona a Google OAuth | Ninguno | Ninguno verificable | `500` si falla configuracion OAuth |
| OQ-AUTH-002 | auth | `GET /api/v1/auth/google/callback` | `code` valido Google | Crea/actualiza usuario, emite `accessToken` y `refreshToken`, redirecciona al frontend | `INSERT/UPDATE users`, `INSERT user_sessions` | Insercion en `auditoria.logs` con `login_success` u `offhours_login` | Redireccion con `error=oauth_failed`, `error=unauthorized_domain` o equivalente |
| OQ-AUTH-003 | auth | `GET /api/v1/auth/me` | Header `Authorization: Bearer <token>` | Devuelve perfil del usuario autenticado | Puede crear fila en `user_attendance_records` si no existe registro del dia | No se verifico log especifico; `DESCONOCIDO` | `401` token invalido, `404` usuario no encontrado, `500` error SQL |
| OQ-AUTH-004 | auth | `POST /api/v1/auth/refresh` | Header `x-refresh-token` con token firmado | Devuelve nuevo `accessToken` y `refreshToken` | `UPDATE user_sessions.refresh_token` o `INSERT user_sessions` si no encontro fila | Ninguno verificable | `401` refresh token invalido/expirado |
| OQ-AUTH-005 | auth | `POST /api/v1/auth/logout` | `Authorization` valido y opcional `x-refresh-token` | Cierra sesion por email o refresh token y responde confirmacion | `UPDATE user_sessions.logout_time` | Ninguno verificable | `500` si falla cierre de sesion |
| OQ-AUTH-006 | auth | `POST /api/v1/auth/lopdp/accept` | Body con firma/documento requerido y token valido | Registra aceptacion interna LOPDP y devuelve usuario actualizado | `UPDATE users`, `INSERT user_lopdp_consents` | No se verifico insercion explicita en `auditoria.logs`; `DESCONOCIDO` | `400` datos faltantes, `409` si ya estaba aceptado, `500` al subir a Drive o persistir |
| OQ-AUTH-007 | auth | `GET /api/v1/auth/sessions` | Token valido con rol `ti` o `gerencia` | Lista sesiones registradas | Ninguno | Ninguno verificable | `401` sin token; riesgo: un rol no previsto puede pasar por bypass RBAC |
| OQ-AUTH-008 | auth | `GET /api/v1/auth/active-users` | Token valido con rol `ti` o `gerencia` | Lista usuarios con sesion activa | Ninguno | Ninguno verificable | `401` sin token; riesgo: bypass RBAC por `middlewares/auth.js` |

### 2.2 Modulo `security`
| ID de prueba | Modulo | Endpoint | Entrada | Comportamiento esperado | Cambios esperados en BD | Registro esperado en auditoria | Escenarios de error |
|---|---|---|---|---|---|---|---|
| OQ-SEC-001 | security | `GET /api/v1/security/offhours-logins` | Token valido de TI | En el estado actual responde `404` porque el modulo no esta montado | Ninguno | Ninguno | Si se monta sin corregir RBAC, existe riesgo de acceso indebido |
| OQ-SEC-002 | security | `GET /api/v1/security/offhours-logins/:id/timeline` | Token valido de TI | En el estado actual responde `404`; si se montara, la implementacion fallaria por uso de `created_en` | Ninguno | Ninguno | `500` por error SQL al ejecutar timeline |
| OQ-SEC-003 | security | `POST /api/v1/security/offhours-logins/:id/review` | Token valido de TI y body de revision | En el estado actual responde `404` porque el modulo no esta montado | Ninguno verificable | `DESCONOCIDO` | Si se habilita sin correcciones, puede degradar trazabilidad |
| OQ-SEC-004 | security | `GET /api/v1/security/offhours-logins/export` | Token valido de TI | En el estado actual responde `404` | Ninguno | Ninguno | `500` si se monta y la consulta falla |
| OQ-SEC-005 | security | `POST /api/v1/security/dev/emit-offhours` | Entorno dev + flag activa | En el estado actual responde `404`; si se monta podria fallar por handler indefinido | Ninguno | Ninguno | Error de carga o ejecucion por `emitOffHoursTest` no exportado |

### 2.3 Modulo `auditoria`
| ID de prueba | Modulo | Endpoint | Entrada | Comportamiento esperado | Cambios esperados en BD | Registro esperado en auditoria | Escenarios de error |
|---|---|---|---|---|---|---|---|
| OQ-AUD-001 | auditoria | `GET /api/v1/auditoria` | Token valido con rol permitido y filtros opcionales | Devuelve lista paginada/filtrada de `auditoria.logs` | Ninguno | Ninguno adicional | `401/403` por acceso no autorizado, `500` por error SQL |
| OQ-AUD-002 | auditoria | `GET /api/v1/auditoria/:id` | Token valido con rol permitido | Devuelve detalle de un log existente | Ninguno | Ninguno adicional | `404` si el id no existe, `401/403` si no tiene acceso |
| OQ-AUD-003 | auditoria | `GET /api/v1/auditoria/export/csv` | Token valido con rol `ti` o `gerencia` | Exporta CSV de auditoria | Ninguno | Ninguno adicional | `401/403` por acceso, `500` por fallo de serializacion o SQL |

### 2.4 Modulo `audit-prep`
| ID de prueba | Modulo | Endpoint | Entrada | Comportamiento esperado | Cambios esperados en BD | Registro esperado en auditoria | Escenarios de error |
|---|---|---|---|---|---|---|---|
| OQ-APREP-001 | audit-prep | `GET /api/v1/audit-prep/status` | Solicitud autenticada segun montaje global | Devuelve estado de auditoria | Ninguno | `DESCONOCIDO` | `500` si falta configuracion |
| OQ-APREP-002 | audit-prep | `PUT /api/v1/audit-prep/status` | Body con `audit_mode`/fechas y rol TI admin | Actualiza configuracion de auditoria | `UPDATE/UPSERT audit_settings` | `DESCONOCIDO` | Riesgo de acceso indebido por bypass RBAC de `middlewares/auth.js` |
| OQ-APREP-003 | audit-prep | `GET /api/v1/audit-prep/sections` | Solicitud autenticada | Devuelve secciones disponibles segun reglas del service | Ninguno | `DESCONOCIDO` | `500` si falla lectura |
| OQ-APREP-004 | audit-prep | `POST /api/v1/audit-prep/sections` | Body con definicion de seccion y rol TI admin | Inserta o actualiza seccion auditable | `INSERT/UPDATE audit_sections` | `DESCONOCIDO` | Riesgo de acceso indebido por bypass RBAC |
| OQ-APREP-005 | audit-prep | `GET /api/v1/audit-prep/documents` | Solicitud autenticada | En el estado actual puede responder `500` por `u.nombre_completo` inexistente | Ninguno | `DESCONOCIDO` | Error SQL por columna inexistente |
| OQ-APREP-006 | audit-prep | `POST /api/v1/audit-prep/documents/upload` | Multipart o body con archivo valido y metadata | Sube documento y lo registra en `audit_documents` | `INSERT audit_documents` y posible carga externa a Drive | `DESCONOCIDO` | `400` por tipo/tamano invalido, `500` por Drive o SQL |
| OQ-APREP-007 | audit-prep | `PATCH /api/v1/audit-prep/documents/:id/status` | Body con nuevo estado | Actualiza estado del documento | `UPDATE audit_documents.status` | `DESCONOCIDO` | `404` documento inexistente, `500` fallo SQL |
| OQ-APREP-008 | audit-prep | `GET /api/v1/audit-prep/documents/:id/download` | Id de documento accesible | Devuelve enlace o stream de descarga | Ninguno | `DESCONOCIDO` | `404` si no existe, `500` si falla Drive |
| OQ-APREP-009 | audit-prep | `GET /api/v1/audit-prep/external-access` | Token valido con rol TI admin | Lista accesos temporales de auditores externos | Ninguno | `DESCONOCIDO` | Riesgo de acceso indebido por bypass RBAC |
| OQ-APREP-010 | audit-prep | `POST /api/v1/audit-prep/external-access` | Body con email externo y vencimiento | Crea acceso externo si no excede el maximo de 2 activos | `INSERT audit_access_grants` | `DESCONOCIDO` | `409` o error de negocio al superar limite; `500` fallo SQL |
| OQ-APREP-011 | audit-prep | `DELETE /api/v1/audit-prep/external-access/:id` | Id de grant y rol TI admin | Revoca acceso externo | `UPDATE audit_access_grants.active=false` o equivalente | `DESCONOCIDO` | `404` grant inexistente, `500` fallo SQL |

### 2.5 Modulo `approvals`
| ID de prueba | Modulo | Endpoint | Entrada | Comportamiento esperado | Cambios esperados en BD | Registro esperado en auditoria | Escenarios de error |
|---|---|---|---|---|---|---|---|
| OQ-APP-001 | approvals | `GET /api/v1/approvals/pending` | Token valido con rol permitido | Lista solicitudes pendientes de revision | Ninguno | Ninguno adicional | `401/403` sin acceso; observar que el resultado no se segmenta realmente por rol |
| OQ-APP-002 | approvals | `POST /api/v1/approvals/:id/approve` | Token valido de jefe tecnico/servicio y solicitud pendiente | Inserta decision de aprobacion y actualiza estado de la solicitud | `INSERT request_approvals`, `UPDATE requests.status` | Se intenta registrar auditoria, pero el payload actual es inconsistente | `404` solicitud inexistente, `409` si ya fue atendida, `500` error SQL/notificacion |
| OQ-APP-003 | approvals | `POST /api/v1/approvals/:id/reject` | Token valido de jefe tecnico/servicio, id de solicitud y comentario si aplica | Inserta rechazo y actualiza estado de la solicitud | `INSERT request_approvals`, `UPDATE requests.status` | Se intenta registrar auditoria, pero puede quedar degradada | `404`, `409`, `500` segun estado o error de persistencia |

### 2.6 Modulo `management`
| ID de prueba | Modulo | Endpoint | Entrada | Comportamiento esperado | Cambios esperados en BD | Registro esperado en auditoria | Escenarios de error |
|---|---|---|---|---|---|---|---|
| OQ-MGMT-001 | management | `GET /api/v1/management/stats` | Token valido con rol `gerente_general` o `admin` | Devuelve metricas agregadas | Ninguno | Ninguno adicional | Puede devolver contadores incorrectos por estados no alineados al schema |
| OQ-MGMT-002 | management | `GET /api/v1/management/requests` | Token valido con rol permitido | Devuelve maximo 200 solicitudes con datos del payload | Ninguno | Ninguno adicional | `500` si cambia el schema o si `u.name` no esta disponible en el entorno real |
| OQ-MGMT-003 | management | `GET /api/v1/management/trace/:id` | Token valido con rol permitido | En el estado actual responde `500` por consulta a `audit_logs` inexistente | Ninguno | Ninguno | Error SQL por tabla inexistente |
| OQ-MGMT-004 | management | `GET /api/v1/management/documents/:id` | Token valido con rol permitido | En el estado actual responde `500` por consulta a `attachments` inexistente | Ninguno | Ninguno | Error SQL por tabla inexistente |

### 2.7 Modulo `signature`
| ID de prueba | Modulo | Endpoint | Entrada | Comportamiento esperado | Cambios esperados en BD | Registro esperado en auditoria | Escenarios de error |
|---|---|---|---|---|---|---|---|
| OQ-SIGN-001 | signature | `POST /api/documents/:documentId/sign` | Token valido, `document_base64`, `consent`, `role_at_sign`, `authorized_role`, `session_id` | En el estado actual se espera falla operacional durante la insercion de firma por incompatibilidad con el schema | Transaccion iniciada; no debe persistir cambios si hace rollback | No se verifico escritura en `auditoria.logs`; auditoria propia del modulo queda `DESCONOCIDO` | `400` validacion de entrada, `500` por columna `consent_text` ausente o `signer_email` faltante |
| OQ-SIGN-002 | signature | `GET /api/verificar/:token` | Token publico de verificacion | Devuelve estado de verificacion si el token existe | Puede registrar acceso QR via funcion SQL asociada | `DESCONOCIDO` | `404` token no encontrado, `500` error en funcion SQL |
| OQ-SIGN-003 | signature | `GET /api/verify/:token` | Token publico de verificacion | Debe comportarse igual al alias legacy | Igual que el caso anterior | `DESCONOCIDO` | Mismos errores del endpoint principal |
| OQ-SIGN-004 | signature | `GET /api/documents/:documentId/audit-trail` | Token valido del firmante o admin | Devuelve trail documental si el usuario es firmante; un admin puede ser rechazado por validacion defectuosa de `req.user.roles` | Ninguno | No usa `auditoria.logs`; consulta `get_document_audit_trail()` | `403` admin falso negativo, `404` documento inexistente, `500` error SQL |
| OQ-SIGN-005 | signature | `GET /api/dashboard` | Token valido | Devuelve metricas del modulo de firma | Ninguno | Ninguno verificable | `500` si fallan consultas agregadas |

## 3. Casos de validacion de integridad transversal
| ID de prueba | Objetivo | Entrada | Resultado esperado |
|---|---|---|---|
| OQ-X-001 | Verificar que un rol no mapeado no pueda acceder a `auth/sessions` | JWT valido con rol no incluido en la jerarquia hardcoded de `middlewares/auth.js` | En la implementacion actual existe riesgo de acceso permitido. Debe registrarse como defecto reproducible si ocurre. |
| OQ-X-002 | Verificar revocacion efectiva de refresh token | Login valido -> logout -> `POST /auth/refresh` con refresh previo | El comportamiento seguro esperado seria `401`, pero la implementacion actual puede renovar sesion; registrar resultado real. |
| OQ-X-003 | Verificar consistencia frontend/backend de `signature` | Ejecutar flujo UI de firma desde `/dashboard/signatures/:documentId/sign` | El frontend actual debe fallar por ruta API y/o `documentId` no inyectado. |
| OQ-X-004 | Verificar que `security` este realmente expuesto | Consultar cualquier endpoint `security` montado esperado | El estado real actual es `404`, confirmando que el modulo no esta en runtime. |

## 4. Observaciones de ejecucion
- Los casos `OQ-SEC-*`, `OQ-MGMT-003`, `OQ-MGMT-004`, `OQ-SIGN-001` y `OQ-X-*` son prioritarios porque validan defectos estructurales de alto impacto.
- En endpoints donde el estado esperado actual es error, la ejecucion debe registrar explicitamente si el error es `404`, `500` o acceso indebido. Esa evidencia sirve para corregir URS/FRS/DDS.
