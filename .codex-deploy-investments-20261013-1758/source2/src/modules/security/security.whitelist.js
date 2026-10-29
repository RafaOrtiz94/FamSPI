const db = require("../../config/db");
const logger = require("../../config/logger");
const { logAction } = require("../../utils/audit");
const WHITELIST_TABLE_IDENTIFIER = "public.security_offhours_whitelist";
const TABLE_CACHE_TTL_MS = 60 * 1000;
let whitelistTableCache = {
  checkedAt: 0,
  exists: null,
};

/**
 * Security Whitelist Engine
 * Prevents false positive off-hours notifications
 */

// Helper to validate CIDR notation (basic validation)
function isValidCIDR(cidr) {
  if (!cidr || typeof cidr !== 'string') return false;

  const parts = cidr.split('/');
  if (parts.length !== 2) return false;

  const ip = parts[0];
  const mask = parseInt(parts[1]);

  // Basic IPv4 validation
  const ipParts = ip.split('.');
  if (ipParts.length !== 4) return false;

  for (const part of ipParts) {
    const num = parseInt(part);
    if (isNaN(num) || num < 0 || num > 255) return false;
  }

  // CIDR mask validation
  if (isNaN(mask) || mask < 0 || mask > 32) return false;

  return true;
}

async function isWhitelistTableAvailable() {
  const now = Date.now();
  if (
    whitelistTableCache.exists !== null &&
    now - whitelistTableCache.checkedAt < TABLE_CACHE_TTL_MS
  ) {
    return whitelistTableCache.exists;
  }

  const result = await db.query(
    "SELECT to_regclass($1)::text AS table_name",
    [WHITELIST_TABLE_IDENTIFIER]
  );

  whitelistTableCache = {
    checkedAt: now,
    exists: Boolean(result.rows[0]?.table_name),
  };

  return whitelistTableCache.exists;
}

async function assertWhitelistTableAvailable() {
  const exists = await isWhitelistTableAvailable();
  if (exists) {
    return true;
  }

  const error = new Error("La whitelist auxiliar de seguridad no esta disponible en este entorno");
  error.status = 503;
  throw error;
}

// Check if IP matches CIDR (basic implementation for common cases)
function ipMatchesCIDR(ip, cidr) {
  if (!ip || !cidr) return false;

  try {
    // For simplicity, exact match or wildcard support
    if (cidr.endsWith('.0/24')) {
      const base = cidr.replace('.0/24', '');
      return ip.startsWith(base + '.');
    }

    // Exact IP match
    return ip === cidr.split('/')[0];
  } catch (err) {
    logger.warn('[WHITELIST] Error matching CIDR:', err.message);
    return false;
  }
}

/**
 * Check if actor should be whitelisted for off-hours notifications
 * @param {string} actorEmail - Email of the actor
 * @param {string} reason - Off-hours reason (weekend, holiday, offhours)
 * @param {string} ip - IP address
 * @returns {Promise<{isWhitelisted: boolean, ruleId?: number}>}
 */
