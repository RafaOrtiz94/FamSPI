# Informe técnico: Personalización e integración de EspoCRM con app React FamSPI

**Fecha:** 2026-06-12  
**Estado:** Fases 0–3 + Google Bridge implementado — pendiente Fase 4 (backfill) y webhooks manuales en producción  
**Versión:** 2.0 — Pipeline Bitrix reemplazado (12 etapas), Google Workspace bridge implementado  

---

## 1. Resumen ejecutivo

FamSPI es un **sistema ERP interno empresarial** construido como SPA React 19 (CRA/react-scripts 5) con 577 archivos JS/JSX, arquitectura API-first contra un backend Express 5 en GCP Cloud Run y PostgreSQL en Neon. Contiene **8 módulos funcionales independientes** con el módulo **Comercial** como el más complejo y relevante para EspoCRM.

Módulos comerciales identificados:
- **FamSheets** (Opportunities/BlueSheet) con 7 etapas de pipeline
- **Clientes** con visitas y asignación de asesores
- **Compras Privadas** con 39 estados de flujo
- **Compras Públicas** (SERCOP)
- **Business Case** con secciones, permisos y workflow
- **Dashboard Comercial** con 4 vistas diferenciadas por rol

El outbox pattern de integración ya está implementado en FamSPI. EspoCRM **puede integrarse sin afectar ningún flujo existente** usando sincronización asíncrona unidireccional (FamSPI → EspoCRM) en la fase inicial.

> **Nota sobre Odoo:** existe integración legacy con Odoo en el codebase (`odoo.* events` en el outbox). Esta integración es herencia de un ERP anterior y **no forma parte del plan futuro**. El ERP objetivo es **SAP Business One**. Los eventos `odoo.*` del outbox quedan congelados — no se extenderán ni se agregarán nuevos.

**Recomendación:** EspoCRM como CRM complementario de seguimiento comercial — no como reemplazo de la app React.

---

## 2. Evidencia principal encontrada

| Área | Evidencia encontrada | Archivo o ruta | Interpretación | Confianza |
|---|---|---|---|---|
| Framework | `"react": "^19.2.0"`, `"react-scripts": "5.0.1"` | `spi_front/package.json` | React 19 SPA con CRA. Sin TypeScript — JavaScript puro. | Alto |
| Rutas | 80+ rutas con lazy loading y ProtectedRoute | `spi_front/src/routes/AppRoutes.jsx` | Routing modular por rol. 17 subrutas comerciales. | Alto |
| Autenticación | Google OAuth2 + JWT Bearer en localStorage | `spi_front/src/core/auth/AuthContext.jsx` | Sin cookies. Token refresh automático. Session expiry scheduling. | Alto |
| Roles | 20+ roles normalizados, RBAC granular, 4 vistas por rol comercial | `spi_front/src/core/auth/ProtectedRoute.jsx`, `moduleAccess.js` | Sistema triple: rol + module_access array + global_status | Alto |
| FamSheets (Oportunidades) | 7 etapas de funnel, 8 pestañas de workspace, score 0-100 | `spi_front/src/modules/comercial/pages/OpportunitiesPage.jsx` | Módulo BlueSheet propio. Influencias, flags, competidores, acciones | Alto |
| API Opportunities | `/api/v1/famsheets` con 20+ endpoints | `spi_front/src/modules/comercial/api/opportunitiesApi.js` | API completa: CRUD + sub-recursos + vínculos a procesos externos | Alto |
| Clientes | Clientes aprobados + prospectos, visitas, asignación asesores | `spi_front/src/modules/comercial/pages/Clientes.jsx` | CRM básico interno con estados de visita | Alto |
| Compras Privadas | 39 estados de flujo, desde oferta hasta entrega | `spi_front/src/modules/comercial/api/privatePurchasesApi.js` | Proceso complejo con firma, ACP, contratos, logística | Alto |
| Compras Públicas | Módulo `equipment-purchases` con 50+ métodos API | `spi_front/src/core/api/equipmentPurchasesApi.js` | Flujo SERCOP, proformas, inspecciones, checklist | Alto |
| Business Case | Workspace con secciones, permisos granulares, observabilidad | `spi_front/src/core/api/businessCaseApi.js` | Cálculos financieros, márgenes, aprobaciones, stages propios | Alto |
| Dashboard Comercial | 4 vistas por rol con KPIs y métricas | `spi_front/src/modules/comercial/pages/Dashboard.jsx` | `GET /dashboard/comercial/summary` con métricas agregadas | Alto |
| Planificación | Cronogramas mensuales con visitas por asesor | `spi_front/src/core/api/schedulesApi.js` | Flujo propio no replicable en EspoCRM sin desarrollo custom | Alto |
| Integración Odoo (legacy) | `integrationsApi.js` + health endpoint | `spi_front/src/core/api/integrationsApi.js` | Integración legacy con ERP anterior. **No se extiende.** ERP futuro es SAP B1. | Alto |
| Module Access | `module_access[]` + `module_global_status[]` en JWT payload | `spi_front/src/core/auth/moduleAccess.js` | Feature flags por usuario. Construction/testing/production stages | Alto |
| Outbox CRM | `crm.service.js`, `crmSyncScheduler.js`, hooks en requests/clients/opportunities | `backend/src/modules/integrations/crm.service.js` | Sincronización ya implementada. Account + Contact + Opportunity → EspoCRM | Alto |

---

## 3. Arquitectura actual detectada

**Tipo:** SPA React 19 monorepo con arquitectura modular por dominio de negocio.

```
[Usuario] → [Google OAuth2] → [JWT Bearer Token]
                                      ↓
[React 19 SPA] → [Axios /api/v1] → [Express 5 Backend (GCP Cloud Run)]
                                      ↓
                               [PostgreSQL (Neon)]
                                      ↓
                        [Outbox → EspoCRM ✅] [Outbox → SAP B1 (futuro)]
                        [Outbox → Odoo (legacy, congelado)]
```

**Stack detectado:**
- **Lenguaje:** JavaScript puro (sin TypeScript)
- **Build:** CRA con react-scripts 5.0.1
- **HTTP:** Axios con interceptores automáticos de JWT refresh
- **Estado global:** React Context (AuthContext) + React Query (`@tanstack/react-query ^5`)
- **Formularios:** React Hook Form + Zod
- **UI:** Bootstrap 5 + MUI DataGrid + Tailwind + Framer Motion
- **Enrutamiento:** React Router DOM v7 con lazy loading
- **Autenticación:** Google OAuth2 + JWT Bearer en `localStorage`
- **Autorización:** RBAC triple capa: `allowedRoles[]` en ruta + `user.module_access[]` + `module_global_status[]`
- **API base:** `https://spi-backend-983537733948.us-central1.run.app/api/v1` (GCP Cloud Run)
- **577 archivos** JS/JSX distribuidos en 8 dominios de negocio

---

## 4. Mapa de módulos actuales de la app React

