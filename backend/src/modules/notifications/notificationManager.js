/**
 * NotificationManager - Gestor Unificado de Notificaciones
 *
 * Centraliza el envío de notificaciones (BD + Email + Chat) reutilizando
 * la infraestructura existente de notificaciones y mailer.
 *
 * Evita duplicación de código aprovechando:
 * - notifications.service.js para BD
 * - mailer.js para emails/chat
 */

const crypto = require('crypto');
const { sendMail } = require('../../utils/mailer');
const db = require('../../config/db');
const logger = require('../../config/logger');
const { normalizeHumanText } = require('../../utils/textEncoding');
const pushSubscriptionsService = require("./pushSubscriptions.service");
const webPushService = require("./webPush.service");
const loadNotificationService = () => require('./notifications.service');
const DEFAULT_NOTIFICATION_TIMEZONE =
  process.env.NOTIFICATION_TIMEZONE ||
  process.env.APP_TIMEZONE ||
  process.env.GOOGLE_CALENDAR_TZ ||
  "America/Guayaquil";
const SYSTEM_NOTIFICATION_ADDRESS =
  process.env.SYSTEM_MAIL_ADDRESS ||
  process.env.NOTIFICATION_MAIL_ADDRESS ||
  process.env.GMAIL_SERVICE_ACCOUNT_SENDER ||
  process.env.SMTP_FROM ||
  null;
const SYSTEM_NOTIFICATION_NAME =
  process.env.SYSTEM_MAIL_NAME ||
  process.env.NOTIFICATION_MAIL_NAME ||
  process.env.SMTP_FROM_NAME ||
  "FamSPI Sistema";
const SYSTEM_NOTIFICATION_REPLY_TO =
  process.env.SYSTEM_MAIL_REPLY_TO ||
  process.env.NOTIFICATION_MAIL_REPLY_TO ||
  SYSTEM_NOTIFICATION_ADDRESS ||
  null;
const SYSTEM_NOTIFICATION_DELEGATED_USER =
  process.env.SYSTEM_MAIL_DELEGATED_USER ||
  process.env.NOTIFICATION_MAIL_DELEGATED_USER ||
  process.env.GMAIL_SERVICE_ACCOUNT_SENDER ||
  process.env.GMAIL_DELEGATED_USER ||
  null;
const EMAIL_WINDOW_START_MINUTES = 8 * 60;
const EMAIL_WINDOW_END_MINUTES = 19 * 60;
const DISPATCH_LOCK_TIMEOUT_MINUTES = Number(
  process.env.NOTIFICATION_DISPATCH_LOCK_TIMEOUT_MINUTES || 2,
);

function getTimeZoneParts(value = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_NOTIFICATION_TIMEZONE,
    calendar: "iso8601",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return parts;
}

function getTimeZoneOffsetMilliseconds(value) {
  const parts = getTimeZoneParts(value);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - value.getTime();
}

function localDateTimeToUtc({ year, month, day, hour, minute = 0, second = 0 }) {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = new Date(localAsUtc);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    guess = new Date(localAsUtc - getTimeZoneOffsetMilliseconds(guess));
  }
  return guess;
}

function getEmailScheduleState(now = new Date()) {
  const parts = getTimeZoneParts(now);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const allowed = currentMinutes >= EMAIL_WINDOW_START_MINUTES && currentMinutes < EMAIL_WINDOW_END_MINUTES;
  if (allowed) return { allowed: true, nextAllowedAt: null };

  const nextDay = currentMinutes >= EMAIL_WINDOW_END_MINUTES ? 1 : 0;
  const nextDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + nextDay));
  const nextParts = {
    year: nextDate.getUTCFullYear(),
    month: nextDate.getUTCMonth() + 1,
    day: nextDate.getUTCDate(),
  };
  return {
    allowed: false,
    nextAllowedAt: localDateTimeToUtc({
      ...nextParts,
      hour: 8,
      minute: 0,
      second: 0,
    }),
  };
}

function formatNotificationDateTime(value) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "Fecha no disponible";
  return parsed.toLocaleString("es-EC", {
    timeZone: DEFAULT_NOTIFICATION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function serializePushError(error) {
  if (!error) return "push_delivery_failed";

  const detail = {
    message: String(error?.message || "push_delivery_failed"),
    statusCode: Number(error?.statusCode || error?.status || 0) || null,
    body: error?.body ? String(error.body).slice(0, 500) : null,
    endpoint: error?.endpoint ? String(error.endpoint).slice(0, 250) : null,
  };

  if (error?.headers && typeof error.headers === "object") {
    detail.headers = Object.fromEntries(
      Object.entries(error.headers)
        .slice(0, 20)
        .map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : String(value)]),
    );
  }

  return JSON.stringify(detail).slice(0, 1000);
}

