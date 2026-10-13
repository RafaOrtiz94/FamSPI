const db = require("../../config/db");
const logger = require("../../config/logger");

// ponytail: los nombres reales sembrados en migrations/242_crm_embudo_ventas_8_fases.sql
// no coincidian con estas constantes (faltaba "Análisis de la oportunidad", "Desarrollo
// de la oferta", "Presentación de la oferta") -- resolveStageId no encontraba ninguna
// etapa y las sincronizaciones fallaban en silencio. Se agregan como candidatos extra.
const STAGE_NAMES = Object.freeze({
  LEAD_QUALIFIED: ["Lead Calificado"],
  NEEDS_ANALYSIS: ["Analisis de Necesidades", "Análisis de Necesidades", "Análisis de la oportunidad"],
  OFFER_DEVELOPMENT: ["Desarrollo de Oferta", "Desarrollo de la oferta"],
  PROPOSAL_PRESENTATION: ["Presentacion de Propuesta", "Presentación de Propuesta", "Presentación de la oferta"],
  NEGOTIATION: ["Negociacion", "Negociación"],
  ACCEPTANCE: ["Aceptacion o rechazo", "Aceptación o rechazo"],
  CONTRACTS: ["Contratos"],
  CLOSED_WON: ["Cerrado Ganado"],
  CLOSED_LOST: ["Cerrado Perdido"],
  ARCHIVED: ["Archivado"],
});

// "Lead Calificado" dejo de ser una fase activa (migracion 242): un expediente nuevo entra por la
// primera fase real del embudo para que su tarjeta no quede en "Sin fase".
const ENTRY_STAGE = [...STAGE_NAMES.LEAD_QUALIFIED, ...STAGE_NAMES.NEEDS_ANALYSIS];

let linkColumnsReady = false;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function splitFullName(fullName) {
  const clean = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!clean) return { first_name: "Cliente", last_name: null };
  const parts = clean.split(" ");
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts[parts.length - 1] || null,
  };
}

async function ensureLinkColumns() {
  if (linkColumnsReady) return;
  await db.query(`
    ALTER TABLE public.equipment_purchase_requests
      ADD COLUMN IF NOT EXISTS opportunity_id UUID
  `);
  await db.query(`
    ALTER TABLE public.private_purchase_requests
      ADD COLUMN IF NOT EXISTS opportunity_id UUID
  `);
  linkColumnsReady = true;
}

