import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiCheckCircle, FiClock, FiCreditCard, FiEye, FiRefreshCw, FiXCircle } from "react-icons/fi";
import { getRequestById, getRequests } from "../../../../core/api/requestsApi";
import { getDocumentsByRequest } from "../../../../core/api/documentsApi";
import { getFilesByRequest } from "../../../../core/api/filesApi";
import { useUI } from "../../../../core/ui/UIContext";
import Button from "../../../../core/ui/components/Button";
import RequestDetailModal from "../RequestDetailModal";
import { formatDate, getStatusColor, getStatusIcon } from "../../config/requestConfig";

const CREDIT_TYPE = "F.VE-02";

const normalizeStatus = (value) => String(value || "pendiente").trim().toLowerCase();

const getClientLabel = (request) => {
  const payload = typeof request?.payload === "string"
    ? (() => {
      try {
        return JSON.parse(request.payload);
      } catch {
        return {};
      }
    })()
    : request?.payload || {};
  return payload.razon_social || payload.nombre_cliente || payload.client_name || request?.requester_email || "Cliente sin nombre";
};

const getSuggestedAmount = (request) => {
  const payload = typeof request?.payload === "string"
    ? (() => {
      try {
        return JSON.parse(request.payload);
      } catch {
        return {};
      }
    })()
    : request?.payload || {};
  const value = Number(payload.cupo_credito_sugerido || 0);
  return Number.isFinite(value) && value > 0
    ? value.toLocaleString("es-EC", { style: "currency", currency: "USD" })
    : "Sin cupo";
};

const JefeFinancieroSolicitudesView = ({ onStatsChange }) => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [detail, setDetail] = useState({ open: false, loading: false, data: null, error: null });

  const loadCreditRequests = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRequests({ type: CREDIT_TYPE, pageSize: 200 });
      setRequests(result.rows || []);
    } catch (error) {
      console.error("Error cargando solicitudes de credito:", error);
      showToast("No se pudieron cargar las solicitudes de credito", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadCreditRequests();
  }, [loadCreditRequests]);

  const stats = useMemo(() => {
    const total = requests.length;
    const approved = requests.filter((request) => ["aprobado", "approved"].includes(normalizeStatus(request.status))).length;
    const rejected = requests.filter((request) => ["rechazado", "rejected"].includes(normalizeStatus(request.status))).length;
    const pending = Math.max(0, total - approved - rejected);
    return { total, approved, rejected, pending };
  }, [requests]);

  useEffect(() => {
    onStatsChange?.(stats);
  }, [onStatsChange, stats]);

  const handleViewRequest = async (request) => {
    setDetail({ open: true, loading: true, data: null, error: null });
    try {
      const requestData = await getRequestById(request.id);
      const normalizedRequest = requestData?.request || requestData || {};
      let payload = normalizedRequest.payload;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = {};
        }
      }
      const [documents, files] = await Promise.all([
        getDocumentsByRequest(request.id).catch(() => []),
        getFilesByRequest(request.id).catch(() => []),
      ]);
      setDetail({
        open: true,
        loading: false,
        data: { request: { ...normalizedRequest, payload: payload || {} }, documents, files },
        error: null,
      });
    } catch (error) {
      console.error("No se pudo cargar el detalle de credito:", error);
      setDetail({ open: true, loading: false, data: null, error: "No se pudo cargar el detalle de la solicitud" });
    }
  };

  const reloadCurrentRequestDetail = async () => {
    const current = detail.data?.request;
    if (!current?.id) return;
    await handleViewRequest(current);
    await loadCreditRequests();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <FiCreditCard size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Solicitudes de credito</h2>
              <p className="text-sm text-slate-500">Vista financiera limitada a F.VE-02.</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={loadCreditRequests} className="gap-2">
            <FiRefreshCw size={14} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total credito", value: stats.total, icon: FiCreditCard, cls: "text-slate-900 bg-slate-50" },
          { label: "Pendientes", value: stats.pending, icon: FiClock, cls: "text-amber-700 bg-amber-50" },
          { label: "Aprobadas", value: stats.approved, icon: FiCheckCircle, cls: "text-emerald-700 bg-emerald-50" },
          { label: "Rechazadas", value: stats.rejected, icon: FiXCircle, cls: "text-red-700 bg-red-50" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className={`mb-3 inline-flex rounded-xl p-2 ${item.cls}`}>
              <item.icon size={16} />
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums text-slate-950">{item.value}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">Bandeja de credito</h3>
          <p className="text-sm text-slate-500">Solo se muestran solicitudes F.VE-02.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
            <FiRefreshCw className="animate-spin" size={18} />
            Cargando solicitudes de credito...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center">
            <FiCreditCard className="mx-auto mb-3 text-slate-300" size={36} />
            <p className="text-sm font-medium text-slate-600">No hay solicitudes de credito registradas.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => (
              <motion.button
                key={request.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleViewRequest(request)}
                className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 sm:grid-cols-[1fr_auto_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{getClientLabel(request)}</p>
                  <p className="mt-1 text-xs text-slate-500">Solicitud #{request.id} · {formatDate(request.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {getSuggestedAmount(request)}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full border border-current border-opacity-20 px-2.5 py-1 text-xs font-semibold ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    {request.status || "Pendiente"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 sm:justify-end">
                  <FiEye size={14} />
                  Ver detalle
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <RequestDetailModal
        detail={detail}
        onProcessed={reloadCurrentRequestDetail}
        onClose={() => setDetail({ open: false, loading: false, data: null, error: null })}
      />
    </div>
  );
};

export default JefeFinancieroSolicitudesView;
