import React, { useCallback, useEffect, useMemo } from "react";
import {
  FiClipboard,
  FiRefreshCw,
  FiActivity,
  FiCheckCircle,
  FiTool,
} from "react-icons/fi";

import { useApi } from "../../core/hooks/useApi";
import { useDashboard } from "../../core/hooks/useDashboard";
import { useUI } from "../../core/ui/useUI";
import { getRequests } from "../../core/api/requestsApi";
import { getMantenimientos } from "../../core/api/mantenimientosApi";
import StatCard from "../../core/ui/patterns/StatCard";
import AttendanceWidget from "../../core/ui/widgets/AttendanceWidget";
import ClientRequestWidget from "../../core/ui/widgets/ClientRequestWidget";
import PermisosStatusWidget from "../shared/solicitudes/components/PermisosStatusWidget";
import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";
import { DashboardLayout, DashboardHeader } from "../../core/ui/layouts/DashboardLayout";

const unwrapRows = (payload) =>
  payload?.rows || payload?.result?.rows || payload?.result || payload || [];

const normalize = (value) => (value || "").toString().toLowerCase();

const DashboardOperaciones = () => {
  const { showToast } = useUI();

  const {
    data: requestsData,
    loading: loadingRequests,
    execute: loadRequests,
  } = useApi(() => getRequests({ pageSize: 60 }), {
    errorMsg: "No se pudieron obtener las órdenes.",
  });

  const {
    data: mantenimientosData,
    loading: loadingMaints,
    execute: loadMantenimientos,
  } = useApi(getMantenimientos, { errorMsg: "No se pudieron cargar los mantenimientos." });

  const refresh = useCallback(async () => {
    try {
      await Promise.all([loadRequests(), loadMantenimientos()]);
    } catch (err) {
      console.error("DashboardOperaciones refresh error:", err);
      showToast("No se pudo actualizar el panel operativo.", "error");
    }
  }, [loadMantenimientos, loadRequests, showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requests = useMemo(() => unwrapRows(requestsData), [requestsData]);
  const mantenimientos = useMemo(
    () => unwrapRows(mantenimientosData),
    [mantenimientosData]
  );

  const { stats } = useDashboard(requests);

  const normalizeStatus = (status) => {
    const s = String(status || "").toLowerCase();
    if (["aprobado", "approved"].includes(s)) return "approved";
    if (["rechazado", "rejected"].includes(s)) return "rejected";
    if (["acta_generada", "acta_generated"].includes(s)) return "acta_generated";
    if (["modificada", "modified"].includes(s)) return "modified";
    if (["en_revision", "in_review"].includes(s)) return "in_review";
    return "pending";
  };

  const statusBuckets = useMemo(() => {
    const buckets = {
      pending: 0,
      in_review: 0,
      acta_generated: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      modified: 0,
    };
    requests.forEach((req) => {
      const status = normalizeStatus(req.status);
      if (buckets[status] === undefined) {
        buckets[status] = 0;
      }
      buckets[status] += 1;
    });
    return buckets;
  }, [requests]);

  const activeOrders =
    (statusBuckets.pending || 0) +
    (statusBuckets.in_review || 0) +
    (statusBuckets.acta_generated || 0) +
    (statusBuckets.acta_generada || 0);
  const completedOrders = statusBuckets.approved || 0;

  const pendingMaints = mantenimientos.filter(
    (m) => ["pendiente", "pending"].includes(normalize(m.estado || m.status))
  );
  const loading = loadingRequests || loadingMaints;

  return (
    <DashboardLayout includeWidgets={false}>
      <DashboardHeader
        title="Operaciones"
        subtitle="Control de órdenes de trabajo y mantenimientos en curso"
        actions={
          <Button variant="secondary" icon={FiRefreshCw} onClick={refresh}>
            Actualizar
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FiClipboard}
          label="Órdenes activas"
          value={activeOrders}
          color="blue"
        />
        <StatCard
          icon={FiCheckCircle}
          label="Órdenes completadas"
          value={completedOrders}
          color="emerald"
        />
        <StatCard
          icon={FiActivity}
          label="Pendientes de revisión"
          value={statusBuckets.in_review || 0}
          color="amber"
        />
        <StatCard
          icon={FiTool}
          label="Mantenimientos activos"
          value={pendingMaints.length}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttendanceWidget />
        <ClientRequestWidget />
      </div>

      <PermisosStatusWidget />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Estado de órdenes de trabajo
            </h2>
            <span className="text-sm text-gray-500">{stats.total} órdenes</span>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : requests.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(statusBuckets).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm flex flex-col gap-1"
                >
                  <p className="text-xs text-gray-500 uppercase tracking-widest">
                    {key.replace("_", " ")}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No existen órdenes registradas.
            </p>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Estado de mantenimientos
            </h2>
            <Button
              variant="ghost"
              size="sm"
              icon={FiRefreshCw}
              onClick={loadMantenimientos}
            >
              Actualizar
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : mantenimientos.length ? (
            <div className="grid grid-cols-2 gap-3">
              {["pendiente", "aprobado", "rechazado"].map((state) => (
                <div key={state} className="rounded-xl border border-gray-100 p-3 bg-white">
                  <p className="text-xs uppercase text-gray-500">{state}</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {
                      mantenimientos.filter(
                        (m) => normalize(m.estado || m.status) === state
                      ).length
                    }
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No se encontraron mantenimientos.
            </p>
          )}
        </Card>
      </section>
    </DashboardLayout>
  );
};

export default DashboardOperaciones;
