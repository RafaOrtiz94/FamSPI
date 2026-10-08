import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LabProductParametersCard from '../LabProductParametersCard';
import api from '../../../../../../core/api';

jest.mock('../../../../../../core/api', () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock('../../../../../../core/ui/UIContext', () => {
  const showToast = jest.fn();
  return { useUI: () => ({ showToast }) };
});

const reagent = {
  code: '11776223190',
  name: 'CA 125 II',
  itemType: 'reactivo',
  equipmentName: 'cobas e411 disk',
  spec: { status: 'extracted', sourceTitle: 'Elecsys CA 125 II', documentVersion: '5', sourceUrl: 'https://example.test/doc', presentation: { tests: 100 } },
  manufacturer: {
    calibration: { events: ['reagent_lot_change'], sameLotIntervalDays: 56, onboardKitIntervalDays: 7 },
    calibrationIntervalDays: 7,
    qcIntervalHours: 24,
    qcPerKit: true,
    onboardDays: 42,
    linkedCalibrators: [{ code: '7030207190', name: 'CA 125 II CalSet II', inBusinessCase: true }],
    linkedControls: [{ code: '11776452122', name: null, inBusinessCase: false }],
  },
  overrides: {},
  effective: { calibrationIntervalDays: 7, qcIntervalHours: 24, onboardDays: 42, openDays: null },
};

const calibrator = {
  code: '7030207190',
  name: 'CA 125 II CalSet II',
  itemType: 'calibrador',
  equipmentName: 'cobas e411 disk',
  spec: { status: 'verified', presentation: { containers: 4, volumeMl: 1 } },
  manufacturer: { openDays: 84, onboardAliquotSingleUse: true, calibration: {}, linkedCalibrators: [], linkedControls: [] },
  overrides: { open_days: 28 },
  effective: { openDays: 28 },
};

describe('LabProductParametersCard', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: { data: { available: true, items: [reagent, calibrator] } } });
  });

  it('muestra la calibracion del fabricante y los productos vinculados', async () => {
    render(<LabProductParametersCard bcId="bc-1" canEdit />);

    expect(await screen.findByText('CA 125 II')).toBeTruthy();
    expect(screen.getByText(/cambio de lote, 8 sem mismo lote, 1 sem mismo kit a bordo/)).toBeTruthy();
    expect(screen.getByText('24 h')).toBeTruthy();
    expect(screen.getByText('6 sem')).toBeTruthy();
    expect(screen.getByText('CA 125 II CalSet II')).toBeTruthy();
    expect(screen.getByText(/no está en el BC/)).toBeTruthy();
    expect(screen.getByText('1 producto(s) con ajuste del laboratorio')).toBeTruthy();
  });

  it('distingue el ajuste del laboratorio del valor del fabricante', async () => {
    render(<LabProductParametersCard bcId="bc-1" canEdit />);
    fireEvent.click(await screen.findByRole('tab', { name: /Calibradores/ }));

    expect(screen.getByText('4 sem')).toBeTruthy();
    expect(screen.getByText('Fabricante: 12 sem')).toBeTruthy();
    expect(screen.getByText(/Alícuota en analizador/)).toBeTruthy();
  });

  it('envia solo los productos editados', async () => {
    api.put.mockResolvedValue({ data: { data: { available: true, items: [reagent, calibrator] } } });
    render(<LabProductParametersCard bcId="bc-1" canEdit />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ajustar' }));
    fireEvent.change(screen.getAllByLabelText('Ajuste en horas')[0], { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar ajustes/ }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/business-case/bc-1/lab-environment/product-parameters',
      { items: [{ code: '11776223190', overrides: { qc_interval_hours: '12' } }] },
    ));
  });

  it('avisa cuando las migraciones de ficha tecnica no estan aplicadas', async () => {
    api.get.mockResolvedValue({ data: { data: { available: false, items: [] } } });
    render(<LabProductParametersCard bcId="bc-1" canEdit />);
    expect(await screen.findByText(/migraciones 305-307/)).toBeTruthy();
  });
});
