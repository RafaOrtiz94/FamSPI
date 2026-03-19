import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
 getBusinessCaseDispatchWorkspace,
 saveBusinessCaseCommercialDispatchPlan,
 saveBusinessCaseOperationsDispatchControl,
} from "../../../../../core/api/businessCaseApi";
import { useUI } from "../../../../../core/ui/UIContext";
import { useAuth } from "../../../../../core/auth/AuthContext";

const TYPE_LABELS = {
 determinacion: "Determinación",
 reactivo: "Reactivo",
 control: "Control",
 calibrador: "Calibrador",
 consumible: "Consumible",
 material: "Material",
 otro: "Otro",
};

const COMMERCIAL_ROLES = new Set(["jefe_comercial", "gerencia", "gerencia_general"]);
const OPERATIONS_ROLES = new Set(["jefe_operaciones", "gerencia", "gerencia_general"]);

const toNumber = (value, fallback = 0) => {
 const parsed = Number(value);
 return Number.isFinite(parsed) ? parsed : fallback;
};

const DispatchWorkspaceSection = ({ onSave = () => {} }) => {
 const { id: businessCaseId } = useParams();
 const { showToast } = useUI();
 const { user } = useAuth();

 const [loading, setLoading] = useState(true);
 const [savingCommercial, setSavingCommercial] = useState(false);
 const [savingOperations, setSavingOperations] = useState(false);
 const [rows, setRows] = useState([]);
 const [summary, setSummary] = useState(null);
 const [draftByKey, setDraftByKey] = useState({});

 const normalizedRole = String(user?.role || user?.scope || "").toLowerCase();
 const canEditCommercial = COMMERCIAL_ROLES.has(normalizedRole);
 const canEditOperations = OPERATIONS_ROLES.has(normalizedRole);

 const hydrateDraft = useCallback((items = []) => {
 const next = {};
 items.forEach((item) => {
 next[item.itemKey] = {
 plannedQty: String(item.plannedQty ?? 0),
 unitPrice: item.unitPrice === null || item.unitPrice === undefined ? "" : String(item.unitPrice),
 commercialNotes: item.commercialNotes || "",
 opsDispatchQty: String(item.opsDispatchQty ?? 0),
 opsDispatchedQty: String(item.opsDispatchedQty ?? 0),
 opsStatus: item.opsStatus || "pendiente",
 operationsNotes: item.operationsNotes || "",
 };
 });
 setDraftByKey(next);
 }, []);

 const loadWorkspace = useCallback(async () => {
 if (!businessCaseId) return;
 try {
 setLoading(true);
 const data = await getBusinessCaseDispatchWorkspace(businessCaseId);
 const items = Array.isArray(data?.items) ? data.items : [];
 setRows(items);
 setSummary(data?.summary || null);
 hydrateDraft(items);
 } catch (error) {
 showToast(error?.response?.data?.message || "No se pudo cargar el workspace de despacho", "error");
 } finally {
 setLoading(false);
 }
 }, [businessCaseId, hydrateDraft, showToast]);

 useEffect(() => {
 loadWorkspace();
 }, [loadWorkspace]);

 const groupedRows = useMemo(() => {
 const groups = new Map();
 rows.forEach((row) => {
 const groupKey = `${row.equipmentId || "manual"}::${row.equipmentName || "Sin equipo"}`;
 if (!groups.has(groupKey)) {
 groups.set(groupKey, {
 key: groupKey,
 equipmentName: row.equipmentName || "Sin equipo",
 items: [],
 });
 }
 groups.get(groupKey).items.push(row);
 });
 return Array.from(groups.values());
 }, [rows]);

 const updateDraft = (itemKey, field, value) => {
 setDraftByKey((prev) => ({
 ...prev,
 [itemKey]: {
 ...(prev[itemKey] || {}),
 [field]: value,
 },
 }));
 };

 const handleSaveCommercial = async () => {
 if (!canEditCommercial) return;
 try {
 setSavingCommercial(true);
 const payload = rows.map((row) => {
 const draft = draftByKey[row.itemKey] || {};
 return {
 item_key: row.itemKey,
 planned_qty: toNumber(draft.plannedQty, 0),
 unit_price: draft.unitPrice === "" ? null : toNumber(draft.unitPrice, 0),
 commercial_notes: draft.commercialNotes || "",
 };
 });

 const data = await saveBusinessCaseCommercialDispatchPlan(businessCaseId, payload);
 const items = Array.isArray(data?.items) ? data.items : [];
 setRows(items);
 setSummary(data?.summary || null);
 hydrateDraft(items);
 onSave({ refresh: false });
 showToast("Plan comercial guardado", "success");
 } catch (error) {
 showToast(error?.response?.data?.message || "No se pudo guardar el plan comercial", "error");
 } finally {
 setSavingCommercial(false);
 }
 };

 const handleSaveOperations = async () => {
 if (!canEditOperations) return;
 try {
 setSavingOperations(true);
 const payload = rows.map((row) => {
 const draft = draftByKey[row.itemKey] || {};
 return {
 item_key: row.itemKey,
 ops_dispatch_qty: toNumber(draft.opsDispatchQty, 0),
 ops_dispatched_qty: toNumber(draft.opsDispatchedQty, 0),
 ops_status: draft.opsStatus || "pendiente",
 operations_notes: draft.operationsNotes || "",
 };
 });

 const data = await saveBusinessCaseOperationsDispatchControl(businessCaseId, payload);
 const items = Array.isArray(data?.items) ? data.items : [];
 setRows(items);
 setSummary(data?.summary || null);
 hydrateDraft(items);
 onSave({ refresh: false });
 showToast("Control operativo guardado", "success");
 } catch (error) {
 showToast(error?.response?.data?.message || "No se pudo guardar el control operativo", "error");
 } finally {
 setSavingOperations(false);
 }
 };

 if (loading) {
 return (
 <div className="p-6">
 <div className="flex items-center justify-center py-16">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6 p-4 sm:p-6">
 <div className="flex flex-col gap-2">
 <h2 className="text-xl font-bold text-gray-900">Cantidades Maximas</h2>
 <p className="text-sm text-gray-600">
 Jefe Comercial define las cantidades maximas por elemento. Jefe Operaciones mantiene el control operativo de despacho sobre la misma base.
 </p>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
 <StatCard title="Elementos" value={summary?.totalItems ?? 0} />
 <StatCard title="Cant. maxima comercial" value={summary?.totalPlannedQty ?? 0} />
 <StatCard title="Cant. a despachar" value={summary?.totalOpsDispatchQty ?? 0} />
 <StatCard title="Cant. despachada" value={summary?.totalOpsDispatchedQty ?? 0} />
 <StatCard title="Avance despacho" value={`${Math.round((summary?.completionRatio || 0) * 100)}%`} />
 </div>

 {groupedRows.map((group) => (
 <div key={group.key} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
 <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
 <h3 className="text-sm font-semibold text-gray-800">{group.equipmentName}</h3>
 </div>
 <div className="overflow-x-auto">
 <table className="min-w-[1300px] w-full text-sm">
 <thead className="bg-gray-50 text-gray-600">
 <tr>
 <th className="text-left px-3 py-2 font-semibold">Tipo</th>
 <th className="text-left px-3 py-2 font-semibold">Elemento</th>
 <th className="text-right px-3 py-2 font-semibold">Cant. anual BC</th>
 <th className="text-right px-3 py-2 font-semibold">Cant. maxima comercial</th>
 <th className="text-right px-3 py-2 font-semibold">Precio unitario</th>
 <th className="text-left px-3 py-2 font-semibold">Nota comercial</th>
 <th className="text-right px-3 py-2 font-semibold">Cant. a despachar</th>
 <th className="text-right px-3 py-2 font-semibold">Cant. despachada</th>
 <th className="text-left px-3 py-2 font-semibold">Estado</th>
 <th className="text-left px-3 py-2 font-semibold">Nota operaciones</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {group.items.map((row) => {
 const draft = draftByKey[row.itemKey] || {};
 return (
 <tr key={row.itemKey} className="hover:bg-gray-50/60">
 <td className="px-3 py-2">
 <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
 {TYPE_LABELS[row.itemType] || row.itemType}
 </span>
 </td>
 <td className="px-3 py-2">
 <div className="font-medium text-gray-900">{row.itemName}</div>
 {row.itemId && <div className="text-xs text-gray-500">ID: {row.itemId}</div>}
 </td>
 <td className="px-3 py-2 text-right text-gray-700">{row.annualQty}</td>
 <td className="px-3 py-2">
 <input
 type="number"
 min="0"
 value={draft.plannedQty ?? "0"}
 onChange={(e) => updateDraft(row.itemKey, "plannedQty", e.target.value)}
 disabled={!canEditCommercial}
 className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-right disabled:bg-gray-100"
 />
 </td>
 <td className="px-3 py-2">
 <input
 type="number"
 min="0"
 step="0.0001"
 value={draft.unitPrice ?? ""}
 onChange={(e) => updateDraft(row.itemKey, "unitPrice", e.target.value)}
 disabled={!canEditCommercial}
 className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-right disabled:bg-gray-100"
 />
 </td>
 <td className="px-3 py-2">
 <input
 type="text"
 value={draft.commercialNotes ?? ""}
 onChange={(e) => updateDraft(row.itemKey, "commercialNotes", e.target.value)}
 disabled={!canEditCommercial}
 className="w-full border border-gray-200 rounded-lg px-2 py-1 disabled:bg-gray-100"
 />
 </td>
 <td className="px-3 py-2">
 <input
 type="number"
 min="0"
 value={draft.opsDispatchQty ?? "0"}
 onChange={(e) => updateDraft(row.itemKey, "opsDispatchQty", e.target.value)}
 disabled={!canEditOperations}
 className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-right disabled:bg-gray-100"
 />
 </td>
 <td className="px-3 py-2">
 <input
 type="number"
 min="0"
 value={draft.opsDispatchedQty ?? "0"}
 onChange={(e) => updateDraft(row.itemKey, "opsDispatchedQty", e.target.value)}
 disabled={!canEditOperations}
 className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-right disabled:bg-gray-100"
 />
 </td>
 <td className="px-3 py-2">
 <select
 value={draft.opsStatus ?? "pendiente"}
 onChange={(e) => updateDraft(row.itemKey, "opsStatus", e.target.value)}
 disabled={!canEditOperations}
 className="w-36 border border-gray-200 rounded-lg px-2 py-1 disabled:bg-gray-100"
 >
 <option value="pendiente">Pendiente</option>
 <option value="listo">Listo</option>
 <option value="parcial">Parcial</option>
 <option value="despachado">Despachado</option>
 <option value="cancelado">Cancelado</option>
 </select>
 </td>
 <td className="px-3 py-2">
 <input
 type="text"
 value={draft.operationsNotes ?? ""}
 onChange={(e) => updateDraft(row.itemKey, "operationsNotes", e.target.value)}
 disabled={!canEditOperations}
 className="w-full border border-gray-200 rounded-lg px-2 py-1 disabled:bg-gray-100"
 />
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 ))}

 <div className="flex flex-col md:flex-row gap-3 md:justify-between md:items-center pt-2">
 <button
 type="button"
 onClick={loadWorkspace}
 className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
 >
 Refrescar
 </button>

 <div className="flex flex-col sm:flex-row gap-2">
 {canEditCommercial && (
 <button
 type="button"
 onClick={handleSaveCommercial}
 disabled={savingCommercial}
 className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
 >
 {savingCommercial ? "Guardando plan comercial..." : "Guardar plan comercial"}
 </button>
 )}
 {canEditOperations && (
 <button
 type="button"
 onClick={handleSaveOperations}
 disabled={savingOperations}
 className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
 >
 {savingOperations ? "Guardando control operativo..." : "Guardar control operativo"}
 </button>
 )}
 </div>
 </div>
 </div>
 );
};

const StatCard = ({ title, value }) => (
 <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
 <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{title}</div>
 <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
 </div>
);

export default DispatchWorkspaceSection;

