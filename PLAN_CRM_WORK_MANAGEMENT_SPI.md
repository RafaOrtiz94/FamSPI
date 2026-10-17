# Plan de alineación e implementación
## CRM Work Management SPI

Fecha de análisis: 2026-07-13

---

## 1. Objetivo

Alinear el documento [Requerimientos_CRM_Work_Management_SPI.md](./Requerimientos_CRM_Work_Management_SPI.md) con el estado real del código y la base de datos de FamSPI, y proponer un plan de implementación por fases basado en evidencia.

---

## 2. Fuentes verificadas

### Documento funcional

- [Requerimientos_CRM_Work_Management_SPI.md](./Requerimientos_CRM_Work_Management_SPI.md)

### Backend

- [backend/src/modules/crm-fam/CONTEXT.md](./backend/src/modules/crm-fam/CONTEXT.md)
- [backend/src/modules/crm-fam/crm.routes.js](./backend/src/modules/crm-fam/crm.routes.js)
- [backend/src/modules/crm-fam/crm.service.js](./backend/src/modules/crm-fam/crm.service.js)
- [backend/src/modules/management/CONTEXT.md](./backend/src/modules/management/CONTEXT.md)
- [backend/src/modules/schedules/CONTEXT.md](./backend/src/modules/schedules/CONTEXT.md)
- [backend/src/modules/schedules/schedules.service.js](./backend/src/modules/schedules/schedules.service.js)
- [backend/src/modules/integrations/CONTEXT.md](./backend/src/modules/integrations/CONTEXT.md)
- [backend/src/modules/integrations/integrationOutbox.service.js](./backend/src/modules/integrations/integrationOutbox.service.js)
- [backend/src/routes/registerRoutes.js](./backend/src/routes/registerRoutes.js)

### Frontend

- [spi_front/src/routes/AppRoutes.jsx](./spi_front/src/routes/AppRoutes.jsx)
- [spi_front/src/core/api/crmFamApi.js](./spi_front/src/core/api/crmFamApi.js)
- [spi_front/src/modules/crm-fam/pages/CrmShell.jsx](./spi_front/src/modules/crm-fam/pages/CrmShell.jsx)
- [spi_front/src/modules/crm-fam/pages/CrmActivitiesPage.jsx](./spi_front/src/modules/crm-fam/pages/CrmActivitiesPage.jsx)
- [spi_front/src/modules/crm-fam/hooks/useCrmDashboard.js](./spi_front/src/modules/crm-fam/hooks/useCrmDashboard.js)
- [spi_front/src/modules/crm-fam/hooks/useCrmOpportunities.js](./spi_front/src/modules/crm-fam/hooks/useCrmOpportunities.js)

### Neon verificado

- Esquemas existentes: `crm`, `auditoria`
- Esquema ausente: `work_management`
- Tablas CRM existentes:
  - `crm_accounts`
  - `crm_contacts`
  - `crm_leads`
  - `crm_opportunities`
  - `crm_blue_sheets`
  - `crm_action_items`
  - `crm_activities`
  - `crm_documents`
  - `crm_notes`
  - `crm_audit_log`
  - `crm_integration_outbox`
  - más catálogos y entidades Blue Sheet relacionadas
- Tablas operativas existentes reutilizables:
  - `public.visit_schedules`
  - `public.scheduled_visits`
  - `public.integration_outbox`
- Columnas de sincronización ya presentes en `public.scheduled_visits`:
  - `crm_activity_id`
  - `crm_meeting_id`
  - `calendar_event_id`
  - `calendar_event_link`
  - `calendar_event_calendar_id`
  - `external_synced_at`

### Observación crítica

`backend/src/modules/crm-fam/CONTEXT.md` está desactualizado respecto del código. El archivo dice que CRM-FAM es solo esqueleto con `501`, pero el código real expone rutas completas y lógica funcional. El código y Neon son la fuente de verdad.

---

## 3. Estado actual real del sistema

## 3.1 Lo que ya existe y es reutilizable

### CRM-FAM funcional

Ya existe una base CRM operativa con:

