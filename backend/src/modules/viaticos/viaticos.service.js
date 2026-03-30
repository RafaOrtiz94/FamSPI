const db = require("../../config/db");
const { uploadBase64File } = require("../../utils/drive");
const { HASH_ALGORITHM, computeSha256HexFromBase64 } = require("../../utils/documentHash");

const FINANCE_ROLES = ["finanzas", "jefe_finanzas", "jefe_financiero", "gerencia", "gerencia_general"];
const REQUESTER_ROLES = [
  "comercial",
  "jefe_comercial",
  "acp_comercial",
  "backoffice_comercial",
  "servicio_tecnico",
  "tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
];

const ALLOWED_STATUSES = new Set(["pending", "approved", "paid", "rejected"]);
const ALLOWED_SOURCE_TYPES = new Set(["client_visit", "prospect_visit", "manual_trip"]);
const ALLOWED_DOC_TYPES = new Set(["invoice", "liquidation", "support"]);
let schemaReadyPromise = null;

const toLower = (value) => String(value || "").trim().toLowerCase();

function normalizeRoleList(value) {
  if (Array.isArray(value)) {
    return value.map(toLower).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map(toLower)
    .filter(Boolean);
}

function collectUserRoles(user = {}) {
  return new Set([
    ...normalizeRoleList(user.role),
    ...normalizeRoleList(user.scope),
    ...normalizeRoleList(user.role_name),
    ...normalizeRoleList(user.roles),
    ...normalizeRoleList(user.scopes),
  ]);
}

function isFinanceUser(user = {}) {
  const roles = collectUserRoles(user);
  return Array.from(roles).some((role) => FINANCE_ROLES.includes(role));
}

function canAccessViaticos(user = {}) {
  if (isFinanceUser(user)) return true;
  const roles = collectUserRoles(user);
  return Array.from(roles).some((role) => REQUESTER_ROLES.includes(role));
}

function assertViaticosAccess(user = {}) {
  if (!canAccessViaticos(user)) {
    const error = new Error("No tienes permisos para acceder a viaticos");
    error.status = 403;
    throw error;
  }
}

function assertFinance(user = {}) {
  if (!isFinanceUser(user)) {
    const error = new Error("Solo finanzas puede ejecutar esta accion");
    error.status = 403;
    throw error;
  }
}

async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowances (
      id BIGSERIAL PRIMARY KEY,
      source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('client_visit', 'prospect_visit', 'manual_trip')),
      source_id BIGINT,
      requester_email TEXT NOT NULL,
      requester_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      visit_date DATE NOT NULL,
      city TEXT,
      trip_type TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      currency VARCHAR(8) NOT NULL DEFAULT 'USD',
      distance_km NUMERIC(12,2) NOT NULL DEFAULT 0,
      outside_labor_area BOOLEAN NOT NULL DEFAULT FALSE,
      outside_labor_area_reason TEXT,
      fuel_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      liquidation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      approved_amount NUMERIC(12,2),
      attendance_check_status VARCHAR(20) NOT NULL DEFAULT 'unchecked',
      attendance_check_payload JSONB,
      finance_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      payment_date DATE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER TABLE travel_allowances
      ADD COLUMN IF NOT EXISTS trip_type TEXT,
      ADD COLUMN IF NOT EXISTS distance_km NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS outside_labor_area BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS outside_labor_area_reason TEXT,
      ADD COLUMN IF NOT EXISTS fuel_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS liquidation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS attendance_check_status VARCHAR(20) NOT NULL DEFAULT 'unchecked',
      ADD COLUMN IF NOT EXISTS attendance_check_payload JSONB,
      ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
  `);

  await db.query(`
    ALTER TABLE travel_allowances
      ALTER COLUMN source_id DROP NOT NULL;
  `).catch(() => null);

  await db.query(`
    DO $$
    DECLARE
      status_constraint_name TEXT;
      source_constraint_name TEXT;
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'travel_allowances_source_type_source_id_key'
          AND conrelid = 'travel_allowances'::regclass
      ) THEN
        ALTER TABLE travel_allowances DROP CONSTRAINT travel_allowances_source_type_source_id_key;
      END IF;

      SELECT conname INTO source_constraint_name
      FROM pg_constraint
      WHERE conrelid = 'travel_allowances'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%source_type IN%';

      IF source_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE travel_allowances DROP CONSTRAINT %I', source_constraint_name);
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'travel_allowances_source_type_check'
          AND conrelid = 'travel_allowances'::regclass
      ) THEN
        ALTER TABLE travel_allowances
          ADD CONSTRAINT travel_allowances_source_type_check
          CHECK (source_type IN ('client_visit', 'prospect_visit', 'manual_trip'));
      END IF;

      SELECT conname INTO status_constraint_name
      FROM pg_constraint
      WHERE conrelid = 'travel_allowances'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%attendance_check_status%';

      IF status_constraint_name IS NULL THEN
        ALTER TABLE travel_allowances
          ADD CONSTRAINT travel_allowances_attendance_check_status
          CHECK (attendance_check_status IN ('unchecked', 'matched', 'review', 'mismatch', 'no_attendance', 'insufficient_geo'));
      END IF;
    END $$;
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_travel_allowances_visit_source
      ON travel_allowances(source_type, source_id)
      WHERE source_id IS NOT NULL
        AND source_type IN ('client_visit', 'prospect_visit');
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_documents (
      id BIGSERIAL PRIMARY KEY,
      allowance_id BIGINT NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
      doc_type VARCHAR(30) NOT NULL CHECK (doc_type IN ('invoice', 'liquidation', 'support')),
      file_name TEXT NOT NULL,
      mime_type TEXT,
      drive_file_id TEXT,
      drive_link TEXT,
      content_hash_sha256 VARCHAR(64),
      hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
      amount NUMERIC(12,2),
      expense_date DATE,
      invoice_number TEXT,
      notes TEXT,
      uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER TABLE travel_allowance_documents
    ADD COLUMN IF NOT EXISTS content_hash_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS hash_algorithm VARCHAR(20) DEFAULT 'SHA-256';
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowance_documents_allowance_id
      ON travel_allowance_documents(allowance_id);
  `);
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });

  return schemaReadyPromise;
}

function resolveDateRange(startDate, endDate) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return {
    startDate: startDate || firstDay,
    endDate: endDate || lastDay,
  };
}

function parseLocationPoint(rawValue) {
  if (!rawValue) return null;
  const parts = String(rawValue)
    .split(",")
    .map((part) => Number(part.trim()));

  if (parts.length < 2) return null;
  const [lat, lng] = parts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) * Math.sin(dLat / 2);
  const s2 = Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(s1 + s2), Math.sqrt(1 - (s1 + s2)));
  return R * c;
}

async function listVisitCandidates({ actorUser, startDate, endDate, status, requesterEmail }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const range = resolveDateRange(startDate, endDate);
  const params = [range.startDate, range.endDate];
  const filters = [];

  if (status && ALLOWED_STATUSES.has(toLower(status))) {
    params.push(toLower(status));
    filters.push(`COALESCE(ta.status, 'pending') = $${params.length}`);
  }

  if (requesterEmail) {
    params.push(String(requesterEmail).toLowerCase());
    filters.push(`LOWER(base.requester_email) = $${params.length}`);
  }

  if (!isFinanceUser(actorUser)) {
    params.push(String(actorUser.email || "").toLowerCase());
    filters.push(`LOWER(base.requester_email) = $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows } = await db.query(
    `
      WITH client_visits AS (
        SELECT
          'client_visit'::text AS source_type,
          cvl.id::bigint AS source_id,
          cvl.user_email AS requester_email,
          u.id AS requester_user_id,
          cvl.visit_date,
          COALESCE(cr.shipping_city, cr.establishment_city, 'N/A') AS city,
          cr.commercial_name AS reference_name,
          cvl.hora_entrada,
          cvl.hora_salida,
          cvl.lat_entrada,
          cvl.lng_entrada,
          cvl.lat_salida,
          cvl.lng_salida,
          cvl.duracion_minutos
        FROM client_visit_logs cvl
        LEFT JOIN client_requests cr ON cr.id = cvl.client_request_id
        LEFT JOIN users u ON LOWER(u.email) = LOWER(cvl.user_email)
        WHERE cvl.visit_date BETWEEN $1 AND $2
          AND cvl.status = 'visited'
      ),
      prospect_visits AS (
        SELECT
          'prospect_visit'::text AS source_type,
          pv.id::bigint AS source_id,
          pv.user_email AS requester_email,
          u.id AS requester_user_id,
          pv.visit_date,
          'Prospecto'::text AS city,
          pv.prospect_name AS reference_name,
          pv.check_in_time AS hora_entrada,
          pv.check_out_time AS hora_salida,
          pv.check_in_lat AS lat_entrada,
          pv.check_in_lng AS lng_entrada,
          pv.check_out_lat AS lat_salida,
          pv.check_out_lng AS lng_salida,
          NULL::integer AS duracion_minutos
        FROM prospect_visits pv
        LEFT JOIN users u ON LOWER(u.email) = LOWER(pv.user_email)
        WHERE pv.visit_date BETWEEN $1 AND $2
          AND pv.status = 'visited'
      ),
      base AS (
        SELECT * FROM client_visits
        UNION ALL
        SELECT * FROM prospect_visits
      )
      SELECT
        base.*,
        ta.id AS allowance_id,
        ta.status AS allowance_status,
        ta.amount,
        ta.currency,
        ta.distance_km,
        ta.fuel_amount,
        ta.liquidation_amount,
        ta.outside_labor_area,
        ta.attendance_check_status,
        ta.payment_date,
        ta.notes,
        ta.updated_at AS allowance_updated_at,
        fu.fullname AS finance_user_name
      FROM base
      LEFT JOIN travel_allowances ta
        ON ta.source_type = base.source_type
       AND ta.source_id = base.source_id
      LEFT JOIN users fu ON fu.id = ta.finance_user_id
      ${whereClause}
      ORDER BY base.visit_date DESC, base.source_type, base.source_id DESC
      LIMIT 1000
    `,
    params
  );

  return rows;
}

