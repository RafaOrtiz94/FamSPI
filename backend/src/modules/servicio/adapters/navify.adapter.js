const PROVIDER_NAME = "navify";

const normalize = (value) => String(value || "").trim().toLowerCase();
const isTrue = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "si"].includes(normalize(value));
};

const CONTRACT_GAPS_BY_PROVIDER = Object.freeze({
  navify: [
    "endpoint oficial de creacion/actualizacion de casos",
    "esquema oficial de payload para alarma/tipo incidencia",
    "mecanismo de autenticacion aprobado (token/api key/oauth)",
    "catalogo oficial de estados remotos y transiciones",
    "contrato de adjuntos (imagenes/fotos) con limites y formatos",
  ],
  online_support: [
    "endpoint oficial de creacion/actualizacion de casos",
    "esquema oficial de payload para area/laboratorio/equipo",
    "mecanismo de autenticacion aprobado (token/api key/oauth)",
    "catalogo oficial de estados remotos y transiciones",
    "contrato de adjuntos (imagenes/fotos) con limites y formatos",
  ],
});

const buildError = (message, {
  code = "NAVIFY_ADAPTER_ERROR",
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

const buildMockCaseReference = ({ provider = PROVIDER_NAME, caseId }) => {
  const compactProvider = String(provider || PROVIDER_NAME).replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `${compactProvider}-${String(caseId || "").padStart(6, "0")}`;
};

const getMissingContractData = (provider = PROVIDER_NAME) => {
  const key = normalize(provider);
  return CONTRACT_GAPS_BY_PROVIDER[key] || CONTRACT_GAPS_BY_PROVIDER.navify;
};

const validateConfig = (config = {}) => {
  const provider = normalize(config.provider || PROVIDER_NAME) || PROVIDER_NAME;
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
    provider,
    enabled,
    contract_approved: contractApproved,
    mock_mode: mockMode,
    missing_config: missingConfig,
    missing_contract_data: contractApproved ? [] : getMissingContractData(provider),
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
    throw buildError(
      `Proveedor ${validation.provider} deshabilitado por feature flag`,
      { code: "NAVIFY_PROVIDER_DISABLED", retryable: false },
    );
  }
  if (!validation.contract_approved) {
    throw buildError(
      `Contrato externo de ${validation.provider} no aprobado`,
      {
        code: "NAVIFY_CONTRACT_MISSING",
        retryable: false,
        details: {
          missing_contract_data: validation.missing_contract_data,
        },
      },
    );
  }
  if (validation.missing_config.length > 0) {
    throw buildError(
      `Configuración incompleta de ${validation.provider}: ${validation.missing_config.join(", ")}`,
      {
        code: "NAVIFY_CONFIG_MISSING",
        retryable: false,
        details: { missing_config: validation.missing_config },
      },
    );
  }

  if (!validation.mock_mode) {
    throw buildError(
      `Adapter ${validation.provider} en modo stub: falta implementación HTTP oficial`,
      {
        code: "NAVIFY_STUB_ONLY",
        retryable: false,
      },
    );
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
    provider: validation.provider,
    provider_case_reference: buildMockCaseReference({
      provider: validation.provider,
      caseId: externalCase?.id,
    }),
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
