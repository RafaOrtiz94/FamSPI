# CONTEXT.md — crm-fam

## 1. Descripción
CRM interno de FamSPI para el área comercial, con metodología **Blue Sheet (Miller Heiman Strategic Selling)**. Cubre todo el ciclo: Leads → Cuentas/Contactos → Oportunidades (embudo de 6 fases) → Blue Sheet (calificación estratégica de la venta: objetivos, influencias de compra, competidores, fortalezas, red flags, scorecard, action items) → cierre ganado/perdido. Incluye dashboard, forecast, reportes y auditoría propia.

**Estado real (no confundir con el README viejo del módulo):** el módulo NO está en "Etapa 1 — esqueleto / 501 Not Implemented". `crm.service.js` (2237 líneas) tiene lógica de negocio completa para las 24 tablas del esquema `crm`: CRUD con visibilidad por rol, conversión de leads, ciclo de vida de Blue Sheet (draft → in_progress → ready_for_review → approved/observed → needs_update), cálculo de completitud/scorecard/health score, notificaciones internas y auditoría. Está en **producción** con rutas montadas y frontend completo.

Controller: `crm.controller.js` (thin, patrón `respond()` uniforme). Service: `crm.service.js`. Calculadoras puras: `crm.calculators.js`. Sincronización cruzada con Business Case / compras: `crmPurchaseSync.service.js`.

## 2. Distinción crítica: "CRM-Fam opportunities" vs otros "opportunity" del repo

Este repo tiene **tres conceptos distintos de "oportunidad"**. No son alias entre sí, viven en esquemas/tablas diferentes y tienen ciclos de vida propios:

| Sistema | Tabla | Módulo | Rutas | Frontend |
|---|---|---|---|---|
| **CRM-Fam** (este módulo) | `crm.crm_opportunities` (schema `crm`) | `backend/src/modules/crm-fam/` | `/api/v1/crm-fam/opportunities` | `spi_front/src/modules/crm-fam/pages/OpportunitiesPage.jsx`, `OpportunityDetailPage.jsx`, `BlueSheetPage.jsx` |
| **Opportunities / FamSheets** | `public.opportunity` (+ `opportunity_rating`, `buying_influence`, `opportunity_flag`, `competitor`, `bs_action_item`, `bs_comment`, `opportunity_snapshot`, `opportunity_process_link`) | `backend/src/modules/opportunities/` | `/api/v1/famsheets` (alias legado `/api/v1/opportunities`) | `/dashboard/comercial/famsheets*` |
| **CRM externo (EspoCRM / Laravel CRM)** | `public.opportunity` sincronizado vía `crm_deal_id`/`crm_organization_id`/`crm_contact_id` (migración `201_crm_sync_tracking.sql`) | `backend/src/modules/integrations/crmWebhook.*` | `POST /api/v1/integrations/crm/webhook` (público, valida `X-Hook-Secret`) | — (dispara acciones Google Workspace: Calendar/Gmail/Drive, no tiene UI propia) |

**Por qué existen dos módulos casi gemelos (`crm-fam` y `opportunities`/FamSheets):** ambos implementan Miller Heiman Strategic Selling de forma independiente — mismas entidades conceptuales (buying influences, red flags/opportunity_flag, competitors, action items/bs_action_item, comments), pero **CRM-Fam es la reconstrucción moderna** (schema `crm` dedicado, UUIDs, Blue Sheet versionado con snapshots, scorecard ponderado, health score compuesto) mientras **`opportunities`/FamSheets es el sistema anterior** sobre tablas sueltas en `public`. Verificar con el dueño de producto cuál es el flujo vigente antes de tocar cualquiera de los dos — **no** se debe redirigir tráfico de uno al otro sin confirmarlo explícitamente, y un fix aplicado en uno no aplica automáticamente al otro.

El webhook de `integrations/crmWebhook.*` es un tercer sistema: reacciona a cambios de etapa en un **EspoCRM/Laravel CRM externo** (fuera de FamSPI) sobre la tabla `public.opportunity` de FamSheets, y dispara efectos secundarios de Google Workspace (recordatorio de calendario, correos a jefe_comercial/gerencia/backoffice, carpetas de Drive para oferta y contratos). **No toca `crm.crm_opportunities`.**

