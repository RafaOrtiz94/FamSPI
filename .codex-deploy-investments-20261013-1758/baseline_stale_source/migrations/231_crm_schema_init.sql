-- 231_crm_schema_init.sql
-- CRM-Fam: esquema crm + tablas base (metodologia Blue Sheet Miller Heiman)
-- FK a usuarios: integer references public.users(id). PK CRM: uuid gen_random_uuid().

CREATE SCHEMA IF NOT EXISTS crm;

-- 1. pipeline stages
CREATE TABLE crm.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL,
  description text,
  order_index integer,
  probability_default numeric(5,2),
  requires_blue_sheet boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. accounts
CREATE TABLE crm.crm_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name varchar(255) NOT NULL,
  legal_name varchar(255),
  ruc varchar(13) UNIQUE,
  account_type varchar(50),
  industry varchar(100),
  employee_count_range varchar(50),
  annual_revenue_range varchar(50),
  country varchar(100) DEFAULT 'Ecuador',
  province varchar(100),
  city varchar(100),
  address text,
  website varchar(255),
  phone varchar(50),
  email varchar(255),
  linkedin_url varchar(255),
  status varchar(50) DEFAULT 'prospect',
  visibility varchar(20) DEFAULT 'company',
  owner_user_id integer references public.users(id),
  notes text,
  deleted_at timestamptz,
  created_by integer references public.users(id),
  updated_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. contacts
CREATE TABLE crm.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid references crm.crm_accounts(id),
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  full_name varchar(255) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  job_title varchar(150),
  department varchar(100),
  phone varchar(50),
  mobile varchar(50),
  email varchar(255),
  linkedin_url varchar(255),
  is_primary_contact boolean DEFAULT false,
  decision_maker_level varchar(50),
  notes text,
  deleted_at timestamptz,
  created_by integer references public.users(id),
  updated_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. leads
CREATE TABLE crm.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_code varchar(30) UNIQUE NOT NULL,
  first_name varchar(100),
  last_name varchar(100),
  full_name varchar(255) GENERATED ALWAYS AS (COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) STORED,
  company_name varchar(200),
  job_title varchar(150),
  email varchar(255),
  phone varchar(50),
  source varchar(100),
  status varchar(50) DEFAULT 'new',
  priority varchar(20) DEFAULT 'medium',
  interest_description text,
  estimated_value numeric(15,2),
  owner_user_id integer references public.users(id),
  converted_at timestamptz,
  converted_account_id uuid references crm.crm_accounts(id),
  converted_contact_id uuid references crm.crm_contacts(id),
  converted_opportunity_id uuid,
  disqualified_at timestamptz,
  disqualify_reason text,
  deleted_at timestamptz,
  created_by integer references public.users(id),
  updated_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. opportunities
CREATE TABLE crm.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_code varchar(30) UNIQUE NOT NULL,
  name varchar(255) NOT NULL,
  account_id uuid references crm.crm_accounts(id),
  primary_contact_id uuid references crm.crm_contacts(id),
  stage_id uuid references crm.crm_pipeline_stages(id),
  status varchar(50) DEFAULT 'open',
  estimated_amount numeric(15,2),
  probability_override numeric(5,2),
  weighted_amount numeric(15,2) GENERATED ALWAYS AS (
    CASE WHEN estimated_amount IS NOT NULL AND probability_override IS NOT NULL
      THEN estimated_amount * probability_override / 100
      ELSE NULL END
  ) STORED,
  currency varchar(10) DEFAULT 'USD',
  estimated_close_date date,
  actual_close_date date,
  won_amount numeric(15,2),
  lost_reason_id uuid,
  lost_reason_detail text,
  lost_to_competitor_id uuid,
  lesson_learned text,
  requires_blue_sheet boolean DEFAULT false,
  health_status varchar(20) DEFAULT 'gray',
  owner_user_id integer references public.users(id),
  assigned_by integer references public.users(id),
  source varchar(100),
  lead_id uuid references crm.crm_leads(id),
  external_erp_id varchar(100),
  description text,
  deleted_at timestamptz,
  created_by integer references public.users(id),
  updated_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. opportunity products
CREATE TABLE crm.crm_opportunity_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL references crm.crm_opportunities(id) ON DELETE CASCADE,
  product_name varchar(255) NOT NULL,
  sku varchar(100),
  quantity numeric(10,2) DEFAULT 1,
  unit_price numeric(15,2),
  discount_pct numeric(5,2) DEFAULT 0,
  total_price numeric(15,2),
  currency varchar(10) DEFAULT 'USD',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 7. blue sheets
