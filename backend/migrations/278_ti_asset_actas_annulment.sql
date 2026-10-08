-- Migration 278: anulacion trazable de actas TI sin reutilizar correlativos
ALTER TABLE public.ti_asset_actas
  ADD COLUMN IF NOT EXISTS is_annulled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS annulled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS annulled_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS annulment_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_ti_asset_actas_annulled
  ON public.ti_asset_actas(is_annulled, acta_code);

COMMENT ON COLUMN public.ti_asset_actas.is_annulled IS 'Marca actas anuladas sin liberar ni reutilizar el correlativo documental.';
COMMENT ON COLUMN public.ti_asset_actas.annulment_reason IS 'Motivo trazable de anulacion documental del acta TI.';
