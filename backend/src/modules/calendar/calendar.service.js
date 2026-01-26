const { calendar } = require("../../config/google");
const db = require("../../config/db");

/**
 * Service: Google Calendar Integration
 * ----------------------------------
 * Maneja la creación de eventos de entrega para compras privadas
 * reutilizando la autenticación Service Account existente.
 */

// Configuración del calendario compartido
const SHARED_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary'; // Fallback al calendario principal

/**
 * Obtiene emails de usuarios por roles específicos
 * @param {Array<string>} roles - Array de roles a buscar
 * @returns {Promise<Array<string>>} Array de emails
 */
async function getUserEmailsByRoles(roles) {
  try {
    const placeholders = roles.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await db.query(
      `SELECT DISTINCT email FROM users WHERE role = ANY($1) AND email IS NOT NULL`,
      [roles]
    );
    return rows.map(row => row.email);
  } catch (error) {
    console.error('[FLOW_PRIVADA][BE][FASE4][CALENDAR][ATTENDEES_RESOLVE][ERR]', 'Error obteniendo emails por roles:', error);
    return [];
  }
}

/**
 * Crea un evento de entrega en Google Calendar
 * @param {Object} params - Parámetros del evento
 * @param {string} params.purchaseId - ID de la compra privada
 * @param {string} params.clientName - Nombre del cliente
 * @param {Date} params.startAt - Fecha/hora inicio
 * @param {Date} params.endAt - Fecha/hora fin
 * @param {Array<string>} params.attendees - Lista de emails de asistentes
 * @returns {Promise<Object>} Resultado con eventId y htmlLink
 */
async function createDeliveryEvent({ purchaseId, clientName, startAt, endAt, attendees = [] }) {
  try {
    console.log('[FLOW_PRIVADA][BE][FASE4][CALENDAR][ATTENDEES_RESOLVE][OK]', {
      purchaseId,
      clientName,
      startAt,
      endAt,
      attendeesCount: attendees.length,
      attendees: attendees.map(email => email.substring(0, 3) + '***') // Log parcial por seguridad
    });

    const eventData = {
      summary: `Entrega Equipo - ${clientName}`,
      description: `Entrega de equipo para compra privada ${purchaseId}. Cliente: ${clientName}`,
      start: {
        dateTime: startAt.toISOString(),
        timeZone: 'America/Guayaquil'
      },
      end: {
        dateTime: endAt.toISOString(),
        timeZone: 'America/Guayaquil'
      },
      location: 'Establecimiento del cliente',
      attendees: attendees.map(email => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 10 * 24 * 60 }, // 10 dias antes
          { method: 'email', minutes: 24 * 60 }, // 24 horas antes
          { method: 'popup', minutes: 60 } // 1 hora antes
        ]
      },
      extendedProperties: {
        private: {
          purchaseId,
          clientName,
          eventType: 'delivery_schedule'
        }
      }
    };

    // Crear el evento usando el calendario compartido o primary
    const response = await calendar.events.insert({
      calendarId: SHARED_CALENDAR_ID,
      resource: eventData,
      sendUpdates: 'none' // No enviar emails automáticos, usamos NotificationManager
    });

    console.log('[FLOW_PRIVADA][BE][FASE4][CALENDAR][CREATE][OK]', {
      purchaseId,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink
    });

    return {
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      calendarId: SHARED_CALENDAR_ID,
      attendees: attendees
    };

  } catch (error) {
    console.error('[FLOW_PRIVADA][BE][FASE4][CALENDAR][CREATE][ERR]', {
      purchaseId,
      error: error.message,
      details: error.response?.data
    });

    // En caso de error, devolver null pero no fallar el proceso completo
    return null;
  }
}

/**
 * Crea eventos de entrega para una compra privada
 * @param {Object} params - Parámetros para crear eventos
 * @param {string} params.purchaseId - ID de la compra privada
 * @param {string} params.clientName - Nombre del cliente
 * @param {Date} params.deliveryStartAt - Fecha/hora inicio entrega
 * @param {Date} params.deliveryEndAt - Fecha/hora fin entrega
 * @returns {Promise<Object>} Resultado con eventos creados
 */
async function createDeliveryEvents({ purchaseId, clientName, deliveryStartAt, deliveryEndAt }) {
  try {
    // Obtener emails de roles relevantes
    const requiredRoles = [
      'asesor_comercial',
      'comercial',
      'jefe_comercial',
      'backoffice_comercial',
      'acp_comercial',
      'gerencia_general',
      'gerente_general',
      'jefe_operaciones',
      'jefe_logistica'
    ];
    const attendees = await getUserEmailsByRoles(requiredRoles);

    console.log('[FLOW_PRIVADA][BE][FASE4][CALENDAR][SKIP_ALREADY_EXISTS]', {
      purchaseId,
      roles: requiredRoles,
      attendeesFound: attendees.length
    });

    if (attendees.length === 0) {
      console.warn('[FLOW_PRIVADA][BE][FASE4][CALENDAR][ATTENDEES_RESOLVE][ERR]', 'No se encontraron emails para roles requeridos');
    }

    // Crear el evento principal de entrega
    const eventResult = await createDeliveryEvent({
      purchaseId,
      clientName,
      startAt: new Date(deliveryStartAt),
      endAt: new Date(deliveryEndAt),
      attendees
    });

    if (!eventResult) {
      throw new Error('No se pudo crear el evento de calendario');
    }

    return {
      success: true,
      eventId: eventResult.eventId,
      htmlLink: eventResult.htmlLink,
      calendarId: eventResult.calendarId,
      attendees: eventResult.attendees,
      metadata: {
        purchaseId,
        clientName,
        rolesNotified: requiredRoles,
        attendeesCount: attendees.length
      }
    };

  } catch (error) {
    console.error('[FLOW_PRIVADA][BE][FASE4][CALENDAR][CREATE][ERR]', {
      purchaseId,
      error: error.message
    });

    return {
      success: false,
      error: error.message,
      metadata: { purchaseId, clientName }
    };
  }
}

module.exports = {
  createDeliveryEvents,
  createDeliveryEvent,
  getUserEmailsByRoles
};
