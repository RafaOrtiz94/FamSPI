const db = require("../../config/db");

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const normalizeNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const toObject = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
};

const normalizePackageItems = (items) => {
  if (Array.isArray(items)) {
    return items.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const asText = normalizeText(items);
  if (!asText) return [];
  return asText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

const normalizePackageEvidence = (evidence) =>
  toArray(evidence)
    .map((entry) => toObject(entry))
    .map((entry) => ({
      file_id: normalizeText(entry.file_id || entry.id),
      link: normalizeText(entry.link),
      name: normalizeText(entry.name),
      mime_type: normalizeText(entry.mime_type || entry.type),
    }))
    .filter((entry) => entry.file_id || entry.link);

const normalizePackageDraft = (draft = {}, index = 0) => {
  const data = toObject(draft);
  const packageLabel =
    normalizeText(data.package_label || data.label || data.bulto || data.codigo) ||
    `BULTO-${index + 1}`;
  return {
    package_label: packageLabel,
    package_type: normalizeText(data.package_type || data.tipo),
    package_weight_kg: normalizeNumber(data.package_weight_kg || data.weight_kg || data.peso_kg),
    package_dimensions: normalizeText(data.package_dimensions || data.dimensions || data.medidas),
    items_summary: normalizePackageItems(data.items_summary || data.items || data.contenido),
    evidence: normalizePackageEvidence(data.evidence),
  };
};

const ensureWithdrawalPackagingLabelsTable = async () => {
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.withdrawal_packaging_labels (
      id BIGSERIAL PRIMARY KEY,
      workflow_id BIGINT NOT NULL REFERENCES servicio.withdrawal_workflows(id) ON DELETE CASCADE,
      package_label TEXT NOT NULL,
      package_type TEXT,
      package_weight_kg NUMERIC(10,2),
      package_dimensions TEXT,
      items_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
      evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (workflow_id, package_label)
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_withdrawal_packaging_labels_workflow
      ON servicio.withdrawal_packaging_labels (workflow_id, updated_at DESC)
  `);
};

const listWithdrawalPackages = async ({ workflowId } = {}) => {
  const id = Number(workflowId);
  if (!Number.isFinite(id)) return [];
  await ensureWithdrawalPackagingLabelsTable();
  const { rows } = await db.query(
    `
      SELECT
        id,
        workflow_id,
        package_label,
        package_type,
        package_weight_kg,
        package_dimensions,
        items_summary,
        evidence,
        metadata,
        created_by,
        created_by_email,
        created_at,
        updated_at
      FROM servicio.withdrawal_packaging_labels
      WHERE workflow_id = $1
      ORDER BY package_label ASC, updated_at DESC
    `,
    [id],
  );
  return rows.map((row) => ({
    ...row,
    items_summary: Array.isArray(row.items_summary) ? row.items_summary : [],
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
  }));
};

const upsertWithdrawalPackages = async ({
  workflowId,
  packages = [],
  user = null,
  replaceExisting = true,
} = {}) => {
  const id = Number(workflowId);
  if (!Number.isFinite(id)) {
    throw new Error("workflowId invalido para registrar embalaje");
  }
  await ensureWithdrawalPackagingLabelsTable();

  const normalizedPackages = toArray(packages).map((pkg, index) =>
    normalizePackageDraft(pkg, index),
  );
  const labels = normalizedPackages.map((pkg) => pkg.package_label).filter(Boolean);

  if (!labels.length) {
    throw new Error("Debe registrar al menos un bulto/etiqueta");
  }

  for (const pkg of normalizedPackages) {
     
    await db.query(
      `
        INSERT INTO servicio.withdrawal_packaging_labels (
          workflow_id,
          package_label,
          package_type,
          package_weight_kg,
          package_dimensions,
          items_summary,
          evidence,
          metadata,
          created_by,
          created_by_email,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,now(),now())
        ON CONFLICT (workflow_id, package_label) DO UPDATE
          SET package_type = EXCLUDED.package_type,
              package_weight_kg = EXCLUDED.package_weight_kg,
              package_dimensions = EXCLUDED.package_dimensions,
              items_summary = EXCLUDED.items_summary,
              evidence = EXCLUDED.evidence,
              metadata = COALESCE(servicio.withdrawal_packaging_labels.metadata, '{}'::jsonb) || EXCLUDED.metadata,
              updated_at = now()
      `,
      [
        id,
        pkg.package_label,
        pkg.package_type,
        pkg.package_weight_kg,
        pkg.package_dimensions,
        JSON.stringify(pkg.items_summary || []),
        JSON.stringify(pkg.evidence || []),
        JSON.stringify({ source: "withdrawal_packaging", captured_at: new Date().toISOString() }),
        user?.id || null,
        user?.email || null,
      ],
    );
  }

  if (replaceExisting) {
    await db.query(
      `
        DELETE FROM servicio.withdrawal_packaging_labels
        WHERE workflow_id = $1
          AND NOT (package_label = ANY($2::text[]))
      `,
      [id, labels],
    );
  }

  return listWithdrawalPackages({ workflowId: id });
};

module.exports = {
  ensureWithdrawalPackagingLabelsTable,
  normalizePackageDraft,
  upsertWithdrawalPackages,
  listWithdrawalPackages,
};

