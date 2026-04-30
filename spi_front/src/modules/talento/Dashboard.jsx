import React, { useCallback, useEffect, useState } from "react";
import { FiUsers, FiSettings, FiRefreshCw, FiClipboard, FiCalendar, FiAlertCircle, FiUserPlus } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";
import ActionCard from "../../core/ui/patterns/ActionCard";
import { DashboardLayout, DashboardHeader } from "../../core/ui/layouts/DashboardLayout";
import { getUsers } from "../../core/api/usersApi";
import { getDepartments } from "../../core/api/departmentsApi";
import { getCollaboratorStats } from "../../core/api/collaboratorsApi";
import { getAttendanceNonCompliance, scheduleAttendanceFollowUpMeeting } from "../../core/api/attendanceApi";

const TalentoDashboard = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
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
      const [u, d, stats] = await Promise.all([
        getUsers(),
        getDepartments({ include_inactive: true }),
        getCollaboratorStats(),
      ]);
      setUsers(u);
      setDepartments(d);
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
      });
      toast.success(res?.message || "Reunión agendada correctamente");
      await loadNonCompliance(nonComplianceDays);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "No se pudo agendar la reunión");
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

  const activosReales = users.filter((u) => u.active !== false).length;
  const inactivosReales = users.filter((u) => u.active === false).length;
  const departmentsActive = departments.filter((d) => String(d.status || "").toLowerCase() !== "inactive").length;
  const departmentsInactive = departments.filter((d) => String(d.status || "").toLowerCase() === "inactive").length;
  const pendientes = users.filter((u) => u.role === "pendiente").length;

  return (
    <DashboardLayout includeWidgets={false}>
      <DashboardHeader
        title="Panel de Talento Humano"
        subtitle="Visión consolidada de usuarios, departamentos y solicitudes"
        actions={(
          <Button variant="secondary" icon={FiRefreshCw} onClick={loadData} disabled={loading}>
            Actualizar
          </Button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <FiUsers className="mb-2 text-4xl text-blue-600" />
          <p className="text-sm text-gray-500">Usuarios Registrados</p>
          <p className="text-2xl font-semibold">{users.length}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <FiSettings className="mb-2 text-4xl text-green-600" />
          <p className="text-sm text-gray-500">Departamentos</p>
          <p className="text-2xl font-semibold">{departments.length}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <FiUsers className="mb-2 text-4xl text-yellow-600" />
          <p className="text-sm text-gray-500">Usuarios Activos</p>
          <p className="text-2xl font-semibold">{activosReales}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <FiUsers className="mb-2 text-4xl text-red-600" />
          <p className="text-sm text-gray-500">Usuarios Inactivos</p>
          <p className="text-2xl font-semibold">{inactivosReales}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <FiUsers className="mb-2 text-4xl text-indigo-600" />
          <p className="text-sm text-gray-500">Pendientes de asignación</p>
          <p className="text-2xl font-semibold">{pendientes}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <FiAlertCircle className="mb-2 text-4xl text-amber-600" />
          <p className="text-sm text-gray-500">Pendientes actualización anual</p>
          <p className="text-2xl font-semibold">{pendingReview}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <FiSettings className="mb-2 text-4xl text-slate-600" />
          <p className="text-sm text-gray-500">Deptos Activos</p>
          <p className="text-2xl font-semibold">{departmentsActive}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <FiSettings className="mb-2 text-4xl text-slate-400" />
          <p className="text-sm text-gray-500">Deptos Inactivos</p>
          <p className="text-2xl font-semibold">{departmentsInactive}</p>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Incumplimientos de horario</h3>
            <p className="text-sm text-slate-600">Llegada tarde sin justificación y almuerzo mayor a 60 minutos.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-700">Últimos días</label>
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
                  <th className="px-2 py-2">Reunión</th>
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
                          {schedulingUserId === row.user_id ? "Agendando..." : "Agendar reunión"}
                        </Button>
                      </div>
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
          icon={FiSettings}
          subtitle="Administración"
          title="Usuarios y Departamentos"
          color="blue"
          onClick={() => navigate("/dashboard/talento-humano/gestion")}
        />
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
          title="Gestión de Personal"
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
              Colaboradores (Actualización)
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
      </div>
    </DashboardLayout>
  );
};

export default TalentoDashboard;
