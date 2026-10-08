---
name: modulo-business-case
description: Vista completa del módulo Business Case comercial (backend/src/modules/business-case + spi_front/src/modules/comercial, workspace de BC) — mapa de archivos, qué está en producción vs legacy/muerto, roles reales y gotchas de desarrollo. Complementa a bc-workspace-tabs (que solo cubre orden/estado de tabs del workspace) — úsalo para cualquier tarea que toque el módulo BC completo: nuevas rutas, nuevos servicios, auditoría, o entender por dónde entra un flujo antes de tocarlo.
---

# Skill: Módulo Business Case — FamSPI

Vista de conjunto del módulo comercial más grande del sistema (~7000 líneas solo en el controller). Para el detalle de orden/estado/visibilidad de tabs del workspace usa `bc-workspace-tabs` — este skill es el mapa general: qué archivo hace qué, qué está realmente en producción y qué es ruido histórico.

La fuente de verdad detallada (endpoints, roles exactos, flujo, tablas) es `backend/src/modules/business-case/CONTEXT.md` y `backend/src/modules/business-case/README_TABLE_STRUCTURE.md` — no los dupliques aquí, léelos. Este skill resume y señala discrepancias/hallazgos que esos documentos no cubrían hasta la última auditoría (2026-09-03; ampliado 2026-09-11 con el FAB de herramientas del workspace).

---

## Mapa de archivos backend (`backend/src/modules/business-case/`)

Montado en `/api/v1/business-case` (+ sub-routers `/api/v1/equipment-catalog`, `/api/v1/determinations-catalog`, `/api/v1/calculation-templates`), ver `backend/src/routes/registerRoutes.js`.

**Entrada**
- `businessCase.routes.js` — todas las rutas del router principal + arrays de roles (`businessCaseRoles`, `investmentRoles`, `investmentValuesRoles`, `adminRoles`, `determinationsCatalogWriteRoles`). `investmentRoles` es literalmente `businessCaseRoles` (misma referencia) — no es un subconjunto separado a pesar del nombre.
- `businessCase.controller.js` (7005 líneas) — el controller más grande del sistema. Todo el CRUD, determinaciones, feasibility, ownership, dispatch, formulario manual, oferta, resumen de calidad, SLA e inspección ambiental viven aquí.
- `equipmentCatalog.controller.js`, `determinationsCatalog.controller.js`, `calculationTemplates.controller.js` — controllers de los sub-routers.
- `businessCaseSheetGeneration.controller.js` (193 líneas) — el único otro controller separado; atiende `/:id/sheets/*`.

