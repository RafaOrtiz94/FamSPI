import React from "react";
import EquipmentPurchaseWidget from "../components/EquipmentPurchaseWidget";

const EquipmentPurchasesPage = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Solicitudes de compra de equipos</h1>
      <EquipmentPurchaseWidget />
    </div>
  );
};

export default EquipmentPurchasesPage;