- cuentas
- contactos
- leads
- oportunidades
- Blue Sheets
- actividades
- documentos
- notas
- action items
- dashboard y reportes
- RBAC por roles comerciales, managers y admins
- auditoría CRM mediante `crm.crm_audit_log`

Esto significa que el requerimiento no parte desde cero. El Work Management debe montarse encima de un CRM ya existente, no crear un CRM nuevo.

### Planificación comercial ya existente

El módulo `schedules` ya resuelve parte del trabajo operativo comercial:

- cronogramas mensuales
- visitas planificadas
- aprobación por jefatura
- integración con Google Calendar
- enlace hacia actividades CRM y metadatos externos

Esto cubre una parte del requerimiento de calendario, planificación y actividades ligadas a clientes.

### Integración asíncrona ya existente

Ya existe un patrón de outbox reusable:

- `public.integration_outbox`
- worker de procesamiento
- `idempotency_key`
- `correlation_id`
- estados del envío

Además CRM tiene una cola propia:

- `crm.crm_integration_outbox`

Esto reduce el trabajo de la fase de integración con SPI.

### UI CRM ya montada

En frontend ya existen:

- shell de navegación CRM
- dashboard CRM
- cuentas
- contactos
- leads
- oportunidades
- actividades
- reportes
- configuración

También existe una vista Kanban básica en oportunidades. No es Work Management real, pero sí una referencia de interacción y navegación.

---

## 3.2 Lo que existe parcialmente

### Actividades CRM

Las actividades CRM actuales sirven para seguimiento comercial, pero no cubren:

- tableros configurables
- subtareas
- dependencias
- sprints
- backlog
- campos personalizados por tablero
- comentarios tipo hilo
- seguidores
- carga de trabajo real
- proyectos

Conclusión: `crm_activities` es base reutilizable conceptual, no la entidad final de Work Management.

### Action Items de Blue Sheet

Los `crm_action_items` ya resuelven tareas pequeñas ligadas a oportunidades/Blue Sheets, pero no son un motor general de trabajo.

Conclusión: pueden servir como referencia de permisos, filtros, ownership y notificaciones, pero no deben forzarse como reemplazo de `items`.

### Dashboard gerencial

Existe `management`, pero hoy es un módulo de lectura global de solicitudes y trazabilidad del sistema, no un portafolio de trabajo.

Conclusión: el dashboard gerencial del requerimiento debe construirse como una nueva capa, aunque puede reutilizar convenciones del módulo `management`.

---

## 3.3 Lo que no existe hoy

No existe evidencia actual en código o Neon de:

- módulo `work-management`
- esquema `work_management`
- tablas `workspaces`, `projects`, `boards`, `board_groups`, `items`, `item_assignees`, `item_dependencies`, `sprints`, `automation_rules`, `followers`, `comments`, `checklists`, `time_entries`
- endpoints `/api/v1/work-management/*`
- vista unificada “Mi trabajo”
- motor de subtareas multinivel
- dependencias circulares controladas
- Gantt
- carga de trabajo por usuario/equipo
- backlog y sprints
- automatizaciones configurables tipo monday
- integración formal Work Management -> SPI
- webhooks SPI -> Work Management
- plantilla de proyecto desde oportunidad
- capa de permisos por workspace/proyecto/tablero

---

## 4. Desviaciones del documento frente al estado real

## 4.1 El documento asume una arquitectura separada CRM/API/SPI

El requerimiento habla de:

- frontend CRM propio
- API CRM separada
- capa de integración hacia SPI

En el repositorio actual, CRM y SPI conviven en el mismo backend y frontend, aunque separados lógicamente por módulos y rutas.

### Ajuste recomendado

Para FamSPI actual, la implementación debe respetar:

- aislamiento lógico por módulo
- aislamiento de datos por esquema PostgreSQL
- contratos API internos claros
- integración por servicios y outbox

No es necesario forzar una separación física de despliegue en la primera etapa.

## 4.2 El documento propone `work_management` e `integrations` como esquemas

En Neon:

- `work_management` no existe
- `integrations` como esquema no existe
- sí existe `crm`
- sí existe `auditoria`
- sí existe `public.integration_outbox`

### Ajuste recomendado

Implementar Work Management en un nuevo esquema `work_management`, pero reutilizando:

