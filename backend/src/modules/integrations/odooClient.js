const crypto = require("crypto");
const https = require("https");
const axios = require("axios");
const logger = require("../../config/logger");
const {
  getOdooIntegrationConfig,
  isOdooIntegrationEnabled,
} = require("../../config/odooIntegration");
const { getContext } = require("../../utils/requestContext");

class IntegrationDisabledError extends Error {
  constructor(message = "Integracion Odoo deshabilitada por feature flag") {
    super(message);
    this.name = "IntegrationDisabledError";
    this.code = "ODOO_INTEGRATION_DISABLED";
    this.status = 503;
  }
}

class OdooClientError extends Error {
  constructor(
    message,
    {
      code = "ODOO_CLIENT_ERROR",
      status = 502,
      details = null,
      retryable = false,
    } = {},
  ) {
    super(message);
    this.name = "OdooClientError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    if (details) this.details = details;
  }
}

const asTrimmedText = (value, fallback = null) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

const resolveCorrelationId = (explicitCorrelationId) => {
  const explicit = asTrimmedText(explicitCorrelationId, null);
  if (explicit) return explicit;
  const contextCorrelation = asTrimmedText(getContext()?.correlationId, null);
  if (contextCorrelation) return contextCorrelation;
  return crypto.randomUUID();
};

const resolveEventType = ({ eventType, method }) => {
  return asTrimmedText(eventType, null) || asTrimmedText(method, "odoo.call");
};

const getAuthSecret = (config) => {
  return asTrimmedText(config.apiKey, null) || asTrimmedText(config.password, null);
};

const buildConfigError = (missingConfig) => {
  return new OdooClientError("Configuracion incompleta para cliente Odoo", {
    code: "ODOO_CONFIG_INVALID",
    status: 500,
    retryable: false,
    details: { missing_config: missingConfig },
  });
};

const buildTransportError = (error) => {
  const status = Number(error?.response?.status || 0) || 502;
  const responseData = error?.response?.data || null;
  const rpcError = responseData?.error || null;
  const normalizedMessage =
    asTrimmedText(rpcError?.message, null) ||
    asTrimmedText(error?.message, null) ||
    "Error invocando Odoo";

  return new OdooClientError(normalizedMessage, {
    code: status >= 500 ? "ODOO_TRANSPORT_ERROR" : "ODOO_REQUEST_REJECTED",
    status,
    retryable: status >= 500 || error?.code === "ECONNABORTED",
    details: {
      http_status: status,
      rpc_error_code: rpcError?.code || null,
      rpc_error_data: rpcError?.data || null,
    },
  });
};

const createHttpsAgent = (config) => {
  if (!config.allowInsecureTls) return undefined;
  if (!String(config.url || "").toLowerCase().startsWith("https://")) return undefined;
  return new https.Agent({ rejectUnauthorized: false });
};

const parseUid = (value) => {
  const normalized = asTrimmedText(value, null);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveAuthUser = async ({
  config,
  authSecret,
  endpoint,
  normalizedCorrelationId,
  normalizedEventType,
  httpsAgent,
}) => {
  const configuredUid = parseUid(config.user);
  if (configuredUid !== null) return configuredUid;

  const loginPayload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "login",
      args: [config.database, config.user, authSecret],
    },
    id: `${normalizedCorrelationId}:login`,
  };

  const loginResponse = await axios.post(endpoint, loginPayload, {
    timeout: config.timeoutMs,
    headers: {
      "content-type": "application/json",
      "x-correlation-id": normalizedCorrelationId,
      "x-event-type": `${normalizedEventType}.auth`,
    },
    httpsAgent,
    validateStatus: () => true,
  });

  if (loginResponse.status >= 400 || loginResponse.data?.error) {
    throw buildTransportError({
      response: loginResponse,
      message:
        loginResponse.data?.error?.message ||
        `HTTP ${loginResponse.status} durante autenticacion Odoo`,
    });
  }

  const uid = Number.parseInt(loginResponse.data?.result, 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new OdooClientError("Credenciales invalidas para autenticacion Odoo", {
      code: "ODOO_AUTH_FAILED",
      status: 401,
      retryable: false,
      details: { odoo_user: config.user },
    });
  }

  return uid;
};

