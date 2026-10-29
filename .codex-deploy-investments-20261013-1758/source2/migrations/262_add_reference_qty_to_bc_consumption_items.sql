-- 262_add_reference_qty_to_bc_consumption_items.sql
-- Agrega reference_qty a bc_consumption_items: guarda "Producto Calculado"
-- del Sheet para items de tipo reactivo/determinacion, unicamente como valor
-- de referencia visual en la UI (Determinaciones del Business Case). Nunca
-- se usa en calculos -- la cantidad real de reactivos sigue viniendo de
-- annual_qty (DET/AÑO/PROCESO). Para controles/calibradores/materiales
-- queda NULL (su annual_qty ya viene de PRODUCTO CALCULADO).

ALTER TABLE public.bc_consumption_items
  ADD COLUMN IF NOT EXISTS reference_qty numeric(14,2);
