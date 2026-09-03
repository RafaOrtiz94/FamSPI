# CRM-Fam

CRM interno con metodologia Blue Sheet (Miller Heiman Strategic Selling).

## Estado

Etapa 1 — esqueleto. Migraciones y catalogos listos; controllers/service responden 501 (Not implemented). La logica de negocio real llega en etapas 2-4.

## Entidades

Accounts, Contacts, Leads, Opportunities, Blue Sheets, Buying Influences, Win-Results, Competitors, Competitive Preferences, Strengths, Red Flags, Scorecard (criteria + answers), Action Items, Activities, Documents, Notes. Catalogos: Pipeline Stages, Lost Reasons.

## Esquema DB

Esquema `crm` (separado de `public`). PK de entidades CRM: `uuid DEFAULT gen_random_uuid()`. FK a usuarios: `integer references public.users(id)`.

Migraciones:
- `231_crm_schema_init.sql` — esquema + 24 tablas + indices
- `232_crm_catalogs_seed.sql` — 12 pipeline stages, 10 scorecard criteria, 11 lost reasons

## Roles con acceso

- `crmRoles` (group comercial): comercial, jefe_comercial, jefe_de_comercial, backoffice_comercial, asesor_comercial, analista_comercial, acp_comercial, backoffice
- `managerRoles` (group gerencia + jefes comercial): aprobar/observar/reabrir Blue Sheets, aceptar Red Flags, reportes y forecast
- `adminRoles`: jefe_ti, jefe_de_ti, admin, administrador — gestion de catalogos
- Admin/administrador bypasean todo (`requireRole`).

## Archivos

- `crm.routes.js` — Express router, montado en `/api/v1/crm-fam`
- `crm.controller.js` — thin controllers (helper `respond`)
- `crm.service.js` — logica de negocio (stubs 501 en Etapa 1)
- `crm.calculators.js` — calculadoras puras (sin DB): completeness, scorecard, health score, health status, weighted amount

## Calculadoras (`crm.calculators.js`)

Funciones puras, sin imports de DB:
- `calculateCompletenessScore(...)` — % completitud del Blue Sheet (0-100)
- `calculateScorecardScore(criteria, answers)` — score ponderado (0-100)
- `calculateHealthScore(...)` — 40% scorecard + 30% completeness + 20% action items + 10% red flags
- `getHealthStatus(score)` — semaforo green/yellow/red/gray
- `getWeightedAmount(amount, pct)` — valor ponderado de la oportunidad
