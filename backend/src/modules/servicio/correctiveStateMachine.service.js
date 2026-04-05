const CASE_STATUS = Object.freeze({
  CEAC_RECEIVED: "ceac_received",
  CEAC_DIAGNOSIS: "ceac_diagnosis",
  ESCALATED_DISPATCH: "escalated_dispatch",
  VISIT_SCHEDULED: "visit_scheduled",
  VISIT_IN_PROGRESS: "visit_in_progress",
  CLASSIFIED_APPLICATIONS: "classified_applications",
  CLASSIFIED_ENGINEERING: "classified_engineering",
  CLASSIFIED_PROVIDER: "classified_provider",
  PARTS_PENDING_QUOTE: "parts_pending_quote",
  PARTS_PENDING_CLIENT_APPROVAL: "parts_pending_client_approval",
  PARTS_APPROVED: "parts_approved",
  PARTS_REJECTED: "parts_rejected",
  REVISIT_SCHEDULED: "revisit_scheduled",
  PART_REPLACED: "part_replaced",
  PENDING_DISINFECTION: "pending_disinfection",
  RESOLVED_REMOTE: "resolved_remote",
  CLOSED: "closed",
  CANCELLED: "cancelled",
});

const INITIAL_STATUS = CASE_STATUS.CEAC_RECEIVED;

const ALLOWED_TRANSITIONS = Object.freeze({
  [CASE_STATUS.CEAC_RECEIVED]: new Set([
    CASE_STATUS.CEAC_DIAGNOSIS,
    CASE_STATUS.ESCALATED_DISPATCH,
    CASE_STATUS.RESOLVED_REMOTE,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.CEAC_DIAGNOSIS]: new Set([
    CASE_STATUS.ESCALATED_DISPATCH,
    CASE_STATUS.RESOLVED_REMOTE,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.ESCALATED_DISPATCH]: new Set([
    CASE_STATUS.VISIT_SCHEDULED,
    CASE_STATUS.CLASSIFIED_APPLICATIONS,
    CASE_STATUS.CLASSIFIED_ENGINEERING,
    CASE_STATUS.CLASSIFIED_PROVIDER,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.VISIT_SCHEDULED]: new Set([
    CASE_STATUS.VISIT_IN_PROGRESS,
    CASE_STATUS.CLASSIFIED_APPLICATIONS,
    CASE_STATUS.CLASSIFIED_ENGINEERING,
    CASE_STATUS.CLASSIFIED_PROVIDER,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.VISIT_IN_PROGRESS]: new Set([
    CASE_STATUS.PARTS_PENDING_QUOTE,
    CASE_STATUS.PARTS_APPROVED,
    CASE_STATUS.CLOSED,
    CASE_STATUS.PENDING_DISINFECTION,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.CLASSIFIED_APPLICATIONS]: new Set([
    CASE_STATUS.VISIT_SCHEDULED,
    CASE_STATUS.VISIT_IN_PROGRESS,
    CASE_STATUS.PARTS_PENDING_QUOTE,
    CASE_STATUS.PARTS_APPROVED,
    CASE_STATUS.CLOSED,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.CLASSIFIED_ENGINEERING]: new Set([
    CASE_STATUS.VISIT_SCHEDULED,
    CASE_STATUS.VISIT_IN_PROGRESS,
    CASE_STATUS.PARTS_PENDING_QUOTE,
    CASE_STATUS.PARTS_APPROVED,
    CASE_STATUS.CLOSED,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.CLASSIFIED_PROVIDER]: new Set([
    CASE_STATUS.VISIT_SCHEDULED,
    CASE_STATUS.VISIT_IN_PROGRESS,
    CASE_STATUS.PARTS_PENDING_QUOTE,
    CASE_STATUS.PARTS_APPROVED,
    CASE_STATUS.CLOSED,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.PARTS_PENDING_QUOTE]: new Set([
    CASE_STATUS.PARTS_PENDING_CLIENT_APPROVAL,
    CASE_STATUS.PARTS_REJECTED,
    CASE_STATUS.PARTS_APPROVED,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.PARTS_PENDING_CLIENT_APPROVAL]: new Set([
    CASE_STATUS.PARTS_APPROVED,
    CASE_STATUS.PARTS_REJECTED,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.PARTS_APPROVED]: new Set([
    CASE_STATUS.REVISIT_SCHEDULED,
    CASE_STATUS.PART_REPLACED,
    CASE_STATUS.PENDING_DISINFECTION,
    CASE_STATUS.CLOSED,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.PARTS_REJECTED]: new Set([CASE_STATUS.CLOSED, CASE_STATUS.CANCELLED]),
  [CASE_STATUS.REVISIT_SCHEDULED]: new Set([
    CASE_STATUS.VISIT_IN_PROGRESS,
    CASE_STATUS.PART_REPLACED,
    CASE_STATUS.PENDING_DISINFECTION,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.PART_REPLACED]: new Set([
    CASE_STATUS.PENDING_DISINFECTION,
    CASE_STATUS.CLOSED,
    CASE_STATUS.CANCELLED,
  ]),
  [CASE_STATUS.PENDING_DISINFECTION]: new Set([CASE_STATUS.PART_REPLACED, CASE_STATUS.CLOSED, CASE_STATUS.CANCELLED]),
  [CASE_STATUS.RESOLVED_REMOTE]: new Set([CASE_STATUS.CLOSED, CASE_STATUS.CANCELLED]),
  [CASE_STATUS.CLOSED]: new Set(),
  [CASE_STATUS.CANCELLED]: new Set(),
});

const TERMINAL_STATUS = new Set([CASE_STATUS.CLOSED, CASE_STATUS.CANCELLED]);

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const statusFromClassification = (classification) => {
  const normalized = String(classification || "").trim().toLowerCase();
  if (normalized === "aplicaciones" || normalized === "applications") {
    return CASE_STATUS.CLASSIFIED_APPLICATIONS;
  }
  if (normalized === "ingenieria" || normalized === "engineering") {
    return CASE_STATUS.CLASSIFIED_ENGINEERING;
  }
  if (normalized === "software_lis" || normalized === "lis" || normalized === "software") {
    return CASE_STATUS.CLASSIFIED_PROVIDER;
  }
  return null;
};

const isValidTransition = ({ fromStatus, toStatus }) => {
  const from = normalizeStatus(fromStatus);
  const to = normalizeStatus(toStatus);
  if (!from || !to) return false;
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.has(to);
};

const assertTransition = ({ fromStatus, toStatus }) => {
  if (!isValidTransition({ fromStatus, toStatus })) {
    const error = new Error(`Transición inválida de estado correctivo: ${fromStatus} -> ${toStatus}`);
    error.status = 400;
    error.code = "CORRECTIVE_CASE_INVALID_TRANSITION";
    throw error;
  }
};

module.exports = {
  CASE_STATUS,
  INITIAL_STATUS,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATUS,
  normalizeStatus,
  statusFromClassification,
  isValidTransition,
  assertTransition,
};
