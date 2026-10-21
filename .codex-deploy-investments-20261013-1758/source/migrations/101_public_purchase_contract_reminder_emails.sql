-- 101_public_purchase_contract_reminder_emails.sql
-- Objetivo:
-- 1) Registrar el envio de recordatorios por correo para contrato firmado.
-- 2) Evitar envios duplicados del recordatorio de 15 dias antes.

ALTER TABLE equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS contract_reminder_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_reminder_email_to TEXT;

CREATE INDEX IF NOT EXISTS idx_equipment_purchase_contract_reminder_email_sent_at
  ON equipment_purchase_requests (contract_reminder_email_sent_at);
