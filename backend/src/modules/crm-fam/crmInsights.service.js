// Inteligencia comercial del CRM (Senior Ultra): metas por vendedor, tablero de direccion,
// deteccion de leads duplicados y base instalada de la cuenta. Todo es de lectura salvo la meta.
// "Vendido" usa la misma definicion que los planes de cuenta: ganada, o abierta en Contratos o en
// una fase posterior (crm.constants.js#SOLD_STAGE_NAMES).
const db = require("../../config/db");
const logger = require("../../config/logger");
const calculators = require("./crm.calculators");
const { MANAGER_OR_ADMIN_ROLES, SOLD_STAGES_SQL } = require("./crm.constants");

const MANAGER_ROLES = new Set(MANAGER_OR_ADMIN_ROLES);
const isManager = (user) => MANAGER_ROLES.has(user.role);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const SOLD = `(o.status = 'won' OR (o.status = 'open' AND st.name IN ${SOLD_STAGES_SQL}))`;
const OPEN_PIPE = `(o.status = 'open' AND (st.name IS NULL OR st.name NOT IN ${SOLD_STAGES_SQL}))`;
const SOLD_AMOUNT = `COALESCE(o.won_amount, o.estimated_amount, 0)`;
const CLOSE_DATE = `COALESCE(o.actual_close_date, o.estimated_close_date)`;
const PROBABILITY = `COALESCE(o.probability_override, st.probability_default, 0)`;
const STAGE_ENTERED = `COALESCE((to_jsonb(o)->>'stage_entered_at')::timestamptz, o.updated_at, o.created_at)`;

const num = (value) => Number(value || 0);
const pct = (part, total) => (total > 0 ? Number(((part / total) * 100).toFixed(1)) : null);

// 'YYYY-MM' → primer dia del mes (texto). Sin valor, el mes en curso.
const monthStart = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) throw fail("Mes inválido (formato AAAA-MM)");
  return `${text}-01`;
};
const isoDate = (value, label) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw fail(`${label} inválida (formato AAAA-MM-DD)`);
  return String(value);
};

