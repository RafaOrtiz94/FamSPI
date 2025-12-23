import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiCheck, FiEye, FiRefreshCw, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { processClientRequest, getClientRequests } from "../../../core/api/requestsApi";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";

const ClientApprovalsWidget = () => {
  const navigate = useNavigate();
  const { showToast } = useUI();
  const [processingId, setProcessingId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rejectContext, setRejectContext] = useState({
    open: false,
    request: null,
    reason: "",
  });

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClientRequests({ page: 1, pageSize: 4, status: "pending_approval" });
      setRequests(data.rows || data || []);
    } catch (error) {
      console.error(error);
      showToast("No pudimos cargar las solicitudes pendientes", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleProcess = useCallback(
    async (id, action, rejectionReason) => {
      setProcessingId(`${action}-${id}`);
      try {
        await processClientRequest(
          id,
          action,
          action === "reject" ? rejectionReason : undefined
        );
        showToast(
          action === "approve" ? "Solicitud aprobada" : "Solicitud rechazada",
          "success"
        );
        await loadRequests();
      } catch (error) {
        console.error(error);
        showToast("No se pudo procesar la solicitud", "error");
      } finally {
        setProcessingId(null);
      }
    },
    [loadRequests, showToast],
  );

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadRequests();
  }, [loadRequests]);

  const pendingCount = requests.length;

  const openRejectModal = (req) => {
    setRejectContext({ open: true, request: req, reason: "" });
  };

  const closeRejectModal = () => {
    setRejectContext({ open: false, request: null, reason: "" });
  };

  const confirmReject = async () => {
    if (!rejectContext.request) return;
    if (!rejectContext.reason.trim()) {
      showToast("Ingrese el motivo del rechazo", "warning");
      return;
    }
    await handleProcess(
      rejectContext.request.id,
      "reject",
      rejectContext.reason.trim()
    );
    closeRejectModal();
  };

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">
            Solicitudes de clientes
          </p>
          <p className="text-sm text-gray-600">
            Panel de aprobación y control centralizado
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            icon={FiRefreshCw}
            onClick={loadRequests}
            loading={loading}
          >
            Actualizar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate("/dashboard/backoffice/client-requests")}
          >
            Ver todas
          </Button>
        </div>
      </div>

      {/* Estado vacío */}
      {requests.length === 0 && !loading ? (
        <div className="text-sm text-gray-500 bg-gray-50 rounded-xl py-4 text-center border">
          No hay solicitudes pendientes
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-gray-200 px-4 py-3 bg-white shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Info */}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {req.commercial_name || "Cliente sin nombre"}
                  </p>

                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-gray-500">
                      {req.ruc_cedula
                        ? `RUC/Cédula: ${req.ruc_cedula}`
                        : "Identificación no disponible"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Creado por:{" "}
                      <span className="font-medium text-gray-700">
                        {req.created_by || "—"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<FiEye />}
                    onClick={() =>
                      navigate(`/dashboard/backoffice/client-request/${req.id}`)
                    }
                  >
                    Ver
                  </Button>

                  <Button
                    size="sm"
                    variant="success"
                    leftIcon={<FiCheck />}
                    loading={processingId === `approve-${req.id}`}
                    onClick={() => handleProcess(req.id, "approve")}
                  >
                    Aprobar
                  </Button>

                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={<FiX />}
                    loading={processingId === `reject-${req.id}`}
                    onClick={() => openRejectModal(req)}
                  >
                    Rechazar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {rejectContext.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500">
                  Solicitud #{rejectContext.request?.id}
                </p>
                <h3 className="text-lg font-semibold text-gray-900">
                  Motivo del rechazo
                </h3>
              </div>
              <button
                onClick={closeRejectModal}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <FiX />
              </button>
            </div>

            <textarea
              value={rejectContext.reason}
              onChange={(event) =>
                setRejectContext((prev) => ({
                  ...prev,
                  reason: event.target.value,
                }))
              }
              placeholder="Explica brevemente por qué rechazas esta solicitud"
              className="mt-4 h-32 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={closeRejectModal}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmReject}>
                Confirmar rechazo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientApprovalsWidget;