| Módulo | Ruta principal | Páginas/Componentes clave | Servicios API | Roles relacionados |
|---|---|---|---|---|
| **Dashboard Comercial** | `/dashboard/comercial` | `Dashboard.jsx` (4 vistas por rol) | `dashboardApi.getCommercialSummary()` | comercial, jefe_comercial, backoffice_comercial, acp_comercial, gerencia |
| **FamSheets (Opp.)** | `/dashboard/comercial/famsheets` | `OpportunitiesPage.jsx`, `OpportunityWorkspace.jsx` (8 tabs), `FamSheetsDashboardPage.jsx` | `opportunitiesApi.*` (20+ endpoints) | comercial, jefe_comercial, acp, gerencia |
| **Clientes** | `/dashboard/comercial/clientes` | `Clientes.jsx` | `clientsApi.*` (12 endpoints) | jefe_comercial, comercial, backoffice, gerencia |
| **Solicitudes** | `/dashboard/comercial/solicitudes` | `Solicitudes.jsx`, `NewClientRequest.jsx` | `requestsApi.getRequests()` | comercial, jefe_comercial, gerencia |
| **Business Case** | `/dashboard/business-case` | `BusinessCaseWorkspace.jsx`, `BusinessCaseObservabilityDashboard.jsx` | `businessCaseApi.*` | comercial, acp, jefe_comercial, operaciones, servicio_tecnico, gerencia |
| **Compras Públicas** | `/dashboard/comercial/equipment-purchases` | `EquipmentPurchases.jsx`, `ACPEquipmentPurchases.jsx` | `equipmentPurchasesApi.*` (50+ endpoints) | acp_comercial, jefe_comercial, gerencia |
| **Compras Privadas** | `/dashboard/purchases/workspace` | `PurchasesWorkspace.jsx` | `privatePurchasesApi.*` (39 estados) | comercial, jefe_comercial, acp, backoffice, operaciones, logística |
| **Planificación** | `/dashboard/comercial/planificacion` | `PlanificacionMensual.jsx`, `AprobacionCronogramas.jsx` | `schedulesApi.*` | comercial, jefe_comercial |
| **Servicio Técnico** | `/dashboard/servicio-tecnico` | `ServicioTecnicoPage.jsx` | `servicioApi.*` | servicio_tecnico, jefe_tecnico |
| **Operaciones** | `/dashboard/operaciones` | `OperacionesPage.jsx` | `deliveryRequestsApi.*` | operaciones, jefe_operaciones |
| **Logística** | `/dashboard/logistica` | `LogisticaPage.jsx` | `deliveryRequestsApi.*` | logistica, jefe_logistica |
| **Talento Humano** | `/dashboard/talento-humano` | 10+ páginas RRHH | `hrApi.*`, `attendanceApi.*` | talento_humano, jefe_talento_humano |
| **TI** | `/dashboard/ti` | TI Assets | `tiAssetsApi.*` | ti, jefe_ti |
| **Calidad** | `/dashboard/calidad` | 17 subprocesos | `calidadApi.*` | calidad, jefe_calidad |
| **Gerencia** | `/dashboard/gerencia` | `DashboardGerencia.jsx` | `dashboardApi.*` | gerencia, gerente_general, director |
| **Finanzas** | `/dashboard/finanzas` | `DashboardFinanzas.jsx`, `Viaticos.jsx` | `viaticosApi.*`, `finanzasApi.*` | finanzas, jefe_finanzas |

---

## 5. Flujos comerciales identificados

### Flujo 1: Registro y aprobación de cliente
- **Ruta:** `/dashboard/comercial/solicitudes` → `NewClientRequest.jsx`
- **Pasos:** Crear solicitud (RUC, razón social, contactos, LOPDP) → aprobación jefe_comercial → carta Drive → **hook CRM ya activo** → EspoCRM Account + Contact
- **Estados:** `pendiente` → `aprobado` / `rechazado`
- **Roles:** comercial (crea), jefe_comercial / gerencia (aprueba)
- **Evidencia:** `backend/src/modules/requests/requests.service.js:2882-2970`
- **Estado integración:** ✅ Ya implementado

### Flujo 2: Gestión de oportunidades (FamSheets/BlueSheet)
- **Ruta:** `/dashboard/comercial/famsheets`
- **Etapas:** `prospect` → `qualify` → `pursue` → `close` → `won`/`lost`/`archived`
- **Pestañas workspace:** análisis, influencias, valoración, situación, competencia, plan, coaching, vínculos
- **Datos clave:** título, objetivo singular, monto, fecha cierre, score 0-100, posición competitiva
- **Roles:** comercial, jefe_comercial, acp, gerencia
- **Evidencia:** `spi_front/src/modules/comercial/api/opportunitiesApi.js`, migración `189_bluesheet_foundation.sql`
- **Estado integración:** ✅ Sync parcial implementado (stage, monto, score)

### Flujo 3: Business Case
- **Ruta:** `/dashboard/business-case`
- **Permisos detectados:** `canEdit`, `canPromoteStage`, `canDecideFeasibility`, `canBlockSections`, `workspaceClosed`
- **Evidencia:** `spi_front/src/core/api/businessCaseApi.js`
- **Estado integración:** ⚠️ Solo sincronizar resultado final (bc_status) — flujo completo queda en React

### Flujo 4: Compras privadas
- **Ruta:** `/dashboard/purchases/workspace`
- **39 estados confirmados:** desde `PENDING_COMMERCIAL` hasta `DELIVERED`
- **Evidencia:** `spi_front/src/modules/comercial/api/privatePurchasesApi.js`
- **Estado integración:** ⚠️ Solo sincronizar `DELIVERED` como Activity en EspoCRM

### Flujo 5: Compras públicas (SERCOP)
- **Ruta:** `/dashboard/comercial/equipment-purchases`
- **34 códigos de error específicos** SERCOP
- **Evidencia:** `spi_front/src/core/api/equipmentPurchasesApi.js`
- **Estado integración:** ⚠️ Solo resultado final — flujo regulado queda en React

### Flujo 6: Planificación comercial mensual
- **Ruta:** `/dashboard/comercial/planificacion`
- **Evidencia:** `spi_front/src/core/api/schedulesApi.js`, `useSchedules.js`
- **Estado integración:** 🔲 Sincronizar visitas como Activities/Meetings — pendiente implementar

### Flujo 7: Solicitudes generales
- **Tipos:** `cliente`, `compra`, `permisos`, `personal`, `inspection`, `retiro`
- **Evidencia:** `spi_front/src/modules/comercial/config/requestConfig.js`
- **Estado integración:** Solo tipo `cliente` conecta con EspoCRM (ya activo)

---

## 6. Dashboard Comercial y EspoCRM

| Vista | Rol | Métricas | Fuente |
|---|---|---|---|
| `ComercialView` | comercial | Quick links, widgets compras | `GET /dashboard/comercial/summary` |
| `JefeComercialView` | jefe_comercial | Total BC, BC Activos, Solicitudes Pendientes, Clientes nuevos 30d | Mismo endpoint |
| `BackofficeView` | backoffice_comercial | Vista operativa | No detallado |
| `ACPComercialView` | acp_comercial | Vista ACP con compras públicas | No detallado |

**FamSheetsDashboardPage:** Prospectos activos, Pursue activos, Won, Sin coach, Acciones vencidas, Flags críticos → `GET /famsheets/dashboard/manager`

**Qué debe venir de EspoCRM:** Actividades comerciales, llamadas, seguimiento de prospectos.  
**Qué permanece en FamSPI:** KPIs de BC, métricas de compras, planificación.

---

## 7. Entidades de negocio encontradas

