const db = require("../../config/db");
const notificationManager = require("../notifications/notificationManager");
const { getHolidaysForYear } = require("../security/security.holidays.ec");

const ALLOWED_STATUSES = new Set([
  "available",
  "assigned",
  "unassigned",
  "damaged",
  "in_maintenance",
  "retired",
]);

const TI_ROLES = ["ti", "jefe_ti", "admin_ti", "gerencia"];
const MS_PER_DAY = 86400000;

async function ensureTiAssetsSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_assets (
      id BIGSERIAL PRIMARY KEY,
      asset_code TEXT UNIQUE,
      name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      characteristics JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'unassigned',
      assigned_to_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      assigned_at TIMESTAMPTZ,
      last_maintenance_at DATE,
      maintenance_frequency_months INTEGER NOT NULL DEFAULT 12,
      active BOOLEAN NOT NULL DEFAULT true,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_assignments (
      id BIGSERIAL PRIMARY KEY,
      asset_id BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
      assigned_to_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      previous_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      reason TEXT,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_events (
      id BIGSERIAL PRIMARY KEY,
      asset_id BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_maintenance_schedule (
      id BIGSERIAL PRIMARY KEY,
      asset_id BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      planned_date DATE NOT NULL,
      max_due_date DATE,
      coordinated_withdrawal_date DATE,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TIMESTAMPTZ,
      notes TEXT,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(asset_id, planned_date)
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_assets_status ON public.ti_assets(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_assets_assigned_user ON public.ti_assets(assigned_to_user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_asset_events_asset_date ON public.ti_asset_events(asset_id, created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_asset_schedule_year ON public.ti_asset_maintenance_schedule(year, status)`);
  await db.query(`ALTER TABLE public.ti_asset_maintenance_schedule ADD COLUMN IF NOT EXISTS max_due_date DATE`);
  await db.query(`ALTER TABLE public.ti_asset_maintenance_schedule ADD COLUMN IF NOT EXISTS coordinated_withdrawal_date DATE`);
  await db.query(`ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS serial_number TEXT`);
  await db.query(`ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS imei TEXT`);
  await db.query(`ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS purchase_date DATE`);
}

function parseISODateUTC(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(Date.UTC(y, m - 1, d));
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function toISODateUTC(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysUTC(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function addMonthsClampedUTC(date, monthsToAdd) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(y, m + monthsToAdd, 1));
  const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, lastDay);
  return new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth(), clampedDay));
}

function isWeekendUTC(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function isHolidayECUTC(date) {
  const year = date.getUTCFullYear();
  const iso = toISODateUTC(date);
  const holidays = getHolidaysForYear(year);
  return Array.isArray(holidays) && holidays.includes(iso);
}

function nextBusinessDayUTC(date) {
  let cursor = new Date(date.getTime());
  while (isWeekendUTC(cursor) || isHolidayECUTC(cursor)) {
    cursor = addDaysUTC(cursor, 1);
  }
  return cursor;
}

function addBusinessDaysUTC(date, days) {
  let cursor = new Date(date.getTime());
  let remaining = Math.max(0, Number(days) || 0);
  while (remaining > 0) {
    cursor = addDaysUTC(cursor, 1);
    if (isWeekendUTC(cursor) || isHolidayECUTC(cursor)) continue;
    remaining -= 1;
  }
  return cursor;
}

async function getTIUserIds() {
  const { rows } = await db.query(
    `SELECT id FROM public.users WHERE LOWER(COALESCE(role, '')) = ANY($1::text[]) AND COALESCE(active, true) = true`,
    [TI_ROLES],
  );
  return rows.map((r) => Number(r.id)).filter(Number.isFinite);
}

async function notifyMaintenanceWindow({ assetName, plannedDate, maxDueDate }) {
  const tiUsers = await getTIUserIds();
  if (!tiUsers.length) return;
  await Promise.all(
    tiUsers.map((userId) =>
      notificationManager.sendNotification({
        userId,
        template: "maintenance_due",
        customTitle: "Mantenimiento TI programado",
        customMessage: `${assetName || "Activo TI"} tiene mantenimiento el ${plannedDate}. Fecha maxima de cumplimiento: ${maxDueDate}.`,
        type: "alert",
        priority: 1,
        source: "ti_assets.maintenance_schedule",
        data: { equipment_name: assetName || "Activo TI", planned_date: plannedDate, max_due_date: maxDueDate },
        email: true,
        chat: false,
      }),
    ),
  );
}

// Depreciation: straight-line over 3 years (1095 days).
// Returns percentage deprecated (0-100) and residual percentage (0-100), computed day by day.
function computeDepreciation(purchaseDate) {
  if (!purchaseDate) return { depreciation_pct: null, residual_pct: null, depreciation_days: null, fully_depreciated: null };
  const msPerDay = 86400000;
  const usefulLifeDays = 3 * 365; // 1095
  const days = Math.max(0, Math.floor((Date.now() - new Date(purchaseDate).getTime()) / msPerDay));
  const depPct = Math.min(100, parseFloat(((days / usefulLifeDays) * 100).toFixed(2)));
  const resPct = Math.max(0, parseFloat((100 - depPct).toFixed(2)));
  return {
    depreciation_pct: depPct,
    residual_pct: resPct,
    depreciation_days: days,
    fully_depreciated: days >= usefulLifeDays,
  };
}

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(value)) {
    const err = new Error("Estado TI no permitido");
    err.status = 400;
    throw err;
  }
  return value;
}

async function listAssets({ status, q }) {
  await ensureTiAssetsSchema();
  const params = [];
  let where = "WHERE a.active = true";
  if (status) {
    params.push(normalizeStatus(status));
    where += ` AND a.status = $${params.length}`;
  }
  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);
    where += ` AND (LOWER(a.name) LIKE $${params.length} OR LOWER(COALESCE(a.brand,'')) LIKE $${params.length} OR LOWER(COALESCE(a.model,'')) LIKE $${params.length} OR LOWER(COALESCE(a.serial_number,'')) LIKE $${params.length})`;
  }
  const { rows } = await db.query(
    `SELECT a.*,
            u.email AS assigned_to_email,
            COALESCE(u.fullname, u.name, u.email) AS assigned_to_name
       FROM public.ti_assets a
       LEFT JOIN public.users u ON u.id = a.assigned_to_user_id
       ${where}
       ORDER BY a.updated_at DESC`,
    params,
  );
  return rows.map((row) => ({ ...row, ...computeDepreciation(row.purchase_date) }));
}

async function createAsset({ data, userId }) {
  await ensureTiAssetsSchema();
  const {
    name,
    brand = null,
    model = null,
    characteristics = {},
    maintenance_frequency_months = 12,
    serial_number = null,
    imei = null,
    purchase_date = null,
  } = data || {};
  if (!name || !String(name).trim()) {
    const err = new Error("name es obligatorio");
    err.status = 400;
    throw err;
  }
  const safePurchaseDate = purchase_date ? String(purchase_date).trim() : null;
  const { rows } = await db.query(
    `INSERT INTO public.ti_assets
       (asset_code, name, brand, model, characteristics, status, maintenance_frequency_months,
        serial_number, imei, purchase_date, created_by, updated_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,'unassigned',$6,$7,$8,$9::date,$10,$10,now(),now())
     RETURNING *`,
    [
      `TI-${Date.now()}`,
      String(name).trim(),
      brand || null,
      model || null,
      JSON.stringify(characteristics || {}),
      Number.isFinite(Number(maintenance_frequency_months)) ? Number(maintenance_frequency_months) : 12,
      serial_number || null,
      imei || null,
      safePurchaseDate,
      userId,
    ],
  );
  const asset = rows[0];
  await db.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     VALUES ($1,'asset_created',$2::jsonb,$3,now())`,
    [asset.id, JSON.stringify({ name, brand, model, serial_number, imei, purchase_date: safePurchaseDate }), userId],
  );
  return { ...asset, ...computeDepreciation(asset.purchase_date) };
}

async function updateAsset({ assetId, data, userId }) {
  await ensureTiAssetsSchema();
  const safePurchaseDate = data?.purchase_date ? String(data.purchase_date).trim() : undefined;
  const { rows } = await db.query(
    `UPDATE public.ti_assets
        SET name = COALESCE($1, name),
            brand = COALESCE($2, brand),
            model = COALESCE($3, model),
            characteristics = COALESCE($4::jsonb, characteristics),
            maintenance_frequency_months = COALESCE($5, maintenance_frequency_months),
            serial_number = COALESCE($6, serial_number),
            imei = COALESCE($7, imei),
            purchase_date = COALESCE($8::date, purchase_date),
            updated_by = $9,
            updated_at = now()
      WHERE id = $10
      RETURNING *`,
    [
      data?.name ?? null,
      data?.brand ?? null,
      data?.model ?? null,
      data?.characteristics ? JSON.stringify(data.characteristics) : null,
      Number.isFinite(Number(data?.maintenance_frequency_months)) ? Number(data.maintenance_frequency_months) : null,
      data?.serial_number ?? null,
      data?.imei ?? null,
      safePurchaseDate ?? null,
      userId,
      assetId,
    ],
  );
  if (!rows.length) {
    const err = new Error("Activo TI no encontrado");
    err.status = 404;
    throw err;
  }
  await db.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     VALUES ($1,'asset_updated',$2::jsonb,$3,now())`,
    [assetId, JSON.stringify(data || {}), userId],
  );
  return { ...rows[0], ...computeDepreciation(rows[0].purchase_date) };
}

async function assignAsset({ assetId, assignedToUserId = null, reason = null, userId }) {
  await ensureTiAssetsSchema();
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const currentQ = await client.query(`SELECT id, assigned_to_user_id FROM public.ti_assets WHERE id = $1 LIMIT 1`, [assetId]);
    if (!currentQ.rows.length) {
      const err = new Error("Activo TI no encontrado");
      err.status = 404;
      throw err;
    }
    const current = currentQ.rows[0];
    const nextStatus = assignedToUserId ? "assigned" : "unassigned";
    const upd = await client.query(
      `UPDATE public.ti_assets
          SET assigned_to_user_id = $1::integer,
              assigned_at = CASE WHEN $1::integer IS NULL THEN NULL ELSE now() END,
              status = $2,
              updated_by = $3,
              updated_at = now()
        WHERE id = $4
        RETURNING *`,
      [assignedToUserId, nextStatus, userId, assetId],
    );
    await client.query(
      `INSERT INTO public.ti_asset_assignments (asset_id, assigned_to_user_id, previous_user_id, action, reason, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())`,
      [assetId, assignedToUserId, current.assigned_to_user_id, assignedToUserId ? "assign_or_reassign" : "unassign", reason, userId],
    );
    await client.query(
      `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
       VALUES ($1,$2,$3::jsonb,$4,now())`,
      [assetId, assignedToUserId ? "asset_assigned" : "asset_unassigned", JSON.stringify({ previous_user_id: current.assigned_to_user_id, assigned_to_user_id: assignedToUserId, reason }), userId],
    );
    await client.query("COMMIT");
    return { ...upd.rows[0], ...computeDepreciation(upd.rows[0].purchase_date) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateAssetStatus({ assetId, status, reason = null, userId }) {
  await ensureTiAssetsSchema();
  const normalized = normalizeStatus(status);
  const { rows } = await db.query(
    `UPDATE public.ti_assets
        SET status = $1,
            updated_by = $2,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [normalized, userId, assetId],
  );
  if (!rows.length) {
    const err = new Error("Activo TI no encontrado");
    err.status = 404;
    throw err;
  }
  await db.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     VALUES ($1,'status_updated',$2::jsonb,$3,now())`,
    [assetId, JSON.stringify({ status: normalized, reason }), userId],
  );
  return { ...rows[0], ...computeDepreciation(rows[0].purchase_date) };
}

async function listAssetHistory(assetId) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `SELECT e.id, e.event_type, e.payload, e.created_at, e.created_by, COALESCE(u.fullname, u.name, u.email) AS created_by_name
       FROM public.ti_asset_events e
       LEFT JOIN public.users u ON u.id = e.created_by
      WHERE e.asset_id = $1
      ORDER BY e.created_at DESC, e.id DESC`,
    [assetId],
  );
  return rows;
}

async function listAssetAssignmentsHistory(assetId) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `SELECT a.id,
            a.asset_id,
            a.assigned_to_user_id,
            a.previous_user_id,
            a.action,
            a.reason,
            a.created_by,
            a.created_at,
            COALESCE(u_to.fullname, u_to.name, u_to.email) AS assigned_to_name,
            COALESCE(u_prev.fullname, u_prev.name, u_prev.email) AS previous_user_name,
            COALESCE(u_actor.fullname, u_actor.name, u_actor.email) AS created_by_name
       FROM public.ti_asset_assignments a
       LEFT JOIN public.users u_to ON u_to.id = a.assigned_to_user_id
       LEFT JOIN public.users u_prev ON u_prev.id = a.previous_user_id
       LEFT JOIN public.users u_actor ON u_actor.id = a.created_by
      WHERE a.asset_id = $1
      ORDER BY a.created_at DESC, a.id DESC`,
    [assetId],
  );
  return rows;
}

async function generateAnnualMaintenance({ year, userId, dryRun = false }) {
  await ensureTiAssetsSchema();
  const startYear = Number.parseInt(String(year || new Date().getFullYear()), 10);
  if (!Number.isFinite(startYear) || startYear < 2020 || startYear > 2100) {
    const err = new Error("year invalido");
    err.status = 400;
    throw err;
  }
  const endYear = startYear + 4;
  const assetsQ = await db.query(
    `SELECT id, name, maintenance_frequency_months, purchase_date
       FROM public.ti_assets
      WHERE active = true
        AND status NOT IN ('retired', 'damaged')
      ORDER BY id ASC`,
  );
  const assets = assetsQ.rows || [];
  const created = [];
  const skipped = [];
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    for (const asset of assets) {
      const every = Math.max(1, Number(asset.maintenance_frequency_months || 12));
      const purchase = parseISODateUTC(asset.purchase_date);
      if (!purchase) {
        skipped.push({ asset_id: asset.id, reason: "missing_purchase_date" });
        continue;
      }
      // El primer mantenimiento se agenda luego de cumplir la frecuencia desde compra.
      let cursor = addMonthsClampedUTC(purchase, every);
      while (cursor.getUTCFullYear() < startYear) {
        cursor = addMonthsClampedUTC(cursor, every);
      }
      while (cursor.getUTCFullYear() <= endYear) {
        const planned = toISODateUTC(cursor);
        const maxDueDate = toISODateUTC(addDaysUTC(cursor, 15));
        const exists = await client.query(
          `SELECT id FROM public.ti_asset_maintenance_schedule WHERE asset_id = $1 AND planned_date = $2::date LIMIT 1`,
          [asset.id, planned],
        );
        if (exists.rows.length) {
          skipped.push({ asset_id: asset.id, planned_date: planned, reason: "already_exists" });
          continue;
        }
        if (dryRun) {
          created.push({ asset_id: asset.id, planned_date: planned, max_due_date: maxDueDate, dry_run: true });
          cursor = addMonthsClampedUTC(cursor, every);
          continue;
        }
        const ins = await client.query(
          `INSERT INTO public.ti_asset_maintenance_schedule (asset_id, year, planned_date, max_due_date, status, created_by, updated_by, created_at, updated_at)
           VALUES ($1,$2,$3::date,$4::date,'pending',$5,$5,now(),now())
           RETURNING *`,
          [asset.id, Number.parseInt(planned.slice(0, 4), 10), planned, maxDueDate, userId],
        );
        created.push(ins.rows[0]);
        cursor = addMonthsClampedUTC(cursor, every);
      }
    }
    if (dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
    if (!dryRun) {
      for (const row of created) {
        try {
          const assetName = assets.find((a) => Number(a.id) === Number(row.asset_id))?.name || `Activo ${row.asset_id}`;
          await notifyMaintenanceWindow({
            assetName,
            plannedDate: String(row.planned_date).slice(0, 10),
            maxDueDate: String(row.max_due_date || "").slice(0, 10),
          });
        } catch (_err) {
          // notificacion no bloquea la generacion
        }
      }
    }
    return {
      start_year: startYear,
      end_year: endYear,
      assets: assets.length,
      created_count: created.length,
      skipped_count: skipped.length,
      created,
      skipped,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Parse a date value returned by pg robustly.
 * pg returns DATE columns as "YYYY-MM-DD" strings (standard) but may also
 * return JavaScript Date objects depending on driver config or Neon proxy.
 */
function parseAnyDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  // Try ISO date string "YYYY-MM-DD" first (standard pg DATE output)
  const fromISO = parseISODateUTC(value);
  if (fromISO) return fromISO;
  // Fallback: let JS parse it (handles timestamps like "2024-05-15T00:00:00.000Z")
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Generate or refresh maintenance schedules for all active assets
 * across all future years. Idempotent — skips records that already exist.
 * Generates from the current year up to HORIZON_YEARS ahead.
 * Assets with status 'retired' or 'damaged' are excluded.
 */
async function generateFutureMaintenance({ userId } = {}) {
  await ensureTiAssetsSchema();
  const HORIZON_YEARS = 15;
  const currentYear = new Date().getUTCFullYear();

  const assetsQ = await db.query(
    `SELECT id, name, maintenance_frequency_months, purchase_date, created_at
       FROM public.ti_assets
      WHERE active = true
        AND status NOT IN ('retired', 'damaged')
      ORDER BY id ASC`,
  );
  const assets = assetsQ.rows || [];

  let totalCreated = 0;
  let totalSkipped = 0;
  let noDateCount = 0;

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    for (const asset of assets) {
      const every = Math.max(1, Number(asset.maintenance_frequency_months || 12));

      // Regla: el cronograma se calcula desde purchase_date + frecuencia.
      const purchaseDate = parseAnyDate(asset.purchase_date);
      if (!purchaseDate) {
        noDateCount++;
        continue;
      }

      // Primer mantenimiento cuando cumple la frecuencia desde la compra.
      let cursor = addMonthsClampedUTC(purchaseDate, every);
      while (cursor.getUTCFullYear() < currentYear) {
        cursor = addMonthsClampedUTC(cursor, every);
      }

      // Generate from current year up to the horizon
      while (cursor.getUTCFullYear() <= currentYear + HORIZON_YEARS) {
        const planned = toISODateUTC(cursor);
        const maxDueDate = toISODateUTC(addDaysUTC(cursor, 15));
        const yr = cursor.getUTCFullYear();

        const exists = await client.query(
          `SELECT id FROM public.ti_asset_maintenance_schedule
            WHERE asset_id = $1 AND planned_date = $2::date LIMIT 1`,
          [asset.id, planned],
        );

        if (!exists.rows.length) {
          await client.query(
            `INSERT INTO public.ti_asset_maintenance_schedule
               (asset_id, year, planned_date, max_due_date, status, created_by, updated_by, created_at, updated_at)
             VALUES ($1,$2,$3::date,$4::date,'pending',$5,$5,now(),now())`,
            [asset.id, yr, planned, maxDueDate, userId || null],
          );
          totalCreated++;
        } else {
          totalSkipped++;
        }

        cursor = addMonthsClampedUTC(cursor, every);
      }
    }

    await client.query("COMMIT");
    return {
      assets: assets.length,
      created_count: totalCreated,
      skipped_existing: totalSkipped,
      skipped_no_date: noDateCount,
      horizon_years: HORIZON_YEARS,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listMaintenance({ year }) {
  await ensureTiAssetsSchema();
  const params = [];
  let where = "";
  if (year) {
    params.push(Number(year));
    where = `WHERE m.year = $1`;
  }
  const { rows } = await db.query(
    `SELECT m.*, a.name AS asset_name, a.brand, a.model, a.assigned_to_user_id,
            COALESCE(u.fullname, u.name, u.email) AS assigned_to_name,
            CASE
              WHEN m.status = 'completed' THEN 'completed'
              WHEN COALESCE(m.max_due_date, m.planned_date + INTERVAL '15 days') < CURRENT_DATE THEN 'overdue'
              ELSE 'pending'
            END AS computed_status
       FROM public.ti_asset_maintenance_schedule m
       JOIN public.ti_assets a ON a.id = m.asset_id
       LEFT JOIN public.users u ON u.id = a.assigned_to_user_id
       ${where}
      ORDER BY m.planned_date ASC`,
    params,
  );
  return rows.map((r) => ({
    ...r,
    status: r.computed_status || r.status,
    max_due_date: r.max_due_date || null,
    coordinated_withdrawal_date: r.coordinated_withdrawal_date || null,
    assigned_to_name: r.assigned_to_name || null,
  }));
}

async function clearAllMaintenanceSchedules({ userId }) {
  await ensureTiAssetsSchema();
  const { rowCount } = await db.query(`DELETE FROM public.ti_asset_maintenance_schedule`);
  await db.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     SELECT id, 'maintenance_schedule_cleared', $1::jsonb, $2, now()
     FROM public.ti_assets
     WHERE active = true`,
    [JSON.stringify({ deleted_rows: rowCount }), userId || null],
  );
  return { deleted_count: rowCount || 0 };
}

async function setMaintenanceCoordinationDate({ maintenanceId, coordinatedWithdrawalDate, userId }) {
  await ensureTiAssetsSchema();
  const id = Number(maintenanceId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("maintenanceId invalido");
    err.status = 400;
    throw err;
  }
  const date = String(coordinatedWithdrawalDate || "").trim();
  if (!date) {
    const err = new Error("coordinated_withdrawal_date es obligatorio");
    err.status = 400;
    throw err;
  }
  const parsed = parseISODateUTC(date);
  if (!parsed) {
    const err = new Error("coordinated_withdrawal_date invalido");
    err.status = 400;
    throw err;
  }
  const safeDate = toISODateUTC(parsed);

  const { rows } = await db.query(
    `UPDATE public.ti_asset_maintenance_schedule
        SET coordinated_withdrawal_date = $1::date,
            updated_by = $2,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [safeDate, userId || null, id],
  );
  if (!rows.length) {
    const err = new Error("Mantenimiento TI no encontrado");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function createMaintenance({ assetId, plannedDate, notes = null, userId }) {
  await ensureTiAssetsSchema();
  const id = Number(assetId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("assetId invalido");
    err.status = 400;
    throw err;
  }
  const date = String(plannedDate || "").trim();
  if (!date) {
    const err = new Error("planned_date es obligatorio");
    err.status = 400;
    throw err;
  }

  const planned = parseISODateUTC(date);
  if (!planned) {
    const err = new Error("planned_date invalido");
    err.status = 400;
    throw err;
  }
  const maxDueDate = toISODateUTC(addDaysUTC(planned, 15));

  const { rows: assetRows } = await db.query(
    `SELECT id, name FROM public.ti_assets WHERE id = $1 AND active = true LIMIT 1`,
    [id],
  );
  if (!assetRows.length) {
    const err = new Error("Activo TI no encontrado o inactivo");
    err.status = 404;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO public.ti_asset_maintenance_schedule
      (asset_id, year, planned_date, max_due_date, status, notes, created_by, updated_by, created_at, updated_at)
     VALUES ($1, EXTRACT(YEAR FROM $2::date)::int, $2::date, $3::date, 'pending', $4, $5, $5, now(), now())
     ON CONFLICT (asset_id, planned_date)
     DO UPDATE SET
       max_due_date = EXCLUDED.max_due_date,
       notes = COALESCE(EXCLUDED.notes, public.ti_asset_maintenance_schedule.notes),
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
     RETURNING *`,
    [id, date, maxDueDate, notes, userId || null],
  );
  try {
    await notifyMaintenanceWindow({
      assetName: assetRows[0].name || `Activo ${id}`,
      plannedDate: toISODateUTC(planned),
      maxDueDate,
    });
  } catch (_err) {
    // notificacion no bloquea el alta
  }

  return rows[0];
}

async function completeMaintenance({ maintenanceId, notes = null, userId }) {
  await ensureTiAssetsSchema();
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const upd = await client.query(
      `UPDATE public.ti_asset_maintenance_schedule
          SET status = 'completed',
              completed_at = now(),
              notes = COALESCE($1, notes),
              updated_by = $2,
              updated_at = now()
        WHERE id = $3
        RETURNING *`,
      [notes, userId, maintenanceId],
    );
    if (!upd.rows.length) {
      const err = new Error("Mantenimiento TI no encontrado");
      err.status = 404;
      throw err;
    }
    await client.query(
      `UPDATE public.ti_assets
          SET last_maintenance_at = $1::date,
              updated_by = $2,
              updated_at = now()
        WHERE id = $3`,
      [upd.rows[0].planned_date, userId, upd.rows[0].asset_id],
    );
    await client.query(
      `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
       VALUES ($1,'maintenance_completed',$2::jsonb,$3,now())`,
      [upd.rows[0].asset_id, JSON.stringify({ maintenance_id: maintenanceId, planned_date: upd.rows[0].planned_date, notes }), userId],
    );
    await client.query("COMMIT");
    return upd.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function requestAssignedDeliveryForMaintenance({ maintenanceId, userId }) {
  await ensureTiAssetsSchema();
  const id = Number(maintenanceId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("maintenanceId invalido");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `SELECT m.id, m.planned_date, m.max_due_date, m.status,
            a.id AS asset_id, a.name AS asset_name, a.assigned_to_user_id
       FROM public.ti_asset_maintenance_schedule m
       JOIN public.ti_assets a ON a.id = m.asset_id
      WHERE m.id = $1
      LIMIT 1`,
    [id],
  );
  if (!rows.length) {
    const err = new Error("Mantenimiento TI no encontrado");
    err.status = 404;
    throw err;
  }

  const row = rows[0];
  if (row.status === "completed") {
    const err = new Error("El mantenimiento ya fue completado");
    err.status = 400;
    throw err;
  }
  if (!row.assigned_to_user_id) {
    const err = new Error("El equipo no tiene usuario asignado");
    err.status = 400;
    throw err;
  }

  const planned = parseISODateUTC(row.planned_date);
  if (!planned) {
    const err = new Error("planned_date invalido");
    err.status = 400;
    throw err;
  }

  const deliveryFrom = nextBusinessDayUTC(planned);
  const deliveryTo = addBusinessDaysUTC(deliveryFrom, 14);
  const deliveryFromISO = toISODateUTC(deliveryFrom);
  const deliveryToISO = toISODateUTC(deliveryTo);

  await notificationManager.sendNotification({
    userId: Number(row.assigned_to_user_id),
    template: "maintenance_due",
    customTitle: "Entrega de equipo para mantenimiento",
    customMessage: `Debes entregar el equipo ${row.asset_name || `Activo ${row.asset_id}`} desde el ${deliveryFromISO} hasta el ${deliveryToISO} para mantenimiento TI.`,
    type: "alert",
    priority: 1,
    source: "ti_assets.maintenance_delivery_request",
    data: {
      maintenance_id: row.id,
      asset_id: row.asset_id,
      equipment_name: row.asset_name || `Activo ${row.asset_id}`,
      delivery_from_date: deliveryFromISO,
      delivery_to_date: deliveryToISO,
      planned_date: String(row.planned_date || "").slice(0, 10),
      max_due_date: row.max_due_date ? String(row.max_due_date).slice(0, 10) : null,
      business_days: 15,
      country: "EC",
    },
    email: true,
    chat: false,
  });

  await db.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     VALUES ($1,'maintenance_delivery_requested',$2::jsonb,$3,now())`,
    [
      row.asset_id,
      JSON.stringify({
        maintenance_id: row.id,
        assigned_to_user_id: row.assigned_to_user_id,
        delivery_from_date: deliveryFromISO,
        delivery_to_date: deliveryToISO,
      }),
      userId || null,
    ],
  );

  return {
    maintenance_id: row.id,
    asset_id: row.asset_id,
    assigned_to_user_id: Number(row.assigned_to_user_id),
    delivery_from_date: deliveryFromISO,
    delivery_to_date: deliveryToISO,
    business_days: 15,
  };
}

module.exports = {
  TI_ROLES,
  ensureTiAssetsSchema,
  listAssets,
  createAsset,
  updateAsset,
  assignAsset,
  updateAssetStatus,
  listAssetHistory,
  listAssetAssignmentsHistory,
  generateAnnualMaintenance,
  generateFutureMaintenance,
  listMaintenance,
  clearAllMaintenanceSchedules,
  setMaintenanceCoordinationDate,
  createMaintenance,
  completeMaintenance,
  requestAssignedDeliveryForMaintenance,
};
