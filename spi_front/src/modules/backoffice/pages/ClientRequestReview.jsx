import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiRefreshCw, FiX } from "react-icons/fi";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../core/api";
import { useUI } from "../../../core/ui/useUI";
import { useApi } from "../../../core/hooks/useApi";
import {
 getClientRequestById,
 processClientRequest,
 updateClientRequestQualityChecklist,
} from "../../../core/api/requestsApi";
import Button from "../../../core/ui/components/Button";
import { useAuth } from "../../../core/auth/AuthContext";

const fieldLabels = {
 commercial_name: "Razón social",
 ruc_cedula: "RUC / Cédula",
 client_type: "Tipo de cliente",
 establishment_name: "Nombre del establecimiento",
 establishment_province: "Provincia de establecimiento",
 establishment_city: "Ciudad de establecimiento",
 establishment_address: "Dirección de establecimiento",
 establishment_reference: "Referencia de establecimiento",
 establishment_phone: "Teléfono del establecimiento",
 establishment_cellphone: "Celular del establecimiento",
 shipping_contact_name: "Contacto de entrega",
 shipping_address: "Dirección de entrega",
 shipping_city: "Ciudad de entrega",
 shipping_province: "Provincia de entrega",
 shipping_reference: "Referencia de entrega",
 shipping_phone: "Teléfono de entrega",
 shipping_cellphone: "Celular de entrega",
 client_email: "Correo del cliente",
 legal_rep_name: "Representante legal",
 legal_rep_position: "Cargo del representante",
 legal_rep_id_document: "Documento del representante",
 legal_rep_cellphone: "Celular del representante",
 legal_rep_email: "Correo del representante",
 operating_permit_status: "Permiso operativo",
 consent_capture_details: "Detalles del consentimiento",
 consent_recipient_email: "Correo receptor de consentimiento",
 consent_capture_method: "Método de consentimiento",
 lopdp_consent_method: "Método LOPDP",
 activity: "Actividad económica",
 nationality: "Nacionalidad",
 client_sector: "Sector del cliente",
 created_by: "Creado por",
 consent_history: "Historial de consentimiento",
};

const excludedFields = new Set([
 "payload",
 "data",
 "attachments",
 "created_at",
 "updated_at",
 "status",
 "client_id",
 "user_id",
 "id",
 "lopdp_token",
 "lopdp_consent_status",
 "drive_folder_id",
 "legal_rep_appointment_file_id",
 "ruc_file_id",
 "id_file_id",
 "consent_email_token_id",
 "approval_letter_file_id",
 "approval_status",
 "consent_history",
 "quality_checklist",
]);

const formatValue = (value) => {
 if (Array.isArray(value)) return value.join(", ");
 if (value === null || value === undefined) return "—";
 if (typeof value === "boolean") return value ? "Sí" : "No";
 if (typeof value === "object") return JSON.stringify(value, null, 0);
 return value.toString();
};

