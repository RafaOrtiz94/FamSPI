const db = require("../../config/db");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ALWAYS_ALLOWED_ACTIONS = new Set([
  "cancel",
  "cancel-order",
  "start-business-case",
]);

function toObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function buildGate(row) {
  if (!row) return null;

  const businessCaseId = row.business_case_id || null;
  const required = Boolean(row.requires_business_case || businessCaseId);
  if (!required) {
    return {
      required: false,
      open: true,
      status: "not_required",
      business_case_id: null,
      business_case_stage: null,
    };
  }

  if (!businessCaseId || !row.business_case_exists) {
    return {
      required: true,
      open: false,
      status: "link_missing",
      business_case_id: businessCaseId,
      business_case_stage: null,
    };
  }

  const metadata = toObject(row.modern_bc_metadata);
  const feasibility = toObject(metadata.feasibility);
  const decision = toObject(feasibility.decision);
  const stage = String(row.business_case_stage || "").trim().toLowerCase();
  const explicitlyFeasible = decision.is_feasible === true || feasibility.status === "factible";
  const open = stage === "factible" && explicitlyFeasible;
  const rejected = stage === "cerrado_no_factible" || decision.is_feasible === false;

  return {
    required: true,
    open,
    status: open ? "approved" : rejected ? "rejected" : "pending",
    business_case_id: businessCaseId,
    business_case_stage: row.business_case_stage || null,
    decided_at: decision.decided_at || null,
    decided_by_email: decision.decided_by_email || null,
  };
}

async function getPurchaseBusinessCaseGate({ purchaseId, type }) {
  const privatePurchase = type === "private";
  const query = privatePurchase
    ? `SELECT purchase.id,
              purchase.business_case_id,
              (purchase.offer_kind = 'comodato') AS requires_business_case,
              (bc.id IS NOT NULL AND COALESCE(bc.request_type, 'purchase') = 'business_case') AS business_case_exists,
              bc.bc_stage AS business_case_stage,
              bc.modern_bc_metadata
         FROM private_purchase_requests purchase
         LEFT JOIN equipment_purchase_requests bc ON bc.id = purchase.business_case_id
        WHERE purchase.id = $1
        LIMIT 1`
    : `SELECT purchase.id,
              COALESCE(purchase.business_case_id, bc_json.id) AS business_case_id,
              (COALESCE(purchase.requires_business_case, FALSE)
                OR purchase.business_case_id IS NOT NULL
                OR bc_json.id IS NOT NULL) AS requires_business_case,
              (COALESCE(bc.id, bc_json.id) IS NOT NULL) AS business_case_exists,
              COALESCE(bc.bc_stage, bc_json.bc_stage) AS business_case_stage,
              COALESCE(bc.modern_bc_metadata, bc_json.modern_bc_metadata) AS modern_bc_metadata
         FROM equipment_purchase_requests purchase
         LEFT JOIN equipment_purchase_requests bc
           ON bc.id = purchase.business_case_id
          AND COALESCE(bc.request_type, 'purchase') = 'business_case'
         LEFT JOIN equipment_purchase_requests bc_json
           ON bc_json.id::text = purchase.extra->>'business_case_id'
          AND COALESCE(bc_json.request_type, 'purchase') = 'business_case'
        WHERE purchase.id = $1
          AND COALESCE(purchase.request_type, 'purchase') = 'purchase'
        LIMIT 1`;

  const { rows } = await db.query(query, [purchaseId]);
  return buildGate(rows[0] || null);
}

// El expediente de compras es el modulo padre: mientras el BC se desarrolla, todo el flujo
// (disponibilidad, inspeccion, oferta, etc.) puede continuar. La factibilidad solo bloquea el
// tab Contrato: submit-contract, upload-contract, contract/* y provider-contract/*.
const CONTRACT_ACTION_RE = /\/(submit-contract|upload-contract|contract|provider-contract)(\/|$)/;

function isContractAction(req) {
  const path = String(req.originalUrl || req.url || "").split("?")[0];
  return CONTRACT_ACTION_RE.test(path);
}

function getActionName(req) {
  const segments = String(req.originalUrl || req.url || "")
    .split("?")[0]
    .split("/")
    .filter(Boolean);
  return segments[segments.length - 1] || "";
}

function requirePurchaseBusinessCaseGate(type) {
  return async (req, res, next) => {
    try {
      if (SAFE_METHODS.has(String(req.method || "").toUpperCase())) return next();
      if (ALWAYS_ALLOWED_ACTIONS.has(getActionName(req))) return next();

      const gate = await getPurchaseBusinessCaseGate({ purchaseId: req.params.id, type });
      // Factibilidad pendiente o vinculo faltante: solo se bloquea el contrato.
      // Un BC rechazado (no factible) mantiene cerrado todo el flujo operativo.
      if (!gate || gate.open || (gate.status !== "rejected" && !isContractAction(req))) {
        req.businessCaseGate = gate;
        return next();
      }

      return res.status(409).json({
        ok: false,
        code: gate.status === "rejected" ? "BUSINESS_CASE_REJECTED" : "BUSINESS_CASE_REQUIRED",
        message:
          gate.status === "rejected"
            ? "El Business Case fue declarado no factible. El flujo operativo de compras permanece cerrado."
            : "El contrato se habilita cuando el Business Case sea aprobado como factible.",
        business_case_gate: gate,
      });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  isContractAction,
  buildGate,
  getPurchaseBusinessCaseGate,
  requirePurchaseBusinessCaseGate,
};
