# REVISION DE HALLAZGOS EN PRODUCCION Y SOLUCIONES

## Area 01: Gobierno, Seguridad, Cumplimiento y Gestion Documental

## 1. Fuentes de verificacion usadas
- Servicio desplegado en produccion: `backend/service_url.txt` -> `https://spi-backend-dp23x4filq-uc.a.run.app`
- Validacion HTTP directa sobre endpoints del servicio desplegado.
- Base real en Neon: `FamSPI`, consultada con credenciales vigentes del entorno y secreto `DB_PASSWORD` de Google Cloud.
- Uso de tablas contrastado contra el codigo actual del repositorio mediante busqueda de referencias reales.

## 2. Verificacion minima en produccion
| Verificacion | Resultado | Evidencia |
|---|---|---|
| `GET /api/v1/auth/google` | `302` | El endpoint de auth esta expuesto en produccion. |
| `GET /api/v1/security/offhours-logins` sin token | `401 {"code":"NO_TOKEN"}` | En produccion el modulo `security` si esta montado y protegido. |
| `GET /api/v1/management/stats` sin token | `401 {"code":"NO_TOKEN"}` | En produccion `management` si esta montado y protegido. |
| `GET /api/v1/auditoria` sin token | `401` | `auditoria` esta montado y protegido. |
| `GET /api/v1/audit-prep/status` sin token | `401` | `audit-prep` esta montado y protegido. |
| `GET /api/verificar/test-token` | `500` | Existe una ruta publica de verificacion, pero para token invalido devuelve error interno. |
| `GET /api/signature/verificar/test-token` sin token | `401 {"code":"NO_TOKEN"}` | En produccion existe al menos un path bajo `/api/signature/*` interceptado por autenticacion. |
| `GET /api/verify/test-token` sin token | `401 {"code":"NO_TOKEN"}` | Existe tambien un alias protegido bajo `/api/verify/*` o una captura equivalente. |

## 3. Estado real de tablas y uso en Neon
| Objeto | Existe en Neon | Registros reales | Uso en codigo | Necesidad real |
|---|---|---:|---|---|
| `auditoria.logs` | SI | 90526 | `auth`, `auditoria`, `security`, `utils/audit`, middleware de auditoria | SI, critica |
| `request_attachments` | SI | 14 | `requests.service`, `files.service`, `users.controller`, `management.service` deberia usarla | SI |
| `request_versions` | SI | 8 | `requests.service`, `users.controller`, `management.service` | SI |
| `requests` | SI | 8 | `approvals`, `management`, `signature` | SI |
| `documents` | SI | 0 | `signature` | SI, aunque hoy sin uso productivo visible |
| `document_signatures_advanced` | SI | 0 | `signature.controller`, `services/signatures/*` | SI a nivel de modelo; no hay evidencia de uso real aun |
| `document_signature_logs` | SI | 0 | `signature.controller`, `immutableSignatureLogger.service` | SI a nivel de modelo; no hay evidencia de uso real aun |
| `user_sessions` | SI | 2123 | `auth`, `security` | SI, critica |
| `audit_documents` | SI | 0 | `audit-prep` | SI como soporte de feature; sin uso productivo actual |
| `audit_access_grants` | SI | 0 | `audit-prep` | SI como soporte de feature; sin uso productivo actual |
| `notifications` | SI | 124 | `notifications.service`, `auth`, `security`, `approvals`, tickets y otros modulos | SI |
| `audit_logs` | NO | 0 | solo `management.service` | NO; debe reemplazarse |
| `attachments` | NO | 0 | solo `management.service` y notas legacy | NO; debe reemplazarse |
| `security_offhours_whitelist` | NO | 0 | solo `security.whitelist.js` | NO para el flujo core actual |
| `security_jobs_log` | NO | 0 | solo `security.siem.js` | NO para el flujo core actual |

## 4. Hallazgos revisados y solucion sin asumir funcionalidad

### H-01 Modulo `security` no montado
- Estado tras verificar produccion: NO SE REPRODUCE EN PRODUCCION.
- Evidencia: `GET /api/v1/security/offhours-logins` responde `401 NO_TOKEN`, no `404`.
- Conclusion tecnica: el despliegue productivo no coincide con el repositorio local en este punto, o existe una capa de enrutamiento no reflejada en el codigo revisado.
- Servicios/tablas implicados: `security.controller.js` usa `auditoria.logs`, `notifications`, `user_sessions`.
- Necesidad real: SI. Las tablas core existen y tienen datos (`auditoria.logs`, `user_sessions`, `notifications`).
- Solucion:
  1. Exportar la revision desplegada de produccion o reconciliar el repositorio con la version realmente en uso.
  2. Si el repo debe representar produccion, agregar el montaje explicito de `security` en `backend/src/app.js`.
  3. No mantener la discrepancia repo vs produccion porque invalida DDS, IQ y OQ.

