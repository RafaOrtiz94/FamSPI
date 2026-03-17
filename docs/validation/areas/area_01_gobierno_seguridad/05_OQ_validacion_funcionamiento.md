# OQ - AREA 01 GOBIERNO, SEGURIDAD Y CUMPLIMIENTO

## 1. Objetivo
Definir casos de calificacion operacional basados en el comportamiento real verificable del area 01.

## 2. Casos OQ por modulo
### 2.1 `auth`
| ID | Endpoint | Resultado esperado |
|---|---|---|
| OQ-AUTH-001 | `GET /api/v1/auth/google` | redirige a Google OAuth |
| OQ-AUTH-002 | `GET /api/v1/auth/google/callback?code=*` | crea/actualiza usuario, crea sesion, registra auditoria de login y redirige con tokens |
| OQ-AUTH-003 | `GET /api/v1/auth/me` | devuelve perfil autenticado; no registra asistencia aqui |
| OQ-AUTH-004 | `POST /api/v1/auth/refresh` | renueva tokens solo si el refresh token corresponde a una sesion activa |
| OQ-AUTH-005 | `POST /api/v1/auth/logout` | cierra sesiones activas del usuario o la sesion asociada al refresh token |
| OQ-AUTH-006 | `POST /api/v1/auth/lopdp/accept` | guarda evidencia interna en Drive y actualiza `users` / `user_lopdp_consents` |
| OQ-AUTH-007 | `GET /api/v1/auth/sessions` | lista sesiones para TI/Gerencia |
| OQ-AUTH-008 | `GET /api/v1/auth/active-users` | lista usuarios con sesion abierta |

### 2.2 `security`
| ID | Endpoint | Resultado esperado |
|---|---|---|
| OQ-SEC-001 | `GET /api/v1/security/offhours-logins` | devuelve eventos off-hours saneados y paginados |
| OQ-SEC-002 | `GET /api/v1/security/offhours-logins/:id/timeline` | devuelve timeline asociado al `correlation_id` |
| OQ-SEC-003 | `POST /api/v1/security/offhours-logins/:id/review` | marca notificaciones de seguridad como revisadas y registra accion de revision |
| OQ-SEC-004 | `GET /api/v1/security/offhours-logins/export` | exporta CSV o JSON saneado |

### 2.3 `auditoria`
| ID | Endpoint | Resultado esperado |
|---|---|---|
| OQ-AUD-001 | `GET /api/v1/auditoria` | devuelve logs filtrables y paginados |
| OQ-AUD-002 | `GET /api/v1/auditoria/:id` | devuelve detalle de registro |
| OQ-AUD-003 | `GET /api/v1/auditoria/export/csv` | exporta auditoria a CSV |

### 2.4 `audit-prep`
| ID | Endpoint | Resultado esperado |
|---|---|---|
| OQ-APREP-001 | `GET /api/v1/audit-prep/status` | devuelve status y ventana de auditoria |
| OQ-APREP-002 | `PUT /api/v1/audit-prep/status` | actualiza modo/fechas si el rol es TI autorizado |
| OQ-APREP-003 | `GET /api/v1/audit-prep/sections` | devuelve secciones filtradas por rol |
| OQ-APREP-004 | `POST /api/v1/audit-prep/sections` | inserta o actualiza seccion |
| OQ-APREP-005 | `GET /api/v1/audit-prep/documents` | lista documentos visibles para el rol |
| OQ-APREP-006 | `POST /api/v1/audit-prep/documents/upload` | valida archivo, crea carpeta Drive y registra `audit_documents` |
| OQ-APREP-007 | `PATCH /api/v1/audit-prep/documents/:id/status` | actualiza estado documental |
| OQ-APREP-008 | `GET /api/v1/audit-prep/documents/:id/download` | obtiene documento si la seccion esta permitida |
| OQ-APREP-009 | `GET /api/v1/audit-prep/external-access` | lista accesos externos |
| OQ-APREP-010 | `POST /api/v1/audit-prep/external-access` | crea acceso externo si no excede 2 activos |
| OQ-APREP-011 | `DELETE /api/v1/audit-prep/external-access/:id` | revoca acceso externo |

### 2.5 `approvals`
| ID | Endpoint | Resultado esperado |
|---|---|---|
| OQ-APP-001 | `GET /api/v1/approvals/pending` | lista pendientes no finalizados del flujo soportado |
| OQ-APP-002 | `POST /api/v1/approvals/:id/approve` | inserta decision y actualiza `requests.status` a aprobado |
| OQ-APP-003 | `POST /api/v1/approvals/:id/reject` | inserta decision y actualiza `requests.status` a rechazado |

### 2.6 `management`
| ID | Endpoint | Resultado esperado |
|---|---|---|
| OQ-MGMT-001 | `GET /api/v1/management/stats` | devuelve resumen y conteo por tipo |
| OQ-MGMT-002 | `GET /api/v1/management/requests` | devuelve listado paginado del lote solicitado |
| OQ-MGMT-003 | `GET /api/v1/management/trace/:id` | devuelve trazabilidad desde `auditoria.logs` |
| OQ-MGMT-004 | `GET /api/v1/management/documents/:id` | devuelve adjuntos y versiones |

### 2.7 `signature`
| ID | Endpoint | Resultado esperado |
|---|---|---|
| OQ-SIGN-001 | `POST /api/signature/documents/:documentId/sign` | calcula hash, inserta firma, crea sello/QR y bloquea documento |
| OQ-SIGN-002 | `GET /api/verificar/:token` | devuelve verificacion publica si el token existe y esta activo |
| OQ-SIGN-003 | `GET /api/signature/verificar/:token` | alias funcional del endpoint publico |
| OQ-SIGN-004 | `GET /api/signature/documents/:documentId/audit-trail` | devuelve trail documental para firmante, bloqueador o admin |
| OQ-SIGN-005 | `GET /api/signature/dashboard` | devuelve metricas del modulo |

## 3. Escenarios de error a registrar
- `401` token ausente o invalido.
- `403` acceso por rol no autorizado.
- `404` id o token inexistente.
- `409` conflicto de negocio en `audit-prep`.
- `500` error SQL, integracion Drive, correo o funcion SQL de firma.

## 4. Observaciones operativas
- `auth` registra clock-in durante el callback de login, no en `/auth/me`.
- `security` ya esta operativo y montado.
- `management` usa objetos SQL alineados al esquema real.
- `signature` es operativo solo si el entorno dispone de las funciones/vistas SQL dependientes.
- `approvals` sigue teniendo una cola general no segmentada por aprobador real.
