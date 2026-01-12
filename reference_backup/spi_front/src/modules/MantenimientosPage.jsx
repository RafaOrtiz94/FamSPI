import React, { useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "../core/layout/DashboardLayout";
import Button from "../core/ui/components/Button";
import Card from "../core/ui/components/Card";
import { FiPlus, FiRefreshCw, FiFileText, FiCheckCircle } from "react-icons/fi";
import { useApi } from "../core/hooks/useApi";
import { useUI } from "../core/ui/UIContext";
import {
  getMantenimientos,
  createMantenimiento,
  exportMantenimientoPDF,
} from "../core/api/mantenimientosApi";

const MantenimientosPage = () => {
  const { showToast, showLoader, hideLoader } = useUI();
  const { data, loading, execute: fetchData } = useApi(getMantenimientos, {
    globalLoader: true,
    errorMsg: "Error al cargar mantenimientos",
  });

  const load = useCallback(async () => {
    showLoader();
    try {
      await fetchData();
    } finally {
      hideLoader();
    }
  }, [fetchData, showLoader, hideLoader]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async (id) => {
    try {
      showLoader();
      const res = await exportMantenimientoPDF(id);
      showToast("PDF exportado correctamente", "success");
      window.open(res.link, "_blank");
    } catch (e) {
      showToast("Error al exportar PDF", "error");
    } finally {
      hideLoader();
    }
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="p-6"
      >
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Mantenimientos
          </h1>
          <div className="flex gap-2">
            <Button variant="secondary" icon={FiRefreshCw} onClick={load}>
              Actualizar
            </Button>
            <Button variant="primary" icon={FiPlus}>
              Nuevo
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Cargando...</p>
        ) : data?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((m) => (
              <Card key={m.id} className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-blue-600 dark:text-blue-400">
                    #{m.id} – {m.tipo}
                  </h3>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      m.estado === "pendiente"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {m.estado}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Responsable: <b>{m.responsable}</b>
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Observaciones: {m.observaciones || "—"}
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    icon={FiFileText}
                    onClick={() => handleExport(m.id)}
                  >
                    Exportar
                  </Button>
                  <Button
                    variant="secondary"
                    icon={FiCheckCircle}
                    onClick={() =>
                      showToast(`Aprobar mantenimiento #${m.id}`, "info")
                    }
                  >
                    Aprobar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            No hay mantenimientos registrados.
          </p>
        )}
      </motion.div>
    </DashboardLayout>
  );
};

export default MantenimientosPage;
