-- Migration 189: Smart Blue Sheet foundation
-- Source of truth adjusted to current Neon schema:
-- - users.id is INTEGER
-- - bc_master.id / private_purchase_requests.id / equipment_purchase_requests.id are UUID

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bs_funnel_stage_enum') THEN
    CREATE TYPE bs_funnel_stage_enum AS ENUM (
      'prospect',
      'qualify',
      'pursue',
      'close',
      'won',
      'lost',
      'archived'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bs_buying_role_enum') THEN
    CREATE TYPE bs_buying_role_enum AS ENUM ('economic', 'technical', 'user', 'coach');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bs_buying_mode_enum') THEN
    CREATE TYPE bs_buying_mode_enum AS ENUM ('growth', 'problem', 'equilibrium', 'overconfident');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bs_influence_level_enum') THEN
    CREATE TYPE bs_influence_level_enum AS ENUM ('high', 'medium', 'low');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bs_flag_severity_enum') THEN
    CREATE TYPE bs_flag_severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bs_flag_status_enum') THEN
    CREATE TYPE bs_flag_status_enum AS ENUM ('open', 'mitigating', 'resolved');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bs_action_status_enum') THEN
    CREATE TYPE bs_action_status_enum AS ENUM ('pending', 'in_progress', 'done', 'cancelled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bs_competitive_position_enum') THEN
    CREATE TYPE bs_competitive_position_enum AS ENUM ('dominant', 'shared', 'unique', 'zero');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bs_comment_visibility_enum') THEN
    CREATE TYPE bs_comment_visibility_enum AS ENUM ('team', 'private');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bs_process_type_enum') THEN
    CREATE TYPE bs_process_type_enum AS ENUM ('business_case', 'private_purchase', 'equipment_purchase');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200),
  tax_id VARCHAR(50),
  industry VARCHAR(120),
  city VARCHAR(120),
  province VARCHAR(120),
  country VARCHAR(120) NOT NULL DEFAULT 'Ecuador',
  website TEXT,
  notes TEXT,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_accounts_client_id ON accounts (client_id);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  full_name VARCHAR(200) NOT NULL,
  title VARCHAR(150),
  email VARCHAR(200),
  phone VARCHAR(60),
  mobile VARCHAR(60),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts (account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (LOWER(full_name));

CREATE TABLE IF NOT EXISTS opportunity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(220) NOT NULL,
  singular_objective TEXT NOT NULL,
  product_name VARCHAR(200),
  estimated_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  target_close_date DATE,
  funnel_stage bs_funnel_stage_enum NOT NULL DEFAULT 'prospect',
  competitive_position bs_competitive_position_enum NOT NULL DEFAULT 'shared',
  summary TEXT,
  strategic_win_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  lost_reason TEXT,
  archived_at TIMESTAMPTZ,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_owner_id ON opportunity (owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_account_id ON opportunity (account_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_stage ON opportunity (funnel_stage);
CREATE INDEX IF NOT EXISTS idx_opportunity_target_close_date ON opportunity (target_close_date);

CREATE TABLE IF NOT EXISTS opportunity_rating (
  opportunity_id UUID PRIMARY KEY REFERENCES opportunity(id) ON DELETE CASCADE,
  has_economic_buyer BOOLEAN NOT NULL DEFAULT FALSE,
  has_coach BOOLEAN NOT NULL DEFAULT FALSE,
  has_competition_strategy BOOLEAN NOT NULL DEFAULT FALSE,
  has_red_flag_mitigation BOOLEAN NOT NULL DEFAULT FALSE,
  has_clear_objective BOOLEAN NOT NULL DEFAULT FALSE,
  total_score INTEGER GENERATED ALWAYS AS (
    (CASE WHEN has_economic_buyer THEN 20 ELSE 0 END) +
    (CASE WHEN has_coach THEN 20 ELSE 0 END) +
    (CASE WHEN has_competition_strategy THEN 20 ELSE 0 END) +
    (CASE WHEN has_red_flag_mitigation THEN 20 ELSE 0 END) +
    (CASE WHEN has_clear_objective THEN 20 ELSE 0 END)
  ) STORED,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buying_influence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunity(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  full_name VARCHAR(200) NOT NULL,
  role bs_buying_role_enum NOT NULL,
  influence_level bs_influence_level_enum NOT NULL DEFAULT 'medium',
  mode bs_buying_mode_enum,
  euphoria_panic SMALLINT NOT NULL DEFAULT 5 CHECK (euphoria_panic BETWEEN 1 AND 10),
  personal_win TEXT,
  business_result TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buying_influence_opportunity_id ON buying_influence (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_buying_influence_role ON buying_influence (role);

CREATE TABLE IF NOT EXISTS red_flag_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  severity bs_flag_severity_enum NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunity_flag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunity(id) ON DELETE CASCADE,
  buying_influence_id UUID REFERENCES buying_influence(id) ON DELETE SET NULL,
  template_id UUID REFERENCES red_flag_templates(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  severity bs_flag_severity_enum NOT NULL DEFAULT 'medium',
  status bs_flag_status_enum NOT NULL DEFAULT 'open',
  sort_order INTEGER NOT NULL DEFAULT 0,
  auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_flag_opportunity_id ON opportunity_flag (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_flag_status ON opportunity_flag (status);

CREATE TABLE IF NOT EXISTS competitor_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL UNIQUE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunity(id) ON DELETE CASCADE,
  competitor_catalog_id UUID REFERENCES competitor_catalog(id) ON DELETE SET NULL,
  competitor_name VARCHAR(160) NOT NULL,
  relationship_score SMALLINT NOT NULL DEFAULT 0 CHECK (relationship_score BETWEEN 0 AND 10),
  technical_score SMALLINT NOT NULL DEFAULT 0 CHECK (technical_score BETWEEN 0 AND 10),
  price_score SMALLINT NOT NULL DEFAULT 0 CHECK (price_score BETWEEN 0 AND 10),
  service_score SMALLINT NOT NULL DEFAULT 0 CHECK (service_score BETWEEN 0 AND 10),
  evidence_score SMALLINT NOT NULL DEFAULT 0 CHECK (evidence_score BETWEEN 0 AND 10),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_opportunity_id ON competitor (opportunity_id);

CREATE TABLE IF NOT EXISTS action_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(180) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bs_action_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunity(id) ON DELETE CASCADE,
  flag_id UUID REFERENCES opportunity_flag(id) ON DELETE SET NULL,
  template_id UUID REFERENCES action_templates(id) ON DELETE SET NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  assignee_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  status bs_action_status_enum NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bs_action_item_opportunity_id ON bs_action_item (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_bs_action_item_assignee ON bs_action_item (assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_bs_action_item_due_date ON bs_action_item (due_date);

CREATE TABLE IF NOT EXISTS opportunity_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunity(id) ON DELETE CASCADE,
  snapshot_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_snapshot_opportunity_id ON opportunity_snapshot (opportunity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bs_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunity(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES bs_comment(id) ON DELETE CASCADE,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  visibility bs_comment_visibility_enum NOT NULL DEFAULT 'team',
  mention_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bs_comment_opportunity_id ON bs_comment (opportunity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS opportunity_process_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunity(id) ON DELETE CASCADE,
  process_type bs_process_type_enum NOT NULL,
  process_id TEXT NOT NULL,
  imported_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opportunity_id, process_type, process_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_process_link_opp ON opportunity_process_link (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_process_link_proc ON opportunity_process_link (process_type, process_id);

CREATE OR REPLACE FUNCTION bs_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bs_handle_euphoria_red_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.euphoria_panic >= 7 THEN
    INSERT INTO opportunity_flag (
      opportunity_id,
      buying_influence_id,
      title,
      description,
      severity,
      status,
      auto_generated,
      created_by,
      updated_by
    )
    SELECT
      NEW.opportunity_id,
      NEW.id,
      'Euforia/pánico alto',
      CONCAT('La influencia compradora ', NEW.full_name, ' registra euforia/pánico >= 7.'),
      'high',
      'open',
      TRUE,
      NEW.created_by,
      NEW.updated_by
    WHERE NOT EXISTS (
      SELECT 1
      FROM opportunity_flag existing
      WHERE existing.buying_influence_id = NEW.id
        AND existing.auto_generated = TRUE
        AND existing.title = 'Euforia/pánico alto'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accounts_touch_updated_at ON accounts;
CREATE TRIGGER trg_accounts_touch_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION bs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_contacts_touch_updated_at ON contacts;
CREATE TRIGGER trg_contacts_touch_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION bs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_opportunity_touch_updated_at ON opportunity;
CREATE TRIGGER trg_opportunity_touch_updated_at
BEFORE UPDATE ON opportunity
FOR EACH ROW
EXECUTE FUNCTION bs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_opportunity_rating_touch_updated_at ON opportunity_rating;
CREATE TRIGGER trg_opportunity_rating_touch_updated_at
BEFORE UPDATE ON opportunity_rating
FOR EACH ROW
EXECUTE FUNCTION bs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_buying_influence_touch_updated_at ON buying_influence;
CREATE TRIGGER trg_buying_influence_touch_updated_at
BEFORE UPDATE ON buying_influence
FOR EACH ROW
EXECUTE FUNCTION bs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_opportunity_flag_touch_updated_at ON opportunity_flag;
CREATE TRIGGER trg_opportunity_flag_touch_updated_at
BEFORE UPDATE ON opportunity_flag
FOR EACH ROW
EXECUTE FUNCTION bs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_competitor_touch_updated_at ON competitor;
CREATE TRIGGER trg_competitor_touch_updated_at
BEFORE UPDATE ON competitor
FOR EACH ROW
EXECUTE FUNCTION bs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_bs_action_item_touch_updated_at ON bs_action_item;
CREATE TRIGGER trg_bs_action_item_touch_updated_at
BEFORE UPDATE ON bs_action_item
FOR EACH ROW
EXECUTE FUNCTION bs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_bs_comment_touch_updated_at ON bs_comment;
CREATE TRIGGER trg_bs_comment_touch_updated_at
BEFORE UPDATE ON bs_comment
FOR EACH ROW
EXECUTE FUNCTION bs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_opportunity_process_link_touch_updated_at ON opportunity_process_link;
CREATE TRIGGER trg_opportunity_process_link_touch_updated_at
BEFORE UPDATE ON opportunity_process_link
FOR EACH ROW
EXECUTE FUNCTION bs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_buying_influence_euphoria_red_flag ON buying_influence;
CREATE TRIGGER trg_buying_influence_euphoria_red_flag
AFTER INSERT OR UPDATE OF euphoria_panic ON buying_influence
FOR EACH ROW
EXECUTE FUNCTION bs_handle_euphoria_red_flag();
