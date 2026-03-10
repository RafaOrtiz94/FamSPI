# INFORME DE DEFECTOS TECNICOS

## 1. Criterio
- Alcance: modulos `auth`, `security`, `auditoria`, `audit-prep`, `approvals`, `management`, `signature`.
- Criterio de severidad:
  - Critico: riesgo directo de acceso indebido, perdida de integridad o inutilizacion de una capacidad critica.
  - Alto: capacidad relevante rota o datos de control incorrectos.
  - Medio: inconsistencia funcional importante con mitigacion parcial.
  - Bajo: deuda tecnica o problema de mantenibilidad sin impacto operativo inmediato.

## 2. Hallazgos

### DEF-001
- Severidad: Critico
- Problema: bypass de control de rol en `middlewares/auth.js::requireRole`.
- Causa raiz: la jerarquia esta codificada como `['gerencia', 'ti', 'admin', 'usuario']` y compara indices. Los roles no presentes quedan con `roleIndex = -1`, pudiendo cumplir la condicion de acceso.
- Ubicacion en codigo: `backend/src/middlewares/auth.js:75-97`.
- Impacto: rutas protegidas por este middleware pueden ser accedidas por roles no contemplados, incluyendo `auth/sessions`, `auth/active-users`, endpoints administrativos de `audit-prep` y cualquier activacion futura de `security`.
- Propuesta de correccion: eliminar la logica jerarquica por indices y reemplazarla por validacion exacta/expandida con deny-by-default. Reusar `middlewares/roles.js` o unificar ambas implementaciones.

### DEF-002
- Severidad: Critico
- Problema: refresh tokens pueden seguir siendo validos despues de logout o sin una sesion activa correlacionada.
- Causa raiz: `refreshToken` verifica solo la firma JWT y luego intenta `updateSessionRefreshToken`; si no actualiza ninguna fila, crea una nueva sesion.
- Ubicacion en codigo: `backend/src/modules/auth/auth.controller.js:496-546`, `backend/src/modules/auth/session.repository.js:31-48`, `backend/src/modules/auth/session.repository.js:71-79`.
- Impacto: revocacion de sesion incompleta, riesgo de reuso de refresh token comprometido y proliferacion de sesiones fantasmas.
- Propuesta de correccion: exigir que el refresh token exista en una sesion activa sin `logout_time`, rotarlo atomica y exclusivamente, y rechazar cualquier refresh no asociado a sesion vigente.

### DEF-003
- Severidad: Critico
- Problema: el flujo de firma documental no coincide con el esquema real de base de datos.
- Causa raiz: la insercion en `document_signatures_advanced` usa columna `consent_text` no presente en `actualsindatos.sql` y no envia `signer_email`, que si es `NOT NULL`.
- Ubicacion en codigo: `backend/src/modules/signature/signature.controller.js:99-112`, `backend/src/actualsindatos.sql:4418-4425`.
- Impacto: el endpoint de firma falla al intentar persistir la firma, bloqueando una capacidad considerada critica por la documentacion.
- Propuesta de correccion: reconciliar el contrato SQL con el esquema real. Incluir `signer_email` desde `req.user.email` y eliminar o mapear `consent_text` a una columna existente.

### DEF-004
- Severidad: Critico
- Problema: desacople total entre rutas frontend y backend del modulo `signature`.
- Causa raiz: el backend monta `signatureRoutes` en `/api` mientras el cliente React llama `/api/signature/*`.
- Ubicacion en codigo: `backend/src/app.js:263`, `backend/src/modules/signature/signature.routes.js`, `spi_front/src/core/api/signatureApi.js`.
- Impacto: las llamadas de UI a firma, verificacion, dashboard y audit trail no alcanzan los endpoints reales; el usuario recibe 404 o falla equivalente.
- Propuesta de correccion: definir un unico prefijo estable. O se monta backend en `/api/signature`, o se corrigen todos los clientes frontend a `/api/*` segun el contrato real.

