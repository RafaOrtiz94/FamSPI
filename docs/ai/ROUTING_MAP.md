# ROUTING_MAP.md

Reglas operativas para elegir agente/skill sin exploracion masiva.

## 1) Como decidir modulo principal
1. Ubica la entidad duena del dato/estado (request, purchase, business_case, etc.).
2. Si solo una entidad domina, ese es el modulo principal.
3. Si hay dos entidades de modulos distintos, activar `orchestrator-skill.md`.

## 2) Cuando usar AGENTS locales (module agents)
- `backend/src/modules/business-case/AGENTS.md`:
  cambios de estado/readiness/permisos de Business Case.
- `backend/src/modules/private-purchases/AGENTS.md`:
  flujo de compras privadas y actas.
- `backend/src/modules/servicio/AGENTS.md`:
  workflows tecnicos (uno por micro-tarea).
- `backend/src/modules/talento_humano/AGENTS.md`:
  permisos/vacaciones/colaboradores/asistencia.
- `backend/src/modules/integrations/AGENTS.md`:
  outbox, worker, Odoo client, product map.

## 3) Cuando usar skills
- `auth-skill.md`: OAuth/JWT/sesiones (no RBAC global).
- `routing-rbac-skill.md`: roles, rutas publicas/protegidas backend+frontend.
- `frontend-skill.md`: UI/API client de una sola area.
- `notifications-skill.md`: templates/destinatarios/dispatch de notificaciones.
- `signature-skill.md`: firma y verificacion publica.
- `files-documents-skill.md`: archivos, Drive y documentos plantillados.
- `approvals-skill.md`: `/pending`, approve/reject de approvals.
- `audit-security-skill.md`: audit middleware, security routes, audit-prep.
- `db-migration-skill.md`: migraciones SQL.
- `orchestrator-skill.md`: division estricta de micro-tareas multi-modulo.

## 4) Cuando NO usar un skill/agente
- No usar `frontend-skill.md` para errores backend 4xx/5xx.
- No usar `auth-skill.md` para allowedRoles (usar `routing-rbac-skill.md`).
- No usar `notifications-skill.md` para arreglar transicion de estado del modulo origen.
- No usar `signature-skill.md` para generacion base de documentos (usar `files-documents-skill.md`).
- No usar module agent si la tarea es transversal de 2+ modulos; usar orquestador.

## 5) Reglas para cambios multi-modulo
1. Orquestador obligatorio.
2. Plan por micro-tareas 1-3 archivos.
3. Ejecutar solo la primera micro-tarea.
4. Re-dividir si aumenta scope.
5. Validacion focalizada por modulo tocado.
