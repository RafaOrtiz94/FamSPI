/**
 * BC Section Access Audit Service
 * Records read/write access to sensitive sections (prices, investments).
 * Write is fire-and-forget — never throws to avoid blocking the request.
 */

const db = require('../../config/db');
const logger = require('../../config/logger');

const AUDITED_SECTIONS = new Set(['prices', 'investments']);

/**
 * Log a section access event.
 * @param {object} params
 */
async function logAccess({ businessCaseId, userId, userRole, section, accessType = 'read', ipAddress = null, userAgent = null }) {
  if (!AUDITED_SECTIONS.has(section)) return;
  try {
    await db.query(
      `INSERT INTO bc_section_access_log
         (business_case_id, user_id, user_role, section, access_type, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::inet, $7)`,
      [businessCaseId, userId, userRole || null, section, accessType, ipAddress || null, userAgent || null]
    );
  } catch (err) {
    logger.warn({ err, businessCaseId, section }, 'Failed to write BC section access audit');
  }
}

/**
 * Get access log for a BC (for admin/audit view).
 * @param {string} businessCaseId
 * @param {object} options
 */
async function getAccessLog(businessCaseId, { section = null, limit = 100 } = {}) {
  const { rows } = await db.query(
    `SELECT l.id, l.section, l.access_type, l.accessed_at, l.user_role,
            u.fullname AS user_name, u.email AS user_email, l.ip_address
     FROM bc_section_access_log l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE l.business_case_id = $1
       AND ($2::text IS NULL OR l.section = $2)
     ORDER BY l.accessed_at DESC
     LIMIT $3`,
    [businessCaseId, section, limit]
  );
  return rows;
}

module.exports = { logAccess, getAccessLog, AUDITED_SECTIONS };
