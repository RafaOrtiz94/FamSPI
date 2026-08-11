import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../core/auth/AuthContext";
import { getMantenimientos } from "../../../core/api/mantenimientosApi";
import { getRequests } from "../../../core/api/requestsApi";
import {
  getTeamAvailability,
  getTechnicalScheduleFeed,
  updateAvailabilityStatus,
} from "../../../core/api/availabilityApi";
import { DashboardLayout } from "../../../core/ui/layouts/DashboardLayout";
import { useApi } from "../../../core/hooks/useApi";
import RequestsListModal from "../../shared/solicitudes/components/RequestsListModal";
import JefeTecnicoView from "../components/dashboard/JefeTecnicoView";
import TecnicoView from "../components/dashboard/TecnicoView";

const normalizeStatus = (value) => (value || "").toString().toLowerCase();
const isRequestOpen = (status) =>
  !["cerrado", "cancelado", "finalizado"].includes(normalizeStatus(status));
const LEAD_ROLES = new Set([
  "jefe_tecnico",
  "jefe_servicio",
  "jefe_servicio_tecnico",
  "gerencia",
  "gerencia_general",
  "director",
]);

const normalizeTokens = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || "").toLowerCase()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const canSeeTeamSchedule = (user) => {
  const tokens = new Set([...(normalizeTokens(user?.role)), ...(normalizeTokens(user?.scope))]);
  return Array.from(tokens).some((token) => LEAD_ROLES.has(token));
};

const ServicioDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mantenimientos, setMantenimientos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [scheduleFeed, setScheduleFeed] = useState({ rows: [], backlog: [], summary: {}, scope: "mine" });
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
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const toDate = new Date(today);
    toDate.setDate(toDate.getDate() + 14);
    const to = toDate.toISOString().slice(0, 10);
    const scheduleScope = canSeeTeamSchedule(user) ? "team" : "mine";

    const tasks = [
      { label: "mantenimientos", fn: () => getMantenimientos({ pageSize: 200 }), setter: setMantenimientos },
      { label: "solicitudes", fn: () => solicitudesRef.current(), setter: setSolicitudes },
      { label: "availability", fn: getTeamAvailability, setter: setAvailability },
      {
        label: "technical_schedule",
        fn: () => getTechnicalScheduleFeed({ from, to, scope: scheduleScope }),
        setter: (value) =>
          setScheduleFeed(
            value && typeof value === "object"
              ? value
              : { rows: [], backlog: [], summary: {}, scope: scheduleScope },
          ),
      },
    ];

    for (const task of tasks) {
      try {
        const result = await task.fn();
        task.setter(task.label === "technical_schedule" ? result : unwrapRows(result));
      } catch (err) {
        console.warn(`ServicioDashboard snapshot error (${task.label}):`, err?.message || err);
        if (task.label === "technical_schedule") {
          setScheduleFeed({ rows: [], backlog: [], summary: {}, scope: scheduleScope });
        } else {
          task.setter([]);
        }
      }
    }
  }, [unwrapRows, user]);

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
  const safeScheduleRows = useMemo(
    () => (Array.isArray(scheduleFeed?.rows) ? scheduleFeed.rows : []),
    [scheduleFeed]
  );
  const safeScheduleBacklog = useMemo(
    () => (Array.isArray(scheduleFeed?.backlog) ? scheduleFeed.backlog : []),
    [scheduleFeed]
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
      alertas: safeScheduleBacklog.length,
      myPending,
      scheduledEvents: safeScheduleRows.length,
      pendingCoordination: safeScheduleBacklog.length,
    };
  }, [safeMantenimientos, safeAvailability, safeScheduleBacklog, safeScheduleRows, user]);

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
          scheduleRows={safeScheduleRows}
          scheduleBacklog={safeScheduleBacklog}
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
        scheduleRows={safeScheduleRows}
        scheduleBacklog={safeScheduleBacklog}
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
