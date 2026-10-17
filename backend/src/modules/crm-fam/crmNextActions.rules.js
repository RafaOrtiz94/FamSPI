// "Siguiente mejor acción": reglas puras que ordenan las oportunidades abiertas por urgencia y
// dicen por qué y qué hacer. No inventan datos: cada señal sale de un hecho del CRM o del expediente.
// Entrada por oportunidad: { id, name, account_id, account_name, estimated_amount,
//   estimated_close_date, stage_name, days_in_stage, pending_activities, blue_sheet_status, journey }.

const DAY = 86400000;
const OFFER_FOLLOWUP_DAYS = 7;
const CONTRACT_FOLLOWUP_DAYS = 7;
const STAGE_STALL_DAYS = 30;
const CLOSING_SOON_DAYS = 7;

const daysBetween = (from, to) => Math.floor((to - new Date(from).getTime()) / DAY);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function signalsFor(opp, now) {
  const signals = [];
  const add = (code, weight, reason, action) => signals.push({ code, weight, reason, action });
  const journey = opp.journey || null;
  const milestone = (key) => journey?.milestones.find((m) => m.key === key) || null;

  if (journey?.blocked) {
    add("blocked", 90, `${journey.blocked.label} detenido: ${String(journey.blocked.detail || "").toLowerCase()}`,
      "Revisa el expediente y decide si se replantea o se cierra la oportunidad");
  }
  const offer = milestone("oferta");
  if (offer?.state === "current" && offer.at && /enviada/i.test(offer.detail || "")) {
    const days = daysBetween(offer.at, now);
    if (days >= OFFER_FOLLOWUP_DAYS) add("offer_unsigned", 80, `Oferta enviada hace ${plural(days, "día")} sin firma`, "Da seguimiento al cliente por la firma de la oferta");
  }
  const contract = milestone("contrato");
  if (contract?.state === "current" && contract.at) {
    const days = daysBetween(contract.at, now);
    if (days >= CONTRACT_FOLLOWUP_DAYS) add("contract_pending", 75, `Contrato en firma hace ${plural(days, "día")}`, "Destraba la firma del contrato");
  }
  if (opp.estimated_close_date) {
    const days = daysBetween(opp.estimated_close_date, now);
    if (days > 0) add("close_overdue", 70, `Cierre estimado vencido hace ${plural(days, "día")}`, "Actualiza la fecha de cierre o cierra la oportunidad");
    else if (-days <= CLOSING_SOON_DAYS) add("closing_soon", 60, days === 0 ? "Cierra hoy" : `Cierra en ${plural(-days, "día")}`, "Confirma con el cliente los pasos que faltan para cerrar");
  }
  if (["observed", "needs_update"].includes(opp.blue_sheet_status)) {
    add("blue_sheet", 55, opp.blue_sheet_status === "observed" ? "Blue Sheet observado por tu jefe" : "Blue Sheet desactualizado", "Corrige el Blue Sheet y vuelve a enviarlo a revisión");
  }
  if (Number(opp.days_in_stage) >= STAGE_STALL_DAYS) {
    add("stalled", 50, `${plural(Number(opp.days_in_stage), "día")} en ${opp.stage_name || "la misma fase"}`, "Define el siguiente paso para que avance de fase");
  }
  if (!Number(opp.pending_activities)) {
    add("no_next_step", 40, "Sin próxima actividad programada", "Programa la siguiente gestión con el cliente");
  }
  if (!opp.account_id) {
    add("no_account", 30, "Sin cuenta vinculada", "Vincula la cuenta del cliente para ver sus contactos y su historial");
  }
  return signals.sort((a, b) => b.weight - a.weight);
}

// Lista priorizada. La urgencia manda; el monto solo desempata entre urgencias parecidas.
function rankNextActions(opportunities = [], { now = Date.now(), limit = 20 } = {}) {
  return opportunities
    .map((opp) => {
      const signals = signalsFor(opp, now);
      if (!signals.length) return null;
      const amount = Number(opp.estimated_amount) || 0;
      const score = signals[0].weight + Math.min(signals.length - 1, 4) * 4 + Math.min(Math.log10(amount + 1), 7);
      return {
        opportunity_id: opp.id,
        name: opp.name,
        account_id: opp.account_id || null,
        account_name: opp.account_name || null,
        owner_name: opp.owner_name || null,
        stage_name: opp.stage_name || null,
        estimated_amount: opp.estimated_amount ?? null,
        score: Number(score.toFixed(2)),
        code: signals[0].code,
        reason: signals[0].reason,
        action: signals[0].action,
        more: signals.slice(1).map((s) => s.reason),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { rankNextActions, signalsFor };
