import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiCheck, FiEye, FiFileText, FiRefreshCw, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import {
 processClientRequest,
 getClientRequests,
 getClientRequestById,
} from "../../../core/api/requestsApi";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../core/api";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";

const ClientApprovalsWidget = () => {
 const navigate = useNavigate();
 const { showToast } = useUI();
 const [processingId, setProcessingId] = useState(null);
 const [requests, setRequests] = useState([]);
 const [approvedRequests, setApprovedRequests] = useState([]);
 const [approvedDetails, setApprovedDetails] = useState({});
 const [pendingDetails, setPendingDetails] = useState({});
 const [loading, setLoading] = useState(false);
 const [loadingApproved, setLoadingApproved] = useState(false);
 const [rejectContext, setRejectContext] = useState({
 open: false,
 request: null,
 reason: "",
 });

 const loadRequests = useCallback(async ({ silent = false } = {}) => {
 if (!silent) setLoading(true);
 try {
 const data = await getClientRequests({ page: 1, pageSize: 4, status: "pending_approval" });
 const rows = data.rows || data || [];
 setRequests(rows);
 const details = await Promise.all(
 rows.map((req) => getClientRequestById(req.id).catch(() => null))
 );
 const detailMap = {};
 details.forEach((detail, index) => {
 if (detail) detailMap[rows[index]?.id] = detail;
 });
 setPendingDetails(detailMap);
 } catch (error) {
 console.error(error);
 showToast("No pudimos cargar las solicitudes pendientes", "error");
 } finally {
 if (!silent) setLoading(false);
 }
 }, [showToast]);

 const loadApprovedRequests = useCallback(async ({ silent = false } = {}) => {
 if (!silent) setLoadingApproved(true);
 try {
 const data = await getClientRequests({ page: 1, pageSize: 4, status: "approved" });
 const rows = data.rows || data || [];
 setApprovedRequests(rows);

 const details = await Promise.all(
 rows.map((req) => getClientRequestById(req.id).catch(() => null))
 );
 const detailMap = {};
 details.forEach((detail, index) => {
 if (detail) {
 detailMap[rows[index]?.id] = detail;
 }
 });
 setApprovedDetails(detailMap);
 } catch (error) {
 console.error(error);
 showToast("No pudimos cargar los clientes aprobados", "error");
 } finally {
 if (!silent) setLoadingApproved(false);
 }
 }, [showToast]);

 const refreshAll = useCallback(async () => {
 await Promise.all([loadRequests(), loadApprovedRequests()]);
 }, [loadRequests, loadApprovedRequests]);

 const handleProcess = useCallback(
 async (id, action, rejectionReason) => {
 setProcessingId(`${action}-${id}`);
 try {
 await processClientRequest(
 id,
 action,
 action === "reject" ? rejectionReason : undefined
 );
 showToast(
 action === "approve" ? "Solicitud aprobada" : "Solicitud rechazada",
 "success"
 );
 await refreshAll();
 } catch (error) {
 console.error(error);
 showToast("No se pudo procesar la solicitud", "error");
 } finally {
 setProcessingId(null);
 }
 },
 [refreshAll, showToast],
 );

 const loadedRef = useRef(false);
 useEffect(() => {
 if (loadedRef.current) return;
 loadedRef.current = true;
 refreshAll();
 }, [refreshAll]);

 useScopedAutoUpdate(
 DATA_UPDATE_SCOPES.CLIENT_REQUESTS,
 () => {
 loadRequests({ silent: true });
 loadApprovedRequests({ silent: true });
 },
 [loadRequests, loadApprovedRequests],
 );

 const approvedCount = approvedRequests.length;

 const documentLabels = [
 { key: "id_file_id", label: "Cédula/ID" },
 { key: "ruc_file_id", label: "RUC" },
 { key: "legal_rep_appointment_file_id", label: "Nombramiento" },
 { key: "bpadt_certification_file_id", label: "Certificación BPADT" },
 { key: "operating_permit_file_id", label: "Permiso operación" },
 { key: "consent_evidence_file_id", label: "Consentimiento" },
 ];

 const getDocumentLinks = (detail) =>
 documentLabels
 .filter((doc) => detail?.[doc.key])
 .map((doc) => ({
 ...doc,
 link: `https://drive.google.com/file/d/${detail[doc.key]}/view`,
 }));

 const openRejectModal = (req) => {
 setRejectContext({ open: true, request: req, reason: "" });
 };

 const closeRejectModal = () => {
 setRejectContext({ open: false, request: null, reason: "" });
 };

 const confirmReject = async () => {
 if (!rejectContext.request) return;
 if (!rejectContext.reason.trim()) {
 showToast("Ingrese el motivo del rechazo", "warning");
 return;
 }
 await handleProcess(
 rejectContext.request.id,
 "reject",
 rejectContext.reason.trim()
 );
 closeRejectModal();
 };

 return (
 <div className="space-y-4 rounded-none border border-gray-200 border-x-0 bg-white/90 px-3 py-4 shadow-none transition-all duration-300 sm:rounded-2xl sm:border sm:bg-white/80 sm:p-5 sm:shadow-xl sm:hover:shadow-2xl sm:backdrop-blur-xl">
 {/* Header */}
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <p className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">
 Solicitudes de clientes
 </p>
 <p className="text-sm text-gray-600">
 Panel de aprobación y control centralizado
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-3">
 <Button
 size="sm"
 variant="ghost"
 icon={FiRefreshCw}
 onClick={refreshAll}
 loading={loading || loadingApproved}
 >
 Actualizar
 </Button>
 <Button
 size="sm"
 variant="secondary"
 onClick={() => navigate("/dashboard/backoffice/client-requests")}
 >
 Ver todas
 </Button>
 </div>
 </div>

 {/* Estado vacío */}
 {requests.length === 0 && !loading ? (
 <div className="text-sm text-gray-500 bg-gray-50 rounded-none py-4 text-center border border-x-0 sm:rounded-xl sm:border">
 No hay solicitudes pendientes
 </div>
 ) : (
 <div className="space-y-4">
 {requests.map((req) => {
 const detail = pendingDetails[req.id];
 const isSubDistributor = String(detail?.client_type || "").toLowerCase() === "sub_distribuidor";
 const canApproveByQuality = detail?.quality_checklist?.summary?.can_backoffice_approve !== false;
 const approveBlocked = isSubDistributor && !canApproveByQuality;
 return (
 <div
 key={req.id}
 className="rounded-none border border-gray-200 border-x-0 px-4 py-3 bg-white shadow-none transition-all duration-200 sm:rounded-xl sm:border sm:shadow-sm sm:hover:shadow-md"
 >
 <div className="flex items-start justify-between gap-4">
 {/* Info */}
 <div className="flex-1">
 <p className="text-sm font-semibold text-gray-900">
 {req.commercial_name || "Cliente sin nombre"}
 </p>

 <div className="mt-1 space-y-0.5">
 <p className="text-xs text-gray-500">
 {req.ruc_cedula
 ? `RUC/Cédula: ${req.ruc_cedula}`
 : "Identificación no disponible"}
 </p>
 <p className="text-xs text-gray-500">
 Creado por:{" "}
 <span className="font-medium text-gray-700">
 {req.created_by || "—"}
 </span>
 </p>
 </div>
 </div>

 {/* Actions */}
 <div className="flex flex-wrap items-center gap-2">
 <Button
 size="sm"
 variant="secondary"
 leftIcon={<FiEye />}
 onClick={() =>
 navigate(`/dashboard/backoffice/client-request/${req.id}`)
 }
 >
 Ver
 </Button>

 <Button
 size="sm"
 variant="success"
 leftIcon={<FiCheck />}
 loading={processingId === `approve-${req.id}`}
 disabled={approveBlocked}
 title={approveBlocked ? "Bloqueado por checklist de calidad (pendientes o inconsistencias)." : "Aprobar"}
 onClick={() => handleProcess(req.id, "approve")}
 >
 Aprobar
 </Button>

 <Button
 size="sm"
 variant="danger"
 leftIcon={<FiX />}
 loading={processingId === `reject-${req.id}`}
 onClick={() => openRejectModal(req)}
 >
 Rechazar
 </Button>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* Aprobados */}
 <div className="rounded-none border border-emerald-100 border-x-0 bg-emerald-50/70 p-4 sm:rounded-2xl sm:border sm:p-5">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <p className="text-[11px] font-bold uppercase text-emerald-700 tracking-wider">
 Clientes aprobados
 </p>
 <p className="text-sm text-emerald-700/80">
 Documentación verificada y lista para seguimiento
 </p>
 </div>
 <div className="text-sm text-emerald-700 font-semibold">
 {approvedCount} aprobados
 </div>
 </div>

 {approvedRequests.length === 0 && !loadingApproved ? (
 <div className="mt-4 text-sm text-emerald-700/70 bg-white/80 rounded-none py-4 text-center border border-emerald-100 border-x-0 sm:rounded-xl sm:border">
 Aún no hay clientes aprobados
 </div>
 ) : (
 <div className="mt-4 grid gap-4 md:grid-cols-2">
 {approvedRequests.map((req) => {
 const detail = approvedDetails[req.id];
 const docs = getDocumentLinks(detail);
 const contactEmail = detail?.client_email || detail?.consent_recipient_email;
 const clientType = detail?.client_type || "no definido";
 const createdAt = req.created_at
 ? new Date(req.created_at).toLocaleDateString("es-EC")
 : "Sin fecha";

 return (
 <div
 key={req.id}
 className="rounded-none border border-emerald-100 border-x-0 bg-white p-4 shadow-none transition-all duration-200 sm:rounded-2xl sm:border sm:shadow-sm sm:hover:shadow-md"
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <p className="text-sm font-semibold text-gray-900">
 {req.commercial_name || "Cliente sin nombre"}
 </p>
 <div className="mt-1 space-y-0.5">
 <p className="text-xs text-gray-500">
 RUC/Cédula: {req.ruc_cedula || "No disponible"}
 </p>
 <p className="text-xs text-gray-500">
 Tipo:{" "}
 <span className="font-medium text-gray-700">
 {clientType}
 </span>
 </p>
 <p className="text-xs text-gray-500">
 Fecha aprobación:{" "}
 <span className="font-medium text-gray-700">
 {createdAt}
 </span>
 </p>
 {contactEmail && (
 <p className="text-xs text-gray-500">
 Contacto:{" "}
 <span className="font-medium text-gray-700">
 {contactEmail}
 </span>
 </p>
 )}
 </div>
 </div>
 <Button
 size="sm"
 variant="secondary"
 leftIcon={<FiEye />}
 onClick={() =>
 navigate(`/dashboard/backoffice/client-request/${req.id}`)
 }
 >
 Ver
 </Button>
 </div>

 <div className="mt-3">
 <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
 Documentos
 </p>
 {docs.length === 0 ? (
 <p className="mt-2 text-xs text-gray-500">
 Documentación no disponible
 </p>
 ) : (
 <div className="mt-2 flex flex-wrap gap-2">
 {docs.map((doc) => (
 <a
 key={`${req.id}-${doc.key}`}
 href={doc.link}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
 >
 <FiFileText />
 {doc.label}
 </a>
 ))}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Modal */}
 {rejectContext.open && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
 <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-scaleIn">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs uppercase tracking-widest text-gray-500">
 Solicitud #{rejectContext.request?.id}
 </p>
 <h3 className="text-lg font-semibold text-gray-900">
 Motivo del rechazo
 </h3>
 </div>
 <button
 onClick={closeRejectModal}
 className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
 >
 <FiX />
 </button>
 </div>

 <textarea
 value={rejectContext.reason}
 onChange={(event) =>
 setRejectContext((prev) => ({
 ...prev,
 reason: event.target.value,
 }))
 }
 placeholder="Explica brevemente por qué rechazas esta solicitud"
 className="mt-4 h-32 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
 />

 <div className="mt-5 grid grid-cols-2 gap-3">
 <Button variant="secondary" onClick={closeRejectModal}>
 Cancelar
 </Button>
 <Button variant="danger" onClick={confirmReject}>
 Confirmar rechazo
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default ClientApprovalsWidget;