### DEF-005
- Severidad: Alto
- Problema: el modulo `security` no esta expuesto en runtime.
- Causa raiz: existe codigo de rutas/controladores, pero `backend/src/app.js` no hace `app.use()` para el modulo.
- Ubicacion en codigo: ausencia de montaje en `backend/src/app.js`; archivos afectados `backend/src/modules/security/*`.
- Impacto: toda funcionalidad de revision/exportacion de logins fuera de horario queda inoperante.
- Propuesta de correccion: montar el modulo con prefijo explicito y agregar prueba de smoke que verifique que las rutas respondan distinto de 404.

### DEF-006
- Severidad: Alto
- Problema: `security.routes.js` referencia un handler inexistente.
- Causa raiz: se importa `emitOffHoursTest` desde `security.controller.js`, pero ese export no existe.
- Ubicacion en codigo: `backend/src/modules/security/security.routes.js:4-9`, `backend/src/modules/security/security.routes.js:33`; contraste con `backend/src/modules/security/security.controller.js`.
- Impacto: si se activa el endpoint dev y el modulo es montado, Express recibe un handler indefinido y la ruta queda rota al cargar o al ejecutarse.
- Propuesta de correccion: implementar y exportar `emitOffHoursTest` o eliminar la ruta dev.

### DEF-007
- Severidad: Alto
- Problema: `management` usa objetos de base de datos que no existen en el esquema verificable.
- Causa raiz: se consultan `audit_logs` y `attachments`, mientras el esquema real contiene `auditoria.logs` y `request_attachments`.
- Ubicacion en codigo: `backend/src/modules/management/management.service.js:60-68`, `backend/src/actualsindatos.sql:878`, `backend/src/actualsindatos.sql:6177`.
- Impacto: `GET /api/v1/management/trace/:id` y `GET /api/v1/management/documents/:id` fallan con error SQL.
- Propuesta de correccion: reescribir consultas contra las tablas reales y agregar pruebas de integracion con esquema actual.

### DEF-008
- Severidad: Alto
- Problema: `audit-prep` consulta una columna inexistente del usuario.
- Causa raiz: el listado de documentos usa `u.nombre_completo`; el esquema real de `users` contiene `fullname` y `name`.
- Ubicacion en codigo: `backend/src/modules/audit-prep/auditPrep.service.js:226`, `backend/src/actualsindatos.sql:6971-6980`.
- Impacto: `GET /api/v1/audit-prep/documents` puede fallar con error SQL y bloquear la preparacion de evidencia.
- Propuesta de correccion: sustituir por `u.fullname` o `COALESCE(u.fullname, u.name)` segun el modelo real.

### DEF-009
- Severidad: Alto
- Problema: el audit log generado desde `approvals` pierde semantica y trazabilidad.
- Causa raiz: `audit.logAction` recibe claves `user_id`, `module`, `action` en lugar del contrato usado por `utils/audit.js` (`usuario_id`, `modulo`, `accion`, etc.).
- Ubicacion en codigo: `backend/src/modules/approvals/approvals.service.js` (bloques de aprobacion/rechazo), `backend/src/utils/audit.js`.
- Impacto: se registran eventos con valores por defecto o incompletos, afectando evidencia de auditoria de decisiones criticas.
- Propuesta de correccion: normalizar el payload a la API real de `utils/audit.js` y agregar validacion defensiva en el helper de auditoria.

### DEF-010
- Severidad: Alto
- Problema: el componente de firma en frontend no recibe `documentId` desde la ruta.
- Causa raiz: `AppRoutes` monta `<DocumentSigner />` en `/dashboard/signatures/:documentId/sign`, pero el componente espera `documentId` por props y no usa `useParams()`.
- Ubicacion en codigo: `spi_front/src/routes/AppRoutes.jsx`, `spi_front/src/modules/signature/components/DocumentSigner.jsx`.
- Impacto: aun corrigiendo el prefijo API, el componente puede invocar firma con `documentId` indefinido.
- Propuesta de correccion: leer `documentId` con `useParams()` o envolver el componente con un contenedor que inyecte la prop.

### DEF-011
- Severidad: Medio
- Problema: `security.controller` mezcla `creado_en` y `created_en` en las consultas de timeline.
- Causa raiz: la consulta inicia con `creado_en` pero luego filtra y ordena por `created_en`.
- Ubicacion en codigo: `backend/src/modules/security/security.controller.js:175-200`, `backend/src/actualsindatos.sql:896`.
- Impacto: el timeline falla con error SQL si la ruta llega a ejecutarse.
- Propuesta de correccion: usar consistentemente `creado_en` y cubrir el endpoint con una prueba SQL real.

