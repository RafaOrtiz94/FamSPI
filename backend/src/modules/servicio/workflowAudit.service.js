const db = require("../../config/db");

const ensureWorkflowAuditEventsTable = async () => {
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.workflow_audit_events (
      id BIGSERIAL PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      procedure_code TEXT NOT NULL DEFAULT 'ST-01-01',
      event_type TEXT NOT NULL,
      stage_key TEXT,
      actor_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      actor_email TEXT,
      event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_workflow_audit_events_source
    ON servicio.workflow_audit_events (source_type, source_id, created_at DESC)
  `);
};

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
};

const appendWorkflowAuditEvent = async ({
  sourceType,
  sourceId,
  procedureCode = "ST-01-01",
  eventType,
  stageKey = null,
  actor = null,
  payload = {},
}) => {
  await ensureWorkflowAuditEventsTable();
  const normalizedSourceType = String(sourceType || "").trim().toLowerCase();
  const normalizedSourceId = String(sourceId || "").trim();
  const normalizedProcedureCode = String(procedureCode || "ST-01-01").trim().toUpperCase();
  const normalizedEventType = String(eventType || "").trim().toLowerCase();
  if (!normalizedSourceType || !normalizedSourceId || !normalizedEventType) return null;

  const eventPayload = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const { rows } = await db.query(
    `
      INSERT INTO servicio.workflow_audit_events (
        source_type, source_id, procedure_code, event_type, stage_key,
        actor_user_id, actor_email, event_payload, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now())
      RETURNING *
    `,
    [
      normalizedSourceType,
      normalizedSourceId,
      normalizedProcedureCode,
      normalizedEventType,
      stageKey || null,
      actor?.id || null,
      actor?.email || null,
      JSON.stringify(eventPayload),
    ],
  );
  return rows[0] || null;
};

const listWorkflowTimeline = async ({
  sourceType,
  sourceId,
  procedureCode = "ST-01-01",
  limit = 100,
}) => {
  await ensureWorkflowAuditEventsTable();
  await ensureWorkflowDocumentsTable();
  const normalizedSourceType = String(sourceType || "").trim().toLowerCase();
  const normalizedSourceId = String(sourceId || "").trim();
  const normalizedProcedureCode = String(procedureCode || "ST-01-01").trim().toUpperCase();
  const safeLimit = Math.max(1, Math.min(200, Number.parseInt(String(limit || "100"), 10) || 100));
  if (!normalizedSourceType || !normalizedSourceId) return [];

  const { rows } = await db.query(
    `
      SELECT *
      FROM (
        SELECT
          CONCAT('audit-', wa.id::text) AS id,
          wa.created_at AS event_at,
          'audit'::text AS event_source,
          wa.event_type,
          wa.stage_key,
          wa.actor_user_id,
          wa.actor_email,
          wa.event_payload AS payload
        FROM servicio.workflow_audit_events wa
        WHERE wa.source_type = $1
          AND wa.source_id = $2
          AND wa.procedure_code = $3

        UNION ALL

        SELECT
          CONCAT('doc-', wd.id::text) AS id,
          wd.created_at AS event_at,
          'document'::text AS event_source,
          'document_generated'::text AS event_type,
          wd.stage_key,
          wd.created_by AS actor_user_id,
          wd.created_by_email AS actor_email,
          jsonb_build_object(
            'document_code', wd.document_code,
            'drive_file_id', wd.drive_file_id,
            'drive_folder_id', wd.drive_folder_id,
            'request_id', wd.request_id,
            'metadata', wd.metadata
          ) AS payload
        FROM servicio.workflow_documents wd
        WHERE wd.source_type = $1
          AND wd.source_id = $2
      ) timeline
      ORDER BY event_at DESC
      LIMIT $4
    `,
    [normalizedSourceType, normalizedSourceId, normalizedProcedureCode, safeLimit],
  );

  return rows || [];
};

module.exports = {
  ensureWorkflowAuditEventsTable,
  appendWorkflowAuditEvent,
  listWorkflowTimeline,
};

