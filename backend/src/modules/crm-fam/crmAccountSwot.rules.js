// Reglas PURAS (sin base de datos) que proponen items del FODA de una cuenta a partir de los
// datos que el CRM ya tiene. Cada sugerencia lleva una `source_key` estable: es la que permite
// no volver a proponer lo ya aceptado o descartado.
//
// facts = {
//   account:   { classification },
//   contactCount,
//   opportunities: { open, won, lost, openAmount, wonAmount, contracts, contractsAmount, overdueClose },
//   lostReasons:   [{ reason, count }],
//   activities:    { overdue, completedLast90d },
//   plan:          { target_amount, sold_amount, remaining_to_target } | null,
//   strengths:     [{ id, description, impact_level }],
//   competitors:   [{ name, is_incumbent, threat_level }],
//   redFlags:      [{ id, title, severity }],
// }

const QUADRANTS = ['strength', 'opportunity', 'weakness', 'threat'];
const IMPACTS = ['high', 'medium', 'low'];

const money = (value) => `USD ${Number(value || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`;
const clip = (text, max) => {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};
const normImpact = (value, fallback = 'medium') => {
  const v = String(value || '').toLowerCase();
  if (['high', 'alto', 'alta', 'critical', 'critico', 'crítico'].includes(v)) return 'high';
  if (['low', 'bajo', 'baja'].includes(v)) return 'low';
  if (['medium', 'medio', 'media'].includes(v)) return 'medium';
  return fallback;
};
const keyOf = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);

function suggestSwot(facts = {}) {
  const out = [];
  const add = (quadrant, source_key, title, description, impact) =>
    out.push({ quadrant, source_key, title: clip(title, 200), description: description || null, impact, source: 'auto' });

  const opp = facts.opportunities || {};
  const act = facts.activities || {};
  const plan = facts.plan || null;
  const classification = String(facts.account?.classification || '').toLowerCase();
  const won = Number(opp.won || 0);
  const lost = Number(opp.lost || 0);
  const open = Number(opp.open || 0);
  const decided = won + lost;

  // ── Fortalezas ─────────────────────────────────────────────────────────────
  if (won >= 1) {
    add('strength', 'won_history', `Historial de compra: ${won} oportunidad(es) ganada(s)`,
      `La cuenta ya compró por ${money(opp.wonAmount)} en total.`, won >= 3 ? 'high' : 'medium');
  }
  if (classification === 'oro' || classification === 'plata') {
    add('strength', 'classification_top', `Cuenta clasificada ${classification === 'oro' ? 'Oro' : 'Plata'}`,
      'Cliente priorizado por la clasificación comercial.', classification === 'oro' ? 'high' : 'medium');
  }
  for (const s of facts.strengths || []) {
    add('strength', `bs_strength:${s.id}`, s.description, 'Fortaleza registrada en el Blue Sheet de una oportunidad.',
      normImpact(s.impact_level));
  }
  if (Number(act.completedLast90d || 0) >= 3) {
    add('strength', 'active_relationship', 'Relación activa con el cliente',
      `${act.completedLast90d} actividades completadas en los últimos 90 días.`, 'medium');
  }

  // ── Oportunidades ──────────────────────────────────────────────────────────
  if (open > 0) {
    add('opportunity', 'open_pipeline', `Pipeline abierto: ${open} oportunidad(es)`,
      `Suman ${money(opp.openAmount)} estimados en el embudo.`, open >= 3 ? 'high' : 'medium');
  }
  if (Number(opp.contracts || 0) > 0) {
    add('opportunity', 'contracts_stage', `${opp.contracts} oportunidad(es) en fase Contratos`,
      `Por ${money(opp.contractsAmount)}; cierre inminente.`, 'high');
  }
  if (plan && Number(plan.target_amount) > 0 && Number(plan.remaining_to_target) > 0) {
    const ratio = Number(plan.remaining_to_target) / Number(plan.target_amount);
    add('opportunity', 'target_gap', `Brecha frente a la meta del plan: ${money(plan.remaining_to_target)}`,
      `Meta ${money(plan.target_amount)}, vendido ${money(plan.sold_amount)}. Espacio para crecer.`,
      ratio >= 0.5 ? 'high' : 'medium');
  }

  // ── Debilidades ────────────────────────────────────────────────────────────
  if (lost >= 1) {
    const reasons = (facts.lostReasons || []).filter((r) => r.reason).slice(0, 3)
      .map((r) => `${r.reason} (${r.count})`).join('; ');
    add('weakness', 'lost_history', `${lost} oportunidad(es) perdida(s)`,
      reasons ? `Motivos: ${reasons}.` : 'Revisa los motivos de pérdida.',
      decided >= 2 && lost / decided >= 0.5 ? 'high' : 'medium');
  }
  if (open === 0 && (won + lost > 0 || plan)) {
    add('weakness', 'no_open_pipeline', 'Sin oportunidades abiertas',
      'No hay negocio en curso con esta cuenta.', plan ? 'high' : 'medium');
  }
  if (Number(act.overdue || 0) > 0) {
    add('weakness', 'overdue_activities', `${act.overdue} actividad(es) vencida(s)`,
      'Seguimientos pendientes sin completar.', Number(act.overdue) >= 3 ? 'high' : 'medium');
  }
  if (Number(act.completedLast90d || 0) === 0 && (won + lost + open > 0)) {
    add('weakness', 'stale_contact', 'Sin actividad completada en 90 días',
      'El contacto con la cuenta se ha enfriado.', 'medium');
  }
  if (Number(facts.contactCount || 0) === 0) {
    add('weakness', 'no_contacts', 'Sin contactos registrados',
      'No hay interlocutores identificados en la cuenta.', 'medium');
  }

  // ── Amenazas ───────────────────────────────────────────────────────────────
  const seenCompetitors = new Set();
  for (const c of facts.competitors || []) {
    const k = keyOf(c.name);
    if (!k || seenCompetitors.has(k)) continue;
    seenCompetitors.add(k);
    add('threat', `competitor:${k}`, `Competidor: ${c.name}`,
      c.is_incumbent ? 'Proveedor incumbente en la cuenta.' : 'Presente en oportunidades de la cuenta.',
      c.is_incumbent ? 'high' : normImpact(c.threat_level));
  }
  for (const f of facts.redFlags || []) {
    add('threat', `red_flag:${f.id}`, f.title || 'Alerta abierta',
      'Red flag abierta en el Blue Sheet de una oportunidad.', normImpact(f.severity, 'high'));
  }
  if (Number(opp.overdueClose || 0) > 0) {
    add('threat', 'overdue_close', `${opp.overdueClose} oportunidad(es) con fecha de cierre vencida`,
      'Riesgo de enfriamiento o pérdida si no se actualiza.', 'medium');
  }

  return out;
}

module.exports = { suggestSwot, QUADRANTS, IMPACTS };
