const db = require("../../config/db");
const notificationManager = require("../notifications/notificationManager");
const logger = require("../../config/logger");
const { enqueueIntegrationEvent } = require("../integrations/integrationOutbox.service");
const { isCrmSyncEnabled } = require("../../config/crmDb");

const MANAGER_ROLES = new Set([
  "jefe_comercial",
  "jefe_de_comercial",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "director",
  "admin",
  "administrador",
]);

const PROCESS_TYPE_TO_TABLE = {
  business_case: "bc_master",
  private_purchase: "private_purchase_requests",
  equipment_purchase: "equipment_purchase_requests",
};

const normalizeText = (value, max = 500) => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, max) : "";
};

const normalizeNullableText = (value, max = 500) => {
  const normalized = normalizeText(value, max);
  return normalized || null;
};

const normalizeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeJsonArray = (value) => (Array.isArray(value) ? value : []);

const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const getActorId = (user) => Number(user?.id || 0) || null;
const getActorRole = (user) => normalizeRole(user?.role || user?.scope || user?.role_name || "");

const listAccounts = async ({ q = "", limit = 20 } = {}) => {
  const search = normalizeText(q, 120).toLowerCase();
  const rowLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const { rows } = await db.query(
    `SELECT id, name, legal_name, tax_id, industry, city, province, country, website, client_id, created_at, updated_at
       FROM accounts
      WHERE ($1 = '' OR LOWER(name) LIKE $2 OR LOWER(COALESCE(legal_name, '')) LIKE $2 OR LOWER(COALESCE(tax_id, '')) LIKE $2)
      ORDER BY updated_at DESC, name ASC
      LIMIT $3`,
    [search, `%${search}%`, rowLimit]
  );
  return rows;
};

const createAccount = async (payload, actorId) => {
  const name = normalizeText(payload?.name, 200);
  if (!name) {
    throw new Error("El nombre de la cuenta es obligatorio");
  }

  const { rows } = await db.query(
    `INSERT INTO accounts (
       name, legal_name, tax_id, industry, city, province, country, website, notes, client_id, created_by, updated_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
     RETURNING *`,
    [
      name,
      normalizeNullableText(payload?.legal_name, 200),
      normalizeNullableText(payload?.tax_id, 50),
      normalizeNullableText(payload?.industry, 120),
      normalizeNullableText(payload?.city, 120),
      normalizeNullableText(payload?.province, 120),
      normalizeText(payload?.country || "Ecuador", 120),
      normalizeNullableText(payload?.website, 300),
      normalizeNullableText(payload?.notes, 1000),
      payload?.client_id || null,
      actorId,
    ]
  );
  return rows[0];
};

const listContacts = async ({ accountId = null, q = "", limit = 30 } = {}) => {
  const search = normalizeText(q, 120).toLowerCase();
  const rowLimit = Math.min(Math.max(Number(limit) || 30, 1), 60);
  const { rows } = await db.query(
    `SELECT id, account_id, full_name, title, email, phone, mobile, notes, created_at, updated_at
       FROM contacts
      WHERE ($1::uuid IS NULL OR account_id = $1::uuid)
        AND ($2 = '' OR LOWER(full_name) LIKE $3 OR LOWER(COALESCE(email, '')) LIKE $3)
      ORDER BY updated_at DESC, full_name ASC
      LIMIT $4`,
    [accountId || null, search, `%${search}%`, rowLimit]
  );
  return rows;
};

const createContact = async (payload, actorId) => {
  const accountId = payload?.account_id || null;
  const fullName = normalizeText(payload?.full_name, 200);
  if (!accountId) {
    throw new Error("account_id es obligatorio");
  }
  if (!fullName) {
    throw new Error("El nombre del contacto es obligatorio");
  }

  const { rows } = await db.query(
    `INSERT INTO contacts (
       account_id, full_name, title, email, phone, mobile, notes, created_by, updated_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
     RETURNING *`,
    [
      accountId,
      fullName,
      normalizeNullableText(payload?.title, 150),
      normalizeNullableText(payload?.email, 200),
      normalizeNullableText(payload?.phone, 60),
      normalizeNullableText(payload?.mobile, 60),
      normalizeNullableText(payload?.notes, 1000),
      actorId,
    ]
  );
  return rows[0];
};