async function listAllowances({ actorUser, startDate, endDate, status }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const range = resolveDateRange(startDate, endDate);
  const params = [range.startDate, range.endDate];
  const filters = ["ta.visit_date BETWEEN $1 AND $2"];

  if (status && ALLOWED_STATUSES.has(toLower(status))) {
    params.push(toLower(status));
    filters.push(`ta.status = $${params.length}`);
  }

  if (!isFinanceUser(actorUser)) {
    params.push(String(actorUser.email || "").toLowerCase());
    filters.push(`LOWER(ta.requester_email) = $${params.length}`);
  }

  const { rows } = await db.query(
    `
      SELECT
        ta.*,
        ru.fullname AS requester_name,
        fu.fullname AS finance_user_name,
        COALESCE(doc.docs_count, 0) AS docs_count,
        COALESCE(doc.invoices_total, 0) AS invoices_total
      FROM travel_allowances ta
      LEFT JOIN users ru ON ru.id = ta.requester_user_id
      LEFT JOIN users fu ON fu.id = ta.finance_user_id
      LEFT JOIN (
        SELECT
          allowance_id,
          COUNT(*)::int AS docs_count,
          COALESCE(SUM(CASE WHEN doc_type = 'invoice' THEN amount ELSE 0 END), 0) AS invoices_total
        FROM travel_allowance_documents
        GROUP BY allowance_id
      ) doc ON doc.allowance_id = ta.id
      WHERE ${filters.join(" AND ")}
      ORDER BY ta.visit_date DESC, ta.id DESC
      LIMIT 1000
    `,
    params
  );

  return rows;
}

