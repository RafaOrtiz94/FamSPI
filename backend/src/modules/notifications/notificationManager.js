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
const loadNotificationService = () => require('./notifications.service');

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
        message: 'Equipo {equipment_name} requiere mantenimiento preventivo',
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
      message: 'Solicitada para #{client_name} ({offer_kind}) · revisa y responde cuanto antes',
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
        type: templateData?.type || 'info',
        source: source || template,
        priority: priority || templateData?.priority || 0,
        meta: { ...meta, template, data, sent_at: new Date().toISOString() }
      };

      // 2. Crear notificación en BD
      const notification = await loadNotificationService().createNotification(notificationData);

      // 3. Enviar email si está habilitado
      if (email) {
        await this.sendEmailNotification(notification, data);
      }

      // 4. Enviar a Google Chat si está habilitado
      if (chat) {
        await this.sendChatNotification(notification, data);
      }

      return notification;
    } catch (error) {
      console.error('Error enviando notificación:', error);
      throw error;
    }
  }

  /**
   * Envía notificación solo por email (reutiliza sendMail existente)
   */
  async sendEmailNotification(notification, data = {}) {
    try {
      // Buscar email del usuario (necesitarás implementar esta función)
      const userEmail = await this.getUserEmail(notification.user_id);
      if (!userEmail) return;

      const subject = notification.title;
      const html = this.generateEmailHTML(notification, data);

      await sendMail({
        to: userEmail,
        subject,
        html,
        from: process.env.SMTP_FROM,
        senderName: 'FamSPI Sistema'
      });

      console.log(`Email enviado a ${userEmail}: ${subject}`);
    } catch (error) {
      console.error('Error enviando email:', error);
      // No lanzamos error para no detener el flujo
    }
  }

  /**
   * Envía notificación a Google Chat (reutiliza sendChatMessage)
   */
  async sendChatNotification(notification, data = {}) {
    try {
      const { sendChatMessage } = require('../../utils/googleChat');

      const message = `🔔 *${notification.title}*\n\n${notification.message}`;

      await sendChatMessage({
        text: message,
        threadKey: `notification-${notification.id}`
      });

      console.log('Mensaje enviado a Google Chat');
    } catch (error) {
      console.error('Error enviando mensaje a Chat:', error);
      // No lanzamos error para no detener el flujo
    }
  }

  /**
   * Interpola placeholders en templates
   */
  interpolate(template, data) {
    return template.replace(/#\{(\w+)\}/g, (match, key) => {
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
            Recibido: ${new Date(notification.created_at).toLocaleString('es-ES')}
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
      const db = require('../../config/db');
      const { rows } = await db.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );
      return rows[0]?.email || null;
    } catch (error) {
      console.error('Error obteniendo email del usuario:', error);
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
