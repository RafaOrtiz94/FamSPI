// Recorrido de la oportunidad: junta los expedientes enlazados (compra privada, compra pública,
// Business Case, solicitud de cliente, ofertas y consumibles) y los convierte en hitos con
// crmOpportunityJourney.rules.js. Solo lectura. Trabaja por lotes para que el tablero del embudo
// pida el recorrido de todas sus tarjetas en una sola llamada.
//
// Las filas se leen con to_jsonb(...) en vez de listar columnas: esas tablas tienen cientos de
// columnas agregadas por migraciones manuales y una columna ausente en un entorno no debe tumbar
// el embudo (ver gotcha "servicio adelantado a la migración" del módulo).
const db = require("../../config/db");
const logger = require("../../config/logger");
const { MANAGER_OR_ADMIN_ROLES } = require("./crm.constants");
const { ensureLinkColumns, STAGE_NAMES, upsertOpportunityStage } = require("./crmPurchaseSync.service");
const { buildJourney, stageForJourney } = require("./crmOpportunityJourney.rules");
const { rankNextActions } = require("./crmNextActions.rules");

const MANAGER_ROLES = new Set(MANAGER_OR_ADMIN_ROLES);
const MAX_IDS = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// Columnas pesadas que el recorrido no necesita.
const PUBLIC_HEAVY = `- 'modern_bc_metadata' - 'extra' - 'equipment' - 'bc_progress' - 'checklist' - 'provider_response'`;
const PRIVATE_HEAVY = `- 'client_snapshot' - 'equipment' - 'extra' - 'provider_response' - 'dispatch_items_json' - 'delivery_guides_json' - 'delivery_dates_json' - 'site_inspection'`;
const CRM_SYNC_OPP = (alias, column) => `${alias}.${column}->'crm_sync'->>'opportunity_id'`;

// Una fuente opcional (tabla que puede no existir en un entorno) nunca rompe el recorrido.
const optional = async (label, sql, params) => {
  try {
    return (await db.query(sql, params)).rows;
  } catch (err) {
    logger.warn({ err: err.message, source: label }, "Recorrido CRM: fuente no disponible");
    return [];
  }
};

const uniq = (values) => [...new Set(values.filter(Boolean))];

// ids visibles para el usuario (misma regla que la lista: manager ve todo, el resto lo suyo).
const visibleIds = async (ids, user) => {
  const params = [ids];
  let owner = "";
  if (!MANAGER_ROLES.has(user.role)) { params.push(user.id); owner = "AND owner_user_id = $2"; }
  const { rows } = await db.query(
    `SELECT id FROM crm.crm_opportunities WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL ${owner}`,
    params,
  );
  return rows.map((r) => r.id);
};