### H-02 Tablas `security_offhours_whitelist` y `security_jobs_log` ausentes
- Estado en Neon: CONFIRMADO.
- Evidencia: no existen en catalogo de la base real.
- Servicios que las usan: solo `backend/src/modules/security/security.whitelist.js` y `backend/src/modules/security/security.siem.js`.
- Necesidad real: NO para el flujo core actual de consulta/revision de logins off-hours, porque `security.controller.js` opera con `auditoria.logs`, `notifications` y `user_sessions`.
- Solucion:
  1. Si whitelist/SIEM no estan activados realmente, remover esas dependencias del alcance documental y dejar los helpers fuera de runtime.
  2. Si se quieren activar, crear primero migraciones reales para ambas tablas y luego cablear explicitamente su uso desde `auth`/`security`.
  3. No dejar codigo apuntando a tablas inexistentes.

### H-03 `management.service.js` usa `audit_logs` y `attachments`
- Estado en Neon: CONFIRMADO.
- Evidencia: ambas tablas no existen; si existen `auditoria.logs`, `request_attachments` y `request_versions` con datos reales.
- Servicios que usan los objetos correctos: `utils/audit`, `auditoria.service`, `requests.service`, `files.service`, `users.controller`.
- Necesidad real: SI hay necesidad funcional de trazabilidad y adjuntos; NO hay necesidad de las tablas `audit_logs` y `attachments` porque son nombres incorrectos/legacy.
- Solucion exacta:
  1. Reemplazar `SELECT * FROM audit_logs ...` por consulta contra `auditoria.logs` filtrando `request_id` o `datos_nuevos` segun el identificador real que ya se registra.
  2. Reemplazar `SELECT * FROM attachments WHERE request_id=$1` por `SELECT * FROM request_attachments WHERE request_id=$1`.
  3. Mantener `request_versions` como fuente de versiones, porque existe y tiene registros.
  4. Cubrir `GET /management/trace/:id` y `GET /management/documents/:id` con pruebas de integracion contra Neon.

### H-04 Uso de `users.nombre_completo`
- Estado en Neon: CONFIRMADO.
- Evidencia: la tabla real `users` tiene columnas `name` y `fullname`; no existe `nombre_completo`.
- Servicios afectados: `backend/src/modules/audit-prep/auditPrep.service.js`, `backend/src/modules/management/management.service.js`.
- Necesidad real: SI es necesario mostrar nombre del usuario; NO es necesario el nombre de columna `nombre_completo`.
- Solucion exacta:
  1. Sustituir por `COALESCE(u.fullname, u.name, u.email)` en todas las consultas del area 01.
  2. Si se necesita consistencia transversal, crear un helper SQL o vista de perfil publico de usuario y dejar de duplicar alias manuales.

### H-05 Insercion de `consent_text` en `document_signatures_advanced`
- Estado en Neon: CONFIRMADO.
- Evidencia: la tabla real no tiene columna `consent_text`.
- Servicios afectados: `backend/src/modules/signature/signature.controller.js`, `backend/src/services/signatures/advancedSignature.service.js`. Tambien hay referencias similares en modulos externos al area 01 (`permisos`, `vacaciones`).
- Necesidad real: NO hay evidencia en el modelo productivo actual de que `consent_text` forme parte de la persistencia oficial de firmas; la tabla real no lo soporta y hoy no tiene registros.
- Solucion exacta:
  1. Alinear todos los `INSERT` y `SELECT` de `document_signatures_advanced` a las columnas que realmente existen en Neon.
  2. Eliminar `consent_text` de las escrituras del area 01 mientras no exista migracion aprobada que lo agregue.
  3. Si negocio decide preservarlo en el futuro, primero crear migracion y luego actualizar todos los writers/readers; no mezclar codigo nuevo con esquema viejo.

