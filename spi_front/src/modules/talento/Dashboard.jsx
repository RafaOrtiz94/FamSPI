import React, { useEffect, useState } from "react";
import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";
import AttendanceWidget from "../shared/components/AttendanceWidget";
import { getUsers } from "../../core/api/usersApi";
import { getDepartments } from "../../core/api/departmentsApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiUsers, FiSettings } from "react-icons/fi";

const TalentoDashboard = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
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
    };
    loadData();
  }, []);

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

      {/* Attendance Widget */}
      <AttendanceWidget />

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

