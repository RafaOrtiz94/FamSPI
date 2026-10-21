# CONTEXT.md — integrations

## 1. Descripción
Módulo de integraciones externas. Gestiona la sincronización con Odoo (ERP), el mapa de productos y la cola de sincronización de casos externos. Expone endpoints de salud y gestión del outbox de integración.

## 2. Endpoints

Prefijo dual: `/api/v1/integrations` y `/internal/integration`

- **GET /api/v1/integrations/health** — `getHealth` — requireRole(READ_ROLES)
  - Roles: `ti`, `jefe_ti`, `admin_ti`, `tecnico`, `servicio_tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`, `gerencia_general`
- **POST /api/v1/integrations/external-cases/sync/process-queue** — `processExternalSyncQueue` — requireRole(WRITE_ROLES)
  - Roles: `ti`, `jefe_ti`, `admin_ti`, `admin`, `administrador`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`, `gerencia_general`
- **GET /api/v1/integrations/product-map/coverage-report** — `getProductMapCoverageReport` — requireRole(WRITE_ROLES)
- **GET /api/v1/integrations/product-map** — `listProductMap` — requireRole(WRITE_ROLES)
- **POST /api/v1/integrations/product-map** — `upsertProductMap` — requireRole(WRITE_ROLES)
- **PATCH /api/v1/integrations/product-map/:id** — `patchProductMap` — requireRole(WRITE_ROLES)

## 3. Flujo principal

1. Sistema procesa cola de sincronización de casos externos con Odoo
2. TI puede verificar la salud de la integración
3. Se mantiene un mapa de productos entre FamSPI y Odoo
4. `integrationOutboxWorker.service.js` procesa el outbox de mensajes pendientes

## 4. Validaciones
- Dos niveles: lectura (roles técnicos + gerencia) y escritura (TI + admin + jefes técnicos)
- No requiere `verifyToken` explícito en el router — usa `requireRole` directamente (depende de middleware global)

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `servicio`/external-cases: sincronización de casos correctivos con Odoo
- `clients`: sincronización de clientes (migración `148_clients_odoo_identity_sync.sql`)
- `odooClient.js` (9KB): cliente HTTP para Odoo
- `productMap.service.js` (15KB): mapeo de productos FamSPI ↔ Odoo

## 7. Frontend asociado
- No verificado en frontend (módulo principalmente interno/admin)

## 8. Riesgos detectados
- Doble prefijo de montaje (`/api/v1/integrations` y `/internal/integration`) puede generar confusión
- Sin `verifyToken` explícito en el router — depende del middleware global
- `oracle.service.js` tiene tamaño 0 bytes — archivo vacío

## 9. Notas técnicas
- `AGENTS.md` y `__tests__` presentes
- `integrationOutboxWorker.service.js`: worker de procesamiento asíncrono de mensajes
- `hooks.js` (2KB): hooks de integración (probable para eventos internos)
