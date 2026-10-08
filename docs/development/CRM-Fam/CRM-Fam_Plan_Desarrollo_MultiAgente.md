# CRM-Fam — Plan de desarrollo multi-agente

**Proyecto:** SPI Fam / CRM-Fam + Blue Sheet  
**Fecha del plan:** 2026-06-27  
**Fuente de verdad:** `CRM-Fam_BlueSheet_MillerHeiman_Diseno_Requerimientos.md`  
**Principio de diseño:** Cada etapa agrupa tracks paralelos que NO tocan los mismos archivos. Un agente = un track. Ningún track empieza sin que la etapa anterior esté terminada y mergeada.

---

## Skills y modos obligatorios para todos los agentes

Todo agente que trabaje en este proyecto **debe activar los siguientes modos al inicio de cada sesión**. Son parte de la memoria del proyecto y están configurados para auto-activarse:

### `/caveman full` — Modo de comunicación

Respuestas terse. Sin relleno. Sin pleasantries. Fragmentos OK. Solo la sustancia técnica. El código no cambia — solo cómo el agente se comunica.

Activar con: `/caveman full`  
Persistente en toda la sesión. Si el agente responde con texto innecesariamente largo, recordarle: `caveman full`.

### `/ponytail full` — Modo de desarrollo (CRÍTICO)

El agente debe parar en la primera rung de la escalera que resuelva el problema:

1. ¿Necesita construirse? (YAGNI)
2. ¿Ya existe en el codebase? Reusar, no reescribir.
3. ¿Lo hace la stdlib? Usarla.
4. ¿Lo hace una dependencia ya instalada? Usarla.
5. ¿Puede ser una línea? Una línea.
6. Solo entonces: escribir el mínimo que funciona.

**Prohibido en este proyecto:**
- Abstracciones no solicitadas
- Capas extra (repositories, validators, policies — no existen en el patrón del proyecto)
- Boilerplate que nadie pidió
- Comentarios que explican QUÉ hace el código (los nombres lo dicen)
- Limpiar código circundante que no es parte del task

Activar con: `/ponytail full`  
Persistente en toda la sesión.

### Skills adicionales disponibles

