import React from "react";
import EquipmentPurchaseWidget from "../components/EquipmentPurchaseWidget";

const EquipmentPurchasesPage = () => {
  return (
    <div className="p-6">
      {/* Vista de seguimiento solo lectura para comercial (creación y acciones quedan para ACP/gerencia) */}
      <EquipmentPurchaseWidget showCreation={false} compactList />
    </div>
  );
};

export default EquipmentPurchasesPage;
