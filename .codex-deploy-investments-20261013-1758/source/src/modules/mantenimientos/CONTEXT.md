# CONTEXT.md — mantenimientos

## 1. Descripción
Módulo de mantenimientos preventivos y correctivos de equipos. Permite crear fichas de mantenimiento con firma, gestionar planes anuales preventivos (ST-01-02), aprobar mantenimientos, exportar PDFs y gestionar el ciclo de kits de mantenimiento.

## 2. Endpoints

- **POST /api/v1/mantenimientos/** — `createMantenimiento` — verifyToken, requireRole(`tecnico`), multer.fields(firma_responsable, firma_receptor, evidencias)
- **GET /api/v1/mantenimientos/** — `listMantenimientos` — verifyToken — todos autenticados
- **GET /api/v1/mantenimientos/preventive/annual-plans** — `listPreventiveAnnualPlans` — verifyToken, requireRole(preventiveReadRoles)
- **POST /api/v1/mantenimientos/preventive/annual-plans** — `createPreventiveAnnualPlan` — verifyToken, requireRole(preventivePlanAdminRoles)
- **GET /api/v1/mantenimientos/preventive/annual-plans/:planId** — `getPreventiveAnnualPlanDetail`
- **POST /api/v1/mantenimientos/preventive/annual-plans/:planId/publish** — `publishPreventiveAnnualPlan`
- **POST /api/v1/mantenimientos/preventive/annual-plans/:planId/rebaseline** — `rebaselinePreventiveAnnualPlan`
- **POST /api/v1/mantenimientos/preventive/annual-plans/:planId/fst16** — `issueFst16`
- **POST /api/v1/mantenimientos/preventive/annual-plans/:planId/monthly-report** — `sendPreventiveMonthlyReport`
- **POST /api/v1/mantenimientos/preventive/plan-items/:itemId/fst17** — `issueFst17`
- **POST /api/v1/mantenimientos/preventive/plan-items/:itemId/offer** — `registerPreventiveOffer`
- **POST /api/v1/mantenimientos/preventive/plan-items/:itemId/offer/decision** — `decidePreventiveOffer`
- **POST /api/v1/mantenimientos/preventive/plan-items/:itemId/reprogramming** — `registerReprogrammingNotice`
- **POST /api/v1/mantenimientos/preventive/plan-items/:itemId/coordination** — `registerPreventiveCoordination`
- **POST /api/v1/mantenimientos/preventive/plan-items/:itemId/work-order** — `registerPreventiveWorkOrder`
- **POST /api/v1/mantenimientos/preventive/plan-items/:itemId/kits** — `requestPreventiveKit`
- **POST /api/v1/mantenimientos/preventive/kits/:kitId/warehouse-exit** — `registerKitWarehouseExit`
- **POST /api/v1/mantenimientos/preventive/plan-items/:itemId/close** — `closePreventiveExecution`
- **GET /api/v1/mantenimientos/preventive/compliance** — `getPreventiveComplianceDashboard`
- **GET /api/v1/mantenimientos/preventive/capacity** — `getPreventiveCapacityDashboard`
- **GET /api/v1/mantenimientos/preventive/timeline** — `getPreventiveTimeline`
- **GET /api/v1/mantenimientos/preventive/history** — `getPreventiveHistory`
- **GET /api/v1/mantenimientos/:id** — `getDetail` — verifyToken
- **POST /api/v1/mantenimientos/:id/sign** — `sign` — verifyToken, requireRole(`gerencia`, `tecnico`)
- **POST /api/v1/mantenimientos/:id/sign-advanced** — `signAdvanced` — verifyToken, requireRole(`gerencia`, `tecnico`)
- **POST /api/v1/mantenimientos/:id/approve** — `approve` — verifyToken, requireRole(`gerencia`)
- **POST /api/v1/mantenimientos/:id/export** — `exportPdf` — verifyToken, requireRole(`tecnico`, `gerencia`)

preventiveReadRoles: `tecnico`, `servicio_tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `comercial`, `acp_comercial`, `jefe_comercial`, `logistica`, `jefe_logistica`, `gerencia`, `gerencia_general`
preventivePlanAdminRoles: `jefe_tecnico`, `jefe_servicio_tecnico`, `jefe_comercial`, `gerencia`, `gerencia_general`

## 3. Flujo principal

1. Técnico crea ficha de mantenimiento con firma
2. Gerencia aprueba el mantenimiento
3. Para preventivos: jefe técnico crea plan anual y lo publica
4. Por cada ítem del plan: emite FST-17, registra coordinación y trabajo
5. Al completar: cierra la ejecución preventiva

## 4. Validaciones
- Solo técnico puede crear mantenimientos correctivos
- Plans anuales gestionados por jefes técnicos/comerciales/gerencia
- Archivos de firma: `diskStorage` en `/tmp/uploads`

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `servicio`: mantenimientos correctivos tienen vínculo con el módulo de servicio técnico
- `signature`: firma avanzada disponible
- `inventario`: equipos referenciados en mantenimientos
- FST-16 y FST-17 son documentos formatos específicos de servicio técnico

## 7. Frontend asociado
- `/mantenimientos` → `MantenimientosPage`
- `/dashboard/servicio-tecnico/mantenimientos` → `ServicioMantenimientos`

## 8. Riesgos detectados
- Archivos subidos a `/tmp/uploads` (diskStorage) — no en Drive/cloud, posible pérdida en reinicios
- `preventivePlanning.service.js` (80KB) — extremadamente grande

## 9. Notas técnicas
- `mantenimiento.scheduler.js` (5KB): scheduler periódico de alertas preventivas
- FST-16: plan anual preventivo / FST-17: ficha individual de mantenimiento preventivo