const refreshRating = async (opportunityId, actorId) => {
  const { rows } = await db.query(
    `WITH influence AS (
       SELECT
         BOOL_OR(role = 'economic') AS has_economic_buyer,
         BOOL_OR(role = 'coach') AS has_coach
       FROM buying_influence
       WHERE opportunity_id = $1
     ),
     competitors AS (
       SELECT COUNT(*)::int AS total FROM competitor WHERE opportunity_id = $1
     ),
     flags AS (
       SELECT COUNT(*) FILTER (WHERE severity IN ('high','critical') AND status = 'open')::int AS open_high
       FROM opportunity_flag
       WHERE opportunity_id = $1
     ),
     actions AS (
       SELECT COUNT(*)::int AS mitigation_actions
       FROM bs_action_item
       WHERE opportunity_id = $1 AND status IN ('in_progress', 'done')
     ),
     opp AS (
       SELECT CASE WHEN LENGTH(TRIM(COALESCE(singular_objective, ''))) > 0 THEN TRUE ELSE FALSE END AS has_clear_objective
       FROM opportunity
       WHERE id = $1
     )
     INSERT INTO opportunity_rating (
       opportunity_id,
       has_economic_buyer,
       has_coach,
       has_competition_strategy,
       has_red_flag_mitigation,
       has_clear_objective,
       updated_by
     )
     SELECT
       $1,
       COALESCE((SELECT has_economic_buyer FROM influence), FALSE),
       COALESCE((SELECT has_coach FROM influence), FALSE),
       COALESCE((SELECT total FROM competitors), 0) > 0,
       COALESCE((SELECT open_high FROM flags), 0) = 0 OR COALESCE((SELECT mitigation_actions FROM actions), 0) > 0,
       COALESCE((SELECT has_clear_objective FROM opp), FALSE),
       $2
     ON CONFLICT (opportunity_id)
     DO UPDATE SET
       has_economic_buyer = EXCLUDED.has_economic_buyer,
       has_coach = EXCLUDED.has_coach,
       has_competition_strategy = EXCLUDED.has_competition_strategy,
       has_red_flag_mitigation = EXCLUDED.has_red_flag_mitigation,
       has_clear_objective = EXCLUDED.has_clear_objective,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [opportunityId, actorId]
  );
  return rows[0];
};

const createSnapshot = async (opportunityId, snapshotType, payload, actorId) => {
  await db.query(
    `INSERT INTO opportunity_snapshot (opportunity_id, snapshot_type, payload, created_by)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [opportunityId, snapshotType, JSON.stringify(payload || {}), actorId]
  );
};

const mapOpportunityRow = (row) => ({
  ...row,
  estimated_amount: row.estimated_amount == null ? 0 : Number(row.estimated_amount),
  total_score: row.total_score == null ? 0 : Number(row.total_score),
});

const listOpportunities = async ({ q = "", stage = "", ownerId = null, mineOnly = false, actorUser }) => {
  const search = normalizeText(q, 160).toLowerCase();
  const actorId = getActorId(actorUser);
  const role = getActorRole(actorUser);
  const isManager = MANAGER_ROLES.has(role);
  const targetOwner = mineOnly || !isManager ? actorId : ownerId || null;

  const { rows } = await db.query(
    `SELECT
       o.id,
       o.account_id,
       a.name AS account_name,
       o.owner_id,
       u.name AS owner_name,
       o.title,
       o.singular_objective,
       o.product_name,
       o.estimated_amount,
       o.currency,
       o.target_close_date,
       o.funnel_stage,
       o.competitive_position,
       o.summary,
       o.updated_at,
       COALESCE(r.total_score, 0) AS total_score
     FROM opportunity o
     LEFT JOIN accounts a ON a.id = o.account_id
     LEFT JOIN users u ON u.id = o.owner_id
     LEFT JOIN opportunity_rating r ON r.opportunity_id = o.id
     WHERE ($1 = '' OR LOWER(o.title) LIKE $2 OR LOWER(COALESCE(a.name, '')) LIKE $2 OR LOWER(COALESCE(o.product_name, '')) LIKE $2)
       AND ($3 = '' OR o.funnel_stage::text = $3)
       AND ($4::integer IS NULL OR o.owner_id = $4::integer)
     ORDER BY o.updated_at DESC`,
    [search, `%${search}%`, stage || "", targetOwner]
  );

  return rows.map(mapOpportunityRow);
};