// ─── Metas por vendedor ──────────────────────────────────────────────────────
// Manager: todos los vendedores con oportunidades o con meta ese mes. El resto: solo la propia.
const listSalesGoals = async ({ month } = {}, user) => {
  const start = monthStart(month);
  const params = [start];
  let scope = "";
  if (!isManager(user)) { params.push(user.id); scope = "WHERE s.id = $2"; }
  const { rows } = await db.query(
    `WITH sellers AS (
       SELECT DISTINCT owner_user_id AS id FROM crm.crm_opportunities WHERE deleted_at IS NULL AND owner_user_id IS NOT NULL
       UNION
       SELECT user_id FROM crm.crm_sales_goals WHERE period_month = $1::date
       ${isManager(user) ? "" : "UNION SELECT $2::int"}
     )
     SELECT u.id AS user_id, u.fullname AS seller_name, g.target_amount,
            COALESCE(x.sold_amount, 0)::numeric AS sold_amount, COALESCE(x.sold_count, 0)::int AS sold_count,
            COALESCE(x.open_amount, 0)::numeric AS open_amount, COALESCE(x.open_count, 0)::int AS open_count,
            COALESCE(x.weighted_amount, 0)::numeric AS weighted_amount,
            COALESCE(x.won_all, 0)::int AS won_all, COALESCE(x.lost_all, 0)::int AS lost_all,
            COALESCE(x.won_amount_all, 0)::numeric AS won_amount_all
       FROM sellers s
       JOIN public.users u ON u.id = s.id
       LEFT JOIN crm.crm_sales_goals g ON g.user_id = u.id AND g.period_month = $1::date
       LEFT JOIN LATERAL (
         SELECT SUM(${SOLD_AMOUNT}) FILTER (WHERE ${SOLD} AND ${CLOSE_DATE} >= $1::date AND ${CLOSE_DATE} < ($1::date + INTERVAL '1 month')) AS sold_amount,
                COUNT(*) FILTER (WHERE ${SOLD} AND ${CLOSE_DATE} >= $1::date AND ${CLOSE_DATE} < ($1::date + INTERVAL '1 month')) AS sold_count,
                SUM(COALESCE(o.estimated_amount, 0)) FILTER (WHERE ${OPEN_PIPE}) AS open_amount,
                COUNT(*) FILTER (WHERE ${OPEN_PIPE}) AS open_count,
                SUM(COALESCE(o.estimated_amount, 0) * ${PROBABILITY} / 100) FILTER (WHERE ${OPEN_PIPE}) AS weighted_amount,
                COUNT(*) FILTER (WHERE ${SOLD}) AS won_all,
                COUNT(*) FILTER (WHERE o.status = 'lost') AS lost_all,
                SUM(${SOLD_AMOUNT}) FILTER (WHERE ${SOLD}) AS won_amount_all
           FROM crm.crm_opportunities o
           LEFT JOIN crm.crm_pipeline_stages st ON st.id = o.stage_id
          WHERE o.owner_user_id = u.id AND o.deleted_at IS NULL
       ) x ON true
       ${scope}
      ORDER BY u.fullname ASC`,
    params,
  );
  const sellers = rows.map((r) => {
    const target = r.target_amount === null ? null : num(r.target_amount);
    const sold = num(r.sold_amount);
    const winRate = pct(r.won_all, r.won_all + r.lost_all);
    const pipeline = calculators.calculateRequiredPipeline({
      targetAmount: target,
      soldAmount: sold,
      winRatePct: winRate,
      avgDealSize: r.won_all > 0 ? num(r.won_amount_all) / r.won_all : null,
    });
    return {
      user_id: r.user_id,
      seller_name: r.seller_name,
      target_amount: target,
      sold_amount: sold,
      sold_count: r.sold_count,
      progress_pct: target > 0 ? Math.min(999, Math.round((sold / target) * 100)) : null,
      open_amount: num(r.open_amount),
      open_count: r.open_count,
      weighted_amount: Number(num(r.weighted_amount).toFixed(2)),
      win_rate_pct: winRate,
      ...pipeline,
    };
  });
  const withGoal = sellers.filter((s) => s.target_amount !== null);
  return {
    month: start.slice(0, 7),
    can_edit: isManager(user),
    sellers,
    totals: {
      target_amount: withGoal.reduce((sum, s) => sum + s.target_amount, 0),
      sold_amount: sellers.reduce((sum, s) => sum + s.sold_amount, 0),
      open_amount: sellers.reduce((sum, s) => sum + s.open_amount, 0),
      weighted_amount: Number(sellers.reduce((sum, s) => sum + s.weighted_amount, 0).toFixed(2)),
      sellers_with_goal: withGoal.length,
    },
  };
};

