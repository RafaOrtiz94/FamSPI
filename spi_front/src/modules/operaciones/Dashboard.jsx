import React, { useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FiClipboard,
  FiSettings,
  FiRefreshCw,
  FiTrendingUp,
  FiActivity,
  FiCheckCircle,
  FiTool,
} from "react-icons/fi";

import { useApi } from "../../core/hooks/useApi";
import { useDashboard } from "../../core/hooks/useDashboard";
import { useUI } from "../../core/ui/useUI";
import { getRequests } from "../../core/api/requestsApi";
import { getMantenimientos } from "../../core/api/mantenimientosApi";
import ExecutiveStatCard from "../../core/ui/components/ExecutiveStatCard";
import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";

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
  const rejectedOrders = statusBuckets.rejected || 0;

  const pendingMaints = mantenimientos.filter(
    (m) => ["pendiente", "pending"].includes(normalize(m.estado || m.status))
  );
  const completedMaints = mantenimientos.filter(
    (m) => ["aprobado", "aprobada", "completed"].includes(normalize(m.estado || m.status))
  );

  const loading = loadingRequests || loadingMaints;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Operaciones</h1>
          <p className="text-sm text-gray-500">
            Control de órdenes de trabajo y mantenimientos en curso.
          </p>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={refresh}>
          Actualizar
        </Button>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ExecutiveStatCard
          icon={<FiClipboard size={22} />}
          label="Órdenes activas"
          value={activeOrders}
          from="from-blue-600"
          to="to-sky-500"
        />
        <ExecutiveStatCard
          icon={<FiCheckCircle size={22} />}
          label="Órdenes completadas"
          value={completedOrders}
          from="from-emerald-600"
          to="to-green-500"
        />
        <ExecutiveStatCard
          icon={<FiActivity size={22} />}
          label="Pendientes de revisión"
          value={statusBuckets.in_review || 0}
          from="from-amber-500"
          to="to-orange-500"
        />
        <ExecutiveStatCard
          icon={<FiTool size={22} />}
          label="Mantenimientos activos"
          value={pendingMaints.length}
          from="from-indigo-600"
          to="to-blue-500"
        />
      </section>

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
              Resumen de mantenimientos
            </h2>
            <span className="text-sm text-gray-500">{mantenimientos.length} registros</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
              <p className="text-xs text-amber-600 uppercase font-semibold">Pendientes</p>
              <p className="text-2xl font-bold text-amber-700">{pendingMaints.length}</p>
            </div>
            <div className="rounded-xl bg-green-50 border border-green-100 p-4">
              <p className="text-xs text-green-600 uppercase font-semibold">Completados</p>
              <p className="text-2xl font-bold text-green-700">{completedMaints.length}</p>
            </div>
          </div>
          <div className="space-y-2 max-h-56 overflow-auto text-sm">
            {mantenimientos.slice(0, 6).map((m) => (
              <article
                key={m.id}
                className="flex items-center justify-between border-b border-gray-100 pb-2"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    #{m.id} · {m.tipo}
                  </p>
                  <p className="text-xs text-gray-500">
                    Responsable: {m.responsable || "No asignado"}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    ["pendiente", "pending"].includes(normalize(m.estado))
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {m.estado}
                </span>
              </article>
            ))}
            {mantenimientos.length === 0 && (
              <p className="text-gray-500">No hay mantenimientos registrados.</p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Órdenes en seguimiento
            </h2>
            <span className="text-sm text-gray-500">Últimas 6</span>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : activeOrders ? (
            <ul className="space-y-3 text-sm">
              {requests
                .filter((req) =>
                  ["pending", "in_review", "acta_generated"].includes(normalize(req.status))
                )
                .slice(0, 6)
                .map((req) => (
                  <li
                    key={req.id}
                    className="rounded-xl border border-gray-100 p-3 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900">
                        #{req.id} · {req.type_title || "Solicitud"}
                      </p>
                      <span className="text-xs text-gray-500">
                        {new Date(req.created_at).toLocaleDateString("es-EC")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Estado: {req.status?.replace("_", " ") || "pendiente"}
                    </p>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              No hay órdenes activas en este momento.
            </p>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Últimos movimientos completados
            </h2>
            <span className="text-sm text-gray-500">{completedOrders + rejectedOrders}</span>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : completedOrders + rejectedOrders ? (
            <ul className="space-y-3 text-sm">
              {requests
                .filter((req) => ["approved", "rejected"].includes(normalize(req.status)))
                .slice(0, 6)
                .map((req) => (
                  <li
                    key={req.id}
                    className="border border-gray-100 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        #{req.id} · {req.type_title || "Solicitud"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(req.updated_at || req.created_at).toLocaleString("es-EC")}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        normalize(req.status) === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {normalize(req.status) === "approved" ? "Aprobada" : "Rechazada"}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              Todavía no se registran cierres recientes.
            </p>
          )}
        </Card>
      </section>
    </motion.section>
  );
};

export default DashboardOperaciones;
