UPDATE public.collab_delivery_actas
SET acta_code = 'ACTA-ROPA-2026-000023',
    pdf_filename = NULL,
    pdf_sha256 = NULL,
    pdf_drive_url = NULL,
    pdf_drive_file_id = NULL
WHERE id = 30
  AND category = 'ropa'
  AND acta_code = 'ACTA-ROPA-2026-000001'
  AND signature_workflow_id IS NULL
  AND signed_pdf_drive_file_id IS NULL
  AND COALESCE(is_complete, false) = false;

INSERT INTO public.collab_acta_category_counters (category, acta_year, last_number)
VALUES ('ropa', 2026, 23)
ON CONFLICT (category, acta_year) DO UPDATE
SET last_number = GREATEST(public.collab_acta_category_counters.last_number, EXCLUDED.last_number),
    updated_at = now();