### Puente real entre CRM-Fam y Business Case / Compras

`crmPurchaseSync.service.js` (dentro de `crm-fam`, pero llamado desde otros módulos) sí conecta CRM-Fam con el flujo comercial de compras/Business Case:
- Llamado desde `business-case/businessCase.controller.js`, `business-case/businessCaseOffer.service.js`, `private-purchases/privatePurchases.service.js`, `equipment-purchases/{unifiedPurchases.flow,equipmentPurchases}.service.js`.
- `syncBusinessCaseGeneralData` / `syncBusinessCaseFeasible` / `syncBusinessCaseOfferSent` crean o reutilizan (idempotente, vía `modern_bc_metadata.crm_sync` / `extra.crm_sync`) un lead + `crm.crm_opportunities` cuando se guardan datos generales de un BC, cuando se declara factible (mueve a etapa "Desarrollo de la oferta") y cuando se envía la oferta (mueve a "Presentación de la oferta").
- `syncPublicPurchaseCreated/Stage` y `syncPrivatePurchaseCreated/Stage` hacen lo mismo para compras públicas/privadas, agregando columna `opportunity_id` a `equipment_purchase_requests` y `private_purchase_requests`.
- El link es persistente: una vez creado `opportunity_id`, las funciones son no-op (`ensurePublicOpportunity`/`ensurePrivateOpportunity` retornan el existente).

## 3. Roles

Definidos en `crm.routes.js` (no en `middlewares/roles.js` — este módulo arma sus propios sets, no usa `ROLE_GROUPS`):

```js
crmRoles     = [comercial, jefe_comercial, backoffice_comercial,
                asesor_comercial, analista_comercial, acp_comercial, backoffice]
managerRoles = [jefe_comercial, gerencia, gerencia_general,
                gerente_general, director, gerente]
adminRoles   = [jefe_ti, jefe_de_ti, admin, administrador]

crmAll       = crmRoles ∪ managerRoles          // creación/edición de entidades base
allCrm       = crmAll ∪ adminRoles              // lectura general
managerAdmin = managerRoles ∪ adminRoles         // aprobar/observar/reabrir BS, reportes, forecast
```

`admin`/`administrador` bypasean todo vía `requireRole`. `crm.service.js` define además su propio `MANAGER_ROLES` set (con los mismos roles + `jefe_ti`/`jefe_de_ti`) para la función `isManager(user)` que gobierna **visibilidad de datos** (no solo acceso a ruta) — cuentas `private`/`team` solo visibles para su owner salvo que `isManager`.

Frontend: `AppRoutes.jsx` protege todo `/dashboard/crm-fam/*` con `allowedRoles` = comercial, jefe_comercial, backoffice_comercial, asesor_comercial, analista_comercial, acp_comercial, backoffice, gerencia, gerencia_general, gerente_general, director, gerente, jefe_ti, jefe_de_ti. El tab "Configuración" en `CrmShell.jsx` solo aparece para `jefe_ti`, `jefe_de_ti`, `admin`, `administrador`.

## 4. Endpoints

Prefijo: `/api/v1/crm-fam`

### Dashboard / Reportes
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/dashboard` | `getDashboardSummary` | allCrm |
| GET | `/dashboard/pipeline` | `getPipelineByStage` | allCrm |
| GET | `/dashboard/forecast` | `getForecast` | managerAdmin |
| GET | `/dashboard/blue-sheet-kpis` | `getBlueSheetKpis` | managerAdmin |
| GET | `/reports/lost-reasons` | `getLostReasonsReport` | managerAdmin |
| GET | `/reports/red-flags` | `getRedFlagsReport` | managerAdmin |

### Catálogos
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/pipeline-stages` | `listPipelineStages` | allCrm |
| POST/PUT | `/pipeline-stages[/:id]` | create/update | adminRoles |
| GET | `/lost-reasons` | `listLostReasons` | allCrm |
| POST/PUT | `/lost-reasons[/:id]` | create/update | adminRoles |
| GET | `/scorecard-criteria` | `listScorecardCriteria` | allCrm |
| POST/PUT | `/scorecard-criteria[/:id]` | create/update | adminRoles |

