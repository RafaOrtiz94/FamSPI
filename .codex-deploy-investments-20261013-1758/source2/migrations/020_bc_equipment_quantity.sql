--
-- Migration 020: Cantidad de equipos en selección del Business Case
--

ALTER TABLE public.bc_equipment_selection
  ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1 CHECK (quantity > 0);

COMMENT ON COLUMN public.bc_equipment_selection.quantity IS 'Cantidad de unidades seleccionadas del equipo principal';
