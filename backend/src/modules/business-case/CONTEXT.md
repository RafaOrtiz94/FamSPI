# CONTEXT.md — business-case

## 1. Descripción
Módulo de Business Case comercial. Gestiona la evaluación económica y operacional de propuestas de instalación de equipos para clientes. Incluye: catálogo de equipos, determinaciones (pruebas de laboratorio), cálculos de ROI, generación de hojas Google Sheets / Excel / PDF, observabilidad, feature flags, state machine y SLA.

Controller: `businessCase.controller.js` (~5700 líneas). Service principal: `businessCase.service.js`.

## 2. Roles

### businessCaseRoles (ver/participar en BC)
```
comercial, asesor_comercial, analista_comercial, acp_comercial,
backoffice, backoffice_comercial,
jefe_comercial, jefe_de_comercial,
jefe_operaciones, operaciones,
jefe_tecnico, jefe_servicio, ing_servicio,
esp_app,
jefe_financiero, jefe_ti,
gerencia, gerencia_general
```

### investmentRoles (agregar ítems al carrito de inversiones)
```
comercial, asesor_comercial, analista_comercial, acp_comercial,
backoffice, backoffice_comercial,
jefe_comercial, jefe_de_comercial, jefe_operaciones,
jefe_tecnico, jefe_servicio, ing_servicio,
jefe_financiero, jefe_ti,
gerencia, gerencia_general
```

### investmentValuesRoles (ver/guardar valores de inversión)
```
jefe_operaciones, jefe_de_operaciones, jefe_financiero,
gerencia, gerencia_general, jefe_comercial
```

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
| POST | `/` | `create` | comercial, asesor_comercial, analista_comercial, acp_comercial, jefe_comercial, jefe_de_comercial, backoffice, backoffice_comercial |
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
| POST | `/:id/determinations/request-unlock-subsection` | `requestDeterminationsSubsectionUnlock` | businessCaseRoles |
| POST | `/:id/determinations/resolve-unlock-subsection` | `resolveDeterminationsSubsectionUnlock` | jefe_comercial, jefe_de_comercial |
| POST | `/:id/determinations/reopen-commercial` | `reopenDeterminationsCommercial` | jefe_comercial, jefe_de_comercial |
| POST | `/:id/determinations/parse-quantities-file` | `parseDeterminationsQuantitiesFile` | backoffice_comercial, jefe_comercial, jefe_de_comercial (multipart) |
| POST | `/:id/determinations/inspection-request` | `requestEnvironmentInspection` | businessCaseRoles |
| POST | `/:id/determinations` | `addDetermination` | businessCaseRoles + validateDeterminationEquipment + validateEquipmentCapacity |
| PUT | `/:id/determinations/:detId` | `updateDetermination` | businessCaseRoles + validateDeterminationEquipment + validateEquipmentCapacity |
| DELETE | `/:id/determinations/:detId` | `removeDetermination` | businessCaseRoles |

### Cálculos y Exportación
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
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
| POST | `/:id/feasibility-decision` | `submitFeasibilityDecision` | acp_comercial, jefe_comercial, jefe_de_comercial, gerencia, gerencia_general |
| POST | `/:id/feasibility/appeal` | `requestFeasibilityAppeal` | comercial, asesor_comercial, analista_comercial |
| POST | `/:id/feasibility/appeal/resolve` | `resolveFeasibilityAppeal` | jefe_comercial, jefe_de_comercial, gerencia, gerencia_general |

### UI Guidance y Ownership
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/ui-guidance` | `getUIGuidance` | businessCaseRoles |
| GET | `/:id/ownership` | `getDataOwnership` | businessCaseRoles |
| POST | `/:id/ownership/complete` | `recordSectionCompletion` | businessCaseRoles |

### Secciones (Bloqueo)
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| POST | `/:id/sections/:section/lock` | `lockSection` | acp_comercial, backoffice, backoffice_comercial, jefe_comercial, jefe_de_comercial |
| POST | `/:id/sections/:section/unlock` | `unlockSection` | acp_comercial, backoffice, backoffice_comercial, jefe_comercial, jefe_de_comercial |

### Preflow
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| POST | `/:id/preflow/reopen-request` | `requestPreflowReopen` | businessCaseRoles |
| POST | `/:id/preflow/reopen-decision` | `resolvePreflowReopen` | jefe_comercial, jefe_de_comercial, gerencia, gerencia_general |

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
| POST | `/:id/investments/selections/request-increase` | `requestInvestmentQuantityIncrease` | investmentRoles |
| POST | `/:id/investments/confirm-cart` | `confirmInvestmentCart` | investmentRoles |
| GET | `/:id/investments/values` | `getInvestmentValues` | investmentValuesRoles |
| POST | `/:id/investments/values` | `saveInvestmentValues` | investmentValuesRoles |

### Consumibles
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/consumption-items` | `getConsumptionItems` | businessCaseRoles |
| PUT | `/:id/consumption-items` | `saveConsumptionItems` | businessCaseRoles |
| PATCH | `/:id/consumption-items/:itemKey` | `patchConsumptionItem` | businessCaseRoles |

