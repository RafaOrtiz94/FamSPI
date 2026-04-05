import React, { useEffect, useMemo, useState } from "react";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import PreventiveOfferModal from "./PreventiveOfferModal";
import ReprogrammingNoticeModal from "./ReprogrammingNoticeModal";

const inputClass =
 "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100";

const statusChip = (value) => {
 const status = String(value || "planned").toLowerCase();
 if (status === "completed") return "bg-emerald-100 text-emerald-700";
 if (status === "in_execution") return "bg-blue-100 text-blue-700";
 if (status === "cancelled" || status === "offer_rejected") return "bg-rose-100 text-rose-700";
 if (status === "kit_requested" || status === "kit_ready") return "bg-indigo-100 text-indigo-700";
 if (status === "offer_pending") return "bg-amber-100 text-amber-700";
 return "bg-slate-100 text-slate-700";
};

const splitLines = (value) =>
 String(value || "")
 .split("\n")
 .map((line) => line.trim())
 .filter(Boolean);

const parseEvidenceLines = (value) =>
 splitLines(value).map((line, index) => ({
 id: `EVI-${index + 1}`,
 reference: line,
 }));

const PreventiveEquipmentSchedulePanel = ({
 plan = null,
 compliance = null,
 capacity = null,
 busy = false,
 onIssueFst17,
 onIssueOffer,
 onOfferDecision,
 onReprogram,
 onCoordinate,
 onWorkOrder,
 onRequestKit,
 onWarehouseExit,
 onCloseExecution,
}) => {
 const items = useMemo(() => (Array.isArray(plan?.items) ? plan.items : []), [plan?.items]);
 const [selectedItemId, setSelectedItemId] = useState(null);
 const [openOfferModal, setOpenOfferModal] = useState(false);
 const [openReprogramModal, setOpenReprogramModal] = useState(false);
 const [coordinationWindow, setCoordinationWindow] = useState("");
 const [workOrderNumber, setWorkOrderNumber] = useState("");
 const [kitObservations, setKitObservations] = useState("");
 const [executionDraft, setExecutionDraft] = useState({
 executed_at: "",
 duration_minutes: "",
 activities: "",
 parts_replaced: "",
 consumables: "",
 evidence: "",
 notes: "",
 });

 const selectedItem = useMemo(
 () => items.find((item) => Number(item.id) === Number(selectedItemId)) || items[0] || null,
 [items, selectedItemId],
 );

 useEffect(() => {
 setSelectedItemId(items[0]?.id || null);
 }, [plan?.id, items]);

 useEffect(() => {
 if (!selectedItem) return;
 setCoordinationWindow(selectedItem.coordination_window || "");
 setWorkOrderNumber(selectedItem.work_order_number || "");
 setKitObservations("");
 setExecutionDraft({
 executed_at: "",
 duration_minutes: "",
 activities: "",
 parts_replaced: "",
 consumables: "",
 evidence: "",
 notes: "",
 });
 }, [selectedItem]);

 const complianceRate = compliance?.summary?.compliance_rate || 0;
 const pendingOffers = items.filter((item) => item.status === "offer_pending").length;
 const overloadMonths = Array.isArray(capacity?.months)
 ? capacity.months.filter((month) => month.over_capacity).length
 : 0;

 return (
 <div className="space-y-4">
 <Card className="p-4">
 <h3 className="text-base font-semibold text-slate-900">Cronograma preventivo por equipo (F.ST-17)</h3>
 <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
 <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
 <p className="text-xs text-slate-600">Cumplimiento mensual</p>
 <p className="text-lg font-semibold text-slate-900">{complianceRate}%</p>
 </div>
 <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
 <p className="text-xs text-slate-600">Ofertas pendientes</p>
 <p className="text-lg font-semibold text-slate-900">{pendingOffers}</p>
 </div>
 <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
 <p className="text-xs text-slate-600">Meses sobre capacidad (Anexo 7)</p>
 <p className="text-lg font-semibold text-slate-900">{overloadMonths}</p>
 </div>
 </div>
 </Card>

 <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
 <Card className="xl:col-span-7 p-0">
 <div className="max-h-[62vh] overflow-auto">
 <table className="w-full min-w-[860px] text-left text-xs">
 <thead className="sticky top-0 bg-slate-50 text-slate-600">
 <tr>
 <th className="px-3 py-2">Equipo</th>
 <th className="px-3 py-2">Cliente</th>
 <th className="px-3 py-2">Plan</th>
 <th className="px-3 py-2">WO</th>
 <th className="px-3 py-2">Estado</th>
 <th className="px-3 py-2 text-right">Acciones</th>
 </tr>
 </thead>
 <tbody>
 {items.length === 0 ? (
 <tr>
 <td className="px-3 py-4 text-slate-500" colSpan={6}>
 Sin equipos en este plan.
 </td>
 </tr>
 ) : (
 items.map((item) => {
 const selected = Number(selectedItem?.id) === Number(item.id);
 return (
 <tr
 key={item.id}
 className={`border-t border-slate-100 ${selected ? "bg-blue-50" : "hover:bg-slate-50"} cursor-pointer`}
 onClick={() => setSelectedItemId(item.id)}
 >
 <td className="px-3 py-2 font-semibold text-slate-700">
 {item.equipment_name || `#${item.equipment_id}`}
 </td>
 <td className="px-3 py-2 text-slate-700">{item.client_name || "N/D"}</td>
 <td className="px-3 py-2 text-slate-600">{item.planned_date || "N/D"}</td>
 <td className="px-3 py-2 text-slate-600">{item.work_order_number || "Pendiente"}</td>
 <td className="px-3 py-2">
 <span className={`rounded-full px-2 py-1 font-semibold ${statusChip(item.status)}`}>
 {item.status}
 </span>
 </td>
 <td className="px-3 py-2">
 <div className="flex justify-end gap-1">
 <Button
 size="sm"
 variant="secondary"
 disabled={busy}
 onClick={(event) => {
 event.stopPropagation();
 setSelectedItemId(item.id);
 setOpenOfferModal(true);
 }}
 >
 Oferta
 </Button>
 <Button
 size="sm"
 variant="outline"
 disabled={busy}
 onClick={(event) => {
 event.stopPropagation();
 setSelectedItemId(item.id);
 setOpenReprogramModal(true);
 }}
 >
 Reprog.
 </Button>
 <Button
 size="sm"
 variant="outline"
 disabled={busy}
 onClick={(event) => {
 event.stopPropagation();
 onIssueFst17?.(item);
 }}
 >
 F.ST-17
 </Button>
 </div>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </Card>

 <Card className="xl:col-span-5 p-4">
 {!selectedItem ? (
 <p className="text-sm text-slate-500">Selecciona un equipo para gestionar su flujo preventivo.</p>
 ) : (
 <div className="space-y-4">
 <div>
 <h4 className="text-sm font-semibold text-slate-900">
 {selectedItem.equipment_name || `Equipo #${selectedItem.equipment_id}`}
 </h4>
 <p className="text-xs text-slate-600">
 Cliente: {selectedItem.client_name || "N/D"} · Garantía: {selectedItem.warranty_status}
 </p>
 </div>

 <div className="rounded-xl border border-slate-200 p-3">
 <p className="text-xs font-semibold text-slate-700">Coordinación</p>
 <label className="mt-2 block text-xs font-medium text-slate-600">
 Ventana acordada
 <input
 className={inputClass}
 value={coordinationWindow}
 onChange={(event) => setCoordinationWindow(event.target.value)}
 />
 </label>
 <div className="mt-2 flex justify-end">
 <Button
 size="sm"
 variant="secondary"
 disabled={busy}
 onClick={() =>
 onCoordinate?.(selectedItem, {
 coordination_window: coordinationWindow || null,
 })
 }
 >
 Registrar coordinación
 </Button>
 </div>
 </div>

 <div className="rounded-xl border border-slate-200 p-3">
 <p className="text-xs font-semibold text-slate-700">WO y kits</p>
 <label className="mt-2 block text-xs font-medium text-slate-600">
 Número WO
 <input
 className={inputClass}
 value={workOrderNumber}
 onChange={(event) => setWorkOrderNumber(event.target.value)}
 />
 </label>
 <label className="mt-2 block text-xs font-medium text-slate-600">
 Observaciones kit
 <textarea
 className={inputClass}
 rows={2}
 value={kitObservations}
 onChange={(event) => setKitObservations(event.target.value)}
 />
 </label>
 <div className="mt-2 flex flex-wrap justify-end gap-2">
 <Button
 size="sm"
 variant="outline"
 disabled={busy}
 onClick={() =>
 onWorkOrder?.(selectedItem, {
 work_order_number: workOrderNumber || null,
 auto_create: !workOrderNumber,
 })
 }
 >
 Guardar WO
 </Button>
 <Button
 size="sm"
 variant="secondary"
 disabled={busy}
 onClick={() =>
 onRequestKit?.(selectedItem, {
 observations: kitObservations || null,
 work_order_number: workOrderNumber || selectedItem.work_order_number || null,
 })
 }
 >
 Solicitar kit
 </Button>
 <Button
 size="sm"
 variant="secondary"
 disabled={busy || !selectedItem.latest_kit_id}
 onClick={() =>
 onWarehouseExit?.(selectedItem, {
 kit_id: selectedItem.latest_kit_id,
 warehouse_exit_reference: `SAL-${selectedItem.latest_kit_id}`,
 })
 }
 >
 Salida bodega
 </Button>
 </div>
 </div>

 <div className="rounded-xl border border-slate-200 p-3">
 <p className="text-xs font-semibold text-slate-700">Cierre preventivo (WO + F.ST-17 + Anexo 6)</p>
 <div className="mt-2 grid grid-cols-1 gap-2">
 <label className="text-xs font-medium text-slate-600">
 Fecha de ejecución
 <input
 type="datetime-local"
 className={inputClass}
 value={executionDraft.executed_at}
 onChange={(event) =>
 setExecutionDraft((prev) => ({ ...prev, executed_at: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Duración (minutos)
 <input
 type="number"
 min="1"
 className={inputClass}
 value={executionDraft.duration_minutes}
 onChange={(event) =>
 setExecutionDraft((prev) => ({ ...prev, duration_minutes: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Actividades (una línea por actividad)
 <textarea
 className={inputClass}
 rows={2}
 value={executionDraft.activities}
 onChange={(event) =>
 setExecutionDraft((prev) => ({ ...prev, activities: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Partes reemplazadas (una línea por parte)
 <textarea
 className={inputClass}
 rows={2}
 value={executionDraft.parts_replaced}
 onChange={(event) =>
 setExecutionDraft((prev) => ({ ...prev, parts_replaced: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Repuestos/consumibles (una línea por item)
 <textarea
 className={inputClass}
 rows={2}
 value={executionDraft.consumables}
 onChange={(event) =>
 setExecutionDraft((prev) => ({ ...prev, consumables: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Evidencia (URL o referencia por línea)
 <textarea
 className={inputClass}
 rows={2}
 value={executionDraft.evidence}
 onChange={(event) =>
 setExecutionDraft((prev) => ({ ...prev, evidence: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Observaciones cierre
 <textarea
 className={inputClass}
 rows={2}
 value={executionDraft.notes}
 onChange={(event) =>
 setExecutionDraft((prev) => ({ ...prev, notes: event.target.value }))
 }
 />
 </label>
 </div>
 <div className="mt-2 flex justify-end">
 <Button
 size="sm"
 disabled={busy}
 onClick={() =>
 onCloseExecution?.(selectedItem, {
 executed_at: executionDraft.executed_at || null,
 duration_minutes: executionDraft.duration_minutes
 ? Number(executionDraft.duration_minutes)
 : null,
 work_order_number:
 workOrderNumber || selectedItem.work_order_number || null,
 activities: splitLines(executionDraft.activities),
 parts_replaced: splitLines(executionDraft.parts_replaced),
 consumables: splitLines(executionDraft.consumables),
 evidence: parseEvidenceLines(executionDraft.evidence),
 report_payload: {
 anexo_code: "Anexo 6",
 structured: true,
 },
 notes: executionDraft.notes || null,
 })
 }
 >
 Cerrar preventivo
 </Button>
 </div>
 </div>
 </div>
 )}
 </Card>
 </div>

 <PreventiveOfferModal
 open={openOfferModal}
 onClose={() => setOpenOfferModal(false)}
 item={selectedItem}
 busy={busy}
 onIssueOffer={(payload) => {
 if (!selectedItem) return;
 onIssueOffer?.(selectedItem, payload);
 }}
 onDecision={(payload) => {
 if (!selectedItem) return;
 onOfferDecision?.(selectedItem, payload);
 }}
 />

 <ReprogrammingNoticeModal
 open={openReprogramModal}
 onClose={() => setOpenReprogramModal(false)}
 item={selectedItem}
 busy={busy}
 onSave={(payload) => {
 if (!selectedItem) return;
 onReprogram?.(selectedItem, payload);
 }}
 />
 </div>
 );
};

export default PreventiveEquipmentSchedulePanel;
