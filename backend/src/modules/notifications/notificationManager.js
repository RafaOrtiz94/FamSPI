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

const notificationService = require('./notifications.service');
const { sendMail } = require('../../utils/mailer');

class NotificationManager {
  constructor() {
    this.templates = {
      // Templates reutilizables para notificaciones
      request_approved: {
        title: 'Solicitud Aprobada',
        message: 'Tu solicitud "#{request_title}" (#{request_id}) ha sido aprobada por #{approver_name}. #{extra_info}',
        type: 'task',
        priority: 1
      },
      request_rejected: {
        title: 'Solicitud Rechazada',
        message: 'Tu solicitud "#{request_title}" (#{request_id}) ha sido rechazada por #{approver_name}. #{extra_info}',
        type: 'alert',
        priority: 2
      },
      maintenance_due: {
        title: 'Mantenimiento Programado',
        message: 'Mantenimiento ##{maintenance_id} para equipo #{equipment_name} programado para #{due_date}. Tipo: #{maintenance_type}. Responsable: #{responsible}.',
        type: 'alert',
        priority: 1
      },
      equipment_available: {
        title: 'Equipo Disponible',
        message: 'El equipo solicitado está listo para entrega',
        type: 'task',
        priority: 0
      },
      maintenance_conflict: {
        title: 'Conflicto de Mantenimiento',
        message: '#{detail}. Equipo: #{equipment_name}. Tipo: #{maintenance_type}.',
        type: 'error',
        priority: 2
      },
      request_pending: {
        title: 'Solicitud Pendiente',
        message: 'Solicitud pendiente de aprobación. Tipo: #{request_type}. Solicitante: #{requester_name}.',
        type: 'info',
        priority: 1
      },
      custom_html: {
        title: '#{title}',
        message: '#{message}',
        type: 'info',
        priority: 0
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
    meta = {},
    sender = null,
    skipSave = false,
    to = null
  }) {
    try {
      // 1. Preparar datos de notificación
      const templateData = this.templates[template];
      if (!templateData && !customTitle) {
        throw new Error(`Template '${template}' no encontrado`);
      }

      const title = customTitle || this.interpolate(templateData.title, data);
      const message = customMessage || this.interpolate(templateData.message, data);

      const notificationData = {
        user_id: userId,
        title,
        message,
        type: templateData?.type || 'info',
        source: source || template,
        priority: priority || templateData?.priority || 0,
        meta: { ...meta, template, data, sent_at: new Date().toISOString() }
      };

      let notification = { ...notificationData, id: null, created_at: new Date() };

      // 2. Crear notificación en BD (si no se salta y hay usuario)
      if (!skipSave && userId) {
        notification = await notificationService.createNotification(notificationData);
      }

      // 3. Enviar email si está habilitado
      if (email) {
        // Si hay 'to' explícito, lo pasamos en 'sender' o 'data' para que sendEmailNotification lo use
        // O mejor, pasamos 'to' como argumento a sendEmailNotification
        await this.sendEmailNotification({ ...notification, to: to || notification.to }, data, sender);
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
  async sendEmailNotification(notification, data = {}, sender = null) {
    try {
      // Determinar destinatario: 'to' explícito en notificación > búsqueda por user_id
      let userEmail = notification.to;
      
      if (!userEmail && notification.user_id) {
        userEmail = await this.getUserEmail(notification.user_id);
      }

      if (!userEmail) {
        console.warn(`No se pudo determinar email para notificación: ${notification.title}`);
        return;
      }

      const subject = notification.title;
      const html = this.generateEmailHTML(notification, data);

      const mailOptions = {
        to: userEmail,
        subject,
        html,
        from: sender?.from || process.env.SMTP_FROM,
        cc: sender?.cc,
        bcc: sender?.bcc,
        senderName: sender?.name || 'FamSPI Sistema',
        replyTo: sender?.replyTo,
        delegatedUser: sender?.delegatedUser,
        gmailUserId: sender?.gmailUserId
      };

      await sendMail(mailOptions);

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

    const linkHtml = data.link 
      ? `<div style="margin-top: 20px; text-align: center;">
           <a href="${data.link}" style="background-color: ${color}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver Detalles</a>
         </div>`
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">${notification.title}</h2>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
          <p style="margin: 0; font-size: 16px; line-height: 1.5;">${notification.message}</p>
          ${linkHtml}
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
    const { sender, ...restData } = data;
    return this.sendNotification({
      userId,
      template: 'request_approved',
      data: { request_id: requestId, extra_info: '', ...restData },
      email: true,
      source: 'requests',
      sender
    });
  }

  async notifyRequestRejected(userId, requestId, data = {}) {
    const { sender, ...restData } = data;
    return this.sendNotification({
      userId,
      template: 'request_rejected',
      data: { request_id: requestId, extra_info: '', ...restData },
      email: true,
      source: 'requests',
      sender
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