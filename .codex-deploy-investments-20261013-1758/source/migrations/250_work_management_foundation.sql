CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS work_management;

CREATE TABLE IF NOT EXISTS work_management.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(180) NOT NULL,
  description text,
  visibility varchar(20) NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'team', 'company')),
  color varchar(20),
  icon varchar(60),
  owner_user_id integer NOT NULL REFERENCES public.users(id),
  is_archived boolean NOT NULL DEFAULT false,
  created_by integer REFERENCES public.users(id),
  updated_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_management.workspace_members (
  id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES work_management.workspaces(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_role varchar(20) NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('owner', 'admin', 'member', 'viewer')),
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_by integer REFERENCES public.users(id),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS work_management.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES work_management.workspaces(id) ON DELETE CASCADE,
  name varchar(220) NOT NULL,
  description text,
  project_type varchar(40) NOT NULL DEFAULT 'general'
    CHECK (project_type IN ('general', 'crm', 'purchase', 'service', 'operations', 'hr')),
  status varchar(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'on_hold', 'completed', 'cancelled')),
  priority varchar(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  origin_module varchar(80),
  origin_entity_type varchar(80),
  origin_entity_id text,
  crm_account_id uuid REFERENCES crm.crm_accounts(id) ON DELETE SET NULL,
  crm_opportunity_id uuid REFERENCES crm.crm_opportunities(id) ON DELETE SET NULL,
  schedule_id integer REFERENCES public.visit_schedules(id) ON DELETE SET NULL,
  owner_user_id integer NOT NULL REFERENCES public.users(id),
  approved_by integer REFERENCES public.users(id),
  approved_at timestamptz,
  start_date date,
  due_date date,
  is_archived boolean NOT NULL DEFAULT false,
  created_by integer REFERENCES public.users(id),
  updated_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_management.project_members (
  id bigserial PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES work_management.projects(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_role varchar(20) NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('owner', 'admin', 'member', 'viewer')),
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_by integer REFERENCES public.users(id),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS work_management.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES work_management.projects(id) ON DELETE CASCADE,
  name varchar(180) NOT NULL,
  board_type varchar(30) NOT NULL DEFAULT 'kanban'
    CHECK (board_type IN ('kanban', 'list', 'calendar', 'timeline')),
  position integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_by integer REFERENCES public.users(id),
  updated_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_management.board_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES work_management.boards(id) ON DELETE CASCADE,
  name varchar(180) NOT NULL,
  color varchar(20),
  position integer NOT NULL DEFAULT 0,
  is_closed boolean NOT NULL DEFAULT false,
  created_by integer REFERENCES public.users(id),
  updated_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_management.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES work_management.projects(id) ON DELETE CASCADE,
  board_id uuid REFERENCES work_management.boards(id) ON DELETE SET NULL,
  group_id uuid REFERENCES work_management.board_groups(id) ON DELETE SET NULL,
  parent_item_id uuid REFERENCES work_management.items(id) ON DELETE CASCADE,
  title varchar(240) NOT NULL,
  description text,
  item_type varchar(30) NOT NULL DEFAULT 'task'
    CHECK (item_type IN ('task', 'subtask', 'meeting', 'visit', 'approval', 'followup')),
  status varchar(30) NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'done', 'blocked', 'cancelled')),
  priority varchar(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  completion_pct numeric(5,2) NOT NULL DEFAULT 0,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  source_module varchar(80),
  source_entity_type varchar(80),
  source_entity_id text,
  scheduled_visit_id integer REFERENCES public.scheduled_visits(id) ON DELETE SET NULL,
  created_by integer REFERENCES public.users(id),
  updated_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_management.item_assignees (
  id bigserial PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES work_management.items(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by integer REFERENCES public.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

CREATE TABLE IF NOT EXISTS work_management.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES work_management.items(id) ON DELETE CASCADE,
  title varchar(220) NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_management.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES work_management.checklists(id) ON DELETE CASCADE,
  title varchar(220) NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by integer REFERENCES public.users(id),
  position integer NOT NULL DEFAULT 0,
  created_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_management.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES work_management.items(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by integer NOT NULL REFERENCES public.users(id),
  updated_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_management.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES work_management.items(id) ON DELETE CASCADE,
  file_name varchar(255) NOT NULL,
  file_url text,
  drive_file_id varchar(255),
  mime_type varchar(120),
  file_size_bytes bigint,
  created_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_management.followers (
  id bigserial PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES work_management.items(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

CREATE TABLE IF NOT EXISTS work_management.work_activity_log (
  id bigserial PRIMARY KEY,
  workspace_id uuid REFERENCES work_management.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES work_management.projects(id) ON DELETE CASCADE,
  board_id uuid REFERENCES work_management.boards(id) ON DELETE CASCADE,
  item_id uuid REFERENCES work_management.items(id) ON DELETE CASCADE,
  event_type varchar(80) NOT NULL,
  old_data jsonb,
  new_data jsonb,
  actor_user_id integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_management.spi_links (
  id bigserial PRIMARY KEY,
  entity_type varchar(40) NOT NULL
    CHECK (entity_type IN ('workspace', 'project', 'board', 'item')),
  entity_id uuid NOT NULL,
  source_module varchar(80) NOT NULL,
  source_entity_type varchar(80) NOT NULL,
  source_entity_id text NOT NULL,
  relation_type varchar(80) NOT NULL DEFAULT 'origin',
  created_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id, source_module, source_entity_type, source_entity_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_wm_workspace_owner
  ON work_management.workspaces(owner_user_id)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_wm_workspace_members_user
  ON work_management.workspace_members(user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_wm_projects_workspace
  ON work_management.projects(workspace_id)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_wm_projects_owner
  ON work_management.projects(owner_user_id)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_wm_projects_origin
  ON work_management.projects(origin_module, origin_entity_type, origin_entity_id);

CREATE INDEX IF NOT EXISTS idx_wm_project_members_user
  ON work_management.project_members(user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_wm_boards_project
  ON work_management.boards(project_id);

CREATE INDEX IF NOT EXISTS idx_wm_groups_board
  ON work_management.board_groups(board_id);

CREATE INDEX IF NOT EXISTS idx_wm_items_project
  ON work_management.items(project_id);

CREATE INDEX IF NOT EXISTS idx_wm_items_group
  ON work_management.items(group_id);

CREATE INDEX IF NOT EXISTS idx_wm_items_source
  ON work_management.items(source_module, source_entity_type, source_entity_id);

CREATE INDEX IF NOT EXISTS idx_wm_item_assignees_user
  ON work_management.item_assignees(user_id);

CREATE INDEX IF NOT EXISTS idx_wm_activity_log_project
  ON work_management.work_activity_log(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wm_spi_links_source
  ON work_management.spi_links(source_module, source_entity_type, source_entity_id);