const collect = async (oppIds, { withEvents = false } = {}) => {
  await ensureLinkColumns();
  const byOpp = new Map(oppIds.map((id) => [id, { privates: [], publics: [], businessCases: [], clientRequests: [], offers: [], consumables: [], events: [] }]));
  const bucket = (oppId) => byOpp.get(oppId);

  const [privateRows, equipmentRows] = await Promise.all([
    db.query(
      `SELECT p.opportunity_id::text AS opp_id, to_jsonb(p) ${PRIVATE_HEAVY} AS row
         FROM public.private_purchase_requests p
        WHERE p.opportunity_id = ANY($1::uuid[])`,
      [oppIds],
    ).then((r) => r.rows),
    // El Business Case guarda su oportunidad en modern_bc_metadata.crm_sync; las compras, en la columna o en extra.
    db.query(
      `SELECT COALESCE(e.opportunity_id::text, ${CRM_SYNC_OPP("e", "modern_bc_metadata")}, ${CRM_SYNC_OPP("e", "extra")}) AS opp_id,
              to_jsonb(e) ${PUBLIC_HEAVY} AS row
         FROM public.equipment_purchase_requests e
        WHERE e.opportunity_id = ANY($1::uuid[])
           OR ${CRM_SYNC_OPP("e", "modern_bc_metadata")} = ANY($2::text[])
           OR ${CRM_SYNC_OPP("e", "extra")} = ANY($2::text[])`,
      [oppIds, oppIds],
    ).then((r) => r.rows),
  ]);

  const oppOfPurchase = new Map(); // id del expediente → oportunidad
  const seenBc = new Set();
  const addEquipment = (oppId, row) => {
    const target = bucket(oppId);
    if (!target) return;
    if (row.request_type === "business_case") {
      if (seenBc.has(`${oppId}:${row.id}`)) return;
      seenBc.add(`${oppId}:${row.id}`);
      target.businessCases.push(row);
    } else {
      target.publics.push(row);
    }
    oppOfPurchase.set(row.id, oppId);
  };
  privateRows.forEach(({ opp_id: oppId, row }) => { if (bucket(oppId)) { bucket(oppId).privates.push(row); oppOfPurchase.set(row.id, oppId); } });
  equipmentRows.forEach(({ opp_id: oppId, row }) => addEquipment(oppId, row));

  // Business Case enlazado desde la compra (privada por columna; pública por tabla de vínculos).
  const privateIds = privateRows.map((r) => r.row.id);
  const publicIds = equipmentRows.filter((r) => r.row.request_type !== "business_case").map((r) => r.row.id);
  const bcOwner = new Map(); // business_case_id → oportunidad
  privateRows.forEach(({ opp_id: oppId, row }) => {
    [row.business_case_id, row.comodato_business_case_id].filter(Boolean).forEach((id) => bcOwner.set(id, oppId));
  });
  if (publicIds.length) {
    const links = await optional("equipment_purchase_business_case_links",
      `SELECT equipment_purchase_id, business_case_id FROM public.equipment_purchase_business_case_links WHERE equipment_purchase_id = ANY($1::uuid[])`,
      [publicIds]);
    links.forEach((l) => bcOwner.set(l.business_case_id, oppOfPurchase.get(l.equipment_purchase_id)));
  }
  const missingBc = [...bcOwner.keys()].filter((id) => !oppOfPurchase.has(id));
  if (missingBc.length) {
    const rows = await db.query(
      `SELECT to_jsonb(e) ${PUBLIC_HEAVY} AS row FROM public.equipment_purchase_requests e WHERE e.id = ANY($1::uuid[])`,
      [missingBc],
    ).then((r) => r.rows);
    rows.forEach(({ row }) => addEquipment(bcOwner.get(row.id), { ...row, request_type: "business_case" }));
  }

  const bcIds = uniq([...byOpp.values()].flatMap((b) => b.businessCases.map((bc) => bc.id)));
  const bcOpp = new Map();
  byOpp.forEach((b, oppId) => b.businessCases.forEach((bc) => bcOpp.set(bc.id, oppId)));
  const clientRequestIds = uniq(privateRows.map((r) => r.row.client_request_id));
  const clientRequestOpp = new Map(privateRows.filter((r) => r.row.client_request_id).map((r) => [r.row.client_request_id, r.opp_id]));

  const [clientRequests, offers, consumables] = await Promise.all([
    optional("client_requests",
      // opportunity_id se lee desde to_jsonb: la columna no existe en todos los entornos.
      `SELECT c.id, c.status, c.approval_status, c.approved_at, c.created_at, c.commercial_name,
              to_jsonb(c)->>'opportunity_id' AS opp_id
         FROM public.client_requests c
        WHERE c.id = ANY($1::int[]) OR to_jsonb(c)->>'opportunity_id' = ANY($2::text[])`,
      [clientRequestIds, oppIds]),
    (bcIds.length || privateIds.length) ? optional("bc_offer_versions",
      `SELECT v.id, v.business_case_id, v.private_purchase_id, v.version_number, v.status, v.pdf_file_id, v.pdf_url, v.offer_label,
              v.created_at, v.sent_at, v.decided_at
         FROM public.bc_offer_versions v
        WHERE v.business_case_id = ANY($1::uuid[]) OR v.private_purchase_id = ANY($2::uuid[])`,
      [bcIds, privateIds]) : [],
    (bcIds.length || privateIds.length || publicIds.length) ? optional("consumable_files",
      `SELECT f.id, f.status, f.registered_at, f.created_at, f.business_case_id, f.private_purchase_request_id, f.equipment_purchase_request_id
         FROM public.consumable_files f
        WHERE f.business_case_id = ANY($1::uuid[]) OR f.private_purchase_request_id = ANY($2::uuid[]) OR f.equipment_purchase_request_id = ANY($3::uuid[])`,
      [bcIds, privateIds, publicIds]) : [],
  ]);

  clientRequests.forEach((c) => { const t = bucket(c.opp_id || clientRequestOpp.get(c.id)); if (t) t.clientRequests.push(c); });
  offers.forEach((o) => { const t = bucket(oppOfPurchase.get(o.private_purchase_id) || bcOpp.get(o.business_case_id)); if (t) t.offers.push(o); });
  consumables.forEach((f) => {
    const t = bucket(oppOfPurchase.get(f.private_purchase_request_id) || oppOfPurchase.get(f.equipment_purchase_request_id) || bcOpp.get(f.business_case_id));
    if (t) t.consumables.push(f);
  });

  if (withEvents) {
    const [privateEvents, bcEvents] = await Promise.all([
      privateIds.length ? optional("private_purchase_state_transitions",
        `SELECT t.purchase_id AS source_id, t.to_state, t.transition_reason, t.transitioned_at, u.fullname AS by_name
           FROM public.private_purchase_state_transitions t
           LEFT JOIN public.users u ON u.id = t.transitioned_by
          WHERE t.purchase_id = ANY($1::uuid[])
          ORDER BY t.transitioned_at DESC LIMIT 200`,
        [privateIds]) : [],
      (bcIds.length || publicIds.length) ? optional("business_case_state_transitions",
        `SELECT t.business_case_id AS source_id, t.to_state, t.transition_reason, t.transitioned_at, u.fullname AS by_name
           FROM public.business_case_state_transitions t
           LEFT JOIN public.users u ON u.id = t.transitioned_by
          WHERE t.business_case_id = ANY($1::uuid[])
          ORDER BY t.transitioned_at DESC LIMIT 200`,
        [[...bcIds, ...publicIds]]) : [],
    ]);
    const push = (source) => (e) => {
      const t = bucket(oppOfPurchase.get(e.source_id) || bcOpp.get(e.source_id));
      // El motivo solo sirve de título si es texto legible; los del Business Case son códigos internos.
      const title = /\s/.test(e.transition_reason || "") ? e.transition_reason : null;
      if (t) t.events.push({ at: e.transitioned_at, state: e.to_state, title, by: e.by_name || null, source });
    };
    privateEvents.forEach(push("private_purchase"));
    bcEvents.forEach((e) => push(bcOpp.has(e.source_id) ? "business_case" : "public_purchase")(e));
  }
  return byOpp;
};

