-- Index para acelerar busqueda de proceso de compra por Business Case en extra JSONB
CREATE INDEX IF NOT EXISTS idx_equipment_purchase_requests_extra_business_case_id
ON equipment_purchase_requests ((extra->>'business_case_id'))
WHERE request_type = 'purchase';
