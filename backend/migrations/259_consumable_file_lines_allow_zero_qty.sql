-- Control de Consumibles: una linea sincronizada desde equipo (antes de leer el Business Case
-- resuelto) debe quedar en 0 cantidades, no inventarse un 1. Los checks originales exigian > 0.
-- units_per_box (DET/KIT) se deja intacto: siempre tiene un valor real (>=1) por definicion.

ALTER TABLE public.consumable_file_lines
  DROP CONSTRAINT IF EXISTS consumable_file_lines_box_qty_check;
ALTER TABLE public.consumable_file_lines
  ADD CONSTRAINT consumable_file_lines_box_qty_check CHECK (box_qty >= 0);

ALTER TABLE public.consumable_file_lines
  DROP CONSTRAINT IF EXISTS consumable_file_lines_max_units_check;
ALTER TABLE public.consumable_file_lines
  ADD CONSTRAINT consumable_file_lines_max_units_check CHECK (max_units >= 0);
