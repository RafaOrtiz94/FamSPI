import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
 FiRefreshCw,
 FiDownload,
 FiTrendingUp,
 FiUsers,
 FiCalendar,
 FiCheckCircle,
 FiShoppingCart,
 FiLayers,
 FiFileText,
 FiClipboard,
 FiShield,
 FiLogOut,
} from "react-icons/fi";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import Button from "../../core/ui/components/Button";
import StatCard from "../../core/ui/patterns/StatCard";
import { DashboardLayout, DashboardHeader } from "../../core/ui/layouts/DashboardLayout";
import { useUI } from "../../core/ui/useUI";
import { logout } from "../../core/api";
import { listPrivatePurchases, getPrivatePurchaseStats } from "../../core/api/privatePurchasesApi";
import { listEquipmentPurchases } from "../../core/api/equipmentPurchasesApi";
import { fetchClients } from "../../core/api/clientsApi";
import { getPendientes } from "../../core/api/permisosApi";
import { getCollaboratorStats } from "../../core/api/collaboratorsApi";
import { usePurchaseSSE } from "../../core/hooks/usePurchaseSSE";
import {
  getAttendanceNonCompliance,
  getAttendanceRange,
  scheduleAttendanceFollowUpMeeting,
} from "../../core/api/attendanceApi";

