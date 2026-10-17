const db = require("../../config/db");

const SUPPORTED_WORKFLOW_SOURCE_TYPES = new Set([
  "public_purchase",
  "private_purchase",
  "business_case",
  "commercial_request",
  "maintenance_case",
  "corrective_case",
  "external_case",
  "manual",
]);

const normalizeSourceType = (value) => String(value || "").trim().toLowerCase();
const normalizeSourceId = (value) => String(value || "").trim();

const ensureWorkflowRegistryTable = async () => {
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.workflows (
      id BIGSERIAL PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      request_id INTEGER,
      client_name TEXT,
      equipment_name TEXT,
      procedure_code TEXT NOT NULL DEFAULT 'ST-01-01',
      global_status TEXT NOT NULL DEFAULT 'initiated',
      current_stage TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (source_type, source_id, procedure_code)
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_servicio_workflows_source
    ON servicio.workflows (source_type, source_id, updated_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_servicio_workflows_request
    ON servicio.workflows (request_id, updated_at DESC)
  `);
};

const validateSourceType = (sourceType) => SUPPORTED_WORKFLOW_SOURCE_TYPES.has(normalizeSourceType(sourceType));

const upsertWorkflow = async ({
  sourceType,
  sourceId,
  requestId = null,
  clientName = null,
  equipmentName = null,
  procedureCode = "ST-01-01",
  globalStatus = null,
  currentStage = null,
  metadata = {},
  user = null,
}) => {
  await ensureWorkflowRegistryTable();
  const normalizedSourceType = normalizeSourceType(sourceType);
  const normalizedSourceId = normalizeSourceId(sourceId);

  if (!normalizedSourceType || !normalizedSourceId) {
    throw new Error("source_type y source_id son obligatorios para registrar workflow");
  }
  if (!validateSourceType(normalizedSourceType)) {
    throw new Error(`source_type no soportado: ${normalizedSourceType}`);
  }

  const normalizedProcedureCode = String(procedureCode || "ST-01-01").trim().toUpperCase();
  const payloadMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};

  const { rows } = await db.query(
    `
      INSERT INTO servicio.workflows (
        source_type, source_id, request_id, client_name, equipment_name, procedure_code,
        global_status, current_stage, metadata, created_by, created_by_email, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, 'initiated'),$8,$9::jsonb,$10,$11,now(),now())
      ON CONFLICT (source_type, source_id, procedure_code) DO UPDATE
        SET request_id = COALESCE(EXCLUDED.request_id, servicio.workflows.request_id),
            client_name = COALESCE(EXCLUDED.client_name, servicio.workflows.client_name),
            equipment_name = COALESCE(EXCLUDED.equipment_name, servicio.workflows.equipment_name),
            global_status = COALESCE(EXCLUDED.global_status, servicio.workflows.global_status),
            current_stage = COALESCE(EXCLUDED.current_stage, servicio.workflows.current_stage),
            metadata = COALESCE(servicio.workflows.metadata, '{}'::jsonb) || EXCLUDED.metadata,
            created_by = COALESCE(servicio.workflows.created_by, EXCLUDED.created_by),
            created_by_email = COALESCE(servicio.workflows.created_by_email, EXCLUDED.created_by_email),
            updated_at = now()
      RETURNING *
    `,
    [
      normalizedSourceType,
      normalizedSourceId,
      Number.isFinite(Number(requestId)) ? Number(requestId) : null,
      clientName || null,
      equipmentName || null,
      normalizedProcedureCode,
      globalStatus || null,
      currentStage || null,
      JSON.stringify(payloadMetadata),
      user?.id || null,
      user?.email || null,
    ],
  );

  return rows[0] || null;
};

const getWorkflow = async ({ sourceType, sourceId, procedureCode = "ST-01-01" }) => {
  await ensureWorkflowRegistryTable();
  const normalizedSourceType = normalizeSourceType(sourceType);
  const normalizedSourceId = normalizeSourceId(sourceId);
  const normalizedProcedureCode = String(procedureCode || "ST-01-01").trim().toUpperCase();
  if (!normalizedSourceType || !normalizedSourceId) return null;

  const { rows } = await db.query(
    `
      SELECT *
      FROM servicio.workflows
      WHERE source_type = $1
        AND source_id = $2
        AND procedure_code = $3
      LIMIT 1
    `,
    [normalizedSourceType, normalizedSourceId, normalizedProcedureCode],
  );
  return rows[0] || null;
};

module.exports = {
  SUPPORTED_WORKFLOW_SOURCE_TYPES,
  ensureWorkflowRegistryTable,
  validateSourceType,
  upsertWorkflow,
  getWorkflow,
};