| Entidad | Descripción | Tabla PostgreSQL | Módulo React |
|---|---|---|---|
| **ClientRequest** | Solicitud de alta de cliente | `client_requests` | comercial/solicitudes |
| **Client** | Cliente aprobado con asesor y visitas | `client_requests` (status=approved) | comercial/clientes |
| **Prospect** | Prospecto sin aprobación formal | `client_requests` (is_prospect) | comercial/clientes |
| **Account** | Empresa cliente vinculada a oportunidades | `accounts` (migración 189) | comercial/famsheets |
| **Contact** | Contacto dentro de un Account | `contacts` (migración 189) | comercial/famsheets |
| **Opportunity** | Oportunidad BlueSheet con 7 etapas y score | `opportunity` (migración 189) | comercial/famsheets |
| **BuyingInfluence** | Contacto clave con rol E/T/U/C | `buying_influence` | OpportunityWorkspace |
| **RiskFlag** | Bandera de riesgo (open/mitigating/resolved) | `opportunity_flag` | OpportunityWorkspace |
| **Competitor** | Competidor con scores por categoría | `competitor` | OpportunityWorkspace |
| **ActionItem** | Acción de plan comercial | `bs_action_item` | OpportunityWorkspace |
| **BusinessCase** | Análisis financiero para justificar inversión | `bc_master` + secciones | comercial/business-case |
| **PrivatePurchase** | Compra privada con 39 estados | `private_purchase_requests` | purchases/workspace |
| **EquipmentPurchase** | Compra pública SERCOP | `equipment_purchase_requests` | comercial/equipment-purchases |
| **Schedule** | Cronograma mensual de visitas | `schedules` | comercial/planificacion |
| **DeliveryRequest** | Solicitud de despacho logístico | `delivery_requests` | purchases/workspace |
| **User** | Usuario con rol, scope, module_access | `users` | auth global |

---

## 8. Estados y etapas encontradas

### FamSheets → Opportunity Stage en EspoCRM (pipeline expandido — 12 etapas)

EspoCRM tiene **12 stages** para reflejar mejor la operación comercial FAM. FamSPI sigue enviando **7 macro-stages**, pero EspoCRM agrega sub-etapas operativas que el asesor puede mover manualmente sin que FamSPI las pise. La sincronización mantiene **lógica anti-pisado**: si FamSPI re-sincroniza el mismo macro-stage, se conserva la sub-etapa manual vigente en EspoCRM.

| # | Stage EspoCRM | Etiqueta ES | Color | Prob. | Macro FamSPI |
|---|---|---|---|---|---|
| 1 | Prospeccion | Prospección | ⬜ default | 10% | `prospect` |
| 2 | Asignado | Asignado | 🟦 info | 15% | `prospect` *(solo EspoCRM)* |
| 3 | En Seguimiento | En Seguimiento | 🟦 info | 20% | `qualify` |
| 4 | Lead Calificado | Lead Calificado | 🔵 primary | 30% | `qualify` *(solo EspoCRM)* |
| 5 | Analisis de Necesidades | Análisis de Necesidades | 🔵 primary | 40% | `pursue` |
| 6 | Desarrollo de Oferta | Desarrollo de Oferta | 🟧 warning | 55% | `pursue` *(solo EspoCRM)* |
| 7 | Presentacion de Propuesta | Presentación de Propuesta | 🟧 warning | 70% | `close` |
| 8 | Negociacion | Negociación | 🟧 warning | 85% | `close` *(solo EspoCRM)* |
| 9 | Contratos | Contratos | 🟧 warning | 95% | `close` *(solo EspoCRM)* |
| 10 | Cerrado Ganado | Cerrado Ganado | 🟩 success | 100% | `won` |
| 11 | Cerrado Perdido | Cerrado Perdido | 🟥 danger | 0% | `lost` |
| 12 | Archivado | Archivado | ⬜ default | 0% | `archived` |

**Lógica de sync (`crm.service.js`):**
- `macroToEntryStage`: cada macro de FamSPI mapea al stage de **entrada** de su fase (`prospect` → `Prospeccion`, `qualify` → `En Seguimiento`, `pursue` → `Analisis de Necesidades`, `close` → `Presentacion de Propuesta`)
- `stageToMacro` (`STAGE_TO_MACRO`): revierte cualquier stage EspoCRM, incluidas sub-etapas manuales, a su macro-stage FamSPI
- En UPDATE: solo cambia `stage` si `stageToMacro(stage_actual) !== funnel_stage_FamSPI`. Esto preserva `Asignado`, `Lead Calificado`, `Desarrollo de Oferta`, `Negociacion` y `Contratos` cuando el asesor los movió manualmente.

**Verificado E2E (2026-06-12):**
1. Crear `pursue` → `Analisis de Necesidades` ✅
2. Asesor mueve a `Desarrollo de Oferta` → re-sync `pursue` mantiene `Desarrollo de Oferta` ✅
3. FamSPI avanza a `close` → cambia a `Presentacion de Propuesta` ✅
4. Asesor mueve a `Negociacion`/`Contratos` → re-sync `close` mantiene la sub-etapa manual ✅
5. FamSPI `won` → `Cerrado Ganado` ✅

### Estados de visita → Activity en EspoCRM

| Estado FamSPI | Equivalente EspoCRM |
|---|---|
| `pendiente` | Meeting status: Planned |
| `in_visit` | Meeting status: In Progress (campo custom) |
| `visitado` | Meeting status: Held |

### Business Case → Campo custom en Opportunity

| Estado BC | Campo EspoCRM |
|---|---|
| `feasibility_approved` | `bc_status: approved` |
| `rejected` | `bc_status: rejected` |
| `in_progress` | `bc_status: in_progress` |

---

## 9. Mapeo React → EspoCRM

| Elemento en React | Evidencia | EspoCRM nativo | Personalización requerida | Tipo de sincronización | Prioridad |
|---|---|---|---|---|---|
| **Client (cliente aprobado)** | `clientsApi.js`, `requests.service.js` | Account + Contact | Campo custom `famspi_id`, `ruc_hash` | React → EspoCRM ✅ implementado | **Alta — hecho** |
| **Prospect** | `Clientes.jsx` campo `is_prospect` | Lead | Campo custom `famspi_prospect_id` | React → EspoCRM unidireccional | Alta |
| **Opportunity (FamSheet)** | `opportunitiesApi.js`, migración 189 | Opportunity | 7 stages, `singular_objective`, `total_score`, `competitive_position` | React → EspoCRM ✅ parcial | **Alta — parcial** |
| **Account** | migración 189 | Account | Campo `famspi_account_id` | React → EspoCRM | Alta |
| **Contact** | migración 189 | Contact | Campo `famspi_contact_id`, `buying_role`, `influence_level` | React → EspoCRM | Alta |
| **Visit (visita a cliente)** | `clientsApi.setVisitStatus()` | Meeting/Activity | Status: Planned/Held | React → EspoCRM | Media |
| **BuyingInfluence** | `OpportunityWorkspace.jsx` | Contact relacionado a Opportunity | Relación custom con rol E/T/U/C | Sync solo resumen | Media |
| **BusinessCase resultado** | `businessCaseApi.js` | Campo custom en Opportunity | `bc_status`, `bc_id`, `bc_approval_date` | Sync solo resultado final | Media |
| **RiskFlag contadores** | `OpportunityWorkspace.jsx` | Campo custom en Opportunity | `flag_count_open`, `flag_count_critical` | Sync solo contadores | Baja |
| **PrivatePurchase (DELIVERED)** | `privatePurchasesApi.js` | Activity o campo en Opportunity | `private_purchase_status: delivered` | Sync solo resultado | Baja |
| **EquipmentPurchase (entregado)** | `equipmentPurchasesApi.js` | Campo custom en Opportunity | `equipment_purchase_status` | Sync solo resultado | Baja |
| **Schedule/Visitas planificadas** | `schedulesApi.js` | Meeting list | Sin equivalente nativo completo | Solo lectura en EspoCRM | Baja |
| **Dashboard KPIs** | `dashboardApi.js` | Dashboard EspoCRM Reports | Reporte personalizado | Cada sistema tiene su view | Baja |

