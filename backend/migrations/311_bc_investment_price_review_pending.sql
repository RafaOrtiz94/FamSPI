-- Migration: marca de "precio pendiente de revisar" en inversiones adicionales del BC.
-- Se activa cuando se agrega una inversion o cambia su cantidad, y se limpia cuando
-- se guarda de nuevo su precio financiero. Aditiva y reejecutable.

ALTER TABLE bc_investment_selections
  ADD COLUMN IF NOT EXISTS price_review_pending_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_review_note TEXT;

COMMENT ON COLUMN bc_investment_selections.price_review_pending_at IS
  'Momento en que la inversion fue agregada o cambio su cantidad y el precio quedo pendiente de revisar. NULL = sin pendiente.';
COMMENT ON COLUMN bc_investment_selections.price_review_note IS
  'Descripcion corta del cambio que origino la revision (ej. "Cantidad editada - de 2 a 5").';
