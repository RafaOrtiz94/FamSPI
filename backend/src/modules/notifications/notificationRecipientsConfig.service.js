/**
 * Notification Recipients Configuration Service
 *
 * Service for managing configurable notification recipients by event and role.
 * Allows dynamic configuration of who receives notifications without code changes.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");

/**
 * Get recipients for a specific event type and source
 * @param {string} eventType - Type of event (e.g., 'state_transition', 'approval')
 * @param {string} eventSource - Source module (e.g., 'business_case', 'requests')
 * @returns {Promise<Array>} Array of recipient configurations
 */
async function getRecipients(eventType, eventSource) {
    try {
        const { rows } = await db.query(`
      SELECT
        nrc.id,
        nrc.event_type,
        nrc.event_source,
        nrc.role,
        nrc.user_id,
        nrc.send_email,
        nrc.send_chat,
        nrc.send_in_app,
        nrc.priority,
        nrc.created_at,
        nrc.updated_at,
        -- Include user details for role-based configs
        CASE
          WHEN nrc.role IS NOT NULL THEN (
            SELECT json_build_object(
              'id', u.id,
              'email', u.email,
              'fullname', u.fullname,
              'role', u.role
            )
            FROM users u
            WHERE u.role = nrc.role AND u.active = true
            LIMIT 1
          )
          WHEN nrc.user_id IS NOT NULL THEN (
            SELECT json_build_object(
              'id', u.id,
              'email', u.email,
              'fullname', u.fullname,
              'role', u.role
            )
            FROM users u
            WHERE u.id = nrc.user_id AND u.active = true
            LIMIT 1
          )
          ELSE NULL
        END as user_details
      FROM notification_recipients_config nrc
      WHERE nrc.event_type = $1 AND nrc.event_source = $2
      ORDER BY nrc.priority DESC, nrc.created_at ASC
    `, [eventType, eventSource]);

        // Expand role-based recipients to individual users
        const expandedRecipients = [];

        for (const config of rows) {
            if (config.role && !config.user_id) {
                // Role-based: get all active users with this role
                const { rows: roleUsers } = await db.query(
                    'SELECT id, email, fullname, role FROM users WHERE role = $1 AND active = true',
                    [config.role]
                );

                for (const user of roleUsers) {
                    expandedRecipients.push({
                        id: config.id,
                        event_type: config.event_type,
                        event_source: config.event_source,
                        role: config.role,
                        user_id: user.id,
                        user_details: {
                            id: user.id,
                            email: user.email,
                            fullname: user.fullname,
                            role: user.role
                        },
                        send_email: config.send_email,
                        send_chat: config.send_chat,
                        send_in_app: config.send_in_app,
                        priority: config.priority,
                        created_at: config.created_at,
                        updated_at: config.updated_at
                    });
                }
            } else if (config.user_id) {
                // User-specific: single recipient
                expandedRecipients.push({
                    id: config.id,
                    event_type: config.event_type,
                    event_source: config.event_source,
                    role: config.role,
                    user_id: config.user_id,
                    user_details: config.user_details,
                    send_email: config.send_email,
                    send_chat: config.send_chat,
                    send_in_app: config.send_in_app,
                    priority: config.priority,
                    created_at: config.created_at,
                    updated_at: config.updated_at
                });
            }
        }

        return expandedRecipients;
    } catch (error) {
        logger.error({ error, eventType, eventSource }, 'Error getting notification recipients');
        throw error;
    }
}

/**
 * Add a new recipient configuration
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Created configuration
 */