- `crm` para relaciones comerciales
- `auditoria` o `crm.crm_audit_log` como patrón
- `public.integration_outbox` como base de integración

## 4.3 El documento trata Work Management como un módulo totalmente nuevo

En realidad ya hay piezas parciales muy valiosas:

- cronogramas
- actividades CRM
- action items
- outbox
- auditoría
- integración de calendario

### Ajuste recomendado

El plan debe ser incremental y de ensamblaje, no de reescritura.

---

## 5. Matriz de alineación funcional

## 5.1 Ya cubierto o muy cercano

| Bloque del requerimiento | Estado real | Evidencia |
|---|---|---|
| Clientes, contactos, prospectos, oportunidades | Existe | `crm-fam` backend + frontend + schema `crm` |
| Blue Sheet | Existe | rutas, service y tablas `crm_*` |
| Actividades | Existe parcial | `crm_activities`, `CrmActivitiesPage` |
| Dashboard comercial básico | Existe | `CrmDashboardPage`, hooks dashboard |
| Reportes básicos CRM | Existe | `reports/*` en CRM |
| Integración asíncrona con outbox | Existe parcial | `public.integration_outbox`, worker |
| Integración con calendario | Existe parcial | `schedules.service.js`, columnas `calendar_event_*` |
| Cronogramas y visitas | Existe | `visit_schedules`, `scheduled_visits`, frontend comercial |
| Auditoría CRM | Existe parcial | `crm.crm_audit_log` |

## 5.2 Existe parcialmente y debe extenderse

| Bloque del requerimiento | Estado real | Ajuste |
|---|---|---|
| Kanban | Existe solo en oportunidades | no sirve como tablero general |
| Tareas | existen activities/action items | deben separarse como `items` |
| Mi trabajo | existe fragmentado | consolidar desde CRM + Work Management + SPI |
| Integración con SPI | existe patrón técnico, no flujo funcional Work Management | crear contratos específicos |
| Notificaciones | existe infraestructura | definir eventos del nuevo módulo |
| Google Drive | existe patrón en otros módulos | no existe Work Management documental |
| Dashboard gerencial | existe gerencial global, no portafolio de trabajo | crear capa nueva |

## 5.3 Falta completamente

| Bloque del requerimiento | Estado real |
|---|---|
| Workspaces |
| Projects |
| Boards y board groups |
| Items y subtareas multinivel |
| Item dependencies |
| Checklists obligatorios |
| Followers y comments con hilos |
| Custom fields por tablero |
| Backlog y sprints |
| Gantt |
| Workload |
| Automation rules |
| Templates |
| SPI links de Work Management |
| Work activity log propio |

---

## 6. Decisiones de arquitectura recomendadas

## 6.1 Crear un nuevo módulo real

Crear:

- `backend/src/modules/work-management/`
- `spi_front/src/modules/work-management/`

No mezclarlo dentro de `crm-fam` ni dentro de `management`.

## 6.2 Crear un nuevo esquema PostgreSQL

Crear esquema:

- `work_management`

Motivo:

- desacopla tablas del CRM comercial
- facilita auditoría y evolución
- evita contaminar `public`

## 6.3 Mantener CRM como sistema padre comercial

Work Management debe relacionarse con:

- cuenta
- contacto
- lead
- oportunidad
- Blue Sheet

mediante IDs del esquema `crm`, sin duplicar maestros.

## 6.4 Reutilizar el outbox existente

No crear un segundo patrón si `public.integration_outbox` ya resuelve:

- idempotencia
- correlación
- reintentos
- estados

Sí puede requerirse una tabla especializada `work_management.spi_links` para trazabilidad funcional.

## 6.5 No mezclar cronogramas comerciales con items de Work Management

`visit_schedules` y `scheduled_visits` deben tratarse como un origen relacionado, no como el modelo principal del nuevo módulo.

Pueden integrarse así:

- una visita programada puede crear o asociarse a un item
- una tarea puede referenciar una visita
- “Mi trabajo” puede mostrar ambos tipos de pendientes

Pero no conviene reutilizar esas tablas como si fueran `projects` o `boards`.

