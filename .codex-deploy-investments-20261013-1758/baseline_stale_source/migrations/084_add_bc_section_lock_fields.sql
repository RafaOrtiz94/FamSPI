/**
 * Migration: 084_add_bc_section_lock_fields.sql
 * Add lock metadata to business_case_section_ownership for section blocking.
 */

ALTER TABLE public.business_case_section_ownership
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_by integer,
  ADD COLUMN IF NOT EXISTS locked_by_role text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

COMMENT ON COLUMN public.business_case_section_ownership.is_locked IS 'Indica si la sección está bloqueada';
COMMENT ON COLUMN public.business_case_section_ownership.locked_by IS 'Usuario que bloqueó la sección';
COMMENT ON COLUMN public.business_case_section_ownership.locked_by_role IS 'Rol que bloqueó la sección';
COMMENT ON COLUMN public.business_case_section_ownership.locked_at IS 'Fecha de bloqueo de la sección';
