-- 323_crm_opportunity_stage_entered_at.sql
-- Tiempo en fase: fecha en que la oportunidad entro a su fase actual. La mantiene un trigger para
-- que valga igual si la fase cambia desde el embudo, desde compras/Business Case o por un script.
-- Idempotente.

ALTER TABLE crm.crm_opportunities
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz;

-- Historico: no se sabe cuando entro cada una; se usa su ultima modificacion como mejor aproximacion.
UPDATE crm.crm_opportunities
   SET stage_entered_at = COALESCE(updated_at, created_at, now())
 WHERE stage_entered_at IS NULL;

CREATE OR REPLACE FUNCTION crm.crm_touch_opportunity_stage_entered()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stage_entered_at := COALESCE(NEW.stage_entered_at, now());
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_entered_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_opportunity_stage_entered ON crm.crm_opportunities;
CREATE TRIGGER trg_crm_opportunity_stage_entered
  BEFORE INSERT OR UPDATE ON crm.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION crm.crm_touch_opportunity_stage_entered();
