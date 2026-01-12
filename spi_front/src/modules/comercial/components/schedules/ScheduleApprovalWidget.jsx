import React, { useState } from "react";
import { FiCalendar, FiEye } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import Modal from "../../../../core/ui/components/Modal";
import { useUI } from "../../../../core/ui/useUI";
import { useScheduleApproval } from "../../hooks/useScheduleApproval";
import { fetchScheduleDetail } from "../../../../core/api/schedulesApi";
import ScheduleCard from "./ScheduleCard";
import ScheduleDetailModal from "./ScheduleDetailModal";
import RejectScheduleModal from "./RejectScheduleModal";

const ScheduleApprovalWidget = () => {
  const { pending, loading: listLoading, approve, reject, loadPending } = useScheduleApproval();
  const { showToast } = useUI();
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
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

      {listLoading && <p className="text-sm text-gray-500">Cargando cronogramas...</p>}

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
            onViewDetails={async () => {
              setSelectedSchedule(schedule);
              setShowDetailModal(true);
              setModalLoading(true);
              try {
                const fullData = await fetchScheduleDetail(schedule.id);
                setSelectedSchedule(fullData);
              } catch (err) {
                showToast("No se pudo cargar el detalle", "error");
              } finally {
                setModalLoading(false);
              }
            }}
          />
        ))}
        {!pending.length && !listLoading && (
          <div className="text-sm text-gray-500">No hay cronogramas pendientes por revisar.</div>
        )}
      </div>

      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="Detalle de cronograma">
        {modalLoading ? (
          <div className="p-10 flex flex-col items-center justify-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
            <p className="text-sm">Cargando detalles...</p>
          </div>
        ) : selectedSchedule ? (
          <ScheduleDetailModal
            schedule={selectedSchedule}
            onApprove={() => handleApprove(selectedSchedule.id)}
            onReject={() => {
              setShowRejectModal(true);
            }}
          />
        ) : null}
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
