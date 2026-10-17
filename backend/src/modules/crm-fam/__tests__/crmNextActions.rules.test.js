const { rankNextActions } = require('../crmNextActions.rules');

const NOW = new Date('2026-10-13T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();
const base = { id: 'o1', name: 'Opp', account_id: 'a1', account_name: 'Cuenta', estimated_amount: 1000, pending_activities: 1, days_in_stage: 3, stage_name: 'Negociación' };
const rank = (opps) => rankNextActions(opps, { now: NOW });
const journey = (milestones, blocked = null) => ({ milestones, blocked });

describe('rankNextActions', () => {
  test('una oportunidad al día no genera acción', () => {
    expect(rank([{ ...base }])).toEqual([]);
  });

  test('hito detenido es lo más urgente', () => {
    const blocked = { key: 'disponibilidad', label: 'Disponibilidad', state: 'blocked', detail: 'Sin disponibilidad' };
    const [first] = rank([
      { ...base, id: 'a', estimated_close_date: daysAgo(-2) },
      { ...base, id: 'b', journey: journey([blocked], blocked) },
    ]);
    expect(first.opportunity_id).toBe('b');
    expect(first.code).toBe('blocked');
    expect(first.reason).toBe('Disponibilidad detenido: sin disponibilidad');
  });

  test('oferta enviada sin firma: solo avisa pasado el plazo de seguimiento', () => {
    const offer = (days) => journey([{ key: 'oferta', label: 'Oferta', state: 'current', detail: 'Oferta enviada, pendiente de firma', at: daysAgo(days) }]);
    expect(rank([{ ...base, journey: offer(3) }])).toEqual([]);
    const [item] = rank([{ ...base, journey: offer(12) }]);
    expect(item.code).toBe('offer_unsigned');
    expect(item.reason).toBe('Oferta enviada hace 12 días sin firma');
  });

  test('cierre vencido y cierre próximo', () => {
    expect(rank([{ ...base, estimated_close_date: daysAgo(5) }])[0]).toMatchObject({ code: 'close_overdue', reason: 'Cierre estimado vencido hace 5 días' });
    expect(rank([{ ...base, estimated_close_date: daysAgo(-3) }])[0].code).toBe('closing_soon');
    expect(rank([{ ...base, estimated_close_date: daysAgo(-30) }])).toEqual([]);
  });

  test('estancada, sin próximo paso y sin cuenta se acumulan como señales secundarias', () => {
    const [item] = rank([{ ...base, days_in_stage: 45, pending_activities: 0, account_id: null }]);
    expect(item.code).toBe('stalled');
    expect(item.reason).toBe('45 días en Negociación');
    expect(item.more).toEqual(['Sin próxima actividad programada', 'Sin cuenta vinculada']);
  });

  test('a igual urgencia, el monto desempata; el límite recorta', () => {
    const list = rank([
      { ...base, id: 'small', pending_activities: 0, estimated_amount: 100 },
      { ...base, id: 'big', pending_activities: 0, estimated_amount: 500000 },
    ]);
    expect(list.map((i) => i.opportunity_id)).toEqual(['big', 'small']);
    expect(rankNextActions([{ ...base, pending_activities: 0 }, { ...base, id: 'o2', pending_activities: 0 }], { now: NOW, limit: 1 })).toHaveLength(1);
  });
});