async function nextCode(table, codeColumn, prefix) {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(${codeColumn}, '-', 4) AS integer)), 0) + 1 AS next_seq
       FROM ${table}
      WHERE ${codeColumn} LIKE $1`,
    [pattern],
  );
  const seq = Number(rows[0]?.next_seq || 1);
  return `${prefix}-${year}-${String(seq).padStart(6, "0")}`;
}

async function resolveStageId(candidates = []) {
  const { rows } = await db.query(
    `SELECT id, name
       FROM crm.crm_pipeline_stages
      WHERE is_active = true`,
  );
  if (!rows.length) return null;
  const wanted = new Set(candidates.map((name) => normalizeText(name)));
  const match = rows.find((row) => wanted.has(normalizeText(row.name)));
  return match?.id || null;
}

async function createQualifiedLead({ clientName, clientEmail, ownerUserId, source, city, estimatedValue, interestDescription }, actorUser) {
  const { first_name, last_name } = splitFullName(clientName);
  const leadCode = await nextCode("crm.crm_leads", "lead_code", "CRM-LEAD");
  const { rows } = await db.query(
    `INSERT INTO crm.crm_leads
       (lead_code, first_name, last_name, company_name, email, source, status, interest_description, estimated_value, owner_user_id, city, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,'qualified',$7,$8,$9,$10,$11,$11)
     RETURNING *`,
    [
      leadCode,
      first_name,
      last_name,
      clientName || null,
      clientEmail || null,
      source || null,
      interestDescription || null,
      estimatedValue || null,
      ownerUserId || actorUser?.id || null,
      city || null,
      actorUser?.id || null,
    ],
  );
  return rows[0];
}

async function createOpportunityFromLead({ leadId, ownerUserId, name, source, estimatedAmount, estimatedCloseDate, stageId }, actorUser) {
  const opportunityCode = await nextCode("crm.crm_opportunities", "opportunity_code", "CRM-OPP");
  const { rows } = await db.query(
    `INSERT INTO crm.crm_opportunities
       (opportunity_code, name, stage_id, status, estimated_amount, currency, estimated_close_date, requires_blue_sheet, owner_user_id, source, lead_id, created_by, updated_by)
     VALUES ($1,$2,$3,'open',$4,'USD',$5,false,$6,$7,$8,$9,$9)
     RETURNING *`,
    [
      opportunityCode,
      name,
      stageId,
      estimatedAmount || null,
      estimatedCloseDate || null,
      ownerUserId || actorUser?.id || null,
      source || null,
      leadId,
      actorUser?.id || null,
    ],
  );
  return rows[0];
}

// Mueve la oportunidad a la fase que corresponde al avance del expediente y, si el expediente
// termino, la cierra (finalStatus: won | lost | suspended).
//  - Solo avanza: un evento atrasado del expediente no devuelve la tarjeta a una fase anterior.
//  - El cierre no depende de la fase: "Cerrado Ganado/Perdido/Archivado" ya no son fases activas
//    (migracion 242), asi que el estado se aplica aunque esa fase no exista.
//  - Una oportunidad ya cerrada (won/lost/cancelled) no se toca.
async function upsertOpportunityStage(opportunityId, stageCandidates, actorUser, finalStatus = null) {
  if (!opportunityId) return null;
  const stageId = await resolveStageId(stageCandidates);
  if (!stageId && !finalStatus) {
    logger.warn({ opportunityId, stageCandidates }, "No se encontro etapa CRM para sincronizacion");
    return null;
  }
  const { rows } = await db.query(
    `UPDATE crm.crm_opportunities o
        SET stage_id = CASE
              WHEN $2::uuid IS NULL THEN o.stage_id
              WHEN o.stage_id IS NULL THEN $2::uuid
              WHEN (SELECT n.order_index FROM crm.crm_pipeline_stages n WHERE n.id = $2::uuid)
                   >= COALESCE((SELECT c.order_index FROM crm.crm_pipeline_stages c WHERE c.id = o.stage_id AND c.is_active), 0)
                THEN $2::uuid
              ELSE o.stage_id
            END,
            status = COALESCE($4::text, o.status),
            won_amount = CASE WHEN $4::text = 'won' THEN COALESCE(o.won_amount, o.estimated_amount) ELSE o.won_amount END,
            actual_close_date = CASE WHEN $4::text IN ('won', 'lost') THEN COALESCE(o.actual_close_date, now()::date) ELSE o.actual_close_date END,
            updated_by = COALESCE($3::int, o.updated_by),
            updated_at = now()
      WHERE o.id = $1
        AND o.deleted_at IS NULL
        AND o.status NOT IN ('won', 'lost', 'cancelled')
      RETURNING *`,
    [opportunityId, stageId, actorUser?.id || null, finalStatus],
  );
  return rows[0] || null;
}

function buildCrmSyncPatch({ leadId, opportunityId, source, syncedFrom }) {
  return {
    crm_sync: {
      lead_id: leadId || null,
      opportunity_id: opportunityId || null,
      source: source || null,
      synced_from: syncedFrom || null,
      synced_at: new Date().toISOString(),
    },
  };
}

async function updatePublicPurchaseSync(purchaseId, patch, opportunityId = null) {
  await db.query(
    `UPDATE public.equipment_purchase_requests
        SET extra = COALESCE(extra, '{}'::jsonb) || $2::jsonb,
            opportunity_id = COALESCE($3, opportunity_id),
            updated_at = now()
      WHERE id = $1`,
    [purchaseId, JSON.stringify(patch), opportunityId],
  );
}

async function updatePrivatePurchaseSync(purchaseId, patch, opportunityId = null) {
  await db.query(
    `UPDATE public.private_purchase_requests
        SET extra = COALESCE(extra, '{}'::jsonb) || $2::jsonb,
            opportunity_id = COALESCE($3, opportunity_id),
            updated_at = now()
      WHERE id = $1`,
    [purchaseId, JSON.stringify(patch), opportunityId],
  );
}

// El vinculo va tambien en la columna opportunity_id, igual que en las compras: sin ella la
// tarjeta del embudo no encontraba el Business Case de su oportunidad.
async function updateBusinessCaseSync(businessCaseId, patch, opportunityId = null) {
  await db.query(
    `UPDATE public.equipment_purchase_requests
        SET modern_bc_metadata = COALESCE(modern_bc_metadata, '{}'::jsonb) || $2::jsonb,
            opportunity_id = COALESCE($3, opportunity_id),
            updated_at = now()
      WHERE id = $1`,
    [businessCaseId, JSON.stringify(patch), opportunityId],
  );
}

async function ensurePublicOpportunity(purchaseRow, actorUser) {
  await ensureLinkColumns();
  const extra = purchaseRow?.extra || {};
  const sync = extra?.crm_sync || {};
  const existingOpportunityId = purchaseRow?.opportunity_id || sync?.opportunity_id || null;
  const existingLeadId = sync?.lead_id || null;
  if (existingOpportunityId) {
    return { leadId: existingLeadId, opportunityId: existingOpportunityId };
  }
  const clientName = purchaseRow?.client_name || null;
  if (!clientName) return { leadId: null, opportunityId: null };
  const lead = existingLeadId
    ? { id: existingLeadId }
    : await createQualifiedLead({
      clientName,
      clientEmail: purchaseRow?.client_email || null,
      ownerUserId: purchaseRow?.assigned_to || purchaseRow?.created_by || actorUser?.id || null,
      source: "public_purchase",
      interestDescription: `Compra publica ${purchaseRow?.id || ""}`.trim(),
    }, actorUser);
  const stageId = await resolveStageId(ENTRY_STAGE);
  const opportunity = await createOpportunityFromLead({
    leadId: lead.id,
    ownerUserId: purchaseRow?.assigned_to || purchaseRow?.created_by || actorUser?.id || null,
    name: `Compra publica - ${clientName}`,
    source: "public_purchase",
    stageId,
  }, actorUser);
  const patch = buildCrmSyncPatch({
    leadId: lead.id,
    opportunityId: opportunity.id,
    source: "public_purchase",
    syncedFrom: "equipment_purchase_requests",
  });
  await updatePublicPurchaseSync(purchaseRow.id, patch, opportunity.id);
  return { leadId: lead.id, opportunityId: opportunity.id };
}

async function ensurePrivateOpportunity(purchaseRow, actorUser) {
  await ensureLinkColumns();
  const extra = purchaseRow?.extra || {};
  const sync = extra?.crm_sync || {};
  const existingOpportunityId = purchaseRow?.opportunity_id || sync?.opportunity_id || null;
  const existingLeadId = sync?.lead_id || null;
  if (existingOpportunityId) {
    return { leadId: existingLeadId, opportunityId: existingOpportunityId };
  }
  const snapshot = purchaseRow?.client_snapshot || {};
  const clientName = snapshot.commercial_name || snapshot.name || snapshot.client_name || null;
  if (!clientName) return { leadId: null, opportunityId: null };
  const lead = existingLeadId
    ? { id: existingLeadId }
    : await createQualifiedLead({
      clientName,
      clientEmail: snapshot.email || snapshot.client_email || null,
      ownerUserId: purchaseRow?.created_by || actorUser?.id || null,
      source: "private_purchase",
      interestDescription: `Compra privada ${purchaseRow?.id || ""}`.trim(),
    }, actorUser);
  const stageId = await resolveStageId(ENTRY_STAGE);
  const opportunity = await createOpportunityFromLead({
    leadId: lead.id,
    ownerUserId: purchaseRow?.created_by || actorUser?.id || null,
    name: `Compra privada - ${clientName}`,
    source: "private_purchase",
    stageId,
  }, actorUser);
  const patch = buildCrmSyncPatch({
    leadId: lead.id,
    opportunityId: opportunity.id,
    source: "private_purchase",
    syncedFrom: "private_purchase_requests",
  });
  await updatePrivatePurchaseSync(purchaseRow.id, patch, opportunity.id);
  return { leadId: lead.id, opportunityId: opportunity.id };
}

// ─── Cuenta de la oportunidad ────────────────────────────────────────────────
// Una oportunidad nacida de una compra o de un Business Case se creaba sin cuenta, asi que en el
// embudo no mostraba clasificacion ni contactos. Aqui se enlaza con la cuenta CRM del cliente del
// expediente, buscandola por RUC/cedula y creandola si aun no existe. Sin identificacion no se
// crea nada (evita cuentas duplicadas por nombre): la tarjeta ofrece "Vincular cuenta".
const CLIENT_ID_PATTERN = /^[A-Za-z0-9-]{5,20}$/;
const cleanClientId = (value) => {
  const id = String(value || "").replace(/\s+/g, "").trim();
  return CLIENT_ID_PATTERN.test(id) ? id : null;
};

async function findOpportunityClient(opportunityId) {
  await ensureLinkColumns();
  const { rows: privateRows } = await db.query(
    `SELECT client_snapshot
       FROM public.private_purchase_requests
      WHERE opportunity_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [opportunityId],
  );
  // El registro de clientes vive en public.client_requests: a su id apuntan tanto client_id de
  // equipment_purchase_requests como client_snapshot.id de la compra privada.
  const fromRegistry = (client, fallbackName = null) => {
    const ruc = cleanClientId(client?.ruc_cedula);
    if (!ruc) return null;
    const person = [client.natural_person_firstname, client.natural_person_lastname].filter(Boolean).join(" ");
    return {
      ruc,
      name: client.commercial_name || client.legal_person_business_name || person || fallbackName,
      legalName: client.legal_person_business_name || person || null,
      email: client.client_email || null,
      phone: client.establishment_phone || client.establishment_cellphone || null,
      city: client.establishment_city || null,
      province: client.establishment_province || null,
      address: client.establishment_address || null,
    };
  };

  const snapshot = privateRows[0]?.client_snapshot || {};
  const snapshotName = snapshot.commercial_name || snapshot.name || snapshot.client_name || null;
  if (/^\d+$/.test(String(snapshot.id || ""))) {
    const { rows } = await db.query(`SELECT to_jsonb(c) AS client FROM public.client_requests c WHERE c.id = $1`, [Number(snapshot.id)]);
    const client = fromRegistry(rows[0]?.client, snapshotName);
    if (client) return client;
  }
  // Sin registro: solo se confia en el identificador si el expediente dice que es RUC o cedula.
  const snapshotId = snapshot.identifier_type ? cleanClientId(snapshot.client_identifier) : null;
  if (snapshotId && snapshotId.length >= 10) {
    return { ruc: snapshotId, name: snapshotName, legalName: snapshot.name || null, email: snapshot.client_email || snapshot.email || null };
  }

  // Compra publica o Business Case.
  const { rows: clientRows } = await db.query(
    `SELECT to_jsonb(c) AS client, e.client_name
       FROM public.equipment_purchase_requests e
       JOIN public.client_requests c ON c.id = e.client_id
      WHERE e.opportunity_id = $1
         OR e.modern_bc_metadata->'crm_sync'->>'opportunity_id' = $2
         OR e.extra->'crm_sync'->>'opportunity_id' = $2
      ORDER BY e.updated_at DESC
      LIMIT 1`,
    [opportunityId, String(opportunityId)],
  );
  return fromRegistry(clientRows[0]?.client, clientRows[0]?.client_name || null);
}

