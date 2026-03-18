import React, { useState } from "react";
import toast from "react-hot-toast";
import { FiClock, FiAlertCircle, FiCheckCircle, FiXCircle } from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { formatDateSafe } from "../../../../shared/utils/dateUtils";
import { updatePersonnelRequestStatus } from "../../../../core/api/personnelRequestsApi";

const PersonnelRequestReview = ({ request, onUpdate, onCancel, canApprove }) => {
  const { showLoader, hideLoader } = useUI();
  const [actionNotes, setActionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const getStatusBadge = (status) => {
    const badges = {
      pendiente: { color: "bg-yellow-100 text-yellow-800", icon: FiClock, label: "Pendiente" },
      en_revision: { color: "bg-blue-100 text-blue-800", icon: FiAlertCircle, label: "En Revisión" },
      aprobada: { color: "bg-green-100 text-green-800", icon: FiCheckCircle, label: "Aprobada" },
      rechazada: { color: "bg-red-100 text-red-800", icon: FiXCircle, label: "Rechazada" },
      en_proceso: { color: "bg-purple-100 text-purple-800", icon: FiClock, label: "En Proceso" },
      completada: { color: "bg-gray-100 text-gray-800", icon: FiCheckCircle, label: "Completada" },
    };

    const badge = badges[status] || badges.pendiente;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon size={12} />
        {badge.label}
      </span>
    );
  };

  const handleDecision = async (status) => {
    if (!request) return;
    if (status === "rechazada" && !actionNotes.trim()) {
      toast.error("Agrega un motivo para rechazar la solicitud");
      return;
    }
    setActionLoading(true);
    showLoader(status === "aprobada" ? "Aprobando solicitud de personal..." : "Rechazando solicitud de personal...");
    try {
      await updatePersonnelRequestStatus(request.id, status, actionNotes.trim() || null);
      toast.success(status === "aprobada" ? "Solicitud aprobada" : "Solicitud rechazada");
      onUpdate?.();
    } catch (error) {
      console.error("Error actualizando solicitud:", error);
      toast.error(error.response?.data?.message || "No se pudo actualizar la solicitud");
    } finally {
      hideLoader();
      setActionLoading(false);
    }
  };

  if (!request) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{request.position_title}</h2>
          <div className="mt-1 flex items-center gap-2">
            {getStatusBadge(request.status)}
            <span className="text-sm text-gray-500">
              Solicitud #{request.request_number}
            </span>
          </div>
        </div>
        <Button variant="secondary" onClick={onCancel}>
          Volver
        </Button>
      </div>

      <div className="space-y-6">
        {request.workflow && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado operativo</p>
                <p className="text-sm font-semibold text-slate-900">{request.workflow.current_stage_label}</p>
              </div>
              <div className="text-sm text-slate-700">
                Responsable: <span className="font-semibold">{request.workflow.current_responsible_name || request.workflow.current_responsible_label}</span>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-slate-900" style={{ width: `${request.workflow.progress_percent || 0}%` }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="block font-medium text-gray-500">Solicitante</span>
            <span className="text-gray-900">{request.requester_name || request.requester_email || "N/A"}</span>
          </div>
          <div>
            <span className="block font-medium text-gray-500">Departamento</span>
            <span className="text-gray-900">{request.department_name || "N/A"}</span>
          </div>
          <div>
            <span className="block font-medium text-gray-500">Tipo de Contratación</span>
            <span className="text-gray-900 capitalize">{request.position_type || "N/A"}</span>
          </div>
          <div>
            <span className="block font-medium text-gray-500">Vacantes</span>
            <span className="text-gray-900">{request.quantity ?? "N/A"}</span>
          </div>
          <div>
            <span className="block font-medium text-gray-500">Urgencia</span>
            <span className="text-gray-900 capitalize">{request.urgency_level || "N/A"}</span>
          </div>
          <div>
            <span className="block font-medium text-gray-500">Fecha de Creación</span>
            <span className="text-gray-900">{formatDateSafe(request.created_at)}</span>
          </div>
        </div>

        <div>
          <h3 className="font-medium text-gray-900 mb-2">Justificación</h3>
          <div className="bg-gray-50 p-4 rounded-md text-sm text-gray-700 whitespace-pre-wrap">
            {request.justification || "Sin justificación"}
          </div>
        </div>

        <div>
          <h3 className="font-medium text-gray-900 mb-2">Condiciones Laborales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md text-sm text-gray-700">
            <div>
              <span className="font-medium">Horario:</span> {request.work_schedule || "N/A"}
            </div>
            <div>
              <span className="font-medium">Rango Salarial:</span> {request.salary_range || "N/A"}
            </div>
            <div>
              <span className="font-medium">Ubicación:</span> {request.work_location || "N/A"}
            </div>
            <div>
              <span className="font-medium">Beneficios:</span> {request.benefits || "N/A"}
            </div>
          </div>
        </div>

        {canApprove && (request.status === "pendiente" || request.status === "en_revision") && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-medium text-gray-900 mb-4">Dictamen de Gerencia</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas / Motivo
                </label>
                <textarea
                  className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Agrega notas para la aprobación o el motivo del rechazo"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="danger"
                  onClick={() => handleDecision("rechazada")}
                  disabled={actionLoading}
                >
                  Rechazar
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleDecision("aprobada")}
                  disabled={actionLoading}
                >
                  Aprobar Solicitud
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonnelRequestReview;