---

## 10. Roles FamSPI → Teams/Roles EspoCRM

| Rol FamSPI | Team EspoCRM | Rol EspoCRM |
|---|---|---|
| `comercial`, `asesor_comercial` | Team: Comercial | Sales Representative |
| `jefe_comercial`, `jefe_de_comercial` | Team: Jefatura Comercial | Sales Manager |
| `backoffice_comercial` | Team: Backoffice | Support |
| `acp_comercial` | Team: ACP | Specialist |
| `gerencia`, `gerente_general`, `director` | Team: Gerencia | Executive |
| `ti`, `admin`, `administrador` | — | Administrator (EspoCRM) |

---

## 11. Personalizaciones recomendadas en EspoCRM

### 11.1 Sin código (configuración UI de EspoCRM)

- Renombrar entity Opportunity → "FamSheet" / "Oportunidad Comercial"
- Crear los 7 stages exactos en Administration → Opportunity Stages
- **Campos custom en Opportunity:**
  - `singular_objective` (Text)
  - `total_score` (Integer 0-100)
  - `competitive_position` (Enum: unique/dominant/shared/zero)
  - `famspi_opportunity_id` (Text, readonly) ← clave de deduplicación
  - `bc_status` (Enum: none/in_progress/approved/rejected)
  - `purchase_type` (Enum: none/public/private)
  - `purchase_status` (Text, readonly)
  - `flag_count_open` (Integer, readonly)
  - `flag_count_critical` (Integer, readonly)
- **Campos custom en Account:**
  - `famspi_client_id` (Text, readonly) ← clave de deduplicación
  - `famspi_ruc` (Text, readonly)
  - `client_type` (Enum: natural/juridico)
  - `assigned_advisor_email` (Email, readonly)
- **Campos custom en Contact:**
  - `famspi_contact_id` (Text, readonly) ← clave de deduplicación
  - `buying_role` (Enum: economic/technical/user/coach)
  - `influence_level` (Enum: high/medium/low)
- Activar Kanban en Opportunity con columnas por stage
- Configurar List views con filtros por `funnel_stage`, `assigned_user`, `account`, `close_date`
- Crear Teams: Comercial, Jefatura Comercial, Backoffice, ACP, Gerencia
- Desactivar entidades irrelevantes: Invoices, Products, Orders (FamSPI los maneja)

### 11.2 Con configuración avanzada

- Workflows simples al pasar a `won` → crear Task "Iniciar proceso de compra"
- Workflows al pasar a `lost` → crear Task "Llamada de feedback"
- Reports: pipeline por asesor, win rate mensual, oportunidades vencidas sin actividad
- Email templates para seguimiento comercial

### 11.3 Con desarrollo personalizado

- Sincronización de visitas (`setVisitStatus` FamSPI → Meeting EspoCRM)
- Sincronización de prospectos como Leads en EspoCRM
- Webhook EspoCRM → Express para sincronización bidireccional futura
- Panel de lectura de Business Case en EspoCRM (solo referencia)

### 11.4 Requiere Advanced Pack

- BPM para automatizar seguimiento por etapa (recordatorios, escalaciones)
- Advanced Reports cruzados (Account + Opportunity + Activity)
- Sub-workflows condicionales

### 11.5 NO implementar en EspoCRM

- Flujo completo de Business Case (10 tipos de permisos, cálculos financieros)
- Flujo completo de Compras Privadas (39 estados, firma digital)
- Flujo completo de Compras Públicas (SERCOP)
- Módulo de Planificación Mensual
- Módulo de Calidad (17 subprocesos)
- Módulo de Talento Humano
- Autenticación/Login (FamSPI usa Google OAuth2 propio)

---

## 12. Arquitectura de integración

```
┌─────────────────────────────────────────────────────────────────┐
│                     USUARIOS COMERCIALES                        │
│   React SPA FamSPI                  EspoCRM                    │
│   (Flujos operativos)               (Seguimiento CRM)          │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────────────────────────────────────────────┐
│              Express Backend /api/v1 (GCP Cloud Run)             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  integration_outbox (PostgreSQL)                         │   │
│  │  ┌──────────────────────┐  ┌────────────────────────┐   │   │
│  │  │ odoo.* events        │  │ crm.* events           │   │   │
│  │  │ (LEGACY — congelado) │  │ client.approved ✅     │   │   │
│  │  │ No se extiende.      │  │ client.updated ✅      │   │   │
│  │  │ ERP futuro = SAP B1  │  │ opportunity.sync ✅    │   │   │
│  │  └──────────────────────┘  │ prospect.upsert 🔲    │   │   │
│  │                             │ visit.registered 🔲   │   │   │
│  │  ┌──────────────────────┐  │ bc.status_changed 🔲  │   │   │
│  │  │ sap.* events (futuro)│  │ purchase.delivered 🔲 │   │   │
│  │  │ (SAP B1 Service Layer│  └────────────────────────┘   │   │
│  │  └──────────────────────┘                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│            crmSyncScheduler (cada 60s)                          │
└──────────────────────────┬───────────────────────────────────────┘
                           │ REST API X-Api-Key
                           ▼
              ┌────────────────────────────┐
              │   EspoCRM /api/v1/         │
              │   localhost:8081 (testing) │
              │   crm.fam-project.com      │
              │   (producción)             │
              └──────────┬─────────────────┘
                         │
                         ▼
              ┌────────────────────────────┐
              │   Aiven MySQL              │
              │   (laravel_crm DB)         │
              │   mysql-389dbc74-fam-...   │
              └────────────────────────────┘

FUTURO (ERP):
FamSPI → integration_outbox → sap.* events → Middleware SAP → SAP B1 Service Layer
EspoCRM → Webhook → Middleware SAP → SAP B1 Service Layer

FUTURO (Workspace):
EspoCRM → Google Workspace (Drive, Calendar, Gmail)

LEGACY (no extender):
FamSPI → integration_outbox → odoo.* events → Odoo (congelado)
```

### Estado actual de implementación

| Componente | Archivo | Estado |
|---|---|---|
| `mysql2` en backend | `backend/package.json` | ✅ Instalado |
| `crmDb.js` (config HTTP) | `backend/src/config/crmDb.js` | ✅ Listo |
| `crm.service.js` (REST API EspoCRM) | `backend/src/modules/integrations/crm.service.js` | ✅ Listo |
| `integrationOutboxWorker` extendido | `backend/src/modules/integrations/integrationOutboxWorker.service.js` | ✅ Listo |
| `crmSyncScheduler.js` | `backend/src/jobs/crmSyncScheduler.js` | ✅ Listo |
| Job registrado en server.js | `backend/src/server.js` | ✅ Listo |
| Hook aprobación cliente | `backend/src/modules/requests/requests.service.js` | ✅ Listo |
| Hook update cliente | `backend/src/modules/clients/clients.service.js` | ✅ Listo |
| Hook opportunity create/update | `backend/src/modules/opportunities/opportunities.service.js` | ✅ Listo |
| CORS actualizado | `backend/src/config/security.js` | ✅ Listo |
| Migración 201 ejecutada | `backend/migrations/201_crm_sync_tracking.sql` | ✅ Ejecutada |
| Scripts backfill | `backend/scripts/backfill_crm_clients.js`, `backfill_crm_accounts.js` | ✅ Listo |
| Variables CRM en .env | `backend/.env` | ✅ Configurado |
| EspoCRM en Docker | `espocrm/docker-compose.yml` | ✅ Corriendo |
| API Key EspoCRM | `.env` `CRM_API_KEY` | ✅ Configurado |
| Test E2E verificado | — | ✅ Pasado |