Ubicadas en `C:\Users\Departamento de TI\.claude\skills\`:

| Skill | Cuándo usar |
|---|---|
| `/ponytail-review` | Revisar el diff propio antes de marcar el track como terminado. Busca sobre-ingeniería. |
| `/ponytail-audit` | Si el agente siente que el archivo que está modificando tiene bloat pre-existente. |
| `/ponytail-debt` | Si el track introduce deuda técnica intencional que debe documentarse. |

---

## Cómo usar este plan

1. Completar Etapa N completa (todos sus tracks) antes de iniciar Etapa N+1.
2. Dentro de una etapa, lanzar cada Track como un agente independiente en paralelo.
3. **Al iniciar cada sesión de agente:** activar `/caveman full` y `/ponytail full`.
4. Cada track indica exactamente: qué archivos crea, qué depende, qué entrega.
5. El prompt de cada agente debe incluir: (a) este plan, (b) el documento de requerimientos, (c) DESIGN.md, (d) los entregables de las etapas anteriores que necesita leer.
6. Las migraciones SQL van numeradas secuencialmente desde la última existente (~227).
7. Antes de cerrar el track: correr `/ponytail-review` sobre el diff propio.

---

## Resumen de etapas

| Etapa | Nombre | Tracks paralelos | Depende de |
|---:|---|---:|---|
| 1 | Fundación DB + Skeleton | 1 | — |
| 2 | Backend CRM base | 4 | Etapa 1 |
| 3 | Backend Blue Sheet base | 3 | Etapa 2 |
| 4 | Backend Blue Sheet avanzado + complementario | 4 | Etapa 3 |
| 5 | Frontend fundación | 1 | Etapa 1 (puede iniciar en paralelo con Etapas 2-4) |
| 6 | Frontend CRM base | 3 | Etapas 2 + 5 |
| 7 | Frontend Oportunidades + Dashboard | 2 | Etapas 3 + 6 |
| 8 | Frontend Blue Sheet — secciones | 4 | Etapas 4 + 7 |
| 9 | Frontend Blue Sheet — aprobación + acciones | 2 | Etapa 8 |
| 10 | Reportes + Configuración + Integraciones SPI | 5 | Etapas 4 + 9 |
| 11 | Testing + Hardening + QA final | 3 | Etapa 10 |

---

## ETAPA 1 — Fundación DB + Skeleton

**Agentes:** 1 (secuencial — todo lo demás depende de esto)  
**Objetivo:** Dejar el esquema `crm` completo en BD y el módulo backend con su estructura base vacía.

### Track 1-A: Migraciones SQL + módulo skeleton

**Archivos a crear:**
```
backend/migrations/227_crm_schema_init.sql
backend/migrations/228_crm_catalogs_seed.sql
backend/src/modules/crm-fam/crm.routes.js       ← rutas vacías con TODO
backend/src/modules/crm-fam/crm.controller.js    ← responden 501 Not Implemented
backend/src/modules/crm-fam/crm.service.js       ← funciones vacías exportadas
backend/src/modules/crm-fam/crm.calculators.js   ← funciones puras completas
backend/src/modules/crm-fam/CONTEXT.md
```

**Contenido de 227_crm_schema_init.sql:** Todas las tablas del documento de requerimientos secciones 15.1–15.25, con la corrección de tipos (user FKs como `integer references public.users(id)`, no uuid). Orden de creación:
1. `crm.crm_pipeline_stages`
2. `crm.crm_accounts`
3. `crm.crm_contacts`
4. `crm.crm_leads`
5. `crm.crm_opportunities`
6. `crm.crm_opportunity_products`
7. `crm.crm_blue_sheets`
8. `crm.crm_blue_sheet_versions`
9. `crm.crm_buying_influences`
10. `crm.crm_win_results`
11. `crm.crm_competitors`
12. `crm.crm_competitive_preferences`
13. `crm.crm_strengths`
14. `crm.crm_red_flags`
15. `crm.crm_scorecard_criteria`
16. `crm.crm_scorecard_answers`
17. `crm.crm_action_items`
18. `crm.crm_activities`
19. `crm.crm_documents`
20. `crm.crm_notes`
21. `crm.crm_review_comments`
22. `crm.crm_lost_reasons`
23. `crm.crm_audit_log`
24. `crm.crm_integration_outbox`

**Contenido de 228_crm_catalogs_seed.sql:** Seeds iniciales:
- Pipeline stages (12 etapas del documento RF-OPP-003)
- Scorecard criteria (10 criterios del documento RF-BS-090)
- Lost reasons (11 motivos del documento RF-OPP-007)

**crm.calculators.js:** Implementar completo (funciones puras sin BD):
- `calculateCompletenessScore(blueSheet, buyingInfluences, winResults, competitors, strengths, redFlags, scorecardAnswers)` → número 0-100
- `calculateScorecardScore(criteria, answers)` → número 0-100
- `calculateHealthScore(scorecardScore, completenessScore, actionItems, redFlags)` → número 0-100
- `getHealthStatus(healthScore)` → `'green'|'yellow'|'red'|'gray'`
- `getWeightedPipelineAmount(estimatedAmount, probability)` → número

**crm.routes.js:** Registrar TODOS los endpoints listados en secciones 19.1–19.12 del documento. Cada handler llama al controller correspondiente. Usar `requireRole()` según matriz de sección 6.2.

**Registro en sistema:** Agregar en `backend/src/routes/registerRoutes.js`:
```js
mountPrivateRoutes(app, '/api/v1/crm-fam', require('../modules/crm-fam/crm.routes'));
```

**Entrega:** BD con esquema `crm` completo, módulo backend con todas las rutas definidas (respondiendo 501), calculadoras listas, seeds aplicados.

---

## ETAPA 2 — Backend CRM base

**Agentes:** 4 en paralelo  
**Depende de:** Etapa 1 completa  
**Objetivo:** Implementar los 4 dominios CRM base con CRUD completo y lógica de negocio.

### Track 2-A: Cuentas + Contactos

**Archivos a modificar/crear:**
```
backend/src/modules/crm-fam/crm.service.js    ← funciones de accounts + contacts
backend/src/modules/crm-fam/crm.controller.js ← handlers de accounts + contacts
```

**Funciones a implementar en service:**

Accounts:
- `listAccounts({ q, status, owner_user_id, limit, offset, user })` — paginado, filtro por propietario/visibilidad
- `getAccountById(id, user)` — retorna cuenta + contactos + oportunidades abiertas + actividades recientes + valor histórico
- `createAccount(data, user)` — valida duplicados por RUC/nombre/email/teléfono antes de insertar
- `updateAccount(id, data, user)` — verifica propiedad o rol superior
- `softDeleteAccount(id, user)`
- `getAccountTimeline(id, user)` — historial 360: leads, oportunidades, actividades, notas, documentos

Contacts:
- `listContacts({ account_id, q, limit, offset, user })`
- `getContactById(id, user)`
- `createContact(data, user)`
- `updateContact(id, data, user)`
- `softDeleteContact(id, user)`

**Reglas de negocio:**
- Duplicado por RUC: error 409 con lista de IDs similares encontrados
- Visibilidad `private`: solo el `owner_user_id` puede ver; `team` solo su equipo; `company` todos los roles CRM
- `gerencia`, `jefe_ti`, `admin` ven todo sin restricción de propiedad

---

### Track 2-B: Leads + Conversión

**Archivos a modificar/crear:**
```
backend/src/modules/crm-fam/crm.service.js    ← funciones de leads
backend/src/modules/crm-fam/crm.controller.js ← handlers de leads
```

**Funciones a implementar en service:**

- `listLeads({ status, owner_user_id, q, priority, limit, offset, user })`
- `getLeadById(id, user)`
- `createLead(data, user)` — genera `lead_code` formato `CRM-LEAD-YYYY-000001`
- `updateLead(id, data, user)`
- `softDeleteLead(id, user)`
- `convertLead(id, { create_account, account_data, create_contact, contact_data, create_opportunity, opportunity_data }, user)` — transacción: crea los registros seleccionados, marca lead como `converted`, guarda FKs de conversión. Retorna los IDs creados. Si ya existe account por RUC, enlaza en vez de duplicar.
- `disqualifyLead(id, { reason }, user)` — cambia estado a `unqualified`

**Reglas de negocio:**
- `lead_code` secuencial por año: `SELECT MAX(lead_code)` del año actual y siguiente
- Conversión es transaccional: si falla cualquier paso, rollback completo
- Un lead `converted` no se puede editar excepto por `jefe_ti`/`admin`

---

### Track 2-C: Pipeline Stages + Oportunidades

**Archivos a modificar/crear:**
```
backend/src/modules/crm-fam/crm.service.js    ← funciones de stages + opportunities
backend/src/modules/crm-fam/crm.controller.js ← handlers de stages + opportunities
```

**Funciones a implementar en service:**

Pipeline stages (solo lectura para todos, CRUD para `jefe_ti`):
- `listPipelineStages()`
- `createPipelineStage(data, user)`
- `updatePipelineStage(id, data, user)`

Opportunities:
- `listOpportunities({ status, stage_id, owner_user_id, account_id, q, requires_blue_sheet, health_status, limit, offset, user })` — incluye `weighted_amount` calculado
- `getOpportunityById(id, user)` — retorna oportunidad + blue_sheet status + actividades recientes + action items abiertos
- `createOpportunity(data, user)` — genera `opportunity_code` formato `CRM-OPP-YYYY-000001`. Si `estimated_amount` supera umbral configurado, fuerza `requires_blue_sheet = true`
- `updateOpportunity(id, data, user)` — detecta cambios que requieren reabrir Blue Sheet (ver RGN-011, RGN-012 del documento)
- `changeOpportunityStage(id, { stage_id, notes }, user)` — registra historial en `crm.crm_audit_log`, verifica reglas de etapa (RF-OPP-005)
- `closeWon(id, data, user)` — cierra como ganada, registra `actual_close_date`, `won_amount`, dispara evento outbox
- `closeLost(id, { lost_reason_id, lost_reason_detail, lost_to_competitor_id, lesson_learned }, user)` — motivo de pérdida obligatorio (RGN-005)
- `suspendOpportunity(id, { notes }, user)`
- `getOpportunityHealth(id, user)` — llama a `crm.calculators.js`

**Reglas de negocio:**
- `opportunity_code` secuencial por año
- Al cerrar ganada: si `requires_blue_sheet = true` y no hay Blue Sheet `approved`/`active`, advertencia (no bloqueo) salvo que la etapa actual lo exija
- Cambio de `estimated_amount` > umbral % o `estimated_close_date` > umbral días → marcar Blue Sheet como `needs_update` si existe

---

### Track 2-D: Notificaciones CRM + Audit helpers

**Archivos a modificar/crear:**
```
backend/src/modules/crm-fam/crm.service.js    ← helpers de notificaciones y audit
```

**Funciones a implementar:**

- `crmNotify(user_ids[], { title, message, type, source, meta })` — wrapper sobre `notifications.service.createNotification()` que envía a múltiples usuarios. `source = 'crm-fam'`
- `crmAuditLog({ entity_name, entity_id, action, old_data, new_data, changed_fields, reason, user, req })` — inserta en `crm.crm_audit_log`
- `notifyBlueSheetSubmitted(blueSheet, opportunity, submitter)` — notifica a todos los `jefe_comercial` + `gerencia` + `jefe_ti`
- `notifyBlueSheetObserved(blueSheet, opportunity, reviewer)` — notifica al `owner_user_id` de la oportunidad
- `notifyBlueSheetApproved(blueSheet, opportunity, approver)` — notifica al `owner_user_id`
- `notifyRedFlagCritical(redFlag, blueSheet, opportunity)` — notifica al owner + jefe_comercial
- `notifyAssignment(opportunity, new_owner_user_id, assigner)` — notifica al nuevo responsable
- `resolveUserIdsByRole(roles[])` — query a `public.users` para obtener IDs de todos los usuarios con esos roles (para notificaciones a grupos)

**Nota:** Estas funciones son importadas por todos los demás tracks de las Etapas 3 y 4. Deben estar terminadas antes de que Track 3-A, 3-B, 3-C inicien.

---

## ETAPA 3 — Backend Blue Sheet base

**Agentes:** 3 en paralelo  
**Depende de:** Etapa 2 completa (especialmente Track 2-D para notificaciones)  
**Objetivo:** Blue Sheet CRUD + máquina de estados + todas las secciones de datos relacionales.

### Track 3-A: Blue Sheet core — CRUD + máquina de estados + versiones

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js    ← funciones de blue_sheets
backend/src/modules/crm-fam/crm.controller.js ← handlers de blue_sheets
```

