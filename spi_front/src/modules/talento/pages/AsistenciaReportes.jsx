import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiDownload, FiFilter, FiPieChart } from "react-icons/fi";
import toast from "react-hot-toast";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Select from "../../../core/ui/components/Select";
import { DashboardLayout, DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import { getUsers } from "../../../core/api/usersApi";
import { downloadAttendancePDF } from "../../../core/api/attendanceApi";
import AttendanceReportsSummaryCards from "../components/attendance-reports/AttendanceReportsSummaryCards";
import AttendanceReportsEmptyState from "../components/attendance-reports/AttendanceReportsEmptyState";
import AttendanceReportsTableView from "../components/attendance-reports/AttendanceReportsTableView";
import AttendanceReportsToolbar from "../components/attendance-reports/AttendanceReportsToolbar";
import useAttendanceFilters, { ATTENDANCE_REPORT_MODES } from "../hooks/useAttendanceFilters";
import useAttendanceReportsQuery from "../hooks/useAttendanceReportsQuery";

const STATUS_OPTIONS = [
 { label: "Todos los estados", value: "" },
 { label: "Sin entrada", value: "no_entry" },
 { label: "Jornada abierta", value: "working" },
 { label: "Almuerzo abierto", value: "lunch_open" },
 { label: "Jornada cerrada", value: "completed" },
];

const OFFICIAL_PDF_PERIOD_OPTIONS = [
 { label: "Mensual", value: "monthly" },
 { label: "Anual (12 meses)", value: "annual" },
];

const getTodayInputDate = () => {
 const today = new Date();
 const year = today.getFullYear();
 const month = String(today.getMonth() + 1).padStart(2, "0");
 const day = String(today.getDate()).padStart(2, "0");
 return `${year}-${month}-${day}`;
};

const getMonthStartInputDate = () => {
 const today = new Date();
 const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
 const year = firstDay.getFullYear();
 const month = String(firstDay.getMonth() + 1).padStart(2, "0");
 const day = String(firstDay.getDate()).padStart(2, "0");
 return `${year}-${month}-${day}`;
};

const ATTENDANCE_STATUS_LABELS = {
 no_entry: "Sin entrada",
 working: "Jornada abierta",
 lunch_open: "Almuerzo abierto",
 completed: "Jornada cerrada",
};

const TalentoAsistenciaReportes = () => {
 const {
  startDate,
  endDate,
  mode,
  view,
  status: selectedStatus,
  userIds,
  quickRange,
  onlyDiscrepancies,
  onlyWithGeo,
  departmentId,
  departmentOptions,
  setStartDate,
  setEndDate,
  setMode,
  setStatus: setSelectedStatus,
  applyQuickRange,
  setOnlyDiscrepancies,
  setOnlyWithGeo,
  setDepartmentId,
  clearFilters,
 } = useAttendanceFilters({
  mode: ATTENDANCE_REPORT_MODES.OFFICIAL,
  view: "table",
 });
 const [loadingPdf, setLoadingPdf] = useState(false);
 const [selectedUserId, setSelectedUserId] = useState("");
 const [officialPdfPeriod, setOfficialPdfPeriod] = useState("monthly");
 const [annualYear, setAnnualYear] = useState(String(new Date().getFullYear()));
 const [userOptions, setUserOptions] = useState([]);
 const [reportRows, setReportRows] = useState([]);
 const [reportSummary, setReportSummary] = useState(null);
 const reportQueryFilters = useMemo(
  () => ({
   startDate,
   endDate,
   userId: selectedUserId === "all" ? "all" : selectedUserId,
   userIds,
   departmentId,
   status: selectedStatus || "",
   quickRange,
   onlyDiscrepancies,
   onlyWithGeo,
   mode,
   view,
  }),
  [departmentId, endDate, mode, onlyDiscrepancies, onlyWithGeo, quickRange, selectedStatus, selectedUserId, startDate, userIds, view]
 );
 const { refetch: refetchAttendanceReports, isFetching: loadingQuery } = useAttendanceReportsQuery({
  filters: reportQueryFilters,
  enabled: false,
 });

 const loadUsers = useCallback(async () => {
 try {
 const rows = await getUsers();
 setUserOptions(
 (Array.isArray(rows) ? rows : []).map((user) => ({
 id: user.id,
 nombre: user.fullname || user.email || `Usuario #${user.id}`,
 })),
 );
 } catch (err) {
 console.error("Error cargando usuarios:", err);
 toast.error("Error cargando usuarios");
 }
 }, []);

 useEffect(() => {
 loadUsers();
 setStartDate(getMonthStartInputDate());
 setEndDate(getTodayInputDate());
 }, [loadUsers, setStartDate, setEndDate]);

 useEffect(() => {
 if (mode === ATTENDANCE_REPORT_MODES.ADMIN && !selectedUserId) {
 setSelectedUserId("all");
 }
 if (mode === ATTENDANCE_REPORT_MODES.OFFICIAL && selectedUserId === "all") {
 setSelectedUserId("");
 }
 }, [mode, selectedUserId]);

 const userSelectOptions = useMemo(() => {
 const baseOptions = userOptions.map((u) => ({ label: u.nombre, value: String(u.id) }));
 if (mode === ATTENDANCE_REPORT_MODES.ADMIN) {
 return [{ label: "Todos los usuarios", value: "all" }, ...baseOptions];
 }
 return [{ label: "Selecciona un usuario", value: "" }, ...baseOptions];
 }, [mode, userOptions]);

 const statusSelectOptions = useMemo(() => STATUS_OPTIONS, []);

 const quickFilterItems = useMemo(
  () => [
   { key: "today", label: "Hoy", active: quickRange === "today" },
   { key: "thisWeek", label: "Esta semana", active: quickRange === "thisWeek" },
   { key: "thisMonth", label: "Este mes", active: quickRange === "thisMonth" },
   { key: "thisYear", label: "Este anio", active: quickRange === "thisYear" },
  ],
  [quickRange]
 );

const selectedStatusLabel = useMemo(() => {
 if (!selectedStatus) return "Todos los estados";
 return ATTENDANCE_STATUS_LABELS[selectedStatus] || "Estado personalizado";
 }, [selectedStatus]);

 const rangeWarningText = useMemo(() => {
  if (!reportSummary?.meta?.exceedsRecommendedRange) return "";
  return "El rango supera 31 dias. La consulta puede tardar mas de lo normal.";
 }, [reportSummary]);

 const handleDownloadPDF = useCallback(async () => {
  if (officialPdfPeriod === "monthly" && (!startDate || !endDate)) {
  return toast.error("Selecciona un rango de fechas.");
  }

  if (!selectedUserId || selectedUserId === "all") {
  return toast.error("Selecciona un usuario especifico.");
  }

  if (officialPdfPeriod === "annual") {
  const parsedYear = Number.parseInt(annualYear, 10);
  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
  return toast.error("Ingresa un anio valido para el reporte anual.");
  }
  }

  setLoadingPdf(true);
  try {
  const result = await downloadAttendancePDF(selectedUserId, startDate, endDate, {
  periodType: officialPdfPeriod,
  year: annualYear,
  });
  if (result?.hash) {
  toast.success(`PDF generado. Hash SHA-256: ${result.hash.slice(0, 16)}...`);
  } else {
  toast.success("PDF generado correctamente");
  }
  } catch (err) {
  console.error("Error descargando PDF:", err);
  toast.error("No se pudo generar el PDF.");
  } finally {
  setLoadingPdf(false);
  }
 }, [selectedUserId, startDate, endDate, officialPdfPeriod, annualYear]);

 const handleConsultRange = useCallback(async () => {
 if (!startDate || !endDate) {
 return toast.error("Selecciona un rango de fechas.");
 }

 if (!selectedUserId) {
 return toast.error("Selecciona un usuario especifico.");
 }

 try {
 const response = await refetchAttendanceReports();
 if (response?.error) {
  throw response.error;
 }
 const res = response?.data || null;
 const rows = Array.isArray(res?.data) ? res.data : [];
 setReportRows(rows);
 setReportSummary(res?.summary || null);
 toast.success(`Consulta cargada: ${rows.length} registros`);
 } catch (err) {
 console.error("Error consultando asistencia:", err);
 toast.error(err.response?.data?.message || "No se pudo consultar el rango.");
 }
 }, [endDate, refetchAttendanceReports, selectedUserId, startDate]);

 useEffect(() => {
  if (mode === ATTENDANCE_REPORT_MODES.ADMIN && quickRange) {
   handleConsultRange();
  }
 }, [handleConsultRange, mode, quickRange]);

const statusCounters = useMemo(() => {
  const byStatus = reportSummary?.byStatus || {};
  return [
   { label: "Registros", value: reportSummary?.total ?? reportRows.length },
   { label: "Coincidencias", value: reportSummary?.filteredTotal ?? reportRows.length },
   { label: "Sin entrada", value: byStatus.no_entry ?? 0 },
   { label: "Jornada abierta", value: byStatus.working ?? 0 },
   { label: "Almuerzo abierto", value: byStatus.lunch_open ?? 0 },
   { label: "Jornada cerrada", value: byStatus.completed ?? 0 },
  ];
 }, [reportRows.length, reportSummary]);

 return (
 <DashboardLayout includeWidgets={false}>
 <DashboardHeader
 title="Reportes de Asistencia"
 subtitle="Separacion entre reporte oficial del colaborador y consulta administrativa del area"
 />

 <Card className="space-y-6 p-6">
 <div className="border-b border-slate-200 pb-4">
 <h2 className="text-xl font-semibold text-slate-950">
 Reportes de asistencia
 </h2>
 <p className="mt-1 text-sm text-slate-600">
 El modo oficial descarga el RH-09 por usuario. El modo administrativo consulta rangos, estados y resuelve incidencias operativas.
 </p>
 </div>

<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
  <button
  type="button"
  onClick={() => setMode(ATTENDANCE_REPORT_MODES.OFFICIAL)}
  className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
   mode === ATTENDANCE_REPORT_MODES.OFFICIAL
   ? "border-blue-200 bg-blue-50 text-blue-900"
   : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  }`}
  >
  <FiDownload className="text-xl" />
  <div>
  <div className="text-sm font-semibold">Reporte oficial RH-09</div>
  <div className="text-xs opacity-75">PDF por usuario y rango especifico.</div>
  </div>
  </button>

  <button
  type="button"
  onClick={() => setMode(ATTENDANCE_REPORT_MODES.ADMIN)}
  className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
   mode === ATTENDANCE_REPORT_MODES.ADMIN
   ? "border-emerald-200 bg-emerald-50 text-emerald-900"
   : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  }`}
  >
  <FiPieChart className="text-xl" />
  <div>
  <div className="text-sm font-semibold">Consulta administrativa</div>
  <div className="text-xs opacity-75">Usuario, rango y estado derivado de jornada.</div>
  </div>
  </button>
 </div>

 <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
 <div>
 <label className="mb-2 block text-sm font-medium text-slate-700">
 Fecha inicio
 </label>
 <input
 type="date"
 value={startDate}
 onChange={(e) => setStartDate(e.target.value)}
 className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
 />
 </div>

 <div>
 <label className="mb-2 block text-sm font-medium text-slate-700">
 Fecha fin
 </label>
 <input
 type="date"
 value={endDate}
 onChange={(e) => setEndDate(e.target.value)}
 className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
 />
 </div>

 <div>
 <label className="mb-2 block text-sm font-medium text-slate-700">
 Usuario
 </label>
 <Select
 value={selectedUserId}
 options={userSelectOptions}
 onChange={(e) => setSelectedUserId(e.target.value)}
 className="w-full"
 />
 </div>

 {mode === ATTENDANCE_REPORT_MODES.ADMIN ? (
 <div>
 <label className="mb-2 block text-sm font-medium text-slate-700">
 Estado
 </label>
 <Select
 value={selectedStatus}
 options={statusSelectOptions}
 onChange={(e) => setSelectedStatus(e.target.value)}
 className="w-full"
 />
 </div>
 ) : (
 <div className="flex items-end">
 <Button
 variant="primary"
 icon={FiDownload}
 onClick={handleDownloadPDF}
 disabled={loadingPdf}
 className="w-full py-2.5"
 >
 {loadingPdf ? "Generando..." : "Descargar PDF"}
 </Button>
 </div>
 )}
 </div>

 {mode === ATTENDANCE_REPORT_MODES.OFFICIAL ? (
 <div className="grid grid-cols-1 gap-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 md:grid-cols-2">
 <div>
 <label className="mb-2 block text-sm font-medium text-blue-900">
 Tipo de reporte oficial
 </label>
 <Select
 value={officialPdfPeriod}
 options={OFFICIAL_PDF_PERIOD_OPTIONS}
 onChange={(e) => setOfficialPdfPeriod(e.target.value)}
 className="w-full"
 />
 </div>
 <div>
 <label className="mb-2 block text-sm font-medium text-blue-900">
 Anio (solo anual)
 </label>
 <input
 type="number"
 min="2000"
 max="2100"
 value={annualYear}
 onChange={(e) => setAnnualYear(e.target.value)}
 disabled={officialPdfPeriod !== "annual"}
 className="w-full rounded-lg border-2 border-blue-200 bg-white px-3 py-2 text-sm transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
 />
 <p className="mt-1 text-xs text-blue-800">
 En anual se genera un acta con 12 meses para el colaborador.
 </p>
 </div>
 </div>
 ) : null}

 <AttendanceReportsSummaryCards items={statusCounters} />

 <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
 <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
 <FiFilter className="text-slate-500" />
 <span className="font-semibold">Filtro activo:</span>
 <span>{mode === ATTENDANCE_REPORT_MODES.ADMIN ? selectedStatusLabel : "PDF oficial por usuario"}</span>
 <span className="text-slate-400">|</span>
 <span>
 {mode === ATTENDANCE_REPORT_MODES.OFFICIAL && officialPdfPeriod === "annual"
 ? `Periodo anual: ${annualYear || "anio"}`
 : `Periodo: ${startDate || "fecha inicio"} a ${endDate || "fecha fin"}`}
 </span>
 </div>
 </div>

 {mode === ATTENDANCE_REPORT_MODES.ADMIN ? (
 <AttendanceReportsToolbar
  onAction={handleConsultRange}
  disabled={loadingQuery}
  actionLabel={loadingQuery ? "Consultando..." : "Consultar rango"}
 onClear={clearFilters}
 clearDisabled={loadingQuery}
  quickFilters={quickFilterItems}
  onQuickFilter={applyQuickRange}
  warningText={rangeWarningText}
  onlyDiscrepancies={onlyDiscrepancies}
  onToggleDiscrepancies={setOnlyDiscrepancies}
  onlyWithGeo={onlyWithGeo}
  onToggleWithGeo={setOnlyWithGeo}
  departmentId={departmentId}
  departmentOptions={departmentOptions}
  onChangeDepartment={setDepartmentId}
  userOptions={mode === ATTENDANCE_REPORT_MODES.ADMIN ? userSelectOptions : []}
  selectedUserId={selectedUserId}
  onSelectUser={setSelectedUserId}
  >
 {reportRows.length > 0 ? (
 <AttendanceReportsTableView rows={reportRows} />
 ) : (
 <AttendanceReportsEmptyState onConsult={handleConsultRange} />
 )}
 </AttendanceReportsToolbar>
) : (
  <div className="space-y-4">
  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
  <h3 className="text-sm font-semibold text-blue-900">Reporte oficial RH-09</h3>
  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800">
  <li>Genera un PDF por colaborador en formato mensual o anual.</li>
  <li>En anual se emiten 12 meses y, si aplica, se marca desde fecha de ingreso.</li>
  <li>El acta se descarga bloqueada (campos no editables) y con hash SHA-256.</li>
  <li>La consulta administrativa usa el mismo rango, pero no sustituye el PDF oficial.</li>
  </ul>
  </div>

  <div className="flex justify-end">
  <Button
  variant="primary"
  icon={FiDownload}
  onClick={handleDownloadPDF}
  disabled={loadingPdf}
  className="w-full md:w-auto"
  >
  {loadingPdf ? "Generando..." : "Descargar PDF oficial"}
  </Button>
  </div>
  </div>
  )}
 </Card>
</DashboardLayout>
 );
};

export default TalentoAsistenciaReportes;
