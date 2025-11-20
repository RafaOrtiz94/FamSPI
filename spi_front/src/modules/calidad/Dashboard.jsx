import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FiRefreshCw, FiDownload } from "react-icons/fi";

import { useUI } from "../../core/ui/useUI";
import { downloadAttendancePDF } from "../../core/api/attendanceApi";
import { getUsers } from "../../core/api/usersApi";

import AttendanceWidget from "../shared/components/AttendanceWidget";
import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";
import Select from "../../core/ui/components/Select";

const DashboardCalidad = () => {
  const { showToast } = useUI();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [users, setUsers] = useState([]);

  // ---------------- 📌 Cargar lista de usuarios ----------------
  const loadUsers = async () => {
    try {
      const res = await getUsers();
      const rows = Array.isArray(res?.data) ? res.data : res;

      setUsers([
        { id: "all", nombre: "Todos los usuarios" },
        ...rows.map((u) => ({
          id: u.id,
          nombre: u.fullname || u.email || `Usuario #${u.id}`,
        })),
      ]);
    } catch (err) {
      console.error("❌ Error al cargar usuarios:", err);
      showToast("No se pudieron obtener los usuarios.", "error");
    }
  };

  // ---------------- 🔄 Refresh ----------------
  const refresh = useCallback(() => {
    showToast("Panel actualizado correctamente.", "success");
  }, [showToast]);

  // ---------------- 🧠 Inicio ----------------
  useEffect(() => {
    refresh();
    loadUsers();

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(today.toISOString().split("T")[0]);
  }, [refresh]);

  // ---------------- 📄 Generar PDF ----------------
  const handleDownloadPDF = async () => {
    if (!startDate || !endDate) {
      return showToast("Selecciona un rango de fechas.", "error");
    }

    try {
      await downloadAttendancePDF(selectedUserId, startDate, endDate);
      showToast("PDF generado correctamente", "success");
    } catch (err) {
      console.error("❌ Error descargando PDF:", err);
      showToast("No se pudo generar el PDF.", "error");
    }
  };

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
      <AttendanceWidget />

      {/* Reporte PDF asistencia */}
      <Card className="p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Reportes de Asistencia
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>

          {/* Select usuario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usuario
            </label>
            <Select
              value={selectedUserId}
              options={users.map((u) => ({ label: u.nombre, value: u.id }))}
              onChange={(e) => setSelectedUserId(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="primary"
              icon={FiDownload}
              onClick={handleDownloadPDF}
              className="w-full"
            >
              Descargar PDF
            </Button>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Exporta registros oficiales de asistencia para auditorías internas ISO.
        </p>
      </Card>
    </motion.section>
  );
};

export default DashboardCalidad;
