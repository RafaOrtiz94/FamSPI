import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiTool, FiList, FiUsers, FiBookOpen, FiCpu, FiCheckCircle } from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import api from "../../../core/api";
import { getMantenimientos } from "../../../core/api/mantenimientosApi";
import { getRequests } from "../../../core/api/requestsApi";
import { getPendingApprovals } from "../../../core/api/approvalsApi";
import { getTeamAvailability, updateAvailabilityStatus } from "../../../core/api/availabilityApi";
import Card from "../../../core/ui/components/Card";
import { DashboardLayout } from "../../shared/components/DashboardComponents";

// Views
import JefeTecnicoView from "../components/dashboard/JefeTecnicoView";
import TecnicoView from "../components/dashboard/TecnicoView";

const fetchEquipos = async () => {
  const { data } = await api.get("/servicio/equipos");
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.result?.rows)) return data.result.rows;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

const fetchCapacitaciones = async () => {
  const { data } = await api.get("/servicio/capacitaciones");
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.result?.rows)) return data.result.rows;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

const fetchSolicitudesTecnicas = async () => {
  return getRequests({ pageSize: 30 });
};

const ServicioDashboard = () => {
  const { user } = useAuth();
  const [mantenimientos, setMantenimientos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [approvals, setApprovals] = useState([]);
  const [availability, setAvailability] = useState([]);

  const unwrapRows = useCallback((payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result?.data)) return payload.result.data;
    if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }, []);

  const refreshSnapshots = useCallback(async () => {
    setLoadingSnapshots(true);
    const tasks = [
      { label: "mantenimientos", fn: () => getMantenimientos({ pageSize: 200 }), setter: setMantenimientos },
      { label: "equipos", fn: fetchEquipos, setter: setEquipos },
      { label: "capacitaciones", fn: fetchCapacitaciones, setter: setCapacitaciones },
      { label: "solicitudes", fn: fetchSolicitudesTecnicas, setter: setSolicitudes },
      { label: "aprobaciones", fn: getPendingApprovals, setter: setApprovals },
      { label: "availability", fn: getTeamAvailability, setter: setAvailability },
    ];

    for (const task of tasks) {
      try {
        const result = await task.fn();
        task.setter(unwrapRows(result));
      } catch (err) {
        console.warn(`ServicioDashboard snapshot error (${task.label}):`, err?.message || err);
        task.setter([]);
      }
    }
    setLoadingSnapshots(false);
  }, [unwrapRows]);

  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  const safeMantenimientos = useMemo(() => (Array.isArray(mantenimientos) ? mantenimientos : []), [mantenimientos]);
  const safeEquipos = useMemo(() => (Array.isArray(equipos) ? equipos : []), [equipos]);
  const safeCapacitaciones = useMemo(
    () => (Array.isArray(capacitaciones) ? capacitaciones : []),
    [capacitaciones]
  );
  const safeSolicitudes = useMemo(() => (Array.isArray(solicitudes) ? solicitudes : []), [solicitudes]);
  const safeApprovals = useMemo(() => (Array.isArray(approvals) ? approvals : []), [approvals]);
  const safeAvailability = useMemo(() => (Array.isArray(availability) ? availability : []), [availability]);

  const quickLinks = useMemo(
    () => [
      {
        title: "Mantenimientos",
        description: "Agenda, aprueba y exporta bitácoras.",
        to: "/dashboard/servicio-tecnico/mantenimientos",
        icon: <FiTool />, 
      },
      {
        title: "Solicitudes",
        description: "Revisa requerimientos y su estado.",
        to: "/dashboard/servicio-tecnico/solicitudes",
        icon: <FiList />, 
      },
      {
        title: "Disponibilidad",
        description: "Actualiza y consulta quién está en campo.",
        to: "/dashboard/servicio-tecnico/disponibilidad",
        icon: <FiUsers />, 
      },
      {
        title: "Capacitaciones",
        description: "Calendario y responsables de formación.",
        to: "/dashboard/servicio-tecnico/capacitaciones",
        icon: <FiBookOpen />, 
      },
      {
        title: "Equipos",
        description: "Estado e inventario de equipos técnicos.",
        to: "/dashboard/servicio-tecnico/equipos",
        icon: <FiCpu />, 
      },
      {
        title: "Aprobaciones",
        description: "Ordena y atiende la cola pendiente.",
        to: "/dashboard/servicio-tecnico/aprobaciones",
        icon: <FiCheckCircle />, 
      },
    ],
    []
  );

  const stats = useMemo(() => {
    const normalize = (value) => String(value || "").toLowerCase();
    const pendientes = safeMantenimientos.filter((m) =>
      ["pendiente", "pending"].includes(normalize(m.estado || m.status))
    ).length;

    const completados = safeMantenimientos.filter((m) =>
      ["aprobado", "approved", "cumplido", "done"].includes(normalize(m.estado || m.status))
    ).length;

    const equiposOperativos = safeEquipos.filter((e) =>
      ["operativo", "ok"].includes(normalize(e.estado))
    ).length;

    const solicitudesAbiertas = safeSolicitudes.filter(
      (s) => !["cerrado", "cancelado", "finalizado"].includes(normalize(s.status || s.estado))
    ).length;

    // Stats for Tecnico view
    const myPending = safeMantenimientos.filter((m) => {
      const isMyAssignment = m.responsable === user?.fullname || m.responsable_id === user?.id; // Adjust matching logic as needed
      const isPending = ["pendiente", "pending"].includes(normalize(m.estado || m.status));
      return isMyAssignment && isPending;
    }).length;

    const tecnicosActivos = safeAvailability.filter(
      (a) => ["disponible", "available", true].includes(normalize(a.status))
    ).length;

    return {
      pendientes,
      completados,
      equiposOperativos,
      solicitudesAbiertas,
      tecnicosActivos,
      alertas: 2, // Placeholder
      cumplimiento: 95, // Placeholder
      myPending
    };
  }, [safeMantenimientos, safeEquipos, safeSolicitudes, safeAvailability, user]);

  const myAvailability = useMemo(() => {
    if (!user) return null;
    return (
      safeAvailability.find(
        (a) => a.userId === user.id || a.user_id === user.id || a.name === user.fullname
      ) || null
    );
  }, [safeAvailability, user]);

  const handleAvailabilityChange = useCallback(
    async (nextStatus) => {
      try {
        await updateAvailabilityStatus(nextStatus);
        await refreshSnapshots();
      } catch (err) {
        console.warn("No se pudo actualizar disponibilidad", err);
      }
    },
    [refreshSnapshots]
  );

  const renderView = () => {
    const role = user?.role?.toLowerCase() || "";

    if (role.includes("jefe") || role.includes("gerente") || role.includes("director")) {
      return (
        <JefeTecnicoView
          stats={stats}
          maintenances={safeMantenimientos}
          approvals={safeApprovals}
          availability={safeAvailability}
          onRefresh={refreshSnapshots}
        />
      );
    }

    // Default to Tecnico view
    // Filter maintenances for this technician
    const myMaintenances = safeMantenimientos.filter(m =>
      m.responsable === user?.fullname ||
      m.responsable_id === user?.id ||
      !m.responsable // Show unassigned too? Maybe not.
    );

    return (
      <TecnicoView
        stats={stats}
        myMaintenances={myMaintenances}
        availability={myAvailability}
        teamAvailability={safeAvailability}
        onAvailabilityChange={handleAvailabilityChange}
        onRefresh={refreshSnapshots}
      />
    );
  };

  return (
    <DashboardLayout includeWidgets={false}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="p-4 h-full hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 text-blue-600 font-semibold">
                {link.icon}
                <span>{link.title}</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">{link.description}</p>
            </Card>
          </Link>
        ))}
      </div>
      {renderView()}
    </DashboardLayout>
  );
};

export default ServicioDashboard;
