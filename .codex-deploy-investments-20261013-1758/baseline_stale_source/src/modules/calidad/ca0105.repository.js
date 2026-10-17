const db = require("../../config/db");
const logger = require("../../config/logger");

/**
 * Repositorio de Datos - CA-01-05 (Gestión y Control de Documentos)
 * Maneja operaciones CRUD transaccionales, consultas indexadas y soft_delete
 * para preservar auditoría GXP.
 */

// ==================== FOLDERS ====================
const createFolder = async ({ name, parentId, description, createdBy }, client = db) => {
  const query = `
    INSERT INTO ca0105_folders (name, parent_id, description, created_by, status)
    VALUES ($1, $2, $3, $4, 'draft')
    RETURNING *;
  `;
  const values = [name, parentId || null, description || null, createdBy];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const getFolderById = async (id, client = db) => {
  const query = `SELECT * FROM ca0105_folders WHERE id = $1 AND deleted_at IS NULL;`;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

const listFolders = async ({ parentId, status } = {}, client = db) => {
  let query = `SELECT * FROM ca0105_folders WHERE deleted_at IS NULL`;
  const values = [];
  let paramIndex = 1;

  if (parentId) {
    values.push(parentId);
    query += ` AND parent_id = $${paramIndex++}`;
  }
  if (status) {
    values.push(status);
    query += ` AND status = $${paramIndex++}`;
  }
  query += ` ORDER BY name ASC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const updateFolder = async (id, updates, client = db) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (fields.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE ca0105_folders SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND deleted_at IS NULL
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

const softDeleteFolder = async (id, client = db) => {
  const query = `
    UPDATE ca0105_folders SET deleted_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id;
  `;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

// ==================== DOCUMENTS ====================
const createDocument = async ({ folderId, documentCode, title, summary, category, ownerName, createdBy }, client = db) => {
  const query = `
    INSERT INTO ca0105_documents (folder_id, document_code, title, summary, category, owner_name, created_by, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
    RETURNING *;
  `;
  const values = [folderId || null, documentCode, title, summary || null, category, ownerName || null, createdBy];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const getDocumentById = async (id, client = db) => {
  const query = `SELECT * FROM ca0105_documents WHERE id = $1 AND deleted_at IS NULL;`;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

const getDocumentByCode = async (documentCode, client = db) => {
  const query = `SELECT * FROM ca0105_documents WHERE document_code = $1 AND deleted_at IS NULL;`;
  const { rows } = await client.query(query, [documentCode]);
  return rows[0] || null;
};

const listDocuments = async ({ folderId, category, status } = {}, client = db) => {
  let query = `SELECT * FROM ca0105_documents WHERE deleted_at IS NULL`;
  const values = [];
  let paramIndex = 1;

  if (folderId) {
    values.push(folderId);
    query += ` AND folder_id = $${paramIndex++}`;
  }
  if (category) {
    values.push(category);
    query += ` AND category = $${paramIndex++}`;
  }
  if (status) {
    values.push(status);
    query += ` AND status = $${paramIndex++}`;
  }
  query += ` ORDER BY document_code ASC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const updateDocument = async (id, updates, client = db) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (fields.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE ca0105_documents SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND deleted_at IS NULL
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

const incrementVersion = async (id, client = db) => {
  const query = `
    UPDATE ca0105_documents SET current_version = current_version + 1, updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *;
  `;
  const { rows } = await client.query(query, [id]);
  return rows[0];
};

const softDeleteDocument = async (id, client = db) => {
  const query = `
    UPDATE ca0105_documents SET deleted_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id;
  `;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

// ==================== DOCUMENT VERSIONS ====================
const createDocumentVersion = async ({ documentId, versionNumber, fileName, filePath, checksum, changeLog, createdBy }, client = db) => {
  const query = `
    INSERT INTO ca0105_document_versions (document_id, version_number, file_name, file_path, checksum, change_log, created_by, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
    RETURNING *;
  `;
  const values = [documentId, versionNumber, fileName, filePath, checksum || null, changeLog || null, createdBy];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const getDocumentVersionById = async (id, client = db) => {
  const query = `SELECT * FROM ca0105_document_versions WHERE id = $1 AND deleted_at IS NULL;`;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

const listDocumentVersions = async ({ documentId } = {}, client = db) => {
  let query = `SELECT * FROM ca0105_document_versions WHERE deleted_at IS NULL`;
  const values = [];
  let paramIndex = 1;

  if (documentId) {
    values.push(documentId);
    query += ` AND document_id = $${paramIndex++}`;
  }
  query += ` ORDER BY version_number DESC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const getLatestVersion = async (documentId, client = db) => {
  const query = `
    SELECT * FROM ca0105_document_versions 
    WHERE document_id = $1 AND deleted_at IS NULL 
    ORDER BY version_number DESC 
    LIMIT 1;
  `;
  const { rows } = await client.query(query, [documentId]);
  return rows[0] || null;
};

const updateDocumentVersion = async (id, updates, client = db) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (fields.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE ca0105_document_versions SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND deleted_at IS NULL
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

// ==================== DOCUMENT PERMISSIONS ====================
const createDocumentPermission = async ({ documentId, roleName, permissionLevel, createdBy }, client = db) => {
  const query = `
    INSERT INTO ca0105_document_permissions (document_id, role_name, permission_level, created_by, status)
    VALUES ($1, $2, $3, $4, 'draft')
    ON CONFLICT (document_id, role_name) DO UPDATE SET permission_level = $3, updated_at = NOW()
    RETURNING *;
  `;
  const values = [documentId, roleName, permissionLevel, createdBy];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const listDocumentPermissions = async ({ documentId, roleName } = {}, client = db) => {
  let query = `SELECT * FROM ca0105_document_permissions WHERE deleted_at IS NULL`;
  const values = [];
  let paramIndex = 1;

  if (documentId) {
    values.push(documentId);
    query += ` AND document_id = $${paramIndex++}`;
  }
  if (roleName) {
    values.push(roleName);
    query += ` AND role_name = $${paramIndex++}`;
  }
  const { rows } = await client.query(query, values);
  return rows;
};

const checkPermission = async ({ documentId, roleName }, client = db) => {
  const query = `
    SELECT * FROM ca0105_document_permissions 
    WHERE document_id = $1 AND role_name = $2 AND deleted_at IS NULL
    LIMIT 1;
  `;
  const { rows } = await client.query(query, [documentId, roleName]);
  return rows[0] || null;
};

const softDeleteDocumentPermission = async (id, client = db) => {
  const query = `
    UPDATE ca0105_document_permissions SET deleted_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id;
  `;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

module.exports = {
  createFolder,
  getFolderById,
  listFolders,
  updateFolder,
  softDeleteFolder,
  createDocument,
  getDocumentById,
  getDocumentByCode,
  listDocuments,
  updateDocument,
  incrementVersion,
  softDeleteDocument,
  createDocumentVersion,
  getDocumentVersionById,
  listDocumentVersions,
  getLatestVersion,
  updateDocumentVersion,
  createDocumentPermission,
  listDocumentPermissions,
  checkPermission,
  softDeleteDocumentPermission,
};