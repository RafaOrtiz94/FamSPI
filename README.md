# SPI - Sistema de Procesos Internos

Repositorio principal del sistema SPI.

## Estructura
- backend/: API Node.js + Express, modulos, middlewares, jobs e integraciones.
- spi_front/: frontend React, rutas, contextos y modulos por area.
- docs/validation/: documentacion de validacion por areas.
- validacion_sistema/: documentacion historica de analisis y validacion.
- Mapeador_Sheets/: plantillas y activos del mapeo de Google Sheets para Business Case.
- scripts/: utilitarios operativos y de soporte.

## Puntos de entrada
- Backend: backend/src/app.js y backend/src/server.js
- Frontend: spi_front/src/App.js y spi_front/src/routes/AppRoutes.jsx

## Stack
- Backend: Node.js, Express, PostgreSQL, JWT, Google APIs
- Frontend: React, React Router, Axios, Firebase
- Infraestructura objetivo: Cloud Run + Neon + Google Workspace

## Areas funcionales principales
- Gobierno, seguridad y cumplimiento
- Comercial y business case
- Talento humano, permisos, vacaciones y asistencia
- Servicio tecnico y mantenimientos
- Compras, operaciones y logistica
- Finanzas, viaticos y aprobaciones

## Operacion
La configuracion sensible debe resolverse por variables de entorno o secretos del entorno de ejecucion. No se deben versionar claves, passwords, tokens temporales ni credenciales de service account.

## Documentacion relacionada
- Desarrollo local: README-SPI-DEV.md
- Validacion por areas: docs/validation/areas/
- Protocolos IQ/OQ/PQ: docs/validation/areas/*

## Compras (Pública / Privada) — flujo vigente (2026-07-10)

Frontend unificado en `spi_front/src/modules/shared/purchases-workspace/`:
- `PurchasesWorkspace.jsx` — página en `/dashboard/purchases/workspace`, lista pública+privada+standalone.
- `expediente/PurchaseExpedienteDetail.jsx` — detalle con tabs (`CommercialTab`, `PrivateFlowTab` solo privada, `PublicAcpTab` solo pública, `ContractTab`, `EquipmentLogisticsTab`, `TechnicalTab`, `TrainingTab`, `ConsumableFilesTab`, timeline, audit). Gating por rol vía `RoleGatedAction.jsx` + `usePurchaseExpediente.js`.
- Creación: `PurchaseTypeSelector.jsx` → pública usa `NewPurchaseRequestModal`, privada usa `PrivatePurchaseRequestModal` (`RequestModals.jsx`) — dos modales distintos, no unificados aún.

Backend — **dos tablas y dos state machines separadas**, NO unificadas pese al frontend común:
- Pública: `backend/src/modules/equipment-purchases/` → tabla `equipment_purchase_requests`. Tiene DOS sistemas de estado en paralelo: `status` (legacy, el que de verdad maneja la mayoría de la lógica hoy) y `status_unified` (nuevo, tabla `equipment_purchase_state_transitions`, migraciones 171/172 agregaron `purchase_type`/`private_modality` a esta tabla — apunta a que a futuro privada se muda aquí).
- Privada: `backend/src/modules/private-purchases/` → tabla `private_purchase_requests`, un solo state machine (`PRIVATE_PURCHASE_STATES`), fue la plantilla que copiaron para el `status_unified` de pública.
- Compartidos por ambas: `delivery-requests` (dispatch), `delivery-ceilings` (catálogo límites), `consumable-files` (expediente de consumibles).

**Rutas de compra pública SIN redirigir todavía** (duplicación real, ojo al tocar el flujo):
- `/dashboard/comercial/equipment-purchases` → `EquipmentPurchases.jsx` (página vieja, sigue viva)
- `/dashboard/comercial/acp-compras` → `ACPEquipmentPurchases.jsx` (página vieja, sigue viva)
- Ambas coexisten con `PurchasesWorkspace` (`type=public`) contra la misma tabla.

Privada SÍ está migrada a nivel de ruteo: todas las rutas viejas (`/dashboard/operaciones|logistica|backoffice/private-purchases`, `/dashboard/servicio-tecnico/entregas-privadas`) son `<Navigate>` hacia `/dashboard/purchases/workspace?tab=private`.

**Archivos huérfanos confirmados (cero referencias, no borrar sin re-chequear):**
`purchases-workspace/tabs/{PublicPurchasesTab,PrivatePurchasesTab}.jsx`, `tabs/sections/*`, `operaciones/pages/OperacionesPrivatePurchases.jsx`, `logistica/pages/LogisticaPrivatePurchases.jsx`, `backoffice/pages/PrivatePurchases.jsx` (+ sus `.constants.js`/`.utils.js`, revisar cross-imports antes de borrar), `servicio/pages/PrivatePurchaseDeliveries.jsx`. `reference_backup/` es archivo puro, no se importa en ningún build.

Antes de cambiar el flujo: decidir si se termina la unificación backend (mover privada a `equipment_purchase_requests` con `purchase_type='private'`) o se formaliza que quedan separadas para siempre.
