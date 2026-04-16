/**
 * State Machine - CA-01-06 (Retiro del Mercado/Recall)
 * -------------------------------------------------
 * Define los estados permitidos para cuatro flujos del epic:
 * - traceability
 * - communication
 * - quarantine
 * - logistics
 *
 * La matriz se mantiene inmutable para evitar mutaciones en runtime.
 */

const FLOW_STATUS = Object.freeze({
  DRAFT: "draft",
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CLOSED: "closed",
  CANCELLED: "cancelled",
});

const FLOW_NAMES = Object.freeze({
  TRACEABILITY: "traceability",
  COMMUNICATION: "communication",
  QUARANTINE: "quarantine",
  LOGISTICS: "logistics",
});

const INITIAL_STATUS = FLOW_STATUS.PENDING;

const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.TRACEABILITY]: Object.freeze({
    active: new Set(["quarantine", "recalled"]),
    quarantine: new Set(["recalled", "closed"]),
    recalled: new Set(["closed"]),
    closed: new Set(),
  }),
  [FLOW_NAMES.COMMUNICATION]: Object.freeze({
    draft: new Set(["sent", "cancelled"]),
    sent: new Set(["cancelled"]),
    cancelled: new Set(),
  }),
  [FLOW_NAMES.QUARANTINE]: Object.freeze({
    pending: new Set(["approved", "released", "destroyed"]),
    approved: new Set(["released", "destroyed"]),
    released: new Set(["destroyed"]),
    destroyed: new Set(),
  }),
  [FLOW_NAMES.LOGISTICS]: Object.freeze({
    pending: new Set(["in_transit", "cancelled"]),
    in_transit: new Set(["completed", "cancelled"]),
    completed: new Set(),
    cancelled: new Set(),
  }),
});

const TERMINAL_STATUS = new Set(["closed", "cancelled", "completed", "destroyed"]);

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const normalizeFlowName = (value) => String(value || "").trim().toLowerCase();

const isValidTransition = ({ flowName, fromStatus, toStatus }) => {
  const flow = normalizeFlowName(flowName);
  const from = normalizeStatus(fromStatus);
  const to = normalizeStatus(toStatus);

  if (!flow || !from || !to) {
    return false;
  }

  if (from === to) {
    return true;
  }

  const matrix = ALLOWED_TRANSITIONS[flow];
  if (!matrix) {
    return false;
  }

  const allowed = matrix[from];
  if (!allowed) {
    return false;
  }

  return allowed.has(to);
};

const assertTransition = ({ flowName, fromStatus, toStatus }) => {
  if (!isValidTransition({ flowName, fromStatus, toStatus })) {
    const error = new Error(
      `Transición ilegal CA-01-06 (${flowName}): no se puede pasar de '${fromStatus}' a '${toStatus}'`,
    );
    error.status = 400;
    error.code = "CA0106_INVALID_TRANSITION";
    throw error;
  }
};

module.exports = {
  FLOW_STATUS,
  FLOW_NAMES,
  INITIAL_STATUS,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATUS,
  normalizeStatus,
  normalizeFlowName,
  isValidTransition,
  assertTransition,
};