const db = require("../../config/db");
const logger = require("../../config/logger");
const equipmentPurchasesService = require("../equipment-purchases/equipmentPurchases.service");
const { PrivatePurchaseStateMachine } = require("../private-purchases/privatePurchaseStateMachine");
const { PRIVATE_PURCHASE_STATES } = require("../private-purchases/privatePurchaseStates.constants");

const PRIVATE_BC_TYPES = new Set(["private_comodato", "comodato_privado"]);
const PUBLIC_BC_TYPES = new Set(["public", "comodato_publico"]);

function toObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}

function isAcpCommercial(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
  return roles.some((role) => String(role || "").trim().toLowerCase() === "acp_comercial");
}

async function getBusinessCaseContext(businessCaseId) {
  const { rows } = await db.query(
    `SELECT id,
            client_id,
            client_name,
            created_by,
            bc_purchase_type,
            extra,
            modern_bc_metadata
       FROM equipment_purchase_requests
      WHERE id = $1
        AND COALESCE(request_type, 'purchase') = 'business_case'
      LIMIT 1`,
    [businessCaseId],
  );
  return rows[0] || null;
}

async function getBusinessCaseEquipment(businessCaseId, metadata = {}) {
  const { rows } = await db.query(
    `SELECT selection.equipment_id AS id,
            equipment.nombre AS name,
            equipment.code AS sku,
            equipment.fabricante AS maker,
            equipment.modelo AS model,
            COALESCE(selection.quantity, 1) AS quantity
       FROM bc_equipment_selection selection
       JOIN servicio.equipos equipment ON equipment.id_equipo = selection.equipment_id
      WHERE selection.business_case_id = $1
      ORDER BY selection.is_primary DESC, selection.id ASC`,
    [businessCaseId],
  );
  const selected = rows.map((row) => ({
    id: row.id,
    name: row.name || "Equipo",
    sku: row.sku || null,
    maker: row.maker || null,
    model: row.model || null,
    quantity: Number(row.quantity) || 1,
    type: "new_available",
  }));
  const selectedIds = new Set(selected.map((item) => Number(item.id)));
  const detailIds = (Array.isArray(metadata.equipment_details) ? metadata.equipment_details : [])
    .map((detail) => Number(detail?.primary_id))
    .filter((id) => Number.isInteger(id) && id > 0 && !selectedIds.has(id));
  if (!detailIds.length) return selected;

  const { rows: additionalRows } = await db.query(
    `SELECT id_equipo AS id, nombre AS name, code AS sku, fabricante AS maker, modelo AS model
       FROM servicio.equipos
      WHERE id_equipo = ANY($1::int[])
      ORDER BY id_equipo`,
    [detailIds],
  );
  return [...selected, ...additionalRows.map((row) => ({
    id: row.id,
    name: row.name || "Equipo",
    sku: row.sku || null,
    maker: row.maker || null,
    model: row.model || null,
    quantity: 1,
    type: "new_available",
  }))];
}

async function syncLinkedPurchaseEquipment({ type, purchaseId, equipment }) {
  const table = type === "private" ? "private_purchase_requests" : "equipment_purchase_requests";
  await db.query(
    `UPDATE ${table}
        SET equipment = $2::jsonb,
            updated_at = NOW()
      WHERE id = $1`,
    [purchaseId, JSON.stringify(equipment)],
  );
}

async function persistHandoffMetadata({ businessCaseId, metadata, type, purchaseId, user }) {
  const nextMetadata = {
    ...metadata,
    private_purchase_id: type === "private" ? purchaseId : metadata.private_purchase_id || null,
    preflow_process_id: purchaseId,
    preflow_process_type: type === "private" ? "private_comodato" : "public_purchase",
    purchase_workspace: {
      type,
      purchase_id: purchaseId,
      handed_off_at: new Date().toISOString(),
      handed_off_by: user?.id || null,
      handed_off_by_email: user?.email || null,
    },
  };

  await db.query(
    `UPDATE equipment_purchase_requests
        SET modern_bc_metadata = $2::jsonb,
            updated_at = NOW()
      WHERE id = $1`,
    [businessCaseId, JSON.stringify(nextMetadata)],
  );
}

