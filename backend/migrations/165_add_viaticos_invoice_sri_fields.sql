ALTER TABLE travel_allowance_invoices
  ADD COLUMN IF NOT EXISTS receipt_type TEXT,
  ADD COLUMN IF NOT EXISTS authorization_date TIMESTAMPTZ;

UPDATE travel_allowance_invoices
SET receipt_type = SUBSTRING(access_key FROM 9 FOR 2),
    updated_at = NOW()
WHERE (receipt_type IS NULL OR BTRIM(receipt_type) = '')
  AND access_key ~ '^[0-9]{49}$';
