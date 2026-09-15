import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowRightCircle, FiCheckCircle, FiLock, FiTrendingUp, FiXCircle, FiMessageSquare } from "react-icons/fi";
import {
  submitBusinessCaseFeasibilityDecision,
  requestBusinessCaseFeasibilityAppeal,
  resolveBusinessCaseFeasibilityAppeal,
} from "../../../../../core/api/businessCaseApi";
import { useUI } from "../../../../../core/ui/UIContext";
import SectionEditorBadge from "../SectionEditorBadge";

const FALLBACK_OPTIONS = [
 { value: "venta", label: "Compra directa" },
 { value: "alquiler", label: "Alquiler" },
 { value: "alquiler_transferencia_dominio", label: "Alquiler con transferencia de dominio" },
 { value: "rechazado_falta_informacion", label: "Rechazado por falta de información" },
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
 if (normalized === "rechazado_falta_informacion") return "Rechazado por falta de información";
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
 const privatePurchaseId = metadata?.private_purchase_id || null;
 const processId = metadata?.preflow_process_id || null;
 const processType = String(metadata?.preflow_process_type || "").toLowerCase();
 const handoff = metadata?.purchase_workspace || {};
 const handoffType = String(handoff?.type || "").toLowerCase();
 const handoffPurchaseId = handoff?.purchase_id || null;

 if (handoffType === "private" && handoffPurchaseId) {
 return `/dashboard/purchases/workspace?tab=private&requestType=private&requestId=${handoffPurchaseId}`;
 }
 if (handoffType === "public" && handoffPurchaseId) {
 return `/dashboard/purchases/workspace?tab=public&requestType=public&requestId=${handoffPurchaseId}`;
 }

 if (privatePurchaseId || processType === "private_comodato" || sourceModule.includes("private_purchases")) {
 const requestId = privatePurchaseId || processId;
 return requestId
 ? `/dashboard/purchases/workspace?tab=private&requestType=private&requestId=${requestId}`
 : "/dashboard/purchases/workspace?tab=private";
 }
 if (processType === "public_purchase" || sourceModule.includes("equipment_purchases")) {
 return processId
 ? `/dashboard/purchases/workspace?tab=public&requestType=public&requestId=${processId}`
 : "/dashboard/purchases/workspace?tab=public";
 }
 return "/dashboard/purchases/workspace";
};

