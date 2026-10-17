-- Migration: 040_equipment_purchase_business_case_links
-- Purpose: link equipment purchase requests to explicitly created business cases

CREATE TABLE IF NOT EXISTS equipment_purchase_business_case_links (
  equipment_purchase_id UUID PRIMARY KEY
    REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
  business_case_id UUID NOT NULL
    REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ep_bc_links_business_case_id
  ON equipment_purchase_business_case_links (business_case_id);