async function resolveReferencedVisit(sourceType, sourceId) {
  if (sourceType === "client_visit") {
    const { rows } = await db.query(
      `
        SELECT
          cvl.id,
          cvl.user_email AS requester_email,
          u.id AS requester_user_id,
          cvl.visit_date,
          COALESCE(cr.shipping_city, cr.establishment_city, 'N/A') AS city
        FROM client_visit_logs cvl
        LEFT JOIN client_requests cr ON cr.id = cvl.client_request_id
        LEFT JOIN users u ON LOWER(u.email) = LOWER(cvl.user_email)
        WHERE cvl.id = $1
          AND cvl.status = 'visited'
        LIMIT 1
      `,
      [sourceId]
    );
    return rows[0] || null;
  }

  if (sourceType === "prospect_visit") {
    const { rows } = await db.query(
      `
        SELECT
          pv.id,
          pv.user_email AS requester_email,
          u.id AS requester_user_id,
          pv.visit_date,
          'Prospecto'::text AS city
        FROM prospect_visits pv
        LEFT JOIN users u ON LOWER(u.email) = LOWER(pv.user_email)
        WHERE pv.id = $1
          AND pv.status = 'visited'
        LIMIT 1
      `,
      [sourceId]
    );
    return rows[0] || null;
  }

  return null;
}

