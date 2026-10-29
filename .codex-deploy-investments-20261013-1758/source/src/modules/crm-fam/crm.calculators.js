function calculateCompletenessScore({ blueSheet, buyingInfluences, winResults, competitors, strengths, redFlags, scorecardAnswers }) {
  let score = 0;
  if (blueSheet.sales_objective_text?.trim().length > 30) score += 10;
  if (blueSheet.customer_situation_current?.trim().length > 20) score += 8;
  if (blueSheet.customer_situation_desired?.trim().length > 20) score += 8;
  if (blueSheet.buying_process_description?.trim().length > 20) score += 8;
  if (blueSheet.strategy_summary?.trim().length > 50) score += 10;
  const hasEconomicBuyer = buyingInfluences.some(i => i.influence_role === 'economic_buyer' && !i.deleted_at);
  if (hasEconomicBuyer) score += 12;
  const hasCoach = buyingInfluences.some(i => i.influence_role === 'coach' && !i.deleted_at);
  if (hasCoach) score += 8;
  const activeBIs = buyingInfluences.filter(i => !i.deleted_at);
  const hasWinResults = activeBIs.length > 0 && activeBIs.every(bi => winResults.some(wr => wr.buying_influence_id === bi.id && !wr.deleted_at));
  if (hasWinResults && winResults.filter(wr => !wr.deleted_at).length > 0) score += 10;
  if (competitors.filter(c => !c.deleted_at).length > 0) score += 6;
  if (strengths.filter(s => !s.deleted_at).length > 0) score += 6;
  if (scorecardAnswers.length >= 5) score += 8;
  return Math.min(100, Math.round(score));
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
  calculateScorecardScore,
  calculateHealthScore,
  getHealthStatus,
  getWeightedAmount,
};
