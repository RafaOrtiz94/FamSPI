# Plan de Implementación: CRM-FAM

## 1. Objetivo

Implementar el módulo CRM-FAM completo con flujo Lead → Oportunidad → Proceso de compra → Business Case, incluyendo frontend, lógica de negocio backend y las integraciones necesarias con los módulos existentes de compras privadas/públicas y Business Case.

---

## 2. Estado actual

| Capa | Estado |
|------|--------|
| Backend — rutas | ✅ Completas en `crm.routes.js` |
| Backend — controller | ✅ Thin controllers (helper `respond`) |
| Backend — service | ❌ Todo 501 (sin lógica real) |
| Backend — calculators | ✅ Funciones puras listas |
| DB — schema + tablas | ✅ Migración 231 aplicada (24 tablas) |
| DB — pipeline stages seed | ⚠️ Stages incorrectos (requieren migración correctiva) |
| Frontend | ❌ No existe nada |
| Integración → compra privada/pública | ❌ No existe |
| Integración → Business Case | ❌ No existe (linkeo oportunidad→compra→BC) |

---

## 3. Etapas del pipeline (requeridas)

Reemplazar el seed actual por estas 8 etapas operativas:

| # | Nombre | Descripción | Puede iniciar compra |
|---|--------|-------------|---------------------|
| 1 | Inicio | Lead identificado, sin contacto aún | No |
| 2 | Asignado | Lead asignado a comercial responsable | No |
| 3 | En seguimiento | Contacto establecido, en proceso de cualificación | No |
| 4 | Lead calificado | Necesidad confirmada, presupuesto y autoridad validados | No |
| 5 | Análisis de la oportunidad | Levantamiento técnico completo, tipo de compra definido | **Sí** |
| 6 | Desarrollo de la oferta | BC o propuesta en elaboración | Sí |
| 7 | Presentación de la oferta | Oferta presentada al cliente | Sí |
| 8 | Negociación y contratos | Condiciones en negociación, contrato en proceso | Sí |

Etapas terminales (mantener): `Cierre ganado`, `Cierre perdido`, `Suspendida`

---

## 4. Flujo completo

```
[Lead creado por comercial]
        ↓
[Asignar lead → comercial / jefe_comercial]
        ↓
[Convertir lead → crea Account + Contact + Opportunity en etapa "Lead calificado"]
        ↓
[Avanzar oportunidad → "Análisis de la oportunidad"]
        ↓
[Botón "Iniciar proceso de compra"] → elige tipo:
    ├─ Compra Pública → [private_purchase_request offer_kind=compra_publica]
    │       └─ Si comodato → BC creado automáticamente (flujo ya existe)
    └─ Compra Privada → [private_purchase_request offer_kind=comodato|venta|alquiler...]
            └─ Si comodato → BC creado via "Requerimientos → Comodato"
        ↓
[Opportunity linkea a purchase_request + BC si aplica]
        ↓
[Oportunidad avanza a "Desarrollo de la oferta" automáticamente]
```

---

## 5. Cambios de DB requeridos

### Migración 233 — pipeline stages correctivos

```sql
-- 233_crm_pipeline_stages_update.sql
-- Vaciar stages del seed anterior y cargar stages operativos
DELETE FROM crm.crm_pipeline_stages;

INSERT INTO crm.crm_pipeline_stages
  (id, name, description, order_index, probability_default, requires_blue_sheet, can_start_purchase, is_active)
VALUES
  (gen_random_uuid(), 'Inicio',                      'Lead identificado, sin contacto aún',                          1,  5,   false, false, true),
  (gen_random_uuid(), 'Asignado',                    'Lead asignado a comercial responsable',                        2,  10,  false, false, true),
  (gen_random_uuid(), 'En seguimiento',              'Contacto establecido, cualificación en curso',                 3,  20,  false, false, true),
  (gen_random_uuid(), 'Lead calificado',             'Necesidad, presupuesto y autoridad confirmados',               4,  35,  false, false, true),
  (gen_random_uuid(), 'Análisis de la oportunidad', 'Levantamiento técnico completo, tipo de compra definido',      5,  50,  false, true,  true),
  (gen_random_uuid(), 'Desarrollo de la oferta',    'BC o propuesta técnica en elaboración',                        6,  65,  true,  true,  true),
  (gen_random_uuid(), 'Presentación de la oferta',  'Oferta presentada al cliente',                                 7,  75,  true,  true,  true),
  (gen_random_uuid(), 'Negociación y contratos',    'Condiciones en negociación, contrato en proceso',              8,  85,  true,  true,  true),
  (gen_random_uuid(), 'Cierre ganado',              'Oportunidad ganada y contrato firmado',                        9,  100, false, false, true),
  (gen_random_uuid(), 'Cierre perdido',             'Oportunidad perdida',                                          10, 0,   false, false, true),
  (gen_random_uuid(), 'Suspendida',                 'Proceso pausado temporalmente',                                11, 0,   false, false, true);
```

### Migración 234 — columna can_start_purchase + linkeo oportunidad→compra