const FeasibilitySection = ({
 businessCase,
 permissions = {},
 ownership = {},
 workflowState = {},
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
  const displayStage = workflowState?.currentStage || businessCase?.bc_stage || "draft";
  const rawStage = workflowState?.rawStage || businessCase?.bc_stage || null;
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

 // BC-16: Estado de apelación
 const [appealReason, setAppealReason] = useState("");
 const [appealSaving, setAppealSaving] = useState(false);
 const [showAppealForm, setShowAppealForm] = useState(false);
 const [resolveAppealNotes, setResolveAppealNotes] = useState("");
 const [resolveAppealSaving, setResolveAppealSaving] = useState(false);

 const canAppealFeasibilityRejection = Boolean(permissions?.canAppealFeasibilityRejection);
 const canResolveFeasibilityAppeal = Boolean(permissions?.canResolveFeasibilityAppeal);
 const existingAppeal = permissions?.feasibilityAppeal || null;
 // BC-17: rechazo definitivo — no se permiten más apelaciones
 const feasibilityIsDefinitivelyRejected = Boolean(permissions?.feasibilityIsDefinitivelyRejected);

 const handleRequestAppeal = async () => {
 if (!appealReason.trim()) {
 showToast("Debes ingresar el motivo de la solicitud de revisión.", "warning");
 return;
 }
 try {
 setAppealSaving(true);
 await requestBusinessCaseFeasibilityAppeal(businessCaseId, { reason: appealReason.trim() });
 setShowAppealForm(false);
 setAppealReason("");
 await onSave({ refresh: true, markComplete: false, section: "feasibility" });
 showToast("Solicitud de revisión enviada a Jefe Comercial.", "success");
 } catch (error) {
 showToast(error?.response?.data?.message || "No se pudo enviar la solicitud de revisión.", "error");
 } finally {
 setAppealSaving(false);
 }
 };

 const handleResolveAppeal = async (approved) => {
 try {
 setResolveAppealSaving(true);
 await resolveBusinessCaseFeasibilityAppeal(businessCaseId, {
 approved,
 notes: resolveAppealNotes.trim(),
 });
 setResolveAppealNotes("");
 await onSave({ refresh: true, markComplete: false, section: "feasibility" });
 showToast(
 approved
 ? "Apelación aprobada. El workspace de factibilidad fue reabierto."
 : "Apelación rechazada.",
 approved ? "success" : "info",
 );
 } catch (error) {
 showToast(error?.response?.data?.message || "No se pudo resolver la apelación.", "error");
 } finally {
 setResolveAppealSaving(false);
 }
 };

 const purchasesWorkspacePath = useMemo(
 () => resolvePurchasesWorkspacePath(businessCase),
 [businessCase],
 );

 const handleSubmit = async () => {
 if (!businessCaseId) return;
 if (isFeasible && !hasExport) {
 showToast("Primero debes sincronizar el Sheet oficial para habilitar factibilidad", "warning");
 return;
 }
 if (!isFeasible && !fallbackOfferKind) {
 showToast("Selecciona la alternativa o el motivo de cierre cuando el BC no es factible", "warning");
 return;
 }
 if (!isFeasible && !notes.trim()) {
 showToast("Registra el motivo para cerrar el Business Case como no factible", "warning");
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
 Ultimo paso del Business Case. ACP Comercial o Jefe Comercial registran la decision final;
 si existe informacion incorrecta o inconsistente pueden cerrarlo como no factible indicando el motivo.
 </p>
 <SectionEditorBadge ownership={ownership} />
 </div>

 {!hasExport && isFeasible && (
 <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
 Antes de decidir la factibilidad, el Sheet oficial debe estar sincronizado desde la seccion
 de Sincronizacion.
 </div>
 )}
 {!hasExport && !isFeasible && (
 <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
 Puedes cerrar como no factible sin Sheet sincronizado cuando la informacion no concuerda,
 pero debes registrar el motivo de cierre.
 </div>
 )}

 {isClosed && decision && (
 <div className={`rounded-2xl border p-4 ${decision.is_feasible ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
 <div className="flex items-start gap-3">
 <div className={`rounded-xl p-2 ${decision.is_feasible ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
 {decision.is_feasible ? <FiCheckCircle size={18} /> : <FiXCircle size={18} />}
 </div>
 <div className="space-y-1 flex-1">
 <p className={`text-sm font-semibold ${decision.is_feasible ? "text-emerald-900" : "text-rose-900"}`}>
 Business Case cerrado como {decision.is_feasible ? "factible" : "no factible"}
 </p>
 <p className={`text-xs ${decision.is_feasible ? "text-emerald-800" : "text-rose-800"}`}>
 Resuelto por {decision.decided_by_email || "N/D"}
 {decision.decided_at ? ` el ${new Date(decision.decided_at).toLocaleString("es-EC")}` : ""}
 </p>
 {!decision.is_feasible && (
 <p className={`text-xs ${decision.is_feasible ? "text-emerald-800" : "text-rose-800"}`}>
 {decision.fallback_offer_kind === "rechazado_falta_informacion" ? "Motivo" : "Alternativa definida"}: {normalizeFallbackLabel(decision.fallback_offer_kind)}
 </p>
 )}
 {decision.notes ? (
 <p className={`pt-1 text-sm ${decision.is_feasible ? "text-emerald-900" : "text-rose-900"}`}>{decision.notes}</p>
 ) : null}
 </div>
 </div>
 </div>
 )}

 {/* BC-16: Panel de apelación cuando el BC fue rechazado */}
 {isClosed && decision && !decision.is_feasible && (
 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revisión de factibilidad</p>

 {/* Apelación pendiente */}
 {existingAppeal?.status === "pending" && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
 <p className="font-semibold">Solicitud de revisión enviada</p>
 <p className="text-xs mt-1">
 Por {existingAppeal.requested_by_email || "N/D"} el{" "}
 {existingAppeal.requested_at ? new Date(existingAppeal.requested_at).toLocaleString("es-EC") : ""}
 </p>
 {existingAppeal.reason && <p className="text-xs mt-1 text-amber-800">Motivo: {existingAppeal.reason}</p>}
 </div>
 )}

 {/* Apelación resuelta */}
 {existingAppeal?.status === "approved" && (
 <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
 <p className="font-semibold">Revisión aprobada — workspace reabierto</p>
 <p className="text-xs mt-1">Por {existingAppeal.resolved_by_email || "N/D"}</p>
 </div>
 )}
 {existingAppeal?.status === "rejected" && (
 <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
 <p className="font-semibold">Revisión rechazada</p>
 {existingAppeal.resolution_notes && <p className="text-xs mt-1">Motivo: {existingAppeal.resolution_notes}</p>}
 </div>
 )}

 {/* BC-17: Badge de rechazo definitivo — no se permiten más apelaciones */}
 {feasibilityIsDefinitivelyRejected && (
 <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
 <p className="font-bold">❌ No factible — decisión definitiva</p>
 <p className="text-xs mt-1 text-red-700">
 La solicitud de revisión fue rechazada. El Business Case no puede ser apelado nuevamente.
 Los expedientes vinculados han sido cancelados.
 </p>
 </div>
 )}

 {/* Botón para comercial: solicitar revisión */}
 {canAppealFeasibilityRejection && !showAppealForm && (
 <button
 type="button"
 onClick={() => setShowAppealForm(true)}
 className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
 >
 <FiMessageSquare size={14} />
 Solicitar revisión de factibilidad
 </button>
 )}
 {canAppealFeasibilityRejection && showAppealForm && (
 <div className="space-y-2">
 <textarea
 className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
 rows={3}
 placeholder="Motivo de la solicitud de revisión..."
 value={appealReason}
 onChange={(e) => setAppealReason(e.target.value)}
 disabled={appealSaving}
 />
 <div className="flex gap-2">
 <button
 type="button"
 onClick={handleRequestAppeal}
 disabled={appealSaving}
 className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
 >
 {appealSaving ? "Enviando..." : "Enviar solicitud"}
 </button>
 <button
 type="button"
 onClick={() => { setShowAppealForm(false); setAppealReason(""); }}
 className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
 >
 Cancelar
 </button>
 </div>
 </div>
 )}

 {/* Botón para jefe_comercial/gerencia: resolver apelación */}
 {canResolveFeasibilityAppeal && existingAppeal?.status === "pending" && (
 <div className="space-y-2">
 <p className="text-xs text-slate-600">
 <span className="font-semibold">{existingAppeal.requested_by_email}</span> solicita revisión.{" "}
 Motivo: {existingAppeal.reason}
 </p>
 <textarea
 className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
 rows={2}
 placeholder="Notas de resolución (opcional)..."
 value={resolveAppealNotes}
 onChange={(e) => setResolveAppealNotes(e.target.value)}
 disabled={resolveAppealSaving}
 />
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => handleResolveAppeal(true)}
 disabled={resolveAppealSaving}
 className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
 >
 {resolveAppealSaving ? "Procesando..." : "Aprobar revisión"}
 </button>
 <button
 type="button"
 onClick={() => handleResolveAppeal(false)}
 disabled={resolveAppealSaving}
 className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
 >
 Rechazar apelación
 </button>
 </div>
 </div>
 )}
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
 Cierra el BC por informacion incorrecta, inconsistente o no viable.
 </p>
 </div>
 </div>
 </button>
 </div>

 {!isFeasible && (
 <div className="mt-5 space-y-2">
 <label className="text-sm font-medium text-gray-700">Alternativa o motivo de cierre</label>
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
 placeholder={isFeasible ? "Registra la conclusion comercial o financiera del Business Case" : "Motivo obligatorio del cierre no factible"}
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
 disabled={saving || (isFeasible && !hasExport)}
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
 Etapa actual: <span className="font-semibold text-gray-900">{displayStage}</span>
 {rawStage && rawStage !== displayStage && (
  <span className="ml-1 text-xs text-gray-400">(bc_stage: {rawStage})</span>
 )}
 </p>
 <p>
 Decision registrada: <span className="font-semibold text-gray-900">{decision?.decided_at ? "Si" : "No"}</span>
 </p>
 </div>
 </div>

 <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
 <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Regla operativa</p>
 <ul className="mt-3 space-y-2 text-sm text-gray-700">
 <li>1. Para aprobar como factible, el Sheet oficial debe estar sincronizado.</li>
 <li>2. ACP Comercial o Jefe Comercial pueden cerrar como no factible si detectan inconsistencias.</li>
 <li>3. Todo cierre no factible debe incluir motivo.</li>
 <li className="mt-1 text-xs text-emerald-700 font-medium">→ Si es factible: se habilita la seccion Cantidades Maximas para control operativo.</li>
 <li className="text-xs text-rose-700 font-medium">→ Si no es factible: se registra la alternativa (o el rechazo por falta de información) y el flujo continua en compras.</li>
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