---

## 13. Fuente de verdad por entidad

| Entidad | Fuente de verdad | Sistema secundario | Sincronización | Justificación |
|---|---|---|---|---|
| **Cliente aprobado** | FamSPI (PostgreSQL) | EspoCRM (réplica) | React → EspoCRM, asíncrona, outbox | FamSPI tiene proceso aprobación formal LOPDP + Drive |
| **Prospecto** | FamSPI | EspoCRM (Lead) | React → EspoCRM, unidireccional | Conversión prospect→cliente es interna FamSPI |
| **Oportunidad/FamSheet** | FamSPI (PostgreSQL) | EspoCRM (Opportunity) | React → EspoCRM, unidireccional | Modelo BlueSheet completo (8 tabs) solo existe en FamSPI |
| **Account (empresa)** | FamSPI | EspoCRM | React → EspoCRM | Empresas se crean desde solicitudes de cliente |
| **Contacto** | FamSPI | EspoCRM | React → EspoCRM | Contactos derivan de clientes aprobados |
| **Business Case** | FamSPI (solo) | — | No sincronizar | Lógica financiera compleja, permisos granulares |
| **Compra Privada** | FamSPI (solo) | EspoCRM (solo resultado) | Solo `DELIVERED` → Activity | 39 estados son proceso operativo interno |
| **Compra Pública** | FamSPI (solo) | EspoCRM (solo resultado) | Solo resultado → campo en Opportunity | Proceso SERCOP regulado |
| **Visita a cliente** | FamSPI | EspoCRM (Activity) | React → EspoCRM | EspoCRM centraliza timeline CRM |
| **Usuarios** | FamSPI (Google OAuth) | EspoCRM (manual) | Sin sincronización automática | Auth es Google OAuth propio |
| **Roles** | FamSPI (JWT claims) | EspoCRM (Teams/Roles) | Sin sincronización | Sistemas de permisos independientes |
| **Documentos** | Google Drive (vía FamSPI) | EspoCRM (solo URLs) | URL → campo en Account/Opportunity | Documentos físicos en Drive |

---

## 14. Brechas detectadas (pendientes de corregir)

| Brecha | Detalle | Severidad | Estado |
|---|---|---|---|
| **Credenciales en `.env` commiteado** | Password Aiven MySQL y API key EspoCRM expuestos | Crítica | 🔲 Pendiente |
| **Identificador frágil en EspoCRM** | Usar `description` como búsqueda es propenso a duplicados — necesita campo custom `famspi_id` | Alta | 🔲 Pendiente |
| **Validación teléfono ecuatoriano** | EspoCRM rechaza `09XXXXXXXX` — teléfonos no se sincronizan | Alta | 🔲 Pendiente |
| **Sin HTTPS para EspoCRM** | `localhost:8081` sin TLS — no apto para producción | Alta | 🔲 Pendiente |
| **Sin mapeo de usuarios** | Oportunidades se crean sin `assignedUser` en EspoCRM | Media | 🔲 Pendiente |
| **Sin sync de prospectos** | El módulo de prospectos de FamSPI no tiene hook CRM | Media | 🔲 Pendiente |
| **Sin sync de visitas** | Visitas de FamSPI no llegan como Activities a EspoCRM | Media | 🔲 Pendiente |
| **Roles no mapeados en EspoCRM** | 20+ roles FamSPI sin Teams configurados en EspoCRM | Media | 🔲 Pendiente |
| **Deduplicación débil** | `contains` en `description` puede generar duplicados con IDs similares | Media | 🔲 Pendiente |
| **Business Case sin estado EspoCRM** | Estado BC no llega a EspoCRM al completarse | Baja | 🔲 Pendiente |
| **Compras sin estado final en EspoCRM** | `DELIVERED` no se refleja en Opportunity | Baja | 🔲 Pendiente |

---

## 15. Riesgos técnicos

### Funcionales
- Usuarios podrían usar EspoCRM en paralelo y crear duplicados
- Inconsistencia entre sistemas hasta la próxima sincronización (máx. 60 segundos)

### Datos
- Campos sensibles (RUC, email, teléfono) viajan sin cifrar al webhook EspoCRM
- Duplicados posibles si el mismo cliente fue sincronizado previamente desde el legacy Odoo y ahora llega desde FamSPI con diferente `external_source`

### Seguridad
- JWT en `localStorage` — vulnerabilidad XSS
- API key y credenciales MySQL en `.env` commiteado en Git
- EspoCRM sin TLS en entorno actual

### Experiencia de usuario
- Riesgo de que equipo comercial abandone FamSPI y use solo EspoCRM, perdiendo flujos de BC y Compras

### Rendimiento
- Pool MySQL Aiven con 5 conexiones puede saturarse con eventos concurrentes

---

## 16. Estrategia de integración sin afectar flujos actuales

**Principio:** EspoCRM recibe datos de FamSPI. FamSPI nunca consulta EspoCRM para funcionar.

**Interruptor de emergencia:** `CRM_SYNC_ENABLED=false` en `.env` apaga toda sincronización en segundos.

**Protección técnica ya implementada:**
```javascript
// En requests.service.js, clients.service.js, opportunities.service.js:
if (isCrmSyncEnabled()) {
  try {
    await enqueueIntegrationEvent({ ... }); // solo escribe en PostgreSQL local
  } catch (crmErr) {
    logger.warn(...);
    // El catch absorbe el error — la operación original ya fue completada
  }
}
```

---

## 17. Plan de implementación por fases

### ✅ Fase 0 — Estado actual (completado)

**Ya implementado y funcionando:**
- EspoCRM corriendo en Docker (`localhost:8081`)
- Base de datos: Aiven MySQL (`laravel_crm`)
- API Key: `05cc9868107fe04447a0dadbc4cf146b`
- Credenciales admin: `admin / FamSPI2026!`
- Sync activo: `CRM_SYNC_ENABLED=true`
- Test E2E pasado: Account + Contact + Opportunity se crean correctamente en EspoCRM

---

### ✅ Fase 1 — Auditoría y corrección de brechas críticas — COMPLETADA 2026-06-12

**Tareas ejecutadas:**
1. ✅ `espocrm/.env` separado con credenciales. `docker-compose.yml` sin secrets hardcodeados. `espocrm/.env` agregado a `.gitignore`.
2. ✅ 15 campos custom creados en EspoCRM vía API:
   - **Contact:** `cFamspiId` (varchar), `cBuyingRole` (enum), `cInfluenceLevel` (enum)
   - **Account:** `cFamspiClientId` (varchar), `cFamspiRuc` (varchar), `cClientType` (enum), `cAssignedAdvisorEmail` (varchar)
   - **Opportunity:** `cFamspiOpportunityId` (varchar), `cSingularObjective` (text), `cTotalScore` (int), `cCompetitivePosition` (enum), `cBcStatus` (enum), `cPurchaseType` (enum), `cFlagCountOpen` (int), `cFlagCountCritical` (int)
   - Nota: EspoCRM agrega prefijo `c` a todos los campos custom.
3. ✅ `crm.service.js` reescrito para usar `cFamspiId`, `cFamspiClientId`, `cFamspiOpportunityId` como claves de deduplicación.
4. ✅ Teléfonos omitidos del payload (EspoCRM rechaza formato ecuatoriano `09XXXXXXXX`).
5. ⚠️ TLS pendiente para producción (Fase 9). No aplica para entorno de testing local.