### Accounts
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/accounts` | `listAccounts` | allCrm (filtrado por visibilidad si no es manager) |
| POST | `/accounts` | `createAccount` | crmAll |
| GET | `/accounts/:id` | `getAccountById` | allCrm (403 si `private`/`team` y no es owner/manager) |
| PUT | `/accounts/:id` | `updateAccount` | crmAll (solo manager puede cambiar `owner_user_id`) |
| DELETE | `/accounts/:id` | `softDeleteAccount` | crmAll (owner o manager) |
| GET | `/accounts/:id/timeline` | `getAccountTimeline` | allCrm |

### Contacts
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET/POST | `/contacts` | list/create | allCrm / crmAll |
| GET/PUT/DELETE | `/contacts/:id` | get/update/soft-delete | allCrm / crmAll |

### Leads
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET/POST | `/leads` | list/create | allCrm / crmAll |
| GET/PUT/DELETE | `/leads/:id` | get/update/soft-delete | allCrm / crmAll |
| POST | `/leads/:id/account` | `linkLeadAccount` | crmAll |
| POST | `/leads/:id/contact` | `createLeadContact` | crmAll |
| POST | `/leads/:id/convert` | `convertLead` | crmAll |
| POST | `/leads/:id/disqualify` | `disqualifyLead` | crmAll |
| POST | `/leads/:id/promote` | `promoteLeadToOpportunity` | crmAll |

### Opportunities
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET/POST | `/opportunities` | list/create | allCrm / crmAll |
| GET/PUT | `/opportunities/:id` | get/update | allCrm / crmAll |
| GET | `/opportunities/:id/health` | `getOpportunityHealth` | allCrm |
| GET | `/opportunities/:id/purchase-status` | `getOpportunityPurchaseStatus` | allCrm |
| POST | `/opportunities/:id/link-purchase` | `linkPurchaseToOpportunity` | crmAll |
| POST | `/opportunities/:id/stage` | `changeOpportunityStage` | crmAll |
| POST | `/opportunities/:id/close-won` | `closeWon` | crmAll |
| POST | `/opportunities/:id/close-lost` | `closeLost` | crmAll |
| POST | `/opportunities/:id/suspend` | `suspendOpportunity` | crmAll |

### Blue Sheets (bajo `/opportunities/:opportunityId` y `/blue-sheets/:id`)
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET/POST | `/opportunities/:opportunityId/blue-sheet` | get/create | allCrm / crmAll |
| PUT | `/blue-sheets/:id/general` | `updateBlueSheetGeneral` | crmAll |
| PUT | `/blue-sheets/:id/buying-process` | `updateBlueSheetBuyingProcess` | crmAll |
| PUT | `/blue-sheets/:id/strategy` | `updateBlueSheetStrategy` | crmAll |
| POST | `/blue-sheets/:id/submit` | `submitBlueSheetForReview` | crmAll |
| POST | `/blue-sheets/:id/approve` | `approveBlueSheet` | managerAdmin |
| POST | `/blue-sheets/:id/observe` | `observeBlueSheet` | managerAdmin |
| POST | `/blue-sheets/:id/reopen` | `reopenBlueSheet` | managerAdmin |
| GET | `/blue-sheets/:id/versions` | `getBlueSheetVersions` | allCrm |
| GET | `/blue-sheets/:id/completeness` | `getBlueSheetCompleteness` | allCrm |

### Sub-entidades del Blue Sheet (todas bajo `/blue-sheets/:blueSheetId/...`)
Buying Influences, Win-Results (bajo `/buying-influences/:buyingInfluenceId/win-results`), Competitors, Competitive Preferences, Strengths, Red Flags (+ `POST /red-flags/:id/accept` → managerAdmin), Scorecard (`GET/PUT /blue-sheets/:blueSheetId/scorecard`), Action Items (+ `POST /action-items/:id/complete`). Lectura: allCrm. Escritura: crmAll.

### Activities / Documents / Notes (transversales, no atadas solo a un Blue Sheet)
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET/POST | `/activities` | list/create | allCrm / crmAll |
| PUT | `/activities/:id` | update | crmAll |
| POST | `/activities/:id/complete` | `completeActivity` | crmAll |
| DELETE | `/activities/:id` | soft-delete | crmAll |
| GET/POST | `/documents` | list/create | allCrm / crmAll |
| POST | `/documents/upload` | `uploadDocumentFile` (multer, 15MB, memoria) | crmAll |
| DELETE | `/documents/:id` | soft-delete | crmAll |
| GET/POST/PUT/DELETE | `/notes[/:id]` | CRUD notas | allCrm / crmAll |

## 5. Flujo principal

1. **Lead** entra (manual o auto-generado — ver §2 puente con BC/compras) → `crm.crm_leads`, estado `new`.
2. Se califica (`status='qualified'`) y se promueve a oportunidad: `POST /leads/:id/promote` exige `status='qualified'`, crea la oportunidad en la etapa "Análisis de la oportunidad" (falla si el lead ya tiene oportunidad).
3. Alternativamente, `POST /leads/:id/convert` crea cuenta + contacto + oportunidad en un solo paso transaccional.
4. La oportunidad avanza por el **embudo de 6 fases** (ver `242_crm_embudo_ventas_8_fases.sql`): Análisis de la oportunidad → Desarrollo de la oferta → Presentación de la oferta → Negociación → Aceptación o rechazo → Contratos. Las 3 primeras fases requieren `requires_blue_sheet=true` desde "Desarrollo de la oferta".
5. Blue Sheet: `draft` → `in_progress` (automático al llenar cualquier campo) → `ready_for_review` (`submit`, con validaciones mínimas: objetivo de venta ≥20 chars, ≥1 buying influence, scorecard >0, ≥1 action item) → `approved` (manager, bloquea si hay red flags críticas abiertas o `strategy_summary` <50 chars; snapshotea versión) u `observed` (manager, con comentarios) → `needs_update` si se reabre o si la oportunidad cambia >20% en monto o >30 días en fecha de cierre (invalidación automática en `updateOpportunity`).
6. Cierre: `close-won` (registra en `crm_integration_outbox` evento `opportunity.won` hacia `erp`) o `close-lost` (exige `lost_reason_id` válido).
7. Notificaciones internas (tabla `notifications`, vía `notificationsService`) en: BS enviado a revisión (a jefes/gerencia), BS observado (al owner), BS aprobado (al owner), red flag crítica (al owner + jefes), asignación de oportunidad.

## 6. Base de datos

Esquema dedicado `crm` (no `public`). Migraciones: `231_crm_schema_init.sql` (24 tablas), `232_crm_catalogs_seed.sql` (seed inicial: 12 etapas genéricas, 10 criterios de scorecard, 11 motivos de pérdida), `233_crm_sub_tables_schema_fix.sql`, `239/240` (integración con `scheduled_visits`/ciudad en leads), `242_crm_embudo_ventas_8_fases.sql` (reemplaza las 12 etapas por las 6 reales del embudo), `243_crm_activities_missing_columns.sql`.

Tablas (24): `crm_pipeline_stages`, `crm_accounts`, `crm_contacts`, `crm_leads`, `crm_opportunities`, `crm_opportunity_products`, `crm_blue_sheets`, `crm_blue_sheet_versions`, `crm_buying_influences`, `crm_win_results`, `crm_competitors`, `crm_competitive_preferences`, `crm_strengths`, `crm_red_flags`, `crm_scorecard_criteria`, `crm_scorecard_answers`, `crm_action_items`, `crm_activities`, `crm_documents`, `crm_notes`, `crm_review_comments`, `crm_lost_reasons`, `crm_audit_log`, `crm_integration_outbox`.

`crm_activities.source_module` (texto nullable, migración `298_work_management_crm_activity_sync.sql`) marca de forma estructurada quién generó la actividad: `'work_management'` (items de Work Management, ver `backend/src/modules/work-management/CONTEXT.md` §6) o `'schedule'` (visitas de cronograma, `schedules.service.js#upsertCrmFamActivityForScheduledVisit`). Filas anteriores a esta migración quedan con `source_module IS NULL` — el frontend (`CrmActivitiesPage.jsx#getActivityOrigin`) conserva como fallback la heurística vieja (`activity_type==='visita' && is_scheduled_visit`) para esas filas históricas, así que no hace falta backfill.

