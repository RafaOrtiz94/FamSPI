--
-- Migration 017: BC Equipment Selection Table (UPDATED)
-- Manages equipment selection for Business Cases
--

-- Add missing columns if table already exists
ALTER TABLE public.bc_equipment_selection
ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1 CHECK (quantity > 0),
ADD COLUMN IF NOT EXISTS notes text;

-- Clean up duplicate primary equipment entries (keep only the most recent one by id)
WITH duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY business_case_id ORDER BY id DESC) as rn
    FROM public.bc_equipment_selection
    WHERE is_primary = true
)
UPDATE public.bc_equipment_selection
SET is_primary = false
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Now create the unique index if it doesn't exist
DROP INDEX IF EXISTS bc_equipment_selection_primary_unique_idx;
CREATE UNIQUE INDEX bc_equipment_selection_primary_unique_idx 
    ON public.bc_equipment_selection (business_case_id) 
    WHERE is_primary = true;

-- Ensure other indexes exist
CREATE INDEX IF NOT EXISTS bc_equipment_selection_business_case_id_idx 
    ON public.bc_equipment_selection (business_case_id);
    
CREATE INDEX IF NOT EXISTS bc_equipment_selection_equipment_id_idx 
    ON public.bc_equipment_selection (equipment_id);

-- Add/update comments
COMMENT ON TABLE public.bc_equipment_selection IS 'Equipos seleccionados para cada Business Case';
COMMENT ON COLUMN public.bc_equipment_selection.is_primary IS 'Equipo principal del BC (solo uno por BC)';
COMMENT ON COLUMN public.bc_equipment_selection.quantity IS 'Cantidad de equipos de este tipo';
COMMENT ON COLUMN public.bc_equipment_selection.notes IS 'Notas adicionales sobre la selección del equipo';
