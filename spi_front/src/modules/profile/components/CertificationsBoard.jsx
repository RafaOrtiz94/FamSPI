import React, { useState, useEffect } from "react";
import { FiPlus, FiTrash2, FiEye, FiAward, FiX, FiDownload } from "react-icons/fi";
import { listMyCertifications, createMyCertification, deleteMyCertification, downloadUserCertificationsPdf } from "../../../core/api/userCertificationsApi";
import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";
import { toDate, formatDateSafe } from "../../../shared/utils/dateUtils";

const CREDENTIAL_TYPE_CONFIG = {
  certification: { icon: "🏆", color: "bg-yellow-100 border-yellow-400 text-yellow-800", label: "Certificación" },
  course: { icon: "📚", color: "bg-blue-100 border-blue-400 text-blue-800", label: "Curso" },
  diploma: { icon: "🎓", color: "bg-indigo-100 border-indigo-400 text-indigo-800", label: "Diplomado" },
  title: { icon: "📜", color: "bg-purple-100 border-purple-400 text-purple-800", label: "Título" },
  other: { icon: "⭐", color: "bg-gray-100 border-gray-400 text-gray-800", label: "Otro" }
};

const getCertificationStatus = (cert) => {
  const expiry = toDate(cert.expiry_date);

  // Si no tiene fecha de expiración, es permanente
  if (!expiry || !cert.expiry_date) {
    return { status: "permanent", label: "Sin caducidad", color: "text-blue-600" };
  }

  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) return { status: "expired", label: "Expirado", color: "text-red-600" };
  if (daysUntilExpiry <= 30) return { status: "expiring_soon", label: `Expira en ${daysUntilExpiry} días`, color: "text-amber-600" };
  return { status: "active", label: "Activo", color: "text-emerald-600" };
};