**Servicios de soporte / reglas (todos en producción activa salvo lo indicado en la sección Legacy)**
- `businessCase.service.js` (2090 líneas) — lógica de negocio principal, queries SQL raw.
- `businessCaseStateMachine.js` — transiciones de estado.
- `businessCaseStateReadiness.js` — completitud requerida antes de transicionar de estado.
- `businessCasePermissions.js` (21KB) — RBAC granular por sección; consúltalo siempre antes de tocar roles en una ruta nueva.
- `businessCaseDataOwnership.js` — dueño de cada sección de datos.
- `businessCaseDeterminationsGate.service.js` — gate de determinaciones (stat-document, lock/unlock de subsecciones).
- `businessCaseIdempotency.service.js` — evita escrituras duplicadas.
- `businessCaseObservability.service.js` — métricas de API + eventos frontend.
- `businessCaseFeatureFlags.service.js` — feature flags (autosave).
- `businessCaseSectionAccessAudit.service.js` — auditoría de acceso a inversiones (REQ-BC-12).
- `businessCaseSla.service.js` — SLA general del BC (`/:id/sla`, `/sla/at-risk`).
- `businessCaseWorkflowSla.service.js` (1045 líneas) — **distinto del anterior**: SLA de la ventana "post estadísticas" (48h hábiles) del gate de determinaciones, con reminders y notificaciones propias. Fácil confundirlo con `businessCaseSla.service.js` por el nombre — no son el mismo cálculo.
- `businessCasePreflow.service.js` — reapertura de preflow.
- `businessCaseIntegration.service.js` — integración con otros módulos.
- `businessCaseSheetGeneration.service.js` (45KB) — orquesta el job async de generación de Google Sheets.
- `businessCaseSheetSyncLocal.service.js` (2016 líneas) — motor local de mapeo/sync de plantillas de hoja (carga definición de template y arma payloads); lo usan tanto sheet-generation como `businessCaseOffer.service.js`.
- `businessCaseSheetEquipment.helper.js` (25 líneas) — helper puntual de resolución de equipo para hojas.
- `businessCaseSheetGeneration.contract.js` (143 líneas) — contrato/esquema del job, compartido con tests.
- `businessCaseSheetVersioning.helper.js` — versionado de documentos generados.
- `businessCaseDriveFolder.service.js` — carpeta Google Drive por BC.
- `pdfGenerator.service.js` / `excelExporter.service.js` — export PDF / Excel fallback.
- `businessCaseScoring.service.js` — scoring de viabilidad.
- `calculationEngine.service.js` / `businessCaseCalculator.service.js` — motor de cálculo de ROI / cálculos económicos.
- `deliveryCeiling.service.js` — topes de entrega.
- `equipmentCompatibility.service.js` / `equipmentSelection.service.js` — compatibilidad y selección de equipo.
- `determinations.service.js` — servicio de determinaciones.
- `investments.service.js` — carrito de inversiones.
- `bcRequirements.service.js`, `bcLabEnvironment.service.js`, `bcLisIntegration.service.js`, `bcDeliveries.service.js`, `bcDispatchWorkspace.service.js` — cada sección operacional del "formulario manual BC" tiene su propio servicio con GET/POST simétrico.
- `businessCaseNotificationQueue.service.js` — cola de notificaciones del BC.
- `businessCaseOffer.service.js` (3508 líneas) — **el hallazgo más grande de esta auditoría**: segundo archivo más grande del módulo, no documentado en ningún CONTEXT.md anterior. Genera/versiona la Oferta comercial (Excel + PDF) desde el template `Mapeador_Sheets/formato oferta.xlsx`, con layouts split o combinado de calibrador+control (equipo id 9, cobas Pure `<303>`, hardcodeado como excepción de combinación). Corrigió un bug de producción real: el logo/marca de agua del PDF apuntaba antes a `docs/validation/assets/`, ruta excluida por `.dockerignore`, así que en Cloud Run `fs.existsSync` siempre daba `false` y el PDF salía sin logo — solo funcionaba corriendo local desde el checkout completo. Ahora apunta a `backend/src/assets/`.
- `businessCasePurchaseHandoff.service.js` (259 líneas) — handoff BC ↔ compra privada (`private-purchases`), consumido desde `businessCaseOffer.service.js`.

---

## Mapa de archivos frontend (`spi_front/src/modules/comercial/`)

**Páginas** (`pages/`)
- `BusinessCaseWorkspace.jsx` — workspace principal, rutas `/dashboard/business-case`, `/dashboard/comercial/business-case`, `/dashboard/business-case/workspace[/:id]`.
- `BusinessCaseObservabilityDashboard.jsx` — `/dashboard/business-case/observabilidad`.
- `BusinessCaseQualitySummary.jsx` — `/dashboard/business-case/resumen`, solo lectura para `jefe_calidad`/`bc_quality_summary`.

**API client**
- `spi_front/src/core/api/businessCaseApi.js` (672 líneas) — TODAS las funciones de fetch del módulo BC viven aquí. `spi_front/src/modules/comercial/api/` NO las tiene (esa carpeta solo trae `privatePurchasesApi.js` y `opportunitiesApi.js`, de otros flujos comerciales) — si buscas una función de fetch de BC y no está en `comercial/api/`, mira en `core/api/businessCaseApi.js` antes de asumir que falta.