**Funciones a implementar:**

- `createBlueSheet(opportunity_id, data, user)` — solo si la oportunidad existe y no tiene Blue Sheet activo (RGN-001, RGN-002)
- `getBlueSheetByOpportunity(opportunity_id, user)`
- `getBlueSheetById(id, user)`
- `updateBlueSheetGeneral(id, data, user)` — actualiza campos de objetivo + situación del cliente. Solo en estado `draft`/`in_progress`/`needs_update`/`observed`
- `updateBlueSheetBuyingProcess(id, data, user)` — actualiza proceso de compra
- `updateBlueSheetStrategy(id, data, user)` — actualiza estrategia comercial
- `submitBlueSheetForReview(id, user)` — cambia a `ready_for_review`. Valida requisitos mínimos (RF-BS-120): objetivo de venta completo, al menos una influencia compradora, scorecard iniciado, plan de acción creado. Llama a `notifyBlueSheetSubmitted()`
- `approveBlueSheet(id, { notes }, user)` — solo `jefe_comercial`/`gerencia`/`jefe_ti`. Cambia a `approved`, crea snapshot en `crm_blue_sheet_versions` (RGN-010), llama a `notifyBlueSheetApproved()`, desbloquea oportunidad
- `observeBlueSheet(id, { comments[] }, user)` — cambia a `observed`, inserta `crm_review_comments`, llama a `notifyBlueSheetObserved()`
- `reopenBlueSheet(id, { reason }, user)` — cambia a `needs_update`
- `getBlueSheetVersions(id, user)` — lista historial de versiones
- `getBlueSheetCompleteness(id, user)` — llama a `crm.calculators.calculateCompletenessScore()`
- `createBlueSheetSnapshot(id, reason, user)` — inserta en `crm_blue_sheet_versions` con `snapshot_data` = JSONB de todo el Blue Sheet actual

**Reglas de negocio críticas:**
- RF-BS-083: No aprobar con Red Flags críticas `open` sin mitigación ni acción de aceptación
- RF-BS-101: No aprobar si `strategy_summary` < 50 caracteres
- RF-BS-112: No enviar a revisión si no hay acciones en últimos 15 días
- RGN-010: Aprobar siempre crea snapshot automático

---

### Track 3-B: Buying Influences + Win-Results

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js    ← funciones de buying_influences + win_results
backend/src/modules/crm-fam/crm.controller.js ← handlers correspondientes
```

**Funciones a implementar:**

Buying Influences:
- `listBuyingInfluences(blue_sheet_id, user)`
- `createBuyingInfluence(blue_sheet_id, data, user)` — valida que `contact_id` o `manual_name` exista (RGN-014: Coach debe tener `coach_qualification_notes`)
- `updateBuyingInfluence(id, data, user)`
- `softDeleteBuyingInfluence(id, user)`

Win-Results:
- `listWinResults(blue_sheet_id, user)`
- `createWinResult(buying_influence_id, data, user)` — verifica que `buying_influence_id` pertenece al mismo `blue_sheet_id`
- `updateWinResult(id, data, user)`
- `softDeleteWinResult(id, user)`

**Reglas de negocio:**
- RF-BS-046: Al crear Coach, si `coach_qualification_notes` está vacío → advertencia en respuesta (no bloqueo)
- RF-BS-045: Si se borra el único `economic_buyer` y el Blue Sheet no está en `draft`, advertir al cliente para crear Red Flag automática
- RGN-015: Win-Results `assumed` → incluir `validation_warning: true` en respuesta

---

### Track 3-C: Competitors + Competitive Preferences + Strengths + Red Flags

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js    ← funciones de competitors, prefs, strengths, red_flags
backend/src/modules/crm-fam/crm.controller.js ← handlers correspondientes
```

**Funciones a implementar:**

Competitors:
- `listCompetitors(blue_sheet_id, user)`
- `createCompetitor(blue_sheet_id, data, user)`
- `updateCompetitor(id, data, user)`
- `softDeleteCompetitor(id, user)`

Competitive Preferences:
- `listCompetitivePreferences(blue_sheet_id, user)`
- `upsertCompetitivePreference(blue_sheet_id, buying_influence_id, competitor_id, data, user)` — crea o actualiza preferencia. Si `preference = 'prefers_competitor'` y el rol del influence es `economic_buyer` o `technical_buyer` → sugerir Red Flag (RF-BS-062), incluir `suggest_red_flag: true` en respuesta

Strengths:
- `listStrengths(blue_sheet_id, user)`
- `createStrength(blue_sheet_id, data, user)` — si `impact_level = 'critical'` y `leverage_action` vacío → advertencia (RF-BS-071)
- `updateStrength(id, data, user)`
- `softDeleteStrength(id, user)`

