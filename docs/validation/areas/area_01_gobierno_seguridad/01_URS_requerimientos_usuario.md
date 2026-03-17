# URS - AREA 01 GOBIERNO, SEGURIDAD Y CUMPLIMIENTO

## 1. Introduccion
Este documento define requerimientos de usuario de alto nivel para los modulos `auth`, `security`, `auditoria`, `audit-prep`, `approvals`, `management` y `signature`, basados en la implementacion real observada en el repositorio SPI.

## 2. Proposito
Establecer lo que el usuario y el negocio requieren del area para:
- autenticar usuarios internos
- controlar sesiones
- detectar y revisar eventos de seguridad
- consultar trazabilidad y auditoria
- gestionar preparacion documental de auditoria
- aprobar solicitudes del flujo tecnico habilitado
- firmar y verificar documentos con evidencia tecnica

## 3. Alcance
Incluye:
- backend Express y middlewares transversales
- frontend React consumidor del area
- persistencia PostgreSQL
- integraciones Google OAuth, Drive, Docs y correo

Excluye:
- aprobaciones de otros dominios no implementadas en `approvals`
- automatizaciones ajenas a los endpoints y jobs existentes

## 4. Actores
- Colaborador autenticado
- Usuario nuevo pendiente de aceptacion LOPDP interna
- Equipo TI
- Jefe TI / admin TI
- Talento Humano
- Gerencia / Gerencia General
- Jefe tecnico / jefe servicio tecnico
- Firmante documental
- Revisor de seguridad
- Auditor externo temporal

## 5. Descripcion general por modulo
### `auth`
Gestiona login Google OAuth, generacion de JWT, refresh, logout, consulta de perfil, consulta de sesiones y aceptacion interna LOPDP. Durante el callback de login registra sesion y ejecuta sincronizacion de clock-in diario como efecto tecnico transversal.

### `security`
Permite a TI consultar, revisar y exportar eventos de login fuera de horario, sustentados en `auditoria.logs` y `notifications`.

### `auditoria`
Permite consultar y exportar la bitacora transversal del sistema con filtros por usuario, modulo, accion, fechas y contexto relacional.

### `audit-prep`
Gestiona la activacion de modo auditoria, las secciones auditables, la carga documental a Google Drive y los accesos temporales de auditores externos.

### `approvals`
Gestiona la cola pendiente y la decision de aprobacion/rechazo del flujo tecnico soportado por `requests` y `request_approvals`.

### `management`
Entrega metricas globales, listado gerencial de solicitudes, trazabilidad por solicitud y documentos/versiones asociados.

### `signature`
Aplica firma avanzada, calcula hash, crea sello y QR, bloquea documentos, permite verificacion publica y consulta de audit trail/document dashboard.

## 6. Funcionalidades identificadas
- Login federado con Google
- Emision y renovacion de tokens JWT
- Registro y cierre de sesiones
- Registro de aceptacion interna LOPDP
- Deteccion de logins fuera de horario
- Revision/export de eventos de seguridad
- Consulta/export de auditoria
- Configuracion de modo auditoria
- Gestion de secciones auditables
- Carga y descarga documental para auditoria
- Gestion de accesos externos temporales
- Listado de pendientes de aprobacion
- Aprobacion y rechazo de solicitudes del flujo soportado
- Consulta de metricas gerenciales
- Consulta de trazabilidad y documentos de solicitudes
- Firma avanzada y bloqueo documental
- Verificacion publica por token
- Dashboard y audit trail de firma

## 7. Requerimientos funcionales
- REQ-GSC-001: El sistema debe autenticar usuarios internos mediante Google OAuth y crear una sesion trazable.
- REQ-GSC-002: El sistema debe emitir `accessToken` y `refreshToken` para usuarios autenticados y permitir renovar la sesion activa valida.
- REQ-GSC-003: El sistema debe permitir consultar el perfil del usuario autenticado y su metadato operativo.
- REQ-GSC-004: El sistema debe registrar eventos criticos de login y eventos fuera de horario en la bitacora de auditoria.
- REQ-GSC-005: El sistema debe permitir a TI consultar, revisar y exportar eventos de login fuera de horario.
- REQ-GSC-006: El sistema debe permitir consultar y exportar registros de auditoria del sistema segun rol autorizado.
- REQ-GSC-007: El sistema debe permitir activar o desactivar una ventana de auditoria y definir sus fechas de vigencia.
- REQ-GSC-008: El sistema debe permitir administrar secciones de auditoria y restringirlas por rol.
- REQ-GSC-009: El sistema debe permitir cargar y consultar documentos de auditoria por seccion autorizada.
- REQ-GSC-010: El sistema debe limitar a dos los accesos externos activos para auditores temporales.
- REQ-GSC-011: El sistema debe permitir listar solicitudes pendientes del flujo soportado por `approvals`.
- REQ-GSC-012: El sistema debe permitir aprobar o rechazar solicitudes del flujo tecnico habilitado y persistir la decision.
- REQ-GSC-013: El sistema debe permitir a gerencia consultar metricas globales y el inventario de solicitudes.
- REQ-GSC-014: El sistema debe permitir consultar la trazabilidad y los documentos/versiones asociados a una solicitud.
- REQ-GSC-015: El sistema debe permitir firmar un documento con hash, sello institucional y QR de verificacion.
- REQ-GSC-016: El sistema debe permitir verificar publicamente un documento firmado mediante token de verificacion.
- REQ-GSC-017: El sistema debe permitir consultar el audit trail y dashboard del modulo de firma.

## 8. Requerimientos no funcionales
- RNF-GSC-001: Todo acceso autenticado debe pasar por validacion JWT y control de rol aplicable.
- RNF-GSC-002: Los eventos criticos deben dejar evidencia en `auditoria.logs` o en el log tecnico propio del modulo.
- RNF-GSC-003: La renovacion de sesion no debe operar sobre refresh tokens ya invalidados o sin sesion activa.
- RNF-GSC-004: Los documentos de auditoria deben respetar restricciones de tamano y tipo MIME.
- RNF-GSC-005: La verificacion publica de firma debe ser limitada por rate limit.
- RNF-GSC-006: El area debe mantener separacion minima entre autenticacion, seguridad, aprobacion, trazabilidad y firma.
- RNF-GSC-007: Los servicios del area deben responder con codigos HTTP coherentes y mensajes trazables.

## 9. Reglas de negocio observadas
- RN-GSC-001: Solo usuarios del dominio permitido pueden autenticarse si `ALLOWED_DOMAIN` esta definido.
- RN-GSC-002: El login fuera de horario genera accion `offhours_login` y notificacion a TI.
- RN-GSC-003: `audit-prep` solo admite dos auditores externos activos simultaneos.
- RN-GSC-004: `audit-prep` solo admite archivos PDF, DOC, DOCX, PNG y JPG hasta 15 MB.
- RN-GSC-005: `approvals` aprueba/rechaza sobre `requests` y registra decision en `request_approvals`.
- RN-GSC-006: `signature` exige `consent=true`, `document_base64`, `role_at_sign`, `authorized_role` y `session_id`.
- RN-GSC-007: El documento firmado queda bloqueado y con `signature_status = SIGNED`.

## 10. Dependencias
- Base de datos PostgreSQL: `users`, `departments`, `user_sessions`, `user_lopdp_consents`, `auditoria.logs`, `notifications`, `requests`, `request_approvals`, `request_types`, `request_attachments`, `request_versions`, `audit_*`, `documents`, `document_*`.
- Google OAuth2.
- Google Drive / Docs.
- Correo saliente.
- Middleware global de autenticacion, auditoria y contexto de request.
