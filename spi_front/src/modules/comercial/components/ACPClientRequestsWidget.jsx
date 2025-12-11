import React, { useCallback, useEffect, useState } from "react";
import { FiClock } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";
import { getMyClientRequests } from "../../../core/api/requestsApi";

const STATUS_LABELS = {
  pending_approval: "Pendiente de aprobación",
  pending_consent: "Pendiente de consentimiento",
  approved: "Aprobada",
  rejected: "Rechazada",
  canceled: "Cancelada",
  pendiente: "Pendiente",
  aprobado: "Aprobada",
  rechazado: "Rechazada",
};

const ACPClientRequestsWidget = () => {
  const { showToast } = useUI();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyClientRequests({ page: 1, pageSize: 5 });
      setRequests((data?.rows || data) ?? []);
    } catch (error) {
      console.error(error);
      showToast("No se pudieron cargar tus solicitudes", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const formatStatus = (status) => {
    if (!status) return "Sin estado";
    return STATUS_LABELS[status] || status.replace(/_/g, " ");
  };

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mis solicitudes de cliente</p>
        <p className="text-sm text-gray-500">
          Solo ves las solicitudes que tú enviaste y su estado actual. No se muestra otra información.
        </p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FiClock className="animate-spin" /> Cargando...
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-500">Aún no has enviado solicitudes de nuevo cliente.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <div
              key={req.id || req.request_id}
              className="flex items-start justify-between rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-600"
            >
              <div className="space-y-1 text-left">
                <p className="font-semibold text-slate-900">Solicitud #{req.id || req.request_id}</p>
                <p className="text-[11px] text-slate-500">
                  {req.created_at ? new Date(req.created_at).toLocaleDateString("es-ES") : "Fecha no disponible"}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                {formatStatus(req.status)}
              </span>
            </div>
          ))}
        </div>
      )}
      <Button size="xs" variant="secondary" onClick={loadRequests} disabled={loading}>
        {loading ? "Actualizando..." : "Actualizar"}
      </Button>
    </Card>
  );
};

export default ACPClientRequestsWidget;
