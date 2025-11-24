import React, { useCallback, useEffect, useState } from "react";
import { FiUsers, FiSettings, FiDownload } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";
import Select from "../../core/ui/components/Select";
import AttendanceWidget from "../shared/components/AttendanceWidget";
import ClientRequestWidget from "../shared/components/ClientRequestWidget";
import { getUsers } from "../../core/api/usersApi";
import { getDepartments } from "../../core/api/departmentsApi";
import { downloadAttendancePDF } from "../../core/api/attendanceApi";

const TalentoDashboard = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Estados para reportes de asistencia
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [userOptions, setUserOptions] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [u, d] = await Promise.all([getUsers(), getDepartments()]);
        setUsers(u);
        setDepartments(d);

        // Preparar opciones para el selector de usuarios
        const rows = Array.isArray(u?.data) ? u.data : u;
        setUserOptions([
          { id: "all", nombre: "Todos los usuarios" },
          ...rows.map((user) => ({
            id: user.id,
            nombre: user.fullname || user.email || `Usuario #${user.id}`,
          })),
        ]);
      } catch (err) {
        console.error(err);
        toast.error("Error cargando datos de Talento Humano");
      } finally {
        setLoading(false);
      }
    };
    loadData();

    // Inicializar fechas con el mes actual
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(today.toISOString().split("T")[0]);
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    if (!startDate || !endDate) {
      return toast.error("Selecciona un rango de fechas.");
    }

    try {
      await downloadAttendancePDF(selectedUserId, startDate, endDate);
      toast.success("PDF generado correctamente");
    } catch (err) {
      console.error("❌ Error descargando PDF:", err);
      toast.error("No se pudo generar el PDF.");
    }
  }, [selectedUserId, startDate, endDate]);

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );

  const activos = users.filter((u) => u.role !== "pendiente").length;
  const pendientes = users.filter((u) => u.role === "pendiente").length;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">
        Panel de Talento Humano
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex flex-col items-center justify-center text-center p-5">
          <FiUsers className="text-blue-600 text-4xl mb-2" />
          <p className="text-sm text-gray-500">Usuarios Registrados</p>
          <p className="text-2xl font-semibold">{users.length}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center p-5">
          <FiSettings className="text-green-600 text-4xl mb-2" />
          <p className="text-sm text-gray-500">Departamentos</p>
          <p className="text-2xl font-semibold">{departments.length}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center p-5">
          <FiUsers className="text-yellow-600 text-4xl mb-2" />
          <p className="text-sm text-gray-500">Usuarios Activos</p>
          <p className="text-2xl font-semibold">{activos}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center p-5">
          <FiUsers className="text-red-600 text-4xl mb-2" />
          <p className="text-sm text-gray-500">Pendientes de asignación</p>
          <p className="text-2xl font-semibold">{pendientes}</p>
        </Card>
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttendanceWidget />
        <ClientRequestWidget />
      </div>

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
              options={userOptions.map((u) => ({ label: u.nombre, value: u.id }))}
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
          Exporta registros oficiales de asistencia del personal.
        </p>
      </Card>

      {/* Accesos directos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Gestión de Usuarios
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Administra los usuarios, roles y asignaciones por departamento.
            </p>
          </div>
          <Button
            onClick={() => navigate("/dashboard/usuarios")}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Ir a Usuarios
          </Button>
        </Card>

        <Card className="p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Departamentos
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Agrega, edita o elimina departamentos disponibles en el sistema.
            </p>
          </div>
          <Button
            onClick={() => navigate("/dashboard/departamentos")}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            Ir a Departamentos
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default TalentoDashboard;
