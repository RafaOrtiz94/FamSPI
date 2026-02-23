import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PurchaseTypeSelector from '../PurchaseTypeSelector';

describe('PurchaseTypeSelector', () => {
  it('emite payload completo para compra privada venta', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    render(
      <PurchaseTypeSelector
        isOpen
        onClose={onClose}
        origin="solicitudes"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /seleccionar compra privada/i }));
    fireEvent.click(screen.getByRole('button', { name: /venta/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      purchaseFamily: 'private',
      purchaseKind: 'venta',
      startFrom: 'existing_modal',
      origin: 'solicitudes',
    });
  });

  it('emite payload preflow para compra publica', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    render(
      <PurchaseTypeSelector
        isOpen
        onClose={onClose}
        origin="dashboard"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /seleccionar compra publica/i }));
    fireEvent.click(screen.getByRole('button', { name: /comodato/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      purchaseFamily: 'public',
      purchaseKind: 'comodato_publico',
      startFrom: 'business_case_preflow',
      origin: 'dashboard',
    });
  });
});
