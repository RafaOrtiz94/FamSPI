-- Migration: 133_ca0105_document_management
-- Description: Tablas maestras para "Gestion y Control de Documentos" GXP/ISO (CA-01-05)

CREATE TABLE IF NOT EXISTS ca0105_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES ca0105_folders(id) ON DELETE SET NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ca0105_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES ca0105_folders(id) ON DELETE SET NULL,
    document_code VARCHAR(120) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    category VARCHAR(120) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    current_version INTEGER NOT NULL DEFAULT 1,
    owner_name VARCHAR(255),
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ca0105_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES ca0105_documents(id) ON DELETE RESTRICT,
    version_number INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    checksum VARCHAR(128),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    change_log TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_ca0105_document_versions UNIQUE (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS ca0105_document_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES ca0105_documents(id) ON DELETE RESTRICT,
    role_name VARCHAR(120) NOT NULL,
    permission_level VARCHAR(50) NOT NULL CHECK (permission_level IN ('read', 'review', 'approve', 'admin')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_ca0105_document_permissions UNIQUE (document_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_ca0105_folders_parent_id
  ON ca0105_folders (parent_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0105_folders_status
  ON ca0105_folders (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0105_documents_folder_id
  ON ca0105_documents (folder_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0105_documents_status
  ON ca0105_documents (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0105_document_versions_document_id
  ON ca0105_document_versions (document_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0105_document_versions_status
  ON ca0105_document_versions (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0105_document_permissions_document_id
  ON ca0105_document_permissions (document_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0105_document_permissions_status
  ON ca0105_document_permissions (status)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION ca0105_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ca0105_folders_updated_at
BEFORE UPDATE ON ca0105_folders
FOR EACH ROW EXECUTE FUNCTION ca0105_touch_updated_at();

CREATE TRIGGER trg_ca0105_documents_updated_at
BEFORE UPDATE ON ca0105_documents
FOR EACH ROW EXECUTE FUNCTION ca0105_touch_updated_at();

CREATE TRIGGER trg_ca0105_document_versions_updated_at
BEFORE UPDATE ON ca0105_document_versions
FOR EACH ROW EXECUTE FUNCTION ca0105_touch_updated_at();

CREATE TRIGGER trg_ca0105_document_permissions_updated_at
BEFORE UPDATE ON ca0105_document_permissions
FOR EACH ROW EXECUTE FUNCTION ca0105_touch_updated_at();
