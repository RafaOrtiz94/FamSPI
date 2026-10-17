const { buildJourney } = require('../crmOpportunityJourney.rules');

const states = (journey) => Object.fromEntries(journey.milestones.map((m) => [m.key, m.state]));
const find = (journey, key) => journey.milestones.find((m) => m.key === key);

describe('buildJourney', () => {
  test('oportunidad sin expedientes no tiene recorrido', () => {
    expect(buildJourney({})).toBeNull();
  });

  test('compra privada recién creada: todo pendiente y sin hito de factibilidad', () => {
    const journey = buildJourney({ privates: [{ id: 'p1', status: 'pending_backoffice', updated_at: '2026-01-02T10:00:00Z' }] });
    expect(journey.reference).toMatchObject({ type: 'private_purchase', id: 'p1' });
    expect(states(journey)).toEqual({
      cliente: 'pending', disponibilidad: 'pending', oferta: 'pending', contrato: 'pending', entrega: 'pending', consumibles: 'pending',
    });
    expect(journey.progress).toEqual({ done: 0, total: 6 });
  });

  test('disponibilidad: consultada, confirmada y rechazada', () => {
    const base = { id: 'p1', updated_at: '2026-01-02T10:00:00Z' };
    expect(states(buildJourney({ privates: [{ ...base, status: 'acp_availability_requested' }] })).disponibilidad).toBe('current');
    expect(states(buildJourney({ privates: [{ ...base, status: 'pending_backoffice', provider_response_at: '2026-01-03T10:00:00Z' }] })).disponibilidad).toBe('done');
    const rejected = buildJourney({ privates: [{ ...base, status: 'acp_availability_rejected' }] });
    expect(states(rejected).disponibilidad).toBe('blocked');
    expect(rejected.blocked.key).toBe('disponibilidad');
  });

  test('Business Case: factible, no factible y en análisis', () => {
    const bc = (stage) => ({ businessCases: [{ id: 'b1', bc_stage: stage, updated_at: '2026-02-01T00:00:00Z' }] });
    expect(states(buildJourney(bc('factible'))).factibilidad).toBe('done');
    expect(states(buildJourney(bc('cerrado_no_factible'))).factibilidad).toBe('blocked');
    expect(states(buildJourney(bc('esperando_calculos'))).factibilidad).toBe('current');
    expect(buildJourney(bc('factible')).reference.type).toBe('business_case');
  });

  test('oferta enviada queda en curso con su documento; firmada queda hecha', () => {
    const sent = buildJourney({ privates: [{ id: 'p1', status: 'offer_sent', offer_document_id: 'DRIVE1' }] });
    expect(find(sent, 'oferta')).toMatchObject({ state: 'current', documents: [{ label: 'Oferta', url: 'https://drive.google.com/file/d/DRIVE1/view' }] });
    const signed = buildJourney({ privates: [{ id: 'p1', status: 'offer_signed', offer_document_id: 'DRIVE1', offer_signed_document_id: 'DRIVE2', offer_signed_uploaded_at: '2026-03-01T00:00:00Z' }] });
    expect(find(signed, 'oferta')).toMatchObject({ state: 'done', at: '2026-03-01T00:00:00.000Z' });
    expect(find(signed, 'oferta').documents).toHaveLength(2);
    expect(signed.documents_count).toBe(2);
  });

  test('contrato en firma, firmado y rechazado', () => {
    const p = (extra) => ({ privates: [{ id: 'p1', status: 'pending_contract_client_signature', ...extra }] });
    expect(states(buildJourney(p({ contract_document_id: 'C1' }))).contrato).toBe('current');
    expect(states(buildJourney(p({ contract_client_signed_uploaded_at: '2026-04-01T00:00:00Z' }))).contrato).toBe('done');
    expect(states(buildJourney(p({ status: 'contract_rejected' }))).contrato).toBe('blocked');
  });

  test('cliente registrado, entrega y consumibles completan el recorrido', () => {
    const journey = buildJourney({
      privates: [{
        id: 'p1', status: 'delivered_signed', client_registered_at: '2026-01-05T00:00:00Z', provider_response_at: '2026-01-06T00:00:00Z',
        offer_signed_uploaded_at: '2026-01-10T00:00:00Z', contract_signed_uploaded_at: '2026-01-20T00:00:00Z',
        delivery_act_delivered_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z',
      }],
      consumables: [{ id: 'f1', registered_at: '2026-02-03T00:00:00Z' }],
    });
    expect(journey.progress).toEqual({ done: 6, total: 6 });
    expect(journey.blocked).toBeNull();
    expect(journey.last_update).toBe('2026-02-03T00:00:00.000Z');
  });

  test('solicitud de cliente aprobada marca el hito aunque no haya compra', () => {
    const journey = buildJourney({ clientRequests: [{ id: 1, status: 'approved', approved_at: '2026-01-01T00:00:00Z' }] });
    expect(journey.reference).toBeNull();
    expect(states(journey).cliente).toBe('done');
  });

  test('compra pública: proforma firmada y contrato cargado', () => {
    const journey = buildJourney({ publics: [{ id: 'e1', status: 'x', client_id: 7, signed_proforma_uploaded_at: '2026-05-01T00:00:00Z', contract_uploaded_at: '2026-05-10T00:00:00Z', contract_file_id: 'K1' }] });
    expect(states(journey)).toMatchObject({ cliente: 'done', oferta: 'done', contrato: 'done' });
    expect(journey.reference.type).toBe('public_purchase');
  });
});