Red Flags:
- `listRedFlags(blue_sheet_id, user)` — incluye conteo por severidad
- `createRedFlag(blue_sheet_id, data, user)` — si `severity = 'critical'` llama a `notifyRedFlagCritical()`
- `updateRedFlag(id, data, user)`
- `softDeleteRedFlag(id, user)`
- `acceptRedFlag(id, { acceptance_reason }, user)` — solo `jefe_comercial`/`gerencia`/`jefe_ti`. Cambia status a `accepted`, registra `accepted_by`, `accepted_at`
- `generateAutomaticRedFlags(blue_sheet_id, opportunity, user)` — evalúa condiciones de sección 17 del documento y crea/sugiere Red Flags automáticas

---

## ETAPA 4 — Backend Blue Sheet avanzado + complementario

**Agentes:** 4 en paralelo  
**Depende de:** Etapa 3 completa  
**Objetivo:** Completar scorecard, action items, actividades, documentos y notas.

### Track 4-A: Scorecard

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js
backend/src/modules/crm-fam/crm.controller.js
```

**Funciones a implementar:**

- `listScorecardCriteria()` — lista criterios activos ordenados por `display_order`
- `createScorecardCriterion(data, user)` — solo `jefe_ti`
- `updateScorecardCriterion(id, data, user)` — solo `jefe_ti`
- `getBlueSheetScorecard(blue_sheet_id, user)` — retorna criterios + respuestas actuales + score calculado
- `saveBlueSheetScorecard(blue_sheet_id, answers[], user)` — UPSERT de todas las respuestas en transacción. Luego recalcula y guarda `scorecard_score` en `crm_blue_sheets`. Luego recalcula `health_score` usando `crm.calculators.calculateHealthScore()`. Si `scorecard_score < 40` → generar Red Flag automática "Score crítico" (sección 17 del documento)

---

### Track 4-B: Action Items

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js
backend/src/modules/crm-fam/crm.controller.js
```

**Funciones a implementar:**

- `listActionItems(blue_sheet_id, { status, owner_user_id, limit, offset })` — incluye vencidas (auto-calculadas)
- `createActionItem(blue_sheet_id, opportunity_id, data, user)`
- `updateActionItem(id, data, user)`
- `completeActionItem(id, { actual_result }, user)` — cambia a `completed`, registra `completed_at`
- `softDeleteActionItem(id, user)`
- `markOverdueActionItems()` — función interna/job: cambia a `overdue` las `pending`/`in_progress` con `due_date < now()`

---

### Track 4-C: Activities CRM

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js
backend/src/modules/crm-fam/crm.controller.js
```

**Funciones a implementar:**

- `listActivities({ account_id, contact_id, opportunity_id, blue_sheet_id, owner_user_id, status, limit, offset, user })`
- `createActivity(data, user)`
- `updateActivity(id, data, user)`
- `completeActivity(id, { outcome, next_step }, user)`
- `softDeleteActivity(id, user)`
- `listOverdueActivities(user)` — actividades pendientes con fecha vencida del usuario actual

---

### Track 4-D: Documents + Notes + Lost Reasons

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js
backend/src/modules/crm-fam/crm.controller.js
```

**Funciones a implementar:**

Documents:
- `listDocuments({ account_id, opportunity_id, blue_sheet_id, limit, offset, user })`
- `createDocument(data, user)` — metadata sin upload real en Fase 1; prepara campos `drive_*` para Fase 5
- `softDeleteDocument(id, user)`

Notes:
- `listNotes({ account_id, contact_id, opportunity_id, blue_sheet_id, user })` — filtra por visibilidad vs rol del usuario
- `createNote(data, user)` — visibilidad `executive` solo permitida a `gerencia`/`jefe_ti`
- `updateNote(id, data, user)` — solo el creador o `jefe_ti`
- `softDeleteNote(id, user)`

Lost Reasons (catálogo):
- `listLostReasons()`
- `createLostReason(data, user)` — solo `jefe_ti`
- `updateLostReason(id, data, user)` — solo `jefe_ti`

Dashboard/Reports API:
- `getDashboardSummary(user)` — KPIs: leads abiertos, oportunidades abiertas, valor pipeline, valor ponderado, BS pendientes, Red Flags críticas, sin comprador económico, próximas a cierre, actividades vencidas
- `getPipelineByStage(user)` — oportunidades agrupadas por etapa con valor total
- `getForecast({ year, month }, user)` — oportunidades estimadas a cerrar ese mes
- `getBlueSheetKpis(user)` — KPIs Blue Sheet (sección RF-KPI-002)
- `getLostReasonsReport({ date_from, date_to }, user)`
- `getRedFlagsReport({ severity, status }, user)`

---

## ETAPA 5 — Frontend fundación

**Agentes:** 1 (puede iniciar en paralelo con Etapas 2-4 del backend)  
**Depende de:** Etapa 1 (rutas API definidas)  
**Objetivo:** Estructura frontend que todos los tracks de Etapas 6-10 van a usar.

### Track 5-A: Rutas + API client + hooks base + NavigationBar

**Archivos a crear/modificar:**
```
spi_front/src/core/api/crmFamApi.js           ← cliente HTTP completo
spi_front/src/modules/crm-fam/hooks/useCrmAccounts.js
spi_front/src/modules/crm-fam/hooks/useCrmContacts.js
spi_front/src/modules/crm-fam/hooks/useCrmLeads.js
spi_front/src/modules/crm-fam/hooks/useCrmOpportunities.js
spi_front/src/modules/crm-fam/hooks/useCrmBlueSheet.js
spi_front/src/modules/crm-fam/hooks/useCrmDashboard.js
```

**Archivos a modificar:**
```
spi_front/src/routes/AppRoutes.jsx            ← agregar todas las rutas /dashboard/crm-fam/*
spi_front/src/core/ui/components/NavigationBar.jsx ← agregar entrada CRM-Fam para roles comerciales + jefe_ti
```

**crmFamApi.js:** Implementar TODAS las funciones de fetch para los endpoints de sección 19 del documento (accounts, contacts, leads, opportunities, blue-sheets, buying-influences, win-results, competitors, competitive-preferences, strengths, red-flags, scorecard, action-items, activities, documents, notes, dashboard). Mismo patrón que `schedulesApi.js`: `apiFetch()` del core, retorna `data` del response, lanza error con `message`.

**AppRoutes.jsx:** Agregar con lazy loading:
```jsx
/dashboard/crm-fam                            → CrmDashboardPage
/dashboard/crm-fam/accounts                   → AccountsPage
/dashboard/crm-fam/accounts/:id               → AccountDetailPage
/dashboard/crm-fam/contacts                   → ContactsPage
/dashboard/crm-fam/leads                      → LeadsPage
/dashboard/crm-fam/opportunities              → OpportunitiesPage
/dashboard/crm-fam/opportunities/:id          → OpportunityDetailPage
/dashboard/crm-fam/opportunities/:id/blue-sheet → BlueSheetPage
/dashboard/crm-fam/activities                 → CrmActivitiesPage
/dashboard/crm-fam/reports                    → CrmReportsPage
/dashboard/crm-fam/settings                   → CrmSettingsPage (strictRoles: jefe_ti)
```

