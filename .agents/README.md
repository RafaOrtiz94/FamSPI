# .agents — Índice de skills disponibles

## Skills por tipo de tarea

| Tarea | Skill |
|---|---|
| Auth, JWT, OAuth2, RBAC, roles | `skills/auth-skill.md` |
| Notificaciones, emails, cola de despacho | `skills/notifications-skill.md` |
| Firma digital, QR, hash, PDF sellado | `skills/signature-skill.md` |
| Migración de BD (SQL numerado) | `skills/db-migration-skill.md` |
| Frontend React (páginas, componentes, rutas) | `skills/frontend-skill.md` |
| Feature compleja multi-módulo | `skills/orchestrator-skill.md` |

## Módulos con AGENTS.md propios

| Módulo | Ruta |
|---|---|
| business-case | `backend/src/modules/business-case/AGENTS.md` |
| private-purchases | `backend/src/modules/private-purchases/AGENTS.md` |
| servicio (workflows técnicos) | `backend/src/modules/servicio/AGENTS.md` |
| talento_humano (dominio completo) | `backend/src/modules/talento_humano/AGENTS.md` |
| integrations (Odoo ERP) | `backend/src/modules/integrations/AGENTS.md` |

## Regla de uso

1. Leer primero `AGENTS.md` en la raíz del repo.
2. Identificar el módulo afectado → leer su AGENTS.md local.
3. Si el cambio es transversal → usar `skills/orchestrator-skill.md`.
4. Para tareas de un solo tipo → ir directamente a la skill correspondiente.
