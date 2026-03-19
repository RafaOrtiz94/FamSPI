import React, { useEffect, useMemo, useState } from "react";
import { FiAward, FiDownload, FiEye, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import {
 createMyCertification,
 deleteMyCertification,
 downloadUserCertificationsPdf,
 listMyCertifications,
} from "../../../core/api/userCertificationsApi";
import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";
import { formatDateSafe, toDate } from "../../../shared/utils/dateUtils";

const CREDENTIAL_TYPE_CONFIG = {
 certification: { icon: "CE", color: "bg-yellow-100 border-yellow-400 text-yellow-800", label: "Certificación" },
 course: { icon: "CU", color: "bg-blue-100 border-blue-400 text-blue-800", label: "Curso" },
 diploma: { icon: "DI", color: "bg-indigo-100 border-indigo-400 text-indigo-800", label: "Diplomado" },
 title: { icon: "TI", color: "bg-purple-100 border-purple-400 text-purple-800", label: "Título" },
 other: { icon: "OT", color: "bg-gray-100 border-gray-400 text-gray-800", label: "Otro" },
};

const getCertificationStatus = (cert) => {
 if (cert?.status && cert?.status_label) {
 return {
 status: cert.status,
 label: cert.status_label,
 color:
 cert.status_color === "red"
 ? "text-red-600"
 : cert.status_color === "amber"
 ? "text-amber-600"
 : cert.status_color === "emerald"
 ? "text-emerald-600"
 : "text-blue-600",
 daysUntilExpiry: cert.days_until_expiry ?? null,
 };
 }

 const expiry = toDate(cert.expiry_date);
 if (!expiry || !cert.expiry_date) {
 return { status: "permanent", label: "Sin caducidad", color: "text-blue-600", daysUntilExpiry: null };
 }

 const now = new Date();
 const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

 if (daysUntilExpiry < 0) {
 return { status: "expired", label: "Expirada", color: "text-red-600", daysUntilExpiry };
 }
 if (daysUntilExpiry <= 30) {
 return {
 status: "expiring_soon",
 label: `Expira en ${daysUntilExpiry} días`,
 color: "text-amber-600",
 daysUntilExpiry,
 };
 }
 return { status: "active", label: "Activa", color: "text-emerald-600", daysUntilExpiry };
};

const CertificationMedal = ({ cert, onView, onDelete }) => {
 const typeConfig = CREDENTIAL_TYPE_CONFIG[cert.credential_type] || CREDENTIAL_TYPE_CONFIG.other;
 const { status, label, color } = getCertificationStatus(cert);

 return (
 <div className="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
 <button
 type="button"
 onClick={() => onView(cert)}
 className={`relative flex h-20 w-20 items-center justify-center rounded-full border-4 bg-white text-3xl shadow-lg transition-transform hover:scale-105 ${typeConfig.color}`}
 >
 {typeConfig.icon}
 <div className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-bold shadow-md ${color}`}>
 {status === "active" ? "OK" : status === "expired" ? "X" : status === "permanent" ? "PE" : "!"}
 </div>
 </button>

 <div className="mt-3 text-center">
 <p className="max-w-[140px] truncate text-sm font-medium text-slate-700 dark:text-slate-200" title={cert.title}>
 {cert.title}
 </p>
 <p className={`text-xs ${color}`}>{label}</p>
 </div>

 <div className="mt-3 flex w-full gap-2 sm:mt-2 sm:opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
 <button
 type="button"
 onClick={() => onView(cert)}
 className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800"
 >
 <FiEye size={14} /> Ver
 </button>
 <button
 type="button"
 onClick={() => onDelete(cert.id)}
 className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-slate-600 dark:bg-slate-800"
 >
 <FiTrash2 size={14} /> Eliminar
 </button>
 </div>
 </div>
 );
};

const CreateCertificationModal = ({ onClose, onSuccess }) => {
 const { showToast, showLoader, hideLoader } = useUI();
 const [loading, setLoading] = useState(false);
 const [formData, setFormData] = useState({
 title: "",
 issuer: "",
 issue_date: "",
 expiry_date: "",
 credential_type: "certification",
 description: "",
 });
 const [file, setFile] = useState(null);

 const handleSubmit = async (event) => {
 event.preventDefault();
 if (!formData.title.trim()) {
 showToast("El título es obligatorio", "warning");
 return;
 }

 try {
 setLoading(true);
 showLoader();
 await createMyCertification(formData, file || undefined);
 showToast("Certificación creada", "success");
 onSuccess();
 onClose();
 } catch (err) {
 console.error(err);
 showToast(err.message || "Error al crear", "error");
 } finally {
 setLoading(false);
 hideLoader();
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
 <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
 <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
 <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Nueva certificación</h3>
 <button type="button" onClick={onClose}>
 <FiX size={20} />
 </button>
 </div>
 <form onSubmit={handleSubmit} className="space-y-4 p-4">
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Título *</label>
 <input
 type="text"
 required
 value={formData.title}
 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
 className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
 placeholder="Ej. AWS Solutions Architect"
 />
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Emisor</label>
 <input
 type="text"
 value={formData.issuer}
 onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
 className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
 placeholder="Ej. Amazon Web Services"
 />
 </div>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Fecha de emisión</label>
 <input
 type="date"
 value={formData.issue_date}
 onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
 className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
 />
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Fecha de expiración</label>
 <input
 type="date"
 value={formData.expiry_date}
 onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
 className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
 />
 </div>
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tipo</label>
 <select
 value={formData.credential_type}
 onChange={(e) => setFormData({ ...formData, credential_type: e.target.value })}
 className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
 >
 {Object.entries(CREDENTIAL_TYPE_CONFIG).map(([key, config]) => (
 <option key={key} value={key}>
 {config.label}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Descripción</label>
 <textarea
 rows={3}
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
 placeholder="Opcional"
 />
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Archivo (PDF, JPG, PNG, WEBP - máx. 2MB)</label>
 <input
 type="file"
 accept=".pdf,.jpg,.jpeg,.png,.webp"
 onChange={(e) => setFile(e.target.files?.[0])}
 className="w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
 />
 </div>
 <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
 <button
 type="button"
 onClick={onClose}
 className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
 >
 Cancelar
 </button>
 <button
 type="submit"
 disabled={loading}
 className="flex-1 rounded-xl bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
 >
 {loading ? "Creando..." : "Crear"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};

const ViewCertificationModal = ({ cert, onClose, onDelete }) => {
 const typeConfig = CREDENTIAL_TYPE_CONFIG[cert.credential_type] || CREDENTIAL_TYPE_CONFIG.other;
 const { label, color } = getCertificationStatus(cert);

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
 <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
 <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
 <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Certificación</h3>
 <button type="button" onClick={onClose}>
 <FiX size={20} />
 </button>
 </div>
 <div className="space-y-4 p-4">
 <div className="flex items-center gap-4">
 <div className={`flex h-16 w-16 items-center justify-center rounded-full border-4 bg-white text-2xl shadow ${typeConfig.color}`}>
 {typeConfig.icon}
 </div>
 <div>
 <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{cert.title}</h4>
 <p className="text-sm text-slate-500">{typeConfig.label}</p>
 <p className={`text-sm font-medium ${color}`}>{label}</p>
 </div>
 </div>
 <div className="space-y-2 text-sm">
 {cert.issuer && (
 <div className="flex justify-between gap-3">
 <span className="text-slate-500">Emisor:</span>
 <span className="text-right text-slate-900 dark:text-white">{cert.issuer}</span>
 </div>
 )}
 {cert.issue_date && (
 <div className="flex justify-between gap-3">
 <span className="text-slate-500">Emitido:</span>
 <span className="text-right text-slate-900 dark:text-white">{formatDateSafe(cert.issue_date)}</span>
 </div>
 )}
 {cert.expiry_date && (
 <div className="flex justify-between gap-3">
 <span className="text-slate-500">Expira:</span>
 <span className="text-right text-slate-900 dark:text-white">{formatDateSafe(cert.expiry_date)}</span>
 </div>
 )}
 </div>
 {cert.description && (
 <div>
 <p className="mb-1 text-sm text-slate-500">Descripción:</p>
 <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-700/50 dark:text-slate-300">{cert.description}</p>
 </div>
 )}
 <div className="flex flex-col gap-3 sm:flex-row">
 {cert.file_url && (
 <a
 href={cert.file_url}
 target="_blank"
 rel="noopener noreferrer"
 className="block flex-1 rounded-xl bg-primary/10 px-4 py-2 text-center font-medium text-primary hover:bg-primary/20"
 >
 Ver documento
 </a>
 )}
 <button
 type="button"
 onClick={() => onDelete(cert.id)}
 className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600 hover:bg-red-100"
 >
 <FiTrash2 size={16} /> Eliminar
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};

const CertificationsBoard = () => {
 const { showToast, showLoader, hideLoader } = useUI();
 const { user } = useAuth();
 const [certifications, setCertifications] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [viewingCert, setViewingCert] = useState(null);
 const [downloadingPdf, setDownloadingPdf] = useState(false);

 const certSummary = useMemo(
 () =>
 certifications.reduce(
 (acc, cert) => {
 const state = getCertificationStatus(cert);
 acc.total += 1;
 if (state.status === "active") acc.active += 1;
 if (state.status === "permanent") acc.permanent += 1;
 if (state.status === "expiring_soon") acc.expiringSoon += 1;
 if (state.status === "expired") acc.expired += 1;
 return acc;
 },
 { total: 0, active: 0, permanent: 0, expiringSoon: 0, expired: 0 }
 ),
 [certifications]
 );

 const loadCertifications = async () => {
 try {
 setLoading(true);
 const response = await listMyCertifications(false);
 setCertifications(response.data || []);
 } catch (err) {
 console.error(err);
 showToast("Error al cargar", "error");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadCertifications();
 }, []);

 const handleDelete = async (certId) => {
 if (!window.confirm("¿Eliminar esta certificación?")) return;

 try {
 await deleteMyCertification(certId);
 if (viewingCert?.id === certId) {
 setViewingCert(null);
 }
 showToast("Certificación eliminada", "success");
 loadCertifications();
 } catch (err) {
 console.error(err);
 showToast(err.message || "Error", "error");
 }
 };

 const handleDownloadPdf = async () => {
 if (downloadingPdf) return;

 try {
 setDownloadingPdf(true);
 showLoader();

 const pdfBlob = await downloadUserCertificationsPdf(user.id);
 const url = window.URL.createObjectURL(pdfBlob);
 const link = document.createElement("a");
 link.href = url;
 link.download = `certificaciones_${user.fullname || "usuario"}_${new Date().toISOString().split("T")[0]}.pdf`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 window.URL.revokeObjectURL(url);

 showToast("PDF descargado exitosamente", "success");
 } catch (err) {
 console.error("Error descargando PDF:", err);
 if (err.response?.status === 403) {
 showToast("No tienes permisos para descargar PDFs consolidados", "warning");
 } else if (err.response?.status === 404) {
 showToast("No hay certificaciones activas para consolidar", "info");
 } else {
 showToast(err.message || "Error al descargar PDF", "error");
 }
 } finally {
 setDownloadingPdf(false);
 hideLoader();
 }
 };

 const canDownloadPdf = Boolean(user?.id);

 return (
 <div className="space-y-6">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
 <div className="flex items-start gap-3">
 <div className="rounded-xl bg-amber-100 p-2 dark:bg-amber-900/30">
 <FiAward className="text-amber-600 dark:text-amber-400" size={24} />
 </div>
 <div>
 <h2 className="text-xl font-bold text-slate-900 dark:text-white">Mis certificaciones</h2>
 <p className="text-sm text-slate-500">{certifications.length} certificación(es)</p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => setShowCreateModal(true)}
 className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-white shadow-lg shadow-primary/20 hover:bg-primary-dark sm:w-auto"
 >
 <FiPlus size={18} /> Agregar
 </button>
 </div>

 {(certSummary.expiringSoon > 0 || certSummary.expired > 0) && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
 <p className="font-semibold">Atención: hay certificaciones que requieren revisión</p>
 <p className="mt-1 text-amber-800">
 {certSummary.expiringSoon > 0 ? `${certSummary.expiringSoon} por vencer` : ""}
 {certSummary.expiringSoon > 0 && certSummary.expired > 0 ? " y " : ""}
 {certSummary.expired > 0 ? `${certSummary.expired} vencidas` : ""}.
 </p>
 </div>
 )}

 {canDownloadPdf && certifications.length > 0 && (
 <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-start gap-3">
 <FiDownload className="mt-0.5 text-blue-600 dark:text-blue-400" size={20} />
 <div>
 <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Descargar PDF consolidado</h3>
 <p className="text-xs text-blue-700 dark:text-blue-300">Genera un documento PDF con todas tus certificaciones activas.</p>
 </div>
 </div>
 <button
 type="button"
 onClick={handleDownloadPdf}
 disabled={downloadingPdf}
 className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
 >
 <FiDownload size={16} />
 {downloadingPdf ? "Descargando..." : "Descargar PDF"}
 </button>
 </div>
 </div>
 )}

 <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
 <div className="rounded-xl bg-emerald-50 p-4 text-center dark:bg-emerald-900/20">
 <p className="text-2xl font-bold text-emerald-600">{certSummary.active}</p>
 <p className="text-xs text-emerald-700 dark:text-emerald-400">Vigentes</p>
 </div>
 <div className="rounded-xl bg-blue-50 p-4 text-center dark:bg-blue-900/20">
 <p className="text-2xl font-bold text-blue-600">{certSummary.permanent}</p>
 <p className="text-xs text-blue-700 dark:text-blue-400">Sin caducidad</p>
 </div>
 <div className="rounded-xl bg-amber-50 p-4 text-center dark:bg-amber-900/20">
 <p className="text-2xl font-bold text-amber-600">{certSummary.expiringSoon}</p>
 <p className="text-xs text-amber-700 dark:text-amber-400">Expira pronto</p>
 </div>
 <div className="rounded-xl bg-red-50 p-4 text-center dark:bg-red-900/20">
 <p className="text-2xl font-bold text-red-600">{certSummary.expired}</p>
 <p className="text-xs text-red-700 dark:text-red-400">Expiradas</p>
 </div>
 </div>

 {loading ? (
 <div className="py-8 text-center text-slate-500">Cargando...</div>
 ) : certifications.length === 0 ? (
 <div className="rounded-xl bg-slate-50 py-8 text-center text-slate-500 dark:bg-slate-800/50">
 No tienes certificaciones registradas.
 </div>
 ) : (
 <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50 sm:grid-cols-2 xl:grid-cols-3">
 {certifications.map((cert) => (
 <CertificationMedal key={cert.id} cert={cert} onView={setViewingCert} onDelete={handleDelete} />
 ))}
 </div>
 )}

 {showCreateModal && <CreateCertificationModal onClose={() => setShowCreateModal(false)} onSuccess={loadCertifications} />}
 {viewingCert && <ViewCertificationModal cert={viewingCert} onClose={() => setViewingCert(null)} onDelete={handleDelete} />}
 </div>
 );
};

export default CertificationsBoard;
