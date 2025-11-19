import React, { useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiRefreshCw,
  FiActivity,
  FiXCircle,
} from "react-icons/fi";

import { useApi } from "../../core/hooks/useApi";
import { useDashboard } from "../../core/hooks/useDashboard";
import { useUI } from "../../core/ui/useUI";
import { getRequests } from "../../core/api/requestsApi";
import { getPendingApprovals } from "../../core/api/approvalsApi";
import ExecutiveStatCard from "../../core/ui/components/ExecutiveStatCard";
import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";

const unwrapRows = (payload) =>
  payload?.rows || payload?.result?.rows || payload?.result || payload || [];

const statusMeta = {
  approved: { label: "Aprobada", color: "text-green-600" },
  rejected: { label: "Rechazada", color: "text-rose-600" },
  in_review: { label: "En revisión", color: "text-blue-600" },
  pending: { label: "Pendiente", color: "text-amber-600" },
};

const DashboardCalidad = () => {
  const { showToast } = useUI();

  const {
    data: requestsData,
    loading: loadingRequests,
    execute: loadRequests,
  } = useApi(() => getRequests({ page: 1, pageSize: 48 }), {
    errorMsg: "No se pudieron obtener las solicitudes.",
  });

  const {
    data: approvalsData,
    loading: loadingApprovals,
    execute: loadApprovals,
  } = useApi(getPendingApprovals, { errorMsg: "No se pudieron obtener las aprobaciones." });

  const refresh = useCallback(async () => {
    try {
      await Promise.all([loadRequests(), loadApprovals()]);
    } catch (err) {
      console.error("DashboardCalidad refresh error:", err);
      showToast("No se pudo actualizar el panel de calidad.", "error");
    }
  }, [loadApprovals, loadRequests, showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requests = useMemo(() => unwrapRows(requestsData), [requestsData]);
  const approvals = useMemo(() => unwrapRows(approvalsData), [approvalsData]);

  const { stats } = useDashboard(requests);

  const loading = loadingRequests || loadingApprovals;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Calidad y Mejora Continua
          </h1>
          <p className="text-sm text-gray-500">
            Seguimiento de certificaciones, documentos y workflow de aprobación.
          </p>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={refresh}>
          Actualizar
        </Button>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ExecutiveStatCard
          icon={<FiActivity size={22} />}
          label="Total solicitudes"
          value={stats.total}
          from="from-blue-600"
          to="to-blue-500"
        />
        <ExecutiveStatCard
          icon={<FiCheckCircle size={22} />}
          label="Aprobadas"
          value={stats.aprobadas}
          from="from-green-600"
          to="to-emerald-500"
        />
        <ExecutiveStatCard
          icon={<FiAlertTriangle size={22} />}
          label="Solicitudes pendientes"
          value={stats.pendientes}
          from="from-amber-500"
          to="to-orange-500"
        />
        <ExecutiveStatCard
          icon={<FiXCircle size={22} />}
          label="Rechazadas"
          value={stats.rechazadas}
          from="from-rose-600"
          to="to-pink-500"
        />
      </section>

      <section className="grid grid-cols-1 gap-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Aprobaciones pendientes
            </h2>
            <span className="text-sm text-gray-500">{approvals.length} registros</span>
          </div>

          {approvals.length ? (
            <ul className="space-y-3 text-sm">
              {approvals.slice(0, 6).map((item) => (
                <li
                  key={item.id || item.request_id}
                  className="rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-gray-800">
                      Solicitud #{item.request_id || item.id}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.request_type || item.tipo || "Proceso"}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {item.applicant || item.solicitante || "Sin solicitante"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              No existen aprobaciones pendientes.
            </p>
          )}
        </Card>
      </section>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Últimas solicitudes auditadas
          </h2>
          <span className="text-sm text-gray-500">
            {requests.length ? `${requests.length} registros` : "Sin registros"}
          </span>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Cargando información...</p>
        ) : requests.length ? (
          <div className="space-y-3">
            {requests.slice(0, 6).map((req) => {
              const meta = statusMeta[req.status] || statusMeta.pending;
              return (
                <article
                  key={req.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-gray-100 rounded-xl p-3 gap-2"
                >
                  <div>
                    <p className="font-semibold text-gray-800">
                      #{req.id} · {req.type_title || "Solicitud"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(req.created_at).toLocaleString("es-EC")}
                    </p>
                  </div>
                  <span className={`${meta.color} font-semibold text-sm`}>
                    {meta.label}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay solicitudes disponibles.</p>
        )}
      </Card>
    </motion.section>
  );
};

export default DashboardCalidad;