PK: `uuid DEFAULT gen_random_uuid()`. FK a usuarios: `integer references public.users(id)` (cruza esquemas). Soft delete vía `deleted_at` en casi todas las entidades operativas.

Columnas puente agregadas fuera del esquema `crm` (para enlazar procesos externos a una oportunidad CRM-Fam):
- `public.private_purchase_requests.opportunity_id`, `public.client_requests.opportunity_id` (migración 242)
- `public.equipment_purchase_requests.opportunity_id` (agregada dinámicamente por `crmPurchaseSync.service.js#ensureLinkColumns`, no en una migración numerada — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ejecutado en runtime)
- `crm.crm_activities.visit_log_id` → `public.client_visit_logs(id)`, `crm.crm_documents.activity_id` → `crm.crm_activities(id)` (agregadas en runtime por `crm.service.js#ensureActivityFollowupSchema`)
- `public.scheduled_visits.crm_activity_id` (migración 239)

## 7. Relaciones con otros módulos
- `business-case`, `private-purchases`, `equipment-purchases`: auto-crean/enlazan `crm.crm_opportunities` vía `crmPurchaseSync.service.js` (ver §2).
- `work-management`: escribe (no solo lee) en `crm.crm_activities` vía `syncCrmActivityForItem` cuando un item pertenece a un proyecto con `crm_opportunity_id`/`crm_account_id` — `activity_type='tarea'`, `source_module='work_management'`. Dirección única (WM → CRM); un cambio hecho directamente en la actividad CRM no se propaga de vuelta al item. Ver `backend/src/modules/work-management/CONTEXT.md` §6.
- `schedules`: crea/actualiza `crm.crm_activities` (`activity_type='visita'`, `source_module='schedule'`) al aprobar visitas de cronograma vía `upsertCrmFamActivityForScheduledVisit`.
- `notifications`: notificaciones de Blue Sheet (envío/observación/aprobación) y red flags críticas.
- `files` + Google Drive: `uploadDocumentFile` sube a Drive vía `utils/drive`.
- `integrations/crmWebhook.*`: sistema paralelo, NO usa las tablas de este módulo (ver §2).
- `opportunities` (FamSheets): sistema paralelo con entidades equivalentes, NO usa las tablas de este módulo (ver §2).

