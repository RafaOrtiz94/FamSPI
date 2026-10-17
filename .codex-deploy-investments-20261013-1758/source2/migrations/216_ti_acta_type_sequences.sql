-- Migration 216: split TI acta sequence by tipo
-- Entrega and retiro must not share the same running number.
-- Retiro must start from at least 000004.

CREATE SEQUENCE IF NOT EXISTS public.ti_acta_entrega_seq
  START WITH 4
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.ti_acta_retiro_seq
  START WITH 4
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

SELECT setval(
  'public.ti_acta_entrega_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX(
          NULLIF(
            substring(acta_code FROM '(\d{6})$'),
            ''
          )::bigint
        )
        FROM public.ti_asset_actas
        WHERE tipo = 'entrega'
          AND acta_code LIKE 'ACTA-ET-%'
      ),
      3
    ),
    3
  )
);

SELECT setval(
  'public.ti_acta_retiro_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX(
          NULLIF(
            substring(acta_code FROM '(\d{6})$'),
            ''
          )::bigint
        )
        FROM public.ti_asset_actas
        WHERE tipo = 'retiro'
          AND acta_code LIKE 'ACTA-D-ET-%'
      ),
      3
    ),
    3
  )
);
