UPDATE public.private_purchase_requests
SET status = 'delivery_dates_requested',
    updated_at = NOW()
WHERE status = 'contract_available'
  AND contract_signed_document_id IS NOT NULL;
