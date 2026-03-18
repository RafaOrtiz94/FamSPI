# PROTOCOLO DE EJECUCION IQ
## Area 01: Gobierno, Seguridad, Cumplimiento y Gestion Documental

## 1. Objetivo
Definir los pasos de ejecucion de la IQ para verificar montaje, dependencias y prerrequisitos tecnicos del Area 01 ampliada.

## 2. Casos de ejecucion
| ID | Modulo | Verificacion | Resultado esperado |
|---|---|---|---|
| IQP-GD-001 | auth | Verificar `/api/v1/auth/google` y existencia de callback | Rutas accesibles y montadas |
| IQP-GD-002 | security | Verificar `auditoria.logs`, `notifications`, `user_sessions` | Objetos visibles en DB |
| IQP-GD-003 | audit-prep | Verificar `audit_settings`, `audit_sections`, `audit_documents`, `audit_access_grants` y `GET /api/v1/audit-prep/status` | Tablas existentes y endpoint operativo |
| IQP-GD-004 | management | Verificar `/api/v1/management/stats`, `/requests`, `/trace/:id`, `/documents/:id` | Endpoints accesibles |
| IQP-GD-005 | documents | Verificar `/api/v1/documents/by-request/{id}` y `/api/v1/documents/{id}` | Rutas documentales disponibles |
| IQP-GD-006 | files | Verificar `/api/v1/files/by-request/{id}` y `/api/v1/files/{id}/download` | Capa de adjuntos montada |
| IQP-GD-007 | notifications | Verificar `GET /api/v1/notifications` | Modulo operativo |
| IQP-GD-008 | dashboard | Verificar `GET /api/v1/dashboard/comercial/summary` | Dashboard montado |
| IQP-GD-009 | gmail | Verificar `/api/v1/gmail/auth/url`, callback exceptuado y tabla `user_gmail_tokens` | OAuth Gmail inicializable |
| IQP-GD-010 | signature | Verificar tablas de firma, vista `document_verification_info` y funciones SQL requeridas | Dependencias de firma presentes |
