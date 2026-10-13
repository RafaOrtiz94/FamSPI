// FODA (SWOT) de la cuenta, asistido con datos del CRM (migracion 320).
// Flujo: el motor de reglas (crmAccountSwot.rules.js) PROPONE; el vendedor ACEPTA, edita o descarta.
// Lo aceptado/descartado queda con su source_key para no volver a proponerse. El acceso a todo
// pasa por getAccountById (visibilidad de la cuenta), igual que el resto del detalle de cuenta.
const db = require("../../config/db");
const crm = require("./crm.service");
const { suggestSwot, QUADRANTS, IMPACTS } = require("./crmAccountSwot.rules");

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const ORDER_QUADRANT = `CASE i.quadrant WHEN 'strength' THEN 1 WHEN 'opportunity' THEN 2 WHEN 'weakness' THEN 3 ELSE 4 END`;
const ORDER_IMPACT = `CASE i.impact WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`;

const cleanText = (value, label, max, { required = false } = {}) => {
  const s = value == null ? '' : String(value).trim();
  if (!s) {
    if (required) throw fail(`${label} es obligatorio`);
    return null;
  }
  if (s.length > max) throw fail(`${label} supera el máximo de ${max} caracteres`);
  return s;
};

const assertPlanOfAccount = async (accountId, planId) => {
  if (!planId) return null;
  const { rows } = await db.query(
    `SELECT id FROM crm.crm_account_plans WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL`,
    [planId, accountId]
  );
  if (!rows.length) throw fail('El plan no pertenece a la cuenta', 400);
  return planId;
};

// ─── Hechos del CRM para las reglas ──────────────────────────────────────────
const collectFacts = async (accountId, planId, user) => {
  // Reutiliza las estadisticas del plan: meta, vendido y faltante ya contemplan "ganada o en Contratos".
  const stats = await crm.getAccountSalesStats(accountId, user, planId);
  const SOLD = `(o.status = 'won' OR (o.status = 'open' AND st.name = 'Contratos'))`;

  const [opps, lostReasons, acts, contacts, strengths, competitors, redFlags, account] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE o.status = 'open' AND st.name IS DISTINCT FROM 'Contratos')::int AS open,
         COALESCE(SUM(o.estimated_amount) FILTER (WHERE o.status = 'open' AND st.name IS DISTINCT FROM 'Contratos'), 0)::numeric AS open_amount,
         COUNT(*) FILTER (WHERE ${SOLD})::int AS won,
         COALESCE(SUM(COALESCE(o.won_amount, o.estimated_amount, 0)) FILTER (WHERE ${SOLD}), 0)::numeric AS won_amount,
         COUNT(*) FILTER (WHERE o.status = 'open' AND st.name = 'Contratos')::int AS contracts,
         COALESCE(SUM(o.estimated_amount) FILTER (WHERE o.status = 'open' AND st.name = 'Contratos'), 0)::numeric AS contracts_amount,
         COUNT(*) FILTER (WHERE o.status = 'lost')::int AS lost,
         COUNT(*) FILTER (WHERE o.status = 'open' AND o.estimated_close_date < CURRENT_DATE)::int AS overdue_close
       FROM crm.crm_opportunities o
       LEFT JOIN crm.crm_pipeline_stages st ON st.id = o.stage_id
       WHERE o.account_id = $1 AND o.deleted_at IS NULL`,
      [accountId]
    ),
    db.query(
      `SELECT lr.reason_name AS reason, COUNT(*)::int AS count
         FROM crm.crm_opportunities o
         JOIN crm.crm_lost_reasons lr ON lr.id = o.lost_reason_id
        WHERE o.account_id = $1 AND o.deleted_at IS NULL AND o.status = 'lost'
        GROUP BY lr.reason_name ORDER BY count DESC LIMIT 3`,
      [accountId]
    ),
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE a.status NOT IN ('completed', 'cancelled') AND a.scheduled_at < now())::int AS overdue,
         COUNT(*) FILTER (WHERE a.status = 'completed' AND a.completed_at >= now() - interval '90 days')::int AS completed_90d
       FROM crm.crm_activities a
       WHERE a.deleted_at IS NULL
         AND (a.account_id = $1 OR a.opportunity_id IN (
               SELECT id FROM crm.crm_opportunities WHERE account_id = $1 AND deleted_at IS NULL))`,
      [accountId]
    ),
    db.query(`SELECT COUNT(*)::int AS n FROM crm.crm_contacts WHERE account_id = $1 AND deleted_at IS NULL`, [accountId]),
    db.query(
      `SELECT s.id, s.strength_description AS description, s.impact_level
         FROM crm.crm_strengths s
         JOIN crm.crm_blue_sheets bs ON bs.id = s.blue_sheet_id AND bs.deleted_at IS NULL
         JOIN crm.crm_opportunities o ON o.id = bs.opportunity_id AND o.deleted_at IS NULL AND o.account_id = $1
        WHERE s.deleted_at IS NULL
        ORDER BY s.created_at DESC LIMIT 10`,
      [accountId]
    ),
    db.query(
      // threat_level y relevance_score vienen de la migracion 233, que no esta aplicada en todos los
      // entornos: aqui solo se usan columnas de 231 (el incumbente ya marca la amenaza alta).
      `SELECT DISTINCT ON (lower(c.competitor_name)) c.competitor_name AS name, c.is_incumbent
         FROM crm.crm_competitors c
         JOIN crm.crm_blue_sheets bs ON bs.id = c.blue_sheet_id AND bs.deleted_at IS NULL
         JOIN crm.crm_opportunities o ON o.id = bs.opportunity_id AND o.deleted_at IS NULL AND o.account_id = $1
        WHERE c.deleted_at IS NULL
        ORDER BY lower(c.competitor_name), c.is_incumbent DESC NULLS LAST
        LIMIT 10`,
      [accountId]
    ),
    db.query(
      `SELECT rf.id, COALESCE(rf.flag_title, rf.flag_description, rf.flag_category) AS title, rf.severity
         FROM crm.crm_red_flags rf
         JOIN crm.crm_blue_sheets bs ON bs.id = rf.blue_sheet_id AND bs.deleted_at IS NULL
         JOIN crm.crm_opportunities o ON o.id = bs.opportunity_id AND o.deleted_at IS NULL AND o.account_id = $1
        WHERE rf.deleted_at IS NULL AND rf.status = 'open' AND rf.severity IN ('critical', 'high')
        ORDER BY CASE rf.severity WHEN 'critical' THEN 0 ELSE 1 END, rf.created_at DESC LIMIT 10`,
      [accountId]
    ),
    db.query(`SELECT classification FROM crm.crm_accounts WHERE id = $1`, [accountId]),
  ]);

  const o = opps.rows[0] || {};
  return {
    account: { classification: account.rows[0]?.classification || null },
    contactCount: contacts.rows[0]?.n || 0,
    opportunities: {
      open: o.open || 0, openAmount: Number(o.open_amount || 0),
      won: o.won || 0, wonAmount: Number(o.won_amount || 0),
      contracts: o.contracts || 0, contractsAmount: Number(o.contracts_amount || 0),
      lost: o.lost || 0, overdueClose: o.overdue_close || 0,
    },
    lostReasons: lostReasons.rows,
    activities: { overdue: acts.rows[0]?.overdue || 0, completedLast90d: acts.rows[0]?.completed_90d || 0 },
    plan: stats.plan
      ? { target_amount: stats.plan.target_amount, sold_amount: stats.sold_amount, remaining_to_target: stats.remaining_to_target }
      : null,
    strengths: strengths.rows,
    competitors: competitors.rows,
    redFlags: redFlags.rows,
    _plan: stats.plan,
  };
};

