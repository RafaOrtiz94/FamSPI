// src/modules/private-purchases/PrivatePurchasesPage.jsx
import React, { useState } from 'react';
import PrivatePurchasesList from '../components/PrivatePurchasesList';
import PrivatePurchasesDetail from '../components/PrivatePurchasesDetail';

const PrivatePurchasesPage = () => {
  const [selectedItem, setSelectedItem] = useState(null);

  const handleSelectItem = (item) => {
    setSelectedItem(item);
  };

  const handleBack = () => {
    setSelectedItem(null);
  };

  return (
    <div>
      {selectedItem ? (
        <PrivatePurchasesDetail item={selectedItem} onBack={handleBack} />
      ) : (
        <PrivatePurchasesList onSelectItem={handleSelectItem} />
      )}
    </div>
  );
};

export default PrivatePurchasesPage;