// Idempotente y sin efectos sobre el flujo de compras: si algo falla, solo se registra.
async function linkOpportunityAccount(opportunityId, actorUser, { dryRun = false } = {}) {
  if (!opportunityId) return null;
  try {
    const { rows: oppRows } = await db.query(
      `SELECT id, account_id, owner_user_id FROM crm.crm_opportunities WHERE id = $1 AND deleted_at IS NULL`,
      [opportunityId],
    );
    const opp = oppRows[0];
    if (!opp) return null;
    if (opp.account_id) return { accountId: opp.account_id, action: "kept" };

    const client = await findOpportunityClient(opportunityId);
    if (!client?.ruc || !client.name) return null;

    const { rows: existing } = await db.query(
      `SELECT id FROM crm.crm_accounts WHERE ruc = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
      [client.ruc],
    );
    if (dryRun) return { accountId: existing[0]?.id || null, action: existing.length ? "linked" : "created" };

    let accountId = existing[0]?.id || null;
    const action = accountId ? "linked" : "created";
    if (!accountId) {
      const actorId = actorUser?.id || opp.owner_user_id || null;
      const { rows: created } = await db.query(
        `INSERT INTO crm.crm_accounts
           (account_name, legal_name, ruc, province, city, address, phone, email, status, visibility, owner_user_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active','company',$9,$10,$10)
         RETURNING id`,
        [
          String(client.name).slice(0, 255),
          client.legalName ? String(client.legalName).slice(0, 255) : null,
          client.ruc,
          client.province || null,
          client.city || null,
          client.address || null,
          client.phone || null,
          client.email || null,
          opp.owner_user_id || actorId,
          actorId,
        ],
      );
      accountId = created[0].id;
    }
    await db.query(
      `UPDATE crm.crm_opportunities SET account_id = $2 WHERE id = $1 AND account_id IS NULL`,
      [opportunityId, accountId],
    );
    return { accountId, action };
  } catch (err) {
    logger.warn({ err: err.message, opportunityId }, "No se pudo enlazar la cuenta de la oportunidad");
    return null;
  }
}

// Enlaza la cuenta de las oportunidades abiertas que no la tienen (uso: script de backfill).
async function backfillOpportunityAccounts({ dryRun = true } = {}) {
  const { rows } = await db.query(
    `SELECT id FROM crm.crm_opportunities WHERE account_id IS NULL AND deleted_at IS NULL ORDER BY created_at ASC`,
  );
  const summary = { total: rows.length, linked: 0, created: 0, skipped: 0, dryRun };
  const seenNew = new Set();
  for (const { id } of rows) {
    const result = await linkOpportunityAccount(id, null, { dryRun });
    if (!result) { summary.skipped += 1; continue; }
    if (result.action === "created" && dryRun) {
      // En simulacion, dos oportunidades del mismo cliente crearian una sola cuenta.
      const client = await findOpportunityClient(id);
      if (seenNew.has(client.ruc)) { summary.linked += 1; continue; }
      seenNew.add(client.ruc);
    }
    summary[result.action === "created" ? "created" : "linked"] += 1;
  }
  return summary;
}

async function syncPublicPurchaseCreated(purchaseId, actorUser) {
  const { rows } = await db.query(
    `SELECT id, client_name, client_email, created_by, assigned_to, extra, opportunity_id
       FROM public.equipment_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [purchaseId],
  );
  if (!rows.length) return null;
  const result = await ensurePublicOpportunity(rows[0], actorUser);
  await linkOpportunityAccount(result?.opportunityId, actorUser);
  return result;
}

async function syncPrivatePurchaseCreated(purchaseId, actorUser) {
  const { rows } = await db.query(
    `SELECT id, client_snapshot, created_by, extra, opportunity_id
       FROM public.private_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [purchaseId],
  );
  if (!rows.length) return null;
  const result = await ensurePrivateOpportunity(rows[0], actorUser);
  await linkOpportunityAccount(result?.opportunityId, actorUser);
  return result;
}

async function syncPublicPurchaseStage(purchaseId, stageCandidates, actorUser, finalStatus = null) {
  const { rows } = await db.query(
    `SELECT id, client_name, client_email, created_by, assigned_to, extra, opportunity_id
       FROM public.equipment_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [purchaseId],
  );
  if (!rows.length) return null;
  const { opportunityId } = await ensurePublicOpportunity(rows[0], actorUser);
  await linkOpportunityAccount(opportunityId, actorUser);
  return upsertOpportunityStage(opportunityId, stageCandidates, actorUser, finalStatus);
}

async function syncPrivatePurchaseStage(purchaseId, stageCandidates, actorUser, finalStatus = null) {
  const { rows } = await db.query(
    `SELECT id, client_snapshot, created_by, extra, opportunity_id
       FROM public.private_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [purchaseId],
  );
  if (!rows.length) return null;
  const { opportunityId } = await ensurePrivateOpportunity(rows[0], actorUser);
  await linkOpportunityAccount(opportunityId, actorUser);
  return upsertOpportunityStage(opportunityId, stageCandidates, actorUser, finalStatus);
}

async function syncBusinessCaseGeneralData(businessCaseId, actorUser) {
  await ensureLinkColumns();
  const { rows } = await db.query(
    `SELECT id, client_name, client_id, assigned_to_email, assigned_to_name, created_by, created_by_email,
            opportunity_id, modern_bc_metadata, extra
       FROM public.equipment_purchase_requests
      WHERE id = $1
        AND COALESCE(request_type, 'purchase') = 'business_case'
      LIMIT 1`,
    [businessCaseId],
  );
  if (!rows.length) return null;

  const bc = rows[0];
  const metadata = bc.modern_bc_metadata || {};
  const generalData = metadata.general_data && typeof metadata.general_data === "object"
    ? metadata.general_data
    : {};
  const sourcePurchaseRequestId = metadata.source_purchase_request_id || null;

  const clientName =
    generalData.client_name ||
    generalData.commercial_name ||
    generalData.nombre_cliente ||
    bc.client_name ||
    null;
  if (!clientName) return null;

  let purchaseOpportunityId = null;
  let purchaseLeadId = null;
  if (sourcePurchaseRequestId) {
    const { rows: purchaseRows } = await db.query(
      `SELECT id, client_name, client_email, created_by, assigned_to, extra, opportunity_id
         FROM public.equipment_purchase_requests
        WHERE id = $1
        LIMIT 1`,
      [sourcePurchaseRequestId],
    );
    if (purchaseRows.length) {
      const syncResult = await ensurePublicOpportunity(purchaseRows[0], actorUser);
      purchaseOpportunityId = syncResult?.opportunityId || null;
      purchaseLeadId = syncResult?.leadId || null;
    }
  }

  const sync = metadata.crm_sync || {};
  let leadId = purchaseLeadId || sync.lead_id || null;
  let opportunityId = purchaseOpportunityId || bc.opportunity_id || sync.opportunity_id || null;

  if (!leadId && !opportunityId) {
    const lead = await createQualifiedLead({
      clientName,
      clientEmail: generalData.client_email || generalData.email || null,
      ownerUserId: bc.created_by || actorUser?.id || null,
      source: "business_case",
      city: generalData.city || generalData.ciudad || null,
      interestDescription: `Business case ${businessCaseId}`,
    }, actorUser);
    leadId = lead.id;
  }

  if (!opportunityId && leadId) {
    // Un BC con datos iniciales ya arranca en "Analisis de la oportunidad"
    // (no en Lead Calificado): a diferencia de un lead crudo, un BC ya trae
    // cliente + equipo definidos.
    const stageId = await resolveStageId(STAGE_NAMES.NEEDS_ANALYSIS);
    const opportunity = await createOpportunityFromLead({
      leadId,
      ownerUserId: bc.created_by || actorUser?.id || null,
      name: `Business Case - ${clientName}`,
      source: "business_case",
      stageId,
    }, actorUser);
    opportunityId = opportunity.id;
  }

  const patch = buildCrmSyncPatch({
    leadId,
    opportunityId,
    source: "business_case",
    syncedFrom: "business_case_general",
  });
  await updateBusinessCaseSync(businessCaseId, patch, opportunityId);
  if (sourcePurchaseRequestId && opportunityId) {
    await updatePublicPurchaseSync(sourcePurchaseRequestId, patch, opportunityId);
  }
  await linkOpportunityAccount(opportunityId, actorUser);
  return { leadId, opportunityId };
}

// BC declarado factible -> mueve la oportunidad a "Desarrollo de la oferta".
// Asegura el vinculo BC<->oportunidad primero (reutiliza syncBusinessCaseGeneralData,
// que es idempotente: si ya existe opportunity_id no crea nada nuevo).
async function syncBusinessCaseFeasible(businessCaseId, actorUser) {
  const linked = await syncBusinessCaseGeneralData(businessCaseId, actorUser);
  if (!linked?.opportunityId) return null;
  return upsertOpportunityStage(linked.opportunityId, STAGE_NAMES.OFFER_DEVELOPMENT, actorUser);
}

// Oferta publicada/enviada -> mueve la oportunidad a "Presentacion de la oferta".
async function syncBusinessCaseOfferSent(businessCaseId, actorUser) {
  const linked = await syncBusinessCaseGeneralData(businessCaseId, actorUser);
  if (!linked?.opportunityId) return null;
  return upsertOpportunityStage(linked.opportunityId, STAGE_NAMES.PROPOSAL_PRESENTATION, actorUser);
}

module.exports = {
  STAGE_NAMES,
  ensureLinkColumns,
  upsertOpportunityStage,
  linkOpportunityAccount,
  backfillOpportunityAccounts,
  syncPublicPurchaseCreated,
  syncPrivatePurchaseCreated,
  syncPublicPurchaseStage,
  syncPrivatePurchaseStage,
  syncBusinessCaseGeneralData,
  syncBusinessCaseFeasible,
  syncBusinessCaseOfferSent,
};
