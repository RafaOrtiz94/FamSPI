import React, { useCallback, useEffect, useState } from "react";
import { FiUsers, FiRefreshCw, FiClipboard, FiCalendar, FiAlertCircle, FiUserPlus, FiFileText } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";
import ActionCard from "../../core/ui/patterns/ActionCard";
import { DashboardLayout, DashboardHeader } from "../../core/ui/layouts/DashboardLayout";
import { getCollaboratorStats } from "../../core/api/collaboratorsApi";
import { getAttendanceNonCompliance, scheduleAttendanceFollowUpMeeting } from "../../core/api/attendanceApi";

const TalentoDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [pendingReview, setPendingReview] = useState(0);
  const [nonComplianceRows, setNonComplianceRows] = useState([]);
  const [nonComplianceDays, setNonComplianceDays] = useState(7);
  const [meetingDateByUser, setMeetingDateByUser] = useState({});
  const [meetingTimeByUser, setMeetingTimeByUser] = useState({});
  const [schedulingUserId, setSchedulingUserId] = useState(null);
  const navigate = useNavigate();

  const loadNonCompliance = useCallback(async (days = 7) => {
    const response = await getAttendanceNonCompliance(days);
    setNonComplianceRows(Array.isArray(response?.data) ? response.data : []);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const stats = await getCollaboratorStats();
      setPendingReview(Number(stats?.pending_review || 0));
      await loadNonCompliance(nonComplianceDays);
    } catch (err) {
      console.error(err);
      toast.error("Error cargando datos de Talento Humano");
    } finally {
      setLoading(false);
    }
  }, [loadNonCompliance, nonComplianceDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLoadNonCompliance = useCallback(async () => {
    try {
      await loadNonCompliance(nonComplianceDays);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo consultar incumplimientos");
    }
  }, [loadNonCompliance, nonComplianceDays]);

  const handleScheduleMeeting = useCallback(async (row) => {
    if (!row?.user_id) return;
    const selectedDate = meetingDateByUser[row.user_id] || String(row.date || "").slice(0, 10);
    const selectedTime = meetingTimeByUser[row.user_id] || "09:30";
    setSchedulingUserId(row.user_id);
    try {
      const res = await scheduleAttendanceFollowUpMeeting(row.user_id, {
        date: selectedDate,
        start_time: selectedTime,
        duration_minutes: 30,
        reason: `Seguimiento por incumplimiento de horario: ${row.breach_label || "Incumplimiento"}`,
        breach_date: row.date,
        breach_type: row.breach_type,
      });
      toast.success(res?.message || "Reunion agendada correctamente");
      await loadNonCompliance(nonComplianceDays);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "No se pudo agendar la reunion");
    } finally {
      setSchedulingUserId(null);
    }
  }, [loadNonCompliance, meetingDateByUser, meetingTimeByUser, nonComplianceDays]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <DashboardLayout includeWidgets={false}>
      <DashboardHeader
        title="Panel de Talento Humano"
        subtitle="Vision operativa de colaboradores, solicitudes y control de asistencia"
        actions={(
          <Button variant="secondary" icon={FiRefreshCw} onClick={loadData} disabled={loading}>
            Actualizar
          </Button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <FiAlertCircle className="mb-2 text-4xl text-amber-600" />
          <p className="text-sm text-gray-500">Pendientes actualizacion anual</p>
          <p className="text-2xl font-semibold">{pendingReview}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <FiUsers className="mb-2 text-4xl text-blue-600" />
          <p className="text-sm text-gray-500">Accesos directos operativos</p>
          <p className="text-2xl font-semibold">5</p>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Incumplimientos de horario</h3>
            <p className="text-sm text-slate-600">Llegada tarde sin justificacion y almuerzo mayor a 60 minutos.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-700">Ultimos dias</label>
            <select
              value={nonComplianceDays}
              onChange={(e) => setNonComplianceDays(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value={3}>3</option>
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
            </select>
            <Button variant="secondary" size="sm" onClick={handleLoadNonCompliance}>
              Consultar
            </Button>
          </div>
        </div>

        {nonComplianceRows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            No hay incumplimientos en el periodo seleccionado.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-2 py-2">Fecha</th>
                  <th className="px-2 py-2">Colaborador</th>
                  <th className="px-2 py-2">Departamento</th>
                  <th className="px-2 py-2">Incumplimiento</th>
                  <th className="px-2 py-2">Atraso</th>
                  <th className="px-2 py-2">Almuerzo</th>
                  <th className="px-2 py-2">Reunion</th>
                </tr>
              </thead>
              <tbody>
                {nonComplianceRows.map((row) => (
                  <tr key={`${row.user_id}-${row.date}-${row.breach_type}`} className="border-b border-slate-100">
                    <td className="px-2 py-2">{String(row.date || "").slice(0, 10)}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-900">{row.fullname || "Sin nombre"}</div>
                      <div className="text-xs text-slate-500">{row.email || "-"}</div>
                    </td>
                    <td className="px-2 py-2">{row.department_name || "-"}</td>
                    <td className="px-2 py-2">{row.breach_label || "Incumplimiento"}</td>
                    <td className="px-2 py-2">{row.late_minutes ? `${row.late_minutes} min` : "-"}</td>
                    <td className="px-2 py-2">{row.lunch_minutes ? `${row.lunch_minutes} min` : "-"}</td>
                    <td className="px-2 py-2">
                      {row.follow_up_meeting ? (
                        <div className="inline-flex flex-col rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                          <span className="font-semibold">Reunion agendada</span>
                          <span className="font-mono">
                            {String(row.follow_up_meeting.meeting_date || "").slice(0, 10)} {row.follow_up_meeting.start_time || ""}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={meetingDateByUser[row.user_id] || String(row.date || "").slice(0, 10)}
                            onChange={(e) => setMeetingDateByUser((prev) => ({ ...prev, [row.user_id]: e.target.value }))}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                          <input
                            type="time"
                            value={meetingTimeByUser[row.user_id] || "09:30"}
                            onChange={(e) => setMeetingTimeByUser((prev) => ({ ...prev, [row.user_id]: e.target.value }))}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleScheduleMeeting(row)}
                            disabled={schedulingUserId === row.user_id}
                          >
                            {schedulingUserId === row.user_id ? "Agendando..." : "Agendar reunion"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <ActionCard
          icon={FiClipboard}
          subtitle="Solicitudes"
          title="Ver Solicitudes"
          color="orange"
          onClick={() => navigate("/dashboard/talento-humano/solicitudes")}
        />
        <ActionCard
          icon={FiCalendar}
          subtitle="Permisos"
          title="Permisos y vacaciones"
          color="teal"
          onClick={() => navigate("/dashboard/talento-humano/permisos")}
        />
        <ActionCard
          icon={FiUserPlus}
          subtitle="Personal"
          title="Gestion de Personal"
          color="blue"
          onClick={() => navigate("/dashboard/talento-humano/workspace-personal")}
        >
          <div className="mt-3 flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/dashboard/talento-humano/workspace-personal");
              }}
            >
              Postulantes (Workspace)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/dashboard/talento-humano/colaboradores");
              }}
            >
              Colaboradores (Actualizacion)
            </Button>
          </div>
        </ActionCard>
        <ActionCard
          icon={FiRefreshCw}
          subtitle="Reportes"
          title="Asistencia Reportes"
          color="purple"
          onClick={() => navigate("/dashboard/talento-humano/asistencia-reportes")}
        />
        <ActionCard
          icon={FiFileText}
          subtitle="Reportes"
          title="Reporte de Documentacion"
          color="indigo"
          onClick={() => navigate("/dashboard/talento-humano/reporte-documentacion")}
        />
      </div>
    </DashboardLayout>
  );
};

export default TalentoDashboard;
