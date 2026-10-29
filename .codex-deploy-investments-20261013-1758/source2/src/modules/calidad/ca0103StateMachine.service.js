/**
 * State Machine - CA-01-03 (Buenas Prácticas)
 * -------------------------------------------
 * Define los estados permitidos para tres flujos del epic:
 * - training
 * - exams
 * - certifications
 *
 * La matriz se mantiene inmutable para evitar mutaciones en runtime
 * y toda transicion ilegal falla con error 400 trazable.
 */

const FLOW_STATUS = Object.freeze({
  DRAFT: "draft",
  REVIEW: "review",
  APPROVED: "approved",
  ARCHIVED: "archived",
});

const FLOW_NAMES = Object.freeze({
  TRAINING: "training",
  EXAMS: "exams",
  CERTIFICATIONS: "certifications",
});

const INITIAL_STATUS = FLOW_STATUS.DRAFT;

const ALLOWED_TRANSITIONS = Object.freeze({
  [FLOW_NAMES.TRAINING]: Object.freeze({
    [FLOW_STATUS.DRAFT]: new Set([FLOW_STATUS.REVIEW, FLOW_STATUS.APPROVED]),
    [FLOW_STATUS.REVIEW]: new Set([FLOW_STATUS.APPROVED, FLOW_STATUS.DRAFT]),
    [FLOW_STATUS.APPROVED]: new Set([FLOW_STATUS.ARCHIVED]),
    [FLOW_STATUS.ARCHIVED]: new Set(),
  }),
  [FLOW_NAMES.EXAMS]: Object.freeze({
    [FLOW_STATUS.DRAFT]: new Set([FLOW_STATUS.REVIEW, FLOW_STATUS.APPROVED]),
    [FLOW_STATUS.REVIEW]: new Set([FLOW_STATUS.APPROVED, FLOW_STATUS.DRAFT]),
    [FLOW_STATUS.APPROVED]: new Set([FLOW_STATUS.ARCHIVED]),
    [FLOW_STATUS.ARCHIVED]: new Set(),
  }),
  [FLOW_NAMES.CERTIFICATIONS]: Object.freeze({
    [FLOW_STATUS.DRAFT]: new Set([FLOW_STATUS.REVIEW, FLOW_STATUS.APPROVED]),
    [FLOW_STATUS.REVIEW]: new Set([FLOW_STATUS.APPROVED, FLOW_STATUS.DRAFT]),
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
      `Transicion ilegal CA-01-03 (${flowName}): no se puede pasar de '${fromStatus}' a '${toStatus}'`,
    );
    error.status = 400;
    error.code = "CA0103_INVALID_TRANSITION";
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