---

## 7. Alcance recomendado ajustado por fases

## Fase 0. Alineación técnica y definición de contratos

### Objetivo

Cerrar el diseño real contra el repo antes de construir.

### Entregables

- ADR corto de arquitectura
- FRS ajustado al sistema actual
- definición final de roles
- definición final de relaciones con CRM y SPI
- matriz de estados internos
- mapa de permisos backend

### Trabajo

- actualizar la visión del documento a la realidad de FamSPI
- decidir si `crm_activities` convivirá o migrará parcialmente
- definir qué eventos requieren SPI y cuáles no
- definir si comentarios y adjuntos usarán infraestructura existente o nueva

### Dependencias

- ninguna

---

## Fase 1. Base de datos y backend foundation

### Objetivo

Crear la base técnica mínima del módulo.

### Entregables

- esquema `work_management`
- migraciones iniciales
- módulo backend `work-management`
- rutas `/api/v1/work-management/*`
- repositorios base
- RBAC inicial

### Tablas mínimas

- `workspaces`
- `workspace_members`
- `projects`
- `project_members`
- `boards`
- `board_groups`
- `items`
- `item_assignees`
- `checklists`
- `checklist_items`
- `comments`
- `attachments`
- `followers`
- `work_activity_log`
- `spi_links`

### Trabajo

- crear entidades núcleo
- definir soft delete
- definir versionado/concurrencia
- definir auditoría mínima por entidad crítica

### Dependencias

- Fase 0

---

## Fase 2. MVP operativo de trabajo

### Objetivo

Habilitar el núcleo funcional del Work Management.

### Entregables

- workspaces
- proyectos
- tableros
- grupos
- tareas
- subtareas nivel 1
- estados configurables con categoría interna normalizada
- responsables
- fechas
- prioridades
- etiquetas
- checklists
- comentarios simples
- adjuntos/enlaces

### UI mínima

- listado de workspaces
- detalle de proyecto
- tablero tabla
- tablero Kanban
- detalle lateral/modal de item

### Dependencias

- Fase 1

---

## Fase 3. Integración CRM nativa

### Objetivo

Conectar Work Management con el CRM existente.

### Entregables

- relación proyecto -> cuenta/contacto/lead/oportunidad/Blue Sheet
- creación de proyecto desde oportunidad
- validación de no duplicación por plantilla + oportunidad
- plantillas básicas
- panel “Mi trabajo”

### Trabajo

- botón y flujo desde oportunidades CRM
- vista de contexto comercial dentro del proyecto
- vinculación con `crm_activities` cuando aplique
- consolidación de pendientes del usuario

### Dependencias

- Fase 2
- CRM-FAM operativo

---

## Fase 4. Colaboración, trazabilidad y documentos

### Objetivo

Completar el flujo de trabajo colaborativo.

### Entregables

- comentarios con respuestas
- menciones
- seguidores
- notificaciones del módulo
- evidencias documentales
- activity log funcional del item/proyecto
- reglas de cierre por checklist obligatorio

### Trabajo

- definir modelo de comentarios tipo hilo
- eventos de notificación
- permisos sobre edición/eliminación
- integración con Drive o enlaces según políticas actuales

### Dependencias

- Fase 2

---

## Fase 5. Integración formal con SPI

### Objetivo

Permitir que Work Management cree y siga procesos formalizados en SPI sin absorber su lógica.

### Entregables

- `spi_links`
- contratos específicos de integración
- uso de `public.integration_outbox`
- reintentos
- webhook o polling de estados
- estado resumido de proceso SPI visible en proyecto/item

### Trabajo

- definir tipos de solicitud SPI que pueden nacer desde Work Management
- usar `correlation_id` e `idempotency_key`
- exponer trazabilidad y enlace al registro formal

### Dependencias

- Fase 1
- Fase 3
- definiciones funcionales de Fase 0

---

## Fase 6. Vistas avanzadas y gerencia

### Objetivo

Agregar valor ejecutivo y operativo sin tocar aún la gestión ágil avanzada.

### Entregables

- calendario de items
- workload por usuario/equipo
- dashboard gerencial de portafolio
- filtros guardados
- vistas privadas/compartidas