### Dispatch Workspace
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/dispatch-workspace` | `getDispatchWorkspace` | businessCaseRoles |
| PUT | `/:id/dispatch-workspace/commercial-plan` | `saveCommercialDispatchPlan` | acp_comercial, jefe_comercial, jefe_de_comercial, gerencia, gerencia_general |
| PUT | `/:id/dispatch-workspace/operations-control` | `saveOperationsDispatchControl` | acp_comercial, jefe_comercial, jefe_de_comercial, jefe_operaciones, operaciones, gerencia, gerencia_general |

### Formulario Manual BC (secciones operacionales)
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/:id/complete` | `getComplete` | businessCaseRoles |
| POST | `/:id/lab-environment` | `saveLabEnvironment` | businessCaseRoles |
| GET | `/:id/lab-environment` | `getLabEnvironment` | businessCaseRoles |
| POST | `/:id/equipment-details` | `saveEquipmentDetails` | businessCaseRoles |
| GET | `/:id/equipment-details` | `getEquipmentDetails` | businessCaseRoles |
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
| `businessCaseSheetVersioning.helper.js` | — | Versionado de documentos generados |
| `businessCaseDriveFolder.service.js` | — | Carpeta Google Drive por BC |
| `pdfGenerator.service.js` | — | Export PDF |
| `excelExporter.service.js` | — | Export Excel (fallback) |
| `businessCaseScoring.service.js` | — | Scoring de viabilidad |
| `calculationEngine.service.js` | — | Motor de cálculo de ROI |
| `businessCaseCalculator.service.js` | — | Cálculos económicos |
| `deliveryCeiling.service.js` | — | Topes de entrega |
| `equipmentCompatibility.service.js` | — | Compatibilidad equipo principal/backup |
| `equipmentSelection.service.js` | — | Lógica de selección de equipo |
| `determinations.service.js` | — | Servicio de determinaciones |
| `investments.service.js` | — | Carrito de inversiones |
| `bcRequirements.service.js` | — | Sección de requerimientos |
| `bcLabEnvironment.service.js` | — | Entorno de laboratorio |
| `bcEquipmentDetails.service.js` | — | Detalles de equipo operacional |
| `bcLisIntegration.service.js` | — | Integración LIS |
| `bcDeliveries.service.js` | — | Entregas comprometidas |
| `bcDispatchWorkspace.service.js` | — | Workspace de despacho |
| `businessCaseNotificationQueue.service.js` | — | Cola de notificaciones del BC |

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

---

## 9. Frontend asociado
- `/dashboard/business-case` → `BusinessCaseWorkspace`
- `/dashboard/comercial/business-case` → `BusinessCaseWorkspace`
- `/dashboard/business-case/workspace/:id` → `BusinessCaseWorkspace`
- `/dashboard/business-case/observabilidad` → `BusinessCaseObservabilityDashboard`

---

## 10. Middlewares especiales
- `validateDeterminationEquipment` — valida compatibilidad determinación-equipo (en `middlewares/businessCaseValidation`)
- `validateEquipmentCapacity` — valida capacidad del equipo
- `auditSection(section, accessType)` — registra acceso a sección inversiones en `businessCaseSectionAccessAudit.service`
- Observabilidad global: middleware en router que registra duración y status de cada API call

---

## 11. Riesgos y notas técnicas
- `businessCase.controller.js` (~5600 líneas) — el controller más grande del sistema; no editar sin entender el flujo completo
- `businessCase.service.js` (47KB) — lógica de negocio densa; cambios con cuidado
- `businessCaseSheetGeneration.service.js` (45KB) — dependencia fuerte con Google Sheets API; la generación es async (job)
- `businessCasePermissions.js` (21KB) — RBAC muy granular; verificar siempre contra este archivo antes de agregar roles a rutas
- `jefe_de_comercial` = mismo nivel que `jefe_comercial` en casi todas las rutas (ver comentarios NUEVO-07, NUEVO-08, NUEVO-09 en routes)
- `operaciones` (base) agregado a businessCaseRoles y dispatch-workspace (BUG-06/BUG-07)
- `ing_servicio`, `esp_app` = solo visualización en BC
- Inversiones tienen audit logging adicional (REQ-BC-12) via `businessCaseSectionAccessAudit.service`
- Tests en `__tests__/`: calculationEngine, exporters, consumptionVersionConflict (integration), preflow, businessCaseSheetGeneration (contract), deliveryCeiling, businessCaseDeterminationsGate
