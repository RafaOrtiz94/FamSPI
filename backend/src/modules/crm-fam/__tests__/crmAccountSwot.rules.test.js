const { suggestSwot } = require('../crmAccountSwot.rules');

const base = {
  account: { classification: null },
  contactCount: 2,
  opportunities: { open: 0, won: 0, lost: 0, openAmount: 0, wonAmount: 0, contracts: 0, contractsAmount: 0, overdueClose: 0 },
  lostReasons: [],
  activities: { overdue: 0, completedLast90d: 0 },
  plan: null,
  strengths: [],
  competitors: [],
  redFlags: [],
};
const keys = (facts) => suggestSwot(facts).map((s) => s.source_key);
const find = (facts, key) => suggestSwot(facts).find((s) => s.source_key === key);

describe('suggestSwot', () => {
  test('cuenta sin historial ni plan no genera sugerencias (no inventa nada)', () => {
    expect(keys({ ...base })).toEqual([]);
  });

  test('sin contactos es una debilidad', () => {
    const s = find({ ...base, contactCount: 0 }, 'no_contacts');
    expect(s.quadrant).toBe('weakness');
  });

  test('historial ganado -> fortaleza; 3 o mas = impacto alto', () => {
    const f = { ...base, opportunities: { ...base.opportunities, won: 3, wonAmount: 150000 } };
    const s = find(f, 'won_history');
    expect(s.quadrant).toBe('strength');
    expect(s.impact).toBe('high');
    expect(s.description).toContain('150');
  });

  test('clasificacion oro/plata -> fortaleza; normal no sugiere nada', () => {
    expect(find({ ...base, account: { classification: 'oro' } }, 'classification_top').impact).toBe('high');
    expect(find({ ...base, account: { classification: 'plata' } }, 'classification_top').impact).toBe('medium');
    expect(find({ ...base, account: { classification: 'normal' } }, 'classification_top')).toBeUndefined();
  });

  test('fortalezas del Blue Sheet mantienen id estable e impacto', () => {
    const f = { ...base, strengths: [{ id: 'abc', description: 'Servicio tecnico local', impact_level: 'alto' }] };
    const s = find(f, 'bs_strength:abc');
    expect(s.quadrant).toBe('strength');
    expect(s.impact).toBe('high');
    expect(s.title).toBe('Servicio tecnico local');
  });

  test('pipeline abierto y Contratos -> oportunidades', () => {
    const f = { ...base, opportunities: { ...base.opportunities, open: 3, openAmount: 90000, contracts: 1, contractsAmount: 40000 } };
    expect(find(f, 'open_pipeline').quadrant).toBe('opportunity');
    expect(find(f, 'open_pipeline').impact).toBe('high');
    expect(find(f, 'contracts_stage').impact).toBe('high');
  });

  test('brecha frente a la meta del plan; >=50% = impacto alto', () => {
    const f = { ...base, plan: { target_amount: 1000000, sold_amount: 100000, remaining_to_target: 900000 } };
    const s = find(f, 'target_gap');
    expect(s.quadrant).toBe('opportunity');
    expect(s.impact).toBe('high');
    expect(find({ ...base, plan: { target_amount: 1000, sold_amount: 1000, remaining_to_target: 0 } }, 'target_gap')).toBeUndefined();
  });

  test('perdidas con motivos; mayoria perdida = impacto alto', () => {
    const f = {
      ...base,
      opportunities: { ...base.opportunities, won: 1, lost: 3 },
      lostReasons: [{ reason: 'Precio', count: 2 }, { reason: 'Competencia', count: 1 }],
    };
    const s = find(f, 'lost_history');
    expect(s.quadrant).toBe('weakness');
    expect(s.impact).toBe('high');
    expect(s.description).toContain('Precio (2)');
  });

  test('sin pipeline abierto solo si hubo historial o plan', () => {
    expect(find({ ...base }, 'no_open_pipeline')).toBeUndefined();
    expect(find({ ...base, opportunities: { ...base.opportunities, won: 1 } }, 'no_open_pipeline').quadrant).toBe('weakness');
    expect(find({ ...base, plan: { target_amount: 10, sold_amount: 0, remaining_to_target: 10 } }, 'no_open_pipeline').impact).toBe('high');
  });

  test('actividades vencidas y contacto frio', () => {
    const f = {
      ...base,
      opportunities: { ...base.opportunities, open: 1 },
      activities: { overdue: 4, completedLast90d: 0 },
    };
    expect(find(f, 'overdue_activities').impact).toBe('high');
    expect(find(f, 'stale_contact').quadrant).toBe('weakness');
  });

  test('competidores: un solo item por nombre y el incumbente es amenaza alta', () => {
    const f = {
      ...base,
      competitors: [
        { name: 'Roche', is_incumbent: true, threat_level: 'low' },
        { name: 'ROCHE', is_incumbent: false, threat_level: 'medium' },
        { name: 'Abbott', is_incumbent: false, threat_level: 'medium' },
      ],
    };
    const list = suggestSwot(f).filter((s) => s.quadrant === 'threat');
    expect(list).toHaveLength(2);
    expect(find(f, 'competitor:roche').impact).toBe('high');
    expect(find(f, 'competitor:abbott').impact).toBe('medium');
  });

  test('red flags criticas y fechas de cierre vencidas -> amenazas', () => {
    const f = {
      ...base,
      redFlags: [{ id: 'rf1', title: 'Sin presupuesto confirmado', severity: 'critical' }],
      opportunities: { ...base.opportunities, open: 2, overdueClose: 2 },
    };
    expect(find(f, 'red_flag:rf1').quadrant).toBe('threat');
    expect(find(f, 'red_flag:rf1').impact).toBe('high');
    expect(find(f, 'overdue_close').quadrant).toBe('threat');
  });

  test('las claves son estables entre ejecuciones y unicas', () => {
    const f = {
      ...base,
      account: { classification: 'oro' },
      opportunities: { ...base.opportunities, open: 2, won: 2, lost: 1, overdueClose: 1 },
      activities: { overdue: 1, completedLast90d: 5 },
    };
    const a = keys(f);
    expect(keys(f)).toEqual(a);
    expect(new Set(a).size).toBe(a.length);
  });

  test('titulo largo se recorta a 200 caracteres', () => {
    const f = { ...base, strengths: [{ id: 'x', description: 'a'.repeat(500), impact_level: 'medium' }] };
    expect(find(f, 'bs_strength:x').title.length).toBeLessThanOrEqual(200);
  });
});
