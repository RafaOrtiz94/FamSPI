import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PricingLabSection from '../PricingLabSection';
import api from '../../../../../../core/api';

// react-router-dom 7 es ESM y el Jest de CRA de este proyecto requiere un mock virtual.
jest.mock('react-router-dom', () => ({ useParams: () => ({ id: 'bc-1' }) }), { virtual: true });
jest.mock('../../../../../../core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'jefe_ti' } }),
}));
jest.mock('../../../../../../core/api', () => ({ get: jest.fn(), post: jest.fn() }));

const ruleItem = ({
  equipmentId,
  equipmentName,
  family,
  status = 'calculated',
  quantity = 8,
  reason = null,
}) => ({
  equipmentId,
  equipmentCode: `EQ-${equipmentId}`,
  equipmentName,
  family,
  itemType: 'control',
  supplierCode: '00123',
  itemKey: `control-${equipmentId}`,
  name: equipmentId === 1 ? 'Control A' : 'Control B',
  status,
  reason,
  reasons: reason ? [reason] : [],
  quantity,
  unit: quantity === null ? null : 'cajas',
  formula: quantity === null ? null : 'ROUNDUP(eventos / usos_por_caja)',
  inputs: {
    processDurationMonths: { value: 12, origin: 'bc_requirements.projected_deadline_months' },
    effectiveParameters: {
      openDays: { value: 28, origin: 'manufacturer.stability_open_days' },
    },
  },
  specVersion: { id: 44, validFrom: '2026-01-01', validTo: null },
  source: {
    title: 'Method Sheet Control A',
    url: 'https://example.test/control-a',
    documentVersion: '3',
  },
  verification: {
    specStatus: quantity === null ? 'extracted' : 'verified',
    specVerified: quantity !== null,
    calculationVerified: quantity !== null,
  },
});

const equipment = ({ id, name, family, item, registeredQuantity, historicalQuantity }) => ({
  equipmentId: id,
  equipmentName: name,
  status: 'calculated',
  scope: { family },
  inputs: {},
  inputEvidence: {},
  blockers: [],
  warnings: [],
  ruleEngine: {
    mode: 'shadow_read_only',
    publishable: false,
    offerWriteEnabled: false,
    summary: {
      productCount: 1,
      calculatedCount: item.status === 'calculated' ? 1 : 0,
      noRuleCount: item.status === 'no_rule' ? 1 : 0,
      verifiedCalculationCount: item.verification.calculationVerified ? 1 : 0,
    },
    items: [item],
  },
  predictiveModel: {
    items: [{
      equipmentId: id,
      productId: '123',
      productName: item.name,
      itemType: 'control',
      registeredQuantity,
      historical: historicalQuantity === null ? null : {
        selectedQuantity: historicalQuantity,
        selectedMethod: 'nearest',
        peerCount: 4,
      },
      suggestedQuantity: 99,
    }],
    blockers: [],
  },
  calculation: null,
});

const hematologyItem = ruleItem({
  equipmentId: 1,
  equipmentName: 'XN-1000',
  family: 'hematology',
});
const chemistryItem = ruleItem({
  equipmentId: 2,
  equipmentName: 'cobas c 303',
  family: 'chemistry',
  status: 'no_rule',
  quantity: null,
  reason: { code: 'RULE_ADAPTER_NOT_REGISTERED', message: 'No existe una regla validada para este producto.' },
});

const payload = {
  modality: 'determinacion',
  sheetSync: { requested: false, ok: null },
  globalBlockers: [],
  summary: { calculatedCount: 2, equipmentCount: 2, blockerCount: 0, calculationReady: true },
  equipment: [
    equipment({
      id: 1,
      name: 'XN-1000',
      family: 'hematology',
      item: hematologyItem,
      registeredQuantity: 6,
      historicalQuantity: 7,
    }),
    equipment({
      id: 2,
      name: 'cobas c 303',
      family: 'chemistry',
      item: chemistryItem,
      registeredQuantity: 5,
      historicalQuantity: null,
    }),
  ],
};

const simulationPayload = {
  stored: true,
  automatic: { status: 'manual' },
  equipment: [{
    equipmentId: 3,
    equipmentName: 'Equipo simulado',
    scenarios: 5000,
    seed: 42,
    durationMs: 1200,
    profile: { monthlyDemand: 500, months: 12, reagentCount: 1, workDaysPerWeek: 6, shifts: 2 },
    coverage: { validatedCount: 0 },
    trigger: 'auto',
    history: [{ id: 1, trigger: 'auto', scenarios: 5000, createdAt: '2026-10-14T10:00:00Z', p90Totals: { reactivo: 12, calibrador: 3, control: 9, material: 2 } }],
    similarClients: [{ businessCaseId: 'bc-2', clientName: 'Cliente parecido', distance: 0.2, profile: { monthlyDemand: 450, months: 12 } }],
    variables: [{ key: 'rerunRate', label: 'Pruebas repetidas', range: '1 % a 6 %' }],
    products: [{
      key: 'control::777', itemType: 'control', supplierCode: '777', name: 'Control simulado', unit: 'presentacion',
      deterministicQuantity: 4, p10: 3, p50: 5, p90: 9, p95: 11,
      prediction: { quantity: 6, basis: 'calibrated_by_similar_clients', calibratedWith: 1 },
      similar: { clients: 1, p50: 6, p90: 8, validated: 7, validatedClients: 1 },
      deliveriesByQuarter: [{ fromMonth: 1, toMonth: 3, p90: 3 }],
    }],
  }],
};

