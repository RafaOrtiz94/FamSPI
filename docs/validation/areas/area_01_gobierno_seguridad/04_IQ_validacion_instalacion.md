# IQ - AREA 01 GOBIERNO, SEGURIDAD Y CUMPLIMIENTO

## 1. Objetivo
Validar la instalacion real del area 01 segun el codigo vigente del repositorio.

## 2. Criterios IQ
- presencia de modulos y archivos
- montaje real de rutas
- existencia de middleware comun
- disponibilidad de tablas y artefactos SQL usados por el flujo core
- alineacion basica frontend/backend

## 3. Casos IQ
| ID | Modulo | Verificacion | Estado actual |
|---|---|---|---|
| IQ-GSC-001 | area | Existe `backend/src/app.js` y monta modulos del area | Conforme |
| IQ-GSC-002 | area | Existe `backend/src/server.js` y arranca jobs internos del backend | Conforme |
| IQ-GSC-003 | area | Existe carpeta `backend/src/migrations` | No conforme |
| IQ-GSC-004 | area | Existen `verifyToken` y `requireRole` operativos | Conforme |
| IQ-GSC-005 | auth | Existen `auth.routes.js`, `auth.controller.js`, `session.repository.js` | Conforme |
| IQ-GSC-006 | auth | `auth` esta montado bajo `/api/v1/auth` | Conforme |
| IQ-GSC-007 | auth | Frontend consumidor de autenticacion existe | Conforme |
| IQ-GSC-008 | security | Existen rutas y controller del modulo | Conforme |
| IQ-GSC-009 | security | `security` esta montado bajo `/api/v1/security` | Conforme |
| IQ-GSC-010 | security | Existen tablas core usadas por el flujo (`auditoria.logs`, `notifications`, `user_sessions`) | Conforme |
| IQ-GSC-011 | security | Existen tablas auxiliares de `security.whitelist.js` y `security.siem.js` | No conforme parcial |
| IQ-GSC-012 | auditoria | Existen rutas, controller y servicio | Conforme |
| IQ-GSC-013 | auditoria | `auditoria` esta montado bajo `/api/v1/auditoria` | Conforme |
| IQ-GSC-014 | auditoria | Existe `auditoria.logs` | Conforme |
| IQ-GSC-015 | audit-prep | Existen rutas, controller y servicio | Conforme |
| IQ-GSC-016 | audit-prep | `audit-prep` esta montado bajo `/api/v1/audit-prep` | Conforme |
| IQ-GSC-017 | audit-prep | Existen `audit_settings`, `audit_sections`, `audit_documents`, `audit_access_grants` | Conforme |
| IQ-GSC-018 | approvals | Existen rutas, controller y servicio | Conforme |
| IQ-GSC-019 | approvals | `approvals` esta montado bajo `/api/v1/approvals` | Conforme |
| IQ-GSC-020 | approvals | Existen `requests` y `request_approvals` | Conforme |
| IQ-GSC-021 | management | Existen rutas, controller y servicio | Conforme |
| IQ-GSC-022 | management | `management` esta montado bajo `/api/v1/management` | Conforme |
| IQ-GSC-023 | management | El codigo usa tablas reales `auditoria.logs`, `request_attachments`, `request_versions` | Conforme |
| IQ-GSC-024 | signature | Existen rutas y controller | Conforme |
| IQ-GSC-025 | signature | `signature` esta montado bajo `/api` y expone alias `/api/v1/signature` | Conforme |
| IQ-GSC-026 | signature | Endpoints autenticados de firma disponen de prefijo versionado y compatibilidad historica | Conforme |
| IQ-GSC-027 | signature | Existen tablas/vistas/funciones core del flujo de firma | Conforme parcial |

## 4. Resultado IQ
### Conformes
- `auth`
- `security` core
- `auditoria`
- `audit-prep`
- `approvals`
- `management`
- montaje y prefijos operativos de `signature`
- resolucion de credenciales Google sin dependencia a archivo versionado del repositorio

### No conformes o parciales
- no hay carpeta `backend/src/migrations`
- `security.whitelist.js` y `security.siem.js` dependen de tablas auxiliares no verificadas en el esquema vigente
- `signature` sigue dependiendo de funciones/vistas SQL especificas que deben existir en el entorno

## 5. Conclusion IQ
El area 01 queda instalada y operativa de forma mayoritariamente conforme para su flujo core. Los pendientes de IQ se concentran en artefactos auxiliares no nucleares y en la ausencia de carpeta de migraciones dentro del arbol esperado.
