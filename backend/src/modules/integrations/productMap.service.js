const db = require("../../config/db");

const BUSINESS_CATEGORIES = Object.freeze([
  "equipment",
  "reagent",
  "determination",
  "calibrator",
  "control",
  "additional_investment",
  "service",
]);

const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 200;
const DEFAULT_MISSING_LIMIT = 200;
const MAX_MISSING_LIMIT = 1000;

const asNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
};

const normalizeText = (value, fallback = null) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

const normalizeNullableText = (value) => normalizeText(value, null);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildError = (message, { status = 400, code = "PRODUCT_MAP_ERROR", details = null } = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
};

const mapRow = (row) => ({
  id: Number(row.id),
  legacy_code: row.legacy_code || null,
  spi_sku: row.spi_sku || null,
  spi_equipment_model_id: row.spi_equipment_model_id ? Number(row.spi_equipment_model_id) : null,
  spi_equipment_model_name: row.spi_equipment_model_name || null,
  spi_equipment_model_code: row.spi_equipment_model_code || null,
  spi_equipment_model_sku: row.spi_equipment_model_sku || null,
  odoo_product_id: row.odoo_product_id ? Number(row.odoo_product_id) : null,
  business_category: row.business_category,
  active: Boolean(row.active),
  notes: row.notes || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const normalizePayload = (payload = {}) => ({
  legacy_code:
    Object.prototype.hasOwnProperty.call(payload, "legacy_code")
      ? normalizeNullableText(payload.legacy_code)
      : undefined,
  spi_sku:
    Object.prototype.hasOwnProperty.call(payload, "spi_sku")
      ? normalizeNullableText(payload.spi_sku)
      : undefined,
  spi_equipment_model_id:
    Object.prototype.hasOwnProperty.call(payload, "spi_equipment_model_id")
      ? asNumber(payload.spi_equipment_model_id, null)
      : undefined,
  odoo_product_id:
    Object.prototype.hasOwnProperty.call(payload, "odoo_product_id")
      ? asNumber(payload.odoo_product_id, null)
      : undefined,
  business_category:
    Object.prototype.hasOwnProperty.call(payload, "business_category")
      ? normalizeNullableText(payload.business_category)
      : undefined,
  active:
    Object.prototype.hasOwnProperty.call(payload, "active")
      ? Boolean(payload.active)
      : undefined,
  notes:
    Object.prototype.hasOwnProperty.call(payload, "notes")
      ? normalizeNullableText(payload.notes)
      : undefined,
});

const assertHasReference = (data) => {
  if (!data.legacy_code && !data.spi_sku && !data.spi_equipment_model_id) {
    throw buildError("Se requiere legacy_code, spi_sku o spi_equipment_model_id", {
      code: "PRODUCT_MAP_REFERENCE_REQUIRED",
    });
  }
};

const assertBusinessCategory = (businessCategory) => {
  if (!BUSINESS_CATEGORIES.includes(String(businessCategory || "").trim())) {
    throw buildError("business_category no permitido", {
      code: "PRODUCT_MAP_INVALID_CATEGORY",
      details: { allowed: BUSINESS_CATEGORIES },
    });
  }
};

const parsePgError = (error) => {
  if (!error || !error.code) return error;
  if (error.code === "23505") {
    return buildError("Conflicto de unicidad en libro de correspondencia", {
      status: 409,
      code: "PRODUCT_MAP_DUPLICATE",
      details: { constraint: error.constraint || null },
    });
  }
  if (error.code === "23503") {
    return buildError("Referencia invalida en libro de correspondencia", {
      status: 400,
      code: "PRODUCT_MAP_REFERENCE_INVALID",
      details: { constraint: error.constraint || null },
    });
  }
  if (error.code === "23514") {
    return buildError("Validacion de negocio incumplida en libro de correspondencia", {
      status: 400,
      code: "PRODUCT_MAP_CHECK_VIOLATION",
      details: { constraint: error.constraint || null },
    });
  }
  return error;
};

const findById = async (id) => {
  const { rows } = await db.query(
    `
    SELECT
      m.*,
      e.name AS spi_equipment_model_name,
      e.code AS spi_equipment_model_code,
      e.sku AS spi_equipment_model_sku
    FROM public.integration_product_map m
    LEFT JOIN public.equipment_models e ON e.id = m.spi_equipment_model_id
    WHERE m.id = $1
    LIMIT 1
    `,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const listProductMap = async ({ page = 1, limit = DEFAULT_LIST_LIMIT, active, q, business_category } = {}) => {
  const safePage = Math.max(1, asPositiveInt(page, 1));
  const safeLimit = clamp(asPositiveInt(limit, DEFAULT_LIST_LIMIT), 1, MAX_LIST_LIMIT);
  const offset = (safePage - 1) * safeLimit;
  const search = normalizeText(q, null);

  const where = [];
  const params = [];

  if (typeof active === "boolean") {
    params.push(active);
    where.push(`m.active = $${params.length}`);
  }

  if (business_category) {
    params.push(business_category);
    where.push(`m.business_category = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const searchParam = `$${params.length}`;
    where.push(`(
      COALESCE(m.legacy_code, '') ILIKE ${searchParam}
      OR COALESCE(m.spi_sku, '') ILIKE ${searchParam}
      OR COALESCE(m.notes, '') ILIKE ${searchParam}
      OR COALESCE(e.name, '') ILIKE ${searchParam}
      OR COALESCE(e.code, '') ILIKE ${searchParam}
      OR COALESCE(e.sku, '') ILIKE ${searchParam}
      OR COALESCE(m.odoo_product_id::text, '') ILIKE ${searchParam}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const listSql = `
    SELECT
      m.*,
      e.name AS spi_equipment_model_name,
      e.code AS spi_equipment_model_code,
      e.sku AS spi_equipment_model_sku
    FROM public.integration_product_map m
    LEFT JOIN public.equipment_models e ON e.id = m.spi_equipment_model_id
    ${whereSql}
    ORDER BY m.updated_at DESC, m.id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM public.integration_product_map m
    LEFT JOIN public.equipment_models e ON e.id = m.spi_equipment_model_id
    ${whereSql}
  `;

  const [listResult, countResult] = await Promise.all([
    db.query(listSql, [...params, safeLimit, offset]),
    db.query(countSql, params),
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total: Number(countResult.rows[0]?.total || 0),
    rows: listResult.rows.map(mapRow),
  };
};

const insertProductMap = async (payload) => {
  const normalized = normalizePayload(payload);
  assertHasReference(normalized);
  assertBusinessCategory(normalized.business_category);

  const finalData = {
    legacy_code: normalized.legacy_code ?? null,
    spi_sku: normalized.spi_sku ?? null,
    spi_equipment_model_id: normalized.spi_equipment_model_id ?? null,
    odoo_product_id: normalized.odoo_product_id ?? null,
    business_category: normalized.business_category,
    active: normalized.active ?? true,
    notes: normalized.notes ?? null,
  };

  if (finalData.active && !finalData.odoo_product_id) {
    throw buildError("odoo_product_id es requerido cuando active=true", {
      code: "PRODUCT_MAP_ODOO_REQUIRED",
    });
  }

  try {
    const { rows } = await db.query(
      `
      INSERT INTO public.integration_product_map (
        legacy_code,
        spi_sku,
        spi_equipment_model_id,
        odoo_product_id,
        business_category,
        active,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id
      `,
      [
        finalData.legacy_code,
        finalData.spi_sku,
        finalData.spi_equipment_model_id,
        finalData.odoo_product_id,
        finalData.business_category,
        finalData.active,
        finalData.notes,
      ],
    );

    return findById(rows[0].id);
  } catch (error) {
    throw parsePgError(error);
  }
};

const updateProductMap = async (id, payload) => {
  const mapId = asPositiveInt(id, null);
  if (!mapId) {
    throw buildError("id invalido", { code: "PRODUCT_MAP_ID_INVALID" });
  }

  const current = await findById(mapId);
  if (!current) {
    throw buildError("Fila de correspondencia no encontrada", {
      status: 404,
      code: "PRODUCT_MAP_NOT_FOUND",
    });
  }

  const normalized = normalizePayload(payload || {});
  const merged = {
    legacy_code: normalized.legacy_code !== undefined ? normalized.legacy_code : current.legacy_code,
    spi_sku: normalized.spi_sku !== undefined ? normalized.spi_sku : current.spi_sku,
    spi_equipment_model_id:
      normalized.spi_equipment_model_id !== undefined
        ? normalized.spi_equipment_model_id
        : current.spi_equipment_model_id,
    odoo_product_id:
      normalized.odoo_product_id !== undefined ? normalized.odoo_product_id : current.odoo_product_id,
    business_category:
      normalized.business_category !== undefined ? normalized.business_category : current.business_category,
    active: normalized.active !== undefined ? normalized.active : current.active,
    notes: normalized.notes !== undefined ? normalized.notes : current.notes,
  };

  assertHasReference(merged);
  assertBusinessCategory(merged.business_category);
  if (merged.active && !merged.odoo_product_id) {
    throw buildError("odoo_product_id es requerido cuando active=true", {
      code: "PRODUCT_MAP_ODOO_REQUIRED",
    });
  }

  try {
    await db.query(
      `
      UPDATE public.integration_product_map
      SET
        legacy_code = $1,
        spi_sku = $2,
        spi_equipment_model_id = $3,
        odoo_product_id = $4,
        business_category = $5,
        active = $6,
        notes = $7,
        updated_at = NOW()
      WHERE id = $8
      `,
      [
        merged.legacy_code,
        merged.spi_sku,
        merged.spi_equipment_model_id,
        merged.odoo_product_id,
        merged.business_category,
        merged.active,
        merged.notes,
        mapId,
      ],
    );

    return findById(mapId);
  } catch (error) {
    throw parsePgError(error);
  }
};

const findActiveMapByReferences = async ({ spi_equipment_model_id, spi_sku, legacy_code } = {}) => {
  const where = [];
  const params = [];

  if (spi_equipment_model_id) {
    params.push(spi_equipment_model_id);
    where.push(`spi_equipment_model_id = $${params.length}`);
  }
  if (spi_sku) {
    params.push(spi_sku);
    where.push(`LOWER(spi_sku) = LOWER($${params.length})`);
  }
  if (legacy_code) {
    params.push(legacy_code);
    where.push(`LOWER(legacy_code) = LOWER($${params.length})`);
  }

  if (!where.length) return null;

  const { rows } = await db.query(
    `
    SELECT id
    FROM public.integration_product_map
    WHERE active = TRUE
      AND (${where.join(" OR ")})
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
    `,
    params,
  );

  return rows[0] ? Number(rows[0].id) : null;
};

const upsertProductMap = async (payload = {}) => {
  const normalized = normalizePayload(payload);
  const explicitId = asPositiveInt(payload.id, null);

  if (explicitId) {
    const row = await updateProductMap(explicitId, normalized);
    return { action: "updated", row };
  }

  const matchId = await findActiveMapByReferences({
    spi_equipment_model_id: normalized.spi_equipment_model_id,
    spi_sku: normalized.spi_sku,
    legacy_code: normalized.legacy_code,
  });

  if (matchId) {
    const row = await updateProductMap(matchId, normalized);
    return { action: "updated", row };
  }

  const row = await insertProductMap(normalized);
  return { action: "created", row };
};

const getCoverageReport = async ({ missing_limit, missing_offset, include_inactive = false } = {}) => {
  const safeMissingLimit = clamp(
    asPositiveInt(missing_limit, DEFAULT_MISSING_LIMIT),
    1,
    MAX_MISSING_LIMIT,
  );
  const safeMissingOffset = Math.max(0, asNumber(missing_offset, 0) || 0);

  const catalogWhere = include_inactive
    ? ""
    : "WHERE COALESCE(e.status, '') NOT IN ('inactivo', 'deprecated')";

  const totalsSql = `
    WITH spi_catalog AS (
      SELECT e.id, e.code, e.sku, e.name, e.status
      FROM public.equipment_models e
      ${catalogWhere}
    ),
    matched AS (
      SELECT DISTINCT c.id
      FROM spi_catalog c
      JOIN public.integration_product_map m
        ON m.active = TRUE
       AND (
         m.spi_equipment_model_id = c.id
         OR (m.spi_sku IS NOT NULL AND c.sku IS NOT NULL AND LOWER(m.spi_sku) = LOWER(c.sku))
         OR (m.legacy_code IS NOT NULL AND c.code IS NOT NULL AND LOWER(m.legacy_code) = LOWER(c.code))
       )
    )
    SELECT
      (SELECT COUNT(*)::int FROM spi_catalog) AS total_spi_items,
      (SELECT COUNT(*)::int FROM matched) AS total_mapped;
  `;

  const missingSql = `
    WITH spi_catalog AS (
      SELECT e.id, e.code, e.sku, e.name, e.status
      FROM public.equipment_models e
      ${catalogWhere}
    ),
    matched AS (
      SELECT DISTINCT c.id
      FROM spi_catalog c
      JOIN public.integration_product_map m
        ON m.active = TRUE
       AND (
         m.spi_equipment_model_id = c.id
         OR (m.spi_sku IS NOT NULL AND c.sku IS NOT NULL AND LOWER(m.spi_sku) = LOWER(c.sku))
         OR (m.legacy_code IS NOT NULL AND c.code IS NOT NULL AND LOWER(m.legacy_code) = LOWER(c.code))
       )
    )
    SELECT
      c.id AS spi_equipment_model_id,
      c.code AS legacy_code,
      c.sku AS spi_sku,
      c.name AS spi_item_name,
      c.status AS spi_item_status
    FROM spi_catalog c
    LEFT JOIN matched m ON m.id = c.id
    WHERE m.id IS NULL
    ORDER BY c.name ASC, c.id ASC
    LIMIT $1 OFFSET $2
  `;

  const [totalsResult, missingResult] = await Promise.all([
    db.query(totalsSql),
    db.query(missingSql, [safeMissingLimit, safeMissingOffset]),
  ]);

  const totalSpiItems = Number(totalsResult.rows[0]?.total_spi_items || 0);
  const totalMapped = Number(totalsResult.rows[0]?.total_mapped || 0);

  return {
    missingInMap: missingResult.rows.map((row) => ({
      spi_equipment_model_id: Number(row.spi_equipment_model_id),
      legacy_code: row.legacy_code || null,
      spi_sku: row.spi_sku || null,
      spi_item_name: row.spi_item_name || null,
      spi_item_status: row.spi_item_status || null,
    })),
    totalMapped,
    totalSpiItems,
    missingCount: Math.max(0, totalSpiItems - totalMapped),
    missingLimit: safeMissingLimit,
    missingOffset: safeMissingOffset,
  };
};

module.exports = {
  BUSINESS_CATEGORIES,
  listProductMap,
  upsertProductMap,
  updateProductMap,
  getCoverageReport,
};