**Test E2E pasado:**
- `sendClientApproved`: `created` en primera llamada ✅
- `sendClientUpdated`: `updated` (mismo contactId) ✅
- `sendOpportunitySync`: `created` con todos los campos custom ✅
- Segunda llamada `sendClientApproved` mismo ID: `updated` sin duplicado ✅

**Módulos modificados:** `backend/src/modules/integrations/crm.service.js`, `espocrm/docker-compose.yml`, `.gitignore`

---

### ✅ Fase 2 — Diseño del modelo EspoCRM — COMPLETADA 2026-06-12

**Tareas ejecutadas:**

**Stages de Opportunity (12 etapas en EspoCRM con 7 macro-etapas FamSPI):**
```
Prospeccion               → macro `prospect`
Asignado                  → macro `prospect` (manual en EspoCRM)
En Seguimiento            → macro `qualify`
Lead Calificado           → macro `qualify` (manual en EspoCRM)
Analisis de Necesidades   → macro `pursue`
Desarrollo de Oferta      → macro `pursue` (manual en EspoCRM)
Presentacion de Propuesta → macro `close`
Negociacion               → macro `close` (manual en EspoCRM)
Contratos                 → macro `close` (manual en EspoCRM)
Cerrado Ganado            → macro `won`
Cerrado Perdido           → macro `lost`
Archivado                 → macro `archived`
```

**15 campos custom creados y activos** (EspoCRM agrega prefijo `c`):
- **Opportunity:** `cFamspiOpportunityId`, `cSingularObjective`, `cTotalScore`, `cCompetitivePosition`, `cBcStatus`, `cPurchaseType`, `cFlagCountOpen`, `cFlagCountCritical`
- **Account:** `cFamspiClientId`, `cFamspiRuc`, `cClientType`, `cAssignedAdvisorEmail`
- **Contact:** `cFamspiId`, `cBuyingRole`, `cInfluenceLevel`

**5 Teams creados:**
- Comercial (`6a2bf3044177fe38f`)
- Jefatura Comercial (`6a2bf3070a562d3df`)
- Backoffice (`6a2bf309c91471810`)
- ACP (`6a2bf30ca022b2a2c`)
- Gerencia (`6a2bf30f4943fdf44`)

**5 Roles FAM creados y asignados a sus Teams:**
- Asesor Comercial FAM → Team Comercial
- Jefe Comercial FAM → Team Jefatura Comercial
- Backoffice FAM → Team Backoffice
- ACP FAM → Team ACP
- Gerencia FAM → Team Gerencia

**Layouts personalizados** copiados via `docker cp` (sin BOM) en `/var/www/html/custom/Espo/Custom/Resources/layouts/`:
- `Opportunity/detail.json` — 17 campos, 9 FAM custom (`cFamspiOpportunityId`, `cTotalScore`, `cSingularObjective`, `cCompetitivePosition`, `cBcStatus`, `cPurchaseType`, `cFlagCountOpen`, `cFlagCountCritical`) ✅
- `Opportunity/list.json` — columnas: name, account, stage, amount, cTotalScore, closeDate, assignedUser ✅
- `Contact/detail.json` — incluye `cFamspiId`, `cBuyingRole`, `cInfluenceLevel` ✅
- `Account/detail.json` — incluye `cFamspiClientId`, `cFamspiRuc`, `cClientType`, `cAssignedAdvisorEmail` ✅
- `Account/list.json` — columnas: name, cFamspiClientId, cClientType, billingAddressCity, cAssignedAdvisorEmail ✅
- Archivos fuente guardados en `espocrm/layouts/` para persistencia entre reinicios del contenedor.

**Nota importante:** Los archivos de layout viven en el volumen Docker `espocrm_custom`. Si se recrea el contenedor, ejecutar: `docker cp espocrm/layouts/. fam_espocrm:/var/www/html/custom/Espo/Custom/Resources/layouts/` seguido de `POST /api/v1/Admin/clearCache`.

**Rebuild + clear cache:** ejecutados ✅

**Pendiente manual (UI de EspoCRM):**
- Configurar menú de navegación (ocultar Invoices, Products, Orders, Cases) — el API no expone este endpoint
- Activar vista Kanban en Opportunity — requiere UI admin

**Módulos modificados:** EspoCRM vía API + archivos de layout en Docker volume

---

### ✅ Fase 3 — Personalización UI de EspoCRM — COMPLETADA 2026-06-12

**Entorno detectado:** EspoCRM **9.3.8**, idioma `es_MX`, moneda `USD`. **Sin Advanced Pack** → Workflows y BPM NO disponibles (se documentan como Fase 11.4 / desarrollo futuro).

**Tareas ejecutadas (todas vía API `PUT /api/v1/Settings` + metadata custom):**

1. ✅ **Kanban con 12 columnas** y colores activo (pipeline expandido FamSPI) — incluye `Cerrado Perdido` (corregido `kanbanStatusIgnoreList: []`)
2. ✅ **Menú de navegación limpio** — visibles solo: Account, Contact, Lead, Opportunity, Meeting, Call, Task, Email, Calendar, User, Team. **Ocultos:** Case, KnowledgeBaseArticle, Campaign, TargetList, Document, Invoice, Product, Order (FamSPI los maneja)
3. ✅ **Filtros de lista Opportunity:** `open`, `won` (verde), `lost` (rojo) + bool filter `onlyMy` ("mis oportunidades")
4. ✅ **Dashboard por defecto** con 2 pestañas:
   - **Pipeline Comercial:** SalesPipeline (funnel), OpportunitiesByStage, SalesByMonth, Activities
   - **Mi Trabajo:** Tasks, Stream
5. ✅ **Branding:** applicationName = "FAM CRM", quickCreateList = Opportunity/Lead/Contact/Account/Meeting/Call/Task
6. ✅ **Roles y permisos por Team** (ya configurados en Fase 2)

**Notas:**
- El filtro custom "active" (stages en proceso) requería una clase PHP → descartado. Los 3 filtros core + Kanban + onlyMy cubren las necesidades sin código.
- El `dashboardLayout` es el **default para usuarios nuevos**. El admin conserva su dashboard actual hasta resetearlo manualmente.
- Workflows (recordatorios al pasar a `close`, notificación al `won`) → **requieren Advanced Pack**. Alternativa: la lógica de negocio vive en el backend FamSPI (`crm.service.js`).

**Archivos de metadata persistentes:** `espocrm/metadata/clientDefs/Opportunity.json` (kanban + filtros), `espocrm/metadata/entityDefs/Opportunity.json` (12 etapas)

**Hooks EspoCRM configurados en backend:** `backend/scripts/setup_crm_pipeline.js` crea/actualiza webhooks `Opportunity:create` y `Opportunity:update` hacia `POST /api/v1/integrations/crm/webhook`, resueltos por `crmWebhook.routes.js`, `crmWebhook.controller.js` y `crmWebhook.service.js`.

**Módulos modificados:** EspoCRM Settings vía API + `espocrm/metadata/`

---

### ✅ Fase 3.5 — Google Workspace Bridge + Pipeline Bitrix — COMPLETADA 2026-06-12

**Contexto:** EspoCRM open source no tiene licencia para Workflows ni integración nativa con Google. Se implementó el backend FamSPI como capa puente: EspoCRM llama al backend via webhook, el backend ejecuta las acciones en Google Workspace usando las APIs ya integradas.

**Pipeline actualizado — 12 etapas (reemplaza Bitrix y las 9 etapas previas):**

