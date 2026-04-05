import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { FiCheckCircle, FiDownload, FiPlus, FiTool, FiX } from "react-icons/fi";
import { useApi } from "../../../core/hooks/useApi";
import { useUI } from "../../../core/ui/useUI";
import api from "../../../core/api";
import {
 getMantenimientos,
 createMantenimiento,
 approveMantenimiento,
 exportMantenimientoPDF,
 listPreventiveAnnualPlans,
 getPreventiveAnnualPlanDetail,
 createPreventiveAnnualPlan,
 publishPreventiveAnnualPlan,
 rebaselinePreventiveAnnualPlan,
 issueFst16,
 issueFst17,
 registerPreventiveOffer,
 decidePreventiveOffer,
 registerReprogrammingNotice,
 registerPreventiveCoordination,
 registerPreventiveWorkOrder,
 requestPreventiveKit,
 registerKitWarehouseExit,
 closePreventiveExecution,
 getPreventiveComplianceDashboard,
 getPreventiveCapacityDashboard,
 sendPreventiveMonthlyReport,
} from "../../../core/api/mantenimientosApi";
import FirmaDigital from "../components/FirmaDigital";
import PreventiveAnnualPlanBoard from "../components/PreventiveAnnualPlanBoard";
import PreventiveEquipmentSchedulePanel from "../components/PreventiveEquipmentSchedulePanel";
import CorrectiveCaseWorkspace from "../components/CorrectiveCaseWorkspace";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { formatDateOnlyEs, formatDateTimeEs, getStatusBadgeClass, toStatusLabel } from "../../../core/utils/workflowUi";

const badge = (s) => {
 return getStatusBadgeClass(s, {
 success: ["aprobado", "approved", "done", "cumplido"],
 warning: ["pendiente", "pending"],
 error: ["rechazado", "rejected", "no cumplido"],
 });
};

const nextStatusChip = (status) => {
 return getStatusBadgeClass(status, {
 success: ["notificado"],
 warning: ["pendiente"],
 error: ["conflicto"],
 });
};

const formatDate = (value, withTime = false) => {
 if (withTime) return formatDateTimeEs(value, "—");
 return formatDateOnlyEs(value, "—");
};

const normalizeEquipoId = (eq) => eq?.id ?? eq?.id_equipo ?? eq?.equipo_id ?? null;

const TAB_PREVENTIVE = "preventive";
const TAB_CORRECTIVE = "corrective";