class NotificationManager {
  constructor() {
    this.templates = {
      // Templates reutilizables para notificaciones
      request_approved: {
        title: 'Solicitud Aprobada',
        message: 'Tu solicitud #{request_id} ha sido aprobada',
        type: 'task',
        priority: 1
      },
      request_rejected: {
        title: 'Solicitud Rechazada',
        message: 'Tu solicitud #{request_id} ha sido rechazada',
        type: 'alert',
        priority: 2
      },
      maintenance_due: {
        title: 'Mantenimiento Programado',
        message: 'Equipo #{equipment_name} requiere mantenimiento preventivo',
        type: 'alert',
        priority: 1
      },
    equipment_available: {
      title: 'Equipo Disponible',
      message: 'El equipo solicitado está listo para entrega',
      type: 'task',
      priority: 0
    }
    ,
    private_purchase_request_submitted: {
      title: 'Nueva solicitud privada',
      message: 'Solicitada para #{client_name} (#{offer_kind}) · debes solicitar disponibilidad a ACP',
      type: 'alert',
      priority: 2
    },
    private_purchase_created: {
      title: 'Solicitud privada creada',
      message: 'Tu solicitud #{purchase_id} para #{client_name} fue registrada. Te avisaremos cuando avance.',
      type: 'task',
      priority: 1
    },
    private_purchase_state_transition: {
      title: 'Cambio en compra privada',
      message: 'La solicitud #{purchase_id} cambió a #{to_state}. #{reason}',
      type: 'info',
      priority: 0
    },
    private_purchase_client_registration_requested: {
      title: 'Registro de cliente solicitado',
      message: '#{requester_name} solicitó el registro de #{client_name} (solicitud #{purchase_id}) para continuar la compra privada.',
      type: 'alert',
      priority: 2
    },
    private_purchase_client_approved_contract_pending: {
      title: 'Cliente registrado — contrato pendiente',
      message: 'El cliente #{client_name} (solicitud #{purchase_id}) fue registrado. Continúa con el flujo documental del contrato.',
      type: 'task',
      priority: 1
    },
    bc_created: {
      title: 'Business case generado',
      message: 'Ya puedes seguir con el flujo del comodato para #{client_name}.',
      type: 'task',
      priority: 1
    },
    bc_section_review_requested: {
      title: 'Revisión requerida de Business Case',
      message: 'Se actualiza la sección #{section_name} del BC de #{client_name}.',
      type: 'alert',
      priority: 1
    },
    bc_phase1_completed: {
      title: 'BC listo para evaluacion',
      message: 'El BC de #{client_name} finalizo la fase 1 y esta listo para evaluacion.',
      type: 'alert',
      priority: 1
    },
    bc_section_locked: {
      title: 'Sección bloqueada de Business Case',
      message: 'La sección #{section_name} del BC de #{client_name} fue bloqueada.',
      type: 'info',
      priority: 1
    },
    bc_state_transition: {
      title: 'Business Case actualizado',
      message: 'El Business Case #{business_case_id} para #{client_name} cambio de #{from_state} a #{to_state}. #{extra_info}',
      type: 'task',
      priority: 1
    }
  };
    this.asyncDispatchEnabled =
      String(process.env.NOTIFICATION_ASYNC_DISPATCH_ENABLED ?? "false").trim().toLowerCase() !== "false";
    this.emailChannelEnabled =
      String(process.env.NOTIFICATIONS_EMAIL_ENABLED ?? "true").trim().toLowerCase() === "true";
    this.pushChannelEnabled =
      String(process.env.NOTIFICATIONS_PUSH_ENABLED ?? "true").trim().toLowerCase() === "true";
    this.defaultMaxAttempts = Number(process.env.NOTIFICATION_DISPATCH_MAX_ATTEMPTS || 5);
    this.defaultBatchLimit = Number(process.env.NOTIFICATION_DISPATCH_BATCH_LIMIT || 50);
    this._warnedMissingThreadTable = false;
  }

  normalizeProcessRef(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized || null;
  }

  normalizeRfc822MessageId(value) {
    const normalized = this.normalizeProcessRef(value);
    if (!normalized || !/^<[^<>\r\n]+>$/.test(normalized)) return null;
    return normalized;
  }

  normalizeEmailForThread(value) {
    const raw = this.normalizeProcessRef(value)?.toLowerCase() || null;
    if (!raw || raw.includes(",") || raw.includes(";")) return null;
    const match = raw.match(/<([^<>]+)>/);
    return String(match?.[1] || raw).trim() || null;
  }

  resolveRecipientThreadProcessKey(processKey, recipient) {
    const normalizedProcess = this.normalizeProcessRef(processKey);
    if (!normalizedProcess) return null;

    const normalizedRecipient = this.normalizeEmailForThread(recipient);
    const systemMailbox = this.normalizeEmailForThread(SYSTEM_NOTIFICATION_ADDRESS);
    if (!normalizedRecipient || (systemMailbox && normalizedRecipient === systemMailbox)) {
      // Keep the current administrator thread so existing conversations do not
      // split when the recipient-aware keys are introduced.
      return normalizedProcess;
    }

    const recipientHash = crypto
      .createHash('sha256')
      .update(normalizedRecipient)
      .digest('hex')
      .slice(0, 24);
    return `${normalizedProcess}:recipient:${recipientHash}`;
  }

  getEmailScheduleState(now = new Date()) {
    return getEmailScheduleState(now);
  }