**Hooks:** Cada hook con `useState` + `useEffect` o TanStack Query. Métodos: `list`, `get`, `create`, `update`, `remove`, `refresh`. Incluir estado `loading`, `error`.

**NavigationBar:** Agregar sección CRM-Fam visible para: `comercial`, `jefe_comercial`, `asesor_comercial`, `analista_comercial`, `acp_comercial`, `backoffice_comercial`, `gerencia`, `gerencia_general`, `jefe_ti`.

---

## ETAPA 6 — Frontend CRM base

**Agentes:** 3 en paralelo  
**Depende de:** Etapas 2 + 5  
**Objetivo:** Páginas base de Cuentas, Contactos y Leads completamente funcionales.

### Track 6-A: Páginas Cuentas

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/pages/AccountsPage.jsx
spi_front/src/modules/crm-fam/pages/AccountDetailPage.jsx
spi_front/src/modules/crm-fam/components/accounts/AccountCard.jsx
spi_front/src/modules/crm-fam/components/accounts/AccountFormModal.jsx
spi_front/src/modules/crm-fam/components/accounts/AccountStatusBadge.jsx
spi_front/src/modules/crm-fam/components/accounts/DuplicateWarningModal.jsx
```

**AccountsPage:** Expediente layout (WORKSPACE_2COL_CLASS). Sidebar: filtros por tipo/estado + lista de cuentas con `AccountCard`. Panel principal: `AccountDetailPage` embebido al seleccionar.

**AccountDetailPage (360):** Pestañas: `Datos generales` | `Contactos (N)` | `Oportunidades (N)` | `Actividades` | `Documentos` | `Notas`. Header: nombre comercial, estado badge, razón social, RUC, ciudad, responsable, botón Editar (modal) + Nuevo Contacto.

**AccountFormModal:** Campos de RF-ACC-001. Validación de duplicados: al escribir RUC/razón social, query al backend, mostrar `DuplicateWarningModal` si hay similares antes de guardar.

---

### Track 6-B: Páginas Contactos

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/pages/ContactsPage.jsx
spi_front/src/modules/crm-fam/components/contacts/ContactCard.jsx
spi_front/src/modules/crm-fam/components/contacts/ContactFormModal.jsx
spi_front/src/modules/crm-fam/components/contacts/ContactInfluenceBadge.jsx
```

**ContactsPage:** Lista con búsqueda + filtro por cuenta. Al seleccionar contacto: panel lateral con datos, cuenta asociada, oportunidades en que participa como influencia, actividades recientes.

**ContactFormModal:** Campos de RF-CON-001. Selector de cuenta existente (autocomplete).

---

### Track 6-C: Páginas Leads + Conversión

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/pages/LeadsPage.jsx
spi_front/src/modules/crm-fam/components/leads/LeadCard.jsx
spi_front/src/modules/crm-fam/components/leads/LeadFormModal.jsx
spi_front/src/modules/crm-fam/components/leads/LeadStatusBadge.jsx
spi_front/src/modules/crm-fam/components/leads/LeadConversionModal.jsx
spi_front/src/modules/crm-fam/components/leads/LeadDisqualifyModal.jsx
```

**LeadsPage:** Expediente layout. Sidebar con filtros por estado + prioridad + lista. Panel principal: detalle del lead seleccionado, historial, botones de acción según estado.

**LeadConversionModal:** Wizard 3 pasos: (1) crear/seleccionar cuenta, (2) crear/seleccionar contacto, (3) crear oportunidad. Checkbox por paso — solo los marcados se crean. Muestra advertencia si encuentra duplicado por RUC.

---

## ETAPA 7 — Frontend Oportunidades + Dashboard

**Agentes:** 2 en paralelo  
**Depende de:** Etapas 3 + 6  
**Objetivo:** Pipeline de oportunidades y dashboard CRM funcionales.

### Track 7-A: Oportunidades — Pipeline + Detalle

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/pages/OpportunitiesPage.jsx
spi_front/src/modules/crm-fam/pages/OpportunityDetailPage.jsx
spi_front/src/modules/crm-fam/components/opportunities/OpportunityCard.jsx
spi_front/src/modules/crm-fam/components/opportunities/OpportunityFormModal.jsx
spi_front/src/modules/crm-fam/components/opportunities/OpportunityHealthBadge.jsx
spi_front/src/modules/crm-fam/components/opportunities/StageChangeModal.jsx
spi_front/src/modules/crm-fam/components/opportunities/CloseWonModal.jsx
spi_front/src/modules/crm-fam/components/opportunities/CloseLostModal.jsx
spi_front/src/modules/crm-fam/components/opportunities/OpportunityProductsSection.jsx
```

**OpportunitiesPage:** Vista doble: kanban por etapas (columnas) + lista tabular. Toggle entre modos. Cada tarjeta muestra: nombre, cuenta, valor, fecha estimada, `OpportunityHealthBadge`, estado Blue Sheet, responsable.

**OpportunityDetailPage:** Header: nombre, cuenta, etapa actual (selector inline), valor, fecha estimada, responsable, `OpportunityHealthBadge`. Pestañas: `Blue Sheet` | `Actividades` | `Documentos` | `Notas` | `Historial`. Barra de acciones: Cambiar etapa / Cerrar ganada / Cerrar perdida / Suspender (según estado y rol).

**StageChangeModal:** Selector de etapa. Si la etapa requiere Blue Sheet y no está aprobado → bloqueo con mensaje. Si pasa a etapa `lost`/`suspended` → campo motivo obligatorio.

**CloseWonModal:** Campos de RF-OPP-006. **CloseLostModal:** Campos de RF-OPP-007 con selector de `LostReason`.

---

