const FLOW_STATUS = Object.freeze({ ACTIVE: "active", MITIGATED: "mitigated", CLOSED: "closed", PENDING: "pending", IN_PROGRESS: "in_progress", COMPLETED: "completed", OVERDUE: "overdue", DRAFT: "draft", APPROVED: "approved", IMPLEMENTED: "implemented", SCHEDULED: "scheduled", CANCELLED: "cancelled" });
const FLOW_NAMES = Object.freeze({ FMEA: "fmea", MITIGATION: "mitigation", REVIEWS: "reviews", IMPACT: "impact" });
const INITIAL_STATUS = FLOW_STATUS.ACTIVE;
const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.FMEA]: Object.freeze({ active: new Set(["mitigated"]), mitigated: new Set(["closed"]), closed: new Set() }),
  [FLOW_NAMES.MITIGATION]: Object.freeze({ pending: new Set(["in_progress"]), in_progress: new Set(["completed", "overdue"]), completed: new Set(), overdue: new Set() }),
  [FLOW_NAMES.REVIEWS]: Object.freeze({ scheduled: new Set(["completed", "cancelled"]), completed: new Set(), cancelled: new Set() }),
  [FLOW_NAMES.IMPACT]: Object.freeze({ draft: new Set(["approved"]), approved: new Set(["implemented"]), implemented: new Set(["closed"]), closed: new Set() }),
});
const TERMINAL_STATUS = new Set(["closed", "completed", "cancelled"]);
const normalizeStatus = (v) => String(v || "").trim().toLowerCase();
const normalizeFlowName = (v) => String(v || "").trim().toLowerCase();
const isValidTransition = ({ flowName, fromStatus, toStatus }) => {
  const f = normalizeFlowName(flowName), from = normalizeStatus(fromStatus), to = normalizeStatus(toStatus);
  if (!f || !from || !to) return false;
  if (from === to) return true;
  const m = ALLOWED_TRANSITIONS[f];
  return m?.[from]?.has(to) || false;
};
const assertTransition = ({ flowName, fromStatus, toStatus }) => {
  if (!isValidTransition({ flowName, fromStatus, toStatus })) {
    const e = new Error(`Transición ilegal CA-01-10 (${flowName}): '${fromStatus}' → '${toStatus}'`);
    e.status = 400; e.code = "CA0110_INVALID_TRANSITION"; throw e;
  }
};
module.exports = { FLOW_STATUS, FLOW_NAMES, INITIAL_STATUS, ALLOWED_TRANSITIONS, TERMINAL_STATUS, normalizeStatus, normalizeFlowName, isValidTransition, assertTransition };