const Mantenimientos = ({ initialRows = null, onRefresh }) => {
 const { showToast, confirm } = useUI();
 const [tab, setTab] = useState(TAB_PREVENTIVE);

 // ---------------------------------------------------------------------------
 // Legacy / correctivo rápido (compatibilidad)
 // ---------------------------------------------------------------------------
 const [open, setOpen] = useState(false);
 const [equipos, setEquipos] = useState([]);
 const [saving, setSaving] = useState(false);
 const [legacyFilter, setLegacyFilter] = useState("correctivo");
 const [form, setForm] = useState({
 id_equipo: "",
 tipo: "correctivo",
 responsable: "",
 fecha_programada: "",
 frecuencia: "6m",
 observaciones: "",
 evidencias: [],
 });

 const { data, loading, execute: fetchList, setData } = useApi(getMantenimientos, {
 errorMsg: "Error al cargar mantenimientos",
 });

 const loadLegacy = useCallback(async () => {
 await fetchList({ page: 1, pageSize: 200 });
 }, [fetchList]);

 const loadEquipos = useCallback(async () => {
 try {
 const { data: response } = await api.get("/servicio/equipos");
 const rows = Array.isArray(response?.rows)
 ? response.rows
 : Array.isArray(response?.result?.rows)
 ? response.result.rows
 : Array.isArray(response?.data)
 ? response.data
 : Array.isArray(response)
 ? response
 : [];
 setEquipos(rows);
 } catch (error) {
 console.warn("No se pudo cargar equipos", error?.message || error);
 }
 }, []);

 useEffect(() => {
 loadLegacy();
 }, [loadLegacy]);

 useEffect(() => {
 if (!Array.isArray(initialRows)) return;
 setData({ rows: initialRows });
 }, [initialRows, setData]);

 useEffect(() => {
 if (!open) return;
 loadEquipos();
 }, [open, loadEquipos]);

 const rows = useMemo(() => data?.rows || data?.result?.rows || data || [], [data]);
 const equipoIds = useMemo(
 () => new Set(equipos.map((eq) => Number(normalizeEquipoId(eq))).filter((n) => !Number.isNaN(n))),
 [equipos],
 );

 const filteredLegacyRows = useMemo(() => {
 const source = Array.isArray(rows) ? rows : [];
 if (legacyFilter === "all") return source;
 return source.filter((row) => {
 const tipo = String(row.tipo || "").toLowerCase();
 if (legacyFilter === "correctivo") return tipo.includes("corr");
 if (legacyFilter === "preventivo") return tipo.includes("prev");
 return true;
 });
 }, [rows, legacyFilter]);

 const sigRespRef = useRef(null);
 const sigRecRef = useRef(null);
 const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

 const handleFiles = (event) => {
 const files = Array.from(event.target.files || []);
 setField("evidencias", files);
 };

 const submitLegacy = async (event) => {
 event?.preventDefault();
 setSaving(true);
 try {
 const idEquipoNumber = Number.parseInt(form.id_equipo, 10);
 if (Number.isNaN(idEquipoNumber) || !equipoIds.has(idEquipoNumber)) {
 showToast("Selecciona un equipo válido para el mantenimiento", "warning");
 setSaving(false);
 return;
 }
 const firma_responsable = sigRespRef.current?.getBase64() || "";
 const firma_receptor = sigRecRef.current?.getBase64() || "";

 const payload = new FormData();
 payload.append("id_equipo", idEquipoNumber);
 payload.append("tipo", "correctivo");
 payload.append("responsable", form.responsable || "");
 payload.append("observaciones", form.observaciones || "");
 payload.append("frecuencia", form.frecuencia || "6m");
 if (form.fecha_programada) payload.append("fecha_programada", form.fecha_programada);
 if (firma_responsable) payload.append("firma_responsable", firma_responsable);
 if (firma_receptor) payload.append("firma_receptor", firma_receptor);
 (form.evidencias || []).forEach((file) => payload.append("evidencias", file));

 const response = await createMantenimiento(payload);
 showToast(response?.message || "Mantenimiento correctivo registrado", "success");
 setOpen(false);
 setForm({
 id_equipo: "",
 tipo: "correctivo",
 responsable: "",
 fecha_programada: "",
 frecuencia: "6m",
 observaciones: "",
 evidencias: [],
 });
 sigRespRef.current?.clear?.();
 sigRecRef.current?.clear?.();
 await loadLegacy();
 await onRefresh?.();
 } catch (error) {
 console.error(error);
 showToast(error?.response?.data?.error || "No se pudo crear el mantenimiento", "error");
 } finally {
 setSaving(false);
 }
 };

 const approve = async (row) => {
 const ok = await confirm(`¿Aprobar mantenimiento #${row.id}?`);
 if (!ok) return;
 try {
 await approveMantenimiento(row.id);
 showToast(`Mantenimiento #${row.id} aprobado`, "success");
 await loadLegacy();
 await onRefresh?.();
 } catch (error) {
 console.error(error);
 showToast("No se pudo aprobar", "error");
 }
 };

 const toPDF = async (row) => {
 try {
 const response = await exportMantenimientoPDF(row.id);
 const link = response?.pdf_link || response?.drive_link || response?.link;
 if (link) window.open(link, "_blank");
 else showToast("PDF generado sin enlace disponible", "info");
 } catch (error) {
 console.error(error);
 showToast("No se pudo exportar PDF", "error");
 }
 };

 // ---------------------------------------------------------------------------
 // Preventivo ST-01-02
 // ---------------------------------------------------------------------------
 const [preventiveBusy, setPreventiveBusy] = useState(false);
 const [plans, setPlans] = useState([]);
 const [activePlanId, setActivePlanId] = useState(null);
 const [activePlan, setActivePlan] = useState(null);
 const [compliance, setCompliance] = useState(null);
 const [capacity, setCapacity] = useState(null);

 const reloadPreventive = useCallback(
 async (requestedPlanId = null) => {
 setPreventiveBusy(true);
 try {
 const plansRows = await listPreventiveAnnualPlans({ limit: 200 });
 setPlans(plansRows);

 const fallbackPlanId =
 requestedPlanId ||
 activePlanId ||
 plansRows.find((plan) => String(plan.status || "").toLowerCase() === "active")?.id ||
 plansRows[0]?.id ||
 null;

 if (!fallbackPlanId) {
 setActivePlanId(null);
 setActivePlan(null);
 setCompliance(null);
 setCapacity(null);
 return;
 }

 setActivePlanId(fallbackPlanId);
 const [planDetail, complianceData, capacityData] = await Promise.all([
 getPreventiveAnnualPlanDetail(fallbackPlanId),
 getPreventiveComplianceDashboard({ annual_plan_id: fallbackPlanId }),
 getPreventiveCapacityDashboard({ annual_plan_id: fallbackPlanId }),
 ]);
 setActivePlan(planDetail);
 setCompliance(complianceData);
 setCapacity(capacityData);
 } catch (error) {
 console.error(error);
 showToast(error?.response?.data?.error || "No se pudo cargar el workspace preventivo", "error");
 } finally {
 setPreventiveBusy(false);
 }
 },
 [activePlanId, showToast],
 );

 useEffect(() => {
 reloadPreventive();
 }, [reloadPreventive]);

 const runPreventiveAction = async (fn, successMessage, fallbackError, refreshPlanId = null) => {
 setPreventiveBusy(true);
 try {
 await fn();
 if (successMessage) showToast(successMessage, "success");
 await reloadPreventive(refreshPlanId || activePlanId);
 await loadLegacy();
 await onRefresh?.();
 } catch (error) {
 console.error(error);
 showToast(error?.response?.data?.error || fallbackError, "error");
 } finally {
 setPreventiveBusy(false);
 }
 };

 // ---------------------------------------------------------------------------
 // UI render
 // ---------------------------------------------------------------------------
 return (
 <div className="space-y-4">
 <Card className="p-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
 <FiTool /> Mantenimientos
 </h2>
 <p className="text-sm text-slate-600">
 ST-01-02 preventivo con flujo estructurado empresarial y vista separada de correctivos.
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 <Button
 type="button"
 size="sm"
 variant={tab === TAB_PREVENTIVE ? "primary" : "secondary"}
 onClick={() => setTab(TAB_PREVENTIVE)}
 >
 Preventivo ST-01-02
 </Button>
 <Button
 type="button"
 size="sm"
 variant={tab === TAB_CORRECTIVE ? "primary" : "secondary"}
 onClick={() => setTab(TAB_CORRECTIVE)}
 >
 Correctivo / legado
 </Button>
 </div>
 </div>
 </Card>

 {tab === TAB_PREVENTIVE ? (
 <div className="space-y-4">
 <PreventiveAnnualPlanBoard
 plans={plans}
 activePlanId={activePlanId}
 busy={preventiveBusy}
 onSelectPlan={(plan) => reloadPreventive(plan?.id)}
 onCreatePlan={(payload) =>
 runPreventiveAction(
 () => createPreventiveAnnualPlan(payload),
 "Plan anual preventivo generado",
 "No se pudo generar el plan preventivo",
 null,
 )
 }
 onPublishPlan={(plan) =>
 runPreventiveAction(
 () => publishPreventiveAnnualPlan(plan.id),
 `Plan ${plan.plan_year} v${plan.version} publicado`,
 "No se pudo publicar el plan",
 plan.id,
 )
 }
 onRebaselinePlan={(plan) =>
 runPreventiveAction(
 () =>
 rebaselinePreventiveAnnualPlan(plan.id, {
 reason: "Cambio de base de equipos/frecuencia/condición contractual",
 }),
 "Rebaseline creado correctamente",
 "No se pudo crear rebaseline",
 null,
 )
 }
 onIssueFst16={(plan) =>
 runPreventiveAction(
 () => issueFst16(plan.id, {}),
 "F.ST-16 emitido",
 "No se pudo emitir F.ST-16",
 plan.id,
 )
 }
 onSendMonthlyReport={(payload) =>
 runPreventiveAction(
 () => sendPreventiveMonthlyReport(activePlanId, payload),
 "Reporte mensual enviado",
 "No se pudo enviar reporte mensual",
 activePlanId,
 )
 }
 />

 <PreventiveEquipmentSchedulePanel
 plan={activePlan}
 compliance={compliance}
 capacity={capacity}
 busy={preventiveBusy}
 onIssueFst17={(item) =>
 runPreventiveAction(
 () => issueFst17(item.id, {}),
 "F.ST-17 emitido",
 "No se pudo emitir F.ST-17",
 activePlanId,
 )
 }
 onIssueOffer={(item, payload) =>
 runPreventiveAction(
 () => registerPreventiveOffer(item.id, payload),
 "Oferta Anexo 4 registrada",
 "No se pudo registrar la oferta",
 activePlanId,
 )
 }
 onOfferDecision={(item, payload) =>
 runPreventiveAction(
 () => decidePreventiveOffer(item.id, payload),
 "Decisión de oferta registrada",
 "No se pudo registrar la decisión de oferta",
 activePlanId,
 )
 }
 onReprogram={(item, payload) =>
 runPreventiveAction(
 () => registerReprogrammingNotice(item.id, payload),
 "Reprogramación Anexo 5 registrada",
 "No se pudo registrar la reprogramación",
 activePlanId,
 )
 }
 onCoordinate={(item, payload) =>
 runPreventiveAction(
 () => registerPreventiveCoordination(item.id, payload),
 "Coordinación registrada",
 "No se pudo registrar coordinación",
 activePlanId,
 )
 }
 onWorkOrder={(item, payload) =>
 runPreventiveAction(
 () => registerPreventiveWorkOrder(item.id, payload),
 "WO preventiva registrada",
 "No se pudo registrar WO preventiva",
 activePlanId,
 )
 }
 onRequestKit={(item, payload) =>
 runPreventiveAction(
 () => requestPreventiveKit(item.id, payload),
 "Solicitud de kit registrada",
 "No se pudo registrar solicitud de kit",
 activePlanId,
 )
 }
 onWarehouseExit={(item, payload) =>
 runPreventiveAction(
 () =>
 registerKitWarehouseExit(payload.kit_id, {
 warehouse_exit_reference: payload.warehouse_exit_reference,
 }),
 "Salida de bodega registrada",
 "No se pudo registrar salida de bodega",
 activePlanId,
 )
 }
 onCloseExecution={(item, payload) =>
 runPreventiveAction(
 () => closePreventiveExecution(item.id, payload),
 "Cierre preventivo completado",
 "No se pudo cerrar el preventivo",
 activePlanId,
 )
 }
 />

 <Card className="p-4">
 <h4 className="text-sm font-semibold text-slate-900">Cumplimiento mensual y capacidad operativa</h4>
 <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
 <div className="overflow-x-auto rounded-xl border border-slate-200">
 <table className="min-w-full text-left text-xs">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="px-3 py-2">Mes</th>
 <th className="px-3 py-2">Total</th>
 <th className="px-3 py-2">Cumplido en mes</th>
 <th className="px-3 py-2">%</th>
 </tr>
 </thead>
 <tbody>
 {Array.isArray(compliance?.by_month) && compliance.by_month.length > 0 ? (
 compliance.by_month.map((row) => (
 <tr key={row.month} className="border-t border-slate-100">
 <td className="px-3 py-2 font-semibold text-slate-700">{row.month}</td>
 <td className="px-3 py-2 text-slate-700">{row.effective_total || 0}</td>
 <td className="px-3 py-2 text-slate-700">{row.on_time || 0}</td>
 <td className="px-3 py-2 text-slate-700">{row.rate || 0}%</td>
 </tr>
 ))
 ) : (
 <tr>
 <td className="px-3 py-4 text-slate-500" colSpan={4}>
 Sin datos de cumplimiento.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>

 <div className="overflow-x-auto rounded-xl border border-slate-200">
 <table className="min-w-full text-left text-xs">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="px-3 py-2">Mes</th>
 <th className="px-3 py-2">Carga (min)</th>
 <th className="px-3 py-2">Capacidad (min)</th>
 <th className="px-3 py-2">Uso %</th>
 </tr>
 </thead>
 <tbody>
 {Array.isArray(capacity?.months) && capacity.months.length > 0 ? (
 capacity.months.map((row) => (
 <tr key={row.month} className="border-t border-slate-100">
 <td className="px-3 py-2 font-semibold text-slate-700">{row.month}</td>
 <td className="px-3 py-2 text-slate-700">{row.load_minutes || 0}</td>
 <td className="px-3 py-2 text-slate-700">{row.available_minutes || 0}</td>
 <td className={`px-3 py-2 font-semibold ${row.over_capacity ? "text-rose-700" : "text-slate-700"}`}>
 {row.utilization_pct || 0}%
 </td>
 </tr>
 ))
 ) : (
 <tr>
 <td className="px-3 py-4 text-slate-500" colSpan={4}>
 Sin datos de capacidad.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </Card>
 </div>
 ) : (
 <div className="space-y-4">
 <Card className="p-4">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div>
 <h3 className="text-base font-semibold text-slate-900">Registro correctivo / compatibilidad</h3>
 <p className="text-xs text-slate-600">
 Flujo rápido legado separado del procedimiento preventivo ST-01-02.
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 <select
 value={legacyFilter}
 onChange={(event) => setLegacyFilter(event.target.value)}
 className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
 >
 <option value="correctivo">Solo correctivo</option>
 <option value="preventivo">Solo preventivo</option>
 <option value="all">Todos</option>
 </select>
 <Button size="sm" icon={FiPlus} onClick={() => setOpen(true)}>
 Nuevo correctivo
 </Button>
 </div>
 </div>
 </Card>

 <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
 <div className="border-b border-slate-200 p-4">
 <CorrectiveCaseWorkspace />
 </div>
 <div className="p-4">
 <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
 Flujo legado de compatibilidad
 </p>
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-gray-50 text-left text-gray-700">
 <th className="px-4 py-2">#</th>
 <th className="px-4 py-2">Equipo</th>
 <th className="px-4 py-2">Tipo</th>
 <th className="px-4 py-2">Responsable</th>
 <th className="px-4 py-2">Fecha programada</th>
 <th className="px-4 py-2">Próximo recordatorio</th>
 <th className="px-4 py-2">Estado</th>
 <th className="px-4 py-2 text-right">Acciones</th>
 </tr>
 </thead>
 <tbody>
 {filteredLegacyRows.map((row) => (
 <tr key={row.id} className="border-t border-gray-100">
 <td className="px-4 py-2">{row.id}</td>
 <td className="px-4 py-2">{row.equipo_nombre || row.equipo || `Equipo ${row.id_equipo}`}</td>
 <td className="px-4 py-2">{row.tipo}</td>
 <td className="px-4 py-2">{row.responsable}</td>
 <td className="px-4 py-2">{formatDate(row.fecha_programada || row.fecha)}</td>
 <td className="px-4 py-2">
 {row.next_maintenance_date ? (
 <div className="space-y-1">
 <p>{formatDate(row.next_maintenance_date)}</p>
 <span
 className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${nextStatusChip(
 row.next_maintenance_status,
 )}`}
 >
 {toStatusLabel(row.next_maintenance_status || "pendiente")}
 </span>
 </div>
 ) : (
 <span className="text-xs text-slate-400">Sin programar</span>
 )}
 </td>
 <td className="px-4 py-2">
 <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge(row.estado || row.status)}`}>
 {toStatusLabel(row.estado || row.status)}
</span>
</td>
<td className="space-x-2 px-4 py-2 text-right">
 <Button size="sm" variant="success" onClick={() => approve(row)} aria-label={`Aprobar mantenimiento ${row.id}`}>
 <FiCheckCircle />
 </Button>
 <Button size="sm" variant="secondary" onClick={() => toPDF(row)} aria-label={`Exportar PDF mantenimiento ${row.id}`}>
 <FiDownload />
 </Button>
 </td>
 </tr>
 ))}
 {!loading && filteredLegacyRows.length === 0 && (
 <tr>
 <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
 No hay mantenimientos para este filtro.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}

 {/* Modal correctivo rápido */}
 <Transition.Root show={open} as={Fragment}>
 <Dialog as="div" className="relative z-50" onClose={() => setOpen(false)}>
 <Transition.Child
 as={Fragment}
 enter="ease-out duration-200"
 enterFrom="opacity-0"
 enterTo="opacity-100"
 leave="ease-in duration-150"
 leaveFrom="opacity-100"
 leaveTo="opacity-0"
 >
 <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
 </Transition.Child>
 <div className="fixed inset-0 overflow-y-auto">
 <div className="flex min-h-full items-start justify-center p-4 sm:p-6">
 <Transition.Child
 as={Fragment}
 enter="ease-out duration-200"
 enterFrom="opacity-0 scale-95"
 enterTo="opacity-100 scale-100"
 leave="ease-in duration-150"
 leaveFrom="opacity-100 scale-100"
 leaveTo="opacity-0 scale-95"
 >
 <Dialog.Panel className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
 <div className="mb-3 flex items-center justify-between">
 <Dialog.Title className="text-lg font-bold text-gray-900">
 Nuevo mantenimiento correctivo
 </Dialog.Title>
 <Button size="sm" variant="ghost" onClick={() => setOpen(false)} aria-label="Cerrar modal">
 <FiX />
 </Button>
 </div>

 <form onSubmit={submitLegacy} className="space-y-4">
 <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
 <div>
 <label className="text-sm text-gray-600">Equipo</label>
 <select
 value={form.id_equipo}
 onChange={(event) => setField("id_equipo", event.target.value)}
 className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
 required
 >
 <option value="">Selecciona un equipo…</option>
 {equipos.map((eq) => {
 const optionId = normalizeEquipoId(eq);
 if (!optionId) return null;
 return (
 <option key={optionId} value={optionId}>
 {eq.nombre || eq.equipo || `Equipo ${optionId}`}
 </option>
 );
 })}
 </select>
 </div>
 <div>
 <label className="text-sm text-gray-600">Responsable</label>
 <input
 value={form.responsable}
 onChange={(event) => setField("responsable", event.target.value)}
 className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
 required
 />
 </div>
 <div>
 <label className="text-sm text-gray-600">Fecha programada</label>
 <input
 type="date"
 value={form.fecha_programada}
 onChange={(event) => setField("fecha_programada", event.target.value)}
 className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
 required
 />
 </div>
 <div>
 <label className="text-sm text-gray-600">Frecuencia recordatorio</label>
 <select
 value={form.frecuencia}
 onChange={(event) => setField("frecuencia", event.target.value)}
 className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
 >
 <option value="6m">Recordar en 6 meses</option>
 <option value="12m">Recordar en 1 año</option>
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="text-sm text-gray-600">Observaciones</label>
 <textarea
 rows={3}
 value={form.observaciones}
 onChange={(event) => setField("observaciones", event.target.value)}
 className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
 />
 </div>
 <div className="grid grid-cols-1 gap-4 md:col-span-2 sm:grid-cols-2">
 <div>
 <label className="text-sm text-gray-600">Firma responsable</label>
 <div className="mt-1">
 <FirmaDigital ref={sigRespRef} />
 </div>
 </div>
 <div>
 <label className="text-sm text-gray-600">Firma receptor</label>
 <div className="mt-1">
 <FirmaDigital ref={sigRecRef} />
 </div>
 </div>
 </div>
 <div className="md:col-span-2">
 <label className="text-sm text-gray-600">Evidencias</label>
 <input
 type="file"
 accept="image/*,application/pdf"
 onChange={handleFiles}
 className="mt-1 file:border-0 file:bg-blue-50 file:text-blue-700"
 multiple
 />
 </div>
 </div>

 <div className="mt-4 flex items-center justify-end gap-2">
 <Button
 type="button"
 variant="secondary"
 onClick={() => setOpen(false)}
 >
 Cancelar
 </Button>
 <Button
 type="submit"
 variant="primary"
 loading={saving}
 >
 {saving ? "Guardando..." : "Guardar correctivo"}
 </Button>
 </div>
 </form>
 </Dialog.Panel>
 </Transition.Child>
 </div>
 </div>
 </Dialog>
 </Transition.Root>
 </div>
 );
};

export default Mantenimientos;
