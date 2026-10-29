/**
 * Utils: approvalToken
 * --------------------
 * - Genera tokens únicos SHA256
 * - Inserta en tabla request_approvals
 * - Devuelve link directo al endpoint de aprobación
 */

const crypto = require("crypto");
const db = require("../config/db");
const logger = require("../config/logger");

async function generateApprovalToken(request_id, approver_id) {
  try {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000); // 72h
    await db.query(
      `INSERT INTO request_approvals (request_id, approver_id, token, token_expires_at)
       VALUES ($1,$2,$3,$4)`,
      [request_id, approver_id, token, expiresAt]
    );
    return token;
  } catch (err) {
    logger.error({ err }, "❌ generateApprovalToken");
    throw err;
  }
}

function generateApprovalLink(token) {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/api/v1/approvals/${token}`;
}

module.exports = { generateApprovalToken, generateApprovalLink };
