import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../core/auth/AuthContext";
import { getMantenimientos } from "../../../core/api/mantenimientosApi";
import { getRequests } from "../../../core/api/requestsApi";
import { getTeamAvailability, updateAvailabilityStatus } from "../../../core/api/availabilityApi";
import { DashboardLayout } from "../../../core/ui/layouts/DashboardLayout";
import { useApi } from "../../../core/hooks/useApi";
import RequestsListModal from "../../shared/solicitudes/components/RequestsListModal";
import JefeTecnicoView from "../components/dashboard/JefeTecnicoView";
import TecnicoView from "../components/dashboard/TecnicoView";

const normalizeStatus = (value) => (value || "").toString().toLowerCase();
const isRequestOpen = (status) =>
  !["cerrado", "cancelado", "finalizado"].includes(normalizeStatus(status));

const ServicioDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mantenimientos, setMantenimientos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);

  const unwrapRows = useCallback((payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result?.data)) return payload.result.data;
    if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }, []);

  const { execute: loadSolicitudes } = useApi(
    useCallback(() => getRequests({ pageSize: 30 }), []),
    { errorMsg: "No se pudieron cargar las solicitudes técnicas." }
  );

  const solicitudesRef = useRef(loadSolicitudes);
  useEffect(() => {
    solicitudesRef.current = loadSolicitudes;
  }, [loadSolicitudes]);

  const openRequestsModal = useCallback(() => setRequestsModalOpen(true), []);
  const closeRequestsModal = useCallback(() => setRequestsModalOpen(false), []);
  const fetchRequestsForModal = useCallback(() => solicitudesRef.current(), []);

  const refreshSnapshots = useCallback(async () => {
    const tasks = [
      { label: "mantenimientos", fn: () => getMantenimientos({ pageSize: 200 }), setter: setMantenimientos },
      { label: "solicitudes", fn: () => solicitudesRef.current(), setter: setSolicitudes },
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
  }, [unwrapRows]);

  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  const safeMantenimientos = useMemo(
    () => (Array.isArray(mantenimientos) ? mantenimientos : []),
    [mantenimientos]
  );
  const safeSolicitudes = useMemo(
    () => (Array.isArray(solicitudes) ? solicitudes : []),
    [solicitudes]
  );
  const safeAvailability = useMemo(
    () => (Array.isArray(availability) ? availability : []),
    [availability]
  );

  const displayedSolicitudes = useMemo(() => {
    return safeSolicitudes
      .filter((s) => isRequestOpen(s.status || s.estado))
      .slice(0, 4);
  }, [safeSolicitudes]);

  const stats = useMemo(() => {
    const normalize = (value) => String(value || "").toLowerCase();

    const pendientes = safeMantenimientos.filter((m) =>
      ["pendiente", "pending"].includes(normalize(m.estado || m.status))
    ).length;

    const myPending = safeMantenimientos.filter((m) => {
      const isMyAssignment =
        m.responsable === user?.fullname || m.responsable_id === user?.id;
      return isMyAssignment && ["pendiente", "pending"].includes(normalize(m.estado || m.status));
    }).length;

    const tecnicosActivos = safeAvailability.filter((a) =>
      ["disponible", "available", true].includes(normalize(a.status))
    ).length;

    return {
      pendientes,
      tecnicosActivos,
      alertas: 2,
      cumplimiento: 95,
      myPending,
    };
  }, [safeMantenimientos, safeAvailability, user]);

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
          availability={safeAvailability}
          onRefresh={refreshSnapshots}
          onOpenWithdrawals={() => navigate("/dashboard/servicio-tecnico/retiros")}
          displayedSolicitudes={displayedSolicitudes}
          onOpenRequestsModal={openRequestsModal}
        />
      );
    }

    const myMaintenances = safeMantenimientos.filter(
      (m) => m.responsable === user?.fullname || m.responsable_id === user?.id
    );

    return (
      <TecnicoView
        stats={stats}
        myMaintenances={myMaintenances}
        availability={myAvailability}
        teamAvailability={safeAvailability}
        onAvailabilityChange={handleAvailabilityChange}
        onRefresh={refreshSnapshots}
        displayedSolicitudes={displayedSolicitudes}
        onOpenRequestsModal={openRequestsModal}
      />
    );
  };

  return (
    <DashboardLayout includeWidgets={false}>
      {renderView()}
      <RequestsListModal
        open={requestsModalOpen}
        onClose={closeRequestsModal}
        title="Solicitudes en curso"
        customFetcher={fetchRequestsForModal}
      />
    </DashboardLayout>
  );
};

export default ServicioDashboard;
