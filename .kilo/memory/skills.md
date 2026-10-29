# Memoria de skills de FamSPI

Actualizado: 2026-09-18

## Principio de uso

Para cada requerimiento, seleccionar la skill según el dominio real, no por el nombre del archivo. Leer primero `AGENTS.md`, el `CONTEXT.md` del módulo, el código real, Neon si hay base de datos y el frontend asociado. No inventar endpoints, tablas, columnas, roles, estados, relaciones, permisos, payloads ni comportamiento.

## Inventario verificado

Se encontraron 39 definiciones físicas y 33 nombres lógicos de skills. No todas están cargadas automáticamente en Kilo: algunas pertenecen a Claude, Codex, Cline, Aider Desk o Trae y deben tratarse como referencia o cargarse según el harness.

### Skills transversales de FamSPI

| Skill | Usar cuando |
|---|---|
| `.agents/skills/orchestrator-skill.md` | Cambios complejos, 2+ módulos, DB + backend + frontend, aprobaciones, notificaciones, auditoría, documentos, firma, integraciones, estados sensibles, alcance ambiguo o impacto en contratos/RBAC/datos. |
| `.agents/skills/frontend-skill.md` | Pantallas, formularios, tablas, modales, dashboards, filtros, consumo API, validaciones, UX/UI y estados loading/error/empty/success. |
| `.agents/skills/auth-skill.md` | OAuth, JWT, sesión, login, refresh token, 401 y autenticación. |
| `.agents/skills/routing-rbac-skill.md` | Rutas protegidas, roles, `publicPaths.js`, `registerRoutes.js`, `roles.js` y `AppRoutes.jsx`. |
| `.agents/skills/approvals-skill.md` | Pendientes, aprobar, rechazar, aprobadores y estados de aprobación. |
| `.agents/skills/notifications-skill.md` | Evento, destinatarios, plantillas, cola, despacho, errores y duplicados de notificaciones. Es la fuente principal para notificaciones. |
| `.agents/skills/audit-security-skill.md` | Auditoría automática, seguridad operacional TI y `audit-prep`. |
| `.agents/skills/files-documents-skill.md` | Archivos, Google Drive, documentos, plantillas, PDF y exportaciones. |
| `.agents/skills/signature-skill.md` | Firma digital, hash, sello, token y verificación pública. |
| `.agents/skills/db-migration-skill.md` | Tablas, columnas, índices, constraints, migraciones SQL y cambios de schema. Neon es la fuente de verdad. |
| `.agents/skills/production-neon-query-skill.md` | Consultas o scripts directos en Neon, backfills y verificación de datos reales. |
| `.agents/skills/production-neon-point-delete-skill.md` | Borrado puntual en producción con identificación exacta, dependencias, transacción y verificación posterior. |
| `.agents/skills/neon-compute-quota-failover-skill.md` | Cuota de compute, contingencia o failover entre proyectos Neon. |
| `.agents/skills/bc-offer-template-repair/SKILL.md` | Discrepancias de productos, IDs, orden o secciones entre la oferta de Business Case y `TABLA BASE BC`. |
| `.agents/skills/agent-md-refactor/SKILL.md` | Refactorizar `AGENTS.md`, `CLAUDE.md` u otras instrucciones extensas con progressive disclosure. |

### Skills específicas de módulos y operación

| Skill | Dominio |
|---|---|
| `.claude/skills/modulo-business-case/SKILL.md` | Mapa general de Business Case, producción, legacy, archivos, servicios y roles. |
| `.claude/skills/bc-workspace-tabs/SKILL.md` | Orden, visibilidad y estado de tabs del workspace de Business Case. |
| `.claude/skills/modulo-clientes/SKILL.md` | Clientes aprobados, `client_requests`, asignación, sedes y alta/aprobación. |
| `.claude/skills/modulo-cronogramas/SKILL.md` | Cronogramas, planificación, aprobación y componentes legacy. |
| `.claude/skills/modulo-crm-fam/SKILL.md` | CRM-Fam, `crm` schema, Blue Sheet, pipeline y sincronización con compras. |
| `.claude/skills/modulo-solicitudes/SKILL.md` | Solicitudes comerciales generales y distinción con `delivery-requests`. |
| `.claude/skills/modulo-compras-comercial/SKILL.md` | Workspace unificado de compras públicas/privadas y rutas legacy. |
| `.claude/skills/modulo-oportunidades/SKILL.md` | FamSheets, módulo `opportunities`, rutas `/famsheets` y `/opportunities`. |
| `.claude/skills/modulo-techos-entrega/SKILL.md` | `delivery-ceilings`, `delivery-requests`, saldos, techos y servicio legacy de Business Case. |
| `.claude/skills/analisis-previo-desarrollo/SKILL.md` | Auditoría previa obligatoria antes de crear, reorganizar, unificar o limpiar funcionalidades. |
| `.claude/skills/guia-modulo/SKILL.md` | Generar guías de usuario en `docs/user-guides/` basadas en código real. |

### Skills de apoyo por harness

