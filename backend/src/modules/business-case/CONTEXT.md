# CONTEXT.md — business-case

## 1. Descripción
Módulo de Business Case comercial. Gestiona la evaluación económica y operacional de propuestas de instalación de equipos para clientes. Incluye: catálogo de equipos, determinaciones (pruebas de laboratorio), cálculos de ROI, generación de hojas Google Sheets / Excel / PDF, observabilidad, feature flags, state machine y SLA.

Controller: `businessCase.controller.js` (7005 líneas — creció desde las ~5700 documentadas antes; agregó oferta comercial, resumen de calidad, revisión/resultado de inspección ambiental y varias rutas de inversión). Service principal: `businessCase.service.js` (2090 líneas).

## 2. Roles

### businessCaseRoles (ver/participar en BC)
```
comercial, asesor_comercial, analista_comercial, acp_comercial,
backoffice, backoffice_comercial,
jefe_comercial,
jefe_operaciones, operaciones,
jefe_tecnico, jefe_servicio, ing_servicio,
esp_app,
jefe_financiero, jefe_ti,
jefe_logistica,          -- NUEVO: edita la lista de inversiones en paralelo (sin carrito)
gerencia, gerencia_general
```

### investmentRoles (agregar ítems al carrito de inversiones)
`investmentRoles = businessCaseRoles` (mismo array, por referencia) — ya NO es un
subconjunto propio como documentaba esta sección antes. Todos los participantes
del BC ven la lista de inversiones; quién puede *editarla en paralelo* (sin
carrito) lo filtra el controller vía `hasInvestmentEditRole` (`investmentEditAccess.js`,
extraído de `businessCase.controller.js` porque este último arrastra una cadena
de requires que rompe bajo Jest por un problema preexistente de `uuid`/ESM en
`equipmentPurchases.service.js` — ver `__tests__/investmentEditAccess.test.js`).
`INVESTMENT_EDIT_ROLES` (acp_comercial, jefe_comercial, jefe_operaciones,
jefe_servicio, jefe_logistica, jefe_ti) cubre el caso normal. Además, un
usuario puntual sin ninguno de esos roles puede recibir la misma capacidad vía
`extra_roles=["bc_investment_edit"]` en el JWT (mismo mecanismo que
`bc_quality_summary` abajo) — usado para alexandra.molina (jefe_financiero).
El frontend espeja esta misma lógica en `InvestmentsSection.jsx`
(`EDIT_ROLES` + `EDIT_EXTRA_ROLE`).

### bc_quality_summary (vista de solo-lectura del resumen del BC)
`GET /quality-summary` y `GET /:id/quality-summary/items` — roles
`jefe_calidad` + rol sintético `bc_quality_summary` (no es un grupo de
`ROLE_GROUPS`; se otorga a usuarios puntuales vía `extra_roles` en el JWT,
ver `migrations/276_users_extra_roles.sql`, ej. lorena.loaiza@fam-project.com).
Da acceso de solo lectura al resumen, no al workspace completo.

### investmentValuesRoles (ver/guardar valores de inversión)
```
jefe_operaciones, jefe_de_operaciones, jefe_financiero, jefe_ti,
gerencia, gerencia_general, jefe_comercial
```
`jefe_ti` es el único rol con acceso a **ambas** clases (`INVESTMENT_VALUES_OP_ROLES`
y `INVESTMENT_VALUES_FIN_ROLES` incluyen `jefe_ti`) — jefe_operaciones y
jefe_financiero solo editan la suya. Espejo en frontend: `OPERATIONAL_ROLES`/
`FINANCIAL_ROLES` en `InvestmentValuesUnifiedSection.jsx` y `roleSectionConfig.js#jefe_ti`
(sección `investment_values` agregada a `visible`/`canEdit`).

### adminRoles (operaciones de catálogo/admin)
```
admin, gerencia, jefe_tecnico, jefe_servicio
```

### determinationsCatalogWriteRoles
```
admin, gerencia, jefe_tecnico, jefe_servicio, comercial, acp_comercial
```

## 3. Endpoints

Prefijo: `/api/v1/business-case`

### Resumen de calidad (nuevo)
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/quality-summary` | `getQualitySummaryList` | jefe_calidad, bc_quality_summary |
| GET | `/:id/quality-summary/items` | `getQualitySummaryItems` | jefe_calidad, bc_quality_summary |

### Observabilidad
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| POST | `/observability/frontend-events` | `ingestFrontendObservabilityEvents` | businessCaseRoles |
| GET | `/observability/metrics` | `getObservabilityMetrics` | admin, administrador, gerencia, jefe_comercial, jefe_tecnico, gerencia_general |
| GET | `/observability/dashboard` | `getObservabilityDashboard` | admin, administrador, gerencia, gerencia_general, jefe_comercial, jefe_tecnico, jefe_operaciones |

### Feature Flags
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/feature-flags/autosave` | `getAutosaveFeatureFlags` | businessCaseRoles |
| PUT | `/feature-flags/autosave` | `upsertAutosaveFeatureFlags` | admin, administrador, gerencia, gerencia_general, jefe_comercial, jefe_tecnico, jefe_operaciones |

