import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit3, FiRefreshCw, FiUserCheck } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";
import { getMyClientRequests } from "../../../core/api/requestsApi";

const STATUS_LABELS = {
  pending_approval: "Pendientes",
  pending_consent: "Consentimiento",
  approved: "Aprobadas",
  rejected: "Rechazadas",
  canceled: "Canceladas",
  pendiente: "Pendientes",
  aprobado: "Aprobadas",
  rechazado: "Rechazadas",
};

const ACPClientSummaryWidget = () => {
  const { showToast } = useUI();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyClientRequests({ page: 1, pageSize: 50 });
      const rows = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data)
        ? data
        : [];
      setRequests(rows);
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

  const totalRequests = requests.length;

  const statusCounts = useMemo(() => {
    const counts = {};
    requests.forEach((req) => {
      const status = (req.status || req.estado || "sin_estado").toString();
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [requests]);

  const previewRequests = useMemo(() => requests.slice(0, 3), [requests]);

  const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString("es-ES") : "Fecha no disponible";

  return (
    <Card className="space-y-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-600 text-white shadow-lg">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-100/80">Mis solicitudes</p>
          <h2 className="text-3xl font-bold">{totalRequests}</h2>
          <p className="text-sm text-blue-50/80 max-w-xl">
            Conteo actualizado de los movimientos de clientes que tú registraste. Mantén la
            información alineada y solicita correcciones cuando sea necesario.
          </p>
        </div>
        <Button
          size="sm"
          variant="white"
          icon={FiRefreshCw}
          loading={loading}
          onClick={loadRequests}
        >
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["pending_approval", "pending_consent", "approved", "rejected"].map((key) => (
          <div
            key={key}
            className="rounded-2xl bg-white/15 p-3 text-center backdrop-blur"
          >
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">
              {STATUS_LABELS[key]}
            </p>
            <p className="text-2xl font-semibold">{statusCounts[key] || 0}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 bg-white/10 p-3 rounded-2xl">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span className="font-semibold">Solicitudes recientes</span>
          <span className="inline-flex items-center gap-1">
            <FiUserCheck />
            {totalRequests} totales
          </span>
        </div>
        {previewRequests.length === 0 ? (
          <p className="text-sm text-blue-50/70">Aún no has registrado solicitudes.</p>
        ) : (
          previewRequests.map((req) => (
            <div
              key={req.id || req.request_id}
              className="flex flex-col gap-1 rounded-xl border border-white/30 bg-white/10 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    Solicitud #{req.id || req.request_id}
                  </p>
                  <p className="text-[11px] text-blue-50/70">
                    {formatDate(req.created_at)}
                  </p>
                </div>
                <span className="rounded-full border border-white/30 px-2 py-[2px] text-[11px] text-white">
                  {STATUS_LABELS[req.status] || req.status || "Sin estado"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-blue-50">
                <FiEdit3 className="h-4 w-4" />
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    navigate(`/dashboard/backoffice/client-request/${req.id || req.request_id}`)
                  }
                >
                  Actualizar datos del cliente
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-blue-50/60">
        Si necesitas correcciones más profundas, abre la solicitud y agrega la información que te
        falte antes de reenviarla.
      </p>
    </Card>
  );
};

export default ACPClientSummaryWidget;
