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
      request_assigned: {
        title: 'Solicitud Asignada',
        message: 'Se te ha asignado la solicitud #{request_title} (#{request_id}). Asignada por: #{assigner_name}.',
        type: 'task',
        priority: 1
      },
      request_status_changed: {
        title: 'Estado de Solicitud Actualizado',
        message: 'La solicitud #{request_title} (#{request_id}) cambió de estado: #{from_status} → #{to_status}.',
        type: 'info',
        priority: 1
      },
      request_completed: {
        title: 'Solicitud Completada',
        message: 'Tu solicitud #{request_title} (#{request_id}) ha sido completada exitosamente.',
        type: 'success',
        priority: 1
      },
      request_comment_added: {
        title: 'Nuevo Comentario',
        message: 'Nuevo comentario en solicitud #{request_title} (#{request_id}) por #{commenter_name}: #{comment_preview}.',
        type: 'info',
        priority: 0
      },
      request_attachment_added: {
        title: 'Documento Adjunto',
        message: 'Nuevo documento adjunto en solicitud #{request_title} (#{request_id}): #{filename}.',
        type: 'info',
        priority: 0
      },
      bc_created: {
        title: 'Business Case Creado',
        message: 'Nuevo Business Case creado: #{business_case_id} para cliente #{client_name}.',
        type: 'info',
        priority: 1
      },
      bc_state_transition: {
        title: 'Business Case - Estado Actualizado',
        message: 'Business Case #{business_case_id} cambió de estado: #{from_state} → #{to_state}. #{extra_info}',
        type: 'task',
        priority: 2
      },
      bc_equipment_added: {
        title: 'Equipo Agregado al BC',
        message: 'Nuevo equipo agregado al Business Case #{business_case_id}: #{equipment_name}.',
        type: 'info',
        priority: 0
      },
      bc_determination_added: {
        title: 'Determinación Agregada al BC',
        message: 'Nueva determinación agregada al Business Case #{business_case_id}: #{determination_name}.',
        type: 'info',
        priority: 0
      },
      bc_calculation_updated: {
        title: 'Cálculos Actualizados en BC',
        message: 'Los cálculos del Business Case #{business_case_id} han sido actualizados.',
        type: 'info',
        priority: 1
      },
      bc_validation_failed: {
        title: 'Validación Fallida en BC',
        message: 'Validación fallida en Business Case #{business_case_id}: #{validation_error}.',
        type: 'alert',
        priority: 3
      },
      custom_html: {
        title: '#{title}',
        message: '#{message}',
        type: 'info',
        priority: 0
      },
      private_purchase_state_transition: {
        title: 'Compra Privada - Estado Actualizado',
        message: 'Compra privada #{purchase_id} cambió de estado: #{from_state} → #{to_state}. Realizado por: #{transitioned_by}. #{reason}',
        type: 'task',
        priority: 2
      },
      private_purchase_created: {
        title: 'Nueva Solicitud de Compra Privada',
        message: 'Nueva solicitud de compra privada creada por #{creator_name} para cliente #{client_name}',
        type: 'info',
        priority: 1
      },
      private_purchase_offer_ready: {
        title: 'Oferta Lista para Revisión',
        message: 'Oferta preparada para cliente #{client_name} - requiere su revisión y firma',
        type: 'task',
        priority: 2
      },
      private_purchase_client_registered: {
        title: 'Cliente Registrado Exitosamente',
        message: 'Cliente #{client_name} registrado. Puede proceder con la subida de oferta firmada',
        type: 'success',
        priority: 1
      },
      private_purchase_contract_approval_needed: {
        title: 'Contrato Requiere Aprobación Final',
        message: 'Contrato de compra privada para cliente #{client_name} requiere aprobación de gerencia',
        type: 'alert',
        priority: 3
      },
      private_purchase_contract_available: {
        title: 'Contrato Disponible',
        message: 'Contrato de compra privada para cliente #{client_name} esta disponible. Solicitud #{purchase_id}.',
        type: 'info',
        priority: 2
      },
      private_purchase_delivery_date_requested: {
        title: 'Se requiere fecha de entrega',
        message: 'Operaciones solicita fecha de entrega para cliente #{client_name}. Solicitud #{purchase_id}.',
        type: 'task',
        priority: 2
      },
      private_purchase_delivery_date_set: {
        title: 'Fecha de entrega definida',
        message: 'Fecha de entrega definida para cliente #{client_name}: #{delivery_dates}. Solicitud #{purchase_id}.',
        type: 'task',
        priority: 2
      },
      private_purchase_delivery_scheduled: {
        title: 'Entrega Programada',
        message: 'Entrega programada para cliente #{client_name} en fechas: #{delivery_dates}',
        type: 'task',
        priority: 2
      },
      private_purchase_ready_for_delivery: {
        title: 'Listo para Entrega',
        message: 'Compra privada para cliente #{client_name} está lista para entrega final',
        type: 'success',
        priority: 1
      }
    };
  }

  /**
   * Envía notificación completa (BD + Email + Chat)
   * Soporta configuración dinámica de destinatarios
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
    to = null,
    recipients = null // Nuevo: lista explícita de destinatarios
  }) {
    console.log(`[NOTIFICATION_MANAGER] 🔄 Iniciando envío de notificación`, {
      template,
      userId,
      source,
      email,
      chat,
      skipSave,
      recipientCount: recipients?.length || 'auto'
    });

    try {
      // 1. Preparar datos de notificación
      const templateData = this.templates[template];
      if (!templateData && !customTitle) {
        throw new Error(`Template '${template}' no encontrado`);
      }

      const title = customTitle || this.interpolate(templateData.title, data);
      const message = customMessage || this.interpolate(templateData.message, data);

      console.log(`[NOTIFICATION_MANAGER] 📝 Notificación preparada`, {
        title: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        type: templateData?.type || 'info',
        priority: templateData?.priority || 0
      });

      // 2. Determinar destinatarios
      let targetRecipients = recipients;

      // Si no se proporcionaron destinatarios explícitos, buscar configuración
      if (!targetRecipients) {
        targetRecipients = await this._getConfiguredRecipients(template, source, userId);
      }

      // Si aún no hay destinatarios, usar el userId original como fallback
      if (!targetRecipients || targetRecipients.length === 0) {
        console.log(`[NOTIFICATION_MANAGER] ⚠️ Usando destinatario fallback: userId=${userId}`);
        targetRecipients = [{
          userId: userId,
          sendEmail: email,
          sendChat: chat,
          priority: priority || templateData?.priority || 0
        }];
      } else {
        console.log(`[NOTIFICATION_MANAGER] 👥 Destinatarios encontrados: ${targetRecipients.length}`, {
          recipients: targetRecipients.map(r => ({
            userId: r.userId,
            email: r.sendEmail,
            chat: r.sendChat
          }))
        });
      }

      const notifications = [];

      // 3. Enviar notificación a cada destinatario configurado
      for (const recipient of targetRecipients) {
        const notificationData = {
          user_id: recipient.userId,
          title,
          message,
          type: templateData?.type || 'info',
          source: source || template,
          priority: recipient.priority || priority || templateData?.priority || 0,
          meta: {
            ...meta,
            template,
            data,
            sent_at: new Date().toISOString(),
            recipient_config: {
              send_email: recipient.sendEmail,
              send_chat: recipient.sendChat,
              send_in_app: recipient.sendInApp
            }
          }
        };

        let notification = { ...notificationData, id: null, created_at: new Date() };

        // 4. Crear notificación en BD (si no se salta y hay usuario)
        if (!skipSave && recipient.userId) {
          // Lazy loading para evitar dependencia circular
          const { createNotification } = require('./notifications.service');
          notification = await createNotification(notificationData);
        }

        // 5. Enviar email si está configurado para este destinatario
        if (recipient.sendEmail) {
          await this.sendEmailNotification({
            ...notification,
            to: to || notification.to
          }, data, sender);
        }

        // 6. Enviar a Google Chat si está configurado para este destinatario
        if (recipient.sendChat) {
          await this.sendChatNotification(notification, data);
        }

        notifications.push(notification);
      }

      console.log(`[NOTIFICATION_MANAGER] ✅ Notificación completada exitosamente`, {
        totalRecipients: targetRecipients.length,
        notificationsCreated: notifications.filter(n => n.id).length,
        emailsSent: notifications.filter(n => n.meta?.recipient_config?.send_email).length,
        chatsSent: notifications.filter(n => n.meta?.recipient_config?.send_chat).length
      });

      return notifications.length === 1 ? notifications[0] : notifications;
    } catch (error) {
      console.error(`[NOTIFICATION_MANAGER] ❌ Error crítico enviando notificación: ${error.message}`, {
        template,
        userId,
        source,
        error: error.stack?.substring(0, 200)
      });
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
   * Obtiene destinatarios configurados para un evento (helper)
   * @private
   */
  async _getConfiguredRecipients(template, source, fallbackUserId = null) {
    try {
      const recipientsConfigService = require('./notificationRecipientsConfig.service');

      // Mapear template a event_type y source
      const eventType = this._mapTemplateToEventType(template);
      const eventSource = source || this._mapTemplateToEventSource(template);

      if (!eventType || !eventSource) {
        // Si no hay mapeo, usar fallback
        return fallbackUserId ? [{
          userId: fallbackUserId,
          sendEmail: true,
          sendChat: false,
          sendInApp: true,
          priority: 1
        }] : [];
      }

      const recipients = await recipientsConfigService.getRecipients(eventType, eventSource);

      if (!recipients || recipients.length === 0) {
        // Si no hay configuración, usar fallback
        return fallbackUserId ? [{
          userId: fallbackUserId,
          sendEmail: true,
          sendChat: false,
          sendInApp: true,
          priority: 1
        }] : [];
      }

      // Convertir formato de configuración al formato esperado
      return recipients.map(recipient => ({
        userId: recipient.user_id,
        sendEmail: recipient.send_email,
        sendChat: recipient.send_chat,
        sendInApp: recipient.send_in_app,
        priority: recipient.priority
      }));

    } catch (error) {
      console.warn('Error obteniendo configuración de destinatarios, usando fallback:', error.message);
      // En caso de error, usar fallback
      return fallbackUserId ? [{
        userId: fallbackUserId,
        sendEmail: true,
        sendChat: false,
        sendInApp: true,
        priority: 1
      }] : [];
    }
  }

  /**
   * Mapea template a event_type
   * @private
   */
  _mapTemplateToEventType(template) {
    const mappings = {
      // Requests
      'request_approved': 'approval',
      'request_rejected': 'rejection',
      'request_assigned': 'assigned',
      'request_status_changed': 'status_changed',
      'request_completed': 'completed',
      'request_comment_added': 'comment_added',
      'request_attachment_added': 'attachment_added',
      // Business Case
      'bc_created': 'created',
      'bc_state_transition': 'state_transition',
      'bc_equipment_added': 'equipment_added',
      'bc_determination_added': 'determination_added',
      'bc_calculation_updated': 'calculation_updated',
      'bc_validation_failed': 'validation_failed'
    };
    return mappings[template] || null;
  }

  /**
   * Mapea template a event_source
   * @private
   */
  _mapTemplateToEventSource(template) {
    if (template.startsWith('request_')) return 'requests';
    if (template.startsWith('bc_')) return 'business_case';
    return null;
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