### CRUD Principal
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/` | `list` | businessCaseRoles |
| POST | `/` | `create` | comercial, asesor_comercial, analista_comercial, acp_comercial, jefe_comercial, backoffice, backoffice_comercial |
| GET | `/:id` | `getById` | businessCaseRoles |
| PUT | `/:id` | `update` | businessCaseRoles |
| DELETE | `/:id` | `remove` | gerencia, admin |

### Equipo
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| POST | `/:id/equipment` | `selectEquipment` | businessCaseRoles |

### Determinaciones
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/determinations` | `getDeterminations` | businessCaseRoles |
| GET | `/:id/determinations/stat-document` | `getDeterminationsGateInfo` | businessCaseRoles |
| POST | `/:id/determinations/stat-document` | `uploadDeterminationsStatDocument` | businessCaseRoles (multipart) |
| POST | `/:id/determinations/lock-subsection` | `lockDeterminationsSubsection` | businessCaseRoles |
| POST | `/:id/determinations/lock-all-technical-subsections` | `lockAllDeterminationsTechnicalSubsections` | businessCaseRoles |
| POST | `/:id/determinations/request-unlock-subsection` | `requestDeterminationsSubsectionUnlock` | businessCaseRoles |
| POST | `/:id/determinations/resolve-unlock-subsection` | `resolveDeterminationsSubsectionUnlock` | jefe_comercial |
| POST | `/:id/determinations/reopen-commercial` | `reopenDeterminationsCommercial` | jefe_comercial |
| POST | `/:id/determinations/renew-commercial-window` | `renewDeterminationsCommercialWindow` | jefe_comercial |
| POST | `/:id/determinations/parse-quantities-file` | `parseDeterminationsQuantitiesFile` | backoffice_comercial, jefe_comercial (multipart) |
| POST | `/:id/determinations/inspection-request` | `requestEnvironmentInspection` | businessCaseRoles (gate interno adicional: `INSPECTION_REQUEST_ROLES` = comercial/backoffice_comercial/backoffice, `businessCase.controller.js:228` — **distinto y más estricto** que `DETERMINATIONS_INSPECTION_REQUEST_ROLES` de `businessCaseDeterminationsGate.service.js:15` (comercial/jefe_comercial/acp_comercial/backoffice_comercial), que es lo que calcula `gateInfo.permissions.canRequestInspection` y lo que la UI usa para MOSTRAR el botón. Inconsistencia preexistente: `jefe_comercial`/`acp_comercial` ven el botón habilitado pero el endpoint podría rechazarlos con 403 — no se corrigió al extraer la UI al FAB, solo se preservó el comportamiento original) |
| POST | `/:id/inspection-request/review` | `reviewEnvironmentInspectionRequest` | businessCaseRoles (gate interno adicional: `INSPECTION_REVIEW_ROLES` = jefe_servicio/jefe_servicio_tecnico/jefe_tecnico) |
| POST | `/:id/inspection-request/result` | `registerEnvironmentInspectionResult` | businessCaseRoles |

> **UI de este flujo (2026-09):** la solicitud (crear + ver estado) ya NO vive en la pestaña Determinaciones del workspace — se extrajo al botón flotante `BusinessCaseToolsFab.jsx` (herramienta "Inspección de ambiente"), accesible desde cualquier pestaña. `DeterminationsSection.jsx` solo muestra un badge de solo lectura con el estado (`gateInfo.inspectionRequest.status`: ausente=pendiente, `approved`, `rejected`). El estado sigue viviendo embebido en `modern_bc_metadata.environment_inspection_request` (JSON, sin tabla propia) — sin cambios de backend. La revisión (`review`)/resultado (`result`) NO están en este FAB; viven en un workspace separado del módulo `servicio` (`InspectionRequestsWorkspace.jsx`), sin relación de código con el workspace comercial de BC.
| POST | `/:id/determinations` | `addDetermination` | businessCaseRoles + validateDeterminationEquipment + validateEquipmentCapacity |
| PUT | `/:id/determinations/:detId` | `updateDetermination` | businessCaseRoles + validateDeterminationEquipment + validateEquipmentCapacity |
| DELETE | `/:id/determinations/:detId` | `removeDetermination` | businessCaseRoles |

### Cálculos y Exportación
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/matrix-calculations/catalog` | `matrixBusinessCaseCalculation.controller#getCatalog` | jefe_ti / jefe_de_ti exclusivamente |
| POST | `/matrix-calculations/preview` | `matrixBusinessCaseCalculation.controller#preview` | jefe_ti / jefe_de_ti exclusivamente |
| GET | `/:id/pricing-lab/preview` | `businessCasePricingLab.controller#preview` | jefe_ti / jefe_de_ti exclusivamente |
| POST | `/:id/pricing-lab/preview` | `businessCasePricingLab.controller#preview` (lee Sheet en memoria y calcula) | jefe_ti / jefe_de_ti exclusivamente |
| GET | `/:id/calculations` | `getCalculations` | businessCaseRoles |
| POST | `/:id/recalculate` | `recalculate` | businessCaseRoles |
| GET | `/:id/export/pdf` | `exportPdf` | businessCaseRoles |
| GET | `/:id/export/excel` | `exportExcel` | businessCaseRoles |
| PUT | `/:id/economic-data` | `updateEconomicData` | businessCaseRoles |

### Hojas de Cálculo (Google Sheets)
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/sheets/preview` | `getSheetGenerationPreview` | businessCaseRoles |
| POST | `/:id/sheets/generate` | `enqueueSheetGeneration` | businessCaseRoles |
| GET | `/:id/sheets/fallback-excel` | `downloadFallbackExcel` | businessCaseRoles |
| GET | `/:id/sheets/document-versions` | `getDocumentVersionHistory` | businessCaseRoles |
| GET | `/:id/sheets/jobs/latest` | `getLatestSheetGenerationJobStatus` | businessCaseRoles |
| GET | `/:id/sheets/jobs/:jobId` | `getSheetGenerationJobStatus` | businessCaseRoles |
| GET | `/sheets/metrics` | `getSheetGenerationMetrics` | adminRoles |
| POST | `/sheets/clear-template-cache` | `clearSheetTemplateCache` | adminRoles |

### Viabilidad (Feasibility)
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| POST | `/:id/feasibility-decision` | `submitFeasibilityDecision` | acp_comercial, jefe_comercial, gerencia, gerencia_general |
| POST | `/:id/feasibility/appeal` | `requestFeasibilityAppeal` | comercial, asesor_comercial, analista_comercial |
| POST | `/:id/feasibility/appeal/resolve` | `resolveFeasibilityAppeal` | jefe_comercial, gerencia, gerencia_general |

### Oferta comercial (Offer Workspace — nuevo, `businessCaseOffer.service.js`)
Genera y versiona la oferta (PDF/Excel) a partir del template `formato oferta.xlsx`.

| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/offer-workspace` | `getOfferWorkspace` | comercial, asesor_comercial, analista_comercial, acp_comercial, jefe_comercial |
| POST | `/:id/offer-workspace/draft` | `createOfferDraft` | acp_comercial, jefe_comercial |
| POST | `/:id/offer-workspace/:offerId/publish` | `publishOfferVersion` | acp_comercial, jefe_comercial |
| POST | `/:id/offer-workspace/:offerId/regenerate` | `regenerateOfferVersion` | acp_comercial, jefe_comercial |
| POST | `/:id/offer-workspace/:offerId/sync-pricing` | `syncOfferPricingAndPdf` | acp_comercial, jefe_comercial |
| POST | `/:id/offer-workspace/:offerId/decision` | `decideOfferVersion` | comercial, asesor_comercial, analista_comercial |