async function addRecipient(config) {
    const {
        event_type,
        event_source,
        role,
        user_id,
        send_email = true,
        send_chat = false,
        send_in_app = true,
        priority = 1
    } = config;

    if (!event_type || !event_source) {
        throw new Error('event_type and event_source are required');
    }

    if (!role && !user_id) {
        throw new Error('Either role or user_id must be provided');
    }

    if (role && user_id) {
        throw new Error('Cannot specify both role and user_id');
    }

    try {
        const { rows } = await db.query(`
      INSERT INTO notification_recipients_config
        (event_type, event_source, role, user_id, send_email, send_chat, send_in_app, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [event_type, event_source, role, user_id, send_email, send_chat, send_in_app, priority]);

        logger.info({
            configId: rows[0].id,
            event_type,
            event_source,
            role,
            user_id
        }, 'Notification recipient configuration added');

        return rows[0];
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            throw new Error('Configuration already exists for this event, source, and recipient');
        }
        logger.error({ error, config }, 'Error adding notification recipient');
        throw error;
    }
}

/**
 * Update an existing recipient configuration
 * @param {number} id - Configuration ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated configuration
 */
async function updateRecipient(id, updates) {
    const allowedFields = ['send_email', 'send_chat', 'send_in_app', 'priority'];
    const updateFields = [];
    const values = [];

    allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
            updateFields.push(`${field} = $${values.length + 1}`);
            values.push(updates[field]);
        }
    });

    if (!updateFields.length) {
        throw new Error('No valid fields to update');
    }

    values.push(id);

    try {
        const { rows } = await db.query(`
      UPDATE notification_recipients_config
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `, values);

        if (!rows.length) {
            throw new Error('Configuration not found');
        }

        logger.info({ configId: id, updates }, 'Notification recipient configuration updated');

        return rows[0];
    } catch (error) {
        logger.error({ error, id, updates }, 'Error updating notification recipient');
        throw error;
    }
}

/**
 * Remove a recipient configuration
 * @param {number} id - Configuration ID
 * @returns {Promise<boolean>} True if deleted
 */
async function removeRecipient(id) {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM notification_recipients_config WHERE id = $1',
            [id]
        );

        if (rowCount === 0) {
            throw new Error('Configuration not found');
        }

        logger.info({ configId: id }, 'Notification recipient configuration removed');

        return true;
    } catch (error) {
        logger.error({ error, id }, 'Error removing notification recipient');
        throw error;
    }
}

/**
 * List all recipient configurations with optional filtering
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of configurations
 */
async function listRecipients(filters = {}) {
    const { event_type, event_source, role, user_id } = filters;

    let whereClause = '';
    const params = [];
    const conditions = [];

    if (event_type) {
        conditions.push(`event_type = $${params.length + 1}`);
        params.push(event_type);
    }

    if (event_source) {
        conditions.push(`event_source = $${params.length + 1}`);
        params.push(event_source);
    }

    if (role) {
        conditions.push(`role = $${params.length + 1}`);
        params.push(role);
    }

    if (user_id) {
        conditions.push(`user_id = $${params.length + 1}`);
        params.push(user_id);
    }

    if (conditions.length) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    try {
        const { rows } = await db.query(`
      SELECT * FROM notification_recipients_config
      ${whereClause}
      ORDER BY event_type, event_source, priority DESC, created_at ASC
    `, params);

        return rows;
    } catch (error) {
        logger.error({ error, filters }, 'Error listing notification recipients');
        throw error;
    }
}

/**
 * Get all event types and sources currently configured
 * @returns {Promise<Object>} Object with event_types and event_sources arrays
 */
async function getConfiguredEvents() {
    try {
        const { rows: typesRows } = await db.query(`
      SELECT DISTINCT event_type FROM notification_recipients_config ORDER BY event_type
    `);

        const { rows: sourcesRows } = await db.query(`
      SELECT DISTINCT event_source FROM notification_recipients_config ORDER BY event_source
    `);

        return {
            event_types: typesRows.map(r => r.event_type),
            event_sources: sourcesRows.map(r => r.event_source)
        };
    } catch (error) {
        logger.error({ error }, 'Error getting configured events');
        throw error;
    }
}

module.exports = {
    getRecipients,
    addRecipient,
    updateRecipient,
    removeRecipient,
    listRecipients,
    getConfiguredEvents
};