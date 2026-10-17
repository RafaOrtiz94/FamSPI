const db = require("../../config/db");

const CACHE_TTL_MS = 60 * 1000;
let dependencyCache = {
  checkedAt: 0,
  status: null,
};

const FUNCTION_LOOKUP = `
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = $1
  ) AS exists
`;

async function resolveDependencyStatus(client = db) {
  const [sealGenerator, qrTracker, verificationView] = await Promise.all([
    client.query(FUNCTION_LOOKUP, ["create_document_seal_and_qr"]),
    client.query(FUNCTION_LOOKUP, ["track_qr_access"]),
    client.query("SELECT to_regclass($1)::text AS relation_name", [
      "public.document_verification_info",
    ]),
  ]);

  return {
    sealGenerator: Boolean(sealGenerator.rows[0]?.exists),
    qrTracker: Boolean(qrTracker.rows[0]?.exists),
    verificationView: Boolean(verificationView.rows[0]?.relation_name),
  };
}

async function getSignatureDependencyStatus({ client, force = false } = {}) {
  if (client) {
    return resolveDependencyStatus(client);
  }

  const now = Date.now();
  if (!force && dependencyCache.status && now - dependencyCache.checkedAt < CACHE_TTL_MS) {
    return dependencyCache.status;
  }

  const status = await resolveDependencyStatus(db);
  dependencyCache = {
    checkedAt: now,
    status,
  };

  return status;
}

async function assertSignatureDependencies(required = [], options = {}) {
  const status = await getSignatureDependencyStatus(options);
  const missing = required.filter((key) => !status[key]);

  if (missing.length) {
    const labels = {
      sealGenerator: "create_document_seal_and_qr()",
      qrTracker: "track_qr_access()",
      verificationView: "document_verification_info",
    };
    const error = new Error(
      `Dependencias SQL de firma no disponibles: ${missing.map((key) => labels[key] || key).join(", ")}`
    );
    error.status = 503;
    error.code = "SIGNATURE_SCHEMA_MISSING";
    error.details = {
      missing,
      status,
    };
    throw error;
  }

  return status;
}

module.exports = {
  assertSignatureDependencies,
  getSignatureDependencyStatus,
};
