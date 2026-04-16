/**
 * State Machine - CA-01-05 (Gestión y Control de Documentos)
 * -------------------------------------------------
 * Define los estados permitidos para cuatro flujos del epic:
 * - versioning
 * - approval_flow
 * - pdf_stamp
 * - archiving
 *
 * La matriz se mantiene inmutable para evitar mutaciones en runtime
 * y toda transición ilegal falla con error 400 trazable.
 */

const FLOW_STATUS = Object.freeze({
  DRAFT: "draft",
  REVIEW: "review",
  APPROVED: "approved",
  ARCHIVED: "archived",
});

const FLOW_NAMES = Object.freeze({
  VERSIONING: "versioning",
  APPROVAL_FLOW: "approval_flow",
  PDF_STAMP: "pdf_stamp",
  ARCHIVING: "archiving",
});

const INITIAL_STATUS = FLOW_STATUS.DRAFT;

const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.VERSIONING]: Object.freeze({
    [FLOW_STATUS.DRAFT]: new Set([FLOW_STATUS.REVIEW, FLOW_STATUS.APPROVED]),
    [FLOW_STATUS.REVIEW]: new Set([FLOW_STATUS.APPROVED, FLOW_STATUS.DRAFT]),
    [FLOW_STATUS.APPROVED]: new Set([FLOW_STATUS.ARCHIVED]),
    [FLOW_STATUS.ARCHIVED]: new Set(),
  }),
  [FLOW_NAMES.APPROVAL_FLOW]: Object.freeze({
    [FLOW_STATUS.DRAFT]: new Set([FLOW_STATUS.REVIEW]),
    [FLOW_STATUS.REVIEW]: new Set([FLOW_STATUS.APPROVED, FLOW_STATUS.DRAFT]),
    [FLOW_STATUS.APPROVED]: new Set([FLOW_STATUS.ARCHIVED]),
    [FLOW_STATUS.ARCHIVED]: new Set(),
  }),
  [FLOW_NAMES.PDF_STAMP]: Object.freeze({
    [FLOW_STATUS.DRAFT]: new Set([FLOW_STATUS.REVIEW]),
    [FLOW_STATUS.REVIEW]: new Set([FLOW_STATUS.APPROVED, FLOW_STATUS.DRAFT]),
    [FLOW_STATUS.APPROVED]: new Set([FLOW_STATUS.ARCHIVED]),
    [FLOW_STATUS.ARCHIVED]: new Set(),
  }),
  [FLOW_NAMES.ARCHIVING]: Object.freeze({
    [FLOW_STATUS.DRAFT]: new Set([FLOW_STATUS.REVIEW]),
    [FLOW_STATUS.REVIEW]: new Set([FLOW_STATUS.APPROVED]),
    [FLOW_STATUS.APPROVED]: new Set([FLOW_STATUS.ARCHIVED]),
    [FLOW_STATUS.ARCHIVED]: new Set(),
  }),
});

const TERMINAL_STATUS = new Set([FLOW_STATUS.ARCHIVED]);

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
      `Transición ilegal CA-01-05 (${flowName}): no se puede pasar de '${fromStatus}' a '${toStatus}'`,
    );
    error.status = 400;
    error.code = "CA0105_INVALID_TRANSITION";
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