async function getAllowanceById(allowanceId) {
  const { rows } = await db.query(`SELECT * FROM travel_allowances WHERE id = $1 LIMIT 1`, [allowanceId]);
  return rows[0] || null;
}

function assertAllowanceAccess(allowance, actorUser) {
  const finance = isFinanceUser(actorUser);
  const requesterEmail = String(actorUser?.email || "").toLowerCase();
  if (finance) return;
  if (String(allowance?.requester_email || "").toLowerCase() !== requesterEmail) {
    const error = new Error("No tienes acceso a este viatico");
    error.status = 403;
    throw error;
  }
}

async function upsertAllowance({ actorUser, payload }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const sourceType = toLower(payload.source_type || "manual_trip");
  const sourceId = payload.source_id === undefined || payload.source_id === null || payload.source_id === ""
    ? null
    : Number(payload.source_id);
  const amount = Number(payload.amount || 0);
  const status = toLower(payload.status || "pending");
  const distanceKm = Number(payload.distance_km || 0);
  const fuelAmount = Number(payload.fuel_amount || 0);
  const liquidationAmount = Number(payload.liquidation_amount || 0);

  if (!ALLOWED_SOURCE_TYPES.has(sourceType)) {
    const error = new Error("source_type invalido");
    error.status = 400;
    throw error;
  }

  if (sourceId !== null && (!Number.isFinite(sourceId) || sourceId <= 0)) {
    const error = new Error("source_id invalido");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(amount) || amount < 0) {
    const error = new Error("amount invalido");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(fuelAmount) || fuelAmount < 0) {
    const error = new Error("distance_km o fuel_amount invalido");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(liquidationAmount) || liquidationAmount < 0) {
    const error = new Error("liquidation_amount invalido");
    error.status = 400;
    throw error;
  }

  const financeActor = isFinanceUser(actorUser);
  const finalStatus = financeActor && ALLOWED_STATUSES.has(status) ? status : "pending";
  const paymentDate = finalStatus === "paid" ? payload.payment_date || new Date().toISOString().slice(0, 10) : null;
  const outsideLaborArea = Boolean(payload.outside_labor_area);

  if (!financeActor && !outsideLaborArea) {
    const error = new Error("Solo se permiten viaticos para gastos fuera del area de labores");
    error.status = 400;
    throw error;
  }

  if (fuelAmount > 0 && distanceKm <= 1000) {
    const error = new Error("Gasolina solo aplica cuando la distancia supera 1000 km");
    error.status = 400;
    throw error;
  }

  let resolvedRequesterEmail = String(actorUser.email || "").toLowerCase();
  let resolvedRequesterId = actorUser.id || null;
  let resolvedVisitDate = payload.visit_date || new Date().toISOString().slice(0, 10);
  let resolvedCity = payload.city || null;

  if (sourceType !== "manual_trip") {
    if (!sourceId) {
      const error = new Error("source_id es obligatorio para visitas");
      error.status = 400;
      throw error;
    }

    const visitData = await resolveReferencedVisit(sourceType, sourceId);
    if (!visitData) {
      const error = new Error("No existe la visita referenciada");
      error.status = 404;
      throw error;
    }

    resolvedRequesterEmail = String(visitData.requester_email || "").toLowerCase();
    resolvedRequesterId = visitData.requester_user_id || null;
    resolvedVisitDate = visitData.visit_date;
    resolvedCity = visitData.city;

    if (!financeActor && resolvedRequesterEmail !== String(actorUser.email || "").toLowerCase()) {
      const error = new Error("No puedes registrar viaticos de otros usuarios");
      error.status = 403;
      throw error;
    }
  } else if (!financeActor) {
    resolvedRequesterEmail = String(actorUser.email || "").toLowerCase();
    resolvedRequesterId = actorUser.id || null;
  }

  if (sourceType === "manual_trip" || sourceId === null) {
    const { rows } = await db.query(
      `
        INSERT INTO travel_allowances (
          source_type, source_id, requester_email, requester_user_id, visit_date, city, trip_type,
          status, amount, currency, distance_km, outside_labor_area, outside_labor_area_reason,
          fuel_amount, liquidation_amount, approved_amount,
          attendance_check_status, attendance_check_payload,
          finance_user_id, reviewed_by_user_id, reviewed_at,
          payment_date, notes, created_at, updated_at
        )
        VALUES (
          $1, NULL, $2, $3, $4, $5, $6,
          $7, $8, COALESCE($9, 'USD'), $10, $11, $12,
          $13, $14, $15,
          'unchecked', NULL,
          $16, $17, CASE WHEN $17 IS NULL THEN NULL ELSE NOW() END,
          $18, $19, NOW(), NOW()
        )
        RETURNING *
      `,
      [
        sourceType,
        resolvedRequesterEmail,
        resolvedRequesterId,
        resolvedVisitDate,
        resolvedCity,
        payload.trip_type || null,
        finalStatus,
        amount,
        payload.currency || "USD",
        distanceKm,
        outsideLaborArea,
        payload.outside_labor_area_reason || null,
        fuelAmount,
        liquidationAmount,
        financeActor ? payload.approved_amount ?? null : null,
        financeActor ? actorUser.id : null,
        financeActor ? actorUser.id : null,
        paymentDate,
        payload.notes || null,
      ]
    );
    return rows[0];
  }

  const { rows } = await db.query(
    `
      INSERT INTO travel_allowances (
        source_type, source_id, requester_email, requester_user_id, visit_date, city, trip_type,
        status, amount, currency, distance_km, outside_labor_area, outside_labor_area_reason,
        fuel_amount, liquidation_amount, approved_amount,
        attendance_check_status, attendance_check_payload,
        finance_user_id, reviewed_by_user_id, reviewed_at,
        payment_date, notes, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, COALESCE($10, 'USD'), $11, $12, $13,
        $14, $15, $16,
        'unchecked', NULL,
        $17, $18, CASE WHEN $18 IS NULL THEN NULL ELSE NOW() END,
        $19, $20, NOW(), NOW()
      )
      ON CONFLICT (source_type, source_id)
      WHERE source_id IS NOT NULL
        AND source_type IN ('client_visit', 'prospect_visit')
      DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        distance_km = EXCLUDED.distance_km,
        outside_labor_area = EXCLUDED.outside_labor_area,
        outside_labor_area_reason = EXCLUDED.outside_labor_area_reason,
        fuel_amount = EXCLUDED.fuel_amount,
        liquidation_amount = EXCLUDED.liquidation_amount,
        approved_amount = COALESCE(EXCLUDED.approved_amount, travel_allowances.approved_amount),
        trip_type = COALESCE(EXCLUDED.trip_type, travel_allowances.trip_type),
        finance_user_id = COALESCE(EXCLUDED.finance_user_id, travel_allowances.finance_user_id),
        reviewed_by_user_id = COALESCE(EXCLUDED.reviewed_by_user_id, travel_allowances.reviewed_by_user_id),
        reviewed_at = CASE
          WHEN EXCLUDED.reviewed_by_user_id IS NULL THEN travel_allowances.reviewed_at
          ELSE NOW()
        END,
        payment_date = EXCLUDED.payment_date,
        notes = EXCLUDED.notes,
        attendance_check_status = 'unchecked',
        attendance_check_payload = NULL,
        updated_at = NOW()
      RETURNING *
    `,
    [
      sourceType,
      sourceId,
      resolvedRequesterEmail,
      resolvedRequesterId,
      resolvedVisitDate,
      resolvedCity,
      payload.trip_type || null,
      finalStatus,
      amount,
      payload.currency || "USD",
      distanceKm,
      outsideLaborArea,
      payload.outside_labor_area_reason || null,
      fuelAmount,
      liquidationAmount,
      financeActor ? payload.approved_amount ?? null : null,
      financeActor ? actorUser.id : null,
      financeActor ? actorUser.id : null,
      paymentDate,
      payload.notes || null,
    ]
  );

  return rows[0];
}

