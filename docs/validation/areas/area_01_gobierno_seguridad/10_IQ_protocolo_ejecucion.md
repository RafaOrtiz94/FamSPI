# PROTOCOLO IQ - CALIFICACION DE INSTALACION
## Area 01: Gobierno, Seguridad y Cumplimiento

## 1. Objetivo
Verificar que los componentes del area 01 se encuentren correctamente instalados, configurados y disponibles en el entorno objetivo antes de ejecutar pruebas funcionales y de desempeno.

## 2. Referencias
- `01_URS_requerimientos_usuario.md`
- `02_FRS_requerimientos_funcionales.md`
- `03_DDS_diseno_tecnico.md`
- `03A_DD_diccionario_datos.md`
- `04_IQ_validacion_instalacion.md`
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
| Version aplicada | __________________ |

## 4. Precondiciones generales
- Backend desplegado y accesible.
- Base de datos del ambiente accesible.
- Secretos y variables de entorno cargados.
- Credenciales de prueba disponibles para TI, Gerencia, Jefe TI y usuario estandar.
- Acceso a logs de aplicacion y, de ser posible, a consultas de base de datos.

## 5. Protocolo de ejecucion
| ID | Modulo | Verificacion | Precondiciones especificas | Pasos de ejecucion | Evidencia esperada | Criterio de aceptacion | Resultado | Estado |
|---|---|---|---|---|---|---|---|---|
| IQP-GSC-001 | area | Backend principal montado | Aplicacion desplegada | 1. Invocar `/health`. 2. Verificar respuesta HTTP. | Respuesta `200` con `ok=true` o equivalente. | Conforme si el backend responde saludablemente. | ______ | ______ |
| IQP-GSC-002 | area | Rutas base del area montadas | Token valido segun rol requerido | 1. Verificar acceso a `/api/v1/auth/google`. 2. Verificar proteccion/alcance de `/api/v1/security/offhours-logins`, `/api/v1/auditoria`, `/api/v1/audit-prep/status`, `/api/v1/approvals/pending`, `/api/v1/management/stats`. | `302` para OAuth y `401/403/200` coherentes segun autenticacion. | Conforme si las rutas existen y no responden `404` injustificado. | ______ | ______ |
| IQP-GSC-003 | auth | Configuracion OAuth disponible | Variables Google configuradas | 1. Consultar `/api/v1/auth/google`. 2. Validar redireccion hacia Google. | URL OAuth generada sin error interno. | Conforme si no hay `500` por configuracion faltante. | ______ | ______ |
| IQP-GSC-004 | auth | Persistencia de sesiones disponible | DB accesible | 1. Verificar existencia de `user_sessions`. 2. Confirmar columnas base (`user_email`, `refresh_token`, `login_time`, `logout_time`). | Tabla y columnas visibles. | Conforme si el repositorio y la base del ambiente soportan la sesion. | ______ | ______ |
| IQP-GSC-005 | security | Centro de seguridad operativo | Usuario TI | 1. Invocar `GET /api/v1/security/offhours-logins` con token TI. | Respuesta distinta de `404`; si no hay datos, lista vacia valida. | Conforme si la ruta esta montada y protegida. | ______ | ______ |
| IQP-GSC-006 | security | Artefactos core disponibles | DB accesible | 1. Verificar existencia de `auditoria.logs`, `notifications`, `user_sessions`. | Objetos visibles en DB. | Conforme si el flujo core de seguridad tiene soporte tabular. | ______ | ______ |
| IQP-GSC-007 | auditoria | Bitacora instalada | Usuario autorizado | 1. Invocar `GET /api/v1/auditoria`. 2. Verificar estructura de respuesta. | Respuesta paginada de auditoria. | Conforme si el modulo responde y consume `auditoria.logs`. | ______ | ______ |
| IQP-GSC-008 | audit-prep | Tablas y rutas de auditoria preparatoria disponibles | DB accesible y token valido | 1. Verificar `audit_settings`, `audit_sections`, `audit_documents`, `audit_access_grants`. 2. Invocar `GET /api/v1/audit-prep/status`. | Tablas existentes y endpoint operativo. | Conforme si ambas capas existen. | ______ | ______ |
| IQP-GSC-009 | approvals | Motor de decisiones del flujo soportado disponible | Token tecnico/jefatura | 1. Invocar `GET /api/v1/approvals/pending`. 2. Verificar estructura base. 3. Confirmar existencia de `request_approvals`. | Cola operativa y tabla de decisiones presente. | Conforme si el modulo responde y persiste decisiones. | ______ | ______ |
| IQP-GSC-010 | management | Dashboard gerencial instalado | Token gerencial | 1. Invocar `GET /api/v1/management/stats`. 2. Verificar rutas `/requests`, `/trace/:id`, `/documents/:id`. | Endpoints accesibles sin `404`. | Conforme si el modulo esta montado y protegido. | ______ | ______ |
| IQP-GSC-011 | management | Tablas reales del modulo alineadas | DB accesible | 1. Verificar `requests`, `request_types`, `request_attachments`, `request_versions`. 2. Confirmar uso de `auditoria.logs`. | Objetos presentes. | Conforme si el flujo real del modulo esta soportado por la base. | ______ | ______ |
| IQP-GSC-012 | signature | Servicio de firma instalado | Token valido y DB accesible | 1. Verificar montaje bajo `/api`. 2. Verificar alias versionado `/api/v1/signature/*`. 3. Verificar compatibilidad bajo `/api/signature/*`. 4. Consultar endpoint publico `/api/verificar/{token_prueba}` o `/api/v1/signature/verificar/{token_prueba}`. | Respuesta del modulo, no `404` estructural. | Conforme si el ruteo real del modulo existe y ambas rutas documentadas responden. | ______ | ______ |
| IQP-GSC-013 | signature | Dependencias SQL de firma disponibles | DB accesible | 1. Verificar tablas `documents`, `document_hashes`, `document_signatures_advanced`, `document_seals`, `document_qr_codes`, `document_signature_logs`. 2. Verificar vista `document_verification_info` y funciones `create_document_seal_and_qr`, `track_qr_access`. | Objetos SQL presentes. | Conforme parcial si faltan artefactos auxiliares de firma; no conforme si faltan objetos core. | ______ | ______ |
| IQP-GSC-014 | area | Jobs internos disponibles | Backend desplegado con jobs | 1. Verificar existencia de `/internal/jobs/*`. 2. Confirmar disponibilidad del mecanismo de jobs para el area. | Endpoints internos accesibles con `JOBS_KEY`. | Conforme si el ambiente puede disparar jobs del backend. | ______ | ______ |

## 6. Criterio global de aceptacion IQ
- Aprobado: todos los componentes core del area estan disponibles y sin faltantes bloqueantes.
- Aprobado con observaciones: existen faltantes no nucleares pero el flujo core puede ejecutarse.
- Rechazado: falta algun componente o artefacto indispensable para `auth`, `security`, `auditoria`, `audit-prep`, `management` o `signature`.

## 7. Resultado final IQ
| Campo | Valor |
|---|---|
| Estado global IQ | __________________ |
| Total ejecutado | __________________ |
| Total conforme | __________________ |
| Total con observacion | __________________ |
| Total no conforme | __________________ |
| Aprobacion final | __________________ |
