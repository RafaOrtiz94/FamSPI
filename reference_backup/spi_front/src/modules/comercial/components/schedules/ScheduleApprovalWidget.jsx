import React, { useState } from "react";
import { FiCalendar, FiEye } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import Modal from "../../../../core/ui/components/Modal";
import { useUI } from "../../../../core/ui/useUI";
import { useScheduleApproval } from "../../hooks/useScheduleApproval";
import ScheduleCard from "./ScheduleCard";
import ScheduleDetailModal from "./ScheduleDetailModal";
import RejectScheduleModal from "./RejectScheduleModal";

const ScheduleApprovalWidget = () => {
  const { pending, loading, approve, reject, loadPending } = useScheduleApproval();
  const { showToast } = useUI();
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const handleApprove = async (scheduleId) => {
    try {
      await approve(scheduleId);
      showToast("Cronograma aprobado", "success");
      setShowDetailModal(false);
      setSelectedSchedule(null);
    } catch (error) {
      showToast(error.message || "No se pudo aprobar", "error");
    }
  };

  const handleReject = async (reason) => {
    if (!selectedSchedule) return;
    try {
      await reject(selectedSchedule.id, reason);
      showToast("Cronograma rechazado", "success");
      setShowRejectModal(false);
      setShowDetailModal(false);
      setSelectedSchedule(null);
    } catch (error) {
      showToast(error.message || "No se pudo rechazar", "error");
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Cronogramas Pendientes de Aprobación</h3>
          <p className="text-sm text-gray-500">Revisa y aprueba los cronogramas mensuales de tu equipo</p>
        </div>
        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
          {pending.length} pendientes
        </span>
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando cronogramas...</p>}

      <div className="space-y-3">
        {pending.map((schedule) => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            onApprove={handleApprove}
            onReject={() => {
              setSelectedSchedule(schedule);
              setShowRejectModal(true);
            }}
            onViewDetails={() => {
              setSelectedSchedule(schedule);
              setShowDetailModal(true);
            }}
          />
        ))}
        {!pending.length && !loading && (
          <div className="text-sm text-gray-500">No hay cronogramas pendientes por revisar.</div>
        )}
      </div>

      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="Detalle de cronograma">
        {selectedSchedule && (
          <ScheduleDetailModal
            schedule={selectedSchedule}
            onApprove={() => handleApprove(selectedSchedule.id)}
            onReject={() => {
              setShowRejectModal(true);
            }}
          />
        )}
      </Modal>

      <RejectScheduleModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
      />

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" icon={FiEye} onClick={() => loadPending()}>
          Refrescar
        </Button>
        <Button size="sm" variant="success" icon={FiCalendar} onClick={() => loadPending()}>
          Actualizar lista
        </Button>
      </div>
    </Card>
  );
};

export default ScheduleApprovalWidget;