// Recorrido resumido de varias oportunidades: { [opportunityId]: journey | null }.
const listJourneys = async ({ ids } = {}, user) => {
  const requested = uniq(String(ids || "").split(",").map((s) => s.trim())).filter((id) => UUID.test(id));
  if (!requested.length) return {};
  if (requested.length > MAX_IDS) throw fail(`Máximo ${MAX_IDS} oportunidades por consulta`);
  const allowed = await visibleIds(requested, user);
  if (!allowed.length) return {};
  const byOpp = await collect(allowed);
  const result = {};
  byOpp.forEach((sources, oppId) => {
    const journey = buildJourney(sources);
    if (journey) result[oppId] = journey;
  });
  return result;
};

// Recorrido completo de una oportunidad, con el historial de cambios de estado de sus expedientes.
const getJourney = async (opportunityId, user) => {
  if (!UUID.test(String(opportunityId))) throw fail("Oportunidad no válida");
  const allowed = await visibleIds([opportunityId], user);
  if (!allowed.length) throw fail("Oportunidad no encontrada", 404);
  const byOpp = await collect(allowed, { withEvents: true });
  const sources = byOpp.get(opportunityId);
  const journey = buildJourney(sources);
  if (!journey) return null;
  const events = [...sources.events].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 60);
  return { ...journey, events };
};

// Reclasifica las oportunidades abiertas cuya fase quedo por detras del avance real de su
// expediente (uso: script de backfill). Solo avanza, nunca retrocede ni cierra.
const reclassifyOpenOpportunities = async ({ dryRun = true } = {}) => {
  const normalize = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const [{ rows: opps }, { rows: stages }] = await Promise.all([
    db.query(`SELECT id, stage_id FROM crm.crm_opportunities WHERE status = 'open' AND deleted_at IS NULL`),
    db.query(`SELECT id, name, order_index FROM crm.crm_pipeline_stages WHERE is_active = true`),
  ]);
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const stageByName = new Map(stages.map((s) => [normalize(s.name), s]));
  const summary = { total: opps.length, withJourney: 0, moved: 0, moves: {}, dryRun };
  if (!opps.length) return summary;

  const byOpp = await collect(opps.map((o) => o.id));
  for (const opp of opps) {
    const journey = buildJourney(byOpp.get(opp.id));
    const key = stageForJourney(journey);
    if (!key) continue;
    summary.withJourney += 1;
    const target = STAGE_NAMES[key].map((name) => stageByName.get(normalize(name))).find(Boolean);
    const current = stageById.get(opp.stage_id) || null;
    if (!target || (current && Number(current.order_index) >= Number(target.order_index))) continue;
    const label = `${current ? current.name : "Sin fase"} → ${target.name}`;
    summary.moves[label] = (summary.moves[label] || 0) + 1;
    summary.moved += 1;
    if (!dryRun) await upsertOpportunityStage(opp.id, STAGE_NAMES[key], null);
  }
  return summary;
};