CREATE TABLE crm.crm_blue_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid UNIQUE NOT NULL references crm.crm_opportunities(id),
  version_number integer DEFAULT 1,
  status varchar(50) DEFAULT 'draft',
  completeness_score numeric(5,2) DEFAULT 0,
  scorecard_score numeric(5,2) DEFAULT 0,
  health_score numeric(5,2) DEFAULT 0,
  sales_objective_text text,
  sales_objective_specificity varchar(50),
  sales_objective_measurable boolean,
  sales_objective_timebound boolean,
  sales_objective_validated boolean,
  customer_situation_current text,
  customer_situation_desired text,
  urgency_level varchar(50),
  urgency_source text,
  budget_status varchar(50),
  budget_amount numeric(15,2),
  budget_confirmed_by varchar(100),
  buying_process_description text,
  buying_process_maturity varchar(50),
  decision_timeline text,
  procurement_involved boolean,
  legal_involved boolean,
  buying_process_notes text,
  strategy_approach varchar(100),
  strategy_summary text,
  strategy_key_themes text,
  differentiation_factors text,
  strategy_risks text,
  strategy_validated_at timestamptz,
  submitted_at timestamptz,
  submitted_by integer references public.users(id),
  approved_at timestamptz,
  approved_by integer references public.users(id),
  approval_notes text,
  observed_at timestamptz,
  observed_by integer references public.users(id),
  reopened_at timestamptz,
  reopened_by integer references public.users(id),
  reopen_reason text,
  deleted_at timestamptz,
  created_by integer references public.users(id),
  updated_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. blue sheet versions
CREATE TABLE crm.crm_blue_sheet_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_sheet_id uuid NOT NULL references crm.crm_blue_sheets(id),
  version_number integer NOT NULL,
  snapshot_data jsonb NOT NULL,
  reason varchar(100),
  created_by integer references public.users(id),
  created_at timestamptz DEFAULT now()
);

-- 9. buying influences
CREATE TABLE crm.crm_buying_influences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_sheet_id uuid NOT NULL references crm.crm_blue_sheets(id),
  contact_id uuid references crm.crm_contacts(id),
  manual_name varchar(255),
  manual_title varchar(150),
  influence_role varchar(50) NOT NULL,
  influence_level varchar(50),
  attitude varchar(50),
  attitude_trend varchar(50),
  access_level varchar(50),
  is_confirmed boolean DEFAULT false,
  is_blocker boolean DEFAULT false,
  coach_qualification_notes text,
  display_order integer DEFAULT 0,
  deleted_at timestamptz,
  created_by integer references public.users(id),
  updated_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10. win results
CREATE TABLE crm.crm_win_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_sheet_id uuid NOT NULL references crm.crm_blue_sheets(id),
  buying_influence_id uuid NOT NULL references crm.crm_buying_influences(id),
  result_type varchar(50) NOT NULL,
  result_description text NOT NULL,
  importance_level varchar(20),
  validation_status varchar(50) DEFAULT 'assumed',
  validated_at timestamptz,
  deleted_at timestamptz,
  created_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 11. competitors
CREATE TABLE crm.crm_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_sheet_id uuid NOT NULL references crm.crm_blue_sheets(id),
  competitor_name varchar(200) NOT NULL,
  competitor_type varchar(50),
  known_strengths text,
  known_weaknesses text,
  win_rate_estimate numeric(5,2),
  perceived_probability numeric(5,2),
  is_incumbent boolean DEFAULT false,
  notes text,
  deleted_at timestamptz,
  created_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 12. competitive preferences
CREATE TABLE crm.crm_competitive_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_sheet_id uuid NOT NULL references crm.crm_blue_sheets(id),
  buying_influence_id uuid NOT NULL references crm.crm_buying_influences(id),
  competitor_id uuid references crm.crm_competitors(id),
  preference varchar(50) NOT NULL,
  confidence_level varchar(20),
  notes text,
  created_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(buying_influence_id, competitor_id)
);

-- 13. strengths
CREATE TABLE crm.crm_strengths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_sheet_id uuid NOT NULL references crm.crm_blue_sheets(id),
  strength_category varchar(100),
  strength_description text NOT NULL,
  impact_level varchar(20),
  leverage_action text,
  status varchar(50) DEFAULT 'identified',
  deleted_at timestamptz,
  created_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 14. red flags
CREATE TABLE crm.crm_red_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_sheet_id uuid NOT NULL references crm.crm_blue_sheets(id),
  flag_category varchar(100),
  flag_title varchar(255) NOT NULL,
  flag_description text,
  severity varchar(20) NOT NULL,
  status varchar(50) DEFAULT 'open',
  mitigation_plan text,
  owner_user_id integer references public.users(id),
  due_date date,
  is_auto_generated boolean DEFAULT false,
  acceptance_reason text,
  accepted_by integer references public.users(id),
  accepted_at timestamptz,
  deleted_at timestamptz,
  created_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 15. scorecard criteria
CREATE TABLE crm.crm_scorecard_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_name varchar(200) NOT NULL,
  criterion_description text,
  weight numeric(5,2) DEFAULT 10,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 16. scorecard answers
