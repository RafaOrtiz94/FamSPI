const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive } = require("../../config/google");
const { resolveExternalDriveIntegrity } = require("../../utils/documentHash");
const { upsertWorkflow } = require("./workflowRegistry.service");
const { appendWorkflowAuditEvent } = require("./workflowAudit.service");

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

const normalizeSourceType = (value) => String(value || "").trim().toLowerCase();
const normalizeSourceId = (value) => String(value || "").trim();

const trackFst07WorkflowDocument = async ({
  sourceType,
  sourceId,
  requestId = null,
  driveFileId = null,
  driveFolderId = null,
  driveLink = null,
  result = null,
  followUpDate = null,
  isReinspection = false,
  clientName = null,
  equipmentName = null,
  user = null,
  metadata = {},
}) => {
  try {
    const normalizedSourceType = normalizeSourceType(sourceType);
    const normalizedSourceId = normalizeSourceId(sourceId);
    if (!normalizedSourceType || !normalizedSourceId) return null;
    if (!driveFileId) return null;

    await ensureWorkflowDocumentsTable();

    const stageKey = "fst07_recorded";
    const normalizedResult = String(result || "").trim().toLowerCase() || null;
    const docMetadata = {
      document_origin: "fst07_site_inspection",
      result: normalizedResult,
      follow_up_date: followUpDate || null,
      is_reinspection: Boolean(isReinspection),
      drive_link: driveLink || null,
      tracked_at: new Date().toISOString(),
      ...(metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}),
    };

    const { rows: existingRows } = await db.query(
      `SELECT id
         FROM servicio.workflow_documents
        WHERE source_type = $1
          AND source_id = $2
          AND document_code = 'F.ST-07'
          AND COALESCE(drive_file_id, '') = COALESCE($3, '')
        LIMIT 1`,
      [normalizedSourceType, normalizedSourceId, driveFileId],
    );

    let documentRow = null;
    if (existingRows[0]?.id) {
      const { rows } = await db.query(
        `UPDATE servicio.workflow_documents
            SET stage_key = $1,
                drive_folder_id = COALESCE($2, drive_folder_id),
                request_id = COALESCE($3, request_id),
                metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                updated_at = now()
          WHERE id = $5
          RETURNING *`,
        [stageKey, driveFolderId || null, Number.isFinite(Number(requestId)) ? Number(requestId) : null, JSON.stringify(docMetadata), existingRows[0].id],
      );
      documentRow = rows[0] || null;
    } else {
      const { rows } = await db.query(
        `INSERT INTO servicio.workflow_documents (
            source_type, source_id, document_code, stage_key, drive_file_id, drive_folder_id,
            request_id, created_by, created_by_email, metadata, created_at, updated_at
          )
          VALUES ($1,$2,'F.ST-07',$3,$4,$5,$6,$7,$8,$9::jsonb,now(),now())
          RETURNING *`,
        [
          normalizedSourceType,
          normalizedSourceId,
          stageKey,
          driveFileId,
          driveFolderId || null,
          Number.isFinite(Number(requestId)) ? Number(requestId) : null,
          user?.id || null,
          user?.email || null,
          JSON.stringify(docMetadata),
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
        .catch((error) => logger.warn({ error }, "No se pudo resolver integridad de F.ST-07 en workflow"));
    }

    const workflowGlobalStatus = normalizedResult === "compliant" ? "in_progress" : "blocked";
    await upsertWorkflow({
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
      requestId: Number.isFinite(Number(requestId)) ? Number(requestId) : null,
      clientName: clientName || null,
      equipmentName: equipmentName || null,
      procedureCode: "ST-01-01",
      globalStatus: workflowGlobalStatus,
      currentStage: stageKey,
      metadata: {
        inspection_site_status: normalizedResult === "compliant" ? "ready_for_installation" : "non_compliant_reinspection_pending",
        inspection_site_follow_up_date: followUpDate || null,
        inspection_site_reinspection: Boolean(isReinspection),
        last_document_code: "F.ST-07",
        last_document_at: new Date().toISOString(),
      },
      user,
    });

    await appendWorkflowAuditEvent({
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
      procedureCode: "ST-01-01",
      eventType: normalizedResult === "compliant" ? "site_inspection_completed" : "site_inspection_requires_reinspection",
      stageKey,
      actor: user,
      payload: {
        result: normalizedResult,
        follow_up_date: followUpDate || null,
        is_reinspection: Boolean(isReinspection),
        request_id: Number.isFinite(Number(requestId)) ? Number(requestId) : null,
        drive_file_id: driveFileId,
        drive_link: driveLink || null,
      },
    });

    return documentRow;
  } catch (error) {
    logger.warn({ error }, "No se pudo registrar F.ST-07 en expediente transversal ST");
    return null;
  }
};

module.exports = {
  ensureWorkflowDocumentsTable,
  trackFst07WorkflowDocument,
};
