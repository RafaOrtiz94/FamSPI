import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiX, FiEye, FiRefreshCw } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { getClientRequests, processClientRequest } from "../../../core/api/requestsApi";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";

const ClientApprovalsWidget = () => {
  const navigate = useNavigate();
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [requests, setRequests] = useState([]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await getClientRequests({ status: "pending_approval", pageSize: 5, page: 1 });
      const rows = response?.rows || response?.data?.rows || response?.data || response || [];
      setRequests(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error(error);
      showToast("No se pudieron cargar las solicitudes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleProcess = async (id, action) => {
    let rejectionReason = undefined;
    if (action === "reject") {
      rejectionReason = window.prompt("Motivo del rechazo");
      if (rejectionReason === null) return;
    }

    setProcessingId(`${action}-${id}`);
    try {
      await processClientRequest(id, action, rejectionReason);
      showToast(action === "approve" ? "Solicitud aprobada" : "Solicitud rechazada", "success");
      await loadRequests();
    } catch (error) {
      console.error(error);
      showToast("No se pudo procesar la solicitud", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = useMemo(() => requests.length, [requests]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Solicitudes de clientes</p>
          <p className="text-sm text-gray-700">Pendientes de aprobación</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRequests}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
          <Button size="sm" variant="secondary" onClick={() => navigate("/dashboard/backoffice/client-requests") }>
            Ver todas
          </Button>
        </div>
      </div>

      {pendingCount === 0 && !loading ? (
        <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">No hay solicitudes pendientes</div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-lg border border-gray-200 p-3 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{req.commercial_name || "Cliente sin nombre"}</p>
                  <p className="text-xs text-gray-500">
                    {req.ruc_cedula ? `RUC/Cédula: ${req.ruc_cedula}` : "Identificación no disponible"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Creado por: {req.created_by || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/dashboard/backoffice/client-request/${req.id}`)}
                    leftIcon={<FiEye />}
                  >
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleProcess(req.id, "approve")}
                    loading={processingId === `approve-${req.id}`}
                    leftIcon={<FiCheck />}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleProcess(req.id, "reject")}
                    loading={processingId === `reject-${req.id}`}
                    leftIcon={<FiX />}
                  >
                    Rechazar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientApprovalsWidget;
