CREATE TABLE IF NOT EXISTS public.collab_acta_category_counters (
  category TEXT NOT NULL,
  acta_year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT collab_acta_category_counters_pkey PRIMARY KEY (category, acta_year),
  CONSTRAINT collab_acta_category_counters_category_check
    CHECK (category = ANY (ARRAY[
      'ropa'::text,
      'epp'::text,
      'herramienta'::text,
      'logistica'::text,
      'suministros'::text,
      'ti'::text
    ])),
  CONSTRAINT collab_acta_category_counters_last_number_check CHECK (last_number >= 0)
);

INSERT INTO public.collab_acta_category_counters (category, acta_year, last_number)
SELECT
  category,
  split_part(acta_code, '-', 3)::integer AS acta_year,
  MAX((regexp_match(acta_code, '(\d+)$'))[1]::integer) AS last_number
FROM public.collab_delivery_actas
WHERE active = true
  AND category IS NOT NULL
  AND acta_code ~ '^ACTA-[A-Z]+-[0-9]{4}-[0-9]+$'
GROUP BY category, split_part(acta_code, '-', 3)::integer
ON CONFLICT (category, acta_year) DO UPDATE
SET last_number = GREATEST(
      public.collab_acta_category_counters.last_number,
      EXCLUDED.last_number
    ),
    updated_at = now();