### Track 7-B: CRM Dashboard

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/pages/CrmDashboardPage.jsx
spi_front/src/modules/crm-fam/components/dashboard/PipelineSummaryCard.jsx
spi_front/src/modules/crm-fam/components/dashboard/KpiStatCard.jsx
spi_front/src/modules/crm-fam/components/dashboard/ForecastChart.jsx
spi_front/src/modules/crm-fam/components/dashboard/RedFlagsAlertList.jsx
spi_front/src/modules/crm-fam/components/dashboard/ActivitiesWidget.jsx
spi_front/src/modules/crm-fam/components/dashboard/TopOpportunitiesList.jsx
```

**CrmDashboardPage:** Grid de KPIs (RF-CRM-001): leads abiertos, oportunidades abiertas, valor pipeline, valor ponderado, BS pendientes de revisión, Red Flags críticas, sin comprador económico, próximas a cierre. Gráfico de pipeline por etapa. Lista de actividades vencidas del usuario. Top oportunidades por valor. Filtros de fecha y responsable (solo gerencia/jefe_ti ven filtro de responsable).

---

## ETAPA 8 — Frontend Blue Sheet — secciones de datos

**Agentes:** 4 en paralelo  
**Depende de:** Etapas 4 + 7  
**Objetivo:** La página BlueSheetPage con el wizard completo, dividida entre 4 tracks.

**Contrato compartido:** BlueSheetPage.jsx lo crea Track 8-A. Los Tracks 8-B, 8-C, 8-D crean SOLO sus componentes hijos. BlueSheetPage los importa.

### Track 8-A: BlueSheet shell + Resumen + Objetivo + Situación del cliente + Proceso de compra

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/pages/BlueSheetPage.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/BlueSheetProgressBar.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/BlueSheetHealthBadge.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/BlueSheetStatusBadge.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/BlueSheetSummaryTab.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/SalesObjectiveForm.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/CustomerSituationForm.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/BuyingProcessForm.jsx
```

**BlueSheetPage.jsx:** Estructura wizard con tabs numeradas. Header: oportunidad, cuenta, estado BS (`BlueSheetStatusBadge`), `BlueSheetProgressBar` (% completitud), `BlueSheetHealthBadge` (health score + color). Barra de acciones: Enviar a revisión / Aprobar / Observar / Reabrir (según estado + rol). Tabs: `Resumen | Objetivo | Cliente | Proceso | Influencias | Win-Results | Competencia | Fortalezas | Red Flags | Scorecard | Estrategia | Plan | Revisión | Historial`.

**BlueSheetProgressBar:** Barra de progreso con % de completitud. Tooltip con secciones faltantes. Color rojo < 40%, amarillo 40-74%, verde ≥ 75%.

**SalesObjectiveForm:** Campos de RF-BS-010. Validación de objetivo genérico (RF-BS-011): advertencia si < 30 chars o contiene frases como "Vender al cliente", "Cerrar la venta".

**CustomerSituationForm:** Campos de RF-BS-020. Advertencia si `urgency_level = 'unknown'` y etapa ≥ propuesta.

**BuyingProcessForm:** Campos de RF-BS-030. Selector `buying_process_maturity` con valores de RF-BS-031.

---

### Track 8-B: Influencias + Win-Results

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/components/blue-sheet/BuyingInfluenceMatrix.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/BuyingInfluenceCard.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/BuyingInfluenceFormModal.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/WinResultsSection.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/WinResultFormModal.jsx
```

**BuyingInfluenceMatrix:** Tabla/grid de influencias. Filas = influencias. Columnas: nombre, cargo, rol (badge), nivel de influencia, actitud (color según RF-BS-043), acceso, ¿confirmado?, ¿bloqueador?. Botón "+" agregar influencia. Al hacer clic en una fila: panel lateral de edición.

**BuyingInfluenceFormModal:** Selector de contacto existente (autocomplete) O entrada manual. Campos de RF-BS-040. Si rol = `coach` y `coach_qualification_notes` vacío → advertencia visible antes de guardar.

**WinResultsSection:** Lista por influencia compradora. Cada influencia muestra sus Win-Results con badge de `validation_status`. Botón agregar por influencia.

---

### Track 8-C: Competidores + Preferencias competitivas

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/components/blue-sheet/CompetitorSection.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/CompetitorFormModal.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/CompetitivePreferenceGrid.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/CompetitivePreferenceCell.jsx
```

**CompetitorSection:** Lista de competidores con nombre, tipo, fortaleza/debilidad, probabilidad percibida. Botón agregar.

**CompetitivePreferenceGrid:** Matriz: filas = influencias compradoras, columnas = FAM + cada competidor. Cada celda = `CompetitivePreferenceCell` con selector de preferencia (color por valor: verde=prefers_fam, rojo=prefers_competitor, etc.). Si celda es `prefers_competitor` para un `economic_buyer` o `technical_buyer` → icono de advertencia en la celda + sugerencia de Red Flag.

---

### Track 8-D: Fortalezas + Red Flags + Scorecard

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/components/blue-sheet/StrengthsPanel.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/StrengthFormModal.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/RedFlagsPanel.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/RedFlagFormModal.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/RedFlagCard.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/ScorecardForm.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/ScorecardCriterionRow.jsx
```

**StrengthsPanel:** Lista de fortalezas con categoría, impacto (badge), estado. Si `impact_level = 'critical'` y sin `leverage_action` → badge de advertencia.

**RedFlagsPanel:** Lista agrupada por severidad. Cards con título, descripción, categoría, severidad (badge rojo/naranja/amarillo), estado, responsable, fecha. Red Flags críticas `open` sin mitigación resaltadas. Botón "Aceptar riesgo" para `jefe_comercial`/`gerencia`/`jefe_ti`.

**ScorecardForm:** Lista de criterios del catálogo. Cada `ScorecardCriterionRow`: nombre del criterio + descripción + slider 0-5 + campo de justificación + campo de evidencia. Al final: score total calculado en tiempo real. Si score < 40 → aviso de score crítico.

---

## ETAPA 9 — Frontend Blue Sheet — Aprobación + Acciones

**Agentes:** 2 en paralelo  
**Depende de:** Etapa 8  

### Track 9-A: Estrategia + Plan de Acción

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/components/blue-sheet/StrategySection.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/ActionPlanBoard.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/ActionItemCard.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/ActionItemFormModal.jsx
```

**StrategySection:** Formulario de campos RF-BS-100. Si `strategy_summary` < 50 chars → aviso inline (requerido para aprobación).

**ActionPlanBoard:** Lista de acciones agrupadas por estado. `ActionItemCard`: título, tipo, responsable, fecha, prioridad badge, estado badge. Botones: Completar / Editar / Eliminar. Filtros por estado/responsable/prioridad.

---

