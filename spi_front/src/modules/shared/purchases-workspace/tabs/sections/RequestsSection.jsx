import React from "react";
import { motion } from "framer-motion";
import Card from "../../../../../core/ui/components/Card";
import EquipmentPurchaseWidget from "../../../../comercial/components/EquipmentPurchaseWidget";

export const RequestsSection = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div>
        <h2 className="text-base font-semibold text-slate-900">Solicitudes de Compras Públicas</h2>
        <p className="text-xs text-slate-500">Flujo operativo con checklist automático y acciones por etapa.</p>
      </div>
      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <EquipmentPurchaseWidget showCreation={false} compactList />
      </Card>
    </motion.div>
  );
};