const CertificationMedal = ({ cert, onView, onDelete }) => {
  const typeConfig = CREDENTIAL_TYPE_CONFIG[cert.credential_type] || CREDENTIAL_TYPE_CONFIG.other;
  const { status, label, color } = getCertificationStatus(cert);
  return (
    <div className="group relative flex flex-col items-center">
      <div className={`relative h-20 w-20 rounded-full border-4 ${typeConfig.color} bg-white shadow-lg transition-transform hover:scale-110 cursor-pointer flex items-center justify-center text-3xl`} onClick={() => onView(cert)}>
        {typeConfig.icon}
        <div className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md ${color} text-xs font-bold`}>
          {status === "active" ? "✓" : status === "expired" ? "✗" : status === "permanent" ? "∞" : "⚠"}
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="max-w-[100px] text-xs font-medium text-slate-700 dark:text-slate-200 truncate" title={cert.title}>{cert.title}</p>
        <p className={`text-xs ${color}`}>{label}</p>
      </div>
      <div className="absolute -top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); onView(cert); }} className="p-1.5 bg-white rounded-full shadow-md text-blue-600 hover:bg-blue-50"><FiEye size={12} /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(cert.id); }} className="p-1.5 bg-white rounded-full shadow-md text-red-600 hover:bg-red-50"><FiTrash2 size={12} /></button>
      </div>
    </div>
  );
};

const CreateCertificationModal = ({ onClose, onSuccess }) => {
  const { showToast, showLoader, hideLoader } = useUI();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: "", issuer: "", issue_date: "", expiry_date: "", credential_type: "certification", description: "" });
  const [file, setFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { showToast("El título es obligatorio", "warning"); return; }
    try {
      setLoading(true);
      showLoader();
      await createMyCertification(formData, file || undefined);
      showToast("Certificación creada", "success");
      onSuccess();
      onClose();
    } catch (err) { console.error(err); showToast(err.message || "Error al crear", "error"); }
    finally { setLoading(false); hideLoader(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Nueva Certificación</h3>
          <button onClick={onClose}><FiX size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Título *</label>
            <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" placeholder="Ej. AWS Solutions Architect" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Emisor</label>
            <input type="text" value={formData.issuer} onChange={(e) => setFormData({ ...formData, issuer: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" placeholder="Ej. Amazon Web Services" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Fecha emisión</label>
              <input type="date" value={formData.issue_date} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Fecha expiración</label>
              <input type="date" value={formData.expiry_date} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Tipo</label>
            <select value={formData.credential_type} onChange={(e) => setFormData({ ...formData, credential_type: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
              {Object.entries(CREDENTIAL_TYPE_CONFIG).map(([key, config]) => (<option key={key} value={key}>{config.label}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Descripción</label>
            <textarea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none" placeholder="Opcional..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Archivo (PDF, JPG, PNG - máx 2MB)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 rounded-xl bg-primary text-white font-semibold hover:bg-primary-dark disabled:opacity-50">{loading ? "Creando..." : "Crear"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ViewCertificationModal = ({ cert, onClose }) => {
  const typeConfig = CREDENTIAL_TYPE_CONFIG[cert.credential_type] || CREDENTIAL_TYPE_CONFIG.other;
  const { label, color } = getCertificationStatus(cert);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Certificación</h3>
          <button onClick={onClose}><FiX size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className={`h-16 w-16 rounded-full border-4 ${typeConfig.color} bg-white shadow flex items-center justify-center text-2xl`}>{typeConfig.icon}</div>
            <div>
              <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{cert.title}</h4>
              <p className="text-sm text-slate-500">{typeConfig.label}</p>
              <p className={`text-sm font-medium ${color}`}>{label}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {cert.issuer && <div className="flex justify-between"><span className="text-slate-500">Emisor:</span><span className="text-slate-900 dark:text-white">{cert.issuer}</span></div>}
            {cert.issue_date && <div className="flex justify-between"><span className="text-slate-500">Emitido:</span><span className="text-slate-900 dark:text-white">{formatDateSafe(cert.issue_date)}</span></div>}
            {cert.expiry_date && <div className="flex justify-between"><span className="text-slate-500">Expira:</span><span className="text-slate-900 dark:text-white">{formatDateSafe(cert.expiry_date)}</span></div>}
          </div>
          {cert.description && <div><p className="text-sm text-slate-500 mb-1">Descripción:</p><p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">{cert.description}</p></div>}
          {cert.file_url && <a href={cert.file_url} target="_blank" rel="noopener noreferrer" className="block w-full text-center px-4 py-2 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20">Ver documento</a>}
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

  const loadCertifications = async () => {
    try {
      setLoading(true);
      const response = await listMyCertifications(false);
      setCertifications(response.data || []);
    } catch (err) { console.error(err); showToast("Error al cargar", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCertifications(); }, []);

  const handleDelete = async (certId) => {
    if (!window.confirm("¿Eliminar esta certificación?")) return;
    try { await deleteMyCertification(certId); showToast("Eliminada", "success"); loadCertifications(); }
    catch (err) { console.error(err); showToast(err.message || "Error", "error"); }
  };

  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;

    try {
      setDownloadingPdf(true);
      showLoader();

      const pdfBlob = await downloadUserCertificationsPdf(user.id);

      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificaciones_${user.fullname || 'usuario'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast("PDF descargado exitosamente", "success");
    } catch (err) {
      console.error('Error descargando PDF:', err);
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

  // Check if user can download PDF (roles: acp_comercial, talento_humano)
  const canDownloadPdf = user?.role && ['acp_comercial', 'talento_humano'].includes(user.role);

  const activeCerts = certifications.filter(c => getCertificationStatus(c).status === "active");
  const expiringSoonCerts = certifications.filter(c => getCertificationStatus(c).status === "expiring_soon");
  const expiredCerts = certifications.filter(c => getCertificationStatus(c).status === "expired");
  const permanentCerts = certifications.filter(c => getCertificationStatus(c).status === "permanent");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><FiAward className="text-amber-600 dark:text-amber-400" size={24} /></div>
          <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">Mis Certificaciones</h2><p className="text-sm text-slate-500">{certifications.length} certificación(es)</p></div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark shadow-lg shadow-primary/20"><FiPlus size={18} />Agregar</button>
      </div>

      {canDownloadPdf && certifications.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FiDownload className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Descargar PDF Consolidado</h3>
                <p className="text-xs text-blue-700 dark:text-blue-300">Genera un documento PDF con todas tus certificaciones activas</p>
              </div>
            </div>
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <FiDownload size={16} />
              {downloadingPdf ? "Descargando..." : "Descargar PDF"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{activeCerts.length}</p><p className="text-xs text-emerald-700 dark:text-emerald-400">Activas</p></div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-blue-600">{permanentCerts.length}</p><p className="text-xs text-blue-700 dark:text-blue-400">Sin caducidad</p></div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-amber-600">{expiringSoonCerts.length}</p><p className="text-xs text-amber-700 dark:text-amber-400">Expira pronto</p></div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-red-600">{expiredCerts.length}</p><p className="text-xs text-red-700 dark:text-red-400">Expiradas</p></div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Cargando...</div>
      ) : certifications.length === 0 ? (
        <div className="text-center py-8 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl">No tienes certificaciones registradas</div>
      ) : (
        <div className="flex flex-wrap gap-6 justify-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          {certifications.map(cert => <CertificationMedal key={cert.id} cert={cert} onView={setViewingCert} onDelete={handleDelete} />)}
        </div>
      )}

      {showCreateModal && <CreateCertificationModal onClose={() => setShowCreateModal(false)} onSuccess={loadCertifications} />}
      {viewingCert && <ViewCertificationModal cert={viewingCert} onClose={() => setViewingCert(null)} />}
    </div>
  );
};

export default CertificationsBoard;