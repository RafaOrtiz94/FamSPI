# AGENTS.md — FamSPI (Root Router)

## Objetivo operativo
Este archivo define enrutamiento estricto para tareas pequenas, bajo consumo y contexto minimo.
No es un catalogo: decide quien actua, en que orden y cuando detenerse.

## Evidencia base del codigo
- Entrypoints backend: `backend/src/server.js`, `backend/src/app.js`.
- Registro de modulos/rutas: `backend/src/routes/registerRoutes.js`.
- Rutas publicas JWT: `backend/src/routes/publicPaths.js`.
- RBAC real: `backend/src/middlewares/roles.js`.
- Router frontend protegido por rol: `spi_front/src/routes/AppRoutes.jsx`.
- Comandos reales: `backend/package.json`, `spi_front/package.json`.

## Router estricto de micro-tareas
1. No programar primero: identificar modulo principal y objetivo exacto.
2. Dividir en micro-tareas de 1-3 archivos (maximo 4 solo en bug bloqueante).
3. Una micro-tarea = un solo modulo principal.
4. Ejecutar solo la primera micro-tarea.
5. Re-evaluar: si crece scope, detener y re-dividir antes de continuar.
6. Prohibido refactor amplio, cambios cosmeticos o barrido global de repo.
7. Prohibido leer mas de 12 archivos por micro-tarea sin bloqueo real.
8. Verificacion minima: lint focalizado del modulo tocado (no suites completas).

## Reglas de bajo consumo
- No usar busquedas globales si ya se conoce modulo/ruta.
- No editar mas de 3 archivos por defecto.
- No tocar `app.js`/`registerRoutes.js`/`roles.js` salvo tarea explicita de plataforma.
- No ejecutar `npm test` global si no hay evidencia de regresion transversal.
- No cambiar contratos `{ ok: true|false }` ni prefijos `/api/v1/`.

## Mapa operativo (enrutamiento)
- Flujo completo multi-modulo -> `.agents/skills/orchestrator-skill.md`
- Auth/JWT/RBAC/rutas protegidas -> `.agents/skills/auth-skill.md` + `.agents/skills/routing-rbac-skill.md`
- Business Case -> `backend/src/modules/business-case/AGENTS.md`
- Compras privadas -> `backend/src/modules/private-purchases/AGENTS.md`
- Servicio tecnico -> `backend/src/modules/servicio/AGENTS.md`
- Talento humano/permisos/vacaciones -> `backend/src/modules/talento_humano/AGENTS.md`
- Integraciones Odoo/outbox -> `backend/src/modules/integrations/AGENTS.md`
- Notificaciones -> `.agents/skills/notifications-skill.md`
- Firma digital -> `.agents/skills/signature-skill.md`
- Migraciones DB -> `.agents/skills/db-migration-skill.md`
- Frontend workspace -> `.agents/skills/frontend-skill.md`
- Aprobaciones -> `.agents/skills/approvals-skill.md`
- Auditoria y seguridad operacional -> `.agents/skills/audit-security-skill.md`
- Archivos/Drive/documentos -> `.agents/skills/files-documents-skill.md`

## Stop conditions globales
- Si una micro-tarea requiere >4 archivos, detener y dividir.
- Si implica 2 o mas modulos de negocio, pasar por orquestador.
- Si requiere cambiar schema + backend + frontend, orquestador obligatorio.
