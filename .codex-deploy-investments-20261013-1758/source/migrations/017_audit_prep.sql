-- ============================================================
-- 🧾 017_audit_prep.sql
-- ------------------------------------------------------------
-- Crea tablas aisladas para el módulo de preparación de
-- auditorías y gestión documental respaldada en Drive.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  audit_mode BOOLEAN NOT NULL DEFAULT false,
  audit_start_date TIMESTAMPTZ,
  audit_end_date TIMESTAMPTZ,
  drive_root_id TEXT,
  checklist_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO audit_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_sections (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  area TEXT,
  storage_path TEXT,
  allowed_roles TEXT[] NOT NULL DEFAULT '{}',
  ordering INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_documents (
  id SERIAL PRIMARY KEY,
  section_code TEXT NOT NULL REFERENCES audit_sections(code),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  drive_file_id TEXT,
  drive_folder_id TEXT,
  uploaded_by INT REFERENCES users(id),
  uploaded_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_access_grants (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by INT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_documents_section ON audit_documents(section_code);
CREATE INDEX IF NOT EXISTS idx_audit_documents_status ON audit_documents(status);

-- Semilla de checklist base para las primeras carpetas
INSERT INTO audit_sections (code, title, description, area, storage_path, allowed_roles, ordering)
VALUES
  ('ruc_empresa', 'RUC de la Empresa', 'Documento fiscal obligatorio', 'financiero', 'Auditoria/RUC de la Empresa', '{financiero,admin_ti,jefe_ti,ti}', 1),
  ('representante_legal', 'Designación de representante legal', 'Nombramiento y vigencia', 'financiero', 'Auditoria/Designación de representante legal', '{financiero,admin_ti,jefe_ti,ti}', 2),
  ('organigrama', 'Organigrama empresarial', 'Estructura organizacional vigente', 'calidad', 'Auditoria/Organigrama empresarial', '{calidad,admin_ti,jefe_ti,ti}', 3),
  ('perfiles_cargos_comercial', 'Perfiles de cargos - Área Comercial', 'Perfiles por puesto', 'comercial', 'Auditoria/Perfiles de cargos/Área Comercial', '{comercial,jefe_comercial,admin_ti,jefe_ti,ti}', 4),
  ('perfiles_cargos_th', 'Perfiles de cargos - Talento Humano', 'Perfiles por puesto', 'talento_humano', 'Auditoria/Perfiles de cargos/Talento Humano', '{talento_humano,jefe_talento_humano,admin_ti,jefe_ti,ti}', 5),
  ('perfiles_cargos_ti', 'Perfiles de cargos - TI', 'Perfiles por puesto', 'ti', 'Auditoria/Perfiles de cargos/TI', '{ti,admin_ti,jefe_ti}', 6)
ON CONFLICT (code) DO NOTHING;