CREATE TABLE crm.crm_scorecard_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_sheet_id uuid NOT NULL references crm.crm_blue_sheets(id),
  criterion_id uuid NOT NULL references crm.crm_scorecard_criteria(id),
  score integer NOT NULL CHECK(score BETWEEN 0 AND 5),
  justification text,
  evidence text,
  updated_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(blue_sheet_id, criterion_id)
);

-- 17. action items
CREATE TABLE crm.crm_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_sheet_id uuid NOT NULL references crm.crm_blue_sheets(id),
  opportunity_id uuid references crm.crm_opportunities(id),
  title varchar(255) NOT NULL,
  description text,
  item_type varchar(100),
  priority varchar(20) DEFAULT 'medium',
  status varchar(50) DEFAULT 'pending',
  owner_user_id integer references public.users(id),
  due_date date,
  completed_at timestamptz,
  actual_result text,
  deleted_at timestamptz,
  created_by integer references public.users(id),
  updated_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 18. activities
CREATE TABLE crm.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid references crm.crm_accounts(id),
  contact_id uuid references crm.crm_contacts(id),
  opportunity_id uuid references crm.crm_opportunities(id),
  blue_sheet_id uuid references crm.crm_blue_sheets(id),
  activity_type varchar(100) NOT NULL,
  subject varchar(255) NOT NULL,
  description text,
  status varchar(50) DEFAULT 'pending',
  scheduled_at timestamptz,
  completed_at timestamptz,
  outcome text,
  next_step text,
  owner_user_id integer references public.users(id),
  deleted_at timestamptz,
  created_by integer references public.users(id),
  updated_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 19. documents
CREATE TABLE crm.crm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid references crm.crm_accounts(id),
  opportunity_id uuid references crm.crm_opportunities(id),
  blue_sheet_id uuid references crm.crm_blue_sheets(id),
  document_name varchar(255) NOT NULL,
  document_type varchar(100),
  description text,
  drive_file_id varchar(255),
  drive_file_url text,
  drive_folder_id varchar(255),
  file_size_bytes bigint,
  mime_type varchar(100),
  deleted_at timestamptz,
  created_by integer references public.users(id),
  created_at timestamptz DEFAULT now()
);

-- 20. notes
CREATE TABLE crm.crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid references crm.crm_accounts(id),
  contact_id uuid references crm.crm_contacts(id),
  opportunity_id uuid references crm.crm_opportunities(id),
  blue_sheet_id uuid references crm.crm_blue_sheets(id),
  note_text text NOT NULL,
  visibility varchar(50) DEFAULT 'team',
  deleted_at timestamptz,
  created_by integer references public.users(id) NOT NULL,
  updated_by integer references public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 21. review comments
CREATE TABLE crm.crm_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_sheet_id uuid NOT NULL references crm.crm_blue_sheets(id),
  section_name varchar(100),
  comment_text text NOT NULL,
  severity varchar(20) DEFAULT 'info',
  requires_correction boolean DEFAULT false,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by integer references public.users(id),
  created_by integer references public.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 22. lost reasons
CREATE TABLE crm.crm_lost_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason_name varchar(200) NOT NULL,
  reason_description text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 23. audit log
CREATE TABLE crm.crm_audit_log (
  id bigserial PRIMARY KEY,
  entity_name varchar(100) NOT NULL,
  entity_id uuid,
  action varchar(50) NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  reason text,
  performed_by integer references public.users(id),
  ip_address varchar(45),
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- 24. integration outbox
CREATE TABLE crm.crm_integration_outbox (
  id bigserial PRIMARY KEY,
  event_type varchar(100) NOT NULL,
  entity_name varchar(100),
  entity_id uuid,
  payload jsonb NOT NULL,
  target_module varchar(100),
  status varchar(50) DEFAULT 'pending',
  attempts integer DEFAULT 0,
  last_attempt_at timestamptz,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Indices
CREATE INDEX idx_crm_accounts_owner ON crm.crm_accounts(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_accounts_status ON crm.crm_accounts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_contacts_account ON crm.crm_contacts(account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_leads_owner ON crm.crm_leads(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_leads_status ON crm.crm_leads(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_opportunities_owner ON crm.crm_opportunities(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_opportunities_stage ON crm.crm_opportunities(stage_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_opportunities_status ON crm.crm_opportunities(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_opportunities_account ON crm.crm_opportunities(account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_blue_sheets_opportunity ON crm.crm_blue_sheets(opportunity_id);
CREATE INDEX idx_crm_blue_sheets_status ON crm.crm_blue_sheets(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_audit_log_entity ON crm.crm_audit_log(entity_name, entity_id);
CREATE INDEX idx_crm_audit_log_user ON crm.crm_audit_log(performed_by);
CREATE INDEX idx_crm_integration_outbox_status ON crm.crm_integration_outbox(status) WHERE processed_at IS NULL;