### UI Guidance y Ownership
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/ui-guidance` | `getUIGuidance` | businessCaseRoles |
| GET | `/:id/ownership` | `getDataOwnership` | businessCaseRoles |
| POST | `/:id/ownership/complete` | `recordSectionCompletion` | businessCaseRoles |

### Secciones (Bloqueo)
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| POST | `/:id/sections/:section/lock` | `lockSection` | acp_comercial, backoffice, backoffice_comercial, jefe_comercial |
| POST | `/:id/sections/:section/unlock` | `unlockSection` | acp_comercial, backoffice, backoffice_comercial, jefe_comercial |

### Preflow
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| POST | `/:id/preflow/reopen-request` | `requestPreflowReopen` | businessCaseRoles |
| POST | `/:id/preflow/reopen-decision` | `resolvePreflowReopen` | jefe_comercial, gerencia, gerencia_general |

### Inversiones (audited — REQ-BC-12)
Todas las rutas de inversión registran auditoría vía `auditSection()`.

| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/investments` | `getInvestments` | businessCaseRoles (audit read) |
| POST | `/:id/investments` | `addInvestment` | businessCaseRoles (audit write) |
| PUT | `/:id/investments/:invId` | `updateInvestment` | businessCaseRoles (audit write) |
| DELETE | `/:id/investments/:invId` | `deleteInvestment` | businessCaseRoles (audit write) |
| GET | `/:id/investments/catalog` | `getInvestmentCatalog` | investmentRoles |
| POST | `/:id/investments/catalog` | `createInvestmentCatalogItem` | investmentRoles |
| POST | `/:id/investments/selections` | `saveInvestmentSelection` | investmentRoles |
| POST | `/:id/investments/close-without-items` | `closeInvestmentsWithoutAdditionalItems` | investmentRoles ∪ investmentValuesRoles |
| GET | `/:id/investments/values` | `getInvestmentValues` | investmentValuesRoles |
| POST | `/:id/investments/values` | `saveInvestmentValues` | investmentValuesRoles |
| GET | `/:id/investments/values/assignees` | `getInvestmentQuotationAssignees` | investmentValuesRoles |
| POST | `/:id/investments/values/assignment` | `assignInvestmentQuotation` | investmentValuesRoles |
| POST | `/:id/investments/values/request-quotation` | `requestInvestmentQuotation` | investmentValuesRoles |

### Consumibles
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/consumption-items` | `getConsumptionItems` | businessCaseRoles |
| PUT | `/:id/consumption-items` | `saveConsumptionItems` | businessCaseRoles |
| PATCH | `/:id/consumption-items/:itemKey` | `patchConsumptionItem` | businessCaseRoles |
| POST | `/:id/consumption-items/sync-from-sheet` | `syncConsumptionFromSheet` | businessCaseRoles |

### Dispatch Workspace
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/dispatch-workspace` | `getDispatchWorkspace` | businessCaseRoles |
| PUT | `/:id/dispatch-workspace/commercial-plan` | `saveCommercialDispatchPlan` | acp_comercial, jefe_comercial, gerencia, gerencia_general |
| PUT | `/:id/dispatch-workspace/operations-control` | `saveOperationsDispatchControl` | acp_comercial, jefe_comercial, jefe_operaciones, operaciones, gerencia, gerencia_general |