// Oportunidades abiertas cuyo unico expediente es un Business Case que quedo no factible: se cierran
// como perdidas (uso: script de backfill; los casos nuevos los cierra syncBusinessCaseNotFeasible).
const closeNotFeasibleOpportunities = async ({ dryRun = true } = {}) => {
  const { rows: opps } = await db.query(
    `SELECT id FROM crm.crm_opportunities WHERE status = 'open' AND deleted_at IS NULL`,
  );
  const summary = { reviewed: opps.length, closed: 0, dryRun };
  if (!opps.length) return summary;
  const byOpp = await collect(opps.map((o) => o.id));
  const ids = opps.map((o) => o.id).filter((id) => {
    const journey = buildJourney(byOpp.get(id));
    const feasibility = journey?.milestones.find((m) => m.key === "factibilidad");
    return journey?.reference?.type === "business_case" && feasibility?.state === "blocked";
  });
  summary.closed = ids.length;
  if (dryRun || !ids.length) return summary;
  await db.query(
    `UPDATE crm.crm_opportunities
        SET status = 'lost',
            lost_reason_detail = COALESCE(lost_reason_detail, 'Business Case no factible'),
            actual_close_date = COALESCE(actual_close_date, now()::date),
            updated_at = now()
      WHERE id = ANY($1::uuid[]) AND status = 'open'`,
    [ids],
  );
  return summary;
};

// Siguiente mejor acción: oportunidades abiertas del usuario (o del equipo, si es manager y lo
// pide) ordenadas por urgencia, con el motivo y la acción sugerida (crmNextActions.rules.js).
const listNextActions = async ({ scope, limit } = {}, user) => {
  const team = scope === "team" && MANAGER_ROLES.has(user.role);
  const params = [];
  let owner = "";
  if (!team) { params.push(user.id); owner = "AND o.owner_user_id = $1"; }
  const { rows } = await db.query(
    `SELECT o.id, o.name, o.account_id, a.account_name, o.estimated_amount, o.estimated_close_date,
            u.fullname AS owner_name, s.name AS stage_name, bs.status AS blue_sheet_status,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM now() - COALESCE((to_jsonb(o)->>'stage_entered_at')::timestamptz, o.updated_at, o.created_at)) / 86400))::int AS days_in_stage,
            (SELECT COUNT(*) FROM crm.crm_activities act WHERE act.opportunity_id = o.id AND act.status = 'scheduled')::int AS pending_activities
       FROM crm.crm_opportunities o
       LEFT JOIN crm.crm_accounts a ON a.id = o.account_id
       LEFT JOIN crm.crm_pipeline_stages s ON s.id = o.stage_id
       LEFT JOIN public.users u ON u.id = o.owner_user_id
       LEFT JOIN crm.crm_blue_sheets bs ON bs.opportunity_id = o.id
      WHERE o.status = 'open' AND o.deleted_at IS NULL ${owner}
      ORDER BY o.updated_at DESC
      LIMIT 500`,
    params,
  );
  if (!rows.length) return { scope: team ? "team" : "mine", total_open: 0, items: [] };
  const byOpp = await collect(rows.map((r) => r.id));
  const opportunities = rows.map((r) => ({ ...r, journey: buildJourney(byOpp.get(r.id)) }));
  const max = Math.min(Math.max(Number(limit) || 12, 1), 50);
  return { scope: team ? "team" : "mine", total_open: rows.length, items: rankNextActions(opportunities, { limit: max }) };
};

module.exports = { listJourneys, getJourney, reclassifyOpenOpportunities, listNextActions, closeNotFeasibleOpportunities };
