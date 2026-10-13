---
name: modulo-crm-fam
description: Mapa completo (backend + frontend + DB) del módulo CRM-Fam — CRM interno con metodología Blue Sheet (Miller Heiman) para el área comercial. Úsalo antes de tocar cualquier archivo bajo backend/src/modules/crm-fam/ o spi_front/src/modules/crm-fam/, o cualquier ruta/tabla con la palabra "opportunity"/"oportunidad" — el repo tiene TRES sistemas distintos con ese nombre y confundirlos es el bug más probable.
---

# Skill: Módulo CRM-Fam — FamSPI

Antes de tocar CRM-Fam, lee esto. El error más probable en esta área no es de lógica sino de **confundir sistemas homónimos**: hay tres cosas llamadas "opportunity"/"oportunidad" en este repo y viven en esquemas y tablas distintos.

---

## Los tres sistemas "opportunity" — NO son el mismo

| Sistema | Tabla | Módulo backend | Prefijo API | Frontend |
|---|---|---|---|---|
| **CRM-Fam** (este skill) | `crm.crm_opportunities` (schema `crm`) | `backend/src/modules/crm-fam/` | `/api/v1/crm-fam/opportunities` | `spi_front/src/modules/crm-fam/pages/OpportunitiesPage.jsx` + `OpportunityDetailPage.jsx` + `BlueSheetPage.jsx` |
| **Opportunities / FamSheets** | `public.opportunity` (+ `buying_influence`, `opportunity_flag`, `competitor`, `bs_action_item`, `bs_comment`...) | `backend/src/modules/opportunities/` | `/api/v1/famsheets` (alias legado `/api/v1/opportunities`) | `/dashboard/comercial/famsheets*` |
| **CRM externo (EspoCRM/Laravel CRM)** | `public.opportunity`, sincronizado por columnas `crm_deal_id`/`crm_organization_id`/`crm_contact_id` | `backend/src/modules/integrations/crmWebhook.*` | `POST /api/v1/integrations/crm/webhook` (público, sin JWT, valida `X-Hook-Secret`) | sin UI propia — dispara Calendar/Gmail/Drive |

**Por qué existen dos módulos casi gemelos** (`crm-fam` y `opportunities`/FamSheets): ambos implementan Miller Heiman Strategic Selling de forma independiente, con entidades conceptualmente equivalentes (buying influences, red flags/`opportunity_flag`, competitors, action items/`bs_action_item`). CRM-Fam es la reconstrucción moderna (schema `crm` dedicado, UUIDs, Blue Sheet versionado con snapshots, scorecard ponderado, health score compuesto); `opportunities`/FamSheets es el sistema anterior sobre tablas sueltas en `public`. **No están conectados entre sí** — un fix en uno no aplica al otro, y no se debe redirigir tráfico de uno al otro sin confirmarlo explícitamente con el dueño de producto.

El webhook de `integrations/crmWebhook.*` es aparte: reacciona a cambios de etapa en un **EspoCRM/Laravel CRM externo** (fuera de FamSPI) sobre la tabla `public.opportunity` de FamSheets, y dispara efectos secundarios de Google Workspace (recordatorio de calendario al asignar, correo a jefe_comercial en "Lead Calificado", doc de oferta en Drive en "Desarrollo de Oferta", alerta a jefe+gerencia en "Negociación", subcarpeta Contratos + correo a backoffice en "Contratos"). **No toca `crm.crm_opportunities`.**

**Regla práctica**: antes de editar cualquier ruta, tabla, servicio o componente con "opportunity"/"oportunidad" en el nombre, confirma con `grep` de qué prefijo de import/tabla se trata. Los tres tienen entidades con nombres casi idénticos (`buying_influences` vs `buying_influence`, `red_flags` vs `opportunity_flag`, `action_items` vs `bs_action_item`) — es fácil copiar una query del sistema equivocado.

---

## Puente real: CRM-Fam ↔ Business Case / Compras

Este es el único enlace real entre CRM-Fam y otro flujo comercial. Vive en `backend/src/modules/crm-fam/crmPurchaseSync.service.js` pero se **llama desde otros módulos**, no al revés:

