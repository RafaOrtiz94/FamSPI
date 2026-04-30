import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowRightCircle, FiCheckCircle, FiLock, FiTrendingUp, FiXCircle } from "react-icons/fi";
import { submitBusinessCaseFeasibilityDecision } from "../../../../../core/api/businessCaseApi";
import { useUI } from "../../../../../core/ui/UIContext";

const FALLBACK_OPTIONS = [
 { value: "venta", label: "Compra directa" },
 { value: "alquiler", label: "Alquiler" },
 { value: "alquiler_transferencia_dominio", label: "Alquiler con transferencia de dominio" },
];

const normalizeFallbackLabel = (value) => {
 const normalized = String(value || "").trim().toLowerCase();
 if (normalized === "venta") return "Compra directa";
 if (normalized === "alquiler") return "Alquiler";
 if (
 normalized === "alquiler_transferencia_dominio" ||
 normalized === "alquiler_con_transferencia_de_dominio"
 ) {
 return "Alquiler con transferencia de dominio";
 }
 return "No definido";
};

const resolvePurchasesWorkspacePath = (businessCase) => {
 const metadata =
 businessCase?.modern_bc_metadata &&
 typeof businessCase.modern_bc_metadata === "object" &&
 !Array.isArray(businessCase.modern_bc_metadata)
 ? businessCase.modern_bc_metadata
 : {};
 const sourceModule = String(metadata?.source_module || "").toLowerCase();

 if (sourceModule.includes("equipment_purchases")) return "/dashboard/purchases/workspace?tab=public";
 if (sourceModule.includes("private_purchases") || metadata?.private_purchase_id) {
 return "/dashboard/purchases/workspace?tab=private";
 }
 return "/dashboard/purchases/workspace";
};