### Track 9-B: Revisión + Historial + Flujo de aprobación

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/components/blue-sheet/ReviewCommentsPanel.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/ApproveBlueSheetModal.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/ObserveBlueSheetModal.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/SubmitReviewModal.jsx
spi_front/src/modules/crm-fam/components/blue-sheet/BlueSheetVersionHistory.jsx
```

**ReviewCommentsPanel:** Lista de observaciones del revisor. Cada observación: sección, comentario, severidad, ¿requiere corrección?, estado de resolución. Solo en estado `observed`/`ready_for_review`.

**ApproveBlueSheetModal:** Textarea de notas obligatorias. Lista de bloqueos si existen (Red Flags críticas sin mitigación, strategy_summary corto). Si hay bloqueos → botón deshabilitado con explicación.

**ObserveBlueSheetModal:** Formulario para agregar múltiples observaciones (sección + comentario + severidad + requiere_corrección). Botón "+" para agregar más.

**BlueSheetVersionHistory:** Lista de snapshots con fecha, versión, motivo, usuario que lo generó. Botón "Ver snapshot" que abre modal con el JSON del estado en esa versión.

---

## ETAPA 10 — Reportes + Configuración + Integraciones SPI

**Agentes:** 5 en paralelo  
**Depende de:** Etapas 4 + 9  

### Track 10-A: Página de Reportes

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/pages/CrmReportsPage.jsx
spi_front/src/modules/crm-fam/components/reports/PipelineReportChart.jsx
spi_front/src/modules/crm-fam/components/reports/ForecastTable.jsx
spi_front/src/modules/crm-fam/components/reports/LostReasonsChart.jsx
spi_front/src/modules/crm-fam/components/reports/RedFlagsReportTable.jsx
spi_front/src/modules/crm-fam/components/reports/BlueSheetKpiGrid.jsx
spi_front/src/modules/crm-fam/components/reports/ScoreByCommercialTable.jsx
```

KPIs de RF-KPI-001 y RF-KPI-002. Filtros por fecha y responsable. Exportación CSV futura (preparar estructura).

---

### Track 10-B: Página de Configuración (jefe_ti)

**Archivos a crear:**
```
spi_front/src/modules/crm-fam/pages/CrmSettingsPage.jsx
spi_front/src/modules/crm-fam/components/settings/PipelineStagesConfig.jsx
spi_front/src/modules/crm-fam/components/settings/ScorecardCriteriaConfig.jsx
spi_front/src/modules/crm-fam/components/settings/LostReasonsConfig.jsx
```

**CrmSettingsPage:** Pestañas: `Etapas del pipeline` | `Criterios de scorecard` | `Motivos de pérdida`. Solo accesible para `jefe_ti`. CRUD completo de catálogos con modales inline.

---

### Track 10-C: Integración Business Case

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js    ← función createBusinessCaseFromOpportunity
backend/src/modules/crm-fam/crm.controller.js ← handler POST /opportunities/:id/derive-business-case
spi_front/src/modules/crm-fam/components/opportunities/DeriveBusinessCaseModal.jsx
```

**Backend:** `createBusinessCaseFromOpportunity(opportunity_id, user)` — llama a `businessCase.service.createBusinessCase()` con datos mapeados de la oportunidad. Registra `external_erp_id` en la oportunidad. Solo disponible para oportunidades en estado `won`.

**Frontend:** Modal en `OpportunityDetailPage` (botón visible cuando `status = 'won'` y rol lo permite). Muestra campos pre-llenados del Business Case y confirma creación.

---

### Track 10-D: Integración compras (privadas + equipos)

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js    ← funciones de derivación a compras
backend/src/modules/crm-fam/crm.controller.js ← handlers correspondientes
spi_front/src/modules/crm-fam/components/opportunities/DerivePurchaseModal.jsx
```

**Backend:** 
- `deriveToPurchase(opportunity_id, { purchase_type: 'private'|'equipment' }, user)` — crea referencia en outbox para que el módulo de compras correspondiente la tome. No crea el registro de compra directamente; dispara evento en `crm.crm_integration_outbox`.

**Frontend:** Modal selector de tipo de compra, con datos pre-llenados de la oportunidad.

---

### Track 10-E: Integración Servicio Técnico

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js    ← función deriveToService
spi_front/src/modules/crm-fam/components/opportunities/DeriveServiceModal.jsx
```

Mismo patrón que Track 10-D. Evento outbox dirigido al módulo `servicio`. Datos: nombre oportunidad, cuenta, contacto, productos/servicios, responsable de ejecución.

---

## ETAPA 11 — Testing + Hardening + QA final

**Agentes:** 3 en paralelo  
**Depende de:** Etapa 10  

### Track 11-A: Tests backend (reglas críticas)

**Archivos a crear:**
```
backend/src/modules/crm-fam/__tests__/blueSheet.rules.test.js
backend/src/modules/crm-fam/__tests__/opportunity.rules.test.js
backend/src/modules/crm-fam/__tests__/scorecard.calculators.test.js
backend/src/modules/crm-fam/__tests__/permissions.test.js
```

Tests usando Jest con mocks de BD (`jest.mock('../../config/db')`). Cubrir:
- Aprobación de Blue Sheet bloqueada por Red Flags críticas abiertas
- Aprobación bloqueada por strategy_summary corto
- Envío a revisión bloqueado sin requisitos mínimos
- `calculateScorecardScore` con diferentes combinaciones de pesos
- `calculateHealthScore` con Red Flags y action items en distintos estados
- `calculateCompletenessScore` con secciones parciales
- Rol `comercial` no puede ver oportunidades privadas ajenas
- Rol `jefe_ti` puede ver todo

---

### Track 11-B: Frontend QA — estados vacíos + errores + responsive

**Archivos a modificar:** Todas las páginas de Etapas 6-10.

Revisar y completar:
- Empty states en todas las listas (sin cuentas, sin oportunidades, sin influencias, etc.)
- Loading skeletons en todas las secciones con fetch
- Manejo de error en todos los formularios (toast de error, campos con validación visual)
- Responsive en móvil (WORKSPACE_2COL_CLASS colapsa a una columna en móvil)
- Confirmaciones antes de eliminar cualquier registro
- Feedback visual post-acción (toast de éxito/error, actualización optimista donde aplique)

---

### Track 11-C: Auditoría completa + Notificaciones completas + CONTEXT.md

**Archivos a modificar:**
```
backend/src/modules/crm-fam/crm.service.js    ← verificar que TODOS los eventos críticos llamen a crmAuditLog()
backend/src/modules/crm-fam/CONTEXT.md        ← documentación final del módulo
```

Verificar que `crmAuditLog()` se llame en todos los eventos de la sección 23 del documento de requerimientos. Verificar que `crmNotify()` se llame para todos los eventos de sección 10.22. Completar CONTEXT.md con endpoints, flujos, roles, riesgos y dependencias.

---

## Dependencias entre etapas — diagrama

```
Etapa 1 (DB + Skeleton)
    │
    ├──── Etapa 2 (Backend base) ─────────── Etapa 5 (Frontend fundación)
    │           │                                      │
    │           └──── Etapa 3 (BS base)                │
    │                       │                          │
    │                       └──── Etapa 4 (BS avanzado)│
    │                                   │              │
    │                                   │         Etapa 6 (Frontend CRM base)
    │                                   │              │
    │                                   │         Etapa 7 (Oportunidades + Dashboard)
    │                                   │              │
    │                                   └──────── Etapa 8 (Blue Sheet secciones)
    │                                                  │
    │                                             Etapa 9 (BS aprobación)
    │                                                  │
    │                                             Etapa 10 (Reportes + Integraciones)
    │                                                  │
    └──────────────────────────────────────── Etapa 11 (Testing + QA)