const upsertSalesGoal = async ({ user_id: userId, month, target_amount: targetAmount } = {}, user) => {
  if (!isManager(user)) throw fail("Solo jefatura puede definir metas", 403);
  const start = monthStart(month);
  const sellerId = Number(userId);
  if (!Number.isInteger(sellerId) || sellerId <= 0) throw fail("Vendedor inválido");
  if (targetAmount === null || targetAmount === "" || targetAmount === undefined) {
    await db.query(`DELETE FROM crm.crm_sales_goals WHERE user_id = $1 AND period_month = $2::date`, [sellerId, start]);
    return { user_id: sellerId, month: start.slice(0, 7), target_amount: null };
  }
  const amount = Number(targetAmount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 9999999999999) throw fail("Meta inválida");
  const { rows: exists } = await db.query(`SELECT 1 FROM public.users WHERE id = $1`, [sellerId]);
  if (!exists.length) throw fail("Vendedor no encontrado", 404);
  await db.query(
    `INSERT INTO crm.crm_sales_goals (user_id, period_month, target_amount, created_by, updated_by)
     VALUES ($1, $2::date, $3, $4, $4)
     ON CONFLICT (user_id, period_month)
     DO UPDATE SET target_amount = EXCLUDED.target_amount, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [sellerId, start, amount, user.id],
  );
  return { user_id: sellerId, month: start.slice(0, 7), target_amount: amount };
};

// ─── Tablero de direccion ────────────────────────────────────────────────────
// Rango por fecha de cierre (real, o estimada si sigue abierta). Sin rango: el año en curso.
const getExecutiveBoard = async ({ from, to } = {}, user) => {
  if (!isManager(user)) throw fail("Acceso denegado", 403);
  const year = new Date().getFullYear();
  const start = isoDate(from, "Fecha inicial") || `${year}-01-01`;
  const end = isoDate(to, "Fecha final") || `${year}-12-31`;
  if (end < start) throw fail("La fecha final no puede ser anterior a la inicial");
  const range = [start, end];
  const IN_RANGE = `${CLOSE_DATE} >= $1::date AND ${CLOSE_DATE} <= $2::date`;

  const [totalsRes, stagesRes, sellersRes, monthsRes, lostRes, goalsRes] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(${SOLD_AMOUNT}) FILTER (WHERE ${SOLD} AND ${IN_RANGE}), 0)::numeric AS sold_amount,
              COUNT(*) FILTER (WHERE ${SOLD} AND ${IN_RANGE})::int AS sold_count,
              COUNT(*) FILTER (WHERE o.status = 'lost' AND ${IN_RANGE})::int AS lost_count,
              COALESCE(SUM(COALESCE(o.estimated_amount, 0)) FILTER (WHERE o.status = 'lost' AND ${IN_RANGE}), 0)::numeric AS lost_amount,
              AVG(o.actual_close_date - o.created_at::date) FILTER (WHERE o.status = 'won' AND o.actual_close_date IS NOT NULL AND ${IN_RANGE})::numeric AS avg_cycle_days,
              COALESCE(SUM(COALESCE(o.estimated_amount, 0)) FILTER (WHERE ${OPEN_PIPE}), 0)::numeric AS open_amount,
              COUNT(*) FILTER (WHERE ${OPEN_PIPE})::int AS open_count,
              COALESCE(SUM(COALESCE(o.estimated_amount, 0)) FILTER (WHERE ${OPEN_PIPE} AND ${IN_RANGE} AND ${PROBABILITY} >= 80), 0)::numeric AS committed_amount,
              COALESCE(SUM(COALESCE(o.estimated_amount, 0) * ${PROBABILITY} / 100) FILTER (WHERE ${OPEN_PIPE} AND ${IN_RANGE}), 0)::numeric AS likely_amount,
              COALESCE(SUM(COALESCE(o.estimated_amount, 0)) FILTER (WHERE ${OPEN_PIPE} AND ${IN_RANGE}), 0)::numeric AS best_amount,
              COUNT(*) FILTER (WHERE ${OPEN_PIPE} AND o.estimated_close_date IS NULL)::int AS open_without_date
         FROM crm.crm_opportunities o
         LEFT JOIN crm.crm_pipeline_stages st ON st.id = o.stage_id
        WHERE o.deleted_at IS NULL`,
      range,
    ),
    db.query(
      `SELECT st.id, st.name, st.order_index,
              COUNT(o.id)::int AS count,
              COALESCE(SUM(COALESCE(o.estimated_amount, 0)), 0)::numeric AS amount,
              COALESCE(AVG(EXTRACT(EPOCH FROM now() - ${STAGE_ENTERED}) / 86400), 0)::numeric AS avg_days,
              COUNT(o.id) FILTER (WHERE now() - ${STAGE_ENTERED} >= INTERVAL '30 days')::int AS stalled_count,
              COALESCE(SUM(COALESCE(o.estimated_amount, 0)) FILTER (WHERE now() - ${STAGE_ENTERED} >= INTERVAL '30 days'), 0)::numeric AS stalled_amount
         FROM crm.crm_pipeline_stages st
         LEFT JOIN crm.crm_opportunities o ON o.stage_id = st.id AND o.status = 'open' AND o.deleted_at IS NULL
        WHERE st.is_active = true
        GROUP BY st.id, st.name, st.order_index
        ORDER BY st.order_index ASC`,
    ),
    db.query(
      `SELECT u.id AS user_id, u.fullname AS seller_name,
              COALESCE(SUM(${SOLD_AMOUNT}) FILTER (WHERE ${SOLD} AND ${IN_RANGE}), 0)::numeric AS sold_amount,
              COUNT(*) FILTER (WHERE ${SOLD} AND ${IN_RANGE})::int AS sold_count,
              COUNT(*) FILTER (WHERE o.status = 'lost' AND ${IN_RANGE})::int AS lost_count,
              COALESCE(SUM(COALESCE(o.estimated_amount, 0)) FILTER (WHERE ${OPEN_PIPE}), 0)::numeric AS open_amount,
              COUNT(*) FILTER (WHERE ${OPEN_PIPE})::int AS open_count,
              COALESCE(SUM(COALESCE(o.estimated_amount, 0) * ${PROBABILITY} / 100) FILTER (WHERE ${OPEN_PIPE}), 0)::numeric AS weighted_amount
         FROM crm.crm_opportunities o
         JOIN public.users u ON u.id = o.owner_user_id
         LEFT JOIN crm.crm_pipeline_stages st ON st.id = o.stage_id
        WHERE o.deleted_at IS NULL
        GROUP BY u.id, u.fullname
        ORDER BY 3 DESC, 6 DESC`,
      range,
    ),
    db.query(
      `SELECT to_char(date_trunc('month', ${CLOSE_DATE}), 'YYYY-MM') AS month,
              COALESCE(SUM(${SOLD_AMOUNT}) FILTER (WHERE ${SOLD}), 0)::numeric AS sold_amount,
              COUNT(*) FILTER (WHERE ${SOLD})::int AS sold_count,
              COUNT(*) FILTER (WHERE o.status = 'lost')::int AS lost_count
         FROM crm.crm_opportunities o
         LEFT JOIN crm.crm_pipeline_stages st ON st.id = o.stage_id
        WHERE o.deleted_at IS NULL AND ${IN_RANGE} AND (${SOLD} OR o.status = 'lost')
        GROUP BY 1
        ORDER BY 1 ASC`,
      range,
    ),
    db.query(
      `SELECT COALESCE(lr.reason_name, NULLIF(trim(o.lost_reason_detail), ''), 'Sin motivo registrado') AS reason, COUNT(*)::int AS count,
              COALESCE(SUM(COALESCE(o.estimated_amount, 0)), 0)::numeric AS amount
         FROM crm.crm_opportunities o
         LEFT JOIN crm.crm_lost_reasons lr ON lr.id = o.lost_reason_id
        WHERE o.deleted_at IS NULL AND o.status = 'lost' AND ${CLOSE_DATE} >= $1::date AND ${CLOSE_DATE} <= $2::date
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 8`,
      range,
    ),
    db.query(
      `SELECT COALESCE(SUM(target_amount), 0)::numeric AS target_amount, COUNT(DISTINCT user_id)::int AS sellers
         FROM crm.crm_sales_goals
        WHERE period_month >= date_trunc('month', $1::date) AND period_month <= $2::date`,
      range,
    ).catch((err) => { logger.warn({ err: err.message }, "Tablero CRM: metas no disponibles"); return { rows: [{ target_amount: 0, sellers: 0 }] }; }),
  ]);

  const t = totalsRes.rows[0];
  const target = num(goalsRes.rows[0].target_amount);
  const sold = num(t.sold_amount);
  return {
    range: { from: start, to: end },
    totals: {
      target_amount: target || null,
      sellers_with_goal: goalsRes.rows[0].sellers,
      sold_amount: sold,
      sold_count: t.sold_count,
      progress_pct: target > 0 ? Math.round((sold / target) * 100) : null,
      lost_count: t.lost_count,
      lost_amount: num(t.lost_amount),
      win_rate_pct: pct(t.sold_count, t.sold_count + t.lost_count),
      avg_cycle_days: t.avg_cycle_days === null ? null : Math.round(num(t.avg_cycle_days)),
      open_amount: num(t.open_amount),
      open_count: t.open_count,
      open_without_date: t.open_without_date,
    },
    // Lo abierto con cierre estimado dentro del rango, de mas a menos seguro. Cada escenario suma lo ya vendido.
    scenarios: {
      committed: Number((sold + num(t.committed_amount)).toFixed(2)),
      likely: Number((sold + num(t.likely_amount)).toFixed(2)),
      best: Number((sold + num(t.best_amount)).toFixed(2)),
    },
    stages: stagesRes.rows.map((r) => ({
      id: r.id, name: r.name, count: r.count, amount: num(r.amount),
      avg_days: r.count ? Math.round(num(r.avg_days)) : null,
      stalled_count: r.stalled_count, stalled_amount: num(r.stalled_amount),
    })),
    sellers: sellersRes.rows.map((r) => ({
      user_id: r.user_id, seller_name: r.seller_name, sold_amount: num(r.sold_amount), sold_count: r.sold_count,
      lost_count: r.lost_count, win_rate_pct: pct(r.sold_count, r.sold_count + r.lost_count),
      open_amount: num(r.open_amount), open_count: r.open_count, weighted_amount: Number(num(r.weighted_amount).toFixed(2)),
    })),
    months: monthsRes.rows.map((r) => ({ month: r.month, sold_amount: num(r.sold_amount), sold_count: r.sold_count, lost_count: r.lost_count })),
    lost_reasons: lostRes.rows.map((r) => ({ reason: r.reason, count: r.count, amount: num(r.amount) })),
  };
};

