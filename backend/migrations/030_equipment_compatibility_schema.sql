-- Equipment Compatibility Schema Extension
-- Adds optional fields for equipment hierarchy, compatibility, and economic data
-- to support automatic backup equipment selection

-- Add new optional fields to equipment_models table
ALTER TABLE public.equipment_models
ADD COLUMN IF NOT EXISTS equipment_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_equipment_id INTEGER REFERENCES public.equipment_models(id),
ADD COLUMN IF NOT EXISTS compatibility_group VARCHAR(255),
ADD COLUMN IF NOT EXISTS compatibility_rules JSONB,
ADD COLUMN IF NOT EXISTS capacity_unit VARCHAR(50),
ADD COLUMN IF NOT EXISTS capacity_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS capacity_factors JSONB,
ADD COLUMN IF NOT EXISTS lease_price DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS maintenance_cost_monthly DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS automation_rules JSONB,
ADD COLUMN IF NOT EXISTS backup_priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS redundancy_type VARCHAR(50);

-- Create equipment compatibility matrix table
CREATE TABLE IF NOT EXISTS public.equipment_compatibility_matrix (
    id SERIAL PRIMARY KEY,
    primary_equipment_id INTEGER NOT NULL REFERENCES public.equipment_models(id) ON DELETE CASCADE,
    backup_equipment_id INTEGER NOT NULL REFERENCES public.equipment_models(id) ON DELETE CASCADE,
    compatibility_score DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (compatibility_score >= 0 AND compatibility_score <= 1),
    capacity_overlap_percentage DECIMAL(5,2) DEFAULT 100.0,
    cost_penalty_percentage DECIMAL(5,2) DEFAULT 0.0,
    priority_score INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(primary_equipment_id, backup_equipment_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_equipment_models_compatibility_group ON public.equipment_models(compatibility_group);
CREATE INDEX IF NOT EXISTS idx_equipment_models_backup_priority ON public.equipment_models(backup_priority DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_models_equipment_level ON public.equipment_models(equipment_level);
CREATE INDEX IF NOT EXISTS idx_equipment_compatibility_matrix_primary ON public.equipment_compatibility_matrix(primary_equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_compatibility_matrix_backup ON public.equipment_compatibility_matrix(backup_equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_compatibility_matrix_score ON public.equipment_compatibility_matrix(compatibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_compatibility_matrix_active ON public.equipment_compatibility_matrix(is_active) WHERE is_active = true;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_equipment_compatibility_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_equipment_compatibility_updated_at
    BEFORE UPDATE ON public.equipment_compatibility_matrix
    FOR EACH ROW
    EXECUTE FUNCTION update_equipment_compatibility_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN public.equipment_models.equipment_level IS 'Equipment hierarchy level (1=base, 2=intermediate, 3=advanced)';
COMMENT ON COLUMN public.equipment_models.parent_equipment_id IS 'Parent equipment in hierarchy for compatibility inheritance';
COMMENT ON COLUMN public.equipment_models.compatibility_group IS 'Logical grouping for compatible equipment types';
COMMENT ON COLUMN public.equipment_models.compatibility_rules IS 'JSON rules defining compatibility criteria and constraints';
COMMENT ON COLUMN public.equipment_models.capacity_unit IS 'Unit of measurement for capacity (ml, tests/hour, etc.)';
COMMENT ON COLUMN public.equipment_models.capacity_type IS 'Type of capacity measurement (throughput, volume, etc.)';
COMMENT ON COLUMN public.equipment_models.capacity_factors IS 'JSON factors affecting capacity calculations';
COMMENT ON COLUMN public.equipment_models.lease_price IS 'Monthly lease price for economic comparison';
COMMENT ON COLUMN public.equipment_models.maintenance_cost_monthly IS 'Monthly maintenance cost';
COMMENT ON COLUMN public.equipment_models.automation_rules IS 'JSON rules for future automation and AI recommendations';
COMMENT ON COLUMN public.equipment_models.backup_priority IS 'Priority score for backup equipment selection (higher = better)';
COMMENT ON COLUMN public.equipment_models.redundancy_type IS 'Type of redundancy this equipment provides (N+1, 2N, etc.)';

COMMENT ON TABLE public.equipment_compatibility_matrix IS 'Matrix defining explicit compatibility relationships between equipment';
COMMENT ON COLUMN public.equipment_compatibility_matrix.compatibility_score IS 'Compatibility score from 0.0 to 1.0 (1.0 = perfect match)';
COMMENT ON COLUMN public.equipment_compatibility_matrix.capacity_overlap_percentage IS 'Percentage of primary capacity covered by backup';
COMMENT ON COLUMN public.equipment_compatibility_matrix.cost_penalty_percentage IS 'Additional cost penalty for using this backup';

-- Create view for easy equipment compatibility lookup
CREATE OR REPLACE VIEW public.v_equipment_with_compatibility AS
SELECT
    e.*,
    jsonb_build_object(
        'level', e.equipment_level,
        'parent_id', e.parent_equipment_id,
        'group', e.compatibility_group,
        'rules', e.compatibility_rules,
        'capacity', jsonb_build_object(
            'unit', e.capacity_unit,
            'type', e.capacity_type,
            'factors', e.capacity_factors
        ),
        'economics', jsonb_build_object(
            'lease_price', e.lease_price,
            'maintenance_cost_monthly', e.maintenance_cost_monthly
        ),
        'automation', e.automation_rules,
        'backup_priority', e.backup_priority,
        'redundancy_type', e.redundancy_type
    ) as compatibility_metadata
FROM public.equipment_models e;

-- Grant permissions
GRANT SELECT ON public.equipment_compatibility_matrix TO PUBLIC;
GRANT SELECT ON public.v_equipment_with_compatibility TO PUBLIC;

-- Legacy compatibility: ensure all existing equipment has default values
UPDATE public.equipment_models
SET
    equipment_level = COALESCE(equipment_level, 1),
    backup_priority = COALESCE(backup_priority, 0)
WHERE equipment_level IS NULL OR backup_priority IS NULL;
