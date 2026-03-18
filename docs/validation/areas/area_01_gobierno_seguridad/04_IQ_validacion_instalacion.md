# IQ - AREA 01 GOBIERNO, SEGURIDAD, CUMPLIMIENTO Y GESTION DOCUMENTAL

## 1. Introduccion
La calificacion de instalacion del Area 01 tiene como finalidad demostrar que los componentes tecnicos necesarios para el funcionamiento de los modulos de Gobierno, Seguridad, Cumplimiento y Gestion Documental se encuentran correctamente desplegados, configurados y accesibles en el entorno objetivo. Esta revision considera montaje real de rutas, middleware transversal, tablas y objetos SQL requeridos y alineacion basica entre backend, frontend e integraciones externas.

## 2. Objetivo
Verificar que el Area 01 se encuentre instalada y preparada para operar en el entorno evaluado, confirmando que los modulos `auth`, `security`, `auditoria`, `audit-prep`, `approvals`, `management`, `signature`, `documents`, `files`, `notifications`, `dashboard` y `gmail` disponen de los componentes minimos requeridos.

## 3. Casos IQ
| ID | Modulo | Verificacion | Estado actual |
|---|---|---|---|
| IQ-GD-001 | auth | Existen rutas, controller y repositorio de sesion | Conforme |
| IQ-GD-002 | security | Existen rutas y tablas core (`auditoria.logs`, `notifications`, `user_sessions`) | Conforme |
| IQ-GD-003 | auditoria | Existen rutas, controller y servicio | Conforme |
| IQ-GD-004 | audit-prep | Existen `audit_settings`, `audit_sections`, `audit_documents`, `audit_access_grants` | Conforme |
| IQ-GD-005 | approvals | Existen rutas, controller y servicio | Conforme |
| IQ-GD-006 | management | Existen rutas, controller y servicio | Conforme |
| IQ-GD-007 | documents | Existen `documents.routes.js`, controller y servicio | Conforme |
| IQ-GD-008 | files | Existen `files.routes.js`, controller, servicio y `multer` | Conforme |
| IQ-GD-009 | notifications | Existen rutas, controller y servicio | Conforme |
| IQ-GD-010 | dashboard | Existe ruta montada `/api/v1/dashboard/comercial/summary` | Conforme |
| IQ-GD-011 | gmail | Existen rutas, controller, servicio y callback publico exceptuado | Conforme |
| IQ-GD-012 | gmail | Existe tabla `user_gmail_tokens` para persistencia OAuth | Conforme |
| IQ-GD-013 | signature | Existen rutas, alias versionado y dependencias SQL core | Conforme parcial |
| IQ-GD-014 | security | Existen tablas auxiliares esperadas por `security.whitelist.js` y `security.siem.js` | No conforme parcial |

## 4. Conclusiones de IQ
El Area 01 queda instalada y operativa de forma mayoritariamente conforme para su flujo core ampliado. La incorporacion de gestion documental, archivos, notificaciones, dashboard y Gmail se encuentra respaldada por montaje real de rutas y por dependencias tecnicas verificables. Los puntos parciales se concentran en artefactos auxiliares de seguridad y dependencias SQL especializadas de firma.
