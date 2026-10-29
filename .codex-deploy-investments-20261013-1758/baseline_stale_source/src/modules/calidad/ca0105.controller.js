const Joi = require("joi");
const service = require("./ca0105.service");
const repository = require("./ca0105.repository");
const logger = require("../../config/logger");

/**
 * Controller - CA-01-05 (Gestión y Control de Documentos)
 * -------------------------------------------------
 * Capa HTTP con validación estricta para folders, documents,
 * versions y permissions. Integra repositorio para persistencia GXP.
 */

const FOLDER_STATUS = ["draft", "review", "approved", "archived"];
const DOCUMENT_STATUS = ["draft", "review", "approved", "archived"];
const CATEGORIES = ["sop", "procedimiento", "instructivo", "registro", "manual", "politica", "otro"];
const PERMISSION_LEVELS = ["read", "review", "approve", "admin"];

// ============ FOLDERS ============
const folderSchema = Joi.object({
  name: Joi.string().max(255).required(),
  parentId: Joi.string().uuid().allow(null),
  description: Joi.string().allow("", null),
  createdBy: Joi.string().allow("", null),
});

const createFolder = async (req, res, next) => {
  try {
    const { error, value } = folderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const result = await repository.createFolder(value);
    logger.info({ folderId: result.id }, "CA-01-05: Folder created");
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 createFolder error");
    next(err);
  }
};

const listFolders = async (req, res, next) => {
  try {
    const { parentId, status } = req.query;
    const results = await repository.listFolders({ parentId, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "CA-01-05 listFolders error");
    next(err);
  }
};

const getFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await repository.getFolderById(id);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Folder not found" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 getFolder error");
    next(err);
  }
};

const updateFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedFields = ["name", "parentId", "description", "status"];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const result = await repository.updateFolder(id, updates);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Folder not found or already deleted" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 updateFolder error");
    next(err);
  }
};

const deleteFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await repository.softDeleteFolder(id);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Folder not found or already deleted" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 deleteFolder error");
    next(err);
  }
};

// ============ DOCUMENTS ============
const documentSchema = Joi.object({
  folderId: Joi.string().uuid().allow(null),
  documentCode: Joi.string().max(120).required(),
  title: Joi.string().max(255).required(),
  summary: Joi.string().allow("", null),
  category: Joi.string().valid(...CATEGORIES).required(),
  ownerName: Joi.string().allow("", null),
  createdBy: Joi.string().allow("", null),
});

const createDocument = async (req, res, next) => {
  try {
    const { error, value } = documentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const existing = await repository.getDocumentByCode(value.documentCode);
    if (existing) {
      return res.status(409).json({ ok: false, message: "Document code already exists" });
    }

    const result = await repository.createDocument(value);
    logger.info({ documentId: result.id }, "CA-01-05: Document created");
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 createDocument error");
    next(err);
  }
};

const listDocuments = async (req, res, next) => {
  try {
    const { folderId, category, status } = req.query;
    const results = await repository.listDocuments({ folderId, category, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "CA-01-05 listDocuments error");
    next(err);
  }
};

const getDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await repository.getDocumentById(id);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Document not found" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 getDocument error");
    next(err);
  }
};

const updateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedFields = ["folderId", "title", "summary", "category", "ownerName", "status"];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const result = await repository.updateDocument(id, updates);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Document not found or already deleted" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 updateDocument error");
    next(err);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await repository.softDeleteDocument(id);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Document not found or already deleted" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 deleteDocument error");
    next(err);
  }
};

// ============ DOCUMENT VERSIONS ============
const documentVersionSchema = Joi.object({
  documentId: Joi.string().uuid().required(),
  versionNumber: Joi.number().integer().positive().required(),
  fileName: Joi.string().max(255).required(),
  filePath: Joi.string().required(),
  checksum: Joi.string().allow("", null),
  changeLog: Joi.string().allow("", null),
  createdBy: Joi.string().allow("", null),
});

const createDocumentVersion = async (req, res, next) => {
  try {
    const { error, value } = documentVersionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const result = await repository.createDocumentVersion(value);
    await repository.incrementVersion(value.documentId);
    logger.info({ versionId: result.id }, "CA-01-05: Document version created");
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 createDocumentVersion error");
    next(err);
  }
};

const listDocumentVersions = async (req, res, next) => {
  try {
    const { documentId } = req.query;
    const results = await repository.listDocumentVersions({ documentId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "CA-01-05 listDocumentVersions error");
    next(err);
  }
};

const getDocumentVersion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await repository.getDocumentVersionById(id);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Version not found" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 getDocumentVersion error");
    next(err);
  }
};

