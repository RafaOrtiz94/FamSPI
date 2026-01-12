import React from "react";
import { motion } from "framer-motion";
import DashboardLayout from "../core/layout/DashboardLayout";
import { FiAlertCircle } from "react-icons/fi";
import Card from "../core/ui/components/Card";

const DocumentsPage = () => {
  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="p-6 space-y-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Documentos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Vista general del repositorio documental.
          </p>
        </div>

        <Card className="p-6 flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <FiAlertCircle size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Vista no disponible
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              La vista consolidada de documentos aún no cuenta con soporte en el backend,
              por lo que se deshabilitó temporalmente para evitar errores. Consulta los
              documentos desde el detalle de cada solicitud mientras se completa esta
              integración.
            </p>
          </div>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
};

export default DocumentsPage;
