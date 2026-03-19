import React, { useState, useEffect } from "react";
import { FiCheck, FiX, FiClock, FiFileText, FiEye, FiDownload } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
import { getPendientes, aprobarParcial, aprobarFinal, rechazar } from "../../../../core/api/permisosApi";

/**
 * Vista de aprobación de permisos y vacaciones para jefes
 * Muestra solicitudes en dos etapas:
 * 1. Pendientes de aprobación parcial
 * 2. Pendientes de aprobación final (con justificantes subidos)
 */
const AprobacionPermisosView = ({ compact = false }) => {
 const { showToast, showLoader, hideLoader } = useUI();
 const [stage, setStage] = useState("pending"); // 'pending' o 'pending_final'
 const [solicitudes, setSolicitudes] = useState([]);
 const [loading, setLoading] = useState(true);
 const [selectedSolicitud, setSelectedSolicitud] = useState(null);
 const [showRejectModal, setShowRejectModal] = useState(false);
 const [rejectReason, setRejectReason] = useState("");
 const [actionLoading, setActionLoading] = useState(null);

 useEffect(() => {
 loadSolicitudes();
 }, [stage]);

 const loadSolicitudes = async ({ silent = false } = {}) => {
 if (!silent) setLoading(true);
 try {
 const response = await getPendientes(stage);
 if (response.ok) {
 setSolicitudes(response.data || []);
 }
 } catch (error) {
 console.error("Error loading solicitudes:", error);
 showToast("Error al cargar solicitudes", "error");
 } finally {
 if (!silent) setLoading(false);
 }
 };

 useScopedAutoUpdate(
 [DATA_UPDATE_SCOPES.PERMISOS, DATA_UPDATE_SCOPES.VACACIONES],
 () => {
 loadSolicitudes({ silent: true });
 },
 [stage],
 );

 const runActionWithLoader = async (loadingKey, message, action) => {
 setActionLoading(loadingKey);
 showLoader(message);
 try {
 return await action();
 } finally {
 hideLoader();
 setActionLoading(null);
 }
 };

 const handleAprobarParcial = async (id) => {
 await runActionWithLoader(id, "Aprobando solicitud...", async () => {
 try {
 const response = await aprobarParcial(id);
 if (response.ok) {
 const nextStatus = String(response?.data?.status || "").toLowerCase();
 if (nextStatus === "approved") {
 showToast("Solicitud aprobada definitivamente.", "success");
 } else {
 showToast("Solicitud aprobada parcialmente. El colaborador debe subir justificantes.", "success");
 }
 await loadSolicitudes();
 }
 } catch (error) {
 console.error("Error approving:", error);
 showToast(error.response?.data?.message || "Error al aprobar", "error");
 }
 });
 };

 const handleAprobarFinal = async (id) => {
 await runActionWithLoader(id, "Aprobando solicitud...", async () => {
 try {
 const response = await aprobarFinal(id);
 if (response.ok) {
 showToast("Solicitud aprobada definitivamente. PDF generado.", "success");
 await loadSolicitudes();
 }
 } catch (error) {
 console.error("Error approving:", error);
 showToast(error.response?.data?.message || "Error al aprobar", "error");
 }
 });
 };

 const handleRechazar = async () => {
 if (!selectedSolicitud || !rejectReason.trim()) {
 showToast("Debes proporcionar una razón de rechazo", "warning");
 return;
 }

 await runActionWithLoader(selectedSolicitud.id, "Rechazando solicitud...", async () => {
 try {
 const response = await rechazar(selectedSolicitud.id, rejectReason);
 if (response.ok) {
 showToast("Solicitud rechazada", "success");
 setShowRejectModal(false);
 setSelectedSolicitud(null);
 setRejectReason("");
 await loadSolicitudes();
 }
 } catch (error) {
 console.error("Error rejecting:", error);
 showToast(error.response?.data?.message || "Error al rechazar", "error");
 }
 });
 };

 const getStatusBadge = (status) => {
 const badges = {
 pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
 partially_approved: { label: "Aprobado Parcialmente", color: "bg-blue-100 text-blue-800" },
 pending_final: { label: "Esperando Aprobación Final", color: "bg-purple-100 text-purple-800" },
 approved: { label: "Aprobado", color: "bg-green-100 text-green-800" },
 rejected: { label: "Rechazado", color: "bg-red-100 text-red-800" },
 };
 const badge = badges[status] || badges.pending;
 return (
 <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.color}`}>{badge.label}</span>
 );

 };

 const getTipoLabel = (solicitud) => {
 if (solicitud.tipo_solicitud === "vacaciones") {
 return "Vacaciones";
 }
 const tipos = {
 estudios: "Permiso por Estudios",
 personal: "Permiso Personal",
 salud: "Permiso por Salud",
 calamidad: "Calamidad Doméstica",
 };
 return tipos[solicitud.tipo_permiso] || "Permiso";
 };

 const formatDateCalendar = (value) => {
 if (!value) return "N/A";
 const text = String(value);
 const datePart = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
 if (datePart) {
 const year = Number(datePart[1]);
 const month = Number(datePart[2]) - 1;
 const day = Number(datePart[3]);
 return new Date(year, month, day).toLocaleDateString("es-EC");
 }
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return "N/A";
 return parsed.toLocaleDateString("es-EC");
 };

 const formatTimeRange = (solicitud = {}) => {
 const start = solicitud?.fecha_inicio_hora || solicitud?.start_time;
 const end = solicitud?.fecha_fin_hora || solicitud?.end_time;
 if (!start || !end) return null;
 const startDate = new Date(start);
 const endDate = new Date(end);
 if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
 return `${startDate.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false })} - ${endDate.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
 };
 const spacingClass = compact ? "space-y-4" : "space-y-6";
 const titleClass = compact ? "text-lg font-bold text-gray-900" : "text-2xl font-bold text-gray-900";
 const cardPadding = compact ? "p-3" : "p-6";
 const blockPadding = compact ? "p-2" : "p-4";
 const gapClass = compact ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4";
 const buttonBase = compact ? "px-3 py-1.5 text-xs rounded-md" : "px-4 py-2 rounded-lg";
 const actionButton = compact ? "flex-1 text-xs py-1.5" : "flex-1";

 return (
 <div className={spacingClass}>
 <div className="flex items-center justify-between">
 <h2 className={titleClass}>Aprobación de Permisos y Vacaciones</h2>
 </div>

 {/* Filtros */}
 <div className={compact ? "flex gap-2 flex-col sm:flex-row" : "flex gap-2"}>
 <button
 onClick={() => setStage("pending")}
 className={`${buttonBase} font-medium transition-colors ${stage === "pending"
 ? "bg-indigo-600 text-white"
 : "bg-gray-100 text-gray-700 hover:bg-gray-200"
 }`}
 >
 Aprobación Parcial ({solicitudes.filter((s) => s.status === "pending").length})
 </button>
 <button
 onClick={() => setStage("pending_final")}
 className={`${buttonBase} font-medium transition-colors ${stage === "pending_final"
 ? "bg-purple-600 text-white"
 : "bg-gray-100 text-gray-700 hover:bg-gray-200"
 }`}
 >
 Aprobación Final ({solicitudes.filter((s) => s.status === "pending_final").length})
 </button>
 </div>

 {/* Lista de solicitudes */}
 {loading ? (
 <div className="text-center py-12">
 <p className="text-gray-500">Cargando solicitudes...</p>
 </div>
 ) : solicitudes.length === 0 ? (
 <Card className={compact ? "p-6 text-center" : "p-12 text-center"}>
 <FiCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
 <p className="text-gray-500">No hay solicitudes pendientes en esta etapa</p>
 </Card>
 ) : (
 <div className={gapClass}>
 {solicitudes.map((solicitud) => (
 <Card key={solicitud.id} className={compact ? "p-3" : cardPadding}>
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0">
 <h3 className={compact ? "text-sm font-semibold text-gray-900" : "text-lg font-semibold text-gray-900"}>{getTipoLabel(solicitud)}</h3>
 <p className={compact ? "text-xs text-gray-600 truncate" : "text-sm text-gray-600"}>
 {solicitud.user_fullname || "Colaborador"}
 </p>
 </div>
 <div className="text-right text-[10px] text-gray-500 whitespace-nowrap">
 {formatDateCalendar(solicitud.created_at)}
 </div>
 </div>

 <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
 {getStatusBadge(solicitud.status)}
 <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">
 Etapa: {stage === "pending_final" ? "Final" : "Parcial"}
 </span>
 {solicitud.status === "partially_approved" && (
 <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
 Aprobación parcial
 </span>
 )}
 {solicitud.justificacion_requerida && solicitud.justificacion_requerida.length > 0 && (!solicitud.justificantes_urls || solicitud.justificantes_urls.length === 0) && (
 <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">
 Pendiente justificación
 </span>
 )}
 </div>

 <div className={compact ? "mt-2 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 rounded-lg p-2" : "mt-3 grid grid-cols-2 gap-3 text-sm bg-slate-50 rounded-lg p-3"}>
 <div>
 <p className="text-[10px] text-gray-500">Solicitante</p>
 <p className={compact ? "text-xs font-medium text-gray-900 truncate" : "text-sm font-medium text-gray-900"}>
 {solicitud.user_email || "N/A"}
 </p>
 </div>
 <div>
 <p className="text-[10px] text-gray-500">Creado</p>
 <p className={compact ? "text-xs font-medium text-gray-900" : "text-sm font-medium text-gray-900"}>
 {formatDateCalendar(solicitud.created_at)}
 </p>
 </div>
 <div>
 <p className="text-[10px] text-gray-500">Inicio</p>
 <p className={compact ? "text-xs font-medium text-gray-900" : "text-sm font-medium text-gray-900"}>
 {formatDateCalendar(solicitud.fecha_inicio)}
 </p>
 </div>
 <div>
 <p className="text-[10px] text-gray-500">Fin</p>
 <p className={compact ? "text-xs font-medium text-gray-900" : "text-sm font-medium text-gray-900"}>
 {formatDateCalendar(solicitud.fecha_fin)}
 </p>
 </div>
 <div>
 <p className="text-[10px] text-gray-500">Duración</p>
 <p className={compact ? "text-xs font-medium text-gray-900" : "text-sm font-medium text-gray-900"}>
 {solicitud.duracion_horas
 ? `${solicitud.duracion_horas} horas`
 : solicitud.duracion_dias
 ? `${solicitud.duracion_dias} días`
 : "N/A"}
 </p>
 </div>
 {formatTimeRange(solicitud) && (
 <div>
 <p className="text-[10px] text-gray-500">Rango horario</p>
 <p className={compact ? "text-xs font-medium text-gray-900" : "text-sm font-medium text-gray-900"}>
 {formatTimeRange(solicitud)}
 </p>
 </div>
 )}
 {solicitud.tipo_solicitud === "vacaciones" && solicitud.periodo_vacaciones && (
 <div>
 <p className="text-[10px] text-gray-500">Período</p>
 <p className={compact ? "text-xs font-medium text-gray-900" : "text-sm font-medium text-gray-900"}>{solicitud.periodo_vacaciones}</p>
 </div>
 )}
 </div>

 {solicitud.justificantes_urls && solicitud.justificantes_urls.length > 0 && (
 <div className={compact ? "mt-2 text-xs text-green-700" : "mt-3 text-sm text-green-700"}>
 <p className={compact ? "text-[11px] font-semibold text-green-700" : "text-sm font-semibold text-green-700"}>
 Justificantes subidos ({solicitud.justificantes_urls.length})
 </p>
 <div className="mt-2 flex flex-wrap gap-2">
 {solicitud.justificantes_urls.map((url, idx) => (
 <a
 key={`${solicitud.id}-just-${idx}`}
 href={url}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-blue-600 shadow-sm border border-blue-100 hover:border-blue-300 transition-colors"
 >
 <FiEye className="w-3 h-3" />
 Doc {idx + 1}
 </a>
 ))}
 </div>
 </div>
 )}

 {solicitud.pdf_generado_url && (
 <div className={compact ? "mt-2 text-xs text-emerald-700" : "mt-3 text-sm text-emerald-700"}>
 <p className={compact ? "text-[11px] font-semibold text-emerald-700" : "text-sm font-semibold text-emerald-700"}>
 Formulario PDF generado
 </p>
 <div className="mt-2">
 <a
 href={solicitud.pdf_generado_url}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-emerald-700 shadow-sm border border-emerald-200 hover:border-emerald-300 transition-colors"
 >
 <FiDownload className="w-3 h-3" />
 {["cancelled", "cancelado"].includes(String(solicitud.status || "").toLowerCase())
 ? "Descargar F.RH-10 cancelado"
 : "Descargar F.RH-10"}
 </a>
 </div>
 </div>
 )}

 {solicitud.pdf_validacion_legal_url && (
 <div className={compact ? "mt-2 text-xs text-slate-700" : "mt-3 text-sm text-slate-700"}>
 <p className={compact ? "text-[11px] font-semibold text-slate-700" : "text-sm font-semibold text-slate-700"}>
 Constancia legal de firma
 </p>
 <div className="mt-2">
 <a
 href={solicitud.pdf_validacion_legal_url}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-slate-700 shadow-sm border border-slate-200 hover:border-slate-300 transition-colors"
 >
 <FiDownload className="w-3 h-3" />
 {["cancelled", "cancelado"].includes(String(solicitud.status || "").toLowerCase())
 ? "Descargar validación legal cancelada"
 : "Descargar validación legal"}
 </a>
 </div>
 </div>
 )}

 <div className={compact ? "flex gap-2 mt-3" : "flex gap-2 mt-4"}>
 {stage === "pending" && solicitud.status === "pending" && (
 <>
 <Button
 variant="primary"
 onClick={() =>
 solicitud.tipo_solicitud === "vacaciones"
 ? handleAprobarFinal(solicitud.id)
 : handleAprobarParcial(solicitud.id)
 }
 disabled={!!actionLoading}
 className={compact ? "flex-1 text-xs py-2" : actionButton}
 >
 <FiCheck className="w-4 h-4 mr-2" />
 {solicitud.tipo_solicitud === "vacaciones"
 ? "Aprobar"
 : "Aprobar Parcial"}
 </Button>
 <Button
 variant="secondary"
 onClick={() => {
 setSelectedSolicitud(solicitud);
 setShowRejectModal(true);
 }}
 disabled={!!actionLoading}
 className={compact ? "flex-1 text-xs py-2 bg-red-50 text-red-700 hover:bg-red-100" : `${actionButton} bg-red-50 text-red-700 hover:bg-red-100`}
 >
 <FiX className="w-4 h-4 mr-2" />
 Rechazar
 </Button>
 </>
 )}

 {stage === "pending_final" && solicitud.status === "pending_final" && (
 <>
 <Button
 variant="primary"
 onClick={() => handleAprobarFinal(solicitud.id)}
 disabled={!!actionLoading}
 className={compact ? "flex-1 text-xs py-2 bg-green-600 hover:bg-green-700" : `${actionButton} bg-green-600 hover:bg-green-700`}
 >
 <FiCheck className="w-4 h-4 mr-2" />
 Aprobar
 </Button>
 <Button
 variant="secondary"
 onClick={() => {
 setSelectedSolicitud(solicitud);
 setShowRejectModal(true);
 }}
 disabled={!!actionLoading}
 className={compact ? "flex-1 text-xs py-2 bg-red-50 text-red-700 hover:bg-red-100" : `${actionButton} bg-red-50 text-red-700 hover:bg-red-100`}
 >
 <FiX className="w-4 h-4 mr-2" />
 Rechazar
 </Button>
 </>
 )}
 </div>
 </Card>
 ))}
 </div>
 )}

 {/* Modal de rechazo */}
 {showRejectModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
 <Card className="w-full max-w-md p-6">
 <h3 className="text-lg font-semibold text-gray-900 mb-4">Rechazar Solicitud</h3>
 <p className="text-sm text-gray-600 mb-4">
 Por favor, proporciona una razón para el rechazo:
 </p>
 <textarea
 value={rejectReason}
 onChange={(e) => setRejectReason(e.target.value)}
 rows={4}
 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 mb-4"
 placeholder="Escribe la razón del rechazo..."
 />
 <div className="flex gap-3">
 <Button
 variant="secondary"
 onClick={() => {
 if (actionLoading) return;
 setShowRejectModal(false);
 setSelectedSolicitud(null);
 setRejectReason("");
 }}
 className={actionButton}
 disabled={!!actionLoading}
 >
 Cancelar
 </Button>
 <Button
 variant="primary"
 onClick={handleRechazar}
 className="flex-1 bg-red-600 hover:bg-red-700"
 disabled={!rejectReason.trim() || !!actionLoading}
 >
 Confirmar Rechazo
 </Button>
 </div>
 </Card>
 </div>
 )}
 </div>
 );
};

export default AprobacionPermisosView;
