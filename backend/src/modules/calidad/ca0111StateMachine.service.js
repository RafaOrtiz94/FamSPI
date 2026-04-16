const FLOW_STATUS = Object.freeze({
  REPORTED: "reported",
  CONTAINED: "contained",
  INVESTIGATING: "investigating",
  RESOLVED: "resolved",
  CLOSED: "closed",
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  VERIFIED: "verified",
  CANCELLED: "cancelled"
});

const FLOW_NAMES = Object.freeze({
  INCIDENT: "incident",
  CONTAINMENT: "containment",
  CLEANUP: "cleanup"
});

const INITIAL_STATUS = FLOW_STATUS.REPORTED;

const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.INCIDENT]: Object.freeze({
    reported: new Set(["contained"]),
    contained: new Set(["investigating"]),
    investigating: new Set(["resolved"]),
    resolved: new Set(["closed"]),
    closed: new Set()
  }),
  [FLOW_NAMES.CONTAINMENT]: Object.freeze({
    pending: new Set(["in_progress"]),
    in_progress: new Set(["completed"]),
    completed: new Set(["verified"]),
    verified: new Set(),
    cancelled: new Set()
  }),
  [FLOW_NAMES.CLEANUP]: Object.freeze({
    pending: new Set(["in_progress"]),
    in_progress: new Set(["completed"]),
    completed: new Set(["verified"]),
    verified: new Set(),
    cancelled: new Set()
  })
});

const TERMINAL_STATUS = new Set(["closed", "verified", "cancelled"]);

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
    const e = new Error(`Transición ilegal CA-01-11 (${flowName}): '${fromStatus}' → '${toStatus}'`);
    e.status = 400;
    e.code = "CA0111_INVALID_TRANSITION";
    throw e;
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
  assertTransition
};