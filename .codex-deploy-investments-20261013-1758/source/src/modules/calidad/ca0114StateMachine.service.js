const FLOW_STATUS = Object.freeze({
  PENDING: "pending",
  QUALIFYING: "qualifying",
  QUALIFIED: "qualified",
  SUSPENDED: "suspended",
  REQUALIFICATION: "requalification",
  OPEN: "open",
  INVESTIGATING: "investigating",
  CLOSED: "closed"
});

const FLOW_NAMES = Object.freeze({
  AREA: "area",
  DEVIATION: "deviation"
});

const INITIAL_STATUS = FLOW_STATUS.PENDING;

const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.AREA]: Object.freeze({
    pending: new Set(["qualifying"]),
    qualifying: new Set(["qualified", "suspended"]),
    qualified: new Set(["requalification", "suspended"]),
    requalification: new Set(["qualifying"]),
    suspended: new Set(["qualifying"])
  }),
  [FLOW_NAMES.DEVIATION]: Object.freeze({
    open: new Set(["investigating"]),
    investigating: new Set(["closed"]),
    closed: new Set()
  })
});

const TERMINAL_STATUS = new Set(["qualified", "closed"]);

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
    const e = new Error(`Transición ilegal CA-01-14 (${flowName}): '${fromStatus}' → '${toStatus}'`);
    e.status = 400;
    e.code = "CA0114_INVALID_TRANSITION";
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