```

---

## Coherencia visual — DESIGN.md obligatorio (tracks frontend)

**Archivo:** `DESIGN.md` en la raíz del proyecto. Todo agente que escriba JSX debe leerlo completo antes de empezar. Lo siguiente es el resumen de las reglas más importantes, pero el archivo completo es la fuente de verdad.

### Paleta de colores — reglas duras

| Token | Valor | Uso correcto | Prohibido |
|---|---|---|---|
| Naval Slate | `#1E293B` | Navegación, headers de sección, anclas estructurales | Fondo de card, acento decorativo |
| Action Blue | `#2563EB` | Botones primarios, enlaces activos, indicadores de progreso | Más del 10% de cualquier pantalla, headers, borders decorativos |
| Surface White | `#FFFFFF` | Fondo de cards, paneles, formularios | — |
| Paper White | `#F9FAFB` | Fondo de página | — |
| Operative Green | `#16A34A` / soft `#DCFCE7` | Aprobado, activo, completado | Decoración, marca |
| Alert Red | `#DC2626` / soft `#FEE2E2` | Rechazado, error, vencido | Decoración |
| Caution Amber | `#D97706` / soft `#FEF3C7` | Pendiente, por revisar | Decoración |
| Ink Slate | `#1F2937` | Texto principal y títulos | — |
| Warm Ash | `#6B7280` | Texto secundario, placeholders | — |

**The Sparrow Rule:** Action Blue ≤ 10% de cualquier pantalla. Si hay duda: no usarlo.  
**The Semantic Seal:** Verde/rojo/ámbar son semánticos. Si algo es verde, debe significar "aprobado/completado". No decorar con colores de estado.

### Componentes visuales — reglas duras

- **Radius:** `8px` (sm), `12px` (md), `16px` (lg — firma del sistema), `9999px` (full para badges/pills)
- **Modales:** Usar `core/ui/components/Modal.jsx` existente. Props: `open`, `title`, `onClose`, `maxWidth`. Mobile: bottom sheet. Desktop: centrado redondeado. NO crear modales custom desde cero.
- **Layout expediente:** Usar `WORKSPACE_2COL_CLASS`, `WORKSPACE_SIDEBAR_CLASS`, `WORKSPACE_MAIN_CLASS` de `core/ui/workspaceLayout.js`. Sin doble scroll.
- **Botones:** Clases Tailwind que respondan a los tokens del DESIGN.md. Primario: `bg-[#2563EB] text-white rounded-2xl`. Secundario: `bg-white border border-[#E5E7EB] text-[#1F2937]`. Destructivo: `bg-[#DC2626] text-white`.
- **Badges de estado:** Pills con `rounded-full px-2.5 py-0.5 text-xs font-medium`. Colores según Semantic Seal.
- **Cards:** `bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.06)]`
- **Inputs:** `bg-white border border-[#D1D5DB] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#2563EB]`

### Reglas absolutas de UI

- **Sin emojis** en ningún elemento de UI (texto, botones, labels, títulos)
- **Sin gradient text** (background-clip text prohibido)
- **Sin fondos azules** en secciones, headers o cards
- **Tipografía:** Geist como familia principal (ya cargada en el proyecto). Display 700, Headline 600, Body 400, Label 500.
- **Formularios ≤ 12 campos** van en modal (DESIGN.md Sección 8 — Progressive Disclosure). Más de 12: pantalla propia o wizard.
- **Íconos:** React Icons (`react-icons/fi` — Feather Icons). Sin mezclar familias de íconos.
- **Skeleton loading:** Usar `animate-pulse bg-slate-200 rounded` para todos los estados de carga.

### Patrones de referencia dentro del proyecto

Antes de construir un componente nuevo, buscar si ya existe algo similar:
- Modal: `spi_front/src/core/ui/components/Modal.jsx`
- Expediente 2 columnas: `spi_front/src/modules/comercial/components/schedules/ScheduleWorkspace.jsx`
- Status badge: `spi_front/src/modules/comercial/components/schedules/ScheduleStatusBadge.jsx`
- Layout constants: `spi_front/src/core/ui/workspaceLayout.js`

**Escalera ponytail para UI:** antes de crear un componente nuevo, verificar si existe uno en `spi_front/src/core/ui/components/`. Si existe: reusar. Si es similar: extender. Solo si no existe nada parecido: crear.

---

## Notas para los agentes

1. **Skills obligatorias:** activar `/caveman full` + `/ponytail full` al inicio de cada sesión. Correr `/ponytail-review` antes de cerrar el track.
2. **Fuente de verdad:** Leer `CRM-Fam_BlueSheet_MillerHeiman_Diseno_Requerimientos.md`, este plan y `DESIGN.md` antes de escribir código.
3. **Tipos de usuario:** Los FK a `public.users` son `integer`, no UUID. Ver corrección en Sección 0.1 del documento de requerimientos.
4. **Roles:** No inventar roles. Los únicos roles válidos están en `backend/src/middlewares/roles.js`. `jefe_ti` es el admin operativo.
5. **Patrón backend:** `routes → controller → service`. Sin capas extra. Sin comentarios que expliquen QUÉ hace el código.
6. **Patrón frontend:** `modules/crm-fam/pages/` + `modules/crm-fam/components/`. API en `core/api/crmFamApi.js`. Sin stores globales. Seguir DESIGN.md siempre.
7. **Sin pisarse archivos:** Cada track tiene sus archivos propios. Si un track necesita una función de otro track, ese otro track debe haber terminado antes.
8. **Merge antes de siguiente etapa:** Antes de iniciar una etapa, todos los tracks de la etapa anterior deben estar mergeados a la rama base.
9. **Neon DB:** Toda conexión a PostgreSQL usa `gcloud Secret Manager` (`DB_PASSWORD`, proyecto `famspi-sbox`). Nunca `.env` local en producción.