// ============ DOCUMENT PERMISSIONS ============
const permissionSchema = Joi.object({
  documentId: Joi.string().uuid().required(),
  roleName: Joi.string().max(120).required(),
  permissionLevel: Joi.string().valid(...PERMISSION_LEVELS).required(),
  createdBy: Joi.string().allow("", null),
});

const createDocumentPermission = async (req, res, next) => {
  try {
    const { error, value } = permissionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const result = await repository.createDocumentPermission(value);
    logger.info({ permissionId: result.id }, "CA-01-05: Permission created");
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-05 createDocumentPermission error");
    next(err);
  }
};

const listDocumentPermissions = async (req, res, next) => {
  try {
    const { documentId, roleName } = req.query;
    const results = await repository.listDocumentPermissions({ documentId, roleName });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "CA-01-05 listDocumentPermissions error");
    next(err);
  }
};

// ============ LEGACY: Snapshot & Transition ============
const FLOW_NAMES = ["versioning", "approval_flow", "pdf_stamp", "archiving"];
const FLOW_STATES = ["draft", "review", "approved", "archived"];

const snapshotSchema = Joi.object({
  flowName: Joi.string().valid(...FLOW_NAMES).required(),
  record: Joi.object({
    id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
    status: Joi.string().valid(...FLOW_STATES).optional(),
    notes: Joi.string().allow("", null).optional(),
    updatedBy: Joi.alternatives(Joi.string(), Joi.number()).optional(),
    updatedAt: Joi.date().iso().optional(),
  }).required(),
});

const buildSnapshot = async (req, res, next) => {
  try {
    const { error, value } = snapshotSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const snapshot = service.buildWorkflowSnapshot(value.record, value.flowName);
    return res.status(200).json({ ok: true, data: snapshot });
  } catch (err) {
    logger.error({ err }, "CA-01-05 buildSnapshot error");
    next(err);
  }
};

const transitionRecord = async (req, res, next) => {
  try {
    const transitionSchema = Joi.object({
      flowName: Joi.string().valid(...FLOW_NAMES).required(),
      record: Joi.object({
        id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
        status: Joi.string().valid(...FLOW_STATES).required(),
        notes: Joi.string().allow("", null).optional(),
        updatedBy: Joi.alternatives(Joi.string(), Joi.number()).optional(),
        updatedAt: Joi.date().iso().optional(),
      }).required(),
      toStatus: Joi.string().valid(...FLOW_STATES).required(),
      notes: Joi.string().allow("", null).optional(),
    });

    const { error, value } = transitionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const userId = req.user?.id || req.user?.uid || null;
    const result = await service.transitionWorkflowRecord(value.record, {
      flowName: value.flowName,
      toStatus: value.toStatus,
      notes: value.notes,
      userId,
    });

    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    if (err.status) {
      logger.warn({ err }, "CA-01-05 transition blocked by state machine.");
      return res.status(err.status).json({ ok: false, message: err.message, code: err.code });
    }

    logger.error({ err }, "CA-01-05 transitionRecord error");
    next(err);
  }
};

const validateTransition = async (req, res, next) => {
  try {
    const transitionSchema = Joi.object({
      flowName: Joi.string().valid(...FLOW_NAMES).required(),
      record: Joi.object({
        id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
        status: Joi.string().valid(...FLOW_STATES).required(),
        notes: Joi.string().allow("", null).optional(),
        updatedBy: Joi.alternatives(Joi.string(), Joi.number()).optional(),
        updatedAt: Joi.date().iso().optional(),
      }).required(),
      toStatus: Joi.string().valid(...FLOW_STATES).required(),
      notes: Joi.string().allow("", null).optional(),
    });

    const { error, value } = transitionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    service.validateWorkflowTransition({
      flowName: value.flowName,
      fromStatus: value.record.status,
      toStatus: value.toStatus,
    });

    return res.status(200).json({ ok: true, data: { allowed: true } });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, message: err.message, code: err.code });
    }

    next(err);
  }
};

module.exports = {
  createFolder,
  listFolders,
  getFolder,
  updateFolder,
  deleteFolder,
  createDocument,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  createDocumentVersion,
  listDocumentVersions,
  getDocumentVersion,
  createDocumentPermission,
  listDocumentPermissions,
  buildSnapshot,
  transitionRecord,
  validateTransition,
};