// ─── Leads duplicados ────────────────────────────────────────────────────────
// Antes de crear un lead: coincidencias por correo, telefono o nombre+empresa en leads, y por
// nombre o RUC en cuentas y en el registro de clientes. Solo informa; no bloquea.
const digits = (value) => String(value || "").replace(/\D/g, "");
const clean = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

const findLeadDuplicates = async (query = {}, user) => {
  const email = clean(query.email);
  const phone = digits(query.phone);
  const person = clean([query.first_name, query.last_name].filter(Boolean).join(" "));
  const company = clean(query.company_name);
  const excludeId = /^[0-9a-f-]{36}$/i.test(String(query.exclude_id || "")) ? query.exclude_id : null;
  if (!email && phone.length < 7 && person.length < 4 && company.length < 4) return { leads: [], accounts: [], clients: [] };

  const NORM = (col) => `lower(regexp_replace(trim(coalesce(${col}, '')), '[[:space:]]+', ' ', 'g'))`;
  const leadsQuery = db.query(
    `SELECT l.id, l.lead_code, l.first_name, l.last_name, l.company_name, l.status, l.created_at, u.fullname AS owner_name,
            CASE WHEN $1 <> '' AND lower(trim(coalesce(l.email, ''))) = $1 THEN 'correo'
                 WHEN $2 <> '' AND right(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), 9) = right($2, 9) THEN 'teléfono'
                 ELSE 'nombre' END AS match
       FROM crm.crm_leads l
       LEFT JOIN public.users u ON u.id = l.owner_user_id
      WHERE l.deleted_at IS NULL
        AND ($5::uuid IS NULL OR l.id <> $5::uuid)
        AND (
          ($1 <> '' AND lower(trim(coalesce(l.email, ''))) = $1)
          OR (length($2) >= 7 AND right(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), 9) = right($2, 9))
          OR (length($4) >= 4 AND ${NORM("l.company_name")} = $4 AND ($3 = '' OR ${NORM("l.first_name || ' ' || coalesce(l.last_name, '')")} = $3))
          OR (length($3) >= 6 AND $4 = '' AND ${NORM("l.first_name || ' ' || coalesce(l.last_name, '')")} = $3)
        )
      ORDER BY l.created_at DESC
      LIMIT 5`,
    [email, phone, person, company, excludeId],
  );
  const accountsQuery = company.length >= 4
    ? db.query(
      `SELECT a.id, a.account_name, a.ruc, a.classification
         FROM crm.crm_accounts a
        WHERE a.deleted_at IS NULL AND (${NORM("a.account_name")} = $1 OR ${NORM("a.legal_name")} = $1)
        LIMIT 3`,
      [company],
    )
    : Promise.resolve({ rows: [] });
  const clientsQuery = company.length >= 4
    ? db.query(
      `SELECT c.id, COALESCE(c.commercial_name, c.legal_person_business_name) AS name, c.ruc_cedula AS ruc
         FROM public.client_requests c
        WHERE c.status = 'approved' AND (${NORM("c.commercial_name")} = $1 OR ${NORM("c.legal_person_business_name")} = $1)
        LIMIT 3`,
      [company],
    ).catch(() => ({ rows: [] }))
    : Promise.resolve({ rows: [] });

  const [leads, accounts, clients] = await Promise.all([leadsQuery, accountsQuery, clientsQuery]);
  // Un vendedor ve que existe el lead, pero no datos de leads ajenos mas alla del nombre y su responsable.
  void user;
  return { leads: leads.rows, accounts: accounts.rows, clients: clients.rows };
};

// ─── Base instalada de la cuenta ─────────────────────────────────────────────
// Equipos y expedientes del cliente de la cuenta (por RUC) y sus expedientes de consumibles.
const equipmentNames = (equipment) => (Array.isArray(equipment) ? equipment : [])
  .map((item) => (item && typeof item === "object" ? item.name || item.equipment_name || item.model : item))
  .filter(Boolean)
  .map(String);

const getAccountInstalledBase = async (account) => {
  if (!account?.ruc) return { has_identifier: false, client_ids: [], equipment: [], consumables: [] };
  const { rows: clients } = await db.query(
    `SELECT id FROM public.client_requests WHERE ruc_cedula = $1`,
    [account.ruc],
  ).catch(() => ({ rows: [] }));
  const clientIds = clients.map((c) => c.id);

  const [privates, publics, files] = await Promise.all([
    db.query(
      `SELECT p.id, p.status::text AS status, p.offer_kind, p.equipment, p.created_at, p.updated_at,
              to_jsonb(p)->>'delivery_act_delivered_at' AS delivered_at,
              to_jsonb(p)->>'contract_document_id' AS contract_document_id
         FROM public.private_purchase_requests p
        WHERE p.client_snapshot->>'client_identifier' = $1
           OR (p.client_snapshot->>'id' ~ '^[0-9]+$' AND (p.client_snapshot->>'id')::int = ANY($2::int[]))
        ORDER BY p.created_at DESC
        LIMIT 100`,
      [account.ruc, clientIds],
    ),
    clientIds.length ? db.query(
      `SELECT e.id, e.status, e.equipment, e.created_at, e.updated_at, e.process_code,
              to_jsonb(e)->>'delivered_at' AS delivered_at,
              to_jsonb(e)->>'contract_file_id' AS contract_document_id
         FROM public.equipment_purchase_requests e
        WHERE e.client_id = ANY($1::int[]) AND COALESCE(e.request_type, 'purchase') <> 'business_case'
        ORDER BY e.created_at DESC
        LIMIT 100`,
      [clientIds],
    ) : { rows: [] },
    clientIds.length ? db.query(
      `SELECT f.id, f.process_name, f.process_code, f.status, f.created_at,
              (SELECT COUNT(*) FROM public.consumable_orders co WHERE co.consumable_file_id = f.id)::int AS orders_count,
              (SELECT MAX(co.created_at) FROM public.consumable_orders co WHERE co.consumable_file_id = f.id) AS last_order_at
         FROM public.consumable_files f
        WHERE f.client_id = ANY($1::int[])
        ORDER BY f.created_at DESC
        LIMIT 50`,
      [clientIds],
    ).catch((err) => { logger.warn({ err: err.message }, "Base instalada: consumibles no disponibles"); return { rows: [] }; }) : { rows: [] },
  ]);

  const toItem = (type) => (row) => ({
    id: row.id,
    type,
    status: row.status,
    offer_kind: row.offer_kind || null,
    code: row.process_code || null,
    equipment: equipmentNames(row.equipment),
    delivered_at: row.delivered_at || null,
    installed: Boolean(row.delivered_at) || row.status === "delivered_signed",
    contract_document_id: row.contract_document_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
  return {
    has_identifier: true,
    client_ids: clientIds,
    equipment: [...privates.rows.map(toItem("private_purchase")), ...publics.rows.map(toItem("public_purchase"))],
    consumables: files.rows,
  };
};

module.exports = { listSalesGoals, upsertSalesGoal, getExecutiveBoard, findLeadDuplicates, getAccountInstalledBase };
