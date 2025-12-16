import React, { useCallback, useEffect, useMemo, useState } from "react";
import Card from "../../../core/ui/components/Card";
import { DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import { useAuth } from "../../../core/auth/useAuth";
import useSchedules from "../hooks/useSchedules";
import ScheduleEditor from "../components/schedules/ScheduleEditor";
import ScheduleStatusBadge from "../components/schedules/ScheduleStatusBadge";
import ScheduleApprovalWidget from "../components/schedules/ScheduleApprovalWidget";
import EditWarningModal from "../components/schedules/EditWarningModal";

const PlanificacionMensual = () => {
  const { role } = useAuth();
  const isManager = ["jefe_comercial", "gerencia", "gerencia_general"].includes(role);
  const {
    schedules,
    activeSchedule,
    loadScheduleDetail,
    create,
    addVisit,
    updateVisit,
    removeVisit,
    submit,
    remove,
    loading,
    error,
  } = useSchedules({ skipLoad: isManager });
  const [editingLocked, setEditingLocked] = useState(false);
  const [unlockedScheduleId, setUnlockedScheduleId] = useState(null);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [scheduleToUnlock, setScheduleToUnlock] = useState(null);

  useEffect(() => {
    if (!activeSchedule && schedules.length) {
      setUnlockedScheduleId(null);
      setEditingLocked(["approved"].includes(schedules[0].status));
      loadScheduleDetail(schedules[0].id);
    }
  }, [activeSchedule, schedules, loadScheduleDetail]);

  useEffect(() => {
    if (!activeSchedule) return;
    const shouldLock = activeSchedule.status === "approved" && unlockedScheduleId !== activeSchedule.id;
    setEditingLocked(shouldLock);
  }, [activeSchedule, unlockedScheduleId]);

  const handleSelectSchedule = useCallback(
    (schedule) => {
      setUnlockedScheduleId(null);
      setEditingLocked(schedule.status === "approved");
      loadScheduleDetail(schedule.id);
    },
    [loadScheduleDetail],
  );

  const startEditing = useCallback(
    (schedule) => {
      setEditingLocked(false);
      setUnlockedScheduleId(schedule.status === "approved" ? schedule.id : null);
      loadScheduleDetail(schedule.id);
    },
    [loadScheduleDetail],
  );

  const handleEditSchedule = useCallback(
    (schedule) => {
      if (!schedule) return;
      if (schedule.status === "approved") {
        setScheduleToUnlock(schedule);
        setShowEditWarning(true);
        return;
      }
      startEditing(schedule);
    },
    [startEditing],
  );

  const confirmEdit = useCallback(() => {
    if (scheduleToUnlock) {
      setUnlockedScheduleId(scheduleToUnlock.id);
      startEditing(scheduleToUnlock);
    }
    setShowEditWarning(false);
    setScheduleToUnlock(null);
  }, [scheduleToUnlock, startEditing]);

  const scheduleCards = useMemo(
    () =>
      schedules.map((schedule) => {
        const isActive = activeSchedule?.id === schedule.id;
        return (
          <div
            key={schedule.id}
            className={`rounded-md p-3 border ${isActive ? "border-indigo-500 bg-indigo-50/30" : "border-gray-200"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {schedule.month}/{schedule.year}
                </p>
                <p className="text-xs text-gray-500">
                  Actualizado {schedule.updated_at ? new Date(schedule.updated_at).toLocaleDateString() : ""}
                </p>
              </div>
              <ScheduleStatusBadge status={schedule.status} />
            </div>

            {schedule.status === "rejected" && schedule.rejection_reason && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
                <p className="text-xs font-semibold text-red-800">Razón de rechazo</p>
                <p className="text-xs text-red-700">{schedule.rejection_reason}</p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-800 hover:border-gray-300"
                onClick={() => handleSelectSchedule(schedule)}
              >
                Ver detalles
              </button>
              {schedule.status === "draft" && (
                <button
                  className="rounded bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  onClick={() => handleEditSchedule(schedule)}
                >
                  Editar
                </button>
              )}
              {schedule.status === "pending_approval" && (
                <button
                  className="rounded bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                  onClick={() => handleEditSchedule(schedule)}
                >
                  Editar
                </button>
              )}
              {schedule.status === "approved" && (
                <button
                  className="rounded bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  onClick={() => handleEditSchedule(schedule)}
                >
                  Modificar
                </button>
              )}
              {schedule.status === "rejected" && (
                <button
                  className="rounded bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                  onClick={() => handleEditSchedule(schedule)}
                >
                  Corregir y reenviar
                </button>
              )}
            </div>
          </div>
        );
      }),
    [activeSchedule?.id, handleEditSchedule, schedules],
  );

  return (
    <div className="space-y-4">
      <DashboardHeader title="Planificación mensual" />
      {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      {isManager ? (
        <ScheduleApprovalWidget />
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Tus cronogramas</h3>
                {loading && <span className="text-xs text-gray-500">Cargando…</span>}
              </div>
              {schedules.length === 0 && <p className="text-sm text-gray-500">No tienes cronogramas aún.</p>}
              <div className="space-y-2">{scheduleCards}</div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <ScheduleEditor
              schedule={activeSchedule}
              editingLocked={editingLocked}
              onRequestEdit={() => handleEditSchedule(activeSchedule)}
              onCreate={create}
              onAddVisit={addVisit}
               onUpdateVisit={updateVisit}
               onRemoveVisit={removeVisit}
              onSubmit={submit}
              onDelete={remove}
            />
          </div>
        </div>
      )}

      <EditWarningModal open={showEditWarning} onClose={() => setShowEditWarning(false)} onConfirm={confirmEdit} />
    </div>
  );
};

export default PlanificacionMensual;
