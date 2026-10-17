const FLOW_STATUS = Object.freeze({
  DRAFT: "draft",
  PENDING: "pending",
  APPROVED: "approved",
  PUBLISHED: "published",
  ARCHIVED: "archived",
  ACTIVE: "active",
  INACTIVE: "inactive"
});

const FLOW_NAMES = Object.freeze({
  COMMUNICATION: "communication",
  TEMPLATE: "template"
});

const INITIAL_STATUS = FLOW_STATUS.DRAFT;

const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.COMMUNICATION]: Object.freeze({
    draft: new Set(["pending"]),
    pending: new Set(["approved", "draft"]),
    approved: new Set(["published"]),
    published: new Set(["archived"]),
    archived: new Set()
  }),
  [FLOW_NAMES.TEMPLATE]: Object.freeze({
    inactive: new Set(["active"]),
    active: new Set(["inactive"]),
    inactive: new Set()
  })
});

const TERMINAL_STATUS = new Set(["archived", "inactive"]);

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
    const e = new Error(`Transición ilegal CA-01-13 (${flowName}): '${fromStatus}' → '${toStatus}'`);
    e.status = 400;
    e.code = "CA0113_INVALID_TRANSITION";
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