const Dashboard = () => {
 const { showToast, showLoader, hideLoader } = useUI();
 const [loading, setLoading] = useState(true);
 const [privateCount, setPrivateCount] = useState(0);
 const [publicCount, setPublicCount] = useState(0);
 const [pendingPrivateApprovals, setPendingPrivateApprovals] = useState(0);
 const [clientsCount, setClientsCount] = useState(0);
 const [vacationPending, setVacationPending] = useState(0);
 const [profilePercent, setProfilePercent] = useState(0);
 const [pendingRequests, setPendingRequests] = useState([]);
 const [attendanceTodaySummary, setAttendanceTodaySummary] = useState(null);
 const [nonComplianceRows, setNonComplianceRows] = useState([]);
 const [nonComplianceDays, setNonComplianceDays] = useState(7);
 const [meetingDateByUser, setMeetingDateByUser] = useState({});
 const [meetingTimeByUser, setMeetingTimeByUser] = useState({});
 const [schedulingUserId, setSchedulingUserId] = useState(null);
 const reportRef = React.useRef();

 const quickAccess = useMemo(
 () => [
 { label: "Album de Compras", path: "/dashboard/gerencia/compras-album", icon: FiLayers },
 { label: "Workspace Compras", path: "/dashboard/purchases/workspace", icon: FiShoppingCart },
 { label: "Business Case", path: "/dashboard/business-case", icon: FiFileText },
 { label: "Aprobacion de planes", path: "/dashboard/comercial/aprobaciones-planificacion", icon: FiClipboard },
 { label: "Planificacion", path: "/dashboard/comercial/planificacion", icon: FiClipboard },
 { label: "Permisos y Vacaciones", path: "/dashboard/talento-humano/permisos", icon: FiCalendar },
 { label: "Colaboradores", path: "/dashboard/talento-humano/colaboradores", icon: FiUsers },
 { label: "Auditoria", path: "/dashboard/auditoria", icon: FiShield },
 { label: "Prep. Auditoria", path: "/dashboard/auditoria/preparacion", icon: FiCheckCircle },
 ],
 []
 );

 const refreshPurchaseStats = useCallback(async () => {
 const [privateList, publicList, privateStats] = await Promise.all([
 listPrivatePurchases(),
 listEquipmentPurchases(),
 getPrivatePurchaseStats("gerencia_general"),
 ]);

 setPrivateCount((privateList || []).length);
 setPublicCount((publicList || []).length);
 setPendingPrivateApprovals(Number(privateStats?.pending_approval || 0));

 return { privateList, publicList, privateStats };
 }, []);

 const load = async () => {
 setLoading(true);
 showLoader();
 try {
 await refreshPurchaseStats();
 const [clients, pendientes, collabStats] = await Promise.all([
 fetchClients(),
 getPendientes("pending"),
 getCollaboratorStats(),
 ]);
 const nonCompliance = await getAttendanceNonCompliance(nonComplianceDays);
 setNonComplianceRows(Array.isArray(nonCompliance?.data) ? nonCompliance.data : []);
 const today = new Date();
 const yyyy = today.getFullYear();
 const mm = String(today.getMonth() + 1).padStart(2, "0");
 const dd = String(today.getDate()).padStart(2, "0");
 const todayIso = `${yyyy}-${mm}-${dd}`;
 const attendanceToday = await getAttendanceRange({
  startDate: todayIso,
  endDate: todayIso,
  userId: "all",
 });
 setAttendanceTodaySummary(attendanceToday?.summary || null);

 const totalClients = clients?.summary?.total || (clients?.clients?.length || 0);
 setClientsCount(totalClients);

 const pendingData = pendientes?.data || [];
 const pendingVac = pendingData.filter(
 (item) => item?.tipo_solicitud === "vacaciones"
 ).length;
 setVacationPending(pendingVac);
 setPendingRequests(pendingData);

 setProfilePercent(Number(collabStats?.data?.percent_complete || 0));

 return true;
 } catch (err) {
 console.error(err);
 showToast("Error al cargar indicadores", "error");
 return null;
 } finally {
 hideLoader();
 setLoading(false);
 }
 };

 const reloadNonCompliance = useCallback(async () => {
  try {
   const response = await getAttendanceNonCompliance(nonComplianceDays);
   setNonComplianceRows(Array.isArray(response?.data) ? response.data : []);
  } catch (error) {
   console.error(error);
   showToast("No se pudo consultar incumplimientos de horario", "error");
  }
 }, [nonComplianceDays, showToast]);

 const handleScheduleMeeting = useCallback(async (row) => {
  if (!row?.user_id) return;
  const selectedDate = meetingDateByUser[row.user_id] || String(row.date || "").slice(0, 10);
  const selectedTime = meetingTimeByUser[row.user_id] || "09:30";
  setSchedulingUserId(row.user_id);
  try {
   const result = await scheduleAttendanceFollowUpMeeting(row.user_id, {
    date: selectedDate,
    start_time: selectedTime,
    duration_minutes: 30,
    reason: `Seguimiento gerencial por incumplimiento de horario: ${row.breach_label || "Incumplimiento"}`,
   });
   showToast(result?.message || "Reunión agendada correctamente", "success");
   await reloadNonCompliance();
  } catch (error) {
   console.error(error);
   showToast(error?.response?.data?.message || "No se pudo agendar la reunión", "error");
  } finally {
   setSchedulingUserId(null);
  }
 }, [meetingDateByUser, meetingTimeByUser, reloadNonCompliance, showToast]);

 const handlePurchaseEvent = useCallback(() => {
 refreshPurchaseStats().catch((error) => {
 console.warn("[GERENCIA_DASH][SSE] Error refrescando compras:", error);
 });
 }, [refreshPurchaseStats]);

 usePurchaseSSE({
 type: "public",
 onEvent: handlePurchaseEvent,
 debounceMs: 10000,
 });

 usePurchaseSSE({
 type: "private",
 onEvent: handlePurchaseEvent,
 debounceMs: 10000,
 });

 useEffect(() => {
 load();
 }, []); // eslint-disable-line react-hooks/exhaustive-deps

 const handleLogout = async () => {
 try {
 await logout();
 showToast("Sesion cerrada correctamente", "success");
 } catch (err) {
 console.error("Error cerrando sesion:", err);
 showToast("Error al cerrar sesion", "error");
 }
 };

 const exportPDF = async () => {
 try {
 showLoader();
 const canvas = await html2canvas(reportRef.current);
 const pdf = new jsPDF("p", "mm", "a4");
 const imgData = canvas.toDataURL("image/png");
 const width = pdf.internal.pageSize.getWidth();
 const height = (canvas.height * width) / canvas.width;
 pdf.addImage(imgData, "PNG", 0, 0, width, height);
 pdf.save("reporte-gerencial.pdf");
 showToast("Reporte exportado correctamente", "success");
 } catch (err) {
 console.error(err);
 showToast("Error al exportar PDF", "error");
 } finally {
 hideLoader();
 }
 };

 const totalPurchases = privateCount + publicCount;

 return (
 <DashboardLayout includeWidgets={false}>
 <div ref={reportRef}>
 <DashboardHeader
 title="Dashboard Gerencial"
 subtitle="Control estrategico de compras, clientes y talento"
 actions={
 <>
 <Button variant="secondary" icon={FiRefreshCw} onClick={load}>
 Actualizar
 </Button>
 <Button variant="primary" icon={FiDownload} onClick={exportPDF}>
 Exportar
 </Button>
 <Button variant="secondary" icon={FiLogOut} onClick={handleLogout}>
 Salir
 </Button>
 </>
 }
 />

 <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
 <StatCard
 label="Procesos de compras"
 value={totalPurchases}
 icon={FiShoppingCart}
 color="blue"
 />
 <StatCard
 label="Compras publicas"
 value={publicCount}
 icon={FiClipboard}
 color="cyan"
 />
 <StatCard
 label="Compras privadas"
 value={privateCount}
 icon={FiLayers}
 color="orange"
 />
 <StatCard
 label="Pendientes aprobacion"
 value={pendingPrivateApprovals}
 icon={FiTrendingUp}
 color="amber"
 />
 <StatCard
 label="Clientes registrados"
 value={clientsCount}
 icon={FiUsers}
 color="emerald"
 />
 <StatCard
 label="Vacaciones pendientes"
 value={vacationPending}
 icon={FiCalendar}
 color="red"
 />
 <StatCard
 label="Perfiles completos"
 value={`${profilePercent}%`}
 icon={FiCheckCircle}
 color="indigo"
 />
 </section>

 <section className="mb-8">
 <div className="flex items-center justify-between mb-3">
 <h2 className="text-base font-semibold text-gray-900">Aprobaciones permisos y vacaciones</h2>
 <a
 href="/dashboard/talento-humano/permisos"
 className="text-xs font-semibold text-blue-600 hover:underline"
 >
 Ver todas
 </a>
 </div>
 {pendingRequests.length === 0 ? (
 <div className="text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl p-4">
 Sin solicitudes pendientes.
 </div>
 ) : (
 <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
 {pendingRequests.slice(0, 12).map((item) => (
 <div
 key={item.id}
 className="rounded-xl border border-slate-200 bg-white/80 p-3 flex flex-col gap-1 text-[11px]"
 >
 <div className="flex items-center justify-between text-[10px] text-slate-500">
 <span>{item.tipo_solicitud === "vacaciones" ? "Vacaciones" : "Permiso"}</span>
 <span>#{item.id}</span>
 </div>
 <div className="font-semibold text-slate-900 truncate">
 {item.user_fullname || item.user_email || "Colaborador"}
 </div>
 <div className="text-slate-500 truncate">
 {item.fecha_inicio ? `Inicio: ${item.fecha_inicio}` : "Sin fecha"}
 </div>
 </div>
 ))}
 </div>
 )}
 </section>

 <section className="mb-8">
 <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
 <h2 className="text-base font-semibold text-gray-900">Reporte de asistencia (hoy)</h2>
 <a
  href="/dashboard/talento-humano/asistencia-reportes"
  className="text-xs font-semibold text-blue-600 hover:underline"
 >
  Abrir reporte completo
 </a>
 </div>
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
 <div className="rounded-xl border border-slate-200 bg-white p-3">
 <p className="text-[11px] text-slate-500">Registros</p>
 <p className="text-lg font-semibold text-slate-900">{attendanceTodaySummary?.total || 0}</p>
 </div>
 <div className="rounded-xl border border-slate-200 bg-white p-3">
 <p className="text-[11px] text-slate-500">Sin entrada</p>
 <p className="text-lg font-semibold text-slate-900">{attendanceTodaySummary?.byStatus?.no_entry || 0}</p>
 </div>
 <div className="rounded-xl border border-slate-200 bg-white p-3">
 <p className="text-[11px] text-slate-500">Jornada abierta</p>
 <p className="text-lg font-semibold text-slate-900">{attendanceTodaySummary?.byStatus?.working || 0}</p>
 </div>
 <div className="rounded-xl border border-slate-200 bg-white p-3">
 <p className="text-[11px] text-slate-500">Jornada cerrada</p>
 <p className="text-lg font-semibold text-slate-900">{attendanceTodaySummary?.byStatus?.completed || 0}</p>
 </div>
 </div>
 </section>

 <section className="mb-8">
 <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
 <h2 className="text-base font-semibold text-gray-900">Incumplimientos de horario</h2>
 <div className="flex items-center gap-2">
 <label className="text-xs text-slate-600">Últimos días</label>
 <select
  value={nonComplianceDays}
  onChange={(event) => setNonComplianceDays(Number(event.target.value))}
  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
 >
  <option value={3}>3</option>
  <option value={7}>7</option>
  <option value={14}>14</option>
  <option value={30}>30</option>
 </select>
 <Button variant="secondary" size="sm" onClick={reloadNonCompliance}>
  Consultar
 </Button>
 </div>
 </div>
 {nonComplianceRows.length === 0 ? (
 <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
 Sin incumplimientos en el periodo seleccionado.
 </div>
 ) : (
 <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
 <table className="min-w-full text-xs">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="px-2 py-2 text-left">Fecha</th>
 <th className="px-2 py-2 text-left">Colaborador</th>
 <th className="px-2 py-2 text-left">Incumplimiento</th>
 <th className="px-2 py-2 text-left">Atraso</th>
 <th className="px-2 py-2 text-left">Almuerzo</th>
 <th className="px-2 py-2 text-left">Reunión</th>
 </tr>
 </thead>
 <tbody>
 {nonComplianceRows.map((row) => (
 <tr key={`${row.user_id}-${row.date}-${row.breach_type}`} className="border-t border-slate-100">
 <td className="px-2 py-2">{String(row.date || "").slice(0, 10)}</td>
 <td className="px-2 py-2">
 <div className="font-medium text-slate-900">{row.fullname || "Sin nombre"}</div>
 <div className="text-[10px] text-slate-500">{row.email || "-"}</div>
 </td>
 <td className="px-2 py-2">{row.breach_label || "Incumplimiento"}</td>
 <td className="px-2 py-2">{row.late_minutes ? `${row.late_minutes} min` : "-"}</td>
 <td className="px-2 py-2">{row.lunch_minutes ? `${row.lunch_minutes} min` : "-"}</td>
 <td className="px-2 py-2">
 <div className="flex flex-wrap items-center gap-2">
 <input
  type="date"
  value={meetingDateByUser[row.user_id] || String(row.date || "").slice(0, 10)}
  onChange={(e) => setMeetingDateByUser((prev) => ({ ...prev, [row.user_id]: e.target.value }))}
  className="rounded border border-slate-300 px-2 py-1 text-[10px]"
 />
 <input
  type="time"
  value={meetingTimeByUser[row.user_id] || "09:30"}
  onChange={(e) => setMeetingTimeByUser((prev) => ({ ...prev, [row.user_id]: e.target.value }))}
  className="rounded border border-slate-300 px-2 py-1 text-[10px]"
 />
 <Button
  variant="primary"
  size="sm"
  onClick={() => handleScheduleMeeting(row)}
  disabled={schedulingUserId === row.user_id}
 >
  {schedulingUserId === row.user_id ? "Agendando..." : "Agendar"}
 </Button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </section>

 <section className="mb-10">
 <h2 className="text-lg font-semibold text-gray-900 mb-4">Accesos rapidos</h2>
 <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
 {quickAccess.map((item) => {
 const Icon = item.icon;
 return (
 <a
 key={item.path}
 href={item.path}
 className="group rounded-2xl border border-slate-200 bg-white/70 backdrop-blur shadow-sm hover:shadow-md transition-all p-4 flex flex-col gap-3"
 >
 <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-700 group-hover:scale-105 transition-transform">
 <Icon size={22} />
 </div>
 <div>
 <p className="text-sm font-semibold text-slate-900">{item.label}</p>
 <p className="text-xs text-slate-500">Ir al modulo</p>
 </div>
 </a>
 );
 })}
 </div>
 </section>

 {loading && (
 <div className="text-center text-sm text-gray-500">Cargando indicadores...</div>
 )}
 </div>
 </DashboardLayout>
 );
};

export default Dashboard;