  resolveProcessKey({ source, template, userId, meta = {}, data = {} }) {
    const processSource = this.normalizeProcessRef(source || template || "general");
    const explicit = this.normalizeProcessRef(meta?.process_key || meta?.workflow_key);
    if (explicit) return explicit;

    const businessCaseRef = this.normalizeProcessRef(
      meta?.business_case_id || meta?.businessCaseId || data?.business_case_id || data?.businessCaseId
    );
    if (businessCaseRef) return `business_case:${businessCaseRef}`;

    const purchaseRef = this.normalizeProcessRef(
      meta?.purchase_id ||
      meta?.purchaseId ||
      meta?.private_purchase_id ||
      meta?.public_purchase_id ||
      data?.purchase_id ||
      data?.purchaseId ||
      data?.private_purchase_id ||
      data?.public_purchase_id
    );
    if (purchaseRef) return `purchase:${purchaseRef}`;

    const requestRef = this.normalizeProcessRef(
      meta?.solicitud_id ||
      meta?.request_id ||
      meta?.client_request_id ||
      data?.request_id ||
      data?.client_request_id
    );
    if (requestRef) return `request:${requestRef}`;

    const referenceCandidates = [
      meta?.process_id,
      meta?.workflow_id,
      meta?.ticket_id,
      meta?.inspection_id,
      meta?.id,
      data?.ticket_id,
      data?.id,
    ];

    for (const ref of referenceCandidates) {
      const normalizedRef = this.normalizeProcessRef(ref);
      if (normalizedRef) return `${processSource}:${normalizedRef}`;
    }

    return `${processSource}:user:${userId}`;
  }

  resolveThreadProcessKey({ notification = {}, data = {}, options = {} }) {
    const explicitThreadOption = this.normalizeProcessRef(
      options?.threadProcessKey || options?.thread_process_key || options?.emailThreadKey,
    );
    if (explicitThreadOption) return explicitThreadOption;

    const explicitOption = this.normalizeProcessRef(options?.processKey || options?.process_key);
    if (explicitOption) return explicitOption;

    const meta =
      notification?.meta && typeof notification.meta === "object" && !Array.isArray(notification.meta)
        ? notification.meta
        : {};
    const explicit =
      this.normalizeProcessRef(meta?.process_key || meta?.workflow_key) ||
      this.normalizeProcessRef(data?.process_key || data?.workflow_key);
    if (explicit) return explicit;

    const businessCaseRef = this.normalizeProcessRef(
      meta?.business_case_id ||
      meta?.businessCaseId ||
      data?.business_case_id ||
      data?.businessCaseId
    );
    if (businessCaseRef) return `business_case:${businessCaseRef}`;

    const purchaseRef = this.normalizeProcessRef(
      meta?.purchase_id ||
      meta?.purchaseId ||
      meta?.private_purchase_id ||
      meta?.public_purchase_id ||
      data?.purchase_id ||
      data?.purchaseId ||
      data?.private_purchase_id ||
      data?.public_purchase_id
    );
    if (purchaseRef) return `purchase:${purchaseRef}`;

    const requestRef = this.normalizeProcessRef(
      meta?.solicitud_id ||
      meta?.request_id ||
      meta?.client_request_id ||
      data?.request_id ||
      data?.client_request_id
    );
    if (requestRef) return `request:${requestRef}`;

    return null;
  }

  resolveNotificationTargetUrl(notification = {}, data = {}) {
    const appBaseUrl = normalizeBaseUrl(
      process.env.APP_FRONTEND_URL ||
        process.env.FRONTEND_URL ||
        process.env.APP_BASE_URL ||
        "",
    );

    const rawPath = String(
      notification?.meta?.target_path ||
        data?.target_path ||
        notification?.meta?.url ||
        data?.url ||
        "",
    ).trim();

    if (!rawPath) return appBaseUrl || null;
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    if (!appBaseUrl) return rawPath;
    return `${appBaseUrl}${rawPath.startsWith("/") ? rawPath : `/${rawPath}`}`;
  }

  buildPushPayload(notification = {}, data = {}) {
    return {
      title: normalizeHumanText(notification?.title || "FamSPI"),
      body: normalizeHumanText(notification?.message || ""),
      tag: `notification-${notification?.id || "general"}`,
      renotify: Number(notification?.priority || 0) >= 2,
      requireInteraction: Number(notification?.priority || 0) >= 3,
      data: {
        notificationId: notification?.id || null,
        url: this.resolveNotificationTargetUrl(notification, data),
        source: notification?.source || null,
        createdAt: notification?.created_at || null,
      },
    };
  }

  isMissingRelationError(error) {
    return String(error?.code || "") === "42P01";
  }

  warnMissingThreadTableOnce(context = {}) {
    if (this._warnedMissingThreadTable) return;
    this._warnedMissingThreadTable = true;
    logger.warn(
      context,
      "[NOTIFICATIONS] Tabla notification_process_email_threads no existe; ejecutar migracion 113",
    );
  }

  async getEmailThreadContext(processKey) {
    const normalized = this.normalizeProcessRef(processKey);
    if (!normalized) return null;
    try {
      const { rows } = await db.query(
        `
        SELECT
          process_key,
          provider,
          thread_id,
          root_subject,
          last_subject,
          last_provider_message_id,
          last_notification_id,
          first_sent_at,
          last_sent_at
        FROM notification_process_email_threads
        WHERE process_key = $1
        LIMIT 1
        `,
        [normalized],
      );
      return rows[0] || null;
    } catch (error) {
      if (this.isMissingRelationError(error)) {
        this.warnMissingThreadTableOnce({ processKey: normalized });
        return null;
      }
      throw error;
    }
  }

