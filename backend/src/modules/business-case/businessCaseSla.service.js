/**
 * Business Case SLA Service
 *
 * Tracks time spent in each canonical state and alerts when SLA is at risk.
 * SLA config is defined per-state in business days. Non-configurable states
 * (terminals) have no SLA.
 */

const db = require('../../config/db');
const logger = require('../../config/logger');
const { STATES } = require('./businessCaseStates.constants');

// Default SLA in business days per state (configurable via admin)
const DEFAULT_SLA_BUSINESS_DAYS = {
  [STATES.DRAFT_INICIAL]:               5,
  [STATES.DATOS_BASE_COMPLETOS]:         3,
  [STATES.EN_EVALUACION_VIABILIDAD]:     5,
  [STATES.OBSERVADO_POR_VIABILIDAD]:     3,
  [STATES.VIABLE]:                       2,
  [STATES.AJUSTES_OPERATIVOS]:           7,
  [STATES.CERRADO_PARA_APROBACION]:      3,
  // Terminal states have no SLA
  [STATES.RECHAZADO_POR_GERENCIA]:       null,
  [STATES.CANCELADO]:                    null,
};

// Alert thresholds
const WARNING_THRESHOLD_PERCENT = 0.75; // warn when 75% of SLA elapsed
const CRITICAL_THRESHOLD_PERCENT = 1.0; // critical when 100%+ elapsed

/**
 * Calculate business days elapsed between two dates (Mon–Fri, no holidays).
 * Simple approximation — for production use, integrate a holiday calendar.
 */
function businessDaysElapsed(fromDate, toDate = new Date()) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  while (cursor <= to) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(0, count - 1); // subtract 1 to not count entry day
}

/**
 * Get SLA status for a business case's current state.
 * @param {string} businessCaseId
 * @returns {object} SLA status
 */
async function getSlaStatus(businessCaseId) {
  const { rows } = await db.query(
    `SELECT canonical_state, entered_state_at
     FROM v_business_cases_complete
     WHERE business_case_id = $1`,
    [businessCaseId]
  );

  if (!rows.length) throw new Error(`BC ${businessCaseId} not found`);

  const { canonical_state, entered_state_at } = rows[0];
  const slaDays = DEFAULT_SLA_BUSINESS_DAYS[canonical_state];

  if (slaDays === null || slaDays === undefined) {
    return { businessCaseId, state: canonical_state, hasSla: false };
  }

  const elapsed = entered_state_at ? businessDaysElapsed(entered_state_at) : 0;
  const percent = elapsed / slaDays;
  const remaining = Math.max(0, slaDays - elapsed);

  let status = 'on_track';
  if (percent >= CRITICAL_THRESHOLD_PERCENT) status = 'overdue';
  else if (percent >= WARNING_THRESHOLD_PERCENT) status = 'at_risk';

  return {
    businessCaseId,
    state: canonical_state,
    hasSla: true,
    slaDays,
    elapsedDays: elapsed,
    remainingDays: remaining,
    percentElapsed: Math.round(percent * 100),
    status,         // 'on_track' | 'at_risk' | 'overdue'
    enteredStateAt: entered_state_at,
  };
}

/**
 * Get all BCs that are at_risk or overdue (for dashboard / scheduler).
 * @returns {object[]}
 */
async function getAtRiskBcs() {
  const statesWithSla = Object.entries(DEFAULT_SLA_BUSINESS_DAYS)
    .filter(([, days]) => days !== null)
    .map(([state]) => state);

  const { rows } = await db.query(
    `SELECT business_case_id, client_name, canonical_state, entered_state_at, created_by
     FROM v_business_cases_complete
     WHERE canonical_state = ANY($1::text[])`,
    [statesWithSla]
  );

  const results = [];
  for (const row of rows) {
    const slaDays = DEFAULT_SLA_BUSINESS_DAYS[row.canonical_state];
    const elapsed = row.entered_state_at ? businessDaysElapsed(row.entered_state_at) : 0;
    const percent = elapsed / slaDays;
    if (percent >= WARNING_THRESHOLD_PERCENT) {
      results.push({
        businessCaseId: row.business_case_id,
        clientName: row.client_name,
        state: row.canonical_state,
        slaDays,
        elapsedDays: elapsed,
        remainingDays: Math.max(0, slaDays - elapsed),
        percentElapsed: Math.round(percent * 100),
        status: percent >= CRITICAL_THRESHOLD_PERCENT ? 'overdue' : 'at_risk',
        createdBy: row.created_by,
      });
    }
  }

  return results;
}

module.exports = {
  getSlaStatus,
  getAtRiskBcs,
  DEFAULT_SLA_BUSINESS_DAYS,
};
