-- Name: add updated_at to requests; Type: SQL
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.requests
ALTER COLUMN updated_at SET DEFAULT now();
