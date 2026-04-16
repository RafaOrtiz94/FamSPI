const FLOW_STATUS = Object.freeze({ OPEN: "open", INVESTIGATING: "investigating", ACTION_PLAN: "action_plan", IN_PROGRESS: "in_progress", COMPLETED: "completed", CLOSED: "closed", PENDING: "pending", OVERDUE: "overdue" });
const FLOW_NAMES = Object.freeze({ RCA: "rca", ACTION_PLAN: "action_plan", ESCALATION: "escalation", EFFECTIVENESS: "effectiveness" });
const INITIAL_STATUS = FLOW_STATUS.OPEN;
const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.RCA]: Object.freeze({ open: new Set(["investigating"]), investigating: new Set(["action_plan", "completed"]), action_plan: new Set(["in_progress"]), in_progress: new Set(["completed"]), completed: new Set(["closed"]), closed: new Set() }),
  [FLOW_NAMES.ACTION_PLAN]: Object.freeze({ pending: new Set(["in_progress"]), in_progress: new Set(["completed", "overdue"]), completed: new Set(), overdue: new Set() }),
  [FLOW_NAMES.ESCALATION]: Object.freeze({ pending: new Set(["resolved"]), resolved: new Set() }),
  [FLOW_NAMES.EFFECTIVENESS]: Object.freeze({}),
});
const TERMINAL_STATUS = new Set(["closed", "completed"]);
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
    const e = new Error(`Transición ilegal CA-01-09 (${flowName}): '${fromStatus}' → '${toStatus}'`);
    e.status = 400; e.code = "CA0109_INVALID_TRANSITION"; throw e;
  }
};
module.exports = { FLOW_STATUS, FLOW_NAMES, INITIAL_STATUS, ALLOWED_TRANSITIONS, TERMINAL_STATUS, normalizeStatus, normalizeFlowName, isValidTransition, assertTransition };