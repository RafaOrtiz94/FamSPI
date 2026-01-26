import React from 'react';

import PrivatePurchaseDeliveries from './PrivatePurchaseDeliveries';

const TecnicoPrivatePurchases = () => (
  <div className="space-y-4">
    <div className="px-1">
      <h1 className="text-2xl font-semibold text-gray-900">Compras privadas</h1>
      <p className="text-sm text-gray-500">
        Gestion de actas y entregas asignadas para servicio tecnico.
      </p>
    </div>
    <PrivatePurchaseDeliveries />
  </div>
);

export default TecnicoPrivatePurchases;