**Componentes de workspace** (`components/workspace/`)
- `WorkspaceContent.jsx` — layout: `SectionNavigator` (sidebar) + `SectionContent` (panel principal).
- `SectionContent.jsx` — el switch real que decide qué componente de sección renderizar según `selectedSection`. Es la fuente de verdad de qué sección está realmente cableada (ver Legacy abajo).
- `SectionNavigator.jsx`, `BusinessCaseWorkspaceContext.jsx`, `CaseHeader.jsx`, `UIGuidancePanel.jsx`, `ProgressDashboard.jsx`, `TransitionPanel.jsx`, `ObservedCaseBanner.jsx`, `SectionObservationAlert.jsx`, `StateHistoryTimeline.jsx`, `SectionEditorBadge.jsx`, `DeterminationsSection.jsx`, `EquipmentSection.jsx` — soporte de navegación/estado del workspace.
- `ClientDataSection.jsx` / `InvestmentsSection.jsx` (en `components/workspace/`, sin subcarpeta) — son wrappers de 3 líneas que solo re-exportan la versión real desde `./sections/`. Patrón intencional, no confundir con código duplicado.
- `components/workspace/sections/` — implementación real de cada sección: `ClientDataSection.jsx`, `RequirementsSection.jsx`, `LabSection.jsx`, `LISSection.jsx`, `ConsumptionExportSection.jsx`, `DispatchWorkspaceSection.jsx`, `FeasibilitySection.jsx`, `InvestmentsSection.jsx`, `InvestmentValuesUnifiedSection.jsx`, `OfferWorkspaceSection.jsx` (nuevo, cubre la Oferta comercial descrita arriba).
- `BusinessCaseToolsFab.jsx` (NUEVO, 2026-09-11, `components/workspace/`, sin subcarpeta) — botón flotante speed-dial montado directamente en `BusinessCaseWorkspace.jsx` (no en `WorkspaceContent.jsx`/`SectionContent.jsx`), para que persista en todas las pestañas en vez de estar atado a una sección. Agrupa 2 herramientas: consultar/solicitar disponibilidad de equipo a `acp_comercial` (crea request `F.ST-23` en el módulo `requests`, ver Gotchas) e inspección de ambiente (crear/ver estado). **`DeterminationsSection.jsx` ya NO contiene el formulario/modal de "Solicitar inspección de ambiente"** — se extrajo a este FAB; en Determinaciones solo queda un badge de solo lectura con el estado.

---

## Base de datos

No reinventar — documentado en detalle en:
- `backend/src/modules/business-case/CONTEXT.md` sección 7.
- `backend/src/modules/business-case/README_TABLE_STRUCTURE.md`.

Resumen mínimo para orientarte: tabla principal `equipment_purchase_requests` (discriminador `uses_modern_system` / `bc_system_type`), vistas `v_business_cases` (moderno, usar en código nuevo), `v_business_cases_legacy` (Google Sheets legacy), `v_business_cases_complete` (ambos). Tablas satélite: `bc_equipment_selection`, `bc_determinations`, `bc_calculations`, `bc_audit_log`, `equipment_purchase_bc_items`.

---

## Producción activa vs Legacy/muerto