const getOpportunityBase = async (opportunityId) => {
  const { rows } = await db.query(
    `SELECT
       o.*,
       a.name AS account_name,
       u.name AS owner_name,
       COALESCE(r.total_score, 0) AS total_score,
       r.has_economic_buyer,
       r.has_coach,
       r.has_competition_strategy,
       r.has_red_flag_mitigation,
       r.has_clear_objective
     FROM opportunity o
     LEFT JOIN accounts a ON a.id = o.account_id
     LEFT JOIN users u ON u.id = o.owner_id
     LEFT JOIN opportunity_rating r ON r.opportunity_id = o.id
     WHERE o.id = $1
     LIMIT 1`,
    [opportunityId]
  );
  if (!rows.length) {
    throw new Error("Oportunidad no encontrada");
  }
  return mapOpportunityRow(rows[0]);
};

const getOpportunityDetail = async (opportunityId) => {
  const opportunity = await getOpportunityBase(opportunityId);
  const [influences, flags, actions, competitors, comments, links, snapshots] = await Promise.all([
    db.query(`SELECT * FROM buying_influence WHERE opportunity_id = $1 ORDER BY created_at ASC`, [opportunityId]),
    db.query(`SELECT * FROM opportunity_flag WHERE opportunity_id = $1 ORDER BY sort_order ASC, created_at ASC`, [opportunityId]),
    db.query(`SELECT * FROM bs_action_item WHERE opportunity_id = $1 ORDER BY sort_order ASC, due_date ASC NULLS LAST, created_at ASC`, [opportunityId]),
    db.query(`SELECT * FROM competitor WHERE opportunity_id = $1 ORDER BY created_at ASC`, [opportunityId]),
    db.query(`SELECT * FROM bs_comment WHERE opportunity_id = $1 ORDER BY created_at ASC`, [opportunityId]),
    db.query(`SELECT * FROM opportunity_process_link WHERE opportunity_id = $1 ORDER BY created_at ASC`, [opportunityId]),
    db.query(`SELECT id, snapshot_type, payload, created_by, created_at FROM opportunity_snapshot WHERE opportunity_id = $1 ORDER BY created_at DESC LIMIT 20`, [opportunityId]),
  ]);

  return {
    opportunity,
    rating: {
      total_score: opportunity.total_score,
      has_economic_buyer: opportunity.has_economic_buyer ?? false,
      has_coach: opportunity.has_coach ?? false,
      has_competition_strategy: opportunity.has_competition_strategy ?? false,
      has_red_flag_mitigation: opportunity.has_red_flag_mitigation ?? false,
      has_clear_objective: opportunity.has_clear_objective ?? false,
    },
    influences: influences.rows,
    flags: flags.rows,
    actions: actions.rows,
    competitors: competitors.rows,
    comments: comments.rows,
    links: links.rows,
    snapshots: snapshots.rows,
  };
};

const buildCrmOpportunityPayload = (detail) => {
  const opportunity = detail?.opportunity || {};
  const rating = detail?.rating || {};

  return {
    famspi_opportunity_id: opportunity.id,
    title: opportunity.title,
    estimated_amount: opportunity.estimated_amount,
    currency: opportunity.currency,
    funnel_stage: opportunity.funnel_stage,
    competitive_position: opportunity.competitive_position,
    singular_objective: opportunity.singular_objective || null,
    total_score: Number(rating.total_score || 0),
    target_close_date: opportunity.target_close_date,
    account_id: opportunity.account_id,
    account_name: opportunity.account_name || null,
    owner_id: opportunity.owner_id,
    owner_name: opportunity.owner_name || null,
    summary: opportunity.summary,
    updated_at: opportunity.updated_at,
  };
};

