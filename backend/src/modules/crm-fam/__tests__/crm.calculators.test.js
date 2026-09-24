const {
  calculateCompletenessScore,
  calculateScorecardScore,
  calculateHealthScore,
  getHealthStatus,
  getWeightedAmount,
} = require('../crm.calculators');

describe('getWeightedAmount', () => {
  test('50% of 1000 = 500', () => expect(getWeightedAmount(1000, 50)).toBe(500));
  test('null amount returns null', () => expect(getWeightedAmount(null, 50)).toBeNull());
  test('0 prob returns null', () => expect(getWeightedAmount(1000, 0)).toBeNull());
});

describe('getHealthStatus', () => {
  test('null → gray', () => expect(getHealthStatus(null)).toBe('gray'));
  test('75 → green', () => expect(getHealthStatus(75)).toBe('green'));
  test('74 → yellow', () => expect(getHealthStatus(74)).toBe('yellow'));
  test('50 → yellow', () => expect(getHealthStatus(50)).toBe('yellow'));
  test('49 → red', () => expect(getHealthStatus(49)).toBe('red'));
});

describe('calculateScorecardScore', () => {
  const criteria = [
    { id: 'a', weight: 2 },
    { id: 'b', weight: 3 },
  ];
  test('empty inputs → 0', () => expect(calculateScorecardScore([], [])).toBe(0));
  test('full score → 100', () => {
    const answers = [{ criterion_id: 'a', score: 5 }, { criterion_id: 'b', score: 5 }];
    expect(calculateScorecardScore(criteria, answers)).toBe(100);
  });
  test('missing answer treated as 0', () => {
    const answers = [{ criterion_id: 'a', score: 5 }];
    // a: (5/5)*2 = 2, b: 0*3 = 0 → 2/5 * 100 = 40
    expect(calculateScorecardScore(criteria, answers)).toBe(40);
  });
});

describe('calculateCompletenessScore', () => {
  const base = {
    blueSheet: {},
    buyingInfluences: [],
    winResults: [],
    competitors: [],
    strengths: [],
    redFlags: [],
    scorecardAnswers: [],
  };

  test('empty BS → 0', () => expect(calculateCompletenessScore(base)).toBe(0));

  test('economic_buyer adds points', () => {
    const score = calculateCompletenessScore({
      ...base,
      buyingInfluences: [{ influence_role: 'economic_buyer', deleted_at: null }],
    });
    expect(score).toBeGreaterThan(0);
  });

  test('strategy_summary ≥ 50 chars adds points', () => {
    const score = calculateCompletenessScore({
      ...base,
      blueSheet: { strategy_summary: 'x'.repeat(51) },
    });
    expect(score).toBeGreaterThan(0);
  });

  test('score never exceeds 100', () => {
    const full = {
      blueSheet: {
        sales_objective_text: 'x'.repeat(31),
        customer_situation_current: 'x'.repeat(21),
        customer_situation_desired: 'x'.repeat(21),
        buying_process_description: 'x'.repeat(21),
        strategy_summary: 'x'.repeat(51),
      },
      buyingInfluences: [
        { id: '1', influence_role: 'economic_buyer', deleted_at: null },
        { id: '2', influence_role: 'coach', deleted_at: null },
      ],
      winResults: [
        { buying_influence_id: '1', deleted_at: null },
        { buying_influence_id: '2', deleted_at: null },
      ],
      competitors: [{ deleted_at: null }],
      strengths: [{ deleted_at: null }],
      redFlags: [],
      scorecardAnswers: Array.from({ length: 5 }),
    };
    expect(calculateCompletenessScore(full)).toBeLessThanOrEqual(100);
  });
});

describe('calculateHealthScore', () => {
  test('no red flags, no overdue actions → high score', () => {
    const score = calculateHealthScore({
      scorecardScore: 80,
      completenessScore: 80,
      actionItems: [],
      redFlags: [],
    });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  test('critical open red flag reduces score', () => {
    const withFlag = calculateHealthScore({
      scorecardScore: 100,
      completenessScore: 100,
      actionItems: [],
      redFlags: [{ severity: 'critical', status: 'open', deleted_at: null }],
    });
    const withoutFlag = calculateHealthScore({
      scorecardScore: 100,
      completenessScore: 100,
      actionItems: [],
      redFlags: [],
    });
    expect(withFlag).toBeLessThan(withoutFlag);
  });

  test('all overdue actions reduce score', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const score = calculateHealthScore({
      scorecardScore: 80,
      completenessScore: 80,
      actionItems: [
        { status: 'pending', due_date: yesterday, deleted_at: null },
        { status: 'in_progress', due_date: yesterday, deleted_at: null },
      ],
      redFlags: [],
    });
    expect(score).toBeLessThan(80);
  });
});
