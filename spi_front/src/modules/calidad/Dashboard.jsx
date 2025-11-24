import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { FiRefreshCw } from "react-icons/fi";

import { useUI } from "../../core/ui/useUI";

import AttendanceWidget from "../shared/components/AttendanceWidget";
import ClientRequestWidget from "../shared/components/ClientRequestWidget";
import Button from "../../core/ui/components/Button";

const DashboardCalidad = () => {
  const { showToast } = useUI();

  // ----------------  Refresh ----------------
  const refresh = useCallback(() => {
    showToast("Panel actualizado correctamente.", "success");
  }, [showToast]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Calidad y Mejora Continua
          </h1>
          <p className="text-sm text-gray-500">
            Seguimiento de procesos internos, certificaciones y control documental.
          </p>
        </div>

        <Button variant="secondary" icon={FiRefreshCw} onClick={refresh}>
          Actualizar
        </Button>
      </header>

      {/* Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttendanceWidget />
        <ClientRequestWidget />
      </div>
    </motion.section>
  );
};

export default DashboardCalidad;
