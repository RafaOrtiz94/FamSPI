import React, { useEffect, useMemo, useState } from "react";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";

const STAGES = [
 { key: "withdrawal_requested", label: "Retiro solicitado" },
 { key: "withdrawal_coordinated", label: "Retiro coordinado" },
 { key: "desinfectado", label: "Desinfectado" },
 { key: "embalado", label: "Embalado" },
 { key: "retirado", label: "Retirado" },
 { key: "cerrado", label: "Cerrado" },
];

const statusClass = (isDone, isCurrent) => {
 if (isDone) return "bg-emerald-100 text-emerald-700 border-emerald-200";
 if (isCurrent) return "bg-blue-100 text-blue-700 border-blue-200";
 return "bg-slate-100 text-slate-600 border-slate-200";
};

const inputClass =
 "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100";

const checkboxText = (value) => (value ? "Sí" : "No");

const toDateInputValue = (value) => {
 if (!value) return "";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "";
 return date.toISOString().slice(0, 10);
};

const toDateTimeInputValue = (value) => {
 if (!value) return "";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "";
 return date.toISOString().slice(0, 16);
};

const formatDateTime = (value) => {
 if (!value) return "N/D";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "N/D";
 return date.toLocaleString("es-EC", {
 timeZone: "America/Guayaquil",
 year: "numeric",
 month: "2-digit",
 day: "2-digit",
 hour: "2-digit",
 minute: "2-digit",
 });
};

