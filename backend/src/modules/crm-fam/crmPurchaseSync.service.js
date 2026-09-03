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
  CONTRACTS: ["Contratos"],
  CLOSED_WON: ["Cerrado Ganado"],
  CLOSED_LOST: ["Cerrado Perdido"],
  ARCHIVED: ["Archivado"],
});

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

async function upsertOpportunityStage(opportunityId, stageCandidates, actorUser, finalStatus = null) {
  if (!opportunityId) return null;
  const stageId = await resolveStageId(stageCandidates);
  if (!stageId) {
    logger.warn({ opportunityId, stageCandidates }, "No se encontro etapa CRM para sincronizacion");
    return null;
  }
  const params = [opportunityId, stageId, actorUser?.id || null];
  let statusSet = "";
  if (finalStatus) {
    params.push(finalStatus);
    statusSet = `, status = $${params.length}`;
  }
  const { rows } = await db.query(
    `UPDATE crm.crm_opportunities
        SET stage_id = $2,
            updated_by = $3,
            updated_at = now()
            ${statusSet}
      WHERE id = $1
      RETURNING *`,
    params,
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

async function updateBusinessCaseSync(businessCaseId, patch) {
  await db.query(
    `UPDATE public.equipment_purchase_requests
        SET modern_bc_metadata = COALESCE(modern_bc_metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
      WHERE id = $1`,
    [businessCaseId, JSON.stringify(patch)],
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
  const stageId = await resolveStageId(STAGE_NAMES.LEAD_QUALIFIED);
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
  const stageId = await resolveStageId(STAGE_NAMES.LEAD_QUALIFIED);
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

async function syncPublicPurchaseCreated(purchaseId, actorUser) {
  const { rows } = await db.query(
    `SELECT id, client_name, client_email, created_by, assigned_to, extra, opportunity_id
       FROM public.equipment_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [purchaseId],
  );
  if (!rows.length) return null;
  return ensurePublicOpportunity(rows[0], actorUser);
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
  return ensurePrivateOpportunity(rows[0], actorUser);
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
  await updateBusinessCaseSync(businessCaseId, patch);
  if (sourcePurchaseRequestId && opportunityId) {
    await updatePublicPurchaseSync(sourcePurchaseRequestId, patch, opportunityId);
  }
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
  syncPublicPurchaseCreated,
  syncPrivatePurchaseCreated,
  syncPublicPurchaseStage,
  syncPrivatePurchaseStage,
  syncBusinessCaseGeneralData,
  syncBusinessCaseFeasible,
  syncBusinessCaseOfferSent,
};
