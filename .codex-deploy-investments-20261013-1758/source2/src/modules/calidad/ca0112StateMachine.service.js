const FLOW_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  VERIFIED: "verified",
  APPROVED: "approved",
  CONDITIONALLY_APPROVED: "conditionally_approved",
  FAILED: "failed",
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed"
});

const FLOW_NAMES = Object.freeze({
  EVALUATION: "evaluation",
  NON_COMPLIANCE: "non_compliance",
  TRAINING: "training"
});

const INITIAL_STATUS = FLOW_STATUS.PENDING;

const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.EVALUATION]: Object.freeze({
    pending: new Set(["completed"]),
    completed: new Set(["verified"]),
    verified: new Set()
  }),
  [FLOW_NAMES.NON_COMPLIANCE]: Object.freeze({
    open: new Set(["in_progress"]),
    in_progress: new Set(["resolved"]),
    resolved: new Set(["closed"]),
    closed: new Set()
  }),
  [FLOW_NAMES.TRAINING]: Object.freeze({
    pending: new Set(["passed", "failed"]),
    passed: new Set(),
    failed: new Set()
  })
});

const TERMINAL_STATUS = new Set(["verified", "closed", "passed", "failed"]);

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
    const e = new Error(`Transición ilegal CA-01-12 (${flowName}): '${fromStatus}' → '${toStatus}'`);
    e.status = 400;
    e.code = "CA0112_INVALID_TRANSITION";
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