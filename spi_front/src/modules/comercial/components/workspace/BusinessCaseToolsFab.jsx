import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiBox, FiCalendar, FiCheck, FiExternalLink, FiFileText, FiSearch, FiTool, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import api from "../../../../core/api";
import { useAuth } from "../../../../core/auth/AuthContext";
import { useUI } from "../../../../core/ui/UIContext";
import Modal from "../../../../core/ui/components/Modal";
import { useBusinessCaseWorkspace } from "./BusinessCaseWorkspaceContext";
import {
 getEquipmentAssets,
 getActiveAssetReservation,
 releaseAssetReservation,
 renewAssetReservation,
 reserveEquipmentAsset,
} from "../../../../core/api/equipmentManagementApi";
import { createRequest } from "../../../../core/api/requestsApi";
import {
 getDeterminationsStatDocumentInfo,
 requestBusinessCaseEnvironmentInspection,
} from "../../../../core/api/businessCaseApi";

// Roles replicados de los gates del backend (privados a sus respectivos
// archivos, no exportables) — el backend re-valida igual, esto solo evita
// mostrar botones que van a fallar.
const AVAILABILITY_REQUEST_ROLES = new Set(["comercial", "jefe_comercial", "backoffice_comercial"]);
// Replica ASSET_ROLES de equipmentManagement.routes.js -- reservar/renovar/
// liberar inventario fisico es una accion operativa (acp/backoffice/tecnico/
// logistica), no algo que comercial/jefe_comercial puedan hacer directamente.
const ASSET_MANAGEMENT_ROLES = new Set([
 "backoffice_comercial", "acp_comercial", "servicio_tecnico", "tecnico",
 "jefe_tecnico", "jefe_servicio", "jefe_servicio_tecnico", "operaciones",
 "jefe_operaciones", "logistica", "jefe_logistica", "gerencia",
 "gerencia_general", "ti", "admin_ti", "admin",
]);
// OJO: esto NO es lo mismo que INSPECTION_REQUEST_ROLES del controller (esa
// gatea el endpoint POST inspection-request en si). Este set replica
// DETERMINATIONS_INSPECTION_REQUEST_ROLES de businessCaseDeterminationsGate.service.js,
// que es lo que gateInfo.permissions.canRequestInspection realmente calcula y
// lo que la UI original de Determinaciones usaba para MOSTRAR el boton --
// mas amplio (incluye jefe_comercial/acp_comercial). Usar el otro set aqui
// oculta el boton a roles que la UI original si mostraba.
const INSPECTION_REQUEST_ROLES = new Set(["comercial", "jefe_comercial", "acp_comercial", "backoffice_comercial"]);

const EMPTY_INSPECTION_FORM = {
 minDate: "",
 maxDate: "",
 contactName: "",
 contactPhone: "",
 accessories: "",
 annotations: "",
 observations: "",
};