const createOpportunity = async (payload, actorUser) => {
  const actorId = getActorId(actorUser);
  const title = normalizeText(payload?.title, 220);
  const singularObjective = normalizeText(payload?.singular_objective, 1200);

  if (!title || !singularObjective) {
    throw new Error("title y singular_objective son obligatorios");
  }

  const { rows } = await db.query(
    `INSERT INTO opportunity (
       account_id, owner_id, title, singular_objective, product_name, estimated_amount, currency, target_close_date,
       funnel_stage, competitive_position, summary, strategic_win_factors, created_by, updated_by, last_activity_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$13,NOW())
     RETURNING *`,
    [
      payload?.account_id || null,
      payload?.owner_id || actorId,
      title,
      singularObjective,
      normalizeNullableText(payload?.product_name, 200),
      normalizeNumber(payload?.estimated_amount, 0),
      normalizeText(payload?.currency || "USD", 10),
      normalizeDate(payload?.target_close_date),
      payload?.funnel_stage || "prospect",
      payload?.competitive_position || "shared",
      normalizeNullableText(payload?.summary, 2000),
      JSON.stringify(normalizeJsonArray(payload?.strategic_win_factors)),
      actorId,
    ]
  );
  await refreshRating(rows[0].id, actorId);
  await createSnapshot(rows[0].id, "create", rows[0], actorId);
  const detail = await getOpportunityDetail(rows[0].id);

  if (isCrmSyncEnabled()) {
    const crmPayload = buildCrmOpportunityPayload(detail);
    try {
      await enqueueIntegrationEvent({
        eventType: "crm.opportunity.sync",
        payload: crmPayload,
        idempotencyKey: `crm.opportunity.sync.create.${crmPayload.famspi_opportunity_id}`,
        correlationId: String(crmPayload.famspi_opportunity_id),
      });
    } catch (crmErr) {
      logger.warn(
        { opportunity_id: crmPayload.famspi_opportunity_id, error: crmErr?.message },
        "[CRM_SYNC] Error encolando oportunidad nueva"
      );
    }
  }

  return detail;
};

const updateOpportunity = async (opportunityId, payload, actorUser) => {
  const actorId = getActorId(actorUser);
  const previous = await getOpportunityBase(opportunityId);
  const sets = [];
  const values = [];
  let idx = 1;

  const push = (column, value) => {
    sets.push(`${column} = $${idx++}`);
    values.push(value);
  };

  if (payload?.account_id !== undefined) push("account_id", payload.account_id || null);
  if (payload?.owner_id !== undefined) push("owner_id", payload.owner_id || actorId);
  if (payload?.title !== undefined) push("title", normalizeText(payload.title, 220));
  if (payload?.singular_objective !== undefined) push("singular_objective", normalizeText(payload.singular_objective, 1200));
  if (payload?.product_name !== undefined) push("product_name", normalizeNullableText(payload.product_name, 200));
  if (payload?.estimated_amount !== undefined) push("estimated_amount", normalizeNumber(payload.estimated_amount, 0));
  if (payload?.currency !== undefined) push("currency", normalizeText(payload.currency || "USD", 10));
  if (payload?.target_close_date !== undefined) push("target_close_date", normalizeDate(payload.target_close_date));
  if (payload?.funnel_stage !== undefined) push("funnel_stage", payload.funnel_stage);
  if (payload?.competitive_position !== undefined) push("competitive_position", payload.competitive_position);
  if (payload?.summary !== undefined) push("summary", normalizeNullableText(payload.summary, 2000));
  if (payload?.strategic_win_factors !== undefined) push("strategic_win_factors", JSON.stringify(normalizeJsonArray(payload.strategic_win_factors)));

  if (!sets.length) {
    return getOpportunityDetail(opportunityId);
  }

  push("updated_by", actorId);
  push("last_activity_at", new Date().toISOString());

  if (payload?.funnel_stage === "won") push("won_at", new Date().toISOString());
  if (payload?.funnel_stage === "lost") push("lost_at", new Date().toISOString());
  if (payload?.funnel_stage === "archived") push("archived_at", new Date().toISOString());

  values.push(opportunityId);
  await db.query(
    `UPDATE opportunity
        SET ${sets.join(", ")}
      WHERE id = $${idx}`,
    values
  );

  await refreshRating(opportunityId, actorId);
  await createSnapshot(opportunityId, "update", { before: previous, payload }, actorId);
  const updated = await getOpportunityDetail(opportunityId);

  if (isCrmSyncEnabled()) {
    const crmPayload = buildCrmOpportunityPayload(updated);
    try {
      await enqueueIntegrationEvent({
        eventType: "crm.opportunity.sync",
        payload: crmPayload,
        idempotencyKey: `crm.opportunity.sync.update.${crmPayload.famspi_opportunity_id}.${Date.now()}`,
        correlationId: String(crmPayload.famspi_opportunity_id),
      });
    } catch (crmErr) {
      logger.warn(
        { opportunity_id: crmPayload.famspi_opportunity_id, error: crmErr?.message },
        "[CRM_SYNC] Error encolando actualizacion de oportunidad"
      );
    }
  }

  return updated;
};