const FeasibilitySection = ({
 businessCase,
 permissions = {},
 ownership = {},
 onSave = () => {},
}) => {
 const { id: businessCaseId } = useParams();
 const navigate = useNavigate();
 const { showToast } = useUI();

 const feasibility =
 businessCase?.modern_bc_metadata &&
 typeof businessCase.modern_bc_metadata === "object" &&
 !Array.isArray(businessCase.modern_bc_metadata) &&
 businessCase.modern_bc_metadata.feasibility &&
 typeof businessCase.modern_bc_metadata.feasibility === "object" &&
 !Array.isArray(businessCase.modern_bc_metadata.feasibility)
 ? businessCase.modern_bc_metadata.feasibility
 : {};

 const decision =
 feasibility?.decision && typeof feasibility.decision === "object" && !Array.isArray(feasibility.decision)
 ? feasibility.decision
 : null;

 const hasExport = Boolean(feasibility?.export_excel?.at);
 const isClosed = Boolean(permissions.workspaceClosed || feasibility?.closed || decision?.decided_at);
 const canEdit = Boolean(
 permissions.canEdit !== false &&
 permissions.canDecideFeasibility &&
 ownership?.canUserEdit !== false &&
 !isClosed,
 );

 const [saving, setSaving] = useState(false);
 const [isFeasible, setIsFeasible] = useState(
 decision ? Boolean(decision.is_feasible) : true,
 );
 const [fallbackOfferKind, setFallbackOfferKind] = useState(
 decision?.fallback_offer_kind || "venta",
 );
 const [notes, setNotes] = useState(decision?.notes || "");

 const purchasesWorkspacePath = useMemo(
 () => resolvePurchasesWorkspacePath(businessCase),
 [businessCase],
 );

 const handleSubmit = async () => {
 if (!businessCaseId) return;
 if (!hasExport) {
 showToast("Primero debes sincronizar el Sheet oficial para habilitar factibilidad", "warning");
 return;
 }
 if (!isFeasible && !fallbackOfferKind) {
 showToast("Selecciona la alternativa comercial cuando el BC no es factible", "warning");
 return;
 }

 try {
 setSaving(true);
 await submitBusinessCaseFeasibilityDecision(businessCaseId, {
 is_feasible: Boolean(isFeasible),
 notes,
 fallback_offer_kind: isFeasible ? undefined : fallbackOfferKind,
 });
 await onSave({ refresh: true, markComplete: false, section: "feasibility" });
 showToast(
 isFeasible
 ? "Factibilidad aprobada. El Business Case quedo cerrado para continuar en compras."
 : "Business Case no factible. Se registro la alternativa para continuar en compras.",
 "success",
 );
 } catch (error) {
 showToast(
 error?.response?.data?.message || "No se pudo registrar la decision de factibilidad",
 "error",
 );
 } finally {
 setSaving(false);
 }
 };

 return (
 <div className="space-y-5">
 <div className="flex flex-col gap-2">
 <h2 className="text-xl font-bold text-gray-900">Factibilidad</h2>
 <p className="text-sm text-gray-600">
 Ultimo paso del Business Case. ACP Comercial o Jefe Comercial registran la decision final
 para cerrar el BC y continuar el flujo en compras.
 </p>
 </div>

 {!hasExport && (
 <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
 Antes de decidir la factibilidad, el Sheet oficial debe estar sincronizado desde la seccion
 de Sincronizacion.
 </div>
 )}

 {isClosed && decision && (
 <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
 <div className="flex items-start gap-3">
 <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
 {decision.is_feasible ? <FiCheckCircle size={18} /> : <FiXCircle size={18} />}
 </div>
 <div className="space-y-1">
 <p className="text-sm font-semibold text-emerald-900">
 Business Case cerrado como {decision.is_feasible ? "factible" : "no factible"}
 </p>
 <p className="text-xs text-emerald-800">
 Resuelto por {decision.decided_by_email || "N/D"}
 {decision.decided_at ? ` el ${new Date(decision.decided_at).toLocaleString("es-EC")}` : ""}
 </p>
 {!decision.is_feasible && (
 <p className="text-xs text-emerald-800">
 Alternativa definida: {normalizeFallbackLabel(decision.fallback_offer_kind)}
 </p>
 )}
 {decision.notes ? (
 <p className="pt-1 text-sm text-emerald-900">{decision.notes}</p>
 ) : null}
 </div>
 </div>
 </div>
 )}

 <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
 <div className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
 <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
 Decision de factibilidad
 </p>
 <div className="grid gap-3 sm:grid-cols-2">
 <button
 type="button"
 disabled={!canEdit}
 onClick={() => setIsFeasible(true)}
 className={`rounded-2xl border p-4 text-left transition-colors ${
 isFeasible
 ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200"
 : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
 } ${!canEdit ? "cursor-not-allowed opacity-70" : ""}`}
 >
 <div className="flex items-center gap-3">
 <div className="shrink-0 rounded-xl bg-emerald-100 p-2 text-emerald-700">
 <FiTrendingUp size={18} />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-semibold text-gray-900">Factible / rentable</p>
 <p className="mt-0.5 text-xs text-gray-500">
 Cierra el BC como factible y permite continuar en workspace de compras.
 </p>
 </div>
 </div>
 </button>

 <button
 type="button"
 disabled={!canEdit}
 onClick={() => setIsFeasible(false)}
 className={`rounded-2xl border p-4 text-left transition-colors ${
 !isFeasible
 ? "border-rose-300 bg-rose-50 ring-2 ring-rose-200"
 : "border-gray-200 bg-white hover:border-rose-200 hover:bg-rose-50/40"
 } ${!canEdit ? "cursor-not-allowed opacity-70" : ""}`}
 >
 <div className="flex items-center gap-3">
 <div className="shrink-0 rounded-xl bg-rose-100 p-2 text-rose-700">
 <FiXCircle size={18} />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-semibold text-gray-900">No factible</p>
 <p className="mt-0.5 text-xs text-gray-500">
 Cierra el BC y deriva la alternativa comercial para seguir el flujo en compras.
 </p>
 </div>
 </div>
 </button>
 </div>

 {!isFeasible && (
 <div className="mt-5 space-y-2">
 <label className="text-sm font-medium text-gray-700">Alternativa comercial</label>
 <select
 value={fallbackOfferKind}
 onChange={(event) => setFallbackOfferKind(event.target.value)}
 disabled={!canEdit}
 className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
 >
 {FALLBACK_OPTIONS.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 </div>
 )}

 <div className="mt-5 space-y-2">
 <label className="text-sm font-medium text-gray-700">Notas de cierre</label>
 <textarea
 rows={4}
 value={notes}
 onChange={(event) => setNotes(event.target.value)}
 disabled={!canEdit}
 placeholder="Registra la conclusion comercial o financiera del Business Case"
 className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
 />
 </div>

 <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
 <button
 type="button"
 onClick={() => navigate(purchasesWorkspacePath)}
 className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
 >
 <FiArrowRightCircle size={16} />
 Ir a workspace de compras
 </button>
 {canEdit && (
 <button
 type="button"
 onClick={handleSubmit}
 disabled={saving || !hasExport}
 className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
 >
 <FiLock size={16} />
 {saving ? "Guardando..." : "Guardar decision y cerrar BC"}
 </button>
 )}
 </div>
 </div>

 <div className="w-full shrink-0 space-y-4 xl:w-72">
 <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
 <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estado actual</p>
 <div className="mt-3 space-y-2 text-sm text-gray-700">
 <p>
 Sheet oficial: <span className="font-semibold text-gray-900">{hasExport ? "Sincronizado" : "Pendiente"}</span>
 </p>
 <p>
 Stage BC: <span className="font-semibold text-gray-900">{businessCase?.bc_stage || "draft"}</span>
 </p>
 <p>
 Decision registrada: <span className="font-semibold text-gray-900">{decision?.decided_at ? "Si" : "No"}</span>
 </p>
 </div>
 </div>

 <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
 <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Regla operativa</p>
 <ul className="mt-3 space-y-2 text-sm text-gray-700">
 <li>1. Sincronizacion debe generar el Sheet oficial.</li>
 <li>2. ACP Comercial o Jefe Comercial registran la decision de factibilidad.</li>
 <li>3. La decision cierra el Business Case.</li>
 <li className="mt-1 text-xs text-emerald-700 font-medium">→ Si es factible: se habilita la seccion Cantidades Maximas para control operativo.</li>
 <li className="text-xs text-rose-700 font-medium">→ Si no es factible: se registra la alternativa comercial y el flujo continua en compras.</li>
 </ul>
 </div>
 </div>
 </div>

 {!canEdit && !isClosed && (
 <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
 Esta seccion esta disponible solo para ACP Comercial y Jefe Comercial mientras el Business Case siga abierto.
 </div>
 )}
 </div>
 );
};

export default FeasibilitySection;