- `business-case/businessCase.controller.js` y `business-case/businessCaseOffer.service.js` llaman `syncBusinessCaseGeneralData` (al guardar datos generales del BC), `syncBusinessCaseFeasible` (al declarar factible → mueve la oportunidad CRM a "Desarrollo de la oferta"), `syncBusinessCaseOfferSent` (al enviar oferta → mueve a "Presentación de la oferta").
- `private-purchases/privatePurchases.service.js` y `equipment-purchases/{unifiedPurchases.flow,equipmentPurchases}.service.js` llaman `syncPublicPurchaseCreated/Stage` y `syncPrivatePurchaseCreated/Stage`.
- Todas son **idempotentes**: guardan el vínculo en `modern_bc_metadata.crm_sync` / `extra.crm_sync` (JSON) y en la columna `opportunity_id` de la tabla origen; si ya existe, no crean nada nuevo — solo actualizan etapa.
- Resolución de etapa por **nombre exacto normalizado** (`crmPurchaseSync.service.js#STAGE_NAMES`, `resolveStageId`). Si no encuentra ninguna etapa activa con ese nombre, hace `logger.warn` y sigue — **falla en silencio**, no lanza excepción. Si una sincronización "no pasa nada", lo primero a revisar es si el nombre de la etapa en `crm.crm_pipeline_stages` coincide con alguna entrada de `STAGE_NAMES`.

---

## Pipeline: 6 fases reales, 12 etapas viejas desactivadas (no borradas)

`242_crm_embudo_ventas_8_fases.sql` reemplazó las 12 etapas genéricas sembradas en `232_crm_catalogs_seed.sql` por las 6 fases reales del embudo:

```
Análisis de la oportunidad → Desarrollo de la oferta → Presentación de la oferta
→ Negociación → Aceptación o rechazo → Contratos
```

Las 12 viejas quedan en la tabla con `is_active = false` (integridad referencial histórica), **no se borran**. Cualquier query de catálogo debe filtrar `is_active = true` — `listPipelineStages` en `crm.service.js` ya lo hace, pero si escribes una query nueva contra `crm_pipeline_stages`, no lo olvides.

Las 3 últimas fases (desde "Desarrollo de la oferta") tienen `requires_blue_sheet = true`.

---

## Ciclo de vida del Blue Sheet

```
draft → in_progress (automático al llenar cualquier campo, ver _updateBsFields)
      → ready_for_review (submit: exige objetivo ≥20 chars, ≥1 buying influence,
                           scorecard >0, ≥1 action item — 400 si falta algo)
      → approved (manager; bloquea si hay red flags críticas ABIERTAS o
                   strategy_summary <50 chars; snapshotea versión en
                   crm_blue_sheet_versions e incrementa version_number)
      → observed (manager, con comments → crm_review_comments)
      → needs_update (al reabrir, O automático si la oportunidad cambia
                        >20% en monto o >30 días en fecha de cierre —
                        ver updateOpportunity en crm.service.js)
```

Solo managers (`isManager(user)` en `crm.service.js`) pueden aprobar/observar/reabrir.

---

## Gotchas reales de este módulo

1. **La documentación vieja del módulo miente.** El `CONTEXT.md`/README anterior decía "Etapa 1 — esqueleto, controllers responden 501". Es falso desde hace tiempo: `crm.service.js` (2475 líneas) tiene lógica completa para las 24 tablas, está montado en producción y tiene frontend completo (`CrmShell` con 8 páginas). No asumas stubs — verifica el código antes de repetir esa afirmación en cualquier documento.

2. **Servicio adelantado a la migración, dos veces.** La migración `231_crm_schema_init.sql` (schema inicial) no coincidía con lo que `crm.service.js` esperaba desde el día 1. Se corrigió parcialmente en `233_crm_sub_tables_schema_fix.sql` (buying_influences, win_results, competitors, strengths, red_flags) y otra vez en `243_crm_activities_missing_columns.sql` (`duration_minutes`, `outcome_notes`, `outcome_rating` en `crm_activities` — sin esto, crear/completar una actividad tiraba 500). **Antes de agregar un campo nuevo a una query de `crm.service.js`, confirma que la columna existe en la migración más reciente aplicada**, no asumas que el INSERT/UPDATE ya tiene su columna.