const existingKeys = async (accountId) => {
  const { rows } = await db.query(
    `SELECT source_key FROM crm.crm_account_swot_items
      WHERE account_id = $1 AND deleted_at IS NULL AND source_key IS NOT NULL`,
    [accountId]
  );
  return new Set(rows.map((r) => r.source_key));
};

const pendingSuggestions = async (accountId, planId, user) => {
  const facts = await collectFacts(accountId, planId, user);
  const taken = await existingKeys(accountId);
  return { facts, suggestions: suggestSwot(facts).filter((s) => !taken.has(s.source_key)) };
};

// ─── Items ───────────────────────────────────────────────────────────────────
const ITEM_SELECT = `
  SELECT i.id, i.account_id, i.plan_id, i.quadrant, i.title, i.description, i.impact, i.source, i.source_key,
         i.created_at, i.updated_at, u.fullname AS created_by_name, p.name AS plan_name
    FROM crm.crm_account_swot_items i
    LEFT JOIN public.users u ON u.id = i.created_by
    LEFT JOIN crm.crm_account_plans p ON p.id = i.plan_id`;

const activeItems = async (accountId, planId) => {
  const params = [accountId];
  let planClause = '';
  if (planId) {
    params.push(planId);
    planClause = 'AND (i.plan_id IS NULL OR i.plan_id = $2)';
  }
  const { rows } = await db.query(
    `${ITEM_SELECT}
      WHERE i.account_id = $1 AND i.deleted_at IS NULL AND i.status = 'active' ${planClause}
      ORDER BY ${ORDER_QUADRANT}, ${ORDER_IMPACT}, i.created_at`,
    params
  );
  return rows;
};

