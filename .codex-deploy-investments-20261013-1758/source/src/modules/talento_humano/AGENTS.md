# AGENTS.md — module agent: talento_humano

## Proposito
Cambios de talento humano en permisos, vacaciones, colaboradores y asistencia.

## Alcance exacto
- `talento_humano/hr.routes.js`
- `permisos/permisos.service.js`
- `permisos/permisos.validation.js`
- `vacaciones/*.js`
- `collaborators/*.js`
- `attendance/*.js`

## Activar cuando
- Ajuste de flujo de permisos/vacaciones.
- Ajuste de aprobacion en talento humano o asistencia.

## No usar cuando
- Cambio principal es auth global/RBAC.
- Cambio principal es firma generica de documentos.

## Roles involucrados

`talento_humano`, `jefe_talento_humano`, `finanzas`, `jefe_finanzas`,
`gerencia`, `admin` — cada rol aprueba en una etapa distinta del flujo.

Verificar en `permisos/permisos.validation.js` las reglas de quién puede aprobar qué.

## Limites de scope
- Maximo 3 archivos por tarea.
- En `permisos.service.js`, editar solo funcion localizada.
- No mezclar permisos y vacaciones en la misma micro-tarea.

## Verificacion minima

```bash
cd backend && npm run lint src/modules/permisos/
```

## Stop condition
- Si un cambio afecta 2+ etapas de aprobacion de permisos, detener y dividir.

## Handoff
- Firma -> `.agents/skills/signature-skill.md`
- Notificaciones -> `.agents/skills/notifications-skill.md`
- Migracion -> `.agents/skills/db-migration-skill.md`
