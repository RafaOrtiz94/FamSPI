const FLOW_STATUS = Object.freeze({ SUBMITTED: "submitted", ACKNOWLEDGED: "acknowledged", INVESTIGATING: "investigating", RESOLVED: "resolved", CLOSED: "closed" });
const FLOW_NAMES = Object.freeze({ INTAKE: "intake", INVESTIGATION: "investigation", REFUNDS: "refunds", CAPA: "capa" });
const INITIAL_STATUS = FLOW_STATUS.SUBMITTED;
const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.INTAKE]: Object.freeze({ submitted: new Set(["acknowledged"]), acknowledged: new Set(["investigating", "closed"]), investigating: new Set(["resolved", "closed"]), resolved: new Set(["closed"]), closed: new Set() }),
  [FLOW_NAMES.INVESTIGATION]: Object.freeze({ open: new Set(["in_progress"]), in_progress: new Set(["completed"]), completed: new Set() }),
  [FLOW_NAMES.REFUNDS]: Object.freeze({ pending: new Set(["approved", "rejected"]), approved: new Set(["processed"]), processed: new Set(), rejected: new Set() }),
  [FLOW_NAMES.CAPA]: Object.freeze({ open: new Set(["linked"]), linked: new Set(["completed"]), completed: new Set() }),
});
const TERMINAL_STATUS = new Set(["closed", "completed", "processed"]);
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
    const e = new Error(`Transición ilegal CA-01-07 (${flowName}): '${fromStatus}' → '${toStatus}'`);
    e.status = 400; e.code = "CA0107_INVALID_TRANSITION"; throw e;
  }
};
module.exports = { FLOW_STATUS, FLOW_NAMES, INITIAL_STATUS, ALLOWED_TRANSITIONS, TERMINAL_STATUS, normalizeStatus, normalizeFlowName, isValidTransition, assertTransition };