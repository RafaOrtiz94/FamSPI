import { normalizePreparingBusinessCase } from '../preparingBusinessCase';

const base = {
  business_case_id: 'bc-1',
  client_name: 'Hospital X',
  bc_purchase_type: 'private_comodato',
  bc_stage: 'pending_comercial',
  status: 'draft',
  modern_bc_metadata: { preflow_enabled: true },
};

describe('normalizePreparingBusinessCase', () => {
  it('lista un comodato del selector sin expediente', () => {
    expect(normalizePreparingBusinessCase(base)).toMatchObject({ id: 'bc-1', type: 'private', preparing: true });
    expect(normalizePreparingBusinessCase({ ...base, bc_purchase_type: 'public' }).type).toBe('public');
  });

  it.each([
    ['ya tiene expediente (preflow)', { modern_bc_metadata: { preflow_enabled: true, preflow_process_id: 9 } }],
    ['ya tiene expediente (handoff)', { modern_bc_metadata: { preflow_enabled: true, purchase_workspace: { purchase_id: 9 } } }],
    ['BC historico sin preflow', { modern_bc_metadata: {} }],
    ['no factible', { bc_stage: 'cerrado_no_factible' }],
    ['cancelado', { status: 'cancelled' }],
    ['tipo que no es comodato', { bc_purchase_type: 'otro' }],
  ])('omite: %s', (_label, override) => {
    expect(normalizePreparingBusinessCase({ ...base, ...override })).toBeNull();
  });
});