```sql
-- 234_crm_opportunity_purchase_link.sql

-- Agregar flag can_start_purchase a pipeline_stages (si no existe)
ALTER TABLE crm.crm_pipeline_stages
  ADD COLUMN IF NOT EXISTS can_start_purchase BOOLEAN DEFAULT false;

-- Linkear oportunidad con purchase_request y BC
ALTER TABLE crm.crm_opportunities
  ADD COLUMN IF NOT EXISTS purchase_request_id UUID REFERENCES public.private_purchase_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_case_id    UUID REFERENCES public.equipment_purchase_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_type       VARCHAR(50),   -- 'publica' | 'privada'
  ADD COLUMN IF NOT EXISTS purchase_offer_kind VARCHAR(50);  -- 'comodato' | 'venta' | 'alquiler' etc
```

---

## 6. Backend — lógica a implementar (crm.service.js)

### 6.1 Leads

| Método | Descripción |
|--------|-------------|
| `listLeads(filters, user)` | Lista leads con filtros: assigned_to, stage, created_by, fecha |
| `getLeadById(id)` | Detalle + historial de actividad |
| `createLead(data, user)` | Crea lead, stage inicial = "Inicio", assigned_to = creador |
| `updateLead(id, data, user)` | Actualiza datos básicos del lead |
| `assignLead(id, assignedToUserId, user)` | Asigna lead a comercial/jefe_comercial — avanza stage a "Asignado" si estaba en "Inicio" |
| `convertLead(id, data, user)` | Convierte: crea Account + Contact + Opportunity en stage "Lead calificado" — marca lead como converted |
| `disqualifyLead(id, reason, user)` | Descalifica lead con motivo |

### 6.2 Accounts + Contacts

CRUD estándar. Accounts ligan a `clients` existentes via `client_id` (FK opcional).

### 6.3 Opportunities

| Método | Descripción |
|--------|-------------|
| `listOpportunities(filters, user)` | Lista con filtros: stage, assigned_to, account_id, fecha |
| `getOpportunityById(id)` | Detalle + stage actual + health score + linked purchases |
| `createOpportunity(data, user)` | Crea oportunidad vinculada a account |
| `changeStage(id, stageId, user)` | Avanza/retrocede stage; valida si puede_iniciar_compra |
| `startPurchaseProcess(id, purchaseType, offerKind, user)` | **Nuevo** — desde stage "Análisis de la oportunidad" en adelante: crea purchase_request y vincula |
| `closeWon(id, data, user)` | Cierra ganada — vincula contrato |
| `closeLost(id, lostReasonId, notes, user)` | Cierra perdida con motivo |
| `getOpportunityHealth(id)` | Calcula health score via calculators |

### 6.4 Nuevo endpoint: startPurchaseProcess

```
POST /api/v1/crm-fam/opportunities/:id/start-purchase
Body: { purchase_type: 'publica'|'privada', offer_kind: 'comodato'|'venta'|'alquiler'|'alquiler_con_transferencia' }
Roles: crmRoles
```

**Lógica:**
1. Valida que oportunidad esté en stage ≥ "Análisis de la oportunidad" (`can_start_purchase = true`)
2. Valida que no tenga ya un purchase_request vinculado (idempotente)
3. Llama `privatePurchasesService.createPurchaseRequest(...)` con datos de la oportunidad/account
4. Si `offer_kind = 'comodato'` → llama `privatePurchasesService.ensureBusinessCaseForComodato(...)` automáticamente
5. Actualiza `crm_opportunities.purchase_request_id` y `business_case_id`
6. Avanza stage de la oportunidad a "Desarrollo de la oferta" si estaba en "Análisis de la oportunidad"
7. Retorna `{ purchase_request_id, business_case_id, opportunity_stage }`

### 6.5 Lead assignment (nuevo endpoint)

```
PUT /api/v1/crm-fam/leads/:id/assign
Body: { assigned_to_user_id: integer }
Roles: crmRoles (solo comercial puede asignar a sí mismo; jefe_comercial puede asignar a cualquiera)
```

---

## 7. Frontend — estructura de archivos

```
spi_front/src/modules/crm/
  pages/
    CRMDashboard.jsx             # Dashboard pipeline + métricas
    LeadsPage.jsx                # Lista de leads con filtros
    LeadDetailPage.jsx           # Detalle + acciones (asignar, convertir, descalificar)
    AccountsPage.jsx             # Lista de cuentas
    AccountDetailPage.jsx        # Detalle cuenta + contactos + oportunidades
    OpportunitiesPage.jsx        # Lista + vista kanban por stage
    OpportunityDetailPage.jsx    # Workspace de oportunidad
  components/
    pipeline/
      KanbanBoard.jsx            # Vista kanban de oportunidades por stage
      OpportunityCard.jsx        # Tarjeta de oportunidad en kanban
      StageProgressBar.jsx       # Barra de progreso de stages
    leads/
      LeadForm.jsx               # Crear/editar lead
      LeadAssignModal.jsx        # Modal para asignar lead a usuario
      LeadConvertModal.jsx       # Modal para convertir lead → Account + Oportunidad
    opportunities/
      StartPurchaseModal.jsx     # Modal para iniciar proceso de compra desde oportunidad
                                 # (elige tipo: pública/privada + offerKind)
      OpportunityHealthBadge.jsx # Badge color semáforo según health score
    shared/
      ActivityFeed.jsx           # Feed de actividades/notas de lead u oportunidad
  api/
    crmApi.js                    # Funciones fetch para todos los endpoints CRM
```

