import React, { useEffect } from "react";
import Card from "../../../core/ui/components/Card";
import { DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import useSchedules from "../hooks/useSchedules";
import ScheduleEditor from "../components/schedules/ScheduleEditor";
import ScheduleStatusBadge from "../components/schedules/ScheduleStatusBadge";

const PlanificacionMensual = () => {
  const { schedules, activeSchedule, loadScheduleDetail, create, addVisit, submit, remove, loading, error } =
    useSchedules();

  useEffect(() => {
    if (!activeSchedule && schedules.length) {
      loadScheduleDetail(schedules[0].id);
    }
  }, [activeSchedule, schedules, loadScheduleDetail]);

  return (
    <div className="space-y-4">
      <DashboardHeader title="Planificación mensual" />
      {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-3">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Tus cronogramas</h3>
              {loading && <span className="text-xs text-gray-500">Cargando…</span>}
            </div>
            {schedules.length === 0 && <p className="text-sm text-gray-500">No tienes cronogramas aún.</p>}
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <button
                  key={schedule.id}
                  className={`w-full border rounded-md p-3 text-left hover:bg-gray-50 flex items-center justify-between ${
                    activeSchedule?.id === schedule.id ? "border-indigo-500" : "border-gray-200"
                  }`}
                  onClick={() => loadScheduleDetail(schedule.id)}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {schedule.month}/{schedule.year}
                    </p>
                    <p className="text-xs text-gray-500">
                      Actualizado {schedule.updated_at ? new Date(schedule.updated_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <ScheduleStatusBadge status={schedule.status} />
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <ScheduleEditor
            schedule={activeSchedule}
            onCreate={create}
            onAddVisit={addVisit}
            onSubmit={submit}
            onDelete={remove}
          />
        </div>
      </div>
    </div>
  );
};

export default PlanificacionMensual;