| # | Etapa EspoCRM | Bitrix equivalente | FamSPI macro | Mueve |
|---|---|---|---|---|
| 1 | Prospeccion | Inicio | `prospect` | FamSPI |
| 2 | Asignado | Asignado | `prospect` | Solo EspoCRM |
| 3 | En Seguimiento | En seguimiento | `qualify` | FamSPI |
| 4 | Lead Calificado | Lead Calificado | `qualify` | Solo EspoCRM |
| 5 | Analisis de Necesidades | Análisis de oportunidad | `pursue` | FamSPI |
| 6 | Desarrollo de Oferta | Desarrollo de la oferta | `pursue` | Solo EspoCRM |
| 7 | Presentacion de Propuesta | Presentación de propuesta | `close` | FamSPI |
| 8 | Negociacion | Negociación | `close` | Solo EspoCRM |
| 9 | Contratos | Contratos | `close` | Solo EspoCRM |
| 10 | Cerrado Ganado | Cerrar negociación | `won` | FamSPI |
| 11 | Cerrado Perdido | — | `lost` | FamSPI |
| 12 | Archivado | — | `archived` | FamSPI |

**Acciones Google por etapa (FamSPI outbox → crm.service.js):**
- `prospect` (nuevo): Drive — crear carpeta prospecto en `DRIVE_CRM_PROSPECTS_FOLDER_ID`
- `pursue`: Calendar — evento "Análisis de Necesidades" para el asesor (+1 día)
- `close`: Calendar — evento presentación en `target_close_date` + Gmail a `CRM_NOTIFY_JEFE_COMERCIAL`
- `won`: Gmail a jefe+gerencia + Calendar kickoff (+7 días) + Drive carpeta Proyecto
- `lost`: Gmail a jefe + Calendar llamada feedback (+3 días)

**Acciones Google por etapa (EspoCRM webhook → crmWebhook.service.js):**
- `Asignado`: Calendar — recordatorio al asesor asignado (+3 días)
- `Lead Calificado`: Gmail a `CRM_NOTIFY_JEFE_COMERCIAL`
- `Desarrollo de Oferta`: Drive — copiar template oferta desde `DRIVE_TEMPLATE_OFERTA_ID` a carpeta prospecto
- `Negociacion`: Gmail a jefe + gerencia
- `Contratos`: Drive — subcarpeta Contratos + Gmail a `CRM_NOTIFY_BACKOFFICE`

**Deduplicación:** Cache in-memory por `oppId:stage` con TTL de 30 min. Evita acciones duplicadas en reintentos del outbox o múltiples webhooks rápidos.

**Archivos nuevos/modificados:**
- `backend/src/modules/integrations/crm.service.js` — STAGE_TO_MACRO 12 etapas + `triggerGoogleActionsForFamStage()`
- `backend/src/modules/integrations/crmWebhook.service.js` — NEW
- `backend/src/modules/integrations/crmWebhook.controller.js` — NEW
- `backend/src/modules/integrations/crmWebhook.routes.js` — NEW
- `backend/src/routes/registerRoutes.js` — ruta pública webhook
- `backend/src/modules/opportunities/opportunities.service.js` — payload outbox + `account_name`, `owner_name`, `singular_objective`, `total_score`
- `espocrm/metadata/entityDefs/Opportunity.json` — NEW (12 etapas con probabilidades)
- `backend/scripts/setup_crm_pipeline.js` — NEW (docker cp + webhooks + clear cache)
- `backend/.env` — vars nuevas: `CRM_ADMIN_USER`, `CRM_ADMIN_PASS`, `CRM_WEBHOOK_SECRET`, `CRM_NOTIFY_*`, `DRIVE_CRM_PROSPECTS_FOLDER_ID`, `DRIVE_TEMPLATE_OFERTA_ID`

**Variables de entorno requeridas para acciones Google:**
```
CRM_WEBHOOK_SECRET=<secret>            # Validación webhook EspoCRM → backend
CRM_NOTIFY_JEFE_COMERCIAL=email@...    # Notificaciones jefe comercial
CRM_NOTIFY_GERENCIA=email@...          # Notificaciones gerencia
CRM_NOTIFY_BACKOFFICE=email@...        # Notificaciones backoffice
DRIVE_CRM_PROSPECTS_FOLDER_ID=<id>     # Carpeta raíz Drive para prospectos CRM
DRIVE_TEMPLATE_OFERTA_ID=<id>          # Template Drive para docs de oferta (opcional)
```

**Webhooks EspoCRM (pendiente configuración manual en dev — automático en producción):**
```
Ruta: POST /api/v1/integrations/crm/webhook
Validación: header X-Hook-Secret = CRM_WEBHOOK_SECRET
Configurar en: EspoCRM → Administración → Webhooks
  - Nombre: FamSPI Opportunity Create | Entity: Opportunity | Event: create
  - Nombre: FamSPI Opportunity Update | Entity: Opportunity | Event: update
  - Headers en ambos: X-Hook-Secret: {CRM_WEBHOOK_SECRET}
URL producción: https://spi-backend-983537733948.us-central1.run.app/api/v1/integrations/crm/webhook
```

**Setup ejecutado:**
```bash
node scripts/setup_crm_pipeline.js  # copia entityDefs + intenta crear webhooks + clear cache
```

---

### ✅ Fase 4 — Backfill histórico — IMPLEMENTADA 2026-06-12

**Objetivo:** Poblar EspoCRM con datos históricos de FamSPI.

**Scripts reescritos** (usan `config/db.js` directamente — mismo pool que la app):

```bash
# Ejecutar desde el servidor con acceso a Neon DB (GCP Cloud Run o tunel)
cd backend/

node scripts/backfill_crm_clients.js --dry-run        # verificar
node scripts/backfill_crm_clients.js                  # clientes aprobados → Account + Contact

node scripts/backfill_crm_accounts.js --dry-run       # verificar
node scripts/backfill_crm_accounts.js                 # cuentas de oportunidades → Account

node scripts/backfill_crm_opportunities.js --dry-run  # verificar
node scripts/backfill_crm_opportunities.js            # FamSheets → Opportunity
node scripts/backfill_crm_opportunities.js --stage=pursue  # filtro por etapa
```

**Nota:** Los scripts requieren acceso a Neon DB. Localmente `DB_HOST=localhost` no tiene la base activa. Ejecutar en GCP Cloud Run o via Neon tunneling.

**Archivos:** `scripts/backfill_crm_clients.js`, `scripts/backfill_crm_accounts.js`, `scripts/backfill_crm_opportunities.js`

---

### ✅ Fase 5 — Sincronización completa — IMPLEMENTADA 2026-06-12

**Objetivo:** Activar todos los flujos de sincronización pendientes.

**Implementado:**

1. ✅ **Sync de visitas** — `upsertVisitStatus()` en `clients.service.js` → evento `crm.visit.registered` → `sendVisitSync()` → EspoCRM Meeting (Held/Planned/Not Held)
2. ✅ **Sync de prospectos** — Al crear `client_request` en `requests.service.js` → evento `crm.prospect.upsert` → `sendProspectSync()` → EspoCRM Lead
3. ✅ **Outbox worker** — Casos `crm.visit.registered` y `crm.prospect.upsert` añadidos en `integrationOutboxWorker.service.js`
4. ✅ **crm.service.js** — Funciones `sendVisitSync()` y `sendProspectSync()` implementadas

**Pendiente (menor):**
- 🔲 Sync BC resultado al aprobar/rechazar → evento `crm.bc.status_changed`
- 🔲 Sync compra entregada al `DELIVERED` → evento `crm.purchase.delivered`
- 🔲 Endpoint `GET /api/v1/integrations/crm/status` para monitoreo TI