- **`BusinessCaseOrchestrator.service.js` — ELIMINADO** (ya no existe en el árbol). Era un flujo BC alternativo completo sobre el esquema legacy `bc_master` (migración 022); 0 de sus ~10 endpoints `/orchestrator/*` tenían caller real en frontend. Se borró; el comentario explicativo quedó en `businessCase.routes.js` (~línea 363). La única ruta que sobrevive con ese prefijo, `POST /:id/orchestrator/emergency-transition`, NUNCA fue parte del orquestador — llama al state machine moderno (`businessCaseStateMachine.emergencyTransition`) y solo compartía el prefijo de URL por convención histórica.
- **`spi_front/.../components/workspace/sections/InvestmentValuesSection.jsx` — HUÉRFANO**, confirmado con grep (cero importadores del path `sections/InvestmentValuesSection`). Fue reemplazado por `InvestmentValuesUnifiedSection.jsx`, que sí está cableado en `SectionContent.jsx`. Si necesitas tocar la sección de valores de inversión, edita el Unified — el otro archivo no afecta nada en runtime aunque exista en el repo.
- **`equipment_purchase_requests` con `bc_system_type='legacy'`** sigue siendo código vivo pero de *soporte*, no de desarrollo activo: varias funciones de `businessCase.service.js`, `businessCaseDriveFolder.service.js` y `businessCaseSheetGeneration.service.js` explícitamente lanzan `"BC legacy no soportado"` / `LEGACY_BUSINESS_CASE_UNSUPPORTED` cuando detectan un BC legacy en operaciones modernas (Drive, offer, etc.) — es una guarda, no una ruta funcional que haya que mantener con features nuevas.
- Dos rutas de inversión que SÍ estaban documentadas en el CONTEXT.md antiguo ya no existen en `businessCase.routes.js`: `POST /:id/investments/selections/request-increase` y `POST /:id/investments/confirm-cart`. Verificado con grep — no hay rastro en las rutas actuales. Si ves código frontend que las llama, es la señal de un caller roto, no de una ruta que "se te olvidó ver".

---

## Roles reales (resumen — detalle completo en CONTEXT.md sección 2)

- **`businessCaseRoles`** — casi todo el que participa en el BC comercial (comercial, jefes de las áreas involucradas, gerencia, más `operaciones`, `ing_servicio`/`esp_app` de solo visualización, y `jefe_logistica`, agregado para editar inversiones en paralelo sin carrito). Es el gate por defecto de la enorme mayoría de rutas.
- **`investmentRoles`** = `businessCaseRoles` (misma referencia). Quién puede *editar* la lista de inversiones en paralelo (sin carrito) lo decide el controller vía `INVESTMENT_EDIT_ROLES`, no el middleware de ruta.
- **`investmentValuesRoles`** — solo `jefe_operaciones`, `jefe_financiero`, `gerencia`, más `jefe_comercial` en modo solo-lectura (la separación GET/POST real se valida en el servicio, no en el router).
- **`jefe_calidad` / `bc_quality_summary`** — acceso de solo lectura al resumen de calidad (`/quality-summary`, `/:id/quality-summary/items`). `bc_quality_summary` no es un grupo de `ROLE_GROUPS`, es un rol sintético otorgado vía `extra_roles` en el JWT a usuarios puntuales (`migrations/276_users_extra_roles.sql`) — deliberadamente mucho más limitado que darles `businessCaseRoles`.
- **`adminRoles`** — `admin`, `gerencia`, `jefe_tecnico`, `jefe_servicio`: catálogo de equipos/determinaciones/templates.

---

## Gotchas de desarrollo