- `.cline/skills/spi-build-and-smoketest/SKILL.md`: después de cambios frontend, ejecutar build y smoke test con evidencia.
- `.cline/skills/ps-safe-exec/SKILL.md`: comandos PowerShell dependientes de rutas o directorios.
- `.cline/skills/notifs-end-to-end/SKILL.md`: checklist complementario para nuevos flujos de notificación. Para la lógica real, priorizar `notifications-skill.md`.
- `.cline/skills/db-check-when-needed/SKILL.md`: consultas mínimas ante síntomas concretos de datos. Para conexión real a producción, usar `production-neon-query-skill.md`.
- `.claude/skills/ui-ux-pro-max/SKILL.md` y `.codex/skills/ui-ux-pro-max/SKILL.md`: referencia genérica de UI/UX. No debe sobrescribir `DESIGN.md` ni las reglas específicas de FamSPI.
- `.kilo/skills/frontend-design/SKILL.md`: referencia genérica de frontend. Usarla solo como apoyo; para FamSPI, `frontend-skill.md` y `DESIGN.md` tienen prioridad.
- `.kilocode/skills/impeccable/`, `.claude/skills/impeccable/`, `.aider-desk/skills/impeccable/`, `.trae/skills/impeccable/` y `skills/impeccable/`: copias duplicadas de `impeccable`. La copia canónica para este proyecto es `.agents/skills/impeccable/SKILL.md`; no mezclar instrucciones de copias distintas.

## Router de selección

1. Leer el requerimiento completo y clasificarlo como simple, media, compleja o transversal.
2. Identificar el módulo principal y leer su `CONTEXT.md` y `AGENTS.md` si existe.
3. Si toca varios módulos o cruza DB, backend, frontend, aprobaciones, notificaciones, auditoría, documentos, firma o integraciones, activar `orchestrator`.
4. Si es frontend de un área, activar `frontend-skill`; si implica diseño, rediseño, crítica, polish, accesibilidad visual o sistema de diseño, activar también `impeccable` usando `PRODUCT.md` y `DESIGN.md`.
5. Si es auth, RBAC, approvals, notifications, audit, files, signature o schema, activar la skill transversal correspondiente.
6. Si es un módulo comercial conocido, activar su skill específica y leer el mapa antes de editar.
7. Antes de una funcionalidad nueva, reorganización, unificación o limpieza amplia, activar `analisis-previo-desarrollo`.
8. Después de cambios frontend, aplicar `spi-build-and-smoketest`; en PowerShell dependiente de rutas, aplicar `ps-safe-exec`.
9. Para una guía de usuario explícita, aplicar `guia-modulo`.
10. Para refactor de instrucciones de agentes, aplicar `agent-md-refactor`.

## Precedencia de fuentes

1. Requerimiento explícito del usuario.
2. `AGENTS.md` raíz y reglas de seguridad.
3. `backend/src/modules/<modulo>/CONTEXT.md` y `AGENTS.md` del módulo.
4. Código real y rutas activas.
5. Neon PostgreSQL para estructura y datos reales.
6. Frontend consumidor y contrato API real.
7. `PRODUCT.md` y `DESIGN.md` para producto y diseño.
8. Skill transversal o específica.
9. Skills genéricas de otros harnesses.

Si el contexto contradice el código, reportar `CONTEXT.md inconsistente con el código`. Si Neon contradice el contexto, reportar `Neon contradice el CONTEXT.md. Neon es la fuente de verdad para DB`.

## Reglas de seguridad y producción

- Nunca exponer secretos, passwords, tokens ni connection strings en respuestas, logs, commits o archivos nuevos.
- No usar `.claude/settings.local.json` como fuente de credenciales: contiene datos de conexión antiguos y una credencial hardcodeada. Rotarla/retirarla fuera de esta memoria.
- Para Neon, obtener la contraseña desde GCP Secret Manager y verificar el host activo antes de conectar. No usar el endpoint `-pooler` para operaciones del proyecto salvo evidencia explícita en contrario.
- No ejecutar `ALTER`, `DROP`, `DELETE`, backfills ni cambios masivos sin evidencia, alcance exacto y autorización.
- Para borrados puntuales: localizar por ID, contar matches, revisar dependencias, usar transacción, `RETURNING`, verificar después y reportar evidencia.
- Para migraciones: consultar Neon, usar migración secuencial/idempotente y validar el schema real después.
- No modificar archivos globales de rutas, RBAC, auth o middlewares sin justificación y análisis transversal.
- Mantener el prefijo `/api/v1/` y los contratos existentes, incluido `{ ok: true|false }` cuando el módulo ya lo usa.

## Diseño de producto

- `PRODUCT.md` existe, está completo y tiene `register: product`.
- `DESIGN.md` existe, versión 2.1, actualizado 2026-09-03, dirección `Precisión operativa`.
- Para `impeccable`, los gates de contexto y producto pueden considerarse satisfechos con estos archivos. Para `$impeccable craft`, `shape` requiere un brief confirmado por el usuario; no marcarlo como aprobado por inferencia.
- Priorizar navegación superior naval, composición abierta, trazabilidad real, tokens semánticos, estados claros, WCAG AA, responsive y ausencia de patrones genéricos.

## Validación mínima

- Backend: lint del backend y pruebas focalizadas del módulo cuando existan.
- Frontend: lint, build y smoke test de la ruta afectada.
- DB: consulta de verificación antes y después cuando haya datos o schema.
- Cambios multi-módulo: verificar contratos, rutas, permisos, frontend y efectos secundarios antes de cerrar.