**Mapa de entidades sync activo:**

| Evento FamSPI | Evento outbox | Handler | EspoCRM |
|---|---|---|---|
| Cliente aprobado | `crm.client.approved` | `sendClientApproved` | Account + Contact |
| Cliente actualizado | `crm.client.updated` | `sendClientUpdated` | Contact |
| Oportunidad creada/editada | `crm.opportunity.sync` | `sendOpportunitySync` | Opportunity |
| Visita registrada | `crm.visit.registered` | `sendVisitSync` | Meeting |
| Solicitud de cliente (nueva) | `crm.prospect.upsert` | `sendProspectSync` | Lead |

---

### 🔲 Fase 6 — Piloto con usuarios comerciales

**Objetivo:** Validar adopción y utilidad de EspoCRM con 3-5 asesores reales.

**Tareas:**
- Capacitación: qué hacer en FamSPI (operativo) vs EspoCRM (seguimiento)
- Cada asesor registra en EspoCRM: llamadas, emails, reuniones, tareas
- Feedback semanal estructurado
- Ajustar layouts y campos según feedback
- Métricas: % de Opportunities con actividades registradas en EspoCRM

**Criterio de éxito:** 80% de oportunidades activas tienen al menos 1 actividad registrada en EspoCRM en el primer mes

**Resultado esperado:** Validación de valor real del CRM en el proceso comercial FAM

---

### 🔲 Fase 7 — Integración con Google Workspace

**Objetivo:** Enriquecer el timeline CRM con herramientas Google ya usadas.

**Tareas:**
- Conectar Gmail en EspoCRM (Administration → Email → Gmail OAuth)
- Sincronizar Google Calendar con Meetings de EspoCRM
- Vincular Google Drive documents como campos en Account/Opportunity
- Nota: FamSPI ya usa Drive (`GDRIVE_FOLDER_*` configurado) — EspoCRM referencia URLs

**Resultado esperado:** Timeline de actividades con emails y calendarios integrados

---

### 🔲 Fase 8 — Preparación para SAP Business One

**Objetivo:** Preparar el modelo EspoCRM para integrarse con SAP B1 en el futuro.

**Arquitectura futura:**
```
React App (FamSPI)
    ↓
Express Backend /api/v1
    ↓
integration_outbox (PostgreSQL)
    ↓ crmSyncScheduler
EspoCRM (CRM layer)
    ↓ webhook futuro
Middleware SAP (Express o Laravel)
    ↓ HTTP Service Layer
SAP Business One
```

**Campos a preparar en EspoCRM:**
- `sap_business_partner_id` en Account (se llenará cuando se sincronice con SAP)
- `sap_sales_order_id` en Opportunity (cuando `won` genere orden en SAP)
- `sap_sync_status` (Enum: pending/synced/error)

**Entidades que llegarían a SAP B1 (futuro):**
- Account → Business Partner (BP)
- Opportunity `won` → Quotation / Sales Order
- Contact → Contact Person de BP
- Documento adjunto → Attachment en SAP

**Resultado esperado:** EspoCRM listo para recibir IDs de SAP cuando la integración se implemente

---

### 🔲 Fase 9 — Puesta en producción

**Objetivo:** EspoCRM accesible para todo el equipo comercial en producción.

**Tareas:**
1. Desplegar EspoCRM en GCP Cloud Run (mismo proveedor que FamSPI)
2. Configurar dominio `crm.fam-project.com` con TLS
3. Agregar URI callback Google OAuth para EspoCRM en Google Cloud Console
4. Actualizar `CRM_BASE_URL=https://crm.fam-project.com` en `.env` producción FamSPI
5. `crm.fam-project.com` ya está en CORS whitelist (`backend/src/config/security.js`)
6. Ejecutar backfill final de datos

**Comandos de deploy:**
```bash
gcloud builds submit --tag gcr.io/[PROJECT_ID]/espocrm:v1.0.0
gcloud run deploy espocrm \
  --image espocrm/espocrm:latest \
  --region us-central1 \
  --min-instances 1 \
  --memory 512Mi \
  --set-env-vars "ESPOCRM_DATABASE_HOST=mysql-389dbc74-fam-27fd.b.aivencloud.com"
```

**Resultado esperado:** EspoCRM en producción con login Google `@fam-project.com`

---

### 🔲 Fase 10 — Monitoreo y mejora continua

**Objetivo:** Mantener integración estable y evolucionar según necesidades.

**Tareas:**
- Monitorear `integration_outbox` — alertas si hay más de 50 eventos `pending` por más de 10 minutos
- Dashboard TI: conteo de eventos `dead` (fallos permanentes)
- Revisión mensual: % Opportunities sin actividad, duplicados, discrepancias
- Backlog de personalizaciones EspoCRM según feedback comercial
- Evaluación trimestral de adopción

---

## 18. Preguntas pendientes

1. ¿El equipo comercial prefiere gestionar prospectos en FamSPI o en EspoCRM como Leads?
2. ¿Cuántos clientes aprobados hay en producción actualmente para estimar tiempo del backfill?
3. ¿Hay procesos de seguimiento que hoy se hacen en Excel/WhatsApp y que EspoCRM debería absorber?
4. ¿La gerencia quiere ver el pipeline en EspoCRM, FamSPI, o ambos?
5. ¿Los asesores comerciales tienen acceso a Google Workspace con cuenta `@fam-project.com`?
6. ¿SAP Business One es una decisión confirmada? — Se asume que sí es el ERP objetivo. Confirmar para priorizar la Fase 8 y diseñar el middleware SAP desde ahora.
7. ¿Se quiere EspoCRM accesible desde móvil? (EspoCRM tiene app iOS/Android)
8. ¿Existe un proceso formal de Lead/Prospecto antes de solicitud de cliente?
9. ¿Qué nivel de adopción se espera en el piloto: solo jefatura o todos los asesores?
10. ¿Existe presupuesto para Advanced Pack de EspoCRM (BPM, Advanced Reports)?

---

## 19. Conclusión final

**Integrar EspoCRM como CRM complementario para gestión comercial**, manteniendo FamSPI como sistema principal de registro operativo.

**EspoCRM aporta lo que FamSPI no tiene hoy:**
- Timeline de actividades comerciales (llamadas, emails, reuniones)
- Kanban visual del pipeline con 7 stages
- Seguimiento de prospectos como Leads
- Win rate, velocidad de pipeline, actividad por asesor
- Acceso móvil para asesores en campo

**FamSPI conserva todo lo que no puede ir a EspoCRM:**
- Business Case (permisos, cálculos financieros, workflow)
- Compras Privadas (39 estados, firma digital)
- Compras Públicas (SERCOP)
- Planificación mensual
- Documentos Google Drive
- Control de módulos por feature flags
- Integración legacy Odoo (congelada, no se extiende)
- Integración futura SAP B1 (vía nuevos eventos `sap.*` en el outbox)

**La integración técnica ya funciona:** hooks activos en 3 services, outbox procesando cada 60s, tests E2E pasados. Solo faltan las fases de configuración EspoCRM, corrección de brechas y piloto con usuarios.

---

*Documento generado: 2026-06-12*  
*Última actualización: 2026-06-12 — v3.0: Fases 4 y 5 completadas. Backfill scripts reescritos, sync de visitas y prospectos activo.*  
*Próximo paso: Fase 6 — Piloto con usuarios comerciales + configurar webhooks manualmente en EspoCRM + ejecutar backfill en producción + llenar CRM_NOTIFY_* y DRIVE_CRM_PROSPECTS_FOLDER_ID en .env*
