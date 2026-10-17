const STATE_MACHINE_VERSION = "1.0.0";

const WORKFLOW_STATE_MACHINES = Object.freeze({
  "ST-01-01": {
    procedure_code: "ST-01-01",
    procedure_name: "Instalacion, retiro, entrenamiento de equipo y software",
    version: STATE_MACHINE_VERSION,
    initial_state: "initiated",
    states: [
      "initiated",
      "fst20_requested",
      "fst20_scheduled",
      "fst07_recorded",
      "technical_documents_in_progress",
      "withdrawal_requested",
      "withdrawal_coordinated",
      "desinfection_completed",
      "packaging_completed",
      "withdrawal_executed",
      "completed",
      "blocked",
      "cancelled",
    ],
    transitions: {
      initiated: ["fst20_requested", "cancelled"],
      fst20_requested: ["fst20_scheduled", "blocked", "cancelled"],
      fst20_scheduled: ["fst07_recorded", "blocked", "cancelled"],
      fst07_recorded: ["technical_documents_in_progress", "blocked", "cancelled"],
      technical_documents_in_progress: [
        "withdrawal_requested",
        "completed",
        "blocked",
        "cancelled",
      ],
      withdrawal_requested: ["withdrawal_coordinated", "blocked", "cancelled"],
      withdrawal_coordinated: ["desinfection_completed", "blocked", "cancelled"],
      desinfection_completed: ["packaging_completed", "blocked", "cancelled"],
      packaging_completed: ["withdrawal_executed", "blocked", "cancelled"],
      withdrawal_executed: ["completed", "blocked", "cancelled"],
      blocked: [
        "fst20_requested",
        "fst20_scheduled",
        "fst07_recorded",
        "technical_documents_in_progress",
        "withdrawal_requested",
        "withdrawal_coordinated",
        "desinfection_completed",
        "packaging_completed",
        "withdrawal_executed",
        "cancelled",
      ],
      completed: [],
      cancelled: [],
    },
  },
  "ST-01-02": {
    procedure_code: "ST-01-02",
    procedure_name: "Planificacion y ejecucion de mantenimientos preventivos",
    version: STATE_MACHINE_VERSION,
    initial_state: "initiated",
    states: ["initiated", "planned", "scheduled", "executing", "completed", "blocked", "cancelled"],
    transitions: {
      initiated: ["planned", "cancelled"],
      planned: ["scheduled", "blocked", "cancelled"],
      scheduled: ["executing", "blocked", "cancelled"],
      executing: ["completed", "blocked", "cancelled"],
      blocked: ["planned", "scheduled", "executing", "cancelled"],
      completed: [],
      cancelled: [],
    },
  },
  "ST-01-03": {
    procedure_code: "ST-01-03",
    procedure_name: "Mantenimientos correctivos de equipos y software",
    version: STATE_MACHINE_VERSION,
    initial_state: "initiated",
    states: ["initiated", "triage", "scheduled", "executing", "completed", "blocked", "cancelled"],
    transitions: {
      initiated: ["triage", "cancelled"],
      triage: ["scheduled", "executing", "blocked", "cancelled"],
      scheduled: ["executing", "blocked", "cancelled"],
      executing: ["completed", "blocked", "cancelled"],
      blocked: ["triage", "scheduled", "executing", "cancelled"],
      completed: [],
      cancelled: [],
    },
  },
  "ST-01-04": {
    procedure_code: "ST-01-04",
    procedure_name: "Creacion de casos para reporte en plataformas externas",
    version: STATE_MACHINE_VERSION,
    initial_state: "initiated",
    states: ["initiated", "external_created", "dispatched", "executing", "completed", "blocked", "cancelled"],
    transitions: {
      initiated: ["external_created", "cancelled"],
      external_created: ["dispatched", "blocked", "cancelled"],
      dispatched: ["executing", "blocked", "cancelled"],
      executing: ["completed", "blocked", "cancelled"],
      blocked: ["external_created", "dispatched", "executing", "cancelled"],
      completed: [],
      cancelled: [],
    },
  },
});

const DOCUMENT_STAGE_MAP = Object.freeze({
  "F.ST-20": "fst20_requested",
  "F.ST-07": "fst07_recorded",
  "F.ST-02": "technical_documents_in_progress",
  "F.ST-04": "technical_documents_in_progress",
  "F.ST-05": "technical_documents_in_progress",
  "F.ST-09": "technical_documents_in_progress",
  "F.ST-10": "technical_documents_in_progress",
  "F.ST-11": "withdrawal_executed",
  "F.ST-12": "technical_documents_in_progress",
  "F.ST-14": "technical_documents_in_progress",
  "F.ST-16": "planned",
  "F.ST-17": "scheduled",
});

const normalizeProcedureCode = (value) => String(value || "").trim().toUpperCase();
const normalizeState = (value) => String(value || "").trim().toLowerCase();

const getStateMachine = (procedureCode = "ST-01-01") =>
  WORKFLOW_STATE_MACHINES[normalizeProcedureCode(procedureCode)] || null;

const getStateMachineCatalog = () => Object.values(WORKFLOW_STATE_MACHINES);

const resolveStageFromDocumentCode = (documentCode) => {
  const normalized = String(documentCode || "").trim().toUpperCase();
  return DOCUMENT_STAGE_MAP[normalized] || null;
};

const isValidTransition = ({ procedureCode = "ST-01-01", fromState, toState }) => {
  const machine = getStateMachine(procedureCode);
  if (!machine) return false;
  const normalizedFrom = normalizeState(fromState);
  const normalizedTo = normalizeState(toState);
  if (!normalizedFrom || !normalizedTo) return false;
  const allowed = machine.transitions[normalizedFrom];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(normalizedTo);
};

module.exports = {
  getStateMachine,
  getStateMachineCatalog,
  isValidTransition,
  resolveStageFromDocumentCode,
};
