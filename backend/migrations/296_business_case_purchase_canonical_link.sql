-- Business Case es la etapa inicial del mismo proceso de compra.
-- Esta migracion consolida el vinculo canonico BC -> expediente y evita que
-- un mismo BC genere mas de un expediente del mismo tipo.

UPDATE public.equipment_purchase_requests AS purchase
   SET business_case_id = (purchase.extra->>'business_case_id')::uuid,
       status_unified = CASE
         WHEN bc.bc_stage = 'factible' THEN 'business_case_feasibility_approved'::equipment_purchase_status
         WHEN bc.bc_stage = 'cerrado_no_factible' THEN 'business_case_rejected'::equipment_purchase_status
         ELSE 'business_case_in_progress'::equipment_purchase_status
       END,
       updated_at = NOW()
  FROM public.equipment_purchase_requests AS bc
 WHERE COALESCE(purchase.request_type, 'purchase') = 'purchase'
   AND purchase.business_case_id IS NULL
   AND purchase.extra->>'business_case_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   AND bc.id = (purchase.extra->>'business_case_id')::uuid
   AND COALESCE(bc.request_type, 'purchase') = 'business_case';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'equipment_purchase_requests_business_case_id_fkey'
       AND conrelid = 'public.equipment_purchase_requests'::regclass
  ) THEN
    ALTER TABLE public.equipment_purchase_requests
      ADD CONSTRAINT equipment_purchase_requests_business_case_id_fkey
      FOREIGN KEY (business_case_id)
      REFERENCES public.equipment_purchase_requests(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'private_purchase_requests_business_case_id_fkey'
       AND conrelid = 'public.private_purchase_requests'::regclass
  ) THEN
    ALTER TABLE public.private_purchase_requests
      ADD CONSTRAINT private_purchase_requests_business_case_id_fkey
      FOREIGN KEY (business_case_id)
      REFERENCES public.equipment_purchase_requests(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_equipment_purchase_business_case
  ON public.equipment_purchase_requests (business_case_id)
  WHERE business_case_id IS NOT NULL
    AND COALESCE(request_type, 'purchase') = 'purchase';

CREATE UNIQUE INDEX IF NOT EXISTS ux_private_purchase_business_case
  ON public.private_purchase_requests (business_case_id)
  WHERE business_case_id IS NOT NULL;
