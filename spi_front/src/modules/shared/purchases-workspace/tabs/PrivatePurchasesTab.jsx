import React from 'react';

// Importar hook de auth
import { useAuth } from '../../../../core/auth/AuthContext';

// Importar páginas según rol
import OperacionesPrivatePurchases from '../../../operaciones/pages/OperacionesPrivatePurchases';
import LogisticaPrivatePurchases from '../../../logistica/pages/LogisticaPrivatePurchases';
import PrivatePurchasesPage from '../../../backoffice/pages/PrivatePurchases';

const PrivatePurchasesTab = () => {
  const { user } = useAuth();

  // Determinar qué página mostrar según rol
  const isJefeOperaciones = user?.roles?.includes('jefe_operaciones');
  const isJefeLogistica = user?.roles?.includes('jefe_logistica');

  let PageComponent;
  if (isJefeOperaciones) {
    PageComponent = OperacionesPrivatePurchases;
  } else if (isJefeLogistica) {
    PageComponent = LogisticaPrivatePurchases;
  } else {
    // backoffice_comercial y roles comerciales/gerencia
    PageComponent = PrivatePurchasesPage;
  }

  return (
    <div className="private-purchases-tab">
      <PageComponent />
    </div>
  );
};

export default PrivatePurchasesTab;