### H-06 `signer_email` obligatorio y no poblado por el backend de firma
- Estado en Neon: CONFIRMADO.
- Evidencia: `document_signatures_advanced.signer_email` existe y es `NOT NULL`.
- Servicios afectados: `signature.controller.js`, `advancedSignature.service.js`.
- Necesidad real: SI. La tabla no acepta inserciones validas sin este dato.
- Solucion exacta:
  1. Poblar `signer_email` con `req.user.email` en todas las inserciones.
  2. Si el token no trae email, consultar `users` por `req.user.id` antes de firmar.
  3. Si aun asi no existe email, devolver `422` y no intentar escribir la firma.

### H-07 Estados en ingles (`approved`/`rejected`) contra estados reales en espanol
- Estado en Neon: CONFIRMADO.
- Evidencia: en produccion solo existen `rechazado` y `pendiente` en `requests`; el constraint permite `pendiente`, `en_revision`, `aprobado`, `rechazado`, `cancelado`.
- Servicios afectados en area 01: `backend/src/modules/management/management.service.js`.
- Servicios fuera de area 01 con el mismo patron: `clients`, `equipment-purchases`, `private-purchases`, `permisos` y otros.
- Necesidad real: SI, porque el estado gobierna reportes y workflows. NO es valido seguir usando literales en ingles contra esta tabla.
- Solucion exacta:
  1. Reemplazar en el area 01 todos los filtros `approved/rejected` por `aprobado/rechazado`.
  2. Extraer las constantes de estado a un modulo compartido backend para evitar nuevos desalineamientos.
  3. Revisar el resto del repositorio para la misma correccion, porque el problema excede el area 01.

### H-08 `auth/me` escribe en `user_attendance_records`
- Estado en Neon: CONFIRMADO como dependencia real.
- Evidencia: `user_attendance_records` existe y es usada activamente por `attendance.controller`, `attendance.service`, `attendanceOvertimeScheduler`, `viaticos.service` y `auth.controller`.
- Necesidad real de la tabla: SI, pero es transversal al dominio de asistencia.
- Necesidad real de que `auth/me` escriba ahi: NO se puede justificar desde el modelo del modulo `auth`; es una responsabilidad cruzada.
- Solucion exacta:
  1. Quitar la insercion de asistencia de `GET /auth/me` y moverla al modulo `attendance` o a un job/endpoint explicito de clock-in.
  2. Si por negocio se requiere mantener ese comportamiento, documentarlo formalmente y registrar auditoria especifica del side effect. Mientras eso no exista, el diseño sigue siendo defectuoso.

### H-09 Rutas de `signature` inconsistentes entre repo y produccion
- Estado tras verificar produccion: CONFIRMADO COMO INCONSISTENCIA, no como ausencia simple.
- Evidencia: `/api/verificar/test-token` existe y devuelve `500`; `/api/signature/verificar/test-token` y `/api/verify/test-token` devuelven `401 NO_TOKEN`.
- Conclusion tecnica: produccion expone o intercepta multiples prefijos relacionados con firma, y no coincide limpiamente con el repositorio local.
- Necesidad real: NO es necesario mantener tres contratos ambiguos para una misma capacidad.
- Solucion exacta:
  1. Definir un prefijo canonico unico para firma/verificacion (`/api/signature/*` o `/api/*`, pero uno solo).
  2. Mantener como mucho alias temporales con respuesta controlada y documentada.
  3. Reconciliar frontend, backend y despliegue para que todos consuman el mismo contrato.
  4. Corregir el endpoint publico de verificacion para que un token invalido responda `404/400`, no `500`.

## 5. Prioridad de correccion recomendada
1. Reconciliar repo vs produccion para `security` y `signature`.
2. Corregir `management.service.js` hacia tablas reales (`auditoria.logs`, `request_attachments`, `request_versions`).
3. Corregir `users.nombre_completo` por `COALESCE(fullname, name, email)`.
4. Alinear `signature` al esquema real (`signer_email` obligatorio, eliminar `consent_text` mientras no exista migracion aprobada).
5. Normalizar estados de `requests` a los valores reales en espanol.
6. Separar el side effect de asistencia fuera de `auth/me`.

## 6. Conclusion
La verificacion en produccion obliga a corregir dos cosas del diagnostico inicial: `security` si esta expuesto en runtime y el contrato de `signature` en produccion no coincide limpiamente con el repositorio local. El resto de hallazgos de datos si queda confirmado por la base real de Neon y por las referencias efectivas del codigo. Las soluciones propuestas arriba se basan en lo que hoy existe realmente en produccion y en Neon, sin asumir funcionalidades no comprobadas.