### DEF-012
- Severidad: Medio
- Problema: el dashboard gerencial cuenta estados no alineados con el catalogo real.
- Causa raiz: la logica espera estados como `approved` y `rejected`; el schema `requests.status` usa valores en espanol como `aprobado` y `rechazado`.
- Ubicacion en codigo: `backend/src/modules/management/management.service.js` (consulta de metricas), `backend/src/actualsindatos.sql:6361`.
- Impacto: las metricas entregadas por `GET /api/v1/management/stats` son incorrectas o siempre cero en ciertos contadores.
- Propuesta de correccion: alinear los estados al check constraint real y centralizar las constantes de workflow.

### DEF-013
- Severidad: Medio
- Problema: `approvals.listPending` acepta parametro `role` pero no lo usa para filtrar pendientes.
- Causa raiz: el SQL lista solicitudes pendientes sin segmentacion por paso, rol o tipo de aprobador.
- Ubicacion en codigo: `backend/src/modules/approvals/approvals.service.js`.
- Impacto: usuarios de distintos roles autorizados pueden ver la misma cola de pendientes aunque no les corresponda.
- Propuesta de correccion: filtrar por criterio de workflow efectivo y documentar el modelo de asignacion de pendientes.

### DEF-014
- Severidad: Medio
- Problema: `signature.getDocumentAuditTrail` aplica validacion administrativa incorrecta.
- Causa raiz: verifica `req.user.roles?.includes('admin')`, pero los tokens de `auth` exponen `role` simple, no necesariamente `roles` array.
- Ubicacion en codigo: `backend/src/modules/signature/signature.controller.js:354`.
- Impacto: administradores legitimos pueden recibir `403` al consultar el audit trail documental.
- Propuesta de correccion: usar el mismo normalizador de roles del resto del sistema y admitir `req.user.role`.

### DEF-015
- Severidad: Medio
- Problema: `auth/me` tiene efecto de escritura transversal sobre asistencia.
- Causa raiz: el endpoint de perfil inserta en `user_attendance_records` cuando no existe marcacion diaria.
- Ubicacion en codigo: `backend/src/modules/auth/auth.controller.js:444-451`, `backend/src/actualsindatos.sql:6636`.
- Impacto: una consulta de identidad modifica estado de negocio de otro dominio, complica auditoria y hace dificil validar el modulo por separado.
- Propuesta de correccion: mover el auto clock-in a un endpoint explicito de asistencia o documentarlo como comportamiento intencional y auditable.

### DEF-016
- Severidad: Bajo
- Problema: ausencia de frontend consumidor verificable para `management` y `security`.
- Causa raiz: no se localizaron clientes API ni rutas React que consuman esos prefijos en `spi_front/src`.
- Ubicacion en codigo: busquedas sobre `spi_front/src`.
- Impacto: el codigo backend puede quedar sin validacion funcional desde UI y degradarse sin deteccion temprana.
- Propuesta de correccion: documentar estos modulos como backend-only o crear clientes UI y pruebas end-to-end que los cubran.

## 3. Resumen ejecutivo
- Defectos criticos detectados: 4.
- Defectos altos detectados: 6.
- Defectos medios detectados: 5.
- Defectos bajos detectados: 1.
- Riesgos mas severos del area: autorizacion bypassable, refresh token revocable de forma incompleta, firma documental no operativa y trazabilidad rota en `management`/`security`.

## 4. Prioridad de correccion recomendada
1. Corregir RBAC y revocacion de sesiones (`DEF-001`, `DEF-002`).
2. Reconciliar `signature` entre rutas, payload y esquema (`DEF-003`, `DEF-004`, `DEF-010`, `DEF-014`).
3. Restablecer operatividad real de `security` y `management` (`DEF-005`, `DEF-006`, `DEF-007`, `DEF-011`, `DEF-012`).
4. Ajustar consistencia funcional de `audit-prep`, `approvals` y side effects de `auth` (`DEF-008`, `DEF-009`, `DEF-013`, `DEF-015`).