3. **Dos columnas puente se crean en runtime, no en migración numerada.** `crmPurchaseSync.service.js#ensureLinkColumns()` (agrega `opportunity_id` a `equipment_purchase_requests`/`private_purchase_requests`) y `crm.service.js#ensureActivityFollowupSchema()` (agrega `crm_activities.visit_log_id` y `crm_documents.activity_id`) ejecutan `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` la primera vez que se necesitan, dentro del código de servicio — no busques estas columnas en `backend/migrations/`, no están ahí con número propio.

4. **`isManager(user)` vive hardcodeado en `crm.service.js`**, como set de roles separado del `managerAdmin` de `crm.routes.js` (aunque se superponen). Gobierna visibilidad de filas (cuentas `private`/`team`, oportunidades de otro owner) — no acceso a ruta. Si agregas un rol manager nuevo, actualiza **ambos** lugares o la ruta lo dejará pasar pero el servicio seguirá ocultándole datos (o viceversa).

5. **Roles de este módulo no usan `ROLE_GROUPS`** de `middlewares/roles.js` — `crm.routes.js` arma sus propios sets (`crmRoles`, `managerRoles`, `adminRoles`) localmente en el archivo. Si cambias un grupo de roles central, este módulo no se entera.

6. **Cuentas: planes y KPI de pipeline.** Una cuenta tiene VARIOS planes (`crm.crm_account_plans`: meta, periodo opcional, vendedor, estado). `crm_accounts.sales_target_amount` es solo histórico: no lo escribas. El KPI "pipeline a generar" sale de `calculateRequiredPipeline` con el win rate y el promedio del VENDEDOR del plan (todas sus oportunidades), no de la cuenta. "Vendido" = `status='won'` O abierta en la etapa *Contratos* (mover de etapa no cierra la oportunidad; `closeWon` es aparte). `mergeAccounts` también reasigna planes, destinatarios de campañas y `work_management.projects.crm_account_id`, omitiendo tablas que no existan en el entorno.

7. **Campañas de email con envío real.** Ya NO son solo borradores (migración 319). Todo envío masivo pasa por `mailer.sendBulkMail` (solo service account, sin fallback a Chat/SMTP) y por `crmCampaignDelivery.service.js`; respeta la lista `crm.crm_email_suppressions` y el tope `CRM_CAMPAIGN_DAILY_LIMIT`. Las rutas `/api/v1/crm-campaigns/*` son PÚBLICAS (token del destinatario): no les agregues datos sensibles ni redirecciones a URLs que no salgan del contenido guardado. No envíes desde pruebas locales: `DISABLE_MAIL=true` en staging.

