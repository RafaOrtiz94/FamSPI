# CONTEXT.md - consumable-files

## 1. Descripcion
Modulo de expedientes de consumibles integrado al workspace de compras. Gestiona expedientes, subexpedientes por area, lineas base, pedidos mensuales, excedentes y despacho parcial.

## 2. Endpoints

Prefijo: `/api/v1/consumable-files`

- `GET /api/v1/consumable-files/by-purchase` - obtener expediente ligado a una compra
- `GET /api/v1/consumable-files/overview` - overview de expedientes y pedidos para workspace operativo
- `POST /api/v1/consumable-files/standalone` - crear expediente standalone sin compra ni business case
- `POST /api/v1/consumable-files/from-purchase` - crear expediente ligado a una compra
- `GET /api/v1/consumable-files/:id` - detalle completo del expediente
- `PATCH /api/v1/consumable-files/:id` - actualizar encabezado en borrador
- `POST /api/v1/consumable-files/:id/sections` - crear subexpediente
- `POST /api/v1/consumable-files/sections/:sectionId/import-business-case` - importar consumos base desde business case
- `POST /api/v1/consumable-files/sections/:sectionId/lines` - agregar linea base
- `PATCH /api/v1/consumable-files/lines/:lineId` - editar linea base
- `DELETE /api/v1/consumable-files/lines/:lineId` - eliminar linea base
- `POST /api/v1/consumable-files/sections/:sectionId/import-equipment` - importar consumibles desde equipo
- `POST /api/v1/consumable-files/:id/register` - congelar expediente
- `POST /api/v1/consumable-files/:id/cancel` - cancelacion administrativa del expediente
- `POST /api/v1/consumable-files/:id/orders` - crear pedido mensual
- `POST /api/v1/consumable-files/orders/:orderId/review-extra` - aprobar o rechazar excedentes
- `POST /api/v1/consumable-files/orders/:orderId/dispatch` - registrar despacho parcial o total
- `POST /api/v1/consumable-files/orders/:orderId/cancel` - cancelacion administrativa del pedido
- `GET /api/v1/consumable-files/catalog/search` - buscar consumibles

## 3. Flujo principal

1. Comercial crea o abre expediente de consumibles desde compras.
2. Tambien puede crear expedientes standalone cuando el proceso no nace de compras ni BC.
3. Configura tabs por area y lineas base.
4. Puede importar base desde equipos o desde consumos del business case cuando aplica.
5. Registra el expediente y queda inmutable.
6. Crea pedidos mensuales con saldo visible en tiempo real.
7. Jefe de operaciones aprueba o rechaza excedentes, incluso por linea.
8. Jefe de logistica registra uno o varios despachos parciales hasta completar el pedido.
9. Los pendientes no enviados se arrastran al siguiente pedido.

## 4. Base de datos

- `consumable_files`
- `consumable_file_sections`
- `consumable_file_lines`
- `consumable_orders`
- `consumable_order_lines`
- `consumable_dispatch_lines`

## 5. Relaciones

- `equipment_purchase_requests`
- `private_purchase_requests`
- `catalog_consumables`
- `catalog_equipment_consumables`
- `bc_consumption_items`
- `bc_dispatch_items`

## 6. Frontend asociado

- `spi_front/src/modules/shared/purchases-workspace/expediente/tabs`
