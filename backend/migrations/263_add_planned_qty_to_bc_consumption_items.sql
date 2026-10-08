-- 263_add_planned_qty_to_bc_consumption_items.sql
-- Agrega planned_qty ("Producto a Enviar") a bc_consumption_items. Se
-- sincroniza directo desde el Sheet (columna PRODUCTO A ENTREGAR/ENVIAR,
-- aplica a reactivos, calibradores, controles y materiales por igual, sin
-- distincion de categoria) en el mismo flujo que annual_qty/reference_qty,
-- para que la pantalla de Determinaciones muestre el valor sin depender de
-- que se haya abierto antes el workspace de despacho (bc_dispatch_items).

ALTER TABLE public.bc_consumption_items
  ADD COLUMN IF NOT EXISTS planned_qty numeric(14,2);
