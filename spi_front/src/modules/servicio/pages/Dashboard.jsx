import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import api from "../../../core/api";
import { getMantenimientos } from "../../../core/api/mantenimientosApi";
import { getRequests } from "../../../core/api/requestsApi";
import { getPendingApprovals } from "../../../core/api/approvalsApi";
import { getTeamAvailability, updateAvailabilityStatus } from "../../../core/api/availabilityApi";
import { DashboardLayout } from "../../../core/ui/layouts/DashboardLayout";
import PermisosStatusWidget from "../../shared/solicitudes/components/PermisosStatusWidget";
import { useApi } from "../../../core/hooks/useApi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import RequestsListModal from "../../shared/solicitudes/components/RequestsListModal";
import JefeTecnicoView from "../components/dashboard/JefeTecnicoView";
import TecnicoView from "../components/dashboard/TecnicoView";

const normalizeStatus = (value) => (value || "").toString().toLowerCase();
const isRequestOpen = (status) =>
  !["cerrado", "cancelado", "finalizado"].includes(normalizeStatus(status));

const parseRequestPayload = (payload) => {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return payload;
};

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

const fetchSolicitudesTecnicas = () => getRequests({ pageSize: 30 });

const ServicioDashboard = () => {
  const { user } = useAuth();
  const [mantenimientos, setMantenimientos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [approvals, setApprovals] = useState([]);
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

  const {
    execute: loadSolicitudes,
  } = useApi(
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
    setLoadingSnapshots(true);
    const tasks = [
      { label: "mantenimientos", fn: () => getMantenimientos({ pageSize: 200 }), setter: setMantenimientos },
      { label: "equipos", fn: fetchEquipos, setter: setEquipos },
      { label: "capacitaciones", fn: fetchCapacitaciones, setter: setCapacitaciones },
      { label: "solicitudes", fn: () => solicitudesRef.current(), setter: setSolicitudes },
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
  const displayedSolicitudes = useMemo(() => {
    const openRequests = safeSolicitudes.filter((s) =>
      isRequestOpen(s.status || s.estado)
    );
    return openRequests.slice(0, 4);
  }, [safeSolicitudes]);
  const safeApprovals = useMemo(() => (Array.isArray(approvals) ? approvals : []), [approvals]);
  const safeAvailability = useMemo(() => (Array.isArray(availability) ? availability : []), [availability]);

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
      {renderView()}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Solicitudes en curso</h2>
            <p className="text-sm text-gray-500">
              Accede al historial completo y mantiene el contexto de las solicitudes técnicas abiertas.
            </p>
          </div>
          <Button
            className="text-sm px-4 py-2"
            onClick={openRequestsModal}
          >
            Ver historial
          </Button>
        </div>
        {displayedSolicitudes.length === 0 ? (
          <p className="text-sm text-gray-500 mt-4">
            No hay solicitudes abiertas en este momento.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {displayedSolicitudes.map((req) => {
              const payload = parseRequestPayload(req.payload);
              const cliente =
                payload.nombre_cliente ||
                payload.cliente ||
                payload.customer_name ||
                "Cliente desconocido";
              const tipo =
                req.type_name ||
                req.type_title ||
                payload.tipo ||
                "Solicitud técnica";
              const estado = req.status || req.estado || "Pendiente";
              return (
                <div
                  key={`${req.id}-${estado}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{cliente}</p>
                    <p className="text-xs text-gray-500">{tipo}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                    {estado}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <div className="mt-6">
        <PermisosStatusWidget />
      </div>
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
