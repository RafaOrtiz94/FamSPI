/**
 * Migration: 085_add_equipment_to_bc_consumption_items.sql
 * Persist equipment reference for consumption items.
 */

ALTER TABLE public.bc_consumption_items
  ADD COLUMN IF NOT EXISTS equipment_id integer,
  ADD COLUMN IF NOT EXISTS equipment_name text;

COMMENT ON COLUMN public.bc_consumption_items.equipment_id IS 'Equipo asociado al item de consumo';
COMMENT ON COLUMN public.bc_consumption_items.equipment_name IS 'Nombre del equipo asociado al item de consumo';
