const FLOW_STATUS = Object.freeze({ ACTIVE: "active", RESOLVED: "resolved", INVESTIGATED: "investigated", CALCULATED: "calculated", APPROVED: "approved", USED: "used", PENDING: "pending", IN_PROGRESS: "in_progress", COMPLETED: "completed", CANCELLED: "cancelled", PASSED: "passed", FAILED: "failed" });
const FLOW_NAMES = Object.freeze({ POWER_OUTAGE: "power_outage", DRY_ICE: "dry_ice", TRANSFER: "transfer", VALIDATION: "validation" });
const INITIAL_STATUS = FLOW_STATUS.ACTIVE;
const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.POWER_OUTAGE]: Object.freeze({ active: new Set(["resolved"]), resolved: new Set(["investigated"]), investigated: new Set() }),
  [FLOW_NAMES.DRY_ICE]: Object.freeze({ calculated: new Set(["approved"]), approved: new Set(["used"]), used: new Set() }),
  [FLOW_NAMES.TRANSFER]: Object.freeze({ pending: new Set(["in_progress"]), in_progress: new Set(["completed", "cancelled"]), completed: new Set(), cancelled: new Set() }),
  [FLOW_NAMES.VALIDATION]: Object.freeze({ pending: new Set(["passed", "failed"]), passed: new Set(), failed: new Set() }),
});
const TERMINAL_STATUS = new Set(["investigated", "used", "completed", "cancelled", "passed", "failed"]);
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
    const e = new Error(`Transición ilegal CA-01-08 (${flowName}): '${fromStatus}' → '${toStatus}'`);
    e.status = 400; e.code = "CA0108_INVALID_TRANSITION"; throw e;
  }
};
module.exports = { FLOW_STATUS, FLOW_NAMES, INITIAL_STATUS, ALLOWED_TRANSITIONS, TERMINAL_STATUS, normalizeStatus, normalizeFlowName, isValidTransition, assertTransition };