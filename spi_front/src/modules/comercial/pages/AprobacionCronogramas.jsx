import React from "react";
import Card from "../../../core/ui/components/Card";
import { DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import useScheduleApproval from "../hooks/useScheduleApproval";
import TeamScheduleOverview from "../components/schedules/TeamScheduleOverview";
import ScheduleApprovalWidget from "../components/schedules/ScheduleApprovalWidget";

const AprobacionCronogramas = () => {
  const { teamSchedules, analytics, error } = useScheduleApproval();

  return (
    <div className="space-y-4">
      <DashboardHeader title="Aprobación de cronogramas" />
      {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <ScheduleApprovalWidget />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TeamScheduleOverview schedules={teamSchedules} />
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
        </div>
      </div>
    </div>
  );
};

export default AprobacionCronogramas;