## 8. Frontend asociado

Todo bajo `spi_front/src/modules/crm-fam/`, montado en `CrmShell.jsx` (tabs: Dashboard, Cuentas, Contactos, Leads, "Embudo de ventas" = Opportunities, Actividades, Reportes, + Configuración solo admin).

| Ruta | Página |
|------|--------|
| `/dashboard/crm-fam` | `CrmDashboardPage.jsx` |
| `/dashboard/crm-fam/accounts` | `AccountsPage.jsx` |
| `/dashboard/crm-fam/accounts/:id` | `AccountDetailPage.jsx` |
| `/dashboard/crm-fam/contacts` | `ContactsPage.jsx` |
| `/dashboard/crm-fam/leads` | `LeadsPage.jsx` |
| `/dashboard/crm-fam/opportunities` | `OpportunitiesPage.jsx` (1631 líneas — la página más grande del módulo) |
| `/dashboard/crm-fam/opportunities/:id` | `OpportunityDetailPage.jsx` |
| `/dashboard/crm-fam/opportunities/:opportunityId/blue-sheet` | `BlueSheetPage.jsx` (1055 líneas) |
| `/dashboard/crm-fam/activities` | `CrmActivitiesPage.jsx` (incluye `OriginBadge`/`getActivityOrigin` — badge de origen genérico leyendo `source_module`, con fallback a la heurística de `is_scheduled_visit` para filas históricas; `TYPE_LABELS` incluye `tarea` para actividades creadas desde Work Management) |
| `/dashboard/crm-fam/reports` | `CrmReportsPage.jsx` |
| `/dashboard/crm-fam/settings` | `CrmSettingsPage.jsx` (solo jefe_ti/admin — catálogos) |

