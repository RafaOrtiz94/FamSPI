-- Migration 328: estadisticas del laboratorio para el motor de consumibles.
--
-- Datos que ni el Sheet ni las fichas traen y que jefe_servicio llena en Determinaciones de cada
-- Business Case (muestras ISE por año, % de repeticiones, % de controles fuera de rango). Mientras no
-- haya 3 procesos del mismo equipo con el dato, es obligatorio; despues el motor usa esa referencia.
-- Una fila por Business Case y dato; null en pantalla borra la fila.
--
-- Reemplaza a la version local anterior de esta migracion (formato de estadistica del cliente,
-- bc_client_statistics), que nunca se aplico en produccion: los reactivos vuelven a leerse del Sheet.

DROP TABLE IF EXISTS public.bc_client_statistics;

CREATE TABLE IF NOT EXISTS public.bc_lab_statistics (
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  stat_key VARCHAR(48) NOT NULL,
  value NUMERIC NOT NULL CHECK (value >= 0),
  filled_by TEXT,
  filled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_case_id, stat_key)
);

COMMENT ON TABLE public.bc_lab_statistics IS
  'Estadisticas del laboratorio que llena jefe_servicio para el motor de consumibles (ISE, repeticiones, controles fuera de rango).';
