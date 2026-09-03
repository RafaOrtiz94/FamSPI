# CONTEXT.md — servicio

## 1. Descripción
Módulo de Servicio Técnico. Es el módulo más completo del área técnica. Gestiona capacitaciones, disponibilidad de técnicos, equipos, mantenimientos, desinfección, entrenamiento (workflow FST), retiro de equipos (withdrawal workflow), casos correctivos (ST-01-03), verificación de equipos nuevos y casos externos. Incluye múltiples generadores de PDF.

## 2. Endpoints principales

Prefijo: `/api/v1/servicio`

**Capacitaciones:**
- GET/POST/PUT/DELETE `/api/v1/servicio/capacitaciones` — roles: `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`

**Disponibilidad:**
- GET/POST `/api/v1/servicio/disponibilidad` — roles técnicos
- GET/POST `/api/v1/servicio/actividades` — amplio

**Equipos:**
- GET/POST `/api/v1/servicio/equipos` — roles técnicos

**Mantenimientos:**
- GET `/api/v1/servicio/mantenimientos` — roles técnicos
- GET/POST `/api/v1/servicio/mantenimientos-anuales`

**Desinfección:**
- POST `/api/v1/servicio/desinfeccion/pdf` — PDF de desinfección

**Entrenamiento (Workflow FST):**
- GET/POST `/api/v1/servicio/entrenamiento/workflow` — `getTrainingWorkflowStatus` / `postTrainingWorkflowAction`
- POST `/api/v1/servicio/entrenamiento/pdf` — PDF coordinación
- POST `/api/v1/servicio/entrenamiento/asistencia/pdf` — lista de asistencia
- POST `/api/v1/servicio/entrenamiento/evaluacion/pdf` — evaluación
- POST `/api/v1/servicio/entrenamiento/certificado/emitir` — emitir certificado
- POST `/api/v1/servicio/entrenamiento/certificado/entregar` — entregar certificado

**Retiro de equipos (Withdrawal):**
- GET `/api/v1/servicio/withdrawal/workflow/list`
- GET/POST `/api/v1/servicio/withdrawal/workflow`
- POST `/api/v1/servicio/withdrawal/fst11/pdf`

**Casos correctivos (ST-01-03):**
- POST `/api/v1/servicio/corrective-cases` — `createCorrectiveCaseController`
- GET `/api/v1/servicio/corrective-cases/workspace/list`
- GET `/api/v1/servicio/corrective-cases/workspace/kpi`
- GET `/api/v1/servicio/corrective-cases/:id`
- GET `/api/v1/servicio/corrective-cases/:id/timeline`
- GET/POST `/api/v1/servicio/corrective-cases/:id/comments`
- POST `/api/v1/servicio/corrective-cases/:id/actions`

**Workflow documentos:**
- GET `/api/v1/servicio/workflow-documents`
- GET `/api/v1/servicio/workflow-documents/summary`
- GET `/api/v1/servicio/workflow/reporting-summary`
- GET `/api/v1/servicio/workflow/catalog`
- GET/POST `/api/v1/servicio/workflow/registry`
- GET `/api/v1/servicio/workflow/timeline`

**Casos externos:** `/api/v1/servicio/external-cases` (en `externalCases.routes.js` separado)

## 3. Flujo principal

**Entrenamiento:**
1. Técnico registra workflow de entrenamiento
2. Genera PDFs de coordinación y asistencia
3. Evalúa al personal capacitado
4. Emite y entrega certificado de entrenamiento

**Casos correctivos:**
1. Se crea caso correctivo (falla de equipo en cliente)
2. Técnico registra acciones correctivas
3. Se cierra el caso con evidencias

**Retiro de equipo:**
1. Se inicia workflow de retiro
2. Se genera acta FST-11
3. Se completa el retiro físico

## 4. Validaciones
- `workflowStateMachine.service.js` (5KB): transiciones de estados
- `correctiveStateMachine.service.js` (5KB): estado de casos correctivos
- `workflowRegistry.service.js` (5KB): registro de workflows activos
- `siteInspectionRules.service.js` (9KB): reglas para inspecciones en sitio

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `mantenimientos`: mantenimientos preventivos complementan este módulo
- `private-purchases`: inspección e instalación de compras privadas
- `integrations`/Odoo: casos externos sincronizados con Odoo
- `notifications`: notificaciones en transiciones de estado
- `inventario`: equipos referenciados

## 7. Frontend asociado
- `/dashboard/servicio-tecnico` → `DashboardServicio`
- `/dashboard/servicio-tecnico/solicitudes` → `ServicioSolicitudes`
- `/dashboard/servicio-tecnico/capacitaciones` → `ServicioCapacitaciones`
- `/dashboard/servicio-tecnico/equipos` → `ServicioEquipos`
- `/dashboard/servicio-tecnico/workspace-procedimiento` → `ServicioTechnicalProcedureWorkspace`
- `/dashboard/servicio-tecnico/retiros` → `ServicioRetiroEquipos`
- `/dashboard/servicio-tecnico/casos-externos` → `ServicioExternalCasesWorkspace`

## 8. Riesgos detectados
- `servicio.controller.js` (65KB) y `externalCases.service.js` (75KB) — extremadamente grandes
- `trainingWorkflow.service.js` (67KB) y `withdrawalWorkflow.service.js` (57KB) — muy grandes
- Módulo con mayor número de sub-flujos del sistema

## 9. Notas técnicas
- `AGENTS.md` presente
- `adapters/` directorio para adaptadores de integración
- FST-06 al FST-17 son formatos de documentos físicos del servicio técnico
- `documentTemplateRegistry.service.js` (12KB): registro de plantillas de documentos