  async upsertEmailThreadContext({
    processKey,
    threadId,
    rootSubject = null,
    lastSubject = null,
    lastProviderMessageId = null,
    notificationId = null,
  }) {
    const normalizedProcess = this.normalizeProcessRef(processKey);
    const normalizedThread = this.normalizeProcessRef(threadId);
    if (!normalizedProcess || !normalizedThread) return null;
    try {
      const { rows } = await db.query(
        `
        INSERT INTO notification_process_email_threads (
          process_key,
          provider,
          thread_id,
          root_subject,
          last_subject,
          last_provider_message_id,
          last_notification_id,
          first_sent_at,
          last_sent_at,
          created_at,
          updated_at
        )
        VALUES ($1, 'gmail', $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), NOW())
        ON CONFLICT (process_key)
        DO UPDATE SET
          thread_id = COALESCE(EXCLUDED.thread_id, notification_process_email_threads.thread_id),
          root_subject = COALESCE(notification_process_email_threads.root_subject, EXCLUDED.root_subject),
          last_subject = COALESCE(EXCLUDED.last_subject, notification_process_email_threads.last_subject),
          last_provider_message_id = COALESCE(EXCLUDED.last_provider_message_id, notification_process_email_threads.last_provider_message_id),
          last_notification_id = COALESCE(EXCLUDED.last_notification_id, notification_process_email_threads.last_notification_id),
          last_sent_at = NOW(),
          updated_at = NOW()
        RETURNING process_key, thread_id, root_subject, last_subject, last_provider_message_id, last_notification_id
        `,
        [
          normalizedProcess,
          normalizedThread,
          rootSubject || null,
          lastSubject || null,
          lastProviderMessageId || null,
          notificationId || null,
        ],
      );
      return rows[0] || null;
    } catch (error) {
      if (this.isMissingRelationError(error)) {
        this.warnMissingThreadTableOnce({ processKey: normalizedProcess });
        return null;
      }
      throw error;
    }
  }

  /**
   * Política de reintentos según prioridad.
   * priority 3 (urgente): 8 intentos, backoff rápido.
   * priority 2 (importante): 6 intentos.
   * priority 1 (normal): 4 intentos.
   * priority 0 (informativo): 2 intentos.
   */
  resolveRetryPolicy(priority) {
    const p = Number.isFinite(Number(priority)) ? Number(priority) : 0;
    if (p >= 3) return { maxAttempts: 8, firstRetryMinutes: 1 };
    if (p >= 2) return { maxAttempts: 6, firstRetryMinutes: 2 };
    if (p >= 1) return { maxAttempts: 4, firstRetryMinutes: 5 };
    return { maxAttempts: 2, firstRetryMinutes: 30 };
  }

  /**
   * Envía notificación completa (BD + Email + Chat).
   * NUNCA lanza excepción — errores se logean y devuelve null.
   */
  async sendNotification({
    userId,
    template,
    data = {},
    email = true,
    chat = false,
    push = true,
    customTitle,
    customMessage,
    type,
    priority,
    source,
    meta = {}
    }) {
    try {
      const emailScheduleAllowed = this.getEmailScheduleState().allowed;
      const emailEnabledForDispatch = email && this.emailChannelEnabled && emailScheduleAllowed;
      if (email && !emailScheduleAllowed) {
        logger.info(
          {
            userId,
            source,
            timezone: DEFAULT_NOTIFICATION_TIMEZONE,
          },
          "[NOTIFICATIONS] No se genera correo fuera del horario laborable",
        );
      }
      const templateData = this.templates[template];
      if (!templateData && !customTitle) {
        throw new Error(`Template '${template}' no encontrado`);
      }
      const resolvedPriority = Number.isFinite(Number(priority))
        ? Number(priority)
        : templateData?.priority ?? 0;
      const processKey = this.resolveProcessKey({
        source: source || template,
        template,
        userId,
        meta,
        data,
      });
      const threadProcessKey = this.resolveThreadProcessKey({
        notification: { meta },
        data,
        options: {},
      });

      const notificationData = {
        user_id: userId,
        title: normalizeHumanText(customTitle || this.interpolate(templateData.title, data)),
        message: normalizeHumanText(customMessage || this.interpolate(templateData.message, data)),
        type: type || templateData?.type || 'info',
        source: source || template,
        priority: resolvedPriority,
        meta: {
          ...meta,
          template,
          data,
          process_key: meta?.process_key || threadProcessKey || null,
          sent_at: new Date().toISOString(),
        }
      };

      const notification = await loadNotificationService().createNotification(notificationData);

      if (this.asyncDispatchEnabled) {
        try {
          const queueOps = [];
          if (emailEnabledForDispatch) {
            queueOps.push(
              this.enqueueDispatch(notification.id, "email", {
                data,
                processKey,
                emailThreadKey: threadProcessKey,
                priority: resolvedPriority,
              }),
            );
          }
          if (chat) {
            queueOps.push(this.enqueueDispatch(notification.id, "chat", {
              data,
              processKey,
              priority: resolvedPriority,
            }));
          }
          if (push && this.pushChannelEnabled) {
            queueOps.push(this.enqueueDispatch(notification.id, "push", {
              data,
              processKey,
              priority: resolvedPriority,
            }));
          }
          await Promise.all(queueOps);
        } catch (queueError) {
          logger.error(
            { error: queueError.message, notificationId: notification.id },
            "[NOTIFICATIONS] Fallo en cola asincrona, aplicando fallback sincrono",
          );
          if (emailEnabledForDispatch) {
            await this.sendEmailNotification(notification, data, { processKey: threadProcessKey });
          }
          if (chat) {
            await this.sendChatNotification(notification, data);
          }
          if (push && this.pushChannelEnabled) {
            await this.sendPushNotification(notification, data, { strict: false });
          }
        }
      } else {
        if (emailEnabledForDispatch) {
          await this.sendEmailNotification(notification, data, { processKey: threadProcessKey });
        }
        if (chat) {
          await this.sendChatNotification(notification, data);
        }
        if (push && this.pushChannelEnabled) {
          await this.sendPushNotification(notification, data, { strict: false });
        }
      }

      return notification;
    } catch (error) {
      logger.error(
        { error: error.message, userId, source, template },
        '[NOTIFICATIONS] Error en sendNotification — el flujo principal no se interrumpe'
      );
      return null;
    }
  }

