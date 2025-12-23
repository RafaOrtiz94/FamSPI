-- Name: add request_id to equipos_unidad; Type: SQL
ALTER TABLE public.equipos_unidad
  ADD COLUMN IF NOT EXISTS request_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE constraint_name = 'equipos_unidad_request_id_fkey'
       AND table_schema = 'public'
       AND table_name = 'equipos_unidad'
  ) THEN
    ALTER TABLE public.equipos_unidad
      ADD CONSTRAINT equipos_unidad_request_id_fkey
      FOREIGN KEY (request_id)
      REFERENCES public.requests(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;
