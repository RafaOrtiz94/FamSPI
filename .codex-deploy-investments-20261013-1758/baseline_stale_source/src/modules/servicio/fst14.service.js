const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive } = require("../../config/google");
const { resolveExternalDriveIntegrity } = require("../../utils/documentHash");
const { upsertWorkflow } = require("./workflowRegistry.service");
const { appendWorkflowAuditEvent } = require("./workflowAudit.service");

const normalizeSourceType = (value) => String(value || "").trim().toLowerCase();
const normalizeSourceId = (value) => String(value || "").trim();
const normalizeDocumentCode = (value) => String(value || "").trim().toUpperCase();

const ensureWorkflowDocumentsTable = async () => {
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.workflow_documents (
      id BIGSERIAL PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      document_code TEXT NOT NULL,
      stage_key TEXT,
      drive_file_id TEXT,
      drive_folder_id TEXT,
      request_id INTEGER,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_workflow_documents_source
      ON servicio.workflow_documents (source_type, source_id, created_at DESC)`,
  );
  await db.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_documents_file
      ON servicio.workflow_documents (source_type, source_id, document_code, COALESCE(drive_file_id, ''))`,
  );
};

const trackWorkflowDocumentByCode = async ({
  sourceType,
  sourceId,
  documentCode,
  stageKey,
  eventType = "document_generated",
  requestId = null,
  driveFileId = null,
  driveFolderId = null,
  driveLink = null,
  clientName = null,
  equipmentName = null,
  user = null,
  metadata = {},
}) => {
  try {
    const normalizedSourceType = normalizeSourceType(sourceType);
    const normalizedSourceId = normalizeSourceId(sourceId);
    const normalizedDocumentCode = normalizeDocumentCode(documentCode);
    if (!normalizedSourceType || !normalizedSourceId || !normalizedDocumentCode) return null;
    if (!driveFileId) return null;

    await ensureWorkflowDocumentsTable();

    const payloadMetadata = {
      document_origin: "installation_workflow",
      drive_link: driveLink || null,
      tracked_at: new Date().toISOString(),
      ...(metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}),
    };

    const { rows: existingRows } = await db.query(
      `SELECT id
         FROM servicio.workflow_documents
        WHERE source_type = $1
          AND source_id = $2
          AND document_code = $3
          AND COALESCE(drive_file_id, '') = COALESCE($4, '')
        LIMIT 1`,
      [normalizedSourceType, normalizedSourceId, normalizedDocumentCode, driveFileId],
    );

    let documentRow = null;
    if (existingRows[0]?.id) {
      const { rows } = await db.query(
        `UPDATE servicio.workflow_documents
            SET stage_key = COALESCE($1, stage_key),
                drive_folder_id = COALESCE($2, drive_folder_id),
                request_id = COALESCE($3, request_id),
                metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                updated_at = now()
          WHERE id = $5
          RETURNING *`,
        [
          stageKey || null,
          driveFolderId || null,
          Number.isFinite(Number(requestId)) ? Number(requestId) : null,
          JSON.stringify(payloadMetadata),
          existingRows[0].id,
        ],
      );
      documentRow = rows[0] || null;
    } else {
      const { rows } = await db.query(
        `INSERT INTO servicio.workflow_documents (
            source_type, source_id, document_code, stage_key, drive_file_id, drive_folder_id,
            request_id, created_by, created_by_email, metadata, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,now(),now())
          RETURNING *`,
        [
          normalizedSourceType,
          normalizedSourceId,
          normalizedDocumentCode,
          stageKey || null,
          driveFileId,
          driveFolderId || null,
          Number.isFinite(Number(requestId)) ? Number(requestId) : null,
          user?.id || null,
          user?.email || null,
          JSON.stringify(payloadMetadata),
        ],
      );
      documentRow = rows[0] || null;
    }

    if (documentRow?.drive_file_id) {
      resolveExternalDriveIntegrity(documentRow.drive_file_id, drive)
        .then(async (integrity) => {
          if (!integrity) return;
          await db.query(
            `UPDATE servicio.workflow_documents
                SET metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{integrity}',
                  $1::jsonb,
                  true
                ),
                    updated_at = now()
              WHERE id = $2`,
            [JSON.stringify({ hash: integrity.hash, algorithm: integrity.algorithm }), documentRow.id],
          );
        })
        .catch((error) => logger.warn({ error }, "No se pudo resolver integridad documental de workflow"));
    }

    await upsertWorkflow({
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
      requestId: Number.isFinite(Number(requestId)) ? Number(requestId) : null,
      clientName: clientName || null,
      equipmentName: equipmentName || null,
      procedureCode: "ST-01-01",
      globalStatus: "in_progress",
      currentStage: stageKey || "technical_documents_in_progress",
      metadata: {
        last_document_code: normalizedDocumentCode,
        last_document_at: new Date().toISOString(),
      },
      user,
    });

    await appendWorkflowAuditEvent({
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
      procedureCode: "ST-01-01",
      eventType,
      stageKey: stageKey || "technical_documents_in_progress",
      actor: user,
      payload: {
        document_code: normalizedDocumentCode,
        request_id: Number.isFinite(Number(requestId)) ? Number(requestId) : null,
        drive_file_id: driveFileId,
        drive_folder_id: driveFolderId || null,
        drive_link: driveLink || null,
        metadata: payloadMetadata,
      },
    });

    return documentRow;
  } catch (error) {
    logger.warn({ error, sourceType, sourceId, documentCode }, "No se pudo registrar documento en workflow ST");
    return null;
  }
};

const trackFst14WorkflowDocument = async (params = {}) =>
  trackWorkflowDocumentByCode({
    ...params,
    documentCode: "F.ST-14",
    stageKey: "technical_documents_in_progress",
    eventType: "fst14_visual_reception_recorded",
  });

const trackFst10WorkflowDocument = async (params = {}) =>
  trackWorkflowDocumentByCode({
    ...params,
    documentCode: "F.ST-10",
    stageKey: "technical_documents_in_progress",
    eventType: "fst10_delivery_act_recorded",
  });

const trackFst09WorkflowDocument = async (params = {}) =>
  trackWorkflowDocumentByCode({
    ...params,
    documentCode: "F.ST-09",
    stageKey: "technical_documents_in_progress",
    eventType: "fst09_verification_recorded",
  });

module.exports = {
  ensureWorkflowDocumentsTable,
  trackWorkflowDocumentByCode,
  trackFst14WorkflowDocument,
  trackFst10WorkflowDocument,
  trackFst09WorkflowDocument,
};
