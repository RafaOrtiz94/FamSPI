# CONTEXT.md — finanzas

## 1. Descripción
Módulo de gestión financiera de inventario. Expone endpoints para listar, mover, reportar y sincronizar inventario con sistema Silver. Las rutas están definidas con prefijo `/api/v1/inventory` (no `/finanzas`).

## 2. Endpoints

- **GET /api/v1/finanzas/api/v1/inventory** — `listInventory` — verifyToken, requireRole
  - Roles: `finanzas`, `gerencia`
  - Nota: El prefijo de ruta está duplicado (bug potencial en routes.js)
- **POST /api/v1/finanzas/api/v1/inventory/move** — `moveInventory` — verifyToken, requireRole(`finanzas`, `gerencia`)
- **GET /api/v1/finanzas/api/v1/inventory/report** — `report` — verifyToken, requireRole(`finanzas`, `gerencia`)
- **POST /api/v1/finanzas/api/v1/inventory/sync** — `syncWithSilver` — verifyToken, requireRole(`finanzas`, `gerencia`)

## 3. Flujo principal

1. Finanzas consulta inventario actual
2. Registra movimientos de inventario
3. Genera reporte de inventario
4. Sincroniza con sistema Silver externo

## 4. Validaciones
- Acceso restringido a `finanzas` y `gerencia` en todos los endpoints

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `viaticos`: módulo separado que también pertenece al área financiera (montado en `/api/v1/viaticos`)
- `inventario`: módulo separado para inventario operacional

## 7. Frontend asociado
- `/dashboard/finanzas` → `DashboardFinanzas`
- `/dashboard/finanzas/viaticos` → `ViaticosWorkspace`

## 8. Riesgos detectados
- **BUG POTENCIAL**: Las rutas en `finanzas.routes.js` incluyen `/api/v1/` en el path relativo, lo que combinado con el prefijo `/api/v1/finanzas` resultaría en rutas incorrectas: `/api/v1/finanzas/api/v1/inventory`
- `finanzas.service.js` tiene tamaño 0 bytes (archivo vacío)

## 9. Notas técnicas
- Verificar si las rutas de finanzas están actualmente funcionales dado el bug de doble prefijo
- El módulo `viaticos` es la parte más robusta del área financiera
