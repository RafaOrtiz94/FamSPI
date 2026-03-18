import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiDownload, FiFilter, FiList, FiPieChart } from "react-icons/fi";
import toast from "react-hot-toast";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Select from "../../../core/ui/components/Select";
import { DashboardLayout, DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import { getUsers } from "../../../core/api/usersApi";
import { downloadAttendancePDF, getAttendanceRange } from "../../../core/api/attendanceApi";
import { formatDateSafe, formatTimeSafe } from "../../../shared/utils/dateUtils";

const REPORT_MODES = {
    official: "official",
    admin: "admin",
};

const STATUS_OPTIONS = [
    { label: "Todos los estados", value: "" },
    { label: "Sin entrada", value: "no_entry" },
    { label: "Jornada abierta", value: "working" },
    { label: "Almuerzo abierto", value: "lunch_open" },
    { label: "Jornada cerrada", value: "completed" },
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
    const [mode, setMode] = useState(REPORT_MODES.official);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [loadingQuery, setLoadingQuery] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedUserId, setSelectedUserId] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");
    const [userOptions, setUserOptions] = useState([]);
    const [reportRows, setReportRows] = useState([]);
    const [reportSummary, setReportSummary] = useState(null);

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
    }, [loadUsers]);

    useEffect(() => {
        if (mode === REPORT_MODES.admin && !selectedUserId) {
            setSelectedUserId("all");
        }
        if (mode === REPORT_MODES.official && selectedUserId === "all") {
            setSelectedUserId("");
        }
    }, [mode, selectedUserId]);

    const userSelectOptions = useMemo(() => {
        const baseOptions = userOptions.map((u) => ({ label: u.nombre, value: String(u.id) }));
        if (mode === REPORT_MODES.admin) {
            return [{ label: "Todos los usuarios", value: "all" }, ...baseOptions];
        }
        return [{ label: "Selecciona un usuario", value: "" }, ...baseOptions];
    }, [mode, userOptions]);

    const statusSelectOptions = useMemo(() => STATUS_OPTIONS, []);

    const selectedStatusLabel = useMemo(() => {
        if (!selectedStatus) return "Todos los estados";
        return ATTENDANCE_STATUS_LABELS[selectedStatus] || "Estado personalizado";
    }, [selectedStatus]);

    const handleDownloadPDF = useCallback(async () => {
        if (!startDate || !endDate) {
            return toast.error("Selecciona un rango de fechas.");
        }

        if (!selectedUserId || selectedUserId === "all") {
            return toast.error("Selecciona un usuario especifico.");
        }

        setLoadingPdf(true);
        try {
            await downloadAttendancePDF(selectedUserId, startDate, endDate);
            toast.success("PDF generado correctamente");
        } catch (err) {
            console.error("Error descargando PDF:", err);
            toast.error("No se pudo generar el PDF.");
        } finally {
            setLoadingPdf(false);
        }
    }, [selectedUserId, startDate, endDate]);

    const handleConsultRange = useCallback(async () => {
        if (!startDate || !endDate) {
            return toast.error("Selecciona un rango de fechas.");
        }

        if (!selectedUserId) {
            return toast.error("Selecciona un usuario especifico.");
        }

        setLoadingQuery(true);
        try {
            const targetUserId = selectedUserId === "all" ? "all" : selectedUserId;
            const res = await getAttendanceRange(startDate, endDate, targetUserId, selectedStatus || null);
            const rows = Array.isArray(res?.data) ? res.data : [];
            setReportRows(rows);
            setReportSummary(res?.summary || null);
            toast.success(`Consulta cargada: ${rows.length} registros`);
        } catch (err) {
            console.error("Error consultando asistencia:", err);
            toast.error(err.response?.data?.message || "No se pudo consultar el rango.");
        } finally {
            setLoadingQuery(false);
        }
    }, [endDate, selectedStatus, selectedUserId, startDate]);

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

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setMode(REPORT_MODES.official)}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                            mode === REPORT_MODES.official
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
                        onClick={() => setMode(REPORT_MODES.admin)}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                            mode === REPORT_MODES.admin
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

                    {mode === REPORT_MODES.admin ? (
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

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    {statusCounters.map((card) => (
                        <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                                {card.label}
                            </div>
                            <div className="mt-2 text-2xl font-bold text-slate-950">{card.value}</div>
                        </div>
                    ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <FiFilter className="text-slate-500" />
                        <span className="font-semibold">Filtro activo:</span>
                        <span>{mode === REPORT_MODES.admin ? selectedStatusLabel : "PDF oficial por usuario"}</span>
                        <span className="text-slate-400">|</span>
                        <span>
                            Periodo: {startDate || "fecha inicio"} a {endDate || "fecha fin"}
                        </span>
                    </div>
                </div>

                {mode === REPORT_MODES.admin ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-950">Consulta administrativa</h3>
                                <p className="text-sm text-slate-600">
                                    Usa este bloque para revisar estados de jornada sin generar el PDF oficial.
                                </p>
                            </div>
                            <Button
                                variant="primary"
                                icon={FiList}
                                onClick={handleConsultRange}
                                disabled={loadingQuery}
                            >
                                {loadingQuery ? "Consultando..." : "Consultar rango"}
                            </Button>
                        </div>

                        {reportRows.length > 0 ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                                        <thead className="bg-slate-900 text-white">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                                                <th className="px-4 py-3 text-left font-semibold">Colaborador</th>
                                                <th className="px-4 py-3 text-left font-semibold">Departamento</th>
                                                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                                                <th className="px-4 py-3 text-left font-semibold">Marcas</th>
                                                <th className="px-4 py-3 text-right font-semibold">Horas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {reportRows.map((row) => (
                                                <tr key={`${row.id}-${row.date}`} className="bg-white">
                                                    <td className="px-4 py-3 text-slate-700">{formatDateSafe(row.date, "dd/MM/yyyy")}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-slate-950">{row.fullname || row.email || "Usuario"}</div>
                                                        <div className="text-xs text-slate-500">{row.email || "-"}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">{row.department_name || "-"}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                            {row.attendance_status_label || "Sin estado"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">
                                                        <div className="space-y-1 text-xs">
                                                            <div>Entrada: {formatTimeSafe(row.entry_time) || "--"}</div>
                                                            <div>Almuerzo: {formatTimeSafe(row.lunch_start_time) || "--"} / {formatTimeSafe(row.lunch_end_time) || "--"}</div>
                                                            <div>Salida: {formatTimeSafe(row.exit_time) || "--"}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                                        {row.total_hours ? `${Number(row.total_hours).toFixed(1)}h` : "--"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                Aun no hay resultados consultados. Ajusta el rango, usuario o estado y presiona <span className="font-semibold text-slate-700">Consultar rango</span>.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
                            <h3 className="text-sm font-semibold text-blue-900">Reporte oficial RH-09</h3>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800">
                                <li>Genera un PDF por usuario, no un consolidado global.</li>
                                <li>El reporte incluye entradas, salidas, almuerzos y horas trabajadas.</li>
                                <li>Se generan firmas electronicas cuando estan disponibles.</li>
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
