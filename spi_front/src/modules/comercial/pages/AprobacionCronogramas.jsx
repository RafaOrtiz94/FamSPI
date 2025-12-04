import React from "react";
import Card from "../../../core/ui/components/Card";
import { DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import useScheduleApproval from "../hooks/useScheduleApproval";
import ScheduleReviewModal from "../components/schedules/ScheduleReviewModal";
import TeamScheduleOverview from "../components/schedules/TeamScheduleOverview";
import ScheduleStatusBadge from "../components/schedules/ScheduleStatusBadge";

const AprobacionCronogramas = () => {
  const { pending, teamSchedules, analytics, loading, error, approve, reject } = useScheduleApproval();

  return (
    <div className="space-y-4">
      <DashboardHeader title="Aprobación de cronogramas" />
      {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Pendientes de aprobación</h3>
                <p className="text-sm text-gray-500">Revisa y aprueba cronogramas enviados</p>
              </div>
              {loading && <span className="text-xs text-gray-500">Cargando…</span>}
            </div>
            {pending.length === 0 && <p className="text-sm text-gray-500">No hay cronogramas pendientes.</p>}
            <div className="space-y-2">
              {pending.map((schedule) => (
                <div key={schedule.id} className="border rounded-md p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {schedule.user_email} — {schedule.month}/{schedule.year}
                    </p>
                    <p className="text-xs text-gray-500">
                      Enviado: {schedule.submitted_at ? new Date(schedule.submitted_at).toLocaleString() : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScheduleStatusBadge status={schedule.status} />
                    <ScheduleReviewModal
                      schedule={{ ...schedule, visits: schedule.visits || [] }}
                      onApprove={approve}
                      onReject={reject}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="p-4">
            <h4 className="text-sm font-semibold text-gray-900">Métricas</h4>
            <ul className="text-sm text-gray-700 space-y-1 mt-2">
              <li>En borrador: {analytics?.byStatus?.draft || 0}</li>
              <li>Pendientes: {analytics?.byStatus?.pending_approval || 0}</li>
              <li>Aprobados: {analytics?.byStatus?.approved || 0}</li>
              <li>Rechazados: {analytics?.byStatus?.rejected || 0}</li>
            </ul>
          </Card>
          <TeamScheduleOverview schedules={teamSchedules} />
        </div>
      </div>
    </div>
  );
};

export default AprobacionCronogramas;
