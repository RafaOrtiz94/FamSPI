-- Presentacion del producto segun el Sheet del BC (columna DET/KIT de la pestaña del equipo): unidades
-- (tiras, pruebas) por caja. La usa la regla de calendario de QC (qcCalendarRule.js) para equipos sin
-- ficha tecnica ni referencias, como el cobas U 411. La escribe la sincronizacion del Sheet; el guardado
-- de consumos desde la UI no la toca.
ALTER TABLE public.bc_consumption_items
  ADD COLUMN IF NOT EXISTS units_per_pack NUMERIC CHECK (units_per_pack IS NULL OR units_per_pack > 0);