### Dependencias

- Fase 3
- Fase 4

---

## Fase 7. Gestión ágil avanzada

### Objetivo

Completar backlog, sprint y métricas ágiles.

### Entregables

- backlog
- sprints
- epics
- historias de usuario
- puntos
- velocidad
- burndown
- WIP limits
- dependencias avanzadas

### Dependencias

- Fase 2
- Fase 6 recomendada para reporting

---

## Fase 8. Automatizaciones y optimización

### Objetivo

Incorporar reglas configurables y automatización segura.

### Entregables

- `automation_rules`
- `automation_runs`
- disparadores por estado, fecha, asignación o inactividad
- bitácora de ejecución
- bloqueo de automatizaciones incompatibles con SPI

### Dependencias

- Fase 5
- Fase 7 parcial o total

---

## 8. Priorización recomendada para MVP real

Para este repositorio, el MVP realista y coherente no debe intentar cubrir todo el documento.

### MVP recomendado

- Fase 0
- Fase 1
- Fase 2
- Fase 3
- parte de Fase 4
- parte de Fase 5

### Excluir del MVP

- sprints
- Gantt
- workload avanzado
- automatizaciones configurables
- métricas ágiles profundas
- portafolio institucional avanzado

---

## 9. Riesgos principales

## Riesgo 1. Duplicar capacidades ya existentes

Si Work Management reimplementa:

- actividades CRM
- cronogramas
- seguimiento comercial

sin una frontera clara, el sistema se volverá inconsistente.

### Mitigación

Definir modelo de relación y no sustituir lo que ya funciona.

## Riesgo 2. Mezclar lógica formal SPI dentro del nuevo módulo

El requerimiento es claro en separar:

- trabajo operativo/comercial
- procesos formales con aprobación y documentos institucionales

### Mitigación

SPI sigue siendo fuente de verdad formal. Work Management solo dispara, referencia y muestra estado resumido.

## Riesgo 3. Intentar construir monday completo en una sola etapa

El alcance del documento es mayor que el estado actual del sistema.

### Mitigación

Construcción incremental con MVP estrecho.

## Riesgo 4. CONTEXT desactualizado

`crm-fam/CONTEXT.md` hoy no representa el estado real del módulo.

### Mitigación

Antes de implementar, actualizar o complementar contextos técnicos del módulo.

---

## 10. Recomendación de ejecución

## Orden recomendado

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4 parcial
6. Fase 5 parcial
7. Validación UX + pruebas E2E
8. Recién después Fase 6 a Fase 8

## Trabajo en paralelo posible

### Frente A. Arquitectura y backend

- Fase 0
- Fase 1
- contrato con SPI
- migraciones
- repositorios

### Frente B. Frontend base

- shell de navegación Work Management
- layout
- workspaces/proyectos/tableros
- item drawer

### Frente C. Integración CRM

- oportunidad -> proyecto
- panel de contexto comercial
- “Mi trabajo”

### Frente D. Integración SPI

- outbox
- `spi_links`
- trazabilidad
- retries

---

## 11. Conclusión

El documento de requerimientos es ambicioso y técnicamente viable, pero no está alineado con el estado actual del repositorio si se interpreta como un sistema totalmente nuevo.

La realidad del código y Neon indica:

- CRM-FAM ya existe y está operativo
- hay cronogramas y visitas ya construidos
- hay outbox e integración base ya construidos
- no existe todavía un módulo ni esquema `work_management`

La estrategia correcta no es rehacer CRM ni duplicar módulos existentes, sino:

- crear un nuevo módulo `work-management`
- apoyarlo en `crm`
- reutilizar `integration_outbox`
- mantener SPI como motor formal
- llegar primero a un MVP operativo acotado

---

## 12. Siguiente paso recomendado

Crear dos documentos derivados antes de implementar:

1. `FRS_CRM_WORK_MANAGEMENT_SPI.md`
   - versión funcional depurada y alineada a FamSPI real

2. `DDS_CRM_WORK_MANAGEMENT_SPI.md`
   - diseño técnico con tablas, rutas, eventos, permisos y contratos

Después de eso, ejecutar Fase 1.
