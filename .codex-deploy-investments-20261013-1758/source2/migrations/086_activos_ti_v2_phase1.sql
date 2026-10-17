-- FASE 1: BASE DE DATOS - MÓDULO ACTIVOS TI V2
-- Crear tablas nuevas y alterar tablas existentes
-- Fecha: 2026-06-10
-- Descripción: Implementar números corporativos, características en asignaciones, depreciación y liberación

-- ========================================================
-- 1. NUEVAS TABLAS
-- ========================================================

-- Tabla: ti_corporate_numbers
-- Números corporativos para equipos móviles (asignables a usuarios)
CREATE TABLE IF NOT EXISTS public.ti_corporate_numbers (
  id BIGSERIAL PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'inactive')),
  asset_id BIGINT REFERENCES public.ti_assets(id) ON DELETE SET NULL,
  assigned_to_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ti_corporate_numbers_status ON public.ti_corporate_numbers(status);
CREATE INDEX IF NOT EXISTS idx_ti_corporate_numbers_asset ON public.ti_corporate_numbers(asset_id);
CREATE INDEX IF NOT EXISTS idx_ti_corporate_numbers_user ON public.ti_corporate_numbers(assigned_to_user_id);

-- Tabla: ti_corporate_number_history
-- Historial de cambios de números corporativos (quién cambió de qué a qué)
CREATE TABLE IF NOT EXISTS public.ti_corporate_number_history (
  id BIGSERIAL PRIMARY KEY,
  number_id BIGINT NOT NULL REFERENCES public.ti_corporate_numbers(id) ON DELETE CASCADE,
  old_number TEXT,
  new_number TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ti_corporate_number_history_number ON public.ti_corporate_number_history(number_id);
CREATE INDEX IF NOT EXISTS idx_ti_corporate_number_history_changed_at ON public.ti_corporate_number_history(changed_at DESC);

-- Tabla: ti_asset_liberation_photos
-- Fotos de liberación de equipos con acta de retiro
CREATE TABLE IF NOT EXISTS public.ti_asset_liberation_photos (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  drive_url TEXT,
  drive_file_id TEXT,
  sha256 TEXT,
  liberated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  liberated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ti_asset_liberation_photos_asset ON public.ti_asset_liberation_photos(asset_id);
CREATE INDEX IF NOT EXISTS idx_ti_asset_liberation_photos_liberated_at ON public.ti_asset_liberation_photos(liberated_at DESC);

-- ========================================================
-- 2. ALTERAR TABLAS EXISTENTES
-- ========================================================

-- ti_assets: Agregar campos de valor y depreciación
ALTER TABLE public.ti_assets
ADD COLUMN IF NOT EXISTS purchase_value DECIMAL(12, 2);

ALTER TABLE public.ti_assets
ADD COLUMN IF NOT EXISTS value_category TEXT CHECK (value_category IN ('asset', 'control_item'));

-- Agregar índice para búsquedas por valor
CREATE INDEX IF NOT EXISTS idx_ti_assets_purchase_value ON public.ti_assets(purchase_value);
CREATE INDEX IF NOT EXISTS idx_ti_assets_value_category ON public.ti_assets(value_category);

-- ti_asset_actas_items: Renombrar observations → characteristics
-- Primero crear la columna characteristics si no existe
ALTER TABLE public.ti_asset_actas_items
ADD COLUMN IF NOT EXISTS characteristics TEXT;

-- Copiar datos de observations a characteristics (si existe observations)
UPDATE public.ti_asset_actas_items
SET characteristics = observations
WHERE characteristics IS NULL AND observations IS NOT NULL;

-- Mantener observations por compatibilidad (no eliminamos para no romper código existente)

-- ti_asset_assignments: Agregar características
ALTER TABLE public.ti_asset_assignments
ADD COLUMN IF NOT EXISTS characteristics TEXT;

-- Agregar índice para búsquedas de asignaciones
CREATE INDEX IF NOT EXISTS idx_ti_asset_assignments_asset_user ON public.ti_asset_assignments(asset_id, assigned_to_user_id);

-- ti_asset_financial_docs: Agregar columnas de asignación
ALTER TABLE public.ti_asset_financial_docs
ADD COLUMN IF NOT EXISTS assignment_id BIGINT REFERENCES public.ti_asset_assignments(id) ON DELETE SET NULL;

-- assigned_user_id ya existe (del plan actual), pero verificar
-- La columna ya está creada según verificación del plan

-- Crear índice para letras de cambio por usuario
CREATE INDEX IF NOT EXISTS idx_ti_asset_financial_docs_user ON public.ti_asset_financial_docs(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_ti_asset_financial_docs_assignment ON public.ti_asset_financial_docs(assignment_id);

-- ========================================================
-- 3. VALIDACIONES Y RESTRICCIONES
-- ========================================================

-- Asegurar que los estados válidos en ti_assets incluyan los 6 requeridos
-- (Ya están definidos en ALLOWED_STATUSES del código)

-- Crear función para auditar cambios de status
CREATE OR REPLACE FUNCTION public.audit_ti_asset_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
    VALUES (NEW.id, 'status_change', jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'changed_at', now()
    ), NEW.updated_by, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para auditar cambios de status
DROP TRIGGER IF EXISTS trg_ti_asset_status_change ON public.ti_assets;
CREATE TRIGGER trg_ti_asset_status_change
AFTER UPDATE ON public.ti_assets
FOR EACH ROW
EXECUTE FUNCTION public.audit_ti_asset_status_change();

-- ========================================================
-- 4. DATOS INICIALES (Opcional)
-- ========================================================

-- Insertar números corporativos de ejemplo si la tabla está vacía
-- (No incluimos aquí; estos se crearán vía API)

-- ========================================================
-- FIN DE LA MIGRACIÓN
-- ========================================================