### Formulario Manual BC (secciones operacionales)
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/complete` | `getComplete` | businessCaseRoles |
| POST | `/:id/lab-environment` | `saveLabEnvironment` | businessCaseRoles |
| GET | `/:id/lab-environment` | `getLabEnvironment` | businessCaseRoles |
| POST | `/:id/equipment-details-v2` | `saveEquipmentDetailsV2` | businessCaseRoles |
| POST | `/:id/lis-integration` | `saveLisIntegration` | businessCaseRoles |
| GET | `/:id/lis-integration` | `getLisIntegration` | businessCaseRoles |
| POST | `/:id/lis-integration/equipment-interfaces` | `addLisEquipmentInterface` | businessCaseRoles |
| GET | `/:id/lis-integration/equipment-interfaces` | `getLisEquipmentInterfaces` | businessCaseRoles |
| POST | `/:id/requirements` | `saveRequirements` | businessCaseRoles |
| GET | `/:id/requirements` | `getRequirements` | businessCaseRoles |
| POST | `/:id/deliveries` | `saveDeliveries` | businessCaseRoles |
| GET | `/:id/deliveries` | `getDeliveries` | businessCaseRoles |

### Orquestador (eliminado)
`BusinessCaseOrchestrator.service.js` y sus 9 rutas `/orchestrator/*` se
borraron: flujo BC alternativo sobre esquema legacy `bc_master`, sin caller
real en frontend. Solo sobrevive la ruta de abajo (nunca fue del orquestador,
solo compartía el prefijo de URL):

| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| POST | `/:id/orchestrator/emergency-transition` | `emergencyTransition` | gerencia, gerencia_general |

### Estado e Historial
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/state-history` | `getStateHistory` | businessCaseRoles |
| GET | `/:id/section-access-log` | `getSectionAccessLog` | admin, gerencia, gerencia_general, jefe_comercial |
| GET | `/:id/section-completeness` | `getSectionCompleteness` | businessCaseRoles |
| GET | `/:id/sla` | `getBcSlaStatus` | businessCaseRoles |
| GET | `/sla/at-risk` | `getSlaAtRisk` | admin, gerencia, gerencia_general, jefe_comercial, jefe_operaciones |

### Compatibilidad de Equipos
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/equipment/:equipmentId/compatibility/backups` | `getCompatibleBackupCandidates` | businessCaseRoles |
| GET | `/equipment/:primaryId/:backupId/compatibility/validate` | `validateEquipmentCompatibility` | businessCaseRoles |
| GET | `/compatibility/statistics` | `getCompatibilityStatistics` | adminRoles |

---

## 4. Sub-routers (rutas separadas)

### `/api/v1/equipment-catalog`
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/` | `list` | businessCaseRoles |
| GET | `/:id` | `getDetails` | businessCaseRoles |
| GET | `/:id/determinations` | `getDeterminations` | businessCaseRoles |
| GET | `/:id/consumables` | `getConsumables` | businessCaseRoles |
| POST | `/:id/consumables` | `createConsumable` | businessCaseRoles |
| PUT | `/:id/consumables/:consumableId` | `updateConsumable` | businessCaseRoles |
| POST | `/:id/determinations` | `createDetermination` | businessCaseRoles |
| POST | `/` | `create` | adminRoles |
| PUT | `/:id` | `update` | adminRoles |
| POST | `/:id/formula` | `updateFormula` | adminRoles |

### `/api/v1/determinations-catalog`
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/` | `list` | businessCaseRoles |
| GET | `/:id` | `getDetails` | businessCaseRoles |
| POST | `/` | `create` | determinationsCatalogWriteRoles |
| PUT | `/:id` | `update` | determinationsCatalogWriteRoles |
| DELETE | `/:id` | `remove` | determinationsCatalogWriteRoles |
| POST | `/:id/formula` | `updateFormula` | adminRoles |
| POST | `/formula/validate` | `validateFormula` | adminRoles |

### `/api/v1/calculation-templates`
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/` | `list` | businessCaseRoles |
| POST | `/` | `create` | adminRoles |
| PUT | `/:id` | `update` | adminRoles |
| DELETE | `/:id` | `remove` | adminRoles |
| POST | `/:id/apply` | `applyToItem` | adminRoles |

---

## 5. Flujo principal

1. Comercial crea BC (POST `/`) → estado inicial `pending_comercial`
2. Se selecciona equipo del catálogo (POST `/:id/equipment`)
3. Se agregan determinaciones (POST `/:id/determinations`) con validación compatibilidad+capacidad
4. Se sube stat-document (documento estadístico) si aplica
5. Se completan secciones operacionales: lab-environment, equipment-details, lis-integration, requirements, deliveries
6. ACP o jefe toma decisión de viabilidad (POST `/:id/feasibility-decision`) — el cálculo de ROI/factibilidad ocurre dentro de este mismo endpoint (`businessCase.service.js`), no hay paso separado
7. Inversiones y dispatch workspace se completan
8. Se genera hoja Google Sheets (POST `/:id/sheets/generate`) — job async, estado via `sheets/jobs/latest`
9. Se exporta PDF/Excel para presentación

### Reaperturas y apelaciones
- Preflow reopen: comercial solicita, jefe_comercial/gerencia resuelve
- Subsección determinaciones: cualquier rol solicita, jefe_comercial resuelve
- Apelación de factibilidad: comercial* solicita, jefe_comercial/gerencia resuelve

---

## 6. Validaciones y servicios de soporte

| Archivo | Tamaño | Función |
|---------|--------|---------|
| `businessCaseStateMachine.js` | 12KB | Transiciones de estado del BC |
| `businessCaseStateReadiness.js` | 18KB | Completitud por estado antes de transición |
| `businessCasePermissions.js` | 21KB | RBAC granular por sección |
| `businessCaseDataOwnership.js` | — | Ownership de datos por rol |
| `businessCaseDeterminationsGate.service.js` | 11KB | Gate de determinaciones (stat-document, lock/unlock) |
| `businessCaseIdempotency.service.js` | — | Protección contra escrituras duplicadas |
| `businessCaseObservability.service.js` | — | Métricas de API y frontend events |
| `businessCaseFeatureFlags.service.js` | — | Feature flags configurables (autosave) |
| `businessCaseSectionAccessAudit.service.js` | — | Auditoría de acceso a sección inversiones (REQ-BC-12) |
| `businessCaseSla.service.js` | — | Cálculo de SLA por BC |
| `businessCasePreflow.service.js` | — | Lógica de preflow y reapertura |
| `businessCaseIntegration.service.js` | — | Integración con otros módulos |
| `businessCaseSheetGeneration.service.js` | 45KB | Generación hojas Google Sheets (job async) |
| `businessCaseSheetGeneration.controller.js` | 193 líneas | Controller separado (no `businessCase.controller.js`) para las rutas `/:id/sheets/*` |
| `businessCaseSheetGeneration.contract.js` | 143 líneas | Contrato/esquema del job de generación de hoja (usado también en tests) |
| `businessCaseSheetSyncLocal.service.js` | 2016 líneas | Motor local de mapeo/sync de plantillas de hoja (reemplaza lectura remota en varios flujos); genera los payloads que usan sheet-generation y offer |
| `businessCaseSheetEquipment.helper.js` | 25 líneas | Helper pequeño de resolución de equipo para hojas |
| `businessCaseSheetVersioning.helper.js` | — | Versionado de documentos generados |
| `businessCaseDriveFolder.service.js` | — | Carpeta Google Drive por BC |
| `pdfGenerator.service.js` | — | Export PDF |
| `excelExporter.service.js` | — | Export Excel (fallback) |
| `businessCaseScoring.service.js` | — | Scoring de viabilidad |
| `calculationEngine.service.js` | — | Motor de cálculo de ROI |
| `businessCaseCalculator.service.js` | — | Cálculos económicos |
| `equipmentCompatibility.service.js` | — | Compatibilidad equipo principal/backup |
| `equipmentSelection.service.js` | — | Lógica de selección de equipo |
| `determinations.service.js` | — | Servicio de determinaciones |
| `investments.service.js` | — | Carrito de inversiones |
| `bcRequirements.service.js` | — | Sección de requerimientos |
| `bcLabEnvironment.service.js` | — | Entorno de laboratorio |
| `bcLisIntegration.service.js` | — | Integración LIS |
| `bcDeliveries.service.js` | — | Entregas comprometidas |
| `bcDispatchWorkspace.service.js` | — | Workspace de despacho |
| `businessCaseNotificationQueue.service.js` | — | Cola de notificaciones del BC |
| `businessCaseOffer.service.js` | 3508 líneas | **NUEVO — no documentado antes.** Genera y versiona la Oferta comercial (Excel/PDF) desde `Mapeador_Sheets/formato oferta.xlsx`; soporta layouts split/combinado de calibrador+control (equipo cobas Pure `<303>` hardcodeado como excepción, id 9); resuelve el flujo de oferta privada (`acp_availability_confirmed`, `price_improvement_requested`) descrito en `businessCasePurchaseHandoff.service.js`. Corrige un bug real de path: antes apuntaba a `docs/validation/assets/` (excluido por `.dockerignore`), por eso el logo/marca de agua del PDF nunca se renderizaba en producción — ahora usa `backend/src/assets/`. |
| `businessCaseWorkflowSla.service.js` | 1045 líneas | **NUEVO — no documentado antes.** SLA de flujo de trabajo (distinto de `businessCaseSla.service.js`, que es el SLA general del BC); calcula tiempos por etapa del workflow. |
| `businessCasePurchaseHandoff.service.js` | 259 líneas | **NUEVO — no documentado antes.** Handoff entre Business Case y compra privada (`private-purchases`); referenciado desde `businessCaseOffer.service.js`. |

---

## 7. Base de datos

Ver `README_TABLE_STRUCTURE.md` para estructura completa.

**Tabla principal**: `equipment_purchase_requests` (discriminador: `uses_modern_system = true`, `bc_system_type = 'modern'`)

**Vistas** (usar estas en el código):
- `v_business_cases` — solo BCs modernos
- `v_business_cases_legacy` — solo BCs legacy (Google Sheets)
- `v_business_cases_complete` — todos con detalles

**Tablas relacionadas**:
- `bc_equipment_selection` — equipo seleccionado
- `bc_determinations` — determinaciones del BC
- `bc_calculations` — resultados de cálculo
- `bc_audit_log` — log de auditoría
- `equipment_purchase_bc_items` — ítems del BC

**Trigger**: `validate_bc_system_consistency` — previene BCs modernos con `bc_spreadsheet_id` no NULL.

---

## 8. Relaciones con otros módulos
- `private-purchases`: BC puede iniciarse desde una compra privada
- `clients`: `client_id` referencia tabla clients
- `notifications`: cola de notificaciones via `businessCaseNotificationQueue.service.js`
- `files` + Google Drive: carpeta por BC en `businessCaseDriveFolder.service.js`
- Integración LIS: `bcLisIntegration.service.js`
- **`bc-availability` (NUEVO, 2026-09):** el botón flotante `BusinessCaseToolsFab.jsx` del workspace crea solicitudes de disponibilidad de equipo vía `POST /api/v1/bc-availability` (módulo `backend/src/modules/bc-availability/`, tablas `bc_availability_requests` y `bc_availability_supplier_queries`, migración 298). `acp_comercial` las trabaja desde el widget "Solicitudes de Disponibilidad" en Solicitudes: consulta a varios proveedores por correo, registra cada respuesta y cierra con un resultado. No genera ningún formulario F.ST ni solicitud genérica en `requests`.

---

## 9. Frontend asociado
- `/dashboard/business-case` → `BusinessCaseWorkspace`
- `/dashboard/comercial/business-case` → `BusinessCaseWorkspace`
- `/dashboard/business-case/workspace` → `BusinessCaseWorkspace` (sin `:id`, faltaba documentar)
- `/dashboard/business-case/workspace/:id` → `BusinessCaseWorkspace`
- `/dashboard/business-case/observabilidad` → `BusinessCaseObservabilityDashboard`
- `/dashboard/business-case/resumen` → `BusinessCaseQualitySummary` (NUEVO — página de solo lectura para `jefe_calidad`/`bc_quality_summary`, faltaba documentar)

API client: `spi_front/src/core/api/businessCaseApi.js` (672 líneas) — todas las funciones de fetch del módulo viven aquí, no en `spi_front/src/modules/comercial/api/` (esa carpeta solo tiene `privatePurchasesApi.js` y `opportunitiesApi.js`, de otros módulos comerciales).

**`BusinessCaseToolsFab.jsx`** (NUEVO, 2026-09, `components/workspace/`) — botón flotante tipo speed-dial montado en `BusinessCaseWorkspace.jsx` (hermano de `WorkspaceContent`, dentro de `BusinessCaseWorkspaceProviders`, persiste en todas las pestañas). Agrupa 2 herramientas:
- **Disponibilidad de equipo**: consulta inventario (`getEquipmentAssets`, reuso de la misma función que `EquipmentSection.jsx`) y solicita disponibilidad a `acp_comercial` (crea una solicitud en `bc_availability_requests`, módulo `bc-availability`; no genera formulario F.ST).
- **Inspección de ambiente**: crear/ver estado de la solicitud (extraído de `DeterminationsSection.jsx`, ver nota en sección 3).

Posición: columna `right-4`, por encima de `NotificationBell.jsx` y `AttendanceWidget.jsx` (ambos ya ocupan esa columna más abajo, `z-90`/`z-49` respectivamente) — cualquier FAB nuevo que se agregue a esta columna debe verificar esos dos primero para no quedar tapado.

---

## 10. Middlewares especiales
- `validateDeterminationEquipment` — valida compatibilidad determinación-equipo (en `middlewares/businessCaseValidation`)
- `validateEquipmentCapacity` — valida capacidad del equipo
- `auditSection(section, accessType)` — registra acceso a sección inversiones en `businessCaseSectionAccessAudit.service`
- Observabilidad global: middleware en router que registra duración y status de cada API call

---

## 11. Riesgos y notas técnicas
- `businessCase.controller.js` (7005 líneas) — el controller más grande del sistema; no editar sin entender el flujo completo
- `businessCase.service.js` (2090 líneas / 47KB) — lógica de negocio densa; cambios con cuidado
- `businessCaseOffer.service.js` (3508 líneas) es ahora el segundo archivo más grande del módulo y no estaba documentado en ninguna versión previa de este CONTEXT.md
- Frontend: `spi_front/src/modules/comercial/components/workspace/sections/InvestmentValuesSection.jsx` está huérfano — cero importadores reales (verificado con grep); fue reemplazado por `InvestmentValuesUnifiedSection.jsx`, que sí está cableado en `SectionContent.jsx`. No editar el primero esperando que afecte el workspace.
- `businessCaseSheetGeneration.service.js` (45KB) — dependencia fuerte con Google Sheets API; la generación es async (job)
- `businessCasePermissions.js` (21KB) — RBAC muy granular; verificar siempre contra este archivo antes de agregar roles a rutas
- `operaciones` (base) agregado a businessCaseRoles y dispatch-workspace (BUG-06/BUG-07)
- `ing_servicio`, `esp_app` = solo visualización en BC
- Inversiones tienen audit logging adicional (REQ-BC-12) via `businessCaseSectionAccessAudit.service`
- Tests en `__tests__/`: calculationEngine, exporters, consumptionVersionConflict (integration), preflow, businessCaseSheetGeneration (contract), businessCaseDeterminationsGate
- `deliveryCeiling.service.js` fue eliminado (código muerto, sin callers reales en producción); ver skill `modulo-techos-entrega`
- El módulo `requests` (fuera de `business-case`) tiene su propio catálogo `request_types` con labels tipo "F.ST-XX" que NO tienen relación de código con los endpoints `/determinations/inspection-request` de este módulo, a pesar de compartir el nombre "inspección de ambiente" en el título de `F.ST-20` — son dos sistemas distintos (uno genérico de solicitudes con AJV, otro embebido en `modern_bc_metadata` del BC). No asumir que tocar uno afecta al otro.
- El `RequestsListModal`/`RequestStatWidget` compartido (`spi_front/src/modules/shared/solicitudes/`) filtra por defecto `mine: true` — cualquier widget nuevo en una bandeja de "aprobador" (no del propio creador de la solicitud) debe pasar `initialFilters: { mine: false }` explícito o no verá ninguna solicitud.

---

## 12. Motor versionado de matrices de costos (2026-09)

El motor declarativo de matrices vive en `matrixCalculationEngine.service.js`. No ejecuta
fórmulas arbitrarias: solo acepta paquetes curados, versionados y asociados al SHA-256 del
libro revisado. La selección es exacta por `family`, `equipment`, `modality` y `version`; no
existe fallback entre equipos o modalidades.

Endpoints autenticados exclusivamente para `jefe_ti`/`jefe_de_ti`:

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/matrix-calculations/catalog` | Lista paquetes activos, alcances en cuarentena y cobertura de las 29 hojas auditadas |
| POST | `/matrix-calculations/preview` | Ejecuta un paquete exacto sin persistir ni modificar el recálculo productivo existente |

La modalidad debe enviarse explícitamente porque el modelo actual de Business Case no
almacena `determinacion`, `prueba_efectiva` o `todo_comprado`. Por esa razón este motor no
está conectado automáticamente a `/:id/recalculate`: inferirla cambiaría el resultado sin
evidencia de negocio.

### Laboratorio paralelo de precios (en construcción)

`pricing_lab` es una sección aislada del workspace visible únicamente para
`jefe_ti`/`jefe_de_ti`; el control se repite en frontend y backend y no usa el bypass de
super-rol de `requireRole`. El `GET` calcula con cantidades ya almacenadas. El `POST`
lee el Sheet y superpone sus cantidades únicamente en memoria para esa respuesta. En
ambos casos `offerWriteEnabled=false`: no se actualizan consumos, versiones ni precios
de la oferta oficial.

La integración conserva las fuentes verificadas del mapeador: reactivos toman demanda de
`DET/AÑO PROCESO`; controles, calibradores y materiales toman `PRODUCTO CALCULADO` y, en
las pestañas que carecen de esa columna, el mapeador usa `PRODUCTO A ENTREGAR/ENVIAR` como
fallback. Todo termina normalizado en `bc_consumption_items.annual_qty`; la columna de
despacho `planned_qty` se mantiene separada y se expone para comparación. No se sustituyen
cantidades entre columnas por inferencia.

Cobertura verificada:

- Hematología: 13 alcances activos y 14 en cuarentena con evidencia de la celda fuente.
- Inmuno-Química: hojas de cálculo en cuarentena hasta definir la semántica de divisores en
  cero y corregir referencias rotas/externas del libro fuente.
- Catálogo de auditoría: `matrixCalculationCoverage.catalog.js`.

### Modelo predictivo híbrido del laboratorio (modo sombra)

El laboratorio incorpora `businessCasePredictiveLab.service.js` sin conectarlo a la
oferta oficial. El modelo combina tres estimadores históricos (mediana, proporción
respecto de la demanda total de reactivos y vecino más cercano en espacio logarítmico)
con la fórmula auditada del paquete. La fórmula siempre tiene prioridad y ninguna
sugerencia es publicable (`offerWriteEnabled=false`, `publishable=false`).

El umbral obligatorio de exactitud es **99,9 %**. Se define como
`max(0, 100 * (1 - WAPE))` sobre cantidades positivas y se valida dejando fuera un
Business Case completo en cada iteración. Los rangos P50/P80/P95 son cuantiles
empíricos, no garantías probabilísticas.

`bc_consumption_items.planned_qty` se usa solo como proxy para producir sugerencias.
No se acepta como verdad operacional. La habilitación futura exige al menos cinco
Business Cases comparables con despacho completo y valida contra
`bc_dispatch_items.ops_dispatched_qty`. Mientras esos resultados no existan o el
backtest no alcance 99,9 %, `automaticCorrectionEligible=false` y la interfaz muestra
el bloqueo. El servicio hace consultas de solo lectura y no entrena ni persiste un
modelo en la base de datos.

La versión `hybrid-pro-ultra-0.2.0` corrige la población histórica: solo acepta
consumos cuyo equipo continúa presente en `bc_equipment_selection`, excluye
`DRAFT_INICIAL` y descarta muestras sin demanda reactiva positiva. Para evitar
una regla universal que los datos no respaldan, usa un campeón verificable por
familia: calibradores conservan la cantidad del vecino más próximo en el vector
logarítmico de reactivos; controles y materiales escalan ese vecino por la
relación de demanda reactiva total. El backtest evalúa solo calibradores,
controles y materiales; los reactivos quedan como entradas del predictor y como
salidas únicamente cuando existe una fórmula auditada.

Las sugerencias con uno o más pares se muestran exclusivamente para revisión.
La respuesta informa métricas proxy, métricas operacionales, número de pares,
método por producto y estado de soporte. Esto no relaja la puerta automática:
siguen siendo obligatorios cinco casos con despacho completo y 99,9 % de
exactitud operacional.

### Contexto verificable por producto (v0.3)

El laboratorio predictivo incorpora un contexto independiente para cada
producto. La identidad se construye con `catalog_consumables.id`, código de
proveedor, tipo y compatibilidad real de `catalog_equipment_consumables`; los
valores DET/KIT y estabilidad solo se incorporan cuando provienen de un paquete
de cálculo auditado o de un campo de catálogo poblado. También se expone el
perfil de reactivos observado en Business Cases productivos donde el producto
tuvo cantidad positiva.

Los campos faltantes se reportan explícitamente. Un código de proveedor que
identifica más de un producto compatible con el mismo equipo se marca como
`ambiguous_supplier_code` y no recibe sugerencia histórica. El contexto mejora
la trazabilidad y evita mezclar productos, pero no eleva por sí solo la
exactitud operacional: rendimiento, estabilidad y vínculos producto-
determinación continúan incompletos en el catálogo productivo y deben cargarse
con evidencia antes de usarlos como variables del modelo.

La versión `hybrid-pro-ultra-0.4.0` separa la identidad interna por tipo y
código para impedir que un reactivo, calibrador, control o material con el mismo
identificador sobrescriba a otro. Para controles y materiales, la distancia y
el escalamiento usan únicamente el perfil de reactivos observado junto al
producto en los pares de entrenamiento; controles redondean al entero más
cercano y materiales hacia arriba. Estas decisiones fueron seleccionadas con
validación leave-one-Business-Case-out en producción. No modifican la puerta de
99,9 % ni habilitan escrituras automáticas.

### Evidencia primaria de fabricante (v0.5)

La versión `hybrid-pro-ultra-0.5.0` incorpora una capa local, versionada y de
solo lectura con evidencia primaria de Roche y Sysmex. Cada evidencia conserva
fabricante, familia de producto, hechos verificables, URL, versión documental
cuando está disponible y fecha de consulta. Esta capa enriquece
`productKnowledge.manufacturerEvidence`; no consulta Internet durante una
solicitud, no reemplaza por sí sola las fórmulas auditadas y no habilita
escrituras en la oferta.

Para XN Check, el período oficial de uso de 56 días respalda el valor de
estabilidad del paquete de cálculo. Para CELLCLEAN AUTO, la documentación
oficial establece limpieza semanal y el catálogo interno presenta 20 unidades
por paquete: la cobertura aritmética resultante es 140 días, frente a 150 días
en el Sheet. El sistema conserva la fórmula actual y marca la comparación como
`requires_review`; no corrige la diferencia sin validación del responsable de
producto. Las fichas Roche registradas aportan asociaciones, presentaciones y
estabilidades de C.f.a.s., C.f.a.s. Lipids, C.f.a.s. HbA1c y PreciControl, pero
no se convierten en cantidades automáticas mientras falten la política local de
QC y los consumos por evento.

### Ciclo visible de aprendizaje (v0.6)

La versión `hybrid-pro-ultra-0.6.0` compara, sin escribir la oferta, cada
cantidad sugerida con `bc_consumption_items.planned_qty` del Business Case
actual. Cada producto queda clasificado como `exact_match`, `different`,
`awaiting_registered_quantity` o `prediction_unavailable`, y la respuesta
incluye un resumen de coincidencia exacta del caso. Esta comparación es
exclusivamente un proxy de planificación: la validación oficial continúa
dependiendo de `bc_dispatch_items.ops_dispatched_qty` en despachos completos.

Todos los registros de consumo permanecen disponibles como observaciones. Un
caso solo entra al histórico de sugerencias después de salir de
`DRAFT_INICIAL`, conserva su equipo seleccionado y tiene demanda reactiva
positiva. El Business Case consultado se excluye siempre de sus propios pares,
evitando fuga de información. La UI de `pricing_lab`, todavía restringida a
Jefe TI, muestra la leyenda de ajuste, la cantidad sugerida, la registrada y
el estado de coincidencia; no aplica cambios automáticos.

### Motor por reglas — Fase 1: ficha técnica versionada (2026-09-29)

Dirección nueva: calibradores, controles, materiales e ISE se calcularán con
**fórmulas por reglas para la duración del proceso**
(`bc_requirements.projected_deadline_months`), no anual y no por histórico. La
meta de 99,9 % se mide contra casos validados por experto, no contra lo que se
registró en el Sheet. El modelo histórico anterior queda como comparación.

- `migrations/305_catalog_consumable_specs.sql`: tabla `catalog_consumable_specs`,
  una fila por **versión** de ficha (`valid_from`/`valid_to`, una sola abierta por
  código). Guarda presentación, estabilidad abierto/a bordo, uso único,
  intervalo de reemplazo, base de consumo y evidencia (documento, versión,
  fecha, URL). Se enlaza por `supplier_code` sin ceros a la izquierda; no tiene
  FK porque el mismo código aparece en varias filas de `catalog_consumables`.
- `system_specs` (JSONB) guarda los datos que cambian por analizador:
  estabilidad a bordo, eventos de calibración (cambio de lote o de pack),
  intervalos (`interval_days`, `onboard_pack_interval_days`,
  `same_lot_interval_days`, `onboard_kit_interval_days`), réplicas e intervalo
  de control. La clave `todos` aplica a todos los analizadores del documento.
  Son los valores por defecto que se mostrarán y podrán ajustarse en
  **Entorno Laboratorio**.
- `migrations/306_seed_catalog_consumable_specs.sql`: **todo el catálogo**
  (684 códigos: 393 reactivos, 105 calibradores, 85 controles, 101 materiales),
  sacado de documentos vigentes de Roche eLabDoc (Method Sheet o catálogo de
  accesorios). Estados:
  - `verified` (27): piloto `cobas Pure <303>`, revisado a mano.
  - `extracted` (458): extraído automáticamente, con evidencia textual en
    `parameters.evidence`; falta revisión humana.
  - `partial` (131): hay documento pero falta presentación, estabilidad o
    frecuencia de calibración.
  - `requires_review` (5).
  - `pending` (63): sin documento del fabricante.
- `parameters.linked_products`: calibradores, controles y materiales que lista
  el documento de cada reactivo (366 productos). Así se sabe qué calibrador y
  qué control consume cada reactivo.
- `parameters.onboard_aliquot_single_use` (Elecsys CalSet/PreciControl): cada
  alícuota puesta en el analizador se usa una vez, pero el frasco sigue vigente
  a 2-8 °C según `stability_open_days`. `single_use` se reserva para envases que
  se descartan al abrir (ampollas ISE Standard, pruebas POC).
- El mismo 306 completa `catalog_consumables.supplier_code` (solo donde hoy es
  NULL) en 38 filas duplicadas del catálogo que no tenían código. El código se
  resolvió por coincidencia exacta de nombre en eLabDoc. Hay 32 productos del
  catálogo sin código que siguen sin resolver: tienen dos códigos candidatos o
  el nombre no coincide.
- **Regenerar o actualizar las fichas:** `backend/scripts/consumable-specs/run.js`.
  El parser está en `consumableSpecsExtractor.js`, con tests. Las fichas
  revisadas a mano del piloto están en `curatedCobasPure303.json`.
  - `--mode=seed` produce la carga completa.
  - `--mode=update` vuelve a buscar cada código en eLabDoc y, cuando Roche
    publicó otra versión del documento (cambio de presentación, estabilidad,
    etc.), genera SQL que cierra la versión vigente (`valid_to`) e inserta la
    nueva.
  - No escribe en la base: produce un `.sql` para aplicar a mano.
  - Requiere `pdftotext`.
- **Entorno Laboratorio → "Parámetros por producto"**
  (`LabProductParametersCard.jsx`):
  - Endpoints `GET/PUT /:id/lab-environment/product-parameters` en
    `bcLabProductParameters.service.js`. Cruza los productos del BC con cantidad
    con la ficha vigente y elige el bloque del analizador del BC: primero el
    específico, luego `todos`, luego `cobas c systems`.
  - Muestra calibración, control, estabilidad y los calibradores/controles
    vinculados, y avisa si no están en el BC.
  - El laboratorio puede ajustar el intervalo de recalibración, el intervalo de
    control, la estabilidad a bordo y la estabilidad abierto. Los ajustes se
    guardan en `bc_lab_product_parameters` (migración 307) solo si difieren del
    fabricante.
  - El valor `effective` (ajuste ?? fabricante) es la entrada que debe leer el
    motor de cálculo.
  - Guardar exige que la sección `lab` sea editable (`assertSectionEditable`).
- Hallazgos pendientes de Comercial/Aplicaciones: el ISE Reference Electrolyte
  2 x 2000 mL (8392013190) es para cobas ISE neo/pro ISE, no para c 303 (a este
  le corresponde 10820652216, 1 x 500 mL). Los electrodos 10825441001,
  10825468001, 3246353001 y 3149501001 no tienen ficha para c 303.
- Aún falta el lado del reactivo: frecuencia de calibración y volumen de
  calibrador/control por prueba en c 303. Sale de los Method Sheets de cada
  reactivo y es requisito para la Fase 2 (motor de simulación).