const WithdrawalStepper = ({
 workflow = null,
 onAction,
 onEmitFst11,
 busyAction = "",
 busyEmit = false,
}) => {
 const state = workflow?.workflow_state || {};
 const currentStatus = workflow?.workflow_status || "withdrawal_requested";
 const currentIndex = Math.max(
 0,
 STAGES.findIndex((stage) => stage.key === currentStatus),
 );

 const [coordinationDraft, setCoordinationDraft] = useState({
 scheduled_date: "",
 contact_name: "",
 contact_phone: "",
 notes: "",
 });
 const [providerDraft, setProviderDraft] = useState({
 applies: "",
 provider_name: "",
 case_reference: "",
 platform: "",
 status: "opened",
 notes: "",
 });
 const [workOrderDraft, setWorkOrderDraft] = useState({
 work_order_number: "",
 assigned_to: "",
 assigned_email: "",
 notes: "",
 });
 const [disinfectionDraft, setDisinfectionDraft] = useState({
 use_latest_document: true,
 fst02_file_id: "",
 part_change_required: false,
 part_change_notes: "",
 });
 const [withdrawalDraft, setWithdrawalDraft] = useState({
 pickup_date: "",
 picked_up_at: "",
 carrier_name: "",
 tracking_reference: "",
 notes: "",
 });

 useEffect(() => {
 setCoordinationDraft({
 scheduled_date: toDateInputValue(state?.coordination?.scheduled_date),
 contact_name: state?.coordination?.contact_name || "",
 contact_phone: state?.coordination?.contact_phone || "",
 notes: state?.coordination?.notes || "",
 });
 setProviderDraft({
 applies:
 typeof state?.provider_case?.applies === "boolean"
 ? state.provider_case.applies
 ? "true"
 : "false"
 : "",
 provider_name: state?.provider_case?.provider_name || "",
 case_reference: state?.provider_case?.case_reference || "",
 platform: state?.provider_case?.platform || "",
 status: state?.provider_case?.status || "opened",
 notes: state?.provider_case?.notes || "",
 });
 setWorkOrderDraft({
 work_order_number: state?.work_order?.work_order_number || "",
 assigned_to: state?.work_order?.assigned_to || "",
 assigned_email: state?.work_order?.assigned_email || "",
 notes: state?.work_order?.notes || "",
 });
 setDisinfectionDraft({
 use_latest_document: true,
 fst02_file_id: state?.disinfection?.fst02_file_id || "",
 part_change_required: Boolean(state?.disinfection?.part_change_required),
 part_change_notes: state?.disinfection?.part_change_notes || "",
 });
 setWithdrawalDraft({
 pickup_date: toDateInputValue(state?.logistics?.pickup_date),
 picked_up_at: toDateTimeInputValue(state?.logistics?.picked_up_at),
 carrier_name: state?.logistics?.carrier_name || "",
 tracking_reference: state?.logistics?.tracking_reference || "",
 notes: state?.logistics?.notes || "",
 });
 }, [workflow?.id, state?.coordination, state?.provider_case, state?.work_order, state?.disinfection, state?.logistics]);

 const hasProviderCase = useMemo(
 () => providerDraft.applies === "true",
 [providerDraft.applies],
 );

 const closureBlocked = Array.isArray(workflow?.closure_blocked_reasons)
 ? workflow.closure_blocked_reasons
 : Array.isArray(state?.closure?.blocked_reasons)
 ? state.closure.blocked_reasons
 : [];

 const runAction = async (action, payload = {}) => {
 if (typeof onAction !== "function") return;
 await onAction(action, payload);
 };

 return (
 <div className="space-y-4">
 <Card className="p-4">
 <h3 className="text-base font-semibold text-slate-900">Estado operativo del retiro</h3>
 <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
 {STAGES.map((stage, index) => {
 const isDone = index < currentIndex || currentStatus === "cerrado";
 const isCurrent = index === currentIndex && currentStatus !== "cerrado";
 return (
 <div
 key={stage.key}
 className={`rounded-lg border px-3 py-2 text-xs font-semibold ${statusClass(
 isDone,
 isCurrent,
 )}`}
 >
 {stage.label}
 </div>
 );
 })}
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="text-sm font-semibold text-slate-900">1. Coordinación de retiro</h4>
 <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-xs font-medium text-slate-600">
 Fecha coordinada
 <input
 type="date"
 className={inputClass}
 value={coordinationDraft.scheduled_date}
 onChange={(event) =>
 setCoordinationDraft((prev) => ({ ...prev, scheduled_date: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Contacto cliente
 <input
 className={inputClass}
 value={coordinationDraft.contact_name}
 onChange={(event) =>
 setCoordinationDraft((prev) => ({ ...prev, contact_name: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Teléfono contacto
 <input
 className={inputClass}
 value={coordinationDraft.contact_phone}
 onChange={(event) =>
 setCoordinationDraft((prev) => ({ ...prev, contact_phone: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600 md:col-span-2">
 Notas
 <textarea
 className={inputClass}
 rows={2}
 value={coordinationDraft.notes}
 onChange={(event) =>
 setCoordinationDraft((prev) => ({ ...prev, notes: event.target.value }))
 }
 />
 </label>
 </div>
 <div className="mt-3 flex justify-end">
 <Button
 size="sm"
 disabled={busyAction === "coordinate_withdrawal"}
 onClick={() => runAction("coordinate_withdrawal", coordinationDraft)}
 >
 Guardar coordinación
 </Button>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="text-sm font-semibold text-slate-900">2. Caso con proveedor</h4>
 <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-xs font-medium text-slate-600">
 ¿Aplica caso proveedor?
 <select
 className={inputClass}
 value={providerDraft.applies}
 onChange={(event) =>
 setProviderDraft((prev) => ({ ...prev, applies: event.target.value }))
 }
 >
 <option value="">Seleccione</option>
 <option value="true">Sí</option>
 <option value="false">No</option>
 </select>
 </label>
 <label className="text-xs font-medium text-slate-600">
 Estado de caso
 <select
 className={inputClass}
 value={providerDraft.status}
 onChange={(event) =>
 setProviderDraft((prev) => ({ ...prev, status: event.target.value }))
 }
 >
 <option value="opened">Abierto</option>
 <option value="in_progress">En progreso</option>
 <option value="resolved">Resuelto</option>
 <option value="closed">Cerrado</option>
 <option value="rejected">Rechazado</option>
 <option value="not_required">No requerido</option>
 </select>
 </label>
 <label className="text-xs font-medium text-slate-600">
 Proveedor
 <input
 className={inputClass}
 value={providerDraft.provider_name}
 onChange={(event) =>
 setProviderDraft((prev) => ({ ...prev, provider_name: event.target.value }))
 }
 disabled={!hasProviderCase}
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Referencia de caso
 <input
 className={inputClass}
 value={providerDraft.case_reference}
 onChange={(event) =>
 setProviderDraft((prev) => ({ ...prev, case_reference: event.target.value }))
 }
 disabled={!hasProviderCase}
 />
 </label>
 <label className="text-xs font-medium text-slate-600 md:col-span-2">
 Plataforma / portal
 <input
 className={inputClass}
 value={providerDraft.platform}
 onChange={(event) =>
 setProviderDraft((prev) => ({ ...prev, platform: event.target.value }))
 }
 disabled={!hasProviderCase}
 />
 </label>
 </div>
 <div className="mt-3 flex justify-end">
 <Button
 size="sm"
 variant="secondary"
 disabled={busyAction === "set_provider_case"}
 onClick={() =>
 runAction("set_provider_case", {
 ...providerDraft,
 applies:
 providerDraft.applies === "true"
 ? true
 : providerDraft.applies === "false"
 ? false
 : null,
 })
 }
 >
 Guardar caso proveedor
 </Button>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="text-sm font-semibold text-slate-900">3. WO de retiro</h4>
 <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-xs font-medium text-slate-600">
 Número WO
 <input
 className={inputClass}
 value={workOrderDraft.work_order_number}
 onChange={(event) =>
 setWorkOrderDraft((prev) => ({ ...prev, work_order_number: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Asignado a
 <input
 className={inputClass}
 value={workOrderDraft.assigned_to}
 onChange={(event) =>
 setWorkOrderDraft((prev) => ({ ...prev, assigned_to: event.target.value }))
 }
 />
 </label>
 </div>
 <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
 <Button
 size="sm"
 variant="secondary"
 disabled={busyAction === "open_work_order"}
 onClick={() => runAction("open_work_order", workOrderDraft)}
 >
 Abrir WO
 </Button>
 <Button
 size="sm"
 variant="outline"
 disabled={busyAction === "close_work_order"}
 onClick={() => runAction("close_work_order", { notes: workOrderDraft.notes })}
 >
 Cerrar WO
 </Button>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="text-sm font-semibold text-slate-900">4. Desinfección F.ST-02</h4>
 <div className="mt-2 text-xs text-slate-600">
 Estado: <span className="font-semibold">{state?.disinfection?.status || "pending"}</span>
 </div>
 <div className="mt-2 text-xs text-slate-600">
 Documento F.ST-02:{" "}
 {state?.disinfection?.fst02_link ? (
 <a
 href={state.disinfection.fst02_link}
 target="_blank"
 rel="noreferrer"
 className="font-semibold text-blue-600 hover:underline"
 >
 Ver documento
 </a>
 ) : (
 <span className="font-semibold">Pendiente</span>
 )}
 </div>
 <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-xs font-medium text-slate-600">
 ID F.ST-02 manual (opcional)
 <input
 className={inputClass}
 value={disinfectionDraft.fst02_file_id}
 onChange={(event) =>
 setDisinfectionDraft((prev) => ({ ...prev, fst02_file_id: event.target.value }))
 }
 />
 </label>
 <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
 <input
 type="checkbox"
 checked={disinfectionDraft.part_change_required}
 onChange={(event) =>
 setDisinfectionDraft((prev) => ({
 ...prev,
 part_change_required: event.target.checked,
 }))
 }
 />
 ¿Hubo cambio de partes?
 </label>
 <label className="text-xs font-medium text-slate-600 md:col-span-2">
 Notas de cambio de partes
 <textarea
 className={inputClass}
 rows={2}
 value={disinfectionDraft.part_change_notes}
 onChange={(event) =>
 setDisinfectionDraft((prev) => ({ ...prev, part_change_notes: event.target.value }))
 }
 />
 </label>
 </div>
 <div className="mt-3 flex justify-end">
 <Button
 size="sm"
 variant="secondary"
 disabled={busyAction === "register_disinfection"}
 onClick={() => runAction("register_disinfection", disinfectionDraft)}
 >
 Registrar desinfección
 </Button>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="text-sm font-semibold text-slate-900">5. Retiro ejecutado y acta F.ST-11</h4>
 <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-xs font-medium text-slate-600">
 Fecha retiro
 <input
 type="date"
 className={inputClass}
 value={withdrawalDraft.pickup_date}
 onChange={(event) =>
 setWithdrawalDraft((prev) => ({ ...prev, pickup_date: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Retirado en (fecha y hora)
 <input
 type="datetime-local"
 className={inputClass}
 value={withdrawalDraft.picked_up_at}
 onChange={(event) =>
 setWithdrawalDraft((prev) => ({ ...prev, picked_up_at: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Transportista
 <input
 className={inputClass}
 value={withdrawalDraft.carrier_name}
 onChange={(event) =>
 setWithdrawalDraft((prev) => ({ ...prev, carrier_name: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Guía / tracking
 <input
 className={inputClass}
 value={withdrawalDraft.tracking_reference}
 onChange={(event) =>
 setWithdrawalDraft((prev) => ({
 ...prev,
 tracking_reference: event.target.value,
 }))
 }
 />
 </label>
 </div>
 <div className="mt-3 flex flex-wrap justify-end gap-2">
 <Button
 size="sm"
 variant="secondary"
 disabled={busyAction === "mark_withdrawn"}
 onClick={() => runAction("mark_withdrawn", withdrawalDraft)}
 >
 Registrar retiro ejecutado
 </Button>
 <Button
 size="sm"
 disabled={busyEmit}
 onClick={() => onEmitFst11?.()}
 >
 Emitir F.ST-11
 </Button>
 </div>
 <div className="mt-2 text-xs text-slate-600">
 F.ST-11:{" "}
 {state?.withdrawal_act?.fst11_link ? (
 <a
 href={state.withdrawal_act.fst11_link}
 target="_blank"
 rel="noreferrer"
 className="font-semibold text-blue-600 hover:underline"
 >
 Ver acta de retiro
 </a>
 ) : (
 <span className="font-semibold">Pendiente de emisión</span>
 )}
 </div>
 <div className="mt-1 text-xs text-slate-500">
 Emitido: {formatDateTime(state?.withdrawal_act?.generated_at)}
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="text-sm font-semibold text-slate-900">6. Cierre técnico del workflow</h4>
 <div className="mt-2 text-xs text-slate-600">
 Firmado por cliente: <span className="font-semibold">{checkboxText(state?.withdrawal_act?.signed_client)}</span>
 </div>
 <div className="mt-1 text-xs text-slate-600">
 Firmado por técnico: <span className="font-semibold">{checkboxText(state?.withdrawal_act?.signed_technical)}</span>
 </div>
 {closureBlocked.length > 0 ? (
 <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
 <p className="font-semibold">Bloqueos de cierre</p>
 <p>{closureBlocked.join(", ")}</p>
 </div>
 ) : (
 <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
 Workflow listo para cierre.
 </div>
 )}
 <div className="mt-3 flex justify-end">
 <Button
 size="sm"
 variant="success"
 disabled={busyAction === "close_withdrawal"}
 onClick={() => runAction("close_withdrawal", {})}
 >
 Cerrar retiro
 </Button>
 </div>
 </Card>
 </div>
 );
};

export default WithdrawalStepper;