8. **FODA de la cuenta.** Vive en `crmAccountSwot.service.js` + `crmAccountSwot.rules.js` (reglas puras, testeables sin base). Las sugerencias se recalculan siempre en el servidor y se identifican por `source_key`; aceptar o descartar deja una fila para que no reaparezca. Para estadísticas del plan reutiliza `getAccountSalesStats`. OJO: la migración 233 (`strengths.relevance_score`, `competitors.threat_level`, `updated_by`) NO está aplicada en producción — verifica columnas antes de usarlas (ver gotcha #2); `createStrength`/`updateStrength` de `crm.service.js` que las usan fallan ahí. Lo mismo pasa con compradores, resultados de ganancia, competidores, red flags, scorecard y completar acciones del Blue Sheet: en producción responden 500 hasta aplicar **233 y luego `321_crm_blue_sheet_schema_completion.sql`** (columnas que ni 233 cubría: `scorecard_answers.notes/scored_by`, `action_items.completion_notes`, `win_results.result_description` opcional). Comprueba el estado real con `information_schema` antes de asumir que ya se aplicaron.

9. **Recorrido de la oportunidad.** `crmOpportunityJourney.service.js` + `.rules.js` (reglas puras con tests) arman los hitos cliente → disponibilidad → factibilidad → oferta → contrato → entrega → consumibles leyendo los expedientes enlazados; endpoints `GET /opportunities/journeys?ids=` (lote, para el tablero) y `GET /opportunities/:id/journey`. Lee las filas con `to_jsonb(...)` a propósito: no listes columnas de `private_purchase_requests`/`equipment_purchase_requests` ahí. El Business Case guarda su oportunidad en `modern_bc_metadata.crm_sync` (y, desde este cambio, también en `opportunity_id`). `upsertOpportunityStage` solo avanza de fase, no toca oportunidades cerradas y aplica el cierre (`won`/`lost`) aunque la fase "Cerrado…" ya no exista. La compra privada además sincroniza desde `transitionState` (mejora de precio → Negociación, pendiente firma del cliente → Aceptación o rechazo, rechazada → perdida).

10. **`account.visibility`** (`company`/`team`/`private`) determina si otros comerciales ven la cuenta. Un lead sin cuenta vinculada (`converted_account_id` null) es visible solo para su owner/creador salvo manager — ver `canAccessLead`.

---

## Mapa de archivos

### Backend (`backend/src/modules/crm-fam/`)
- `crm.routes.js` — Express router, monta en `/api/v1/crm-fam` (via `registerRoutes.js`, línea `crmFamRoutes`). Define `crmRoles`/`managerRoles`/`adminRoles` localmente.
- `crm.controller.js` — thin, patrón `respond(res, promesa)` uniforme.
- `crm.service.js` (2475 líneas) — toda la lógica: accounts, contacts, leads, opportunities, blue sheets + 8 sub-entidades, scorecard, activities, documents, notes, dashboard/reportes, notificaciones internas, audit log.
- `crm.calculators.js` — funciones puras sin DB: `calculateCompletenessScore`, `calculateScorecardScore`, `calculateHealthScore` (40% scorecard + 30% completeness + 20% action items + 10% red flags), `getHealthStatus` (green≥75/yellow≥50/red/gray sin BS), `getWeightedAmount`.
- `crmPurchaseSync.service.js` — puente hacia business-case/compras (ver sección arriba). Consumido por otros módulos, no expone rutas propias.
- `__tests__/crm.calculators.test.js` — únicos tests del módulo; solo cubren las calculadoras puras. Sin tests de integración para `crm.service.js` ni `crmPurchaseSync.service.js`.

### Backend — sistemas relacionados pero NO parte de este módulo
- `backend/src/modules/opportunities/` — FamSheets, sistema paralelo (ver tabla arriba).
- `backend/src/modules/integrations/crmWebhook.*` — webhook del CRM externo (ver tabla arriba).

### Frontend (`spi_front/src/modules/crm-fam/`)
- `pages/CrmShell.jsx` — layout con tabs (Dashboard, Cuentas, Contactos, Leads, "Embudo de ventas", Actividades, Reportes, + Configuración solo `jefe_ti`/`jefe_de_ti`/`admin`/`administrador`). Montado como `<Route element={<CrmShell/>}>` wrapper en `AppRoutes.jsx`.
- `pages/CrmDashboardPage.jsx` ("Mi día"), `AccountsPage.jsx`, `AccountDetailPage.jsx` (Cuenta 360, pestañas en `pages/account/`), `ContactsPage.jsx`, `LeadsPage.jsx`, `OpportunitiesPage.jsx` (tablero/tabla/pronóstico), `OpportunityDetailPage.jsx`, `BlueSheetPage.jsx` (11 pasos guiados con autoguardado, pasos en `pages/bluesheet/`), `CrmActivitiesPage.jsx`, `CrmReportsPage.jsx`, `CrmCampaignsPage.jsx`, `CrmSettingsPage.jsx` (catálogos — solo admin).
- `ui/` — kit propio del módulo sobre los tokens de `DESIGN.md` (colores Tailwind `fam-*` → variables CSS, definidos en `spi_front/tailwind.config.js`): `kit.jsx` (Btn, Badge, PageHeader, Panel, Tabs, Field, DataTable, Inspector, Menu…), `listParts.jsx` (paginación, selección y acciones masivas), `dialogs.jsx` (`ConfirmDialog`/`ReasonDialog` sobre el `<Modal>` del sistema), `useUrlState.js` (filtros y vista en la URL), `useLoad.js` (carga con descarte de respuestas viejas), `CommandPalette.jsx` (Ctrl+K), `format.js`, `status.js`, `roles.js`. **Úsalo**: no escribas colores hex, overlays `fixed inset-0` ni `window.confirm/prompt/alert` en este módulo. Los hooks `hooks/useCrm*` ya no existen.
- `spi_front/src/core/api/crmFamApi.js` — cliente API único del módulo; cada función mapea 1:1 a un endpoint `/crm-fam/*`.

### Rutas y permisos
- `spi_front/src/routes/AppRoutes.jsx` — bloque `/dashboard/crm-fam/*` bajo `<ProtectedRoute allowedRoles={[...]}>` con: comercial, jefe_comercial, backoffice_comercial, asesor_comercial, analista_comercial, acp_comercial, backoffice, gerencia, gerencia_general, gerente_general, director, gerente, jefe_ti, jefe_de_ti.
- `spi_front/src/core/ui/components/NavigationBar.jsx` — entrada "CRM-FAM" (ícono `FiTarget`) → `/dashboard/crm-fam`.

### Base de datos
Schema dedicado `crm` (no `public`), 24 tablas, PK `uuid gen_random_uuid()`, FK a usuarios `integer references public.users(id)`. Migraciones: `231_crm_schema_init.sql`, `232_crm_catalogs_seed.sql`, `233_crm_sub_tables_schema_fix.sql`, `239_scheduled_visits_crm_activity_id.sql`, `240_crm_leads_city_and_scheduled_visits_lead_id.sql`, `242_crm_embudo_ventas_8_fases.sql`, `243_crm_activities_missing_columns.sql`, `301_crm_accounts_classification_sales_target.sql` (clasificación oro/plata/bronce/normal), `313_crm_email_campaigns.sql`, `318_crm_account_plans.sql` (planes de cuenta), `319_crm_campaign_delivery.sql` (envío, bajas y métricas de campañas), `320_crm_account_swot.sql` (FODA de la cuenta), `321_crm_blue_sheet_schema_completion.sql` (completa el esquema del Blue Sheet; requiere 233).

Tablas: `crm_pipeline_stages`, `crm_accounts`, `crm_contacts`, `crm_leads`, `crm_opportunities`, `crm_opportunity_products`, `crm_blue_sheets`, `crm_blue_sheet_versions`, `crm_buying_influences`, `crm_win_results`, `crm_competitors`, `crm_competitive_preferences`, `crm_strengths`, `crm_red_flags`, `crm_scorecard_criteria`, `crm_scorecard_answers`, `crm_action_items`, `crm_activities`, `crm_documents`, `crm_notes`, `crm_review_comments`, `crm_lost_reasons`, `crm_audit_log`, `crm_integration_outbox`.

---

## Checklist antes de tocar CRM-Fam

1. ¿El cambio menciona "opportunity"/"oportunidad"? → confirma con `grep` de qué de los 3 sistemas se trata (tabla, prefijo de import) ANTES de escribir código.
2. ¿Agregas un campo a una query en `crm.service.js`? → verifica que la columna exista en la migración más reciente (histórico: 2 incidentes reales por esto).
3. ¿Tocas nombres de etapas en `crm.crm_pipeline_stages`? → actualiza también `STAGE_NAMES` en `crmPurchaseSync.service.js`, o la sincronización con BC/compras fallará en silencio.
4. ¿Agregas un rol manager nuevo? → actualízalo en `crm.routes.js` (`managerRoles`) Y en `crm.service.js` (`MANAGER_ROLES`) — son dos listas separadas.
5. Después de editar frontend: `npx eslint <archivo>`, deploy con `spi_front/clean_deploy.ps1`. Después de backend: `node -e "require('./ruta')"`, `npx eslint <archivo>`, deploy con `scripts/deploy_backend_cloudrun.ps1`.
