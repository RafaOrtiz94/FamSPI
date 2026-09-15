const db = require("../../config/db");
const webPushService = require("./webPush.service");

const normalizeSubscription = (subscription) => {
  if (!subscription || typeof subscription !== "object" || Array.isArray(subscription)) {
    throw new Error("Suscripcion push invalida");
  }

  const endpoint = String(subscription.endpoint || "").trim();
  const keys = subscription.keys && typeof subscription.keys === "object" ? subscription.keys : {};
  const p256dh = String(keys.p256dh || "").trim();
  const auth = String(keys.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error("La suscripcion push no contiene endpoint o llaves validas");
  }

  return {
    endpoint,
    subscription: {
      endpoint,
      expirationTime: subscription.expirationTime || null,
      keys: {
        p256dh,
        auth,
      },
    },
  };
};

const mapRow = (row) => ({
  id: Number(row.id),
  user_id: Number(row.user_id),
  endpoint: row.endpoint,
  user_agent: row.user_agent || null,
  device_label: row.device_label || null,
  app_path: row.app_path || null,
  failure_count: Number(row.failure_count || 0),
  last_error: row.last_error || null,
  last_seen_at: row.last_seen_at,
  disabled_at: row.disabled_at || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getPushConfig = () => ({
  enabled: webPushService.isConfigured(),
  publicKey: webPushService.getPublicKey() || null,
});

const listActiveSubscriptionsByUser = async (userId) => {
  const { rows } = await db.query(
    `
    SELECT
      id,
      user_id,
      endpoint,
      subscription,
      user_agent,
      device_label,
      app_path,
      failure_count,
      last_error,
      last_seen_at,
      disabled_at,
      created_at,
      updated_at
    FROM notification_push_subscriptions
    WHERE user_id = $1
      AND disabled_at IS NULL
    ORDER BY updated_at DESC
    `,
    [userId],
  );

  return rows.map((row) => ({
    ...mapRow(row),
    subscription: row.subscription,
  }));
};

const getUserPushStatus = async (userId) => {
  const { rows } = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM notification_push_subscriptions
    WHERE user_id = $1
      AND disabled_at IS NULL
    `,
    [userId],
  );

  return {
    enabled: webPushService.isConfigured(),
    activeSubscriptions: Number(rows[0]?.total || 0),
  };
};

const upsertSubscription = async ({
  userId,
  subscription,
  userAgent = null,
  deviceLabel = null,
  appPath = null,
}) => {
  const normalized = normalizeSubscription(subscription);

  const { rows } = await db.query(
    `
    INSERT INTO notification_push_subscriptions (
      user_id,
      endpoint,
      subscription,
      user_agent,
      device_label,
      app_path,
      failure_count,
      last_error,
      last_seen_at,
      disabled_at,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3::jsonb, $4, $5, $6, 0, NULL, NOW(), NULL, NOW(), NOW())
    ON CONFLICT (endpoint)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      subscription = EXCLUDED.subscription,
      user_agent = EXCLUDED.user_agent,
      device_label = COALESCE(EXCLUDED.device_label, notification_push_subscriptions.device_label),
      app_path = COALESCE(EXCLUDED.app_path, notification_push_subscriptions.app_path),
      failure_count = 0,
      last_error = NULL,
      last_seen_at = NOW(),
      disabled_at = NULL,
      updated_at = NOW()
    RETURNING id, user_id, endpoint, user_agent, device_label, app_path, failure_count, last_error, last_seen_at, disabled_at, created_at, updated_at
    `,
    [
      userId,
      normalized.endpoint,
      JSON.stringify(normalized.subscription),
      userAgent,
      deviceLabel,
      appPath,
    ],
  );

  return mapRow(rows[0]);
};

const disableSubscription = async ({ userId, endpoint = null }) => {
  const normalizedEndpoint = String(endpoint || "").trim();
  if (!normalizedEndpoint) return null;

  const { rows } = await db.query(
    `
    UPDATE notification_push_subscriptions
    SET disabled_at = NOW(),
        updated_at = NOW()
    WHERE user_id = $1
      AND endpoint = $2
      AND disabled_at IS NULL
    RETURNING id, user_id, endpoint, user_agent, device_label, app_path, failure_count, last_error, last_seen_at, disabled_at, created_at, updated_at
    `,
    [userId, normalizedEndpoint],
  );

  return rows[0] ? mapRow(rows[0]) : null;
};

const disableSubscriptionByEndpoint = async ({ endpoint, errorMessage = null }) => {
  const normalizedEndpoint = String(endpoint || "").trim();
  if (!normalizedEndpoint) return null;

  const { rows } = await db.query(
    `
    UPDATE notification_push_subscriptions
    SET disabled_at = NOW(),
        last_error = $2,
        updated_at = NOW()
    WHERE endpoint = $1
      AND disabled_at IS NULL
    RETURNING id, user_id, endpoint, user_agent, device_label, app_path, failure_count, last_error, last_seen_at, disabled_at, created_at, updated_at
    `,
    [normalizedEndpoint, errorMessage],
  );

  return rows[0] ? mapRow(rows[0]) : null;
};

const registerDeliverySuccess = async ({ endpoint }) => {
  const normalizedEndpoint = String(endpoint || "").trim();
  if (!normalizedEndpoint) return null;

  await db.query(
    `
    UPDATE notification_push_subscriptions
    SET failure_count = 0,
        last_error = NULL,
        last_seen_at = NOW(),
        updated_at = NOW()
    WHERE endpoint = $1
    `,
    [normalizedEndpoint],
  );
};

const registerDeliveryFailure = async ({ endpoint, errorMessage }) => {
  const normalizedEndpoint = String(endpoint || "").trim();
  if (!normalizedEndpoint) return null;

  await db.query(
    `
    UPDATE notification_push_subscriptions
    SET failure_count = failure_count + 1,
        last_error = $2,
        updated_at = NOW()
    WHERE endpoint = $1
      AND disabled_at IS NULL
    `,
    [normalizedEndpoint, String(errorMessage || "push_delivery_failed").slice(0, 1000)],
  );
};

module.exports = {
  getPushConfig,
  getUserPushStatus,
  listActiveSubscriptionsByUser,
  upsertSubscription,
  disableSubscription,
  disableSubscriptionByEndpoint,
  registerDeliverySuccess,
  registerDeliveryFailure,
};
