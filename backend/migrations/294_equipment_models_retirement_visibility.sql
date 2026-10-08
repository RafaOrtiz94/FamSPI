-- Restringe modelos de equipos que solo deben estar disponibles al registrar
-- unidades dentro de una solicitud de retiro.
ALTER TABLE public.equipos_modelo
  ADD COLUMN IF NOT EXISTS solo_retiro BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.equipos_modelo
SET solo_retiro = TRUE
WHERE lower(nombre) IN ('react.sys 240 p', 'mindray bs-240 pro');
