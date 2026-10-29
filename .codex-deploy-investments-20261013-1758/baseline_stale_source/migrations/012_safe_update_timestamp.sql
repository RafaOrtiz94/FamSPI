-- Name: safe update_timestamp function; Type: SQL
CREATE OR REPLACE FUNCTION public.update_timestamp() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    NEW.updated_at := now();
  EXCEPTION WHEN undefined_column THEN
    -- Tabla sin columna updated_at, ignorar
    NULL;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION servicio.update_timestamp() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    NEW.updated_at := now();
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
