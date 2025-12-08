DROP VIEW IF EXISTS public.v_inventario_completo CASCADE;

CREATE OR REPLACE VIEW public.v_inventario_completo AS
SELECT
  u.id AS inventory_id,
  u.id AS unidad_id,
  m.sku,
  m.nombre AS item_name,
  m.modelo AS model,
  m.fabricante AS brand,
  m.categoria AS category,
  u.serial AS serial_number,
  u.estado,
  u.ubicacion,
  u.cliente_id,
  u.serial_pendiente,
  u.updated_at,
  NULL::text AS tipo_ultimo_movimiento
FROM public.equipos_unidad u
JOIN public.equipos_modelo m ON m.id = u.modelo_id;