- **No asumas que un componente de sección importado en algún lado está realmente en uso.** El patrón wrapper (`components/workspace/ClientDataSection.jsx` → re-exporta `sections/ClientDataSection.jsx`) es legítimo, pero `sections/InvestmentValuesSection.jsx` (sin wrapper, sin importador) es la trampa opuesta: existe, compila, pero no renderiza nunca. Antes de editar un archivo en `sections/`, greppea quién lo importa realmente desde `SectionContent.jsx`.
- **Dos servicios de SLA con nombre parecido hacen cosas distintas**: `businessCaseSla.service.js` (SLA general del BC, endpoints `/:id/sla` y `/sla/at-risk`) vs `businessCaseWorkflowSla.service.js` (ventana de 48h hábiles post-documento-estadístico del gate de determinaciones, con su propio sistema de reminders/notificaciones). No mezcles cambios entre ellos pensando que es el mismo cálculo.
- **Rutas de import de assets en el backend son frágiles con `.dockerignore`**: el bug real del logo del PDF de oferta (arriba) es el ejemplo canónico — cualquier ruta nueva que lea archivos estáticos debe resolverse dentro de `backend/src/` o `backend/`, nunca hacia `docs/` u otra carpeta fuera del contexto de build de Cloud Run, porque en local (checkout completo) el bug no se manifiesta y solo aparece en producción.
- **`investmentRoles` ya no filtra nada por sí solo** — si necesitas restringir quién edita inversiones (no solo quién las ve), el gate real está en `INVESTMENT_EDIT_ROLES` dentro del controller/servicio, no en el array de roles de la ruta. Cambiar el array de la ruta no cambia permisos de edición.
- **El controller de BC (7005 líneas) mezcla handlers de features muy distintas** (oferta, resumen de calidad, inspección ambiental, SLA) — al buscar un handler, usa grep por nombre de función exacto (ver `module.exports` al final del archivo, ~línea 6900+) en vez de leer el archivo completo o navegar por scroll.
- Antes de tocar cualquier tab/sección visible del workspace (orden, estado completado/pendiente, visibilidad por rol), usa el skill `bc-workspace-tabs` — cubre en detalle los 3 archivos que deben sincronizarse a mano y que este skill no repite.
- **La columna `right-4` del workspace ya tiene 2 widgets flotantes globales antes de agregar uno nuevo**: `NotificationBell.jsx` (`bottom-6 right-4` en desktop, `z-[90]`) y `AttendanceWidget.jsx`/"asistencia" (`bottom-24 right-4` en desktop, `z-[49]`) — ambos definidos en `spi_front/src/core/ui/`, fuera del módulo BC, y visibles en TODA la app, no solo en el workspace. Cualquier FAB nuevo en esa esquina (como `BusinessCaseToolsFab.jsx`) debe posicionarse por encima de ambos (`bottom-[13rem]`+ en mobile, `bottom-[9.5rem]`+ en desktop) o queda tapado/debajo de ellos en z-index aunque el código compile sin errores — el bug no se ve hasta abrir la app real.
- **El módulo `requests` (fuera de `business-case`) es la vía correcta para "usuario solicita algo a un rol"** — no reinventar una bandeja nueva. Pero su bandeja compartida (`RequestsListModal`/`RequestStatWidget`, `spi_front/src/modules/shared/solicitudes/`) filtra por defecto `mine: true`; un widget para el rol *aprobador* (que no es quien crea la solicitud) debe pasar `initialFilters: { mine: false }` explícito o la lista sale vacía en silencio. Los códigos de tipo (`F.ST-XX`) del catálogo `request_types` de este módulo NO tienen relación con los endpoints `/business-case/:id/determinations/inspection-request` (a pesar de que `F.ST-20` comparta el nombre "inspección de ambiente") — son dos sistemas de datos distintos, uno genérico con AJV en `requests.service.js`, otro embebido en `modern_bc_metadata` del BC.
- **Hay DOS sets de roles distintos para "quién puede solicitar inspección de ambiente" y NO son el mismo**: `INSPECTION_REQUEST_ROLES` en `businessCase.controller.js:228` (comercial/backoffice_comercial/backoffice — gatea el endpoint `POST inspection-request` de verdad) vs `DETERMINATIONS_INSPECTION_REQUEST_ROLES` en `businessCaseDeterminationsGate.service.js:15` (comercial/jefe_comercial/acp_comercial/backoffice_comercial — esto es lo que calcula `gateInfo.permissions.canRequestInspection`, que la UI usa para MOSTRAR el botón). Resultado: `jefe_comercial`/`acp_comercial` ven el botón habilitado pero el endpoint los rechaza con 403 — inconsistencia preexistente a la extracción del FAB, no introducida por él. Si vas a "arreglar" esto, decide primero cuál de los dos sets es el correcto de negocio antes de tocar cualquiera.