const buildRpcArgs = ({
  normalizedMethod,
  config,
  authUser,
  authSecret,
  normalizedParams,
}) => {
  if (
    normalizedMethod === "execute_kw" &&
    normalizedParams &&
    typeof normalizedParams === "object" &&
    !Array.isArray(normalizedParams)
  ) {
    const model = asTrimmedText(normalizedParams.model, null);
    const modelMethod = asTrimmedText(normalizedParams.method, null);
    const methodArgs = Array.isArray(normalizedParams.args)
      ? normalizedParams.args
      : [];
    const methodKwargs =
      normalizedParams.kwargs &&
      typeof normalizedParams.kwargs === "object" &&
      !Array.isArray(normalizedParams.kwargs)
        ? normalizedParams.kwargs
        : null;

    if (model && modelMethod) {
      const rpcArgs = [
        config.database,
        authUser,
        authSecret,
        model,
        modelMethod,
        methodArgs,
      ];
      if (methodKwargs && Object.keys(methodKwargs).length) {
        rpcArgs.push(methodKwargs);
      }
      return rpcArgs;
    }
  }

  return [config.database, authUser, authSecret, normalizedParams];
};

async function callOdoo({
  method,
  params = {},
  correlationId = null,
  eventType = null,
} = {}) {
  const normalizedMethod = asTrimmedText(method, null);
  if (!normalizedMethod) {
    throw new OdooClientError("method es requerido", {
      code: "ODOO_METHOD_REQUIRED",
      status: 400,
      retryable: false,
    });
  }

  const normalizedParams =
    params && typeof params === "object" && !Array.isArray(params) ? params : {};
  const normalizedCorrelationId = resolveCorrelationId(correlationId);
  const normalizedEventType = resolveEventType({
    eventType,
    method: normalizedMethod,
  });
  const logBase = {
    correlation_id: normalizedCorrelationId,
    event_type: normalizedEventType,
    odoo_method: normalizedMethod,
  };

  if (!isOdooIntegrationEnabled()) {
    logger.warn(
      {
        ...logBase,
        result: "disabled",
      },
      "[ODOO_CLIENT] Llamada bloqueada por feature flag",
    );
    throw new IntegrationDisabledError();
  }

  const config = getOdooIntegrationConfig();
  const authSecret = getAuthSecret(config);
  const missingConfig = [];
  if (!config.url) missingConfig.push("ODOO_URL");
  if (!config.database) missingConfig.push("ODOO_DB");
  if (!config.user) missingConfig.push("ODOO_USER");
  if (!authSecret) missingConfig.push("ODOO_API_KEY_OR_PASSWORD");

  if (missingConfig.length) {
    logger.error(
      {
        ...logBase,
        result: "config_error",
        missing_config: missingConfig,
      },
      "[ODOO_CLIENT] Configuracion incompleta",
    );
    throw buildConfigError(missingConfig);
  }

  const startedAt = Date.now();
  const endpoint = `${config.url}/jsonrpc`;
  const httpsAgent = createHttpsAgent(config);
  const authUser = await resolveAuthUser({
    config,
    authSecret,
    endpoint,
    normalizedCorrelationId,
    normalizedEventType,
    httpsAgent,
  });
  const rpcPayload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: normalizedMethod,
      args: buildRpcArgs({
        normalizedMethod,
        config,
        authUser,
        authSecret,
        normalizedParams,
      }),
      kwargs: {
        context: {
          correlation_id: normalizedCorrelationId,
          event_type: normalizedEventType,
        },
      },
    },
    id: normalizedCorrelationId,
  };

  try {
    const response = await axios.post(endpoint, rpcPayload, {
      timeout: config.timeoutMs,
      headers: {
        "content-type": "application/json",
        "x-correlation-id": normalizedCorrelationId,
        "x-event-type": normalizedEventType,
      },
      httpsAgent,
      validateStatus: () => true,
    });

    const durationMs = Date.now() - startedAt;
    if (response.status >= 400 || response.data?.error) {
      const transportError = buildTransportError({
        response,
        message: response.data?.error?.message || `HTTP ${response.status} desde Odoo`,
      });
      logger.error(
        {
          ...logBase,
          duration_ms: durationMs,
          result: "error",
          http_status: response.status,
          error_code: transportError.code,
        },
        "[ODOO_CLIENT] Llamada rechazada",
      );
      throw transportError;
    }

    logger.info(
      {
        ...logBase,
        duration_ms: durationMs,
        result: "success",
        http_status: response.status,
      },
      "[ODOO_CLIENT] Llamada completada",
    );

    return response.data?.result;
  } catch (rawError) {
    if (rawError instanceof OdooClientError) {
      throw rawError;
    }

    const normalizedError = buildTransportError(rawError);
    logger.error(
      {
        ...logBase,
        duration_ms: Date.now() - startedAt,
        result: "error",
        http_status: rawError?.response?.status || null,
        error_code: normalizedError.code,
      },
      "[ODOO_CLIENT] Error de transporte",
    );
    throw normalizedError;
  }
}

module.exports = {
  IntegrationDisabledError,
  OdooClientError,
  callOdoo,
};
