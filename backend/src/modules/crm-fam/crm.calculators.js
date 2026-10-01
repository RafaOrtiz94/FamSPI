// Cada criterio que aporta al completeness score, con su etiqueta en
// espanol -- se usa tanto para calcular el score (suma de puntos de los
// criterios cumplidos) como para exponer un checklist visual en el frontend
// (getCompletenessBreakdown), sin duplicar la logica en dos lugares.
const COMPLETENESS_CRITERIA = [
  {
    key: 'sales_objective', label: 'Objetivo de venta definido (mínimo 30 caracteres)', points: 10,
    check: (ctx) => (ctx.blueSheet.sales_objective_text?.trim().length ?? 0) > 30,
  },
  {
    key: 'situation_current', label: 'Situación actual del cliente descrita', points: 8,
    check: (ctx) => (ctx.blueSheet.customer_situation_current?.trim().length ?? 0) > 20,
  },
  {
    key: 'situation_desired', label: 'Situación deseada del cliente descrita', points: 8,
    check: (ctx) => (ctx.blueSheet.customer_situation_desired?.trim().length ?? 0) > 20,
  },
  {
    key: 'buying_process', label: 'Proceso de compra descrito', points: 8,
    check: (ctx) => (ctx.blueSheet.buying_process_description?.trim().length ?? 0) > 20,
  },
  {
    key: 'strategy_summary', label: 'Resumen de estrategia definido (mínimo 50 caracteres)', points: 10,
    check: (ctx) => (ctx.blueSheet.strategy_summary?.trim().length ?? 0) > 50,
  },
  {
    key: 'economic_buyer', label: 'Comprador económico identificado', points: 12,
    check: (ctx) => ctx.buyingInfluences.some((i) => i.influence_role === 'economic_buyer' && !i.deleted_at),
  },
  {
    key: 'coach', label: 'Coach identificado', points: 8,
    check: (ctx) => ctx.buyingInfluences.some((i) => i.influence_role === 'coach' && !i.deleted_at),
  },
  {
    key: 'win_results', label: 'Resultado de venta (Win Result) registrado para cada influenciador', points: 10,
    check: (ctx) => {
      const activeBIs = ctx.buyingInfluences.filter((i) => !i.deleted_at);
      const hasWinResults = activeBIs.length > 0
        && activeBIs.every((bi) => ctx.winResults.some((wr) => wr.buying_influence_id === bi.id && !wr.deleted_at));
      return hasWinResults && ctx.winResults.filter((wr) => !wr.deleted_at).length > 0;
    },
  },
  {
    key: 'competitors', label: 'Al menos un competidor registrado', points: 6,
    check: (ctx) => ctx.competitors.filter((c) => !c.deleted_at).length > 0,
  },
  {
    key: 'strengths', label: 'Al menos una fortaleza registrada', points: 6,
    check: (ctx) => ctx.strengths.filter((s) => !s.deleted_at).length > 0,
  },
  {
    key: 'scorecard', label: 'Al menos 5 respuestas de scorecard', points: 8,
    check: (ctx) => ctx.scorecardAnswers.length >= 5,
  },
];

function getCompletenessBreakdown(ctx) {
  const items = COMPLETENESS_CRITERIA.map((c) => ({
    key: c.key, label: c.label, points: c.points, met: Boolean(c.check(ctx)),
  }));
  const score = Math.min(100, Math.round(items.reduce((sum, i) => sum + (i.met ? i.points : 0), 0)));
  return { score, items };
}

function calculateCompletenessScore(ctx) {
  return getCompletenessBreakdown(ctx).score;
}

function calculateScorecardScore(criteria, answers) {
  if (!criteria.length || !answers.length) return 0;
  const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight), 0);
  if (totalWeight === 0) return 0;
  let weightedSum = 0;
  for (const criterion of criteria) {
    const answer = answers.find(a => a.criterion_id === criterion.id);
    const score = answer ? Number(answer.score) : 0;
    weightedSum += (score / 5) * Number(criterion.weight);
  }
  return Math.min(100, Math.round((weightedSum / totalWeight) * 100));
}

function calculateHealthScore({ scorecardScore, completenessScore, actionItems, redFlags }) {
  const actionScore = (() => {
    const active = actionItems.filter(ai => ['pending', 'in_progress'].includes(ai.status) && !ai.deleted_at);
    const overdue = active.filter(ai => ai.due_date && new Date(ai.due_date) < new Date());
    if (active.length === 0) return 50;
    return Math.max(0, 100 - (overdue.length / active.length) * 100);
  })();
  const rfScore = (() => {
    const criticalOpen = redFlags.filter(rf => rf.severity === 'critical' && rf.status === 'open' && !rf.deleted_at);
    return criticalOpen.length === 0 ? 100 : Math.max(0, 100 - criticalOpen.length * 25);
  })();
  return Math.min(100, Math.round(
    scorecardScore * 0.40 +
    completenessScore * 0.30 +
    actionScore * 0.20 +
    rfScore * 0.10
  ));
}

function getHealthStatus(healthScore) {
  if (healthScore === null || healthScore === undefined) return 'gray';
  if (healthScore >= 75) return 'green';
  if (healthScore >= 50) return 'yellow';
  return 'red';
}

function getWeightedAmount(estimatedAmount, probabilityPct) {
  if (!estimatedAmount || !probabilityPct) return null;
  return Math.round(Number(estimatedAmount) * Number(probabilityPct) / 100 * 100) / 100;
}

module.exports = {
  calculateCompletenessScore,
  getCompletenessBreakdown,
  calculateScorecardScore,
  calculateHealthScore,
  getHealthStatus,
  getWeightedAmount,
};