let automaticSimulation = { automatic: { status: 'no_statistics' }, equipment: [] };

describe('PricingLabSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => Promise.resolve({
      data: { ok: true, data: url.includes('/simulations') ? automaticSimulation : payload },
    }));
    api.post.mockImplementation((url) => Promise.resolve({
      data: { ok: true, data: url.includes('/simulations') ? simulationPayload : payload },
    }));
  });

  it('compara regla, hoja e histórico por equipo sin mezclar códigos repetidos', async () => {
    render(<PricingLabSection />);

    expect((await screen.findAllByText('Control A')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Control B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('00123')).toHaveLength(2);
    expect(screen.getByText('8 cajas')).toBeTruthy();
    expect(screen.getByText('Hoja: +2')).toBeTruthy();
    expect(screen.getByText('Histórico: +1')).toBeTruthy();
    expect(screen.getAllByText('Sin regla').length).toBeGreaterThan(0);
    expect(screen.getByText('EN CONSTRUCCIÓN')).toBeTruthy();
    expect(screen.getByText('Solo Jefe TI')).toBeTruthy();
  });

  it('filtra con opciones derivadas del payload por familia, tipo, estado y búsqueda', async () => {
    render(<PricingLabSection />);
    await screen.findAllByText('Control A');

    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'chemistry' } });
    expect(screen.queryByText('Control A')).toBeNull();
    expect(screen.getAllByText('Control B').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'control' } });
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'calculated' } });
    fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'Control A' } });

    expect(screen.getAllByText('Control A').length).toBeGreaterThan(0);
    expect(screen.queryByText('Control B')).toBeNull();
  });

  it('expone fórmula, entradas, versión, fuente y verificación en un detalle accesible', async () => {
    render(<PricingLabSection />);
    await screen.findAllByText('Control A');
    const row = screen.getAllByRole('row', { name: /Control A/ })[0];

    fireEvent.click(within(row).getByText('Ver detalle'));

    expect(within(row).getByText('ROUNDUP(eventos / usos_por_caja)')).toBeTruthy();
    expect(within(row).getByText('processDurationMonths')).toBeTruthy();
    expect(within(row).getByText(/ID 44/)).toBeTruthy();
    expect(within(row).getAllByText(/Cálculo verificado/i).length).toBeGreaterThan(0);
    expect(within(row).getByRole('link', { name: /Method Sheet Control A v3/ }).getAttribute('href'))
      .toBe('https://example.test/control-a');
  });

  it('mantiene el POST de lectura del Sheet sin guardar', async () => {
    render(<PricingLabSection />);
    await screen.findAllByText('Control A');

    fireEvent.click(screen.getByRole('button', { name: 'Leer Sheet y calcular sin guardar' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/business-case/bc-1/pricing-lab/preview', {}));
  });

  it('muestra la simulación automática al abrir, sin acción del usuario', async () => {
    automaticSimulation = { ...simulationPayload, automatic: { status: 'simulated' } };
    render(<PricingLabSection />);
    expect(await screen.findByText('Control simulado')).toBeTruthy();
    expect(screen.getByText(/Se simuló ahora porque cambiaron las estadísticas/)).toBeTruthy();
    expect(screen.getByText(/Ajustada con 1 cliente/)).toBeTruthy();
    expect(screen.getByText(/Historial de simulaciones \(1\)/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalledWith('/business-case/bc-1/pricing-lab/simulations', expect.anything());
    automaticSimulation = { automatic: { status: 'no_statistics' }, equipment: [] };
  });

  it('permite recalcular a pedido y muestra percentiles, clientes parecidos y entregas', async () => {
    render(<PricingLabSection />);
    await screen.findAllByText('Control A');
    expect(screen.getByText(/Aún no hay estadísticas del cliente/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Recalcular 5.000 escenarios/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/business-case/bc-1/pricing-lab/simulations', { scenarios: 5000 }));
    expect(await screen.findByText('Control simulado')).toBeTruthy();
    expect(screen.getByText(/1 cliente\(s\): P50 6/)).toBeTruthy();
    expect(screen.getByText(/Validado en 1: 7/)).toBeTruthy();
    expect(screen.getByText(/Año 1: 3/)).toBeTruthy();
    expect(screen.getByText(/Cliente parecido/)).toBeTruthy();
  });
});
