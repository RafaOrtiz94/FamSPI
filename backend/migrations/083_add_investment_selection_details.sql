ALTER TABLE public.bc_investment_selections
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS characteristics text;

COMMENT ON COLUMN public.bc_investment_selections.quantity IS 'Cantidad requerida por el cliente';
COMMENT ON COLUMN public.bc_investment_selections.characteristics IS 'Caracter�sticas solicitadas';
