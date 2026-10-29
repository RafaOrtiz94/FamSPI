-- Migration 214: Sequence for TI asset acta codes
-- Replaces MAX(id)+1 approach with a proper PostgreSQL sequence.
-- Starts at GREATEST(existing max + 1, 4) to preserve existing codes.

CREATE SEQUENCE IF NOT EXISTS public.ti_acta_seq
  START WITH 4
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Advance the sequence past any existing actas so codes never collide
SELECT setval(
  'public.ti_acta_seq',
  GREATEST(
    COALESCE((SELECT MAX(id) FROM public.ti_asset_actas), 3),
    3
  )
);