export default function BusinessCaseToolsFab() {
 const { bcId, businessCase } = useBusinessCaseWorkspace();
 const { user } = useAuth();
 const { showToast } = useUI();
 const navigate = useNavigate();
 const role = String(user?.role || "").trim().toLowerCase();

 const canRequestAvailability = AVAILABILITY_REQUEST_ROLES.has(role);
 const canRequestInspection = INSPECTION_REQUEST_ROLES.has(role);
 const canManageReservations = ASSET_MANAGEMENT_ROLES.has(role);

 const [expanded, setExpanded] = useState(false);
 const [activeTool, setActiveTool] = useState(null); // null | "availability" | "inspection"
 const dockRef = useRef(null);

 useEffect(() => {
 if (!expanded) return undefined;
 const handleOutside = (e) => {
 if (dockRef.current && !dockRef.current.contains(e.target)) setExpanded(false);
 };
 document.addEventListener("mousedown", handleOutside);
 return () => document.removeEventListener("mousedown", handleOutside);
 }, [expanded]);

 // Equipos del BC — misma fuente que DeterminationsSection/EquipmentSection
 // (businessCase.extra.equipment_details), resueltos a {id, name} de forma
 // liviana (solo el nombre, sin determinaciones/consumibles).
 const [equipmentOptions, setEquipmentOptions] = useState([]);
 const [loadingEquipment, setLoadingEquipment] = useState(false);
 const loadEquipmentOptions = useCallback(async () => {
 const pairs = businessCase?.extra?.equipment_details;
 if (!Array.isArray(pairs) || !pairs.length) {
 setEquipmentOptions([]);
 return;
 }
 const ids = Array.from(new Set(pairs.map((pair) => pair?.primary_id).filter(Boolean)));
 setLoadingEquipment(true);
 try {
 const resolved = await Promise.all(
 ids.map(async (id) => {
 try {
 const res = await api.get(`/equipment-catalog/${id}`);
 const name = res.data?.data?.equipment_name || res.data?.data?.name || `Equipo ${id}`;
 return { id, name };
 } catch {
 return { id, name: `Equipo ${id}` };
 }
 }),
 );
 setEquipmentOptions(resolved);
 } finally {
 setLoadingEquipment(false);
 }
 }, [businessCase?.extra?.equipment_details]);

 // --- Herramienta 1: Disponibilidad de equipo ---
 const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
 const [availabilityResult, setAvailabilityResult] = useState(null);
 const [checkingAvailability, setCheckingAvailability] = useState(false);
 const [requestingAvailability, setRequestingAvailability] = useState(false);
 const [availabilityNotes, setAvailabilityNotes] = useState("");
 const [activeReservations, setActiveReservations] = useState([]);
 const [loadingReservations, setLoadingReservations] = useState(false);
 const [reservingAssetId, setReservingAssetId] = useState(null);
 const [busyReservationId, setBusyReservationId] = useState(null);

 const loadActiveReservations = useCallback(async () => {
 if (!bcId) return;
 setLoadingReservations(true);
 try {
 const list = await getActiveAssetReservation(bcId);
 setActiveReservations(Array.isArray(list) ? list : []);
 } catch {
 setActiveReservations([]);
 } finally {
 setLoadingReservations(false);
 }
 }, [bcId]);

 const openAvailabilityTool = () => {
 setExpanded(false);
 setActiveTool("availability");
 setAvailabilityResult(null);
 setAvailabilityNotes("");
 loadEquipmentOptions();
 loadActiveReservations();
 };

 const handleCheckAvailability = async () => {
 if (!selectedEquipmentId || checkingAvailability) return;
 setCheckingAvailability(true);
 setAvailabilityResult(null);
 try {
 const assets = await getEquipmentAssets({ servicio_equipo_id: selectedEquipmentId, availability: "available" });
 const list = Array.isArray(assets) ? assets : assets?.items || [];
 setAvailabilityResult({ list, error: null });
 } catch (err) {
 setAvailabilityResult({ list: null, error: err?.response?.data?.message || "No se pudo consultar" });
 } finally {
 setCheckingAvailability(false);
 }
 };

 const handleReserveAsset = async (assetId) => {
 if (!bcId || reservingAssetId) return;
 setReservingAssetId(assetId);
 try {
 await reserveEquipmentAsset(assetId, {
 source_module: "business_case",
 business_case_id: bcId,
 reserved_for_client_id: businessCase?.client_id || undefined,
 notes: availabilityNotes || undefined,
 });
 showToast("Equipo reservado para este Business Case por 1 mes.", "success");
 await Promise.all([loadActiveReservations(), handleCheckAvailability()]);
 } catch (err) {
 showToast(err?.response?.data?.message || "No se pudo reservar el equipo.", "error");
 } finally {
 setReservingAssetId(null);
 }
 };

 const handleRenewReservation = async (reservationId) => {
 if (!bcId || busyReservationId) return;
 setBusyReservationId(reservationId);
 try {
 await renewAssetReservation(reservationId, bcId);
 showToast("Reserva renovada 1 mes mas.", "success");
 await loadActiveReservations();
 } catch (err) {
 showToast(err?.response?.data?.message || "No se pudo renovar la reserva.", "error");
 } finally {
 setBusyReservationId(null);
 }
 };

 const handleReleaseReservation = async (reservationId) => {
 if (!bcId || busyReservationId) return;
 if (!window.confirm("¿Liberar esta reserva? El equipo quedara disponible para otros Business Case.")) return;
 setBusyReservationId(reservationId);
 try {
 await releaseAssetReservation(reservationId, bcId);
 showToast("Reserva liberada.", "success");
 await Promise.all([loadActiveReservations(), handleCheckAvailability()]);
 } catch (err) {
 showToast(err?.response?.data?.message || "No se pudo liberar la reserva.", "error");
 } finally {
 setBusyReservationId(null);
 }
 };

 const openPurchasesWorkspace = () => {
 const tab = businessCase?.bc_purchase_type === "comodato_publico" ? "public" : "private";
 navigate(`/dashboard/purchases/workspace?tab=${tab}`);
 };

 const handleRequestAvailability = async () => {
 if (!selectedEquipmentId || requestingAvailability) return;
 const equipmentName = equipmentOptions.find((eq) => String(eq.id) === String(selectedEquipmentId))?.name || "";
 setRequestingAvailability(true);
 try {
 await createRequest({
 request_type_id: "F.ST-23",
 payload: {
 business_case_id: bcId,
 servicio_equipo_id: selectedEquipmentId,
 equipment_name: equipmentName,
 notes: availabilityNotes || undefined,
 },
 });
 showToast("Solicitud de disponibilidad enviada a ACP Comercial.", "success");
 setAvailabilityNotes("");
 } catch (err) {
 showToast(err?.response?.data?.message || "No se pudo enviar la solicitud.", "error");
 } finally {
 setRequestingAvailability(false);
 }
 };

 // --- Herramienta 2: Inspeccion de ambiente ---
 const [gateInfo, setGateInfo] = useState(null);
 const [gateLoading, setGateLoading] = useState(false);
 const [inspectionForm, setInspectionForm] = useState(EMPTY_INSPECTION_FORM);
 const [submittingInspection, setSubmittingInspection] = useState(false);

 const loadGateInfo = useCallback(async () => {
 if (!bcId) return;
 setGateLoading(true);
 try {
 const data = await getDeterminationsStatDocumentInfo(bcId);
 setGateInfo(data || null);
 } catch {
 setGateInfo(null);
 } finally {
 setGateLoading(false);
 }
 }, [bcId]);

 const openInspectionTool = () => {
 setExpanded(false);
 setActiveTool("inspection");
 setInspectionForm(EMPTY_INSPECTION_FORM);
 loadEquipmentOptions();
 loadGateInfo();
 };

 const inspectionRequestInfo = gateInfo?.inspectionRequest || null;
 const documentUploaded = gateInfo?.documentUploaded === true;
 const canSubmitInspection =
 (canRequestInspection || gateInfo?.permissions?.canRequestInspection) &&
 documentUploaded &&
 !inspectionRequestInfo?.request_id;

 const handleSubmitInspection = async () => {
 if (!bcId) return;
 const minDate = String(inspectionForm.minDate || "").trim();
 const maxDate = String(inspectionForm.maxDate || "").trim();
 if (!minDate || !maxDate) {
 showToast("Debes registrar el rango minimo y maximo de instalacion.", "warning");
 return;
 }
 if (minDate > maxDate) {
 showToast("La fecha minima no puede ser mayor que la fecha maxima.", "warning");
 return;
 }
 try {
 setSubmittingInspection(true);
 await requestBusinessCaseEnvironmentInspection(bcId, {
 inspection_min_date: minDate,
 inspection_max_date: maxDate,
 persona_contacto: inspectionForm.contactName || undefined,
 celular_contacto: inspectionForm.contactPhone || undefined,
 accesorios: inspectionForm.accessories || undefined,
 anotaciones: inspectionForm.annotations || undefined,
 observaciones: inspectionForm.observations || undefined,
 });
 showToast("Solicitud de inspeccion de ambiente enviada correctamente.", "success");
 setInspectionForm(EMPTY_INSPECTION_FORM);
 await loadGateInfo();
 } catch (err) {
 showToast(err?.response?.data?.message || "No se pudo solicitar la inspeccion de ambiente.", "error");
 } finally {
 setSubmittingInspection(false);
 }
 };

 const closeTool = () => {
 if (requestingAvailability || submittingInspection) return;
 setActiveTool(null);
 };

 const canOpenAvailabilityTool = canRequestAvailability || canManageReservations;

 if (!canOpenAvailabilityTool && !canRequestInspection) return null;

 return (
 <>
 {/* Toggle + speed-dial: oculto mientras hay una herramienta abierta para
     no flotar por encima del modal de esa herramienta. */}
 {/* right-4 en bottom-6/24 ya lo ocupan NotificationBell (z-90) y
     AttendanceWidget (z-49, "asistencia") -- este FAB va un nivel arriba
     de ambos, mismo patron responsive que AttendanceWidget. */}
 {!activeTool && (
 <div ref={dockRef} className="fixed bottom-[13rem] right-4 z-[45] sm:bottom-[14rem] sm:right-6 md:bottom-[9.5rem]">
 <div
 className={`absolute bottom-14 right-0 flex flex-col items-end gap-3 transition-all duration-200 ${
 expanded ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"
 }`}
 >
 {canRequestInspection && (
 <div className="flex items-center gap-2.5">
 <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-sm whitespace-nowrap">
 Inspeccion de ambiente
 </span>
 <button
 type="button"
 onClick={openInspectionTool}
 className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg active:scale-95 transition-transform"
 aria-label="Inspeccion de ambiente"
 >
 <FiFileText size={18} />
 </button>
 </div>
 )}
 {canOpenAvailabilityTool && (
 <div className="flex items-center gap-2.5">
 <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-sm whitespace-nowrap">
 Disponibilidad de equipo
 </span>
 <button
 type="button"
 onClick={openAvailabilityTool}
 className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg active:scale-95 transition-transform"
 aria-label="Disponibilidad de equipo"
 >
 <FiBox size={18} />
 </button>
 </div>
 )}
 </div>

 <button
 type="button"
 onClick={() => setExpanded((e) => !e)}
 className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-white shadow-[0_8px_24px_rgba(15,23,42,0.25)] transition-transform active:scale-95"
 aria-label={expanded ? "Cerrar herramientas" : "Herramientas del Business Case"}
 title="Herramientas del Business Case"
 >
 {expanded ? <FiX size={20} /> : <FiTool size={20} />}
 </button>
 </div>
 )}

 {/* Herramienta: Disponibilidad de equipo */}
 <Modal open={activeTool === "availability"} onClose={closeTool} title="Disponibilidad de equipo" maxWidth="max-w-lg">
 <div className="space-y-4">
 {loadingReservations ? (
 <p className="text-xs text-slate-500">Cargando reservas activas...</p>
 ) : activeReservations.length > 0 && (
 <div className="space-y-2">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reservado para este Business Case</p>
 {activeReservations.map((res) => {
 const expired = res.expires_at && new Date(res.expires_at) < new Date();
 const canRenew = canManageReservations && !expired && res.renewal_count < res.max_renewals;
 return (
 <div key={res.id} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 space-y-1.5">
 <div className="font-semibold">{res.equipment_name} — {res.serial_number || res.internal_code || res.asset_tag || `#${res.asset_id}`}</div>
 <div>Vence: {res.expires_at ? new Date(res.expires_at).toLocaleDateString() : "sin fecha"} · Renovaciones: {res.renewal_count}/{res.max_renewals}</div>
 {canManageReservations && (
 <div className="flex gap-2 pt-1">
 <button
 type="button"
 onClick={() => handleRenewReservation(res.id)}
 disabled={!canRenew || busyReservationId === res.id}
 className="inline-flex items-center gap-1 rounded-md bg-sky-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
 >
 Renovar 1 mes
 </button>
 <button
 type="button"
 onClick={() => handleReleaseReservation(res.id)}
 disabled={busyReservationId === res.id}
 className="inline-flex items-center gap-1 rounded-md border border-sky-300 px-2 py-1 text-[11px] font-semibold text-sky-800 disabled:opacity-40"
 >
 Liberar
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}

 <label className="space-y-1.5 block">
 <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipo</span>
 <select
 value={selectedEquipmentId}
 onChange={(e) => { setSelectedEquipmentId(e.target.value); setAvailabilityResult(null); }}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 disabled={loadingEquipment}
 >
 <option value="">{loadingEquipment ? "Cargando equipos..." : "Selecciona un equipo"}</option>
 {equipmentOptions.map((eq) => (
 <option key={eq.id} value={eq.id}>{eq.name}</option>
 ))}
 </select>
 </label>

 <button
 type="button"
 onClick={handleCheckAvailability}
 disabled={!selectedEquipmentId || checkingAvailability}
 className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
 >
 <FiSearch size={14} />
 {checkingAvailability ? "Consultando..." : "Consultar disponibilidad"}
 </button>

 {availabilityResult && (
 availabilityResult.error ? (
 <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
 {availabilityResult.error}
 </div>
 ) : availabilityResult.list.length === 0 ? (
 <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-2">
 <p>No hay unidades disponibles en inventario interno.</p>
 <button
 type="button"
 onClick={openPurchasesWorkspace}
 className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
 >
 <FiExternalLink size={12} />
 Ver Workspace de Compras para {businessCase?.client_name || "este cliente"}
 </button>
 </div>
 ) : (
 <div className="space-y-1.5">
 {availabilityResult.list.map((asset) => (
 <div key={asset.id} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
 <span>{asset.serial_number || asset.internal_code || asset.asset_tag || `#${asset.id}`}</span>
 {canManageReservations && (
 <button
 type="button"
 onClick={() => handleReserveAsset(asset.id)}
 disabled={reservingAssetId === asset.id}
 className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
 >
 {reservingAssetId === asset.id ? "Reservando..." : "Reservar"}
 </button>
 )}
 </div>
 ))}
 </div>
 )
 )}

 <div className="border-t border-slate-200 pt-4 space-y-3">
 <p className="text-xs text-slate-600">
 Si necesitas confirmar disponibilidad o pedir que se reserve, envia una solicitud formal a ACP Comercial.
 </p>
 <label className="space-y-1.5 block">
 <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notas (opcional)</span>
 <textarea
 rows={2}
 value={availabilityNotes}
 onChange={(e) => setAvailabilityNotes(e.target.value)}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
 placeholder="Contexto adicional para ACP Comercial..."
 />
 </label>
 <button
 type="button"
 onClick={handleRequestAvailability}
 disabled={!selectedEquipmentId || requestingAvailability}
 className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
 >
 <FiCheck size={14} />
 {requestingAvailability ? "Enviando..." : "Solicitar a ACP Comercial"}
 </button>
 </div>
 </div>
 </Modal>

 {/* Herramienta: Inspeccion de ambiente */}
 <Modal open={activeTool === "inspection"} onClose={closeTool} title="Inspeccion de ambiente por costos" maxWidth="max-w-xl">
 <div className="space-y-5">
 {gateLoading ? (
 <p className="text-sm text-slate-500">Cargando estado de la inspeccion...</p>
 ) : !documentUploaded ? (
 <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
 Debes subir primero el documento estadistico en la pestaña Determinaciones antes de poder solicitar la inspeccion de ambiente.
 </div>
 ) : inspectionRequestInfo?.request_id ? (
 <div className="space-y-3 text-sm text-slate-700">
 <div className="flex items-center justify-between">
 <span className="font-semibold">Solicitud #{inspectionRequestInfo.request_id}</span>
 <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
 inspectionRequestInfo?.status === "approved"
 ? "bg-emerald-100 text-emerald-700"
 : inspectionRequestInfo?.status === "rejected"
 ? "bg-rose-100 text-rose-700"
 : "bg-sky-100 text-sky-700"
 }`}>
 {inspectionRequestInfo?.status === "approved" ? "Aprobada" : inspectionRequestInfo?.status === "rejected" ? "Rechazada" : "Solicitada"}
 </span>
 </div>
 <div className="text-xs text-slate-600">
 Rango registrado: {inspectionRequestInfo?.inspection_min_date || "Pendiente"} a {inspectionRequestInfo?.inspection_max_date || "Pendiente"}
 </div>
 {inspectionRequestInfo?.acta_document_link && (
 <a
 href={inspectionRequestInfo.acta_document_link}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center gap-2 text-blue-700 hover:underline text-xs"
 >
 <FiFileText size={13} />
 Ver F.ST-20 por costos
 </a>
 )}
 {inspectionRequestInfo?.status === "rejected" && inspectionRequestInfo?.rejection_reason && (
 <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
 Motivo del rechazo: {inspectionRequestInfo.rejection_reason}
 </div>
 )}
 </div>
 ) : (
 <>
 <p className="text-xs text-slate-600">
 Registra el rango estimado para la inspeccion de ambiente por costos o factibilidad. El sistema llenara el F.ST-20 con la informacion ya guardada en el Business Case.
 </p>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha minima <span className="text-rose-600">*</span></span>
 <input
 type="date"
 value={inspectionForm.minDate}
 onChange={(e) => setInspectionForm((prev) => ({ ...prev, minDate: e.target.value }))}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 />
 </label>
 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha maxima <span className="text-rose-600">*</span></span>
 <input
 type="date"
 value={inspectionForm.maxDate}
 min={inspectionForm.minDate || undefined}
 onChange={(e) => setInspectionForm((prev) => ({ ...prev, maxDate: e.target.value }))}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 />
 </label>
 </div>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Persona de contacto</span>
 <input
 type="text"
 value={inspectionForm.contactName}
 onChange={(e) => setInspectionForm((prev) => ({ ...prev, contactName: e.target.value }))}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 placeholder="Nombre del contacto"
 />
 </label>
 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Celular de contacto</span>
 <input
 type="text"
 value={inspectionForm.contactPhone}
 onChange={(e) => setInspectionForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 placeholder="+593 9xx xxx xxxx"
 />
 </label>
 </div>
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
 <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Equipos del Business Case</p>
 {loadingEquipment
 ? "Cargando..."
 : equipmentOptions.length
 ? equipmentOptions.map((eq) => eq.name).join(", ")
 : "Pendiente — configura equipos en la seccion de equipos del BC"}
 </div>
 <label className="space-y-1.5 block">
 <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accesorios</span>
 <input
 type="text"
 value={inspectionForm.accessories}
 onChange={(e) => setInspectionForm((prev) => ({ ...prev, accessories: e.target.value }))}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 placeholder="Ej: mangueras, adaptadores..."
 />
 </label>
 <label className="space-y-1.5 block">
 <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anotaciones</span>
 <textarea
 rows={2}
 value={inspectionForm.annotations}
 onChange={(e) => setInspectionForm((prev) => ({ ...prev, annotations: e.target.value }))}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
 />
 </label>
 <label className="space-y-1.5 block">
 <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</span>
 <textarea
 rows={3}
 value={inspectionForm.observations}
 onChange={(e) => setInspectionForm((prev) => ({ ...prev, observations: e.target.value }))}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
 />
 </label>
 <button
 type="button"
 onClick={handleSubmitInspection}
 disabled={!canSubmitInspection || submittingInspection}
 className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
 >
 <FiCalendar size={14} />
 {submittingInspection ? "Enviando..." : "Enviar solicitud"}
 </button>
 </>
 )}
 </div>
 </Modal>
 </>
 );
}
