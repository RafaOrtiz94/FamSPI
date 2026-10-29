-- 122_client_locations.sql
-- Soporte multisede para clientes (1:N) con geolocalizacion

BEGIN;

CREATE TABLE IF NOT EXISTS public.client_locations (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES public.client_requests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  province TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_main BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_locations_client_id
  ON public.client_locations (client_id);

CREATE INDEX IF NOT EXISTS idx_client_locations_geo
  ON public.client_locations (lat, lng);

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_locations_single_main
  ON public.client_locations (client_id)
  WHERE is_main = TRUE;

INSERT INTO public.client_locations (client_id, name, address, city, province, is_main)
SELECT
  cr.id,
  'Sede principal',
  COALESCE(NULLIF(TRIM(cr.shipping_address), ''), 'Direccion no registrada'),
  NULLIF(TRIM(cr.shipping_city), ''),
  NULLIF(TRIM(cr.shipping_province), ''),
  TRUE
FROM public.client_requests cr
WHERE cr.status = 'approved'
  AND NULLIF(TRIM(COALESCE(cr.shipping_address, '')), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.client_locations cl
    WHERE cl.client_id = cr.id
  );

COMMIT;
