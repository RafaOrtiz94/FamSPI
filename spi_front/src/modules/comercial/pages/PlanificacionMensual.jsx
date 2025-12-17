import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiLock,
  FiEdit3,
  FiAlertTriangle,
  FiActivity,
  FiCheckCircle,
  FiTrendingUp,
} from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import { DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import { useAuth } from "../../../core/auth/useAuth";
import useSchedules from "../hooks/useSchedules";
import ScheduleEditor from "../components/schedules/ScheduleEditor";
import ScheduleStatusBadge from "../components/schedules/ScheduleStatusBadge";
import ScheduleApprovalWidget from "../components/schedules/ScheduleApprovalWidget";
import EditWarningModal from "../components/schedules/EditWarningModal";

/* =========================
   CONFIG VISUAL ENTERPRISE
========================= */
const STATUS_META = {
  draft: {
    gradient: "from-slate-500 to-slate-700",
    label: "Borrador",
  },
  pending_approval: {
    gradient: "from-amber-500 to-orange-600",
    label: "Pendiente de aprobación",
  },
  approved: {
    gradient: "from-emerald-500 to-green-700",
    label: "Aprobado",
  },
  rejected: {
    gradient: "from-rose-500 to-red-700",
    label: "Rechazado",
  },
};

const PlanificacionMensual = () => {
  const { role } = useAuth();
  const isManager = ["jefe_comercial", "gerencia", "gerencia_general"].includes(
    role,
  );

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

  /* =========================
     BLOQUEO LÓGICO
  ========================= */
  useEffect(() => {
    if (!activeSchedule && schedules.length) {
      setUnlockedScheduleId(null);
      setEditingLocked(schedules[0].status === "approved");
      loadScheduleDetail(schedules[0].id);
    }
  }, [activeSchedule, schedules, loadScheduleDetail]);

  useEffect(() => {
    if (!activeSchedule) return;
    const locked =
      activeSchedule.status === "approved" &&
      unlockedScheduleId !== activeSchedule.id;
    setEditingLocked(locked);
  }, [activeSchedule, unlockedScheduleId]);

  /* =========================
     HANDLERS
  ========================= */
  const handleSelectSchedule = useCallback(
    (e) => {
      const id = Number(e.target.value);
      const schedule = schedules.find((s) => s.id === id);
      if (!schedule) return;
      setUnlockedScheduleId(null);
      setEditingLocked(schedule.status === "approved");
      loadScheduleDetail(schedule.id);
    },
    [loadScheduleDetail, schedules],
  );

  const startEditing = useCallback(
    (schedule) => {
      setEditingLocked(false);
      setUnlockedScheduleId(
        schedule.status === "approved" ? schedule.id : null,
      );
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

  /* =========================
     KPIs
  ========================= */
  const kpis = useMemo(() => {
    if (!activeSchedule) return [];
    return [
      {
        label: "Periodo",
        value: `${activeSchedule.month}/${activeSchedule.year}`,
        icon: FiCalendar,
      },
      {
        label: "Visitas",
        value: activeSchedule.visits?.length || 0,
        icon: FiActivity,
      },
      {
        label: "Estado",
        value: STATUS_META[activeSchedule.status]?.label,
        icon: FiCheckCircle,
      },
    ];
  }, [activeSchedule]);

  const statusMeta =
    STATUS_META[activeSchedule?.status] || STATUS_META.draft;

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="space-y-8">
      {/* 1️⃣ HEADER ESTRATÉGICO */}
      <div
        className={`rounded-2xl p-6 text-white shadow-xl bg-gradient-to-r ${statusMeta.gradient}`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Planificación Mensual
            </h1>
            <p className="text-sm opacity-90">
              Consola operativa • Control • Ejecución
            </p>
          </div>

          {activeSchedule && (
            <div className="flex items-center gap-3">
              <ScheduleStatusBadge status={activeSchedule.status} />
              <span className="text-sm font-semibold">
                {activeSchedule.month}/{activeSchedule.year}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {isManager ? (
        <ScheduleApprovalWidget />
      ) : (
        <>
          {/* 2️⃣ CONTROL BAR */}
          <Card className="p-5">
            <div className="grid lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Periodo operativo
                </label>
                <select
                  value={activeSchedule?.id || ""}
                  onChange={handleSelectSchedule}
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.month}/{s.year}
                    </option>
                  ))}
                </select>
              </div>

              {kpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <kpi.icon className="text-indigo-600" />
                    <div>
                      <p className="text-xs text-gray-500">{kpi.label}</p>
                      <p className="text-lg font-bold text-gray-900">
                        {kpi.value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 3️⃣ ALERTA DE BLOQUEO */}
          {editingLocked && activeSchedule && (
            <Card className="p-5 border-red-300 bg-red-50">
              <div className="flex items-start gap-4">
                <FiLock className="text-red-600 text-xl mt-1" />
                <div>
                  <p className="text-sm font-bold text-red-800">
                    Cronograma aprobado
                  </p>
                  <p className="text-sm text-red-700">
                    Este cronograma está bloqueado por control operativo.
                    Cualquier cambio quedará registrado.
                  </p>
                  <button
                    onClick={() => handleEditSchedule(activeSchedule)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    <FiEdit3 /> Solicitar modificación
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* 4️⃣ ÁREA OPERATIVA */}
          <Card className="overflow-hidden shadow-xl">
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest">
                Área Operativa
              </h3>
              {loading && (
                <span className="text-xs opacity-80">
                  Sincronizando datos…
                </span>
              )}
            </div>

            <div className="p-6 bg-gradient-to-br from-white to-gray-50">
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
          </Card>
        </>
      )}

      {/* MODAL DE SEGURIDAD */}
      <EditWarningModal
        open={showEditWarning}
        onClose={() => setShowEditWarning(false)}
        onConfirm={confirmEdit}
      />
    </div>
  );
};

export default PlanificacionMensual;