API client: `spi_front/src/core/api/crmFamApi.js` (todas las funciones `fetch*`/`create*`/`update*` mapean 1:1 a los endpoints de `/crm-fam/*`, usan el `api` axios compartido con interceptor de auth). Hooks en `spi_front/src/modules/crm-fam/hooks/`: `useCrmAccounts`, `useCrmContacts`, `useCrmLeads`, `useCrmOpportunities`, `useCrmBlueSheet`, `useCrmDashboard` — patrón uniforme `{ data, loading, error, refresh }`.

Entrada en `NavigationBar.jsx`: link "CRM-FAM" (`FiTarget`) → `/dashboard/crm-fam`, visible para roles comerciales.

## 9. Riesgos y notas técnicas
- **La documentación previa de este módulo (README.md / CONTEXT.md viejo) decía "Etapa 1 — esqueleto, 501 Not Implemented". Es falsa/desactualizada** — el módulo está completo y en producción. No asumir stubs sin verificar el código.
- **Historial de columnas faltantes**: la migración 231 (schema inicial) no coincidía con lo que `crm.service.js` esperaba — se corrigió en 233 (buying_influences, win_results, competitors, strengths, red_flags) y en 243 (activities: `duration_minutes`, `outcome_notes`, `outcome_rating`). Antes de agregar un campo nuevo a una query de `crm.service.js`, verificar que la columna exista en la migración más reciente — el patrón de "servicio adelantado a la migración" ya causó 500 en producción dos veces.
- **Nombres de etapas del pipeline son frágiles**: `crmPurchaseSync.service.js#STAGE_NAMES` resuelve la etapa por **nombre exacto** (normalizado sin tildes) contra `crm.crm_pipeline_stages`. Ya hubo un bug real donde los nombres sembrados en `242_crm_embudo_ventas_8_fases.sql` no coincidían con las constantes hardcodeadas (faltaban variantes con/sin tilde) y la sincronización fallaba en silencio (`logger.warn`, sin excepción). Si se renombra una etapa en el catálogo, hay que actualizar `STAGE_NAMES` en `crmPurchaseSync.service.js` a la vez.
- **12 etapas viejas conviven con las 6 nuevas**: la migración 242 no borra las etapas genéricas anteriores, solo las desactiva (`is_active=false`) para no romper referencias históricas de oportunidades ya cerradas. Cualquier query de catálogo debe filtrar `is_active=true`.
- **Columnas puente creadas en runtime, no en migración numerada**: `ensureLinkColumns()` (crmPurchaseSync) y `ensureActivityFollowupSchema()` (crm.service) ejecutan `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` al vuelo la primera vez que se necesitan, en vez de vivir en una migración con número. Funcional pero atípico frente al resto del repo — no buscar estas columnas en `backend/migrations/`.
- **Tres módulos "opportunity"**: ver §2. Antes de tocar cualquier ruta o tabla con la palabra "opportunity"/"oportunidad", confirmar de cuál de los tres sistemas se trata.
- `isManager(user)` en `crm.service.js` es un set de roles **hardcodeado dentro del servicio**, distinto (aunque superpuesto) al `managerAdmin` de `crm.routes.js` — gobierna visibilidad de filas (cuentas `private`/`team`, oportunidades de otro owner), no acceso a la ruta. Si se agrega un rol manager nuevo, actualizar ambos lugares.
- Tests: `__tests__/crm.calculators.test.js` — solo cubre las calculadoras puras (completeness, scorecard, health score); no hay tests de integración para `crm.service.js` ni para `crmPurchaseSync.service.js`.