  /**
   * Alias explícito que garantiza que nunca lanza.
   * Útil como documentación de intención en callers críticos.
   */
  async sendNotificationSafe(params) {
    return this.sendNotification(params);
  }

  async enqueueDispatch(notificationId, channel, payload = {}) {
    if (!notificationId || !channel) return null;
    const policy = this.resolveRetryPolicy(payload?.priority);
    const maxAttempts = policy.maxAttempts;
    const processKey = this.normalizeProcessRef(payload?.processKey);
    const { rows } = await db.query(
      `
      INSERT INTO notification_dispatch_queue (
        notification_id,
        channel,
        process_key,
        payload,
        status,
        attempts,
        max_attempts,
        next_retry_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4::jsonb, 'pending', 0, $5, NOW(), NOW(), NOW())
      ON CONFLICT (notification_id, channel)
      DO UPDATE SET
        process_key = COALESCE(EXCLUDED.process_key, notification_dispatch_queue.process_key),
        payload = EXCLUDED.payload,
        status = 'pending',
        next_retry_at = NOW(),
        updated_at = NOW()
      RETURNING id
      `,
      [notificationId, channel, processKey, JSON.stringify(payload || {}), maxAttempts],
    );
    return rows[0] || null;
  }

  async processDispatchQueueBatch({ limit } = {}) {
    const batchLimit = Number.isFinite(Number(limit)) ? Number(limit) : this.defaultBatchLimit;
    const client = await db.getClient();
    let jobs = [];
    try {
      await client.query("BEGIN");
      await client.query(
        `
        UPDATE notification_dispatch_queue
        SET status = 'failed',
            locked_at = NULL,
            last_error = COALESCE(last_error, 'STALE_PROCESSING_LOCK_RECOVERED'),
            next_retry_at = CASE
              WHEN attempts < max_attempts THEN NOW()
              ELSE next_retry_at
            END,
            updated_at = NOW()
        WHERE status = 'processing'
          AND locked_at IS NOT NULL
          AND locked_at <= NOW() - make_interval(mins => $1)
        `,
        [Math.max(1, DISPATCH_LOCK_TIMEOUT_MINUTES)],
      );
      const { rows } = await client.query(
        `
        SELECT
          q.id,
          q.notification_id,
          q.channel,
          q.process_key,
          q.payload,
          q.attempts,
          q.max_attempts,
          n.user_id,
          n.title,
          n.message,
          n.type,
          n.source,
          n.created_at
        FROM notification_dispatch_queue q
        JOIN notifications n ON n.id = q.notification_id
        WHERE q.status IN ('pending', 'failed')
          AND q.next_retry_at <= NOW()
          AND q.attempts < q.max_attempts
          AND (
            q.process_key IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM notification_dispatch_queue q_prev
              JOIN notifications n_prev ON n_prev.id = q_prev.notification_id
              WHERE q_prev.process_key = q.process_key
                AND q_prev.channel = q.channel
                AND n_prev.user_id = n.user_id
                AND q_prev.id < q.id
                AND (
                  q_prev.status IN ('pending', 'processing')
                  OR (
                    q_prev.status = 'failed'
                    AND q_prev.attempts < q_prev.max_attempts
                    AND q_prev.next_retry_at <= NOW()
                  )
                )
            )
          )
        ORDER BY q.created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
        `,
        [batchLimit],
      );
      jobs = rows;

      if (jobs.length) {
        const ids = jobs.map((item) => Number(item.id));
        await client.query(
          `
          UPDATE notification_dispatch_queue
          SET status = 'processing',
              attempts = attempts + 1,
              locked_at = NOW(),
              updated_at = NOW()
          WHERE id = ANY($1::bigint[])
          `,
          [ids],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const summary = {
      total: jobs.length,
      sent: 0,
      failed: 0,
      retriable: 0,
      deferred: 0,
    };

    for (const job of jobs) {
      const notification = {
        id: job.notification_id,
        user_id: job.user_id,
        title: job.title,
        message: job.message,
        type: job.type,
        source: job.source,
        created_at: job.created_at,
      };
      const payload = job.payload || {};

      try {
        if (job.channel === "email") {
          if (!this.emailChannelEnabled) {
            await db.query(
              `UPDATE notification_dispatch_queue
                  SET status = 'sent',
                      locked_at = NULL,
                      last_error = 'Email deshabilitado por configuracion',
                      updated_at = NOW()
                WHERE id = $1`,
              [job.id],
            );
            summary.sent += 1;
            continue;
          }
          const emailResult = await this.sendEmailNotification(notification, payload.data || {}, {
            // The queue preserves the process order while the email thread is
            // resolved per recipient inside sendEmailNotification.
            strict: true,
            threadProcessKey: payload.emailThreadKey || null,
            processKey: job.process_key || payload.processKey || null,
          });
          if (emailResult?.deferred) {
            await db.query(
              `UPDATE notification_dispatch_queue
                  SET status = 'pending',
                      attempts = GREATEST(attempts - 1, 0),
                      locked_at = NULL,
                      last_error = $2,
                      next_retry_at = $3,
                      updated_at = NOW()
                WHERE id = $1`,
              [job.id, emailResult.reason, emailResult.nextRetryAt],
            );
            summary.deferred += 1;
            continue;
          }
        } else if (job.channel === "chat") {
          await this.sendChatNotification(notification, payload.data || {}, { strict: true });
        } else if (job.channel === "push") {
          const pushResult = await this.sendPushNotification(notification, payload.data || {}, { strict: true });
          if (pushResult?.skipped) {
            await db.query(
              `UPDATE notification_dispatch_queue
                  SET status = 'sent',
                      locked_at = NULL,
                      last_error = $2,
                      updated_at = NOW()
                WHERE id = $1`,
              [job.id, pushResult.reason || "NO_ACTIVE_PUSH_SUBSCRIPTIONS"],
            );
            summary.sent += 1;
            continue;
          }
        } else {
          throw new Error(`Canal de despacho no soportado: ${job.channel}`);
        }

        await db.query(
          `UPDATE notification_dispatch_queue
              SET status = 'sent',
                  locked_at = NULL,
                  last_error = NULL,
                  updated_at = NOW()
            WHERE id = $1`,
          [job.id],
        );
        summary.sent += 1;
      } catch (error) {
        const attemptsAfterIncrement = Number(job.attempts) + 1;
        const maxAttempts = Number(job.max_attempts);
        const exhausted = attemptsAfterIncrement >= maxAttempts;
        // Backoff: 1 → 2 → 4 → 8 → 16 → 32 → 60 min (capped)
        const retryMinutes = exhausted
          ? 0
          : Math.min(60, Math.max(1, 2 ** Math.min(attemptsAfterIncrement - 1, 6)));
        const serializedError =
          job.channel === "push"
            ? serializePushError(error)
            : String(error.message || "dispatch_error").slice(0, 500);

        await db.query(
          `UPDATE notification_dispatch_queue
              SET status = 'failed',
                  locked_at = NULL,
                  last_error = $2,
                  next_retry_at = CASE
                    WHEN NOT $3 THEN NOW() + make_interval(mins => $4)
                    ELSE next_retry_at
                  END,
                  updated_at = NOW()
            WHERE id = $1`,
          [job.id, serializedError, exhausted, retryMinutes],
        );

        if (exhausted) {
          summary.failed += 1;
          logger.error(
            {
              queueId: job.id,
              notificationId: job.notification_id,
              channel: job.channel,
              attempts: attemptsAfterIncrement,
              error: error.message,
            },
            "[NOTIFICATIONS] Despacho agotado — permanently_failed",
          );
        } else {
          summary.failed += 1;
          summary.retriable += 1;
          logger.warn(
            {
              queueId: job.id,
              notificationId: job.notification_id,
              channel: job.channel,
              attemptsAfterIncrement,
              maxAttempts,
              nextRetryMinutes: retryMinutes,
              error: error.message,
            },
            "[NOTIFICATIONS] Error despachando; reintento programado",
          );
        }
      }
    }

    return summary;
  }

  /**
   * Envía notificación solo por email (reutiliza sendMail existente)
   */
  async sendEmailNotification(notification, data = {}, options = {}) {
    const strict = options?.strict === true;
    try {
      const explicitTo =
        data?.email_to ||
        data?.to ||
        notification?.meta?.email_to ||
        notification?.meta?.to ||
        null;
      const explicitCc =
        data?.email_cc ||
        data?.cc ||
        notification?.meta?.email_cc ||
        notification?.meta?.cc ||
        null;
      const to = explicitTo || (await this.getUserEmail(notification.user_id));
      if (!to) {
        if (strict) throw new Error("No se pudo determinar email del usuario para notificacion");
        return;
      }

      const schedule = this.getEmailScheduleState();
      if (!schedule.allowed) {
        logger.info(
          {
            notificationId: notification?.id,
            nextRetryAt: schedule.nextAllowedAt?.toISOString() || null,
            timezone: DEFAULT_NOTIFICATION_TIMEZONE,
          },
          "[NOTIFICATIONS] Email diferido fuera de horario laborable",
        );
        return {
          deferred: true,
          reason: "OUTSIDE_EMAIL_SCHEDULE",
          nextRetryAt: schedule.nextAllowedAt,
        };
      }

      const processKey = this.resolveThreadProcessKey({ notification, data, options });
      const recipientProcessKey = this.resolveRecipientThreadProcessKey(processKey, to);
      const threadContext = recipientProcessKey
        ? await this.getEmailThreadContext(recipientProcessKey)
        : null;

      const resolvedSubject =
        normalizeHumanText(
          data?.email_subject ||
            data?.subject ||
            notification?.meta?.email_subject ||
            notification?.meta?.subject ||
            notification.title,
        );
      const subject = threadContext?.root_subject || resolvedSubject;
      const html = this.generateEmailHTML(notification, data);
      const previousMessageId = this.normalizeRfc822MessageId(
        threadContext?.last_provider_message_id,
      );

      const sendResult = await sendMail({
        to,
        cc: explicitCc || null,
        subject,
        html,
        from: SYSTEM_NOTIFICATION_ADDRESS,
        senderName: SYSTEM_NOTIFICATION_NAME,
        replyTo: SYSTEM_NOTIFICATION_REPLY_TO,
        delegatedUser: SYSTEM_NOTIFICATION_DELEGATED_USER,
        source: notification.source,
        threadId: threadContext?.thread_id || null,
        inReplyTo: previousMessageId,
        references: previousMessageId,
      });

      const providerThreadId = this.normalizeProcessRef(sendResult?.providerThreadId || sendResult?.threadId);
      if (recipientProcessKey && providerThreadId) {
        await this.upsertEmailThreadContext({
          processKey: recipientProcessKey,
          threadId: providerThreadId,
          rootSubject: threadContext?.root_subject || resolvedSubject,
          lastSubject: subject,
          lastProviderMessageId: this.normalizeRfc822MessageId(sendResult?.rfc822MessageId) ||
            this.normalizeProcessRef(sendResult?.providerMessageId || sendResult?.messageId),
          notificationId: notification?.id || null,
        });
      }

      logger.info(
        {
          to,
          cc: explicitCc || null,
          subject,
          notificationId: notification.id,
          processKey,
          recipientProcessKey,
          providerThreadId: providerThreadId || null,
        },
        "[NOTIFICATIONS] Email enviado",
      );
      return { sent: true };
    } catch (error) {
      logger.error({ error: error.message, notificationId: notification?.id }, "Error enviando email");
      if (strict) throw error;
    }
  }
  /**
   * Envía notificación a Google Chat (reutiliza sendChatMessage)
   */
  async sendChatNotification(notification, data = {}, options = {}) {
    const strict = options?.strict === true;
    try {
      const { sendChatMessage, resolveWebhookUrlForSource } = require('../../utils/googleChat');

      const message = `🔔 *${notification.title}*\n\n${notification.message}`;

      await sendChatMessage({
        text: message,
        threadKey: `notification-${notification.id}`,
        webhookUrl: resolveWebhookUrlForSource(notification.source),
      });

      logger.info({ notificationId: notification.id }, "[NOTIFICATIONS] Mensaje enviado a Google Chat");
    } catch (error) {
      logger.error({ error: error.message, notificationId: notification?.id }, "Error enviando mensaje a Chat");
      if (strict) throw error;
    }
  }

  async sendPushNotification(notification, data = {}, options = {}) {
    const strict = options?.strict === true;
    try {
      if (!this.pushChannelEnabled || !webPushService.isConfigured()) {
        return { skipped: true, reason: "PUSH_DISABLED_OR_NOT_CONFIGURED" };
      }

      const subscriptions = await pushSubscriptionsService.listActiveSubscriptionsByUser(notification.user_id);
      if (!subscriptions.length) {
        return { skipped: true, reason: "NO_ACTIVE_PUSH_SUBSCRIPTIONS" };
      }

      const payload = this.buildPushPayload(notification, data);
      let delivered = 0;
      let transientFailures = 0;
      let lastTransientError = null;

      for (const row of subscriptions) {
        try {
          await webPushService.sendToSubscription(row.subscription, payload, {
            ttl: 60,
            urgency: Number(notification?.priority || 0) >= 2 ? "high" : "normal",
            topic: `notification-${notification?.id || "general"}`,
          });
          delivered += 1;
          await pushSubscriptionsService.registerDeliverySuccess({ endpoint: row.endpoint });
        } catch (error) {
          const statusCode = Number(error?.statusCode || error?.status || 0);
          const errorMessage = serializePushError(error);
          if (statusCode === 404 || statusCode === 410) {
            await pushSubscriptionsService.disableSubscriptionByEndpoint({
              endpoint: row.endpoint,
              errorMessage,
            });
            continue;
          }

          transientFailures += 1;
          lastTransientError = error;
          await pushSubscriptionsService.registerDeliveryFailure({
            endpoint: row.endpoint,
            errorMessage,
          });
        }
      }

      if (delivered > 0) {
        logger.info(
          {
            notificationId: notification?.id,
            userId: notification?.user_id,
            delivered,
            attempted: subscriptions.length,
          },
          "[NOTIFICATIONS] Push enviado",
        );
        return { sent: true, delivered };
      }

      if (transientFailures > 0 && lastTransientError) {
        throw lastTransientError;
      }

      return { skipped: true, reason: "NO_VALID_PUSH_SUBSCRIPTIONS" };
    } catch (error) {
      logger.error(
        {
          error: serializePushError(error),
          notificationId: notification?.id,
          userId: notification?.user_id,
        },
        "Error enviando push",
      );
      if (strict) throw error;
    }
  }

  /**
   * Interpola placeholders en templates
   */
  interpolate(template, data) {
    return String(template || "").replace(/#\{(\w+)\}|\{(\w+)\}/g, (match, keyHash, keyCurly) => {
      const key = keyHash || keyCurly;
      return data[key] !== undefined ? data[key] : match;
    });
  }

  /**
   * Genera HTML para emails.
   * Incluye botón CTA cuando notification.meta.target_path o data.target_path están presentes.
   */
  generateEmailHTML(notification, data) {
    const typeColors = {
      info: '#3B82F6',
      task: '#10B981',
      alert: '#F59E0B',
      warning: '#F59E0B',
      error: '#EF4444',
    };

    const color = typeColors[notification.type] || '#6B7280';
    const title = normalizeHumanText(notification.title);
    const message = normalizeHumanText(notification.message);

    const appBaseUrl = String(
      process.env.APP_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      process.env.APP_BASE_URL ||
      ""
    ).replace(/\/$/, "");

    const rawPath = String(
      notification?.meta?.target_path ||
      data?.target_path ||
      ""
    ).trim();

    const ctaHref = rawPath
      ? (rawPath.startsWith("http") ? rawPath : `${appBaseUrl}${rawPath}`)
      : null;

    const ctaLabel =
      notification?.meta?.cta_label ||
      data?.cta_label ||
      "Abrir en plataforma";

    const secondaryHref = String(data?.secondary_cta_url || notification?.meta?.secondary_cta_url || "").trim() || null;
    const secondaryLabel = data?.secondary_cta_label || notification?.meta?.secondary_cta_label || "Abrir recurso";
    const actionButtons = [
      ctaHref
        ? `<a href="${escapeAttr(ctaHref)}" style="display:inline-block; background:${color}; color:#ffffff; padding:13px 22px; border-radius:999px; font-size:14px; font-weight:800; text-decoration:none; letter-spacing:0.2px;">${escapeHtml(ctaLabel)}</a>`
        : "",
      secondaryHref
        ? `<a href="${escapeAttr(secondaryHref)}" style="display:inline-block; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; padding:12px 20px; border-radius:999px; font-size:14px; font-weight:800; text-decoration:none; letter-spacing:0.2px;">${escapeHtml(secondaryLabel)}</a>`
        : "",
    ].filter(Boolean).join('<span style="display:inline-block; width:10px;"></span>');

    const ctaBlock = actionButtons
      ? `<div style="text-align:center; margin:28px 0 24px;">${actionButtons}</div>`
      : "";

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background:#eef4f1;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(message).slice(0, 140)}</div>
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 32px auto; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 45px rgba(15,23,42,0.12); border:1px solid #dbe7e2;">
    <div style="background:linear-gradient(135deg, #0f172a 0%, #1f3b2d 58%, ${color} 120%); color:white; padding: 28px 32px;">
      <div style="font-size:11px; font-weight:800; letter-spacing:2.8px; text-transform:uppercase; color:#cdebd8; margin-bottom:10px;">Famproject Cia. Ltda.</div>
      <h2 style="margin:0; font-size:24px; line-height:1.25; font-weight:900;">${escapeHtml(title)}</h2>
    </div>
    <div style="background:#ffffff; padding: 30px 32px;">
      <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#334155;">${escapeHtml(message)}</p>
      ${ctaBlock}
      <div style="border-radius:16px; background:#f8fafc; border:1px solid #e2e8f0; padding:14px 16px; margin-top:18px;">
      <p style="margin:0; color:#64748b; font-size:12px; line-height:1.5;">
        Recibido: ${formatNotificationDateTime(notification.created_at)}
      </p>
      </div>
    </div>
    <div style="background:#f8fafc; padding:16px 28px; border-top:1px solid #e2e8f0;">
      <p style="margin:0; font-size:12px; color:#94a3b8; text-align:center; line-height:1.5;">
        Este es un mensaje automatico de Famproject Cia. Ltda. Por favor no responda directamente a este correo.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Obtiene email del usuario (helper)
   */
  async getUserEmail(userId) {
    try {
      const { rows } = await db.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );
      return rows[0]?.email || null;
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Error obteniendo email del usuario');
      return null;
    }
  }

  /**
   * Métodos de conveniencia para tipos comunes de notificaciones
   */

  async notifyRequestApproved(userId, requestId, data = {}) {
    return this.sendNotification({
      userId,
      template: 'request_approved',
      data: { request_id: requestId, ...data },
      email: true,
      source: 'requests'
    });
  }

  async notifyRequestRejected(userId, requestId, data = {}) {
    return this.sendNotification({
      userId,
      template: 'request_rejected',
      data: { request_id: requestId, ...data },
      email: true,
      source: 'requests'
    });
  }

  async notifyMaintenanceDue(userId, equipmentName, data = {}) {
    return this.sendNotification({
      userId,
      template: 'maintenance_due',
      data: { equipment_name: equipmentName, ...data },
      email: true,
      chat: true,
      source: 'maintenance'
    });
  }

  async notifyEquipmentAvailable(userId, equipmentName, data = {}) {
    return this.sendNotification({
      userId,
      template: 'equipment_available',
      data: { equipment_name: equipmentName, ...data },
      email: true,
      source: 'equipment'
    });
  }
}

module.exports = new NotificationManager();