const ClientRequestReview = () => {
 const { id } = useParams();
 const navigate = useNavigate();
 const { showToast, showLoader, hideLoader } = useUI();
 const { user } = useAuth();
 const { data, loading, execute: fetchRequest } = useApi(getClientRequestById, {
 errorMsg: "No se pudo cargar la solicitud",
 transformResponse: (response) => response,
 });
 const [processing, setProcessing] = useState(null);
 const [checklistDraft, setChecklistDraft] = useState({});
 const [savingChecklistItem, setSavingChecklistItem] = useState(null);
 const fetchRequestRef = useRef(fetchRequest);

 useEffect(() => {
 fetchRequestRef.current = fetchRequest;
 }, [fetchRequest]);

 const refresh = () => fetchRequestRef.current(id);
 useEffect(() => {
 refresh();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [id]);

 useScopedAutoUpdate(
 DATA_UPDATE_SCOPES.CLIENT_REQUESTS,
 () => {
 refresh();
 },
 [id],
 );

 const requestDetail = data?.data || data?.result || data?.payload || data || {};
 const payload = requestDetail?.payload || requestDetail?.data || requestDetail;
 const attachments = Array.isArray(requestDetail.attachments) ? requestDetail.attachments : [];
 const qualityChecklist = requestDetail?.quality_checklist || { enabled: false, items: [], summary: {} };
 const normalizedRole = String(user?.role || "").toLowerCase();
 const canQualityReview = ["calidad", "jefe_calidad"].includes(normalizedRole);
 const canBackofficeProcess = normalizedRole === "backoffice_comercial";
 const isSubDistributor = String(requestDetail?.client_type || "").toLowerCase() === "sub_distribuidor";
 const qualitySummary = qualityChecklist?.summary || {};
 const approveBlockedByQuality = isSubDistributor && !qualitySummary.can_backoffice_approve;
 const approveBlockMessage = qualitySummary.has_inconsistent
 ? "Calidad marcó inconsistencias. Solo puedes rechazar."
 : "Falta validación completa de calidad para aprobar.";
 const normalizedFields = Object.entries(requestDetail)
 .filter(([key, value]) => !excludedFields.has(key) && value !== null && value !== undefined)
 .map(([key, value]) => ({ key, value }));

 useEffect(() => {
 const nextDraft = {};
 (qualityChecklist?.items || []).forEach((item) => {
 nextDraft[item.key] = {
 status: item.status || (item.required ? "pending" : "not_applicable"),
 notes: item.notes || "",
 };
 });
 setChecklistDraft(nextDraft);
 }, [requestDetail?.id, qualityChecklist?.items]);

 const handleProcess = async (action) => {
 let reason;
 if (action === "reject") {
 reason = window.prompt("Motivo del rechazo");
 if (reason === null) return;
 }

 setProcessing(action);
 showLoader(action === "approve" ? "Aprobando solicitud de cliente..." : "Rechazando solicitud de cliente...");
 try {
 await processClientRequest(id, action, reason);
 showToast(action === "approve" ? "Solicitud aprobada" : "Solicitud rechazada", "success");
 navigate("/dashboard/backoffice/client-requests");
 } catch (error) {
 console.error(error);
 showToast("No se pudo procesar la solicitud", "error");
 } finally {
 hideLoader();
 setProcessing(null);
 }
 };

 const handleChecklistDraftChange = (itemKey, patch) => {
 setChecklistDraft((prev) => ({
 ...prev,
 [itemKey]: {
 ...(prev[itemKey] || {}),
 ...patch,
 },
 }));
 };

 const handleSaveChecklistItem = async (item) => {
 if (!canQualityReview) return;
 const draft = checklistDraft[item.key] || {};
 const nextStatus = draft.status || (item.required ? "pending" : "not_applicable");
 setSavingChecklistItem(item.key);
 showLoader("Guardando revisión de calidad...");
 try {
 await updateClientRequestQualityChecklist(id, {
 item_key: item.key,
 status: nextStatus,
 notes: draft.notes || "",
 });
 showToast("Checklist actualizado.", "success");
 await refresh();
 } catch (error) {
 console.error(error);
 showToast(
 error?.response?.data?.message || "No se pudo actualizar el checklist",
 "error",
 );
 } finally {
 hideLoader();
 setSavingChecklistItem(null);
 }
 };

 const Field = ({ label, children }) => (
 <div className="flex flex-col gap-1">
 <p className="text-xs font-semibold text-gray-500">{label}</p>
 <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2 break-words">{children || "—"}</p>
 </div>
 );

 const renderContact = () => (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Field label="Contacto">
 {requestDetail.shipping_contact_name ||
 payload.contact_name ||
 payload.contact_person ||
 "—"}
 </Field>
 <Field label="Correo">
 {requestDetail.shipping_email ||
 requestDetail.client_email ||
 payload.contact_email ||
 payload.client_email ||
 "—"}
 </Field>
 <Field label="Teléfono">
 {requestDetail.shipping_phone || payload.contact_phone || payload.phone || "—"}
 </Field>
 <Field label="Dirección">
 {requestDetail.shipping_address ||
 requestDetail.establishment_address ||
 payload.address ||
 payload.direccion ||
 payload.client_address ||
 "—"}
 </Field>
 </div>
 );

 const renderBusinessData = () => (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Field label="Cliente">{requestDetail.commercial_name || payload.client_name || "—"}</Field>
 <Field label="RUC/Cédula">{requestDetail.ruc_cedula || payload.ruc || payload.cedula || "—"}</Field>
 <Field label="Tipo de cliente">{requestDetail.client_type || payload.client_type || "—"}</Field>
 <Field label="Provincia">
 {requestDetail.establishment_province || payload.province || payload.provincia || "—"}
 </Field>
 <Field label="Ciudad">
 {requestDetail.establishment_city || payload.city || payload.ciudad || "—"}
 </Field>
 <Field label="Actividad">
 {requestDetail.activity || payload.activity || payload.giro_negocio || "—"}
 </Field>
 </div>
 );

 const renderAttachments = () => {
 if (!attachments.length) return null;

 return (
 <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 shadow-sm">
 <h2 className="text-lg font-semibold text-gray-900">Documentos adjuntos</h2>
 <div className="space-y-2">
 {attachments.map((attachment) => (
 <a
 key={attachment.file_id || attachment.key || attachment.label}
 href={attachment.link}
 target="_blank"
 rel="noreferrer"
 className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:border-blue-200 hover:bg-white transition"
 >
 <span>{attachment.label || attachment.key}</span>
 <span className="text-xs text-blue-600">Ver</span>
 </a>
 ))}
 </div>
 </div>
 );
 };

 const qualityStatusStyles = {
 pending: "bg-amber-100 text-amber-800",
 valid: "bg-emerald-100 text-emerald-800",
 inconsistent: "bg-rose-100 text-rose-800",
 not_applicable: "bg-slate-100 text-slate-700",
 };

 const renderQualityChecklist = () => {
 if (!isSubDistributor || !qualityChecklist?.enabled) return null;

 const checklistItems = Array.isArray(qualityChecklist.items) ? qualityChecklist.items : [];
 return (
 <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
 <h2 className="text-lg font-semibold text-gray-900">Checklist de validación (Calidad)</h2>
 <p className="text-sm text-gray-600">
 Backoffice solo podrá aprobar cuando calidad haya validado todos los ítems obligatorios y no existan inconsistencias.
 </p>
 <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
 Obligatorios validados: {qualitySummary.required_reviewed || 0}/{qualitySummary.required_total || 0}
 {" · "}Pendientes: {qualitySummary.required_pending || 0}
 {" · "}Inconsistencias: {qualitySummary.has_inconsistent ? "Sí" : "No"}
 </div>
 <div className="space-y-3">
 {checklistItems.map((item) => {
 const draft = checklistDraft[item.key] || {};
 const currentStatus = draft.status || item.status || (item.required ? "pending" : "not_applicable");
 const availableStatuses = item.required
 ? ["pending", "valid", "inconsistent"]
 : ["not_applicable", "pending", "valid", "inconsistent"];
 return (
 <div key={item.key} className="rounded-xl border border-gray-100 p-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div>
 <p className="text-sm font-semibold text-gray-900">{item.label}</p>
 <p className="text-xs text-gray-500">
 {item.required ? "Obligatorio" : "Opcional"}
 {item.evidence_file_id && (
 <>
 {" · "}
 <a
 href={item.evidence_link}
 target="_blank"
 rel="noreferrer"
 className="text-blue-600 hover:underline"
 >
 Ver documento
 </a>
 </>
 )}
 {!item.evidence_file_id && item.evidence_value ? ` · ${item.evidence_value}` : ""}
 </p>
 </div>
 <span className={`px-2 py-1 rounded-full text-xs font-semibold ${qualityStatusStyles[item.status] || "bg-gray-100 text-gray-700"}`}>
 {String(item.status || "pending").replace(/_/g, " ")}
 </span>
 </div>

 <div className="mt-3 grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_auto] gap-2">
 <select
 value={currentStatus}
 disabled={!canQualityReview}
 onChange={(e) => handleChecklistDraftChange(item.key, { status: e.target.value })}
 className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
 >
 {availableStatuses.map((status) => (
 <option key={status} value={status}>
 {status.replace(/_/g, " ")}
 </option>
 ))}
 </select>
 <input
 type="text"
 value={draft.notes || ""}
 disabled={!canQualityReview}
 onChange={(e) => handleChecklistDraftChange(item.key, { notes: e.target.value })}
 placeholder="Notas de validación"
 className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 {canQualityReview && (
 <Button
 variant="secondary"
 loading={savingChecklistItem === item.key}
 onClick={() => handleSaveChecklistItem(item)}
 >
 Guardar
 </Button>
 )}
 </div>
 {item.validated_at && (
 <p className="mt-2 text-[11px] text-gray-500">
 Última validación: {new Date(item.validated_at).toLocaleString()} por {item.validated_by_email || "calidad"}
 </p>
 )}
 </div>
 );
 })}
 </div>
 </section>
 );
 };

 return (
 <div className="p-6 space-y-6">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center gap-2">
 <button
 onClick={() => navigate(-1)}
 className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2"
 >
 <FiArrowLeft /> Volver
 </button>
 <h1 className="text-2xl font-bold text-gray-900">Revisión de solicitud #{id}</h1>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={refresh}
 disabled={loading}
 className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
 >
 <FiRefreshCw className={loading ? "animate-spin" : ""} />
 Actualizar
 </button>
 {canBackofficeProcess && (
 <>
 <Button
 variant="success"
 leftIcon={<FiCheck />}
 loading={processing === "approve"}
 disabled={approveBlockedByQuality}
 onClick={() => handleProcess("approve")}
 title={approveBlockedByQuality ? approveBlockMessage : "Aprobar"}
 >
 Aprobar
 </Button>
 <Button
 variant="danger"
 leftIcon={<FiX />}
 loading={processing === "reject"}
 onClick={() => handleProcess("reject")}
 >
 Rechazar
 </Button>
 </>
 )}
 </div>
 </div>

 {canBackofficeProcess && approveBlockedByQuality && (
 <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
 {approveBlockMessage}
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <div className="lg:col-span-2 space-y-4">
 <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
 <h2 className="text-lg font-semibold text-gray-900">Datos del cliente</h2>
 {renderBusinessData()}
 </section>
 <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
 <h2 className="text-lg font-semibold text-gray-900">Contacto y ubicación</h2>
 {renderContact()}
 </section>
 <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
 <h2 className="text-lg font-semibold text-gray-900">Información adicional</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Field label="Estado">{requestDetail.status || requestDetail.approval_status || "—"}</Field>
 <Field label="Creado por">{requestDetail.created_by || payload.created_by || "—"}</Field>
 <Field label="Creado el">
 {requestDetail.created_at ? new Date(requestDetail.created_at).toLocaleString() : "—"}
 </Field>
 <Field label="Notas">{payload.notes || payload.observaciones || "—"}</Field>
 </div>
 </section>
 {renderQualityChecklist()}
 </div>
 <div className="space-y-4">
 <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
 <h2 className="text-lg font-semibold text-gray-900">Resumen</h2>
 <div className="space-y-2 text-sm text-gray-800">
 <div className="flex justify-between">
 <span className="text-gray-500">Solicitante</span>
 <span>{requestDetail.created_by || payload.created_by || "—"}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-500">Estado</span>
 <span className="uppercase text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
 {(requestDetail.status || "pendiente").replace(/_/g, " ")}
 </span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-500">Documento</span>
 <span>{requestDetail.ruc_cedula || payload.ruc || payload.cedula || "—"}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-500">Nombre</span>
 <span>{requestDetail.commercial_name || payload.client_name || "—"}</span>
 </div>
 </div>
 </section>
 {renderAttachments()}
 </div>
 </div>

 <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
 <h2 className="text-lg font-semibold text-gray-900">Todos los campos registrados</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {normalizedFields.map(({ key, value }) => (
 <div
 key={key}
 className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm leading-snug text-gray-800"
 >
 <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
 {fieldLabels[key] || key.replace(/_/g, " ")}
 </p>
 <p className="mt-1 break-words">{formatValue(value)}</p>
 </div>
 ))}
 </div>
 </section>
 </div>
 );
};

export default ClientRequestReview;