---

## 8. Rutas frontend

```
/dashboard/crm                               → CRMDashboard
/dashboard/crm/leads                         → LeadsPage
/dashboard/crm/leads/:id                     → LeadDetailPage
/dashboard/crm/accounts                      → AccountsPage
/dashboard/crm/accounts/:id                  → AccountDetailPage
/dashboard/crm/opportunities                 → OpportunitiesPage (kanban)
/dashboard/crm/opportunities/:id             → OpportunityDetailPage
```

Roles: `comercial, jefe_comercial, jefe_de_comercial, backoffice_comercial, asesor_comercial, analista_comercial, acp_comercial, backoffice, gerencia, gerencia_general`

---

## 9. Fases de implementación

### FASE 1 — DB + Backend core (estimado: 3-4 días)
- [ ] Migración 233: pipeline stages correctivos
- [ ] Migración 234: columna `can_start_purchase` + FKs oportunidad→compra→BC
- [ ] `crm.service.js` — implementar CRUD completo: leads, accounts, contacts, opportunities
- [ ] Endpoint `PUT /leads/:id/assign` + lógica de stage automático
- [ ] Endpoint `POST /opportunities/:id/start-purchase` + integración con privatePurchasesService
- [ ] Tests unitarios: `crm.service.test.js` para los flujos críticos (assign, convert, startPurchase)

### FASE 2 — Frontend base (estimado: 3-4 días)
- [ ] `crmApi.js` — todas las funciones de fetch
- [ ] Rutas en `AppRoutes.jsx` para módulo CRM
- [ ] `LeadsPage.jsx` + `LeadDetailPage.jsx` con acciones asignar/convertir/descalificar
- [ ] `OpportunitiesPage.jsx` — vista lista (kanban en fase 3)
- [ ] `OpportunityDetailPage.jsx` — datos básicos + stage actual + acciones
- [ ] `AccountsPage.jsx` + `AccountDetailPage.jsx`

### FASE 3 — Integración + UI avanzada (estimado: 2-3 días)
- [ ] `StartPurchaseModal.jsx` — botón desde oportunidad en stage "Análisis de la oportunidad"
- [ ] Linkeo visual: oportunidad muestra badge "BC vinculado → [link]" cuando existe
- [ ] `KanbanBoard.jsx` — vista pipeline drag-and-drop por stage
- [ ] `CRMDashboard.jsx` — métricas: oportunidades por stage, forecast, health
- [ ] Navegación desde BC Workspace → oportunidad de origen (si viene de CRM)

### FASE 4 — Pulido y pruebas (estimado: 1-2 días)
- [ ] E2E testing del flujo completo: Lead → Asignación → Conversión → Oportunidad → Compra → BC
- [ ] Actualizar CONTEXT.md del módulo CRM con endpoints reales
- [ ] Guía de usuario: módulo CRM-FAM

---

## 10. Dependencias y riesgos

| Riesgo | Mitigación |
|--------|-----------|
| `privatePurchasesService.createPurchaseRequest` requiere `clientData` + `equipment` — oportunidad puede no tener equipo aún | En "Análisis de la oportunidad" el equipo es opcional; la compra se crea con datos básicos del cliente y se completa después |
| Stage changes en oportunidad pueden ser automáticos (avance a "Desarrollo" al crear compra) | Solo avanzar si está en stage exacto; no saltar stages |
| CRM schema separado (`crm.`) — FK a `public.private_purchase_requests` | Ya contemplado en migración 234 |
| `crm_opportunities` → `equipment_purchase_requests` FK: `equipment_purchase_requests.id` es UUID | BC usa UUID como PK — compatible |
| Lead sin account no puede convertirse a oportunidad | En flujo simplificado: convertir puede crear account al vuelo con datos mínimos |

---

## 11. Archivos a crear/modificar

### Nuevos
- `backend/migrations/233_crm_pipeline_stages_update.sql`
- `backend/migrations/234_crm_opportunity_purchase_link.sql`
- `backend/src/modules/crm-fam/__tests__/crm.service.test.js`
- `spi_front/src/modules/crm/` (estructura completa — ver sección 7)
- `spi_front/src/core/api/crmApi.js`

### Modificar
- `backend/src/modules/crm-fam/crm.service.js` — implementar toda la lógica (actualmente 501)
- `backend/src/modules/crm-fam/crm.routes.js` — agregar `PUT /leads/:id/assign` y `POST /opportunities/:id/start-purchase`
- `backend/src/modules/crm-fam/CONTEXT.md` — actualizar con endpoints reales
- `spi_front/src/routes/AppRoutes.jsx` — agregar rutas CRM
- `spi_front/src/core/ui/components/NavigationBar.jsx` — agregar enlace CRM en menú comercial
