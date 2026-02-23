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

const { sendMail } = require('../../utils/mailer');
const db = require('../../config/db');
const logger = require('../../config/logger');
const loadNotificationService = () => require('./notifications.service');
const DEFAULT_NOTIFICATION_TIMEZONE =
  process.env.NOTIFICATION_TIMEZONE ||
  process.env.APP_TIMEZONE ||
  process.env.GOOGLE_CALENDAR_TZ ||
  "America/Guayaquil";

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
      message: 'Solicitada para #{client_name} (#{offer_kind}) · revisa y responde cuanto antes',
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
      message: 'La solicitud #{purchase_id} cambió a #{new_state}.',
      type: 'info',
      priority: 0
    },
    bc_created: {
      title: 'Business case generado',
      message: 'Ya puedes seguir con el flujo del comodato para #{client_name}.',
      type: 'task',
      priority: 1
    },
    bc_section_review_requested: {
      title: 'Revisión requerida de Business Case',
      message: 'Se actualiza la sección #{section_name} del BC #{business_case_id}.',
      type: 'alert',
      priority: 1
    },
    bc_phase1_completed: {
      title: 'BC listo para evaluacion',
      message: 'El BC #{business_case_id} finalizo la fase 1 y esta listo para evaluacion.',
      type: 'alert',
      priority: 1
    },
    bc_section_locked: {
      title: 'Sección bloqueada de Business Case',
      message: 'La sección #{section_name} del BC #{business_case_id} fue bloqueada.',
      type: 'info',
      priority: 1
    }
  };
    this.asyncDispatchEnabled =
      String(process.env.NOTIFICATION_ASYNC_DISPATCH_ENABLED ?? "false").trim().toLowerCase() !== "false";
    this.defaultMaxAttempts = Number(process.env.NOTIFICATION_DISPATCH_MAX_ATTEMPTS || 5);
    this.defaultBatchLimit = Number(process.env.NOTIFICATION_DISPATCH_BATCH_LIMIT || 50);
  }

  normalizeProcessRef(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized || null;
  }

  resolveProcessKey({ source, template, userId, meta = {}, data = {} }) {
    const processSource = this.normalizeProcessRef(source || template || "general");
    const explicit = this.normalizeProcessRef(meta?.process_key || meta?.workflow_key);
    if (explicit) return explicit;

    const referenceCandidates = [
      meta?.process_id,
      meta?.workflow_id,
      meta?.business_case_id,
      meta?.businessCaseId,
      meta?.solicitud_id,
      meta?.request_id,
      meta?.purchase_id,
      meta?.purchaseId,
      meta?.private_purchase_id,
      meta?.public_purchase_id,
      meta?.ticket_id,
      meta?.client_request_id,
      meta?.inspection_id,
      meta?.id,
      data?.business_case_id,
      data?.request_id,
      data?.purchase_id,
      data?.ticket_id,
      data?.client_request_id,
      data?.id,
    ];

    for (const ref of referenceCandidates) {
      const normalizedRef = this.normalizeProcessRef(ref);
      if (normalizedRef) return `${processSource}:${normalizedRef}`;
    }

    return `${processSource}:user:${userId}`;
  }

  /**
   * Envía notificación completa (BD + Email + Chat)
   */
  async sendNotification({
    userId,
    template,
    data = {},
    email = true,
    chat = false,
    customTitle,
    customMessage,
    type,
    priority,
    source,
    meta = {}
  }) {
    try {
      // 1. Preparar datos de notificación
      const templateData = this.templates[template];
      if (!templateData && !customTitle) {
        throw new Error(`Template '${template}' no encontrado`);
      }

      const notificationData = {
        user_id: userId,
        title: customTitle || this.interpolate(templateData.title, data),
        message: customMessage || this.interpolate(templateData.message, data),
        type: type || templateData?.type || 'info',
        source: source || template,
        priority: priority || templateData?.priority || 0,
        meta: { ...meta, template, data, sent_at: new Date().toISOString() }
      };
      const processKey = this.resolveProcessKey({
        source: notificationData.source,
        template,
        userId,
        meta: notificationData.meta,
        data,
      });

      // 2. Crear notificación en BD
      const notification = await loadNotificationService().createNotification(notificationData);

      // 3. Despachar por canales (asincrónico en producción por defecto)
      if (this.asyncDispatchEnabled) {
        try {
          const queueOps = [];
          if (email) {
            queueOps.push(this.enqueueDispatch(notification.id, "email", { data, processKey }));
          }
          if (chat) {
            queueOps.push(this.enqueueDispatch(notification.id, "chat", { data, processKey }));
          }
          await Promise.all(queueOps);
        } catch (queueError) {
          logger.error(
            { error: queueError.message, notificationId: notification.id },
            "[NOTIFICATIONS] Fallo en cola asincrona, aplicando fallback sincrono",
          );
          if (email) {
            await this.sendEmailNotification(notification, data);
          }
          if (chat) {
            await this.sendChatNotification(notification, data);
          }
        }
      } else {
        if (email) {
          await this.sendEmailNotification(notification, data);
        }
        if (chat) {
          await this.sendChatNotification(notification, data);
        }
      }

      return notification;
    } catch (error) {
      logger.error({ error: error.message }, 'Error enviando notificación');
      throw error;
    }
  }

  async enqueueDispatch(notificationId, channel, payload = {}) {
    if (!notificationId || !channel) return null;
    const maxAttempts = Number.isFinite(this.defaultMaxAttempts) ? this.defaultMaxAttempts : 5;
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
              WHERE q_prev.process_key = q.process_key
                AND q_prev.id < q.id
                AND q_prev.status IN ('pending', 'processing', 'failed')
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
          await this.sendEmailNotification(notification, payload.data || {}, { strict: true });
        } else if (job.channel === "chat") {
          await this.sendChatNotification(notification, payload.data || {}, { strict: true });
        } else {
          throw new Error(`Canal de despacho no soportado: ${job.channel}`);
        }

        await db.query(
          `
          UPDATE notification_dispatch_queue
          SET status = 'sent',
              locked_at = NULL,
              last_error = NULL,
              updated_at = NOW()
          WHERE id = $1
          `,
          [job.id],
        );
        summary.sent += 1;
      } catch (error) {
        const attemptsAfterIncrement = Number(job.attempts) + 1;
        const hasRetry = attemptsAfterIncrement < Number(job.max_attempts);
        const retryMinutes = Math.min(60, Math.max(1, 2 ** Math.min(attemptsAfterIncrement, 6)));

        await db.query(
          `
          UPDATE notification_dispatch_queue
          SET status = 'failed',
              locked_at = NULL,
              last_error = $2,
              next_retry_at = CASE
                WHEN attempts < max_attempts THEN NOW() + make_interval(mins => $3)
                ELSE NOW()
              END,
              updated_at = NOW()
          WHERE id = $1
          `,
          [job.id, String(error.message || "dispatch_error"), retryMinutes],
        );

        summary.failed += 1;
        if (hasRetry) summary.retriable += 1;
        logger.error(
          {
            queueId: job.id,
            notificationId: job.notification_id,
            channel: job.channel,
            error: error.message,
          },
          "[NOTIFICATIONS] Error despachando cola",
        );
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

      const subject = notification.title;
      const html = this.generateEmailHTML(notification, data);

      await sendMail({
        to,
        cc: explicitCc || null,
        subject,
        html,
        from: process.env.SMTP_FROM,
        senderName: "FamSPI Sistema",
        source: notification.source,
      });

      logger.info({ to, cc: explicitCc || null, subject, notificationId: notification.id }, "[NOTIFICATIONS] Email enviado");
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
      const { sendChatMessage } = require('../../utils/googleChat');

      const message = `🔔 *${notification.title}*\n\n${notification.message}`;

      await sendChatMessage({
        text: message,
        threadKey: `notification-${notification.id}`
      });

      logger.info({ notificationId: notification.id }, "[NOTIFICATIONS] Mensaje enviado a Google Chat");
    } catch (error) {
      logger.error({ error: error.message, notificationId: notification?.id }, "Error enviando mensaje a Chat");
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
   * Genera HTML para emails
   */
  generateEmailHTML(notification, data) {
    const typeColors = {
      info: '#3B82F6',
      task: '#10B981',
      alert: '#F59E0B',
      error: '#EF4444'
    };

    const color = typeColors[notification.type] || '#6B7280';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">${notification.title}</h2>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
          <p style="margin: 0; font-size: 16px; line-height: 1.5;">${notification.message}</p>
          <hr style="border: none; border-top: 1px solid #e9ecef; margin: 20px 0;">
          <p style="margin: 0; color: #6c757d; font-size: 14px;">
            Recibido: ${formatNotificationDateTime(notification.created_at)}
          </p>
        </div>
      </div>
    `;
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
