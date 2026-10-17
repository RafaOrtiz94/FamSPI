const db = require("../../config/db");

const QUOTATION_STATUS = Object.freeze({
  NOT_REQUIRED: "not_required",
  REQUESTED: "requested",
  ISSUED: "issued",
  APPROVED: "approved",
  REJECTED: "rejected",
  ORDERED: "ordered",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
});

const CLIENT_DECISION = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

const normalize = (value) => String(value || "").trim().toLowerCase();
const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const normalizeWarranty = (value) => {
  const normalized = normalize(value);
  if (["in_warranty", "garantia", "en_garantia", "en garantía"].includes(normalized)) return "in_warranty";
  if (["out_of_warranty", "fuera_garantia", "fuera de garantia", "sin_garantia"].includes(normalized)) {
    return "out_of_warranty";
  }
  return "unknown";
};

const ensureCorrectiveSparePartsTable = async () => {
  await db.query("CREATE SCHEMA IF NOT EXISTS servicio");
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.corrective_case_spare_parts (
      id BIGSERIAL PRIMARY KEY,
      case_id BIGINT NOT NULL REFERENCES servicio.corrective_cases(id) ON DELETE CASCADE,
      part_code TEXT,
      part_description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      warranty_status TEXT NOT NULL DEFAULT 'unknown',
      quotation_status TEXT NOT NULL DEFAULT '${QUOTATION_STATUS.NOT_REQUIRED}',
      quotation_reference TEXT,
      quotation_notes TEXT,
      quotation_requested_at TIMESTAMPTZ,
      quotation_issued_at TIMESTAMPTZ,
      pricing_currency TEXT DEFAULT 'USD',
      unit_price NUMERIC(14,2),
      total_price NUMERIC(14,2),
      client_decision TEXT NOT NULL DEFAULT '${CLIENT_DECISION.PENDING}',
      client_decision_at TIMESTAMPTZ,
      installation_visit_required BOOLEAN NOT NULL DEFAULT FALSE,
      replacement_installed_at TIMESTAMPTZ,
      removed_part_requires_disinfection BOOLEAN NOT NULL DEFAULT FALSE,
      fst02_file_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_corrective_spare_parts_case
      ON servicio.corrective_case_spare_parts (case_id, created_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_corrective_spare_parts_status
      ON servicio.corrective_case_spare_parts (quotation_status, client_decision, updated_at DESC)
  `);
};

const mapSparePartRow = (row) => ({
  id: Number(row.id),
  case_id: Number(row.case_id),
  part_code: row.part_code || null,
  part_description: row.part_description,
  quantity: Number(row.quantity || 1),
  warranty_status: row.warranty_status || "unknown",
  quotation_status: row.quotation_status || QUOTATION_STATUS.NOT_REQUIRED,
  quotation_reference: row.quotation_reference || null,
  quotation_notes: row.quotation_notes || null,
  quotation_requested_at: row.quotation_requested_at || null,
  quotation_issued_at: row.quotation_issued_at || null,
  pricing_currency: row.pricing_currency || "USD",
  unit_price: row.unit_price === null ? null : Number(row.unit_price),
  total_price: row.total_price === null ? null : Number(row.total_price),
  client_decision: row.client_decision || CLIENT_DECISION.PENDING,
  client_decision_at: row.client_decision_at || null,
  installation_visit_required: Boolean(row.installation_visit_required),
  replacement_installed_at: row.replacement_installed_at || null,
  removed_part_requires_disinfection: Boolean(row.removed_part_requires_disinfection),
  fst02_file_id: row.fst02_file_id || null,
  metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
  created_by: row.created_by || null,
  created_by_email: row.created_by_email || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getSparePartForCase = async ({ caseId, sparePartId, client = db }) => {
  const { rows } = await client.query(
    `
      SELECT *
      FROM servicio.corrective_case_spare_parts
      WHERE id = $1
        AND case_id = $2
      LIMIT 1
    `,
    [sparePartId, caseId],
  );
  if (!rows.length) {
    const error = new Error("Repuesto correctivo no encontrado para el caso");
    error.status = 404;
    error.code = "CORRECTIVE_SPARE_PART_NOT_FOUND";
    throw error;
  }
  return rows[0];
};

const listCaseSpareParts = async ({ caseId, client = db }) => {
  await ensureCorrectiveSparePartsTable();
  const { rows } = await client.query(
    `
      SELECT *
      FROM servicio.corrective_case_spare_parts
      WHERE case_id = $1
      ORDER BY created_at DESC
    `,
    [caseId],
  );
  return rows.map(mapSparePartRow);
};

const createSparePartRequest = async ({ caseId, payload = {}, user = null, client = db }) => {
  await ensureCorrectiveSparePartsTable();
  const partDescription = normalizeText(payload.part_description || payload.partDescription || payload.description);
  if (!partDescription) {
    const error = new Error("part_description es obligatorio para registrar repuesto");
    error.status = 400;
    error.code = "CORRECTIVE_SPARE_PART_DESCRIPTION_REQUIRED";
    throw error;
  }

  const quantity = Number.parseInt(String(payload.quantity || 1), 10);
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const warrantyStatus = normalizeWarranty(payload.warranty_status || payload.warrantyStatus);
  const requiresQuote = warrantyStatus === "out_of_warranty";
  const quotationStatus = requiresQuote ? QUOTATION_STATUS.REQUESTED : QUOTATION_STATUS.NOT_REQUIRED;

  const { rows } = await client.query(
    `
      INSERT INTO servicio.corrective_case_spare_parts (
        case_id, part_code, part_description, quantity, warranty_status, quotation_status,
        quotation_requested_at, quotation_notes, installation_visit_required,
        removed_part_requires_disinfection, metadata,
        created_by, created_by_email, created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        CASE WHEN $6 = '${QUOTATION_STATUS.REQUESTED}' THEN now() ELSE NULL END,
        $7,$8,$9,$10::jsonb,
        $11,$12,now(),now()
      )
      RETURNING *
    `,
    [
      caseId,
      normalizeText(payload.part_code || payload.partCode),
      partDescription,
      safeQuantity,
      warrantyStatus,
      quotationStatus,
      normalizeText(payload.quotation_notes || payload.notes),
      Boolean(payload.installation_visit_required || payload.installationVisitRequired),
      Boolean(payload.removed_part_requires_disinfection || payload.removedPartRequiresDisinfection),
      JSON.stringify(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}),
      user?.id || null,
      user?.email || null,
    ],
  );

  return mapSparePartRow(rows[0]);
};

const requestCommercialQuote = async ({ caseId, sparePartId, notes = null, user = null, client = db }) => {
  await ensureCorrectiveSparePartsTable();
  await getSparePartForCase({ caseId, sparePartId, client });
  const { rows } = await client.query(
    `
      UPDATE servicio.corrective_case_spare_parts
      SET
        quotation_status = '${QUOTATION_STATUS.REQUESTED}',
        quotation_requested_at = COALESCE(quotation_requested_at, now()),
        quotation_notes = COALESCE($3, quotation_notes),
        updated_at = now()
      WHERE id = $1
        AND case_id = $2
      RETURNING *
    `,
    [sparePartId, caseId, normalizeText(notes || null)],
  );
  return mapSparePartRow(rows[0]);
};

const issueCommercialQuote = async ({ caseId, sparePartId, payload = {}, user = null, client = db }) => {
  await ensureCorrectiveSparePartsTable();
  await getSparePartForCase({ caseId, sparePartId, client });

  const unitPriceRaw = payload.unit_price ?? payload.unitPrice;
  const totalPriceRaw = payload.total_price ?? payload.totalPrice;
  const unitPrice = unitPriceRaw === null || unitPriceRaw === undefined ? null : Number(unitPriceRaw);
  const totalPrice = totalPriceRaw === null || totalPriceRaw === undefined ? null : Number(totalPriceRaw);
  if (unitPrice !== null && !Number.isFinite(unitPrice)) {
    const error = new Error("unit_price inválido");
    error.status = 400;
    error.code = "CORRECTIVE_SPARE_PART_UNIT_PRICE_INVALID";
    throw error;
  }
  if (totalPrice !== null && !Number.isFinite(totalPrice)) {
    const error = new Error("total_price inválido");
    error.status = 400;
    error.code = "CORRECTIVE_SPARE_PART_TOTAL_PRICE_INVALID";
    throw error;
  }

  const { rows } = await client.query(
    `
      UPDATE servicio.corrective_case_spare_parts
      SET
        quotation_status = '${QUOTATION_STATUS.ISSUED}',
        quotation_reference = COALESCE($3, quotation_reference),
        quotation_notes = COALESCE($4, quotation_notes),
        quotation_issued_at = now(),
        pricing_currency = COALESCE($5, pricing_currency),
        unit_price = COALESCE($6, unit_price),
        total_price = COALESCE($7, total_price),
        client_decision = '${CLIENT_DECISION.PENDING}',
        client_decision_at = NULL,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'quote_issued_by', $8::text,
          'quote_issued_by_id', $9::int
        ),
        updated_at = now()
      WHERE id = $1
        AND case_id = $2
      RETURNING *
    `,
    [
      sparePartId,
      caseId,
      normalizeText(payload.quotation_reference || payload.quotationReference),
      normalizeText(payload.quotation_notes || payload.notes),
      normalizeText(payload.pricing_currency || payload.currency || "USD"),
      unitPrice,
      totalPrice,
      user?.email || null,
      user?.id || null,
    ],
  );
  return mapSparePartRow(rows[0]);
};

const recordClientDecision = async ({
  caseId,
  sparePartId,
  decision,
  notes = null,
  decidedBy = null,
  client = db,
}) => {
  await ensureCorrectiveSparePartsTable();
  const normalizedDecision = normalize(decision);
  if (![CLIENT_DECISION.APPROVED, CLIENT_DECISION.REJECTED].includes(normalizedDecision)) {
    const error = new Error("decision debe ser approved o rejected");
    error.status = 400;
    error.code = "CORRECTIVE_SPARE_PART_DECISION_INVALID";
    throw error;
  }
  await getSparePartForCase({ caseId, sparePartId, client });

  const nextStatus =
    normalizedDecision === CLIENT_DECISION.APPROVED
      ? QUOTATION_STATUS.APPROVED
      : QUOTATION_STATUS.REJECTED;

  const { rows } = await client.query(
    `
      UPDATE servicio.corrective_case_spare_parts
      SET
        quotation_status = $3,
        client_decision = $4,
        client_decision_at = now(),
        quotation_notes = COALESCE($5, quotation_notes),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'client_decision_by', $6::text
        ),
        updated_at = now()
      WHERE id = $1
        AND case_id = $2
      RETURNING *
    `,
    [
      sparePartId,
      caseId,
      nextStatus,
      normalizedDecision,
      normalizeText(notes),
      normalizeText(decidedBy),
    ],
  );
  return mapSparePartRow(rows[0]);
};

const markPartInstalled = async ({ caseId, sparePartId, payload = {}, client = db }) => {
  await ensureCorrectiveSparePartsTable();
  const current = await getSparePartForCase({ caseId, sparePartId, client });
  if (
    current.warranty_status === "out_of_warranty"
    && ![QUOTATION_STATUS.APPROVED, QUOTATION_STATUS.ORDERED].includes(current.quotation_status)
  ) {
    const error = new Error("No se puede cambiar la parte sin aprobación formal del cliente");
    error.status = 409;
    error.code = "CORRECTIVE_SPARE_PART_CLIENT_APPROVAL_REQUIRED";
    throw error;
  }
  const { rows } = await client.query(
    `
      UPDATE servicio.corrective_case_spare_parts
      SET
        quotation_status = '${QUOTATION_STATUS.INSTALLED}',
        replacement_installed_at = now(),
        installation_visit_required = true,
        removed_part_requires_disinfection = COALESCE($3, removed_part_requires_disinfection),
        fst02_file_id = COALESCE($4, fst02_file_id),
        quotation_notes = COALESCE($5, quotation_notes),
        updated_at = now()
      WHERE id = $1
        AND case_id = $2
      RETURNING *
    `,
    [
      sparePartId,
      caseId,
      payload.removed_part_requires_disinfection ?? payload.removedPartRequiresDisinfection ?? null,
      normalizeText(payload.fst02_file_id || payload.fst02FileId),
      normalizeText(payload.notes),
    ],
  );
  return mapSparePartRow(rows[0]);
};

module.exports = {
  QUOTATION_STATUS,
  CLIENT_DECISION,
  normalizeWarranty,
  ensureCorrectiveSparePartsTable,
  mapSparePartRow,
  getSparePartForCase,
  listCaseSpareParts,
  createSparePartRequest,
  requestCommercialQuote,
  issueCommercialQuote,
  recordClientDecision,
  markPartInstalled,
};
