# CASOS DE PRUEBA IQ

## 1. Objetivo
Definir la calificacion de instalacion (IQ) del area Gobierno, Seguridad y Cumplimiento del SPI sobre la base del codigo y artefactos verificables en el repositorio.

## 2. Alcance
- Modulos: `auth`, `security`, `auditoria`, `audit-prep`, `approvals`, `management`, `signature`.
- Backend: Express/Node.js.
- Frontend consumidor: React.
- Persistencia verificable: `backend/src/actualsindatos.sql`.

## 3. Criterios IQ
- Verificar presencia de componentes requeridos.
- Verificar montaje real de rutas.
- Verificar disponibilidad de middlewares comunes.
- Verificar existencia de tablas y objetos SQL consumidos.
- Verificar alineacion basica frontend/backend.
- Si un artefacto esperado no existe, se registra como no conforme.

## 4. Casos IQ
| ID | Modulo/Area | Verificacion | Evidencia requerida | Resultado esperado |
|---|---|---|---|---|
| IQ-GSC-001 | area | Existe `backend/src/app.js` y monta el backend principal | Archivo y `app.use()` verificables | Conforme si el archivo existe y monta los modulos reales |
| IQ-GSC-002 | area | Existe `backend/src/actualsindatos.sql` como fuente verificable de esquema | Archivo presente en repositorio | Conforme si el esquema es accesible para trazabilidad |
| IQ-GSC-003 | area | Existe carpeta de migraciones operativa | `backend/src/migrations/*` | No conforme en el estado actual: carpeta no encontrada |
| IQ-GSC-004 | auth | El modulo `auth` tiene rutas, controller y repository | `auth.routes.js`, `auth.controller.js`, `session.repository.js` | Conforme |
| IQ-GSC-005 | auth | El modulo `auth` esta montado en backend | `backend/src/app.js:191` | Conforme |
| IQ-GSC-006 | auth | Frontend tiene consumidores de autenticacion | `spi_front/src/core/api/authApi.js`, `AuthContext.jsx` | Conforme |
| IQ-GSC-007 | security | El modulo `security` tiene rutas y controller | `backend/src/modules/security/*` | Conforme a nivel de archivos |
| IQ-GSC-008 | security | El modulo `security` esta montado en backend | `backend/src/app.js` | No conforme en el estado actual |
| IQ-GSC-009 | security | Los objetos SQL esperados por helpers de `security` existen en el esquema | Tablas `security_offhours_whitelist`, `security_jobs_log` | No conforme en el estado actual |
| IQ-GSC-010 | auditoria | El modulo `auditoria` tiene rutas, controller y service | `audit.routes.js`, `audit.controller.js`, `auditoria.service.js` | Conforme |
| IQ-GSC-011 | auditoria | El modulo `auditoria` esta montado en backend | `backend/src/app.js:232` | Conforme |
| IQ-GSC-012 | auditoria | Existe tabla `auditoria.logs` en esquema | `backend/src/actualsindatos.sql:878` | Conforme |
| IQ-GSC-013 | audit-prep | El modulo `audit-prep` tiene rutas, controller y service | Archivos del modulo presentes | Conforme |
| IQ-GSC-014 | audit-prep | El modulo `audit-prep` esta montado en backend | `backend/src/app.js:233` | Conforme |
| IQ-GSC-015 | audit-prep | Existen tablas `audit_settings`, `audit_sections`, `audit_documents`, `audit_access_grants` | `actualsindatos.sql` | Conforme |
| IQ-GSC-016 | approvals | El modulo `approvals` tiene rutas, controller y service | Archivos del modulo presentes | Conforme |
| IQ-GSC-017 | approvals | El modulo `approvals` esta montado en backend | `backend/src/app.js:228` | Conforme |
| IQ-GSC-018 | approvals | Existen tablas `requests` y `request_approvals` | `actualsindatos.sql` | Conforme |
| IQ-GSC-019 | management | El modulo `management` tiene rutas, controller y service | Archivos del modulo presentes | Conforme |
| IQ-GSC-020 | management | El modulo `management` esta montado en backend | `backend/src/app.js:234` | Conforme |
| IQ-GSC-021 | management | Existen objetos SQL usados por `management.service.js` | `audit_logs`, `attachments` | No conforme en el estado actual |
| IQ-GSC-022 | signature | El modulo `signature` tiene rutas y controller | Archivos del modulo presentes | Conforme |
| IQ-GSC-023 | signature | El modulo `signature` esta montado en backend | `backend/src/app.js:263` | Conforme |
| IQ-GSC-024 | signature | Existen tablas `documents`, `document_hashes`, `document_signatures_advanced`, `document_seals`, `document_qr_codes`, `document_signature_logs` | `actualsindatos.sql` | Conforme parcialmente: existe el modelo base, pero el contrato del controller no coincide totalmente con el esquema |
| IQ-GSC-025 | signature | Frontend y backend usan el mismo prefijo API para firma | `spi_front/src/core/api/signatureApi.js` vs `backend/src/app.js` | No conforme en el estado actual |
| IQ-GSC-026 | area | Existen middlewares comunes `verifyToken` y control de roles | `backend/src/middlewares/auth.js`, `backend/src/middlewares/roles.js` | Conforme a nivel de instalacion, con observacion de inconsistencia funcional |
| IQ-GSC-027 | area | Existen documentos previos URS/FRS/DDS del area | `validacion_sistema/URS/areas`, `FRS/areas`, `DDS` | Conforme |

## 5. Resultado IQ esperado por estado actual
- Conforme: presencia fisica de la mayoria de modulos, rutas y tablas principales.
- No conforme:
  - ausencia de `backend/src/migrations`
  - `security` no montado
  - tablas auxiliares de `security` no verificadas en el esquema
  - `management` referencia objetos SQL no presentes
  - desacople de prefijos API en `signature`

## 6. Conclusion IQ
El area puede calificarse como instalada de forma parcial. La estructura base del sistema existe, pero no cumple completamente la instalacion esperada para `security`, `management` y `signature` bajo un criterio de validacion formal.
