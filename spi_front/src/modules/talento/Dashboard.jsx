import React, { useCallback, useEffect, useState } from "react";
import { FiUsers, FiSettings, FiRefreshCw, FiClipboard } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";
import ActionCard from "../../core/ui/patterns/ActionCard";
import AttendanceWidget from "../../core/ui/widgets/AttendanceWidget";
import { DashboardLayout, DashboardHeader } from "../../core/ui/layouts/DashboardLayout";
import { getUsers } from "../../core/api/usersApi";
import { getDepartments } from "../../core/api/departmentsApi";

const TalentoDashboard = () => {
  console.log("[HR_UI][FASE2] entering Inicio");

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([getUsers(), getDepartments()]);
      setUsers(u);
      setDepartments(d);
    } catch (err) {
      console.error(err);
      toast.error("Error cargando datos de Talento Humano");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );

  const activos = users.filter((u) => u.role !== "pendiente").length;
  const pendientes = users.filter((u) => u.role === "pendiente").length;

  return (
    <DashboardLayout includeWidgets={false}>
      <DashboardHeader
        title="Panel de Talento Humano"
        subtitle="Visión consolidada de usuarios, departamentos y solicitudes"
        actions={
          <Button
            variant="secondary"
            icon={FiRefreshCw}
            onClick={loadData}
            disabled={loading}
          >
            Actualizar
          </Button>
        }
      />

      {/* Estadísticas principales */}
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

      {/* AttendanceWidget - OBLIGATORIO mantener en Inicio */}
      <div className="mt-6">
        <AttendanceWidget />
      </div>

      {/* Navegación a secciones especializadas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
        <ActionCard
          icon={FiUsers}
          subtitle="Administración"
          title="Gestión de Usuarios"
          color="blue"
          onClick={() => navigate("/dashboard/talento-humano/usuarios")}
        />
        <ActionCard
          icon={FiSettings}
          subtitle="Configuración"
          title="Departamentos"
          color="green"
          onClick={() => navigate("/dashboard/talento-humano/departamentos")}
        />
        <ActionCard
          icon={FiClipboard}
          subtitle="Solicitudes"
          title="Ver Solicitudes"
          color="orange"
          onClick={() => navigate("/dashboard/talento-humano/solicitudes")}
        />
        <ActionCard
          icon={FiRefreshCw}
          subtitle="Reportes"
          title="Asistencia Reportes"
          color="purple"
          onClick={() => navigate("/dashboard/talento-humano/asistencia-reportes")}
        />
      </div>
    </DashboardLayout>
  );
};

export default TalentoDashboard;