const getItem = async (accountId, itemId) => {
  const { rows } = await db.query(
    `${ITEM_SELECT} WHERE i.id = $1 AND i.account_id = $2 AND i.deleted_at IS NULL AND i.status = 'active'`,
    [itemId, accountId]
  );
  if (!rows.length) throw fail('Elemento del FODA no encontrado', 404);
  return rows[0];
};

const getSwot = async (accountId, { plan_id: planId } = {}, user) => {
  await crm.getAccountById(accountId, user); // 404/403
  if (planId) await assertPlanOfAccount(accountId, planId);
  const [items, { suggestions, facts }] = await Promise.all([
    activeItems(accountId, planId),
    pendingSuggestions(accountId, planId, user),
  ]);
  const counts = Object.fromEntries(QUADRANTS.map((q) => [q, items.filter((i) => i.quadrant === q).length]));
  return { items, suggestions, counts, plan: facts._plan || null };
};

const createItem = async (accountId, data = {}, user) => {
  await crm.getAccountById(accountId, user);
  if (!QUADRANTS.includes(data.quadrant)) throw fail('Cuadrante inválido');
  const impact = data.impact || 'medium';
  if (!IMPACTS.includes(impact)) throw fail('Impacto inválido');
  const title = cleanText(data.title, 'El título', 200, { required: true });
  const description = cleanText(data.description, 'La descripción', 2000);
  const planId = await assertPlanOfAccount(accountId, data.plan_id || null);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_account_swot_items
       (account_id, plan_id, quadrant, title, description, impact, source, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,'manual',$7,$7) RETURNING id`,
    [accountId, planId, data.quadrant, title, description, impact, user.id]
  );
  return getItem(accountId, rows[0].id);
};

// Acepta una sugerencia VIGENTE (se recalcula en el servidor: el cliente no inventa claves).
// Puede traer ediciones del vendedor sobre titulo, descripcion e impacto.
const acceptSuggestion = async (accountId, data = {}, user) => {
  await crm.getAccountById(accountId, user);
  const planId = await assertPlanOfAccount(accountId, data.plan_id || null);
  const { suggestions, facts } = await pendingSuggestions(accountId, planId, user);
  const found = suggestions.find((s) => s.source_key === data.source_key);
  if (!found) throw fail('La sugerencia ya no está vigente', 409);
  // plan_id solo sirve de contexto para calcular; el item queda ligado al plan unicamente si la
  // sugerencia depende de el (la brecha frente a la meta). El resto es de toda la cuenta.
  const itemPlanId = found.source_key === 'target_gap' ? (facts._plan?.id || null) : null;

  const impact = data.impact || found.impact;
  if (!IMPACTS.includes(impact)) throw fail('Impacto inválido');
  const title = cleanText(data.title ?? found.title, 'El título', 200, { required: true });
  const description = cleanText(data.description ?? found.description, 'La descripción', 2000);
  try {
    const { rows } = await db.query(
      `INSERT INTO crm.crm_account_swot_items
         (account_id, plan_id, quadrant, title, description, impact, source, source_key, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,'auto',$7,$8,$8) RETURNING id`,
      [accountId, itemPlanId, found.quadrant, title, description, impact, found.source_key, user.id]
    );
    return getItem(accountId, rows[0].id);
  } catch (err) {
    if (err.code === '23505') throw fail('La sugerencia ya fue gestionada', 409);
    throw err;
  }
};

const dismissSuggestion = async (accountId, data = {}, user) => {
  await crm.getAccountById(accountId, user);
  const planId = await assertPlanOfAccount(accountId, data.plan_id || null);
  const { suggestions } = await pendingSuggestions(accountId, planId, user);
  const found = suggestions.find((s) => s.source_key === data.source_key);
  if (!found) throw fail('La sugerencia ya no está vigente', 409);
  try {
    await db.query(
      `INSERT INTO crm.crm_account_swot_items
         (account_id, quadrant, title, description, impact, source, source_key, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,'auto',$6,'dismissed',$7,$7)`,
      [accountId, found.quadrant, found.title, found.description, found.impact, found.source_key, user.id]
    );
  } catch (err) {
    if (err.code !== '23505') throw err;
  }
  return { source_key: found.source_key, dismissed: true };
};

const updateItem = async (accountId, itemId, data = {}, user) => {
  await crm.getAccountById(accountId, user);
  await getItem(accountId, itemId);
  const sets = [];
  const params = [];
  const set = (col, value) => { params.push(value); sets.push(`${col} = $${params.length}`); };

  if (data.quadrant !== undefined) {
    if (!QUADRANTS.includes(data.quadrant)) throw fail('Cuadrante inválido');
    set('quadrant', data.quadrant);
  }
  if (data.impact !== undefined) {
    if (!IMPACTS.includes(data.impact)) throw fail('Impacto inválido');
    set('impact', data.impact);
  }
  if (data.title !== undefined) set('title', cleanText(data.title, 'El título', 200, { required: true }));
  if (data.description !== undefined) set('description', cleanText(data.description, 'La descripción', 2000));
  if (data.plan_id !== undefined) set('plan_id', await assertPlanOfAccount(accountId, data.plan_id || null));
  if (!sets.length) return getItem(accountId, itemId);

  params.push(user.id);
  sets.push(`updated_by = $${params.length}`, 'updated_at = now()');
  params.push(itemId);
  await db.query(`UPDATE crm.crm_account_swot_items SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return getItem(accountId, itemId);
};