async function checkWhitelist(actorEmail, reason, ip) {
  try {
    if (!(await isWhitelistTableAvailable())) {
      logger.info("[WHITELIST] Tabla auxiliar no disponible; se omite whitelist");
      return { isWhitelisted: false, unavailable: true };
    }

    // Query active whitelist rules for this actor
    const query = `
      SELECT id, reason, ip_cidr
      FROM security_offhours_whitelist
      WHERE actor_email = $1
        AND enabled = true
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [actorEmail]);

    for (const rule of result.rows) {
      let matches = true;

      // Check reason filter (optional)
      if (rule.reason && rule.reason !== reason) {
        matches = false;
      }

      // Check IP filter (optional)
      if (rule.ip_cidr && !ipMatchesCIDR(ip, rule.ip_cidr)) {
        matches = false;
      }

      if (matches) {
        // Log whitelist hit
        await logAction({
          usuario_id: null, // System action
          usuario_email: 'system@security.whitelist',
          rol: 'system',
          modulo: 'security',
          accion: 'whitelist_hit',
          descripcion: `Whitelist hit for ${actorEmail} (${reason})`,
          datos_nuevos: {
            actor_email: actorEmail,
            reason: reason,
            ip_masked: ip ? ip.replace(/\.\d+$/, '.xxx') : null,
            rule_id: rule.id,
            rule_reason: rule.reason,
            rule_ip_cidr: rule.ip_cidr
          }
        }).catch(err => {
          logger.warn('[WHITELIST] Audit logging failed:', err.message);
        });

        logger.info('[WHITELIST] Actor whitelisted', {
          actor_email: actorEmail,
          reason: reason,
          rule_id: rule.id
        });

        return { isWhitelisted: true, ruleId: rule.id };
      }
    }

    return { isWhitelisted: false };

  } catch (err) {
    logger.error('[WHITELIST] Error checking whitelist:', err);
    // On error, allow notification (fail-open for security)
    return { isWhitelisted: false };
  }
}

/**
 * Get all whitelist rules
 * @returns {Promise<Array>}
 */
async function getWhitelistRules() {
  try {
    await assertWhitelistTableAvailable();

    const result = await db.query(`
      SELECT
        w.id,
        w.actor_email,
        w.reason,
        w.ip_cidr,
        w.enabled,
        w.notes,
        w.created_by,
        w.created_at,
        w.updated_at,
        u.fullname as created_by_name
      FROM security_offhours_whitelist w
      LEFT JOIN users u ON u.id = w.created_by
      ORDER BY w.created_at DESC
    `);

    return result.rows;
  } catch (err) {
    logger.error('[WHITELIST] Error getting whitelist rules:', err);
    throw err;
  }
}

/**
 * Create a new whitelist rule
 * @param {Object} ruleData
 * @param {number} createdBy - User ID creating the rule
 * @returns {Promise<Object>}
 */
async function createWhitelistRule(ruleData, createdBy) {
  const { actor_email, reason, ip_cidr, notes } = ruleData;

  if (!actor_email) {
    throw new Error('actor_email is required');
  }

  if (ip_cidr && !isValidCIDR(ip_cidr)) {
    throw new Error('Invalid IP CIDR format');
  }

  try {
    await assertWhitelistTableAvailable();

    const result = await db.query(`
      INSERT INTO security_offhours_whitelist
        (actor_email, reason, ip_cidr, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, actor_email, reason, ip_cidr, enabled, notes, created_at
    `, [actor_email, reason, ip_cidr, notes, createdBy]);

    const newRule = result.rows[0];

    // Audit log
    await logAction({
      usuario_id: createdBy,
      usuario_email: 'system@security.whitelist',
      rol: 'system',
      modulo: 'security',
      accion: 'whitelist_create',
      descripcion: `Created whitelist rule for ${actor_email}`,
      datos_nuevos: {
        rule_id: newRule.id,
        actor_email: newRule.actor_email,
        reason: newRule.reason,
        ip_cidr: newRule.ip_cidr
      }
    }).catch(err => logger.warn('[WHITELIST] Audit logging failed:', err.message));

    logger.info('[WHITELIST] Rule created', {
      rule_id: newRule.id,
      actor_email: newRule.actor_email
    });

    return newRule;

  } catch (err) {
    logger.error('[WHITELIST] Error creating whitelist rule:', err);
    throw err;
  }
}

/**
 * Update a whitelist rule
 * @param {number} ruleId
 * @param {Object} updates
 * @param {number} updatedBy - User ID making the update
 * @returns {Promise<Object>}
 */
async function updateWhitelistRule(ruleId, updates, updatedBy) {
  const { enabled, reason, ip_cidr, notes } = updates;

  if (ip_cidr !== undefined && ip_cidr !== null && !isValidCIDR(ip_cidr)) {
    throw new Error('Invalid IP CIDR format');
  }

  try {
    await assertWhitelistTableAvailable();

    const result = await db.query(`
      UPDATE security_offhours_whitelist
      SET
        enabled = COALESCE($1, enabled),
        reason = COALESCE($2, reason),
        ip_cidr = COALESCE($3, ip_cidr),
        notes = COALESCE($4, notes),
        updated_at = NOW()
      WHERE id = $5
      RETURNING id, actor_email, reason, ip_cidr, enabled, notes, updated_at
    `, [enabled, reason, ip_cidr, notes, ruleId]);

    if (result.rows.length === 0) {
      throw new Error('Whitelist rule not found');
    }

    const updatedRule = result.rows[0];

    // Audit log
    await logAction({
      usuario_id: updatedBy,
      usuario_email: 'system@security.whitelist',
      rol: 'system',
      modulo: 'security',
      accion: 'whitelist_update',
      descripcion: `Updated whitelist rule ${ruleId}`,
      datos_nuevos: {
        rule_id: updatedRule.id,
        changes: updates
      }
    }).catch(err => logger.warn('[WHITELIST] Audit logging failed:', err.message));

    logger.info('[WHITELIST] Rule updated', {
      rule_id: updatedRule.id,
      changes: Object.keys(updates)
    });

    return updatedRule;

  } catch (err) {
    logger.error('[WHITELIST] Error updating whitelist rule:', err);
    throw err;
  }
}

module.exports = {
  checkWhitelist,
  getWhitelistRules,
  createWhitelistRule,
  updateWhitelistRule,
  isValidCIDR,
  ipMatchesCIDR
};
