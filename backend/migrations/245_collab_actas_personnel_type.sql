-- Distingue actas de herramientas para personal interno vs externo -- cada
-- uno usa una plantilla Google Docs distinta (F.ACTA-H-2026-INT / -EXT),
-- mismas variables, el usuario elige antes de generar el acta.
ALTER TABLE public.collab_delivery_actas
  ADD COLUMN IF NOT EXISTS personnel_type TEXT
    CHECK (personnel_type IN ('interno', 'externo'));
