import React from 'react';

// Importar hook de auth
import { useAuth } from '../../../../core/auth/AuthContext';

// Importar páginas según rol
import EquipmentPurchasesPage from '../../../comercial/pages/EquipmentPurchases';
import ACPEquipmentPurchasesPage from '../../../comercial/pages/ACPEquipmentPurchases';

const PublicPurchasesTab = () => {
  const { user } = useAuth();

  // Determinar qué página mostrar según rol
  const isACP = user?.roles?.includes('acp_comercial');

  return (
    <div className="public-purchases-tab">
      {isACP ? (
        <ACPEquipmentPurchasesPage />
      ) : (
        <EquipmentPurchasesPage />
      )}
    </div>
  );
};

export default PublicPurchasesTab;