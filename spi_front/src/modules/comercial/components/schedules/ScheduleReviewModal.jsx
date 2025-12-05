import React from "react";
import ScheduleCalendarView from "./ScheduleCalendarView";
import ScheduleStatusBadge from "./ScheduleStatusBadge";

const ScheduleReviewModal = ({ schedule, onApprove, onReject }) => {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  if (!schedule) return null;

  return (
    <div>
      <button
        className="text-indigo-600 text-sm font-semibold"
        onClick={() => setOpen(true)}
      >
        Ver detalle
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Cronograma {schedule.month}/{schedule.year}
                </h3>
                <p className="text-xs text-gray-500">Asesor: {schedule.user_email}</p>
              </div>
              <ScheduleStatusBadge status={schedule.status} />
            </div>

            <ScheduleCalendarView schedule={schedule} />

            {schedule.rejection_reason && (
              <div className="p-3 rounded bg-red-50 text-sm text-red-700">
                Último rechazo: {schedule.rejection_reason}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-2 bg-gray-100 rounded"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded"
                onClick={() => {
                  onApprove?.(schedule.id);
                  setOpen(false);
                }}
              >
                Aprobar
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Razón de rechazo"
                  className="border rounded px-2 py-1"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded"
                  onClick={() => {
                    onReject?.(schedule.id, reason);
                    setReason("");
                    setOpen(false);
                  }}
                  disabled={!reason}
                >
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleReviewModal;