const upsertInfluence = async (opportunityId, payload, actorUser) => {
  const actorId = getActorId(actorUser);
  const influenceId = payload?.id || null;
  const values = [
    opportunityId,
    payload?.contact_id || null,
    normalizeText(payload?.full_name, 200),
    payload?.role,
    payload?.influence_level || "medium",
    payload?.mode || null,
    Math.min(Math.max(Number(payload?.euphoria_panic || 5), 1), 10),
    normalizeNullableText(payload?.personal_win, 1000),
    normalizeNullableText(payload?.business_result, 1000),
    normalizeNullableText(payload?.notes, 1000),
    actorId,
  ];

  if (!values[2] || !values[3]) {
    throw new Error("full_name y role son obligatorios");
  }

  if (influenceId) {
    await db.query(
      `UPDATE buying_influence
          SET contact_id = $2,
              full_name = $3,
              role = $4,
              influence_level = $5,
              mode = $6,
              euphoria_panic = $7,
              personal_win = $8,
              business_result = $9,
              notes = $10,
              updated_by = $11
        WHERE id = $12 AND opportunity_id = $1`,
      [...values, influenceId]
    );
  } else {
    await db.query(
      `INSERT INTO buying_influence (
         opportunity_id, contact_id, full_name, role, influence_level, mode, euphoria_panic,
         personal_win, business_result, notes, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
      values
    );
  }

  await refreshRating(opportunityId, actorId);
  await createSnapshot(opportunityId, "influence", payload, actorId);
  return getOpportunityDetail(opportunityId);
};

const deleteInfluence = async (opportunityId, influenceId, actorUser) => {
  const actorId = getActorId(actorUser);
  await db.query(`DELETE FROM buying_influence WHERE opportunity_id = $1 AND id = $2`, [opportunityId, influenceId]);
  await refreshRating(opportunityId, actorId);
  return getOpportunityDetail(opportunityId);
};

const upsertFlag = async (opportunityId, payload, actorUser) => {
  const actorId = getActorId(actorUser);
  const flagId = payload?.id || null;
  const values = [
    opportunityId,
    payload?.buying_influence_id || null,
    payload?.template_id || null,
    normalizeText(payload?.title, 200),
    normalizeNullableText(payload?.description, 1200),
    payload?.severity || "medium",
    payload?.status || "open",
    Number.isFinite(Number(payload?.sort_order)) ? Number(payload.sort_order) : 0,
    Boolean(payload?.auto_generated),
    actorId,
  ];
  if (!values[3]) {
    throw new Error("title es obligatorio");
  }

  if (flagId) {
    await db.query(
      `UPDATE opportunity_flag
          SET buying_influence_id = $2,
              template_id = $3,
              title = $4,
              description = $5,
              severity = $6,
              status = $7,
              sort_order = $8,
              auto_generated = $9,
              updated_by = $10
        WHERE opportunity_id = $1 AND id = $11`,
      [...values, flagId]
    );
  } else {
    await db.query(
      `INSERT INTO opportunity_flag (
         opportunity_id, buying_influence_id, template_id, title, description, severity, status, sort_order,
         auto_generated, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
      values
    );
  }

  await refreshRating(opportunityId, actorId);
  return getOpportunityDetail(opportunityId);
};

const deleteFlag = async (opportunityId, flagId, actorUser) => {
  const actorId = getActorId(actorUser);
  await db.query(`DELETE FROM opportunity_flag WHERE opportunity_id = $1 AND id = $2`, [opportunityId, flagId]);
  await refreshRating(opportunityId, actorId);
  return getOpportunityDetail(opportunityId);
};

const upsertCompetitor = async (opportunityId, payload, actorUser) => {
  const actorId = getActorId(actorUser);
  const competitorId = payload?.id || null;
  const values = [
    opportunityId,
    payload?.competitor_catalog_id || null,
    normalizeText(payload?.competitor_name, 160),
    Math.min(Math.max(Number(payload?.relationship_score || 0), 0), 10),
    Math.min(Math.max(Number(payload?.technical_score || 0), 0), 10),
    Math.min(Math.max(Number(payload?.price_score || 0), 0), 10),
    Math.min(Math.max(Number(payload?.service_score || 0), 0), 10),
    Math.min(Math.max(Number(payload?.evidence_score || 0), 0), 10),
    normalizeNullableText(payload?.notes, 1000),
    actorId,
  ];
  if (!values[2]) {
    throw new Error("competitor_name es obligatorio");
  }

  if (competitorId) {
    await db.query(
      `UPDATE competitor
          SET competitor_catalog_id = $2,
              competitor_name = $3,
              relationship_score = $4,
              technical_score = $5,
              price_score = $6,
              service_score = $7,
              evidence_score = $8,
              notes = $9,
              updated_by = $10
        WHERE opportunity_id = $1 AND id = $11`,
      [...values, competitorId]
    );
  } else {
    await db.query(
      `INSERT INTO competitor (
         opportunity_id, competitor_catalog_id, competitor_name, relationship_score, technical_score, price_score,
         service_score, evidence_score, notes, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
      values
    );
  }

  await refreshRating(opportunityId, actorId);
  return getOpportunityDetail(opportunityId);
};

const deleteCompetitor = async (opportunityId, competitorId, actorUser) => {
  const actorId = getActorId(actorUser);
  await db.query(`DELETE FROM competitor WHERE opportunity_id = $1 AND id = $2`, [opportunityId, competitorId]);
  await refreshRating(opportunityId, actorId);
  return getOpportunityDetail(opportunityId);
};

const upsertAction = async (opportunityId, payload, actorUser) => {
  const actorId = getActorId(actorUser);
  const actionId = payload?.id || null;
  const values = [
    opportunityId,
    payload?.flag_id || null,
    payload?.template_id || null,
    normalizeText(payload?.title, 220),
    normalizeNullableText(payload?.description, 1200),
    payload?.assignee_user_id || null,
    normalizeDate(payload?.due_date),
    payload?.status || "pending",
    Number.isFinite(Number(payload?.sort_order)) ? Number(payload.sort_order) : 0,
    payload?.status === "done" ? new Date().toISOString() : null,
    actorId,
  ];
  if (!values[3]) {
    throw new Error("title es obligatorio");
  }

  if (actionId) {
    await db.query(
      `UPDATE bs_action_item
          SET flag_id = $2,
              template_id = $3,
              title = $4,
              description = $5,
              assignee_user_id = $6,
              due_date = $7,
              status = $8,
              sort_order = $9,
              completed_at = $10,
              updated_by = $11
        WHERE opportunity_id = $1 AND id = $12`,
      [...values, actionId]
    );
  } else {
    await db.query(
      `INSERT INTO bs_action_item (
         opportunity_id, flag_id, template_id, title, description, assignee_user_id, due_date,
         status, sort_order, completed_at, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
      values
    );
  }

  if (values[5]) {
    try {
      await notificationManager.sendNotification({
        user_id: values[5],
        title: "Nueva acción FamSheets",
        message: values[3],
        type: "bluesheet_action_assigned",
        metadata: { opportunity_id: opportunityId },
      });
    } catch (_err) {}
  }

  await refreshRating(opportunityId, actorId);
  return getOpportunityDetail(opportunityId);
};

const deleteAction = async (opportunityId, actionId, actorUser) => {
  const actorId = getActorId(actorUser);
  await db.query(`DELETE FROM bs_action_item WHERE opportunity_id = $1 AND id = $2`, [opportunityId, actionId]);
  await refreshRating(opportunityId, actorId);
  return getOpportunityDetail(opportunityId);
};

const createComment = async (opportunityId, payload, actorUser) => {
  const actorId = getActorId(actorUser);
  const body = normalizeText(payload?.body, 4000);
  if (!body) {
    throw new Error("body es obligatorio");
  }
  const mentions = normalizeJsonArray(payload?.mention_user_ids)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  await db.query(
    `INSERT INTO bs_comment (
       opportunity_id, parent_comment_id, author_user_id, body, visibility, mention_user_ids
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [
      opportunityId,
      payload?.parent_comment_id || null,
      actorId,
      body,
      payload?.visibility === "private" ? "private" : "team",
      JSON.stringify(mentions),
    ]
  );

  for (const mentionedUserId of mentions) {
    try {
      await notificationManager.sendNotification({
        user_id: mentionedUserId,
        title: "Mención en FamSheets",
        message: body.slice(0, 180),
        type: "bluesheet_comment_mention",
        metadata: { opportunity_id: opportunityId },
      });
    } catch (_err) {}
  }

  return getOpportunityDetail(opportunityId);
};

const deleteComment = async (opportunityId, commentId) => {
  await db.query(`DELETE FROM bs_comment WHERE opportunity_id = $1 AND id = $2`, [opportunityId, commentId]);
  return getOpportunityDetail(opportunityId);
};

const lookupProcessByTypeAndId = async (type, id) => {
  const normalizedType = normalizeRole(type);
  if (!PROCESS_TYPE_TO_TABLE[normalizedType]) {
    throw new Error("process_type no soportado");
  }

  if (normalizedType === "business_case") {
    const { rows } = await db.query(
      `SELECT
         id,
         bc_number AS code,
         client_id,
         client_name,
         contract_object AS title,
         current_stage AS status,
         total_investment AS amount
       FROM bc_master
       WHERE id = $1::uuid
       LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  if (normalizedType === "private_purchase") {
    const { rows } = await db.query(
      `SELECT
         id,
         status,
         client_snapshot,
         equipment,
         notes
       FROM private_purchase_requests
       WHERE id = $1::uuid
       LIMIT 1`,
      [id]
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].id,
      status: rows[0].status,
      client_name: rows[0].client_snapshot?.razon_social || rows[0].client_snapshot?.nombre_comercial || null,
      title: "Compra privada",
      amount: null,
      equipment: rows[0].equipment || [],
      notes: rows[0].notes || null,
      raw: rows[0],
    };
  }

  const { rows } = await db.query(
    `SELECT
       id,
       client_id,
       client_name,
       status,
       equipment
     FROM equipment_purchase_requests
     WHERE id = $1::uuid
     LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    client_id: rows[0].client_id,
    client_name: rows[0].client_name,
    title: "Compra pública",
    status: rows[0].status,
    equipment: rows[0].equipment || [],
    raw: rows[0],
  };
};

const buildImportedData = (processType, record, importFields = []) => {
  const data = {};
  const fields = Array.isArray(importFields) && importFields.length ? importFields : ["client_name", "title", "amount", "equipment"];
  for (const field of fields) {
    if (record[field] !== undefined) {
      data[field] = record[field];
    }
  }
  data.process_type = processType;
  data.process_id = record.id;
  return data;
};

const linkProcess = async (opportunityId, payload, actorUser) => {
  const actorId = getActorId(actorUser);
  const processType = normalizeRole(payload?.process_type);
  const processId = String(payload?.process_id || "").trim();
  if (!processType || !processId) {
    throw new Error("process_type y process_id son obligatorios");
  }

  const record = await lookupProcessByTypeAndId(processType, processId);
  if (!record) {
    throw new Error("Expediente no encontrado");
  }

  const importedFields = normalizeJsonArray(payload?.import_fields);
  const importedData = buildImportedData(processType, record, importedFields);

  await db.query(
    `INSERT INTO opportunity_process_link (
       opportunity_id, process_type, process_id, imported_fields, imported_data, created_by
     ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
     ON CONFLICT (opportunity_id, process_type, process_id)
     DO UPDATE SET
       imported_fields = EXCLUDED.imported_fields,
       imported_data = EXCLUDED.imported_data,
       updated_at = NOW()`,
    [
      opportunityId,
      processType,
      processId,
      JSON.stringify(importedFields),
      JSON.stringify(importedData),
      actorId,
    ]
  );

  const patch = {};
  if (importedData.client_name && !payload?.skip_apply) {
    patch.title = importedData.title || (await getOpportunityBase(opportunityId)).title;
  }
  await createSnapshot(opportunityId, "link_process", { processType, processId, importedData }, actorId);
  return getOpportunityDetail(opportunityId);
};

const unlinkProcess = async (opportunityId, linkId, actorUser) => {
  const actorId = getActorId(actorUser);
  await db.query(`DELETE FROM opportunity_process_link WHERE opportunity_id = $1 AND id = $2`, [opportunityId, linkId]);
  await createSnapshot(opportunityId, "unlink_process", { linkId }, actorId);
  return getOpportunityDetail(opportunityId);
};

const getManagerDashboard = async (actorUser) => {
  const actorRole = getActorRole(actorUser);
  const actorId = getActorId(actorUser);
  const ownerFilter = MANAGER_ROLES.has(actorRole) ? null : actorId;

  const [stageCounts, overdueActions, noCoach, criticalFlags] = await Promise.all([
    db.query(
      `SELECT funnel_stage, COUNT(*)::int AS total
         FROM opportunity
        WHERE ($1::integer IS NULL OR owner_id = $1)
        GROUP BY funnel_stage
        ORDER BY funnel_stage`,
      [ownerFilter]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total
         FROM bs_action_item ai
         JOIN opportunity o ON o.id = ai.opportunity_id
        WHERE ai.status IN ('pending', 'in_progress')
          AND ai.due_date IS NOT NULL
          AND ai.due_date < CURRENT_DATE
          AND ($1::integer IS NULL OR o.owner_id = $1)`,
      [ownerFilter]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total
         FROM opportunity_rating r
         JOIN opportunity o ON o.id = r.opportunity_id
        WHERE COALESCE(r.has_coach, FALSE) = FALSE
          AND ($1::integer IS NULL OR o.owner_id = $1)`,
      [ownerFilter]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total
         FROM opportunity_flag f
         JOIN opportunity o ON o.id = f.opportunity_id
        WHERE f.status = 'open'
          AND f.severity = 'critical'
          AND ($1::integer IS NULL OR o.owner_id = $1)`,
      [ownerFilter]
    ),
  ]);

  return {
    stage_counts: stageCounts.rows,
    overdue_actions: Number(overdueActions.rows[0]?.total || 0),
    opportunities_without_coach: Number(noCoach.rows[0]?.total || 0),
    critical_flags: Number(criticalFlags.rows[0]?.total || 0),
  };
};

module.exports = {
  listAccounts,
  createAccount,
  listContacts,
  createContact,
  listOpportunities,
  getOpportunityDetail,
  createOpportunity,
  updateOpportunity,
  upsertInfluence,
  deleteInfluence,
  upsertFlag,
  deleteFlag,
  upsertCompetitor,
  deleteCompetitor,
  upsertAction,
  deleteAction,
  createComment,
  deleteComment,
  lookupProcessByTypeAndId,
  linkProcess,
  unlinkProcess,
  getManagerDashboard,
};