// Un item automatico no se borra: pasa a "descartado" para que la regla no lo vuelva a proponer.
const deleteItem = async (accountId, itemId, user) => {
  await crm.getAccountById(accountId, user);
  const item = await getItem(accountId, itemId);
  if (item.source === 'auto') {
    await db.query(
      `UPDATE crm.crm_account_swot_items SET status = 'dismissed', updated_by = $2, updated_at = now() WHERE id = $1`,
      [itemId, user.id]
    );
  } else {
    await db.query(
      `UPDATE crm.crm_account_swot_items SET deleted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1`,
      [itemId, user.id]
    );
  }
  return { id: itemId, deleted: true };
};

// ─── Versiones ───────────────────────────────────────────────────────────────
const toSnapshot = (items) => items.map((i) => ({
  quadrant: i.quadrant, title: i.title, description: i.description, impact: i.impact,
  source: i.source, plan_id: i.plan_id, plan_name: i.plan_name,
}));

const createVersion = async (accountId, data = {}, user) => {
  await crm.getAccountById(accountId, user);
  const planId = data.plan_id ? await assertPlanOfAccount(accountId, data.plan_id) : null;
  const items = await activeItems(accountId, planId);
  if (!items.length) throw fail('El FODA está vacío; agrega elementos antes de guardar una versión');
  const note = cleanText(data.note, 'La nota', 300);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { rows } = await db.query(
        `INSERT INTO crm.crm_account_swot_versions (account_id, plan_id, version_number, note, snapshot, created_by)
         SELECT $1, $2, COALESCE(MAX(version_number), 0) + 1, $3, $4::jsonb, $5
           FROM crm.crm_account_swot_versions WHERE account_id = $1
         RETURNING id, version_number, note, created_at`,
        [accountId, planId, note, JSON.stringify(toSnapshot(items)), user.id]
      );
      return { ...rows[0], item_count: items.length };
    } catch (err) {
      if (err.code !== '23505' || attempt === 1) throw err;
    }
  }
  return null;
};

const listVersions = async (accountId, user) => {
  await crm.getAccountById(accountId, user);
  const { rows } = await db.query(
    `SELECT v.id, v.version_number, v.note, v.plan_id, v.created_at, u.fullname AS created_by_name,
            jsonb_array_length(v.snapshot)::int AS item_count
       FROM crm.crm_account_swot_versions v
       LEFT JOIN public.users u ON u.id = v.created_by
      WHERE v.account_id = $1
      ORDER BY v.version_number DESC`,
    [accountId]
  );
  return rows;
};

const itemKey = (i) => `${i.quadrant}::${String(i.title || '').trim().toLowerCase()}`;

// Version guardada + que cambio respecto del FODA actual (agregado / quitado).
const getVersion = async (accountId, versionId, user) => {
  await crm.getAccountById(accountId, user);
  const { rows } = await db.query(
    `SELECT v.id, v.version_number, v.note, v.plan_id, v.snapshot, v.created_at, u.fullname AS created_by_name
       FROM crm.crm_account_swot_versions v
       LEFT JOIN public.users u ON u.id = v.created_by
      WHERE v.id = $1 AND v.account_id = $2`,
    [versionId, accountId]
  );
  if (!rows.length) throw fail('Versión no encontrada', 404);
  const version = rows[0];
  const current = toSnapshot(await activeItems(accountId, version.plan_id));
  const oldKeys = new Set(version.snapshot.map(itemKey));
  const nowKeys = new Set(current.map(itemKey));
  return {
    ...version,
    changes_since: {
      added: current.filter((i) => !oldKeys.has(itemKey(i))),
      removed: version.snapshot.filter((i) => !nowKeys.has(itemKey(i))),
    },
  };
};

module.exports = {
  getSwot, createItem, acceptSuggestion, dismissSuggestion, updateItem, deleteItem,
  createVersion, listVersions, getVersion,
};
