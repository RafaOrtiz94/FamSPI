const PROVIDER_NAME = "rexis";

const normalize = (value) => String(value || "").trim().toLowerCase();
const isTrue = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "si"].includes(normalize(value));
};

const MISSING_CONTRACT_DATA = Object.freeze([
  "endpoint oficial para creacion de caso REXIS",
  "schema oficial para serie/equipo/alarma/tipo de problema",
  "mecanismo de autenticacion y rotacion de credenciales",
  "mapeo oficial de estados REXIS <-> estado interno",
  "contrato oficial para carga de evidencias/fotografias",
]);

const buildError = (message, {
  code = "REXIS_ADAPTER_ERROR",
  status = 409,
  retryable = false,
  details = null,
} = {}) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.retryable = retryable;
  if (details) error.details = details;
  return error;
};

const buildMockCaseReference = (caseId) => `REX-${String(caseId || "").padStart(6, "0")}`;

const getMissingContractData = () => MISSING_CONTRACT_DATA.slice();

const validateConfig = (config = {}) => {
  const enabled = isTrue(config.enabled, false);
  const contractApproved = isTrue(config.contract_approved, false);
  const mockMode = isTrue(config.mock_mode, false);
  const missingConfig = [];
  if (enabled && contractApproved && !String(config.base_url || "").trim() && !mockMode) {
    missingConfig.push("base_url");
  }
  if (enabled && contractApproved && !String(config.auth_token || config.api_key || "").trim() && !mockMode) {
    missingConfig.push("auth_token/api_key");
  }
  return {
    provider: PROVIDER_NAME,
    enabled,
    contract_approved: contractApproved,
    mock_mode: mockMode,
    missing_config: missingConfig,
    missing_contract_data: contractApproved ? [] : getMissingContractData(),
  };
};

const getHealth = (config = {}) => {
  const validation = validateConfig(config);
  if (!validation.enabled) {
    return {
      ...validation,
      status: "disabled",
      adapter_mode: validation.mock_mode ? "mock" : "stub",
    };
  }
  if (!validation.contract_approved) {
    return {
      ...validation,
      status: "blocked_contract",
      adapter_mode: "stub",
    };
  }
  if (validation.missing_config.length > 0) {
    return {
      ...validation,
      status: "degraded",
      adapter_mode: validation.mock_mode ? "mock" : "stub",
    };
  }
  return {
    ...validation,
    status: validation.mock_mode ? "healthy_mock" : "stub_ready",
    adapter_mode: validation.mock_mode ? "mock" : "stub",
  };
};

const syncCase = async ({
  externalCase,
  operation = "sync_case",
  payload = {},
  config = {},
} = {}) => {
  const validation = validateConfig(config);
  if (!validation.enabled) {
    throw buildError("Proveedor REXIS deshabilitado", {
      code: "REXIS_PROVIDER_DISABLED",
      retryable: false,
    });
  }
  if (!validation.contract_approved) {
    throw buildError("Contrato REXIS no aprobado", {
      code: "REXIS_CONTRACT_MISSING",
      retryable: false,
      details: { missing_contract_data: validation.missing_contract_data },
    });
  }
  if (validation.missing_config.length > 0) {
    throw buildError(`Configuración REXIS incompleta: ${validation.missing_config.join(", ")}`, {
      code: "REXIS_CONFIG_MISSING",
      retryable: false,
      details: { missing_config: validation.missing_config },
    });
  }
  if (!validation.mock_mode) {
    throw buildError("Adapter REXIS en stub sin implementación HTTP oficial", {
      code: "REXIS_STUB_ONLY",
      retryable: false,
    });
  }

  const externalStatus =
    operation === "create_case"
      ? "external_created"
      : operation === "escalate_dispatch"
        ? "dispatched"
        : operation === "finalize_work_order"
          ? "completed"
          : "in_progress";

  return {
    ok: true,
    provider: PROVIDER_NAME,
    provider_case_reference: buildMockCaseReference(externalCase?.id),
    external_status: externalStatus,
    operation,
    echoed_payload: payload || {},
    synced_at: new Date().toISOString(),
  };
};

module.exports = {
  PROVIDER_NAME,
  getMissingContractData,
  validateConfig,
  getHealth,
  syncCase,
};
