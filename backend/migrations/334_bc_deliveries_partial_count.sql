-- Migration 334: numero de entregas parciales del proceso.
--
-- Con entrega "Parcial - Tiempo", cada entrega va en presentaciones completas: el producto a entregar
-- de calibradores, controles y materiales es entregas × ROUNDUP(consumo esperado / entregas)
-- (determinationPredictions.service.js). Sin el dato, el producto a entregar es el consumo esperado.

ALTER TABLE public.bc_deliveries
  ADD COLUMN IF NOT EXISTS partial_deliveries INTEGER CHECK (partial_deliveries IS NULL OR partial_deliveries >= 1);

COMMENT ON COLUMN public.bc_deliveries.partial_deliveries IS
  'Numero de entregas parciales del proceso (con delivery_type partial_time).';
