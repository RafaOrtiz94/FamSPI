import React, { useEffect, useMemo, useState } from "react";
import { FiUsers, FiFilter } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Card from "../components/Card";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { formatDateSafe } from "../../../shared/utils/dateUtils";
import { useAuth } from "../../auth/AuthContext";
import { getPersonnelRequests, updatePersonnelRequestStatus } from "../../api/personnelRequestsApi";

const HRPersonnelRequestsWidget = ({ onReviewRequest }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.role || user?.role_name || user?.rol || "").toLowerCase();
  const canApprove = role === "gerencia_general";
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionNotes, setActionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const summary = useMemo(() => {
    const base = {
      total: 0,
      pendiente: 0,
      en_revision: 0,
      aprobada: 0,
      rechazada: 0,
      en_proceso: 0,
      completada: 0,
    };

    return (requests || []).reduce((acc, req) => {
      acc.total += 1;
      const key = req.status || "pendiente";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, base);
  }, [requests]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const filters = { pageSize: 10 };
      if (filterStatus !== "all") {
        filters.status = filterStatus;
      }
      const response = await getPersonnelRequests(filters);
      setRequests(response.data || []);
    } catch (error) {
      console.error("Error cargando solicitudes:", error);
      toast.error("Error al cargar solicitudes de personal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [filterStatus]);

  const getStatusBadge = (status) => {
    const badges = {
      pendiente: "bg-yellow-100 text-yellow-800",
      en_revision: "bg-blue-100 text-blue-800",
      aprobada: "bg-green-100 text-green-800",
      rechazada: "bg-red-100 text-red-800",
      en_proceso: "bg-purple-100 text-purple-800",
      completada: "bg-gray-100 text-gray-800",
    };

    return (
      <span
        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
          badges[status] || badges.pendiente
        }`}
      >
        {status?.replace("_", " ").toUpperCase()}
      </span>
    );
  };


  const openModal = (request) => {
    if (onReviewRequest) {
        onReviewRequest(request);
        return;
    }
    setSelectedRequest(request);
    setActionNotes("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (actionLoading) return;
    setModalOpen(false);
    setSelectedRequest(null);
  };

  const handleDecision = async (status) => {
    if (!selectedRequest) return;
    if (status === "rechazada" && !actionNotes.trim()) {
      toast.error("Agrega un motivo para rechazar la solicitud");
      return;
    }
    setActionLoading(true);
    try {
      await updatePersonnelRequestStatus(selectedRequest.id, status, actionNotes.trim() || null);
      toast.success(status === "aprobada" ? "Solicitud aprobada" : "Solicitud rechazada");
      await loadRequests();
      closeModal();
    } catch (error) {
      console.error("Error actualizando solicitud:", error);
      toast.error(error.response?.data?.message || "No se pudo actualizar la solicitud");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-3 mb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <FiUsers className="text-blue-600" size={22} />
          <h3 className="text-lg font-semibold text-gray-900">Flujo de Personal</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FiFilter size={16} className="text-gray-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas</option>
            <option value="pendiente">Pendientes</option>
            <option value="en_revision">En revision</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="en_proceso">En Proceso</option>
            <option value="completada">Completadas</option>
          </select>
          <Button variant="secondary" size="sm" onClick={loadRequests} disabled={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      <div className="mb-4 text-xs text-gray-600">
        Total: <span className="font-semibold text-gray-900">{summary.total}</span> · Pendientes:{" "}
        <span className="font-semibold text-yellow-700">{summary.pendiente}</span> · En revisión:{" "}
        <span className="font-semibold text-blue-700">{summary.en_revision}</span> · Aprobadas:{" "}
        <span className="font-semibold text-green-700">{summary.aprobada}</span> · En proceso:{" "}
        <span className="font-semibold text-purple-700">{summary.en_proceso}</span> · Completadas:{" "}
        <span className="font-semibold text-gray-700">{summary.completada}</span>
      </div>

      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FiUsers size={48} className="mx-auto mb-2 opacity-50" />
            <p>No hay solicitudes de personal</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-semibold text-gray-900">{request.position_title}</h5>
                    {getStatusBadge(request.status)}
                  </div>
                  <p className="text-sm text-gray-600">
                    {request.request_number} · {request.requester_name || request.requester_email}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Departamento: {request.department_name || "N/A"} · Fecha: {formatDateSafe(request.created_at)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openModal(request)}
                  >
                    Ver solicitud
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/dashboard/talento-humano/workspace-personal/${request.id}`)}
                  >
                    Abrir ficha
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      navigate(`/dashboard/talento-humano/workspace-personal/${request.id}?view=aspirantes`)
                    }
                  >
                    Ver postulantes
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title="Revision de Solicitud" maxWidth="max-w-2xl">
        {!selectedRequest ? (
          <div className="text-sm text-gray-600">No hay solicitud seleccionada.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-semibold text-gray-900">{selectedRequest.position_title}</h4>
              {getStatusBadge(selectedRequest.status)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
              <div>
                <span className="font-medium text-gray-900">Solicitante:</span>{" "}
                {selectedRequest.requester_name || selectedRequest.requester_email || "N/A"}
              </div>
              <div>
                <span className="font-medium text-gray-900">Departamento:</span>{" "}
                {selectedRequest.department_name || "N/A"}
              </div>
              <div>
                <span className="font-medium text-gray-900">Tipo:</span>{" "}
                {selectedRequest.position_type || "N/A"}
              </div>
              <div>
                <span className="font-medium text-gray-900">Vacantes:</span>{" "}
                {selectedRequest.quantity ?? "N/A"}
              </div>
              <div>
                <span className="font-medium text-gray-900">Urgencia:</span>{" "}
                {selectedRequest.urgency_level || "N/A"}
              </div>
              <div>
                <span className="font-medium text-gray-900">Fecha:</span>{" "}
                {formatDateSafe(selectedRequest.created_at)}
              </div>
            </div>

            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">Justificacion</p>
              <p className="whitespace-pre-wrap">{selectedRequest.justification || "N/A"}</p>
            </div>

            <div className="border-t border-gray-200 pt-3 text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-2">Condiciones laborales</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>Horario: {selectedRequest.work_schedule || "N/A"}</div>
                <div>Rango salarial: {selectedRequest.salary_range || "N/A"}</div>
                <div>Ubicacion: {selectedRequest.work_location || "N/A"}</div>
                <div>Beneficios: {selectedRequest.benefits || "N/A"}</div>
              </div>
            </div>

            {canApprove && (
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <label className="text-sm font-medium text-gray-900">Notas / Motivo</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Agrega notas para la aprobacion o el motivo del rechazo"
                />
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="secondary" onClick={closeModal} disabled={actionLoading}>
                    Cerrar
                  </Button>
                  <Button variant="danger" onClick={() => handleDecision("rechazada")} disabled={actionLoading}>
                    Rechazar
                  </Button>
                  <Button variant="primary" onClick={() => handleDecision("aprobada")} disabled={actionLoading}>
                    Aprobar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default HRPersonnelRequestsWidget;