async function updateAllowanceStatus({ allowanceId, status, amount, approvedAmount, paymentDate, notes, actorUser }) {
  await ensureSchema();
  assertFinance(actorUser);

  const normalizedStatus = toLower(status);
  if (!ALLOWED_STATUSES.has(normalizedStatus)) {
    const error = new Error("status invalido");
    error.status = 400;
    throw error;
  }

  const numericAmount = amount === undefined ? null : Number(amount);
  const numericApprovedAmount = approvedAmount === undefined ? null : Number(approvedAmount);

  if (numericAmount !== null && (!Number.isFinite(numericAmount) || numericAmount < 0)) {
    const error = new Error("amount invalido");
    error.status = 400;
    throw error;
  }

  if (numericApprovedAmount !== null && (!Number.isFinite(numericApprovedAmount) || numericApprovedAmount < 0)) {
    const error = new Error("approved_amount invalido");
    error.status = 400;
    throw error;
  }

  const values = [allowanceId, normalizedStatus, actorUser.id];
  const sets = [
    "status = $2",
    "finance_user_id = $3",
    "reviewed_by_user_id = $3",
    "reviewed_at = NOW()",
    "updated_at = NOW()",
  ];

  if (numericAmount !== null) {
    values.push(numericAmount);
    sets.push(`amount = $${values.length}`);
  }

  if (numericApprovedAmount !== null) {
    values.push(numericApprovedAmount);
    sets.push(`approved_amount = $${values.length}`);
  }

  if (normalizedStatus === "paid") {
    values.push(paymentDate || new Date().toISOString().slice(0, 10));
    sets.push(`payment_date = $${values.length}`);
  }

  if (notes !== undefined) {
    values.push(notes || null);
    sets.push(`notes = $${values.length}`);
  }

  const { rows } = await db.query(
    `
      UPDATE travel_allowances
      SET ${sets.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    values
  );

  if (!rows.length) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  return rows[0];
}

async function listAllowanceDocuments({ allowanceId, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  assertAllowanceAccess(allowance, actorUser);

  const { rows } = await db.query(
    `
      SELECT
        d.*,
        u.fullname AS uploaded_by_name,
        u.email AS uploaded_by_email
      FROM travel_allowance_documents d
      LEFT JOIN users u ON u.id = d.uploaded_by_user_id
      WHERE d.allowance_id = $1
      ORDER BY d.uploaded_at DESC, d.id DESC
    `,
    [allowanceId]
  );

  return rows;
}

function parseBase64Input(rawBase64) {
  const value = String(rawBase64 || "");
  const dataUriMatch = value.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUriMatch) {
    return {
      mimeType: dataUriMatch[1],
      base64: dataUriMatch[2],
    };
  }

  return {
    mimeType: null,
    base64: value,
  };
}

async function createAllowanceDocument({ allowanceId, actorUser, payload }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  assertAllowanceAccess(allowance, actorUser);

  const docType = toLower(payload.doc_type);
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    const error = new Error("doc_type invalido");
    error.status = 400;
    throw error;
  }

  const fileName = String(payload.file_name || "").trim() || `viatico-${docType}-${Date.now()}.pdf`;
  const amount = payload.amount === undefined || payload.amount === null || payload.amount === ""
    ? null
    : Number(payload.amount);

  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    const error = new Error("amount invalido en documento");
    error.status = 400;
    throw error;
  }

  let driveFileId = payload.drive_file_id || null;
  let driveLink = payload.drive_link || null;
  let mimeType = payload.mime_type || null;
  let contentHashSha256 = typeof payload.content_hash_sha256 === "string"
    ? payload.content_hash_sha256.trim().toLowerCase()
    : null;
  let hashAlgorithm = contentHashSha256
    ? String(payload.hash_algorithm || HASH_ALGORITHM).trim() || HASH_ALGORITHM
    : null;

  if (!driveFileId && !driveLink) {
    if (!payload.file_base64) {
      const error = new Error("Debe enviarse file_base64 o drive_file_id");
      error.status = 400;
      throw error;
    }

    const parsed = parseBase64Input(payload.file_base64);
    contentHashSha256 = computeSha256HexFromBase64(parsed.base64) || contentHashSha256;
    hashAlgorithm = contentHashSha256 ? HASH_ALGORITHM : hashAlgorithm;
    const targetMime = mimeType || parsed.mimeType || "application/pdf";
    const estimatedBytes = Math.ceil((parsed.base64.length * 3) / 4);
    const maxBytes = 15 * 1024 * 1024;
    if (estimatedBytes > maxBytes) {
      const error = new Error("El archivo excede 15MB");
      error.status = 400;
      throw error;
    }
    const targetFolderId =
      process.env.VIATICOS_DRIVE_FOLDER_ID ||
      process.env.DRIVE_TRAVEL_ALLOWANCES_FOLDER_ID ||
      null;

    const uploaded = await uploadBase64File(fileName, parsed.base64, targetMime, targetFolderId);
    driveFileId = uploaded?.id || null;
    driveLink = uploaded?.webViewLink || uploaded?.webContentLink || (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null);
    mimeType = targetMime;
  }

  const { rows } = await db.query(
    `
      INSERT INTO travel_allowance_documents (
        allowance_id, doc_type, file_name, mime_type, drive_file_id, drive_link,
        content_hash_sha256, hash_algorithm,
        amount, expense_date, invoice_number, notes, uploaded_by_user_id, uploaded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
    `,
    [
      allowanceId,
      docType,
      fileName,
      mimeType,
      driveFileId,
      driveLink,
      contentHashSha256,
      hashAlgorithm,
      amount,
      payload.expense_date || null,
      payload.invoice_number || null,
      payload.notes || null,
      actorUser.id || null,
    ]
  );

  return rows[0];
}

async function getVisitGeoPoints(allowance) {
  if (!allowance?.source_type || !allowance?.source_id) return [];

  if (allowance.source_type === "client_visit") {
    const { rows } = await db.query(
      `
        SELECT lat_entrada, lng_entrada, lat_salida, lng_salida
        FROM client_visit_logs
        WHERE id = $1
        LIMIT 1
      `,
      [allowance.source_id]
    );

    const row = rows[0];
    if (!row) return [];
    return [
      row.lat_entrada !== null && row.lng_entrada !== null ? { lat: Number(row.lat_entrada), lng: Number(row.lng_entrada), source: "visit_start" } : null,
      row.lat_salida !== null && row.lng_salida !== null ? { lat: Number(row.lat_salida), lng: Number(row.lng_salida), source: "visit_end" } : null,
    ].filter(Boolean);
  }

  if (allowance.source_type === "prospect_visit") {
    const { rows } = await db.query(
      `
        SELECT check_in_lat, check_in_lng, check_out_lat, check_out_lng
        FROM prospect_visits
        WHERE id = $1
        LIMIT 1
      `,
      [allowance.source_id]
    );

    const row = rows[0];
    if (!row) return [];
    return [
      row.check_in_lat !== null && row.check_in_lng !== null ? { lat: Number(row.check_in_lat), lng: Number(row.check_in_lng), source: "visit_start" } : null,
      row.check_out_lat !== null && row.check_out_lng !== null ? { lat: Number(row.check_out_lat), lng: Number(row.check_out_lng), source: "visit_end" } : null,
    ].filter(Boolean);
  }

  return [];
}

async function buildAllowanceReport({ allowanceId, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  assertAllowanceAccess(allowance, actorUser);

  const docs = await listAllowanceDocuments({ allowanceId, actorUser });
  const invoiceDocs = docs.filter((doc) => doc.doc_type === "invoice");
  const liquidationDocs = docs.filter((doc) => doc.doc_type === "liquidation");

  const invoiceTotal = invoiceDocs.reduce((sum, doc) => sum + Number(doc.amount || 0), 0);
  const declaredLiquidation = Number(allowance.liquidation_amount || 0);
  const fuelAmount = Number(allowance.fuel_amount || 0);
  const distanceKm = Number(allowance.distance_km || 0);

  const attendanceQuery = await db.query(
    `
      SELECT
        id,
        date,
        entry_time,
        lunch_start_time,
        lunch_end_time,
        exit_time,
        entry_location,
        lunch_start_location,
        lunch_end_location,
        exit_location
      FROM user_attendance_records
      WHERE user_id = $1
        AND date = $2
      LIMIT 1
    `,
    [allowance.requester_user_id || -1, allowance.visit_date]
  );

  const attendance = attendanceQuery.rows[0] || null;
  const attendancePoints = attendance
    ? [
        parseLocationPoint(attendance.entry_location) ? { ...parseLocationPoint(attendance.entry_location), source: "entry" } : null,
        parseLocationPoint(attendance.lunch_start_location) ? { ...parseLocationPoint(attendance.lunch_start_location), source: "lunch_start" } : null,
        parseLocationPoint(attendance.lunch_end_location) ? { ...parseLocationPoint(attendance.lunch_end_location), source: "lunch_end" } : null,
        parseLocationPoint(attendance.exit_location) ? { ...parseLocationPoint(attendance.exit_location), source: "exit" } : null,
      ].filter(Boolean)
    : [];

  const visitPoints = await getVisitGeoPoints(allowance);

  let minDistanceKm = null;
  if (attendancePoints.length && visitPoints.length) {
    attendancePoints.forEach((attendancePoint) => {
      visitPoints.forEach((visitPoint) => {
        const distance = haversineKm(attendancePoint, visitPoint);
        if (distance !== null && (minDistanceKm === null || distance < minDistanceKm)) {
          minDistanceKm = distance;
        }
      });
    });
  }

  let attendanceStatus = "unchecked";
  if (!attendance) {
    attendanceStatus = "no_attendance";
  } else if (!attendancePoints.length || !visitPoints.length) {
    attendanceStatus = "insufficient_geo";
  } else if (minDistanceKm <= 5) {
    attendanceStatus = "matched";
  } else if (minDistanceKm <= 20) {
    attendanceStatus = "review";
  } else {
    attendanceStatus = "mismatch";
  }

  const outsideLaborArea = Boolean(allowance.outside_labor_area);
  const fuelEligible = distanceKm > 1000;
  const technicalRecommendation = outsideLaborArea
    ? declaredLiquidation + (fuelEligible ? fuelAmount : 0)
    : 0;
  const suggestedAmount = Math.max(technicalRecommendation, invoiceTotal);

  const report = {
    allowance_id: allowance.id,
    requester_email: allowance.requester_email,
    visit_date: allowance.visit_date,
    city: allowance.city,
    source_type: allowance.source_type,
    source_id: allowance.source_id,
    attendance: {
      exists: Boolean(attendance),
      status: attendanceStatus,
      min_distance_km: minDistanceKm,
      points_found: attendancePoints.length,
      record: attendance,
    },
    rules: {
      outside_labor_area: outsideLaborArea,
      outside_labor_area_reason: allowance.outside_labor_area_reason || null,
      fuel_eligible_by_km: fuelEligible,
      distance_km: distanceKm,
      threshold_km: 1000,
    },
    documents: {
      total_docs: docs.length,
      invoice_docs: invoiceDocs.length,
      liquidation_docs: liquidationDocs.length,
      invoice_total: invoiceTotal,
      liquidation_amount: declaredLiquidation,
      fuel_amount: fuelAmount,
      missing_liquidation_document: liquidationDocs.length === 0,
      missing_invoice_document: invoiceDocs.length === 0,
    },
    recommendation: {
      suggested_amount: suggestedAmount,
      formula_base: technicalRecommendation,
      approved_amount: allowance.approved_amount,
      current_amount: allowance.amount,
    },
  };

  await db.query(
    `
      UPDATE travel_allowances
      SET attendance_check_status = $2,
          attendance_check_payload = $3,
          updated_at = NOW()
      WHERE id = $1
    `,
    [allowance.id, attendanceStatus, JSON.stringify(report)]
  );

  return report;
}

module.exports = {
  FINANCE_ROLES,
  isFinanceUser,
  canAccessViaticos,
  listVisitCandidates,
  listAllowances,
  upsertAllowance,
  updateAllowanceStatus,
  listAllowanceDocuments,
  createAllowanceDocument,
  buildAllowanceReport,
};