async function findLinkedPurchase(businessCaseId, type) {
  if (type === "private") {
    const { rows } = await db.query(
      `SELECT id
         FROM private_purchase_requests
        WHERE business_case_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [businessCaseId],
    );
    return rows[0]?.id || null;
  }

  const { rows } = await db.query(
    `SELECT id
       FROM equipment_purchase_requests
      WHERE business_case_id = $1
        AND COALESCE(request_type, 'purchase') <> 'business_case'
      ORDER BY created_at DESC
      LIMIT 1`,
    [businessCaseId],
  );
  return rows[0]?.id || null;
}

async function createPrivatePurchase({ businessCase, equipment, user }) {
  // privatePurchasesService also imports businessCase.service. Resolve it only
  // after the BC module has finished loading to avoid a circular partial export.
  const privatePurchasesService = require("../private-purchases/privatePurchases.service");
  const created = await privatePurchasesService.createPurchaseRequest({
    user,
    clientData: {
      name: businessCase.client_name || "Cliente",
      commercial_name: businessCase.client_name || "Cliente",
      client_identifier: businessCase.client_id ? String(businessCase.client_id) : null,
    },
    equipment,
    offerKind: "comodato",
    notes: `Expediente generado desde Business Case ${businessCase.id} factible.`,
    businessCaseId: businessCase.id,
  });
  const purchaseId = created?.id;
  if (!purchaseId) throw new Error("La compra privada creada desde el BC no tiene identificador");

  const reason = `Business Case ${businessCase.id} factible: handoff a compras privadas`;
  const metadata = {
    source: "business_case.feasibility",
    businessCaseId: businessCase.id,
    user_email: user?.email || null,
  };
  await PrivatePurchaseStateMachine.transition(
    purchaseId,
    PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS,
    Number(user?.id) || -1,
    reason,
    metadata,
  );
  await PrivatePurchaseStateMachine.transition(
    purchaseId,
    PRIVATE_PURCHASE_STATES.BUSINESS_CASE_UNDER_REVIEW,
    Number(user?.id) || -1,
    reason,
    metadata,
  );
  await PrivatePurchaseStateMachine.transition(
    purchaseId,
    PRIVATE_PURCHASE_STATES.BUSINESS_CASE_FEASIBILITY_APPROVED,
    Number(user?.id) || -1,
    reason,
    metadata,
  );
  return purchaseId;
}

async function createPublicPurchase({ businessCase, equipment, user }) {
  const created = await equipmentPurchasesService.createPurchaseRequest({
    user,
    clientId: businessCase.client_id || null,
    clientName: businessCase.client_name || "Cliente",
    assignedTo: user?.id,
    equipment,
    notes: `Expediente generado desde Business Case ${businessCase.id} factible.`,
    extra: {
      source: "business_case.feasibility",
      business_case_id: businessCase.id,
    },
  });
  const purchaseId = created?.id;
  if (!purchaseId) throw new Error("La compra publica creada desde el BC no tiene identificador");

  await db.query(
    `UPDATE equipment_purchase_requests
        SET business_case_id = $1,
            updated_at = NOW()
      WHERE id = $2`,
    [businessCase.id, purchaseId],
  );
  return purchaseId;
}

async function ensurePurchaseWorkspaceForFeasibleBusinessCase({ businessCaseId, user }) {
  if (!isAcpCommercial(user)) return { created: false, skipped: "DECISION_NOT_BY_ACP" };

  const businessCase = await getBusinessCaseContext(businessCaseId);
  if (!businessCase) throw new Error("Business Case moderno no encontrado para crear expediente de compras");

  const purchaseType = String(businessCase.bc_purchase_type || "").trim().toLowerCase();
  const type = PRIVATE_BC_TYPES.has(purchaseType) ? "private" : PUBLIC_BC_TYPES.has(purchaseType) ? "public" : null;
  if (!type) return { created: false, skipped: "UNSUPPORTED_BC_PURCHASE_TYPE" };

  const metadata = toObject(businessCase.modern_bc_metadata);
  const equipmentSource = {
    ...toObject(businessCase.extra),
    ...metadata,
  };
  const equipment = await getBusinessCaseEquipment(businessCaseId, equipmentSource);
  if (!equipment.length) throw new Error("El Business Case factible no tiene equipos para crear el expediente de compras");

  const existingPurchaseId = await findLinkedPurchase(businessCaseId, type);
  if (existingPurchaseId) {
    await syncLinkedPurchaseEquipment({ type, purchaseId: existingPurchaseId, equipment });
    await persistHandoffMetadata({ businessCaseId, metadata, type, purchaseId: existingPurchaseId, user });
    return { created: false, type, purchase_id: existingPurchaseId };
  }

  const purchaseId = type === "private"
    ? await createPrivatePurchase({ businessCase, equipment, user })
    : await createPublicPurchase({ businessCase, equipment, user });

  await persistHandoffMetadata({ businessCaseId, metadata, type, purchaseId, user });
  logger.info({ businessCaseId, purchaseId, type, userId: user?.id }, "Expediente de compras creado desde BC factible");
  return { created: true, type, purchase_id: purchaseId };
}

module.exports = { ensurePurchaseWorkspaceForFeasibleBusinessCase };
