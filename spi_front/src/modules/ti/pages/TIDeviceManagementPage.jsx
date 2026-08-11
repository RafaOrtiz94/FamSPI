import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiCpu,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiLock,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiTruck,
  FiUser,
  FiX,
} from "react-icons/fi";
import { TiActaEditModal, TiWorkflowStartModal } from "../components/TiActaModals";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";
import { getUsers } from "../../../core/api/usersApi";
import {
  assignTiAsset,
  assignTiCorporateNumber,
  assignMultipleTiAssets,
  getTiAssignmentEvidenceFile,
  uploadAssignmentEvidence,
  changeTiCorporateNumber,
  clearTiMaintenance,
  completeTiMaintenance,
  createTiAsset,
  createTiAccessory,
  createTiCorporateNumber,
  createTiMaintenance,
  deleteTiAccessory,
  getTiActaPdf,
  getTiActaRecipientInfo,
  listTiAllActas,
  downloadTiMaintenanceReport,
  startTiActaSignatureWorkflow,
  uploadTiActaSigned,
  generateTiMaintenanceFuture,
  generateTiMaintenanceReport,
  getTiAssetAssignmentsHistory,
  getTiAssetHistory,
  listTiAccessories,
  listTiActas,
  uploadTiLegacyActaSigned,
  listTiAssets,
  listTiCorporateNumbers,
  listTiMaintenance,
  listTiMaintenanceReports,
  refreshTiMaintenanceSchedule,
  requestTiMaintenanceDelivery,
  setTiMaintenanceCoordinationDate,
  updateTiAccessory,
  updateTiAsset,
  updateTiCorporateNumber,
  updateTiAssetStatus,
  liberateTiAsset,
  getTiLiberationPhotos,
  getTiLiberationPhotoFile,
} from "../../../core/api/tiAssetsApi";

const STATUS_LABELS = {
  unassigned: "Sin asignar",
  assigned: "Asignado",
  damaged: "Dañado",
  in_maintenance: "En mantenimiento",
  retired: "Dado de baja",
  available: "Disponible",
};

// Subcomponent: Todas las actas
function TIActasView() {
  const { showToast } = useUI();
  const [allActas, setAllActas] = useState([]);
  const [actasLoading, setActasLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const [editingActa, setEditingActa] = useState(null);
  const [workflowActa, setWorkflowActa] = useState(null);
  const [startingWorkflow, setStartingWorkflow] = useState(false);
  const [users, setUsers] = useState([]);

  const reload = useCallback(() => {
    setActasLoading(true);
    listTiAllActas()
      .then((rows) => setAllActas(rows || []))
      .catch(() => showToast("Error al cargar actas", "error"))
      .finally(() => setActasLoading(false));
  }, [showToast]);

  useEffect(() => {
    reload();
    getUsers().then((rows) => setUsers(rows || [])).catch(() => {});
  }, [reload]);

  const handleDownloadPdf = async (actaId, tipo) => {
    setDownloadingPdf(actaId);
    try {
      const res = await getTiActaPdf(actaId, tipo);
      const blobUrl = window.URL.createObjectURL(res.blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      showToast(e?.response?.data?.message || "No se pudo generar el PDF", "error");
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleStartWorkflow = async (payloadSigners) => {
    if (!payloadSigners?.length) return showToast("Selecciona al menos un firmante", "warning");
    if (!workflowActa) return;
    setStartingWorkflow(true);
    try {
      await startTiActaSignatureWorkflow(workflowActa.id, { signers: payloadSigners });
      showToast("Flujo de firma iniciado", "success");
      reload();
      setWorkflowActa(null);
    } catch (e) {
      showToast(e?.response?.data?.message || "No se pudo iniciar el flujo de firma", "error");
    } finally {
      setStartingWorkflow(false);
    }
  };

  if (actasLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <FiRefreshCw size={20} className="animate-spin text-slate-300" />
      </div>
    );
  }

  if (allActas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <FiFileText size={32} className="text-slate-200 mb-3" />
        <p className="text-sm font-medium text-slate-500">Sin actas generadas</p>
        <p className="text-xs text-slate-400 mt-1">Las actas se crean automáticamente al asignar o retirar equipos.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {allActas.map((acta) => {
          const isSigned = acta.is_complete || acta.signed_at || acta.signed_pdf_drive_file_id || acta.signed_pdf_sha256;
          return (
            <div key={acta.id} className="rounded-xl border border-slate-200 bg-white p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    acta.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                  }`}>
                    {acta.tipo}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-600">{acta.acta_code || `#${String(acta.id).padStart(6, "0")}`}</span>
                  {isSigned ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                      <FiCheck size={9} /> Firmada
                    </span>
                  ) : acta.signature_workflow_id ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <FiRefreshCw size={9} /> En firma
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Pendiente
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-800">{acta.recipient_nombre || "Sin nombre"}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{acta.recipient_cargo || "-"} · {acta.asset_name || "-"}</p>
                <p className="text-[10px] text-slate-400">{new Date(acta.generated_at).toLocaleString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(acta.id, acta.tipo)}
                  disabled={downloadingPdf === acta.id}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap disabled:cursor-wait disabled:opacity-60"
                >
                  {downloadingPdf === acta.id ? <FiRefreshCw size={12} className="animate-spin" /> : <FiDownload size={12} />} PDF
                </button>
                {!isSigned && (
                  <button
                    type="button"
                    onClick={() => setEditingActa(acta)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    <FiEdit2 size={12} /> Editar
                  </button>
                )}
                {!isSigned && !acta.signature_workflow_id && (
                  <button
                    type="button"
                    onClick={() => setWorkflowActa(acta)}
                    className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                  >
                    <FiShield size={12} /> Firma
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <TiActaEditModal
        open={Boolean(editingActa)}
        acta={editingActa}
        onClose={() => setEditingActa(null)}
        onSaved={() => { setEditingActa(null); reload(); }}
      />
      <TiWorkflowStartModal
        open={Boolean(workflowActa)}
        acta={workflowActa}
        users={users}
        submitting={startingWorkflow}
        onClose={() => setWorkflowActa(null)}
        onSubmit={handleStartWorkflow}
      />
      {downloadingPdf !== null && (
        <div className="fixed inset-0 z-[30] flex items-center justify-center bg-[#0F172A]/60">
          <div className="z-[40] flex flex-col items-center gap-5 rounded-2xl border border-[#E5E7EB] bg-white px-10 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]">
            <FiRefreshCw size={28} className="animate-spin text-[#2563EB]" />
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[17px] font-semibold leading-snug tracking-tight text-[#1F2937]">Generando PDF</span>
              <span className="max-w-[260px] text-[13px] leading-relaxed text-[#6B7280]">Preparando el acta en Google Docs. Esto puede tomar unos segundos.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const STATUS_COLORS = {
  unassigned: "bg-slate-100 text-slate-600",
  assigned: "bg-blue-50 text-blue-700",
  damaged: "bg-red-50 text-red-700",
  in_maintenance: "bg-amber-50 text-amber-700",
  retired: "bg-slate-200 text-slate-500",
  available: "bg-green-50 text-green-700",
};

const MAINTENANCE_STATUS_LABELS = {
  pending: "Pendiente",
  completed: "Completado",
  overdue: "Vencido",
};

const EMPTY_FORM = {
  name: "",
  brand: "",
  model: "",
  serial_number: "",
  imei: "",
  purchase_date: "",
  characteristics: "",
  maintenance_frequency_months: 12,
  purchase_value: "", // FASE 3: Depreciación
};

// Funciones de depreciación (FASE 3)
const calculateDepreciation = (purchaseValue) => {
  const val = parseFloat(purchaseValue) || 0;
  if (val < 400) {
    return {
      category: 'control_item',
      annual_depreciation: 0,
      residual_value: val,
      note: 'Bien de control (no deprecia)'
    };
  }
  const annualDepreciation = val * 0.1111; // 33.33% / 3 años
  const residualValue = val - (annualDepreciation * 3);
  return {
    category: 'asset',
    annual_depreciation: parseFloat(annualDepreciation.toFixed(2)),
    residual_value: parseFloat(residualValue.toFixed(2)),
    note: 'Activo fijo (deprecia 33.33% en 3 años)'
  };
};

// JSONB characteristics can arrive as object {} from DB — always stringify to string for display/input
const safeChars = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    const keys = Object.keys(val);
    return keys.length ? JSON.stringify(val) : "";
  }
  return String(val);
};

const Label = ({ children, required }) => (
  <span className="block text-xs font-medium text-slate-500 mb-1">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </span>
);

const FieldInput = ({ label, required, ...props }) => (
  <div>
    <Label required={required}>{label}</Label>
    <input
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
      {...props}
    />
  </div>
);

const DepreciationBar = ({ pct, days }) => {
  if (pct === null || pct === undefined) return null;
  const color =
    pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-400";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-500">Depreciación acumulada</span>
        <span
          className={`text-xs font-semibold ${
            pct >= 90
              ? "text-red-600"
              : pct >= 60
              ? "text-amber-600"
              : "text-emerald-600"
          }`}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {years > 0 ? `${years}a ` : ""}
        {months > 0 ? `${months}m` : days === 0 ? "Recién adquirido" : `${days % 30}d`}
        {" · "}
        {pct >= 100 ? "Totalmente depreciado" : `Residual ${(100 - pct).toFixed(1)}%`}
      </p>
    </div>
  );
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      STATUS_COLORS[status] || "bg-slate-100 text-slate-600"
    }`}
  >
    {STATUS_LABELS[status] || status}
  </span>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 mb-3">
    {Icon && <Icon size={14} className="text-slate-400" />}
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </span>
  </div>
);

const revokeObjectUrls = (urls = []) => {
  urls.filter(Boolean).forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (_error) {
      // no-op
    }
  });
};

const openBlobInNewTab = (blob) => {
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch (_error) {
      // no-op
    }
  }, 60000);
};

const TI_WRITE_ROLES = ["ti", "jefe_ti", "admin_ti", "gerencia"];
const TI_CREATE_ROLES = [...TI_WRITE_ROLES, "financiero", "jefe_financiero", "finanzas", "jefe_finanzas", "contador"];
const TI_CORPORATE_MANAGE_ROLES = ["ti", "jefe_ti"];

const isMobileTiAsset = (asset) => {
  const hay = [
    asset?.name,
    asset?.brand,
    asset?.model,
    asset?.serial_number,
    asset?.imei,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!hay) return false;
  return (
    hay.includes("cel") ||
    hay.includes("movil") ||
    hay.includes("móvil") ||
    hay.includes("phone") ||
    hay.includes("iphone") ||
    hay.includes("android") ||
    Boolean(String(asset?.imei || "").trim())
  );
};

const TIDeviceManagementPage = () => {
  const { showToast } = useUI();
  const { user } = useAuth();
  const userRole = (user?.role || "").toLowerCase();
  const canCreate = TI_CREATE_ROLES.includes(userRole);
  const canWrite  = TI_WRITE_ROLES.includes(userRole);
  const canManageCorporateNumber = TI_CORPORATE_MANAGE_ROLES.includes(userRole);
  const canUploadLegacyActa = ["financiero", "jefe_financiero", "finanzas", "jefe_finanzas", "contador", "ti", "jefe_ti", "admin_ti", "gerencia"].includes(userRole);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [assignmentsHistory, setAssignmentsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [year] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editFields, setEditFields] = useState({});
  const [newStatus, setNewStatus] = useState("unassigned");
  const [, setCoordinationDates] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  // Lock/unlock edición de info del equipo
  const [isEditing, setIsEditing] = useState(false);
  // Accesorios
  const [accessories, setAccessories] = useState([]);
  const [accessoriesLoading, setAccessoriesLoading] = useState(false);
  const [showAccForm, setShowAccForm] = useState(false);
  const [accForm, setAccForm] = useState({ name: "", brand: "", model: "", serial_number: "", imei: "", is_new: false, physical_condition: "", observations: "" });
  const [editingAccId, setEditingAccId] = useState(null);
  // Modal de asignación con acta (single asset)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignModal, setAssignModal] = useState({ assigned_to_user_id: "", recipient_nombre: "", recipient_cedula: "", recipient_cargo: "", reason: "", acta_items: [] });
  const [assignSkipActa, setAssignSkipActa] = useState(false);
  const [evidenceModal, setEvidenceModal] = useState(null); // { assignmentId, label }
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientSource, setRecipientSource] = useState(null); // 'profile' | 'partial' | 'empty' | null

  // Modal de asignación múltiple (batch)
  const [showBatchAssignModal, setShowBatchAssignModal] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  const [batchAssignForm, setBatchAssignForm] = useState({ assigned_to_user_id: "", recipient_nombre: "", recipient_cedula: "", recipient_cargo: "", reason: "" });
  const [batchSkipActa, setBatchSkipActa] = useState(false);
  const [batchRecipientLoading, setBatchRecipientLoading] = useState(false);
  const [batchRecipientSource, setBatchRecipientSource] = useState(null);

  // FASE 6: Liberación de equipos
  const [showLiberateModal, setShowLiberateModal] = useState(false);
  const [liberateForm, setLiberateForm] = useState({ notes: "", photoFiles: [], photoPreviews: [] });
  const [liberatingAssetId, setLiberatingAssetId] = useState(null);
  const [liberationPhotos, setLiberationPhotos] = useState([]);
  const [liberationPhotosLoading, setLiberationPhotosLoading] = useState(false);
  const [liberationPhotoPreviewUrls, setLiberationPhotoPreviewUrls] = useState({});
  const [corporateNumbers, setCorporateNumbers] = useState([]);
  const [corporateNumbersLoading, setCorporateNumbersLoading] = useState(false);
  const [selectedCorporateNumberId, setSelectedCorporateNumberId] = useState("");
  const [corporateChangeReason, setCorporateChangeReason] = useState("");

  // Actas
  const [actas, setActas] = useState([]);
  const [actasLoading, setActasLoading] = useState(false);
  const [downloadingActaPdf, setDownloadingActaPdf] = useState(null);
  const [editingActa, setEditingActa] = useState(null);
  const [workflowActa, setWorkflowActa] = useState(null);
  const [startingWorkflow, setStartingWorkflow] = useState(false);

  // Tabs: 'dispositivos' | 'numeros-corporativos' | 'todas-actas'
  const [activeTab, setActiveTab] = useState('dispositivos');
  const [uploadingActaId, setUploadingActaId] = useState(null);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [showManualForm, setShowManualForm] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportPeriodType, setReportPeriodType] = useState("annual");
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [showCorporateCreate, setShowCorporateCreate] = useState(false);
  const [corporateForm, setCorporateForm] = useState({ number: "", status: "available" });
  const [editingCorporateId, setEditingCorporateId] = useState(null);
  const [corporateFilterStatus, setCorporateFilterStatus] = useState("all");
  const [corporateSearch, setCorporateSearch] = useState("");
  const [coordModal, setCoordModal] = useState(null); // { id, currentDate }
  const [coordModalDate, setCoordModalDate] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [manualForm, setManualForm] = useState({
    asset_id: "",
    tipo: "Preventivo",
    fecha_programada: "",
    responsable: "",
    observaciones: "",
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsRows, usersRows, maintRows] = await Promise.all([
        listTiAssets(),
        getUsers(),
        listTiMaintenance({ year }),
      ]);
      setAssets(Array.isArray(assetsRows) ? assetsRows : []);
      setUsers(Array.isArray(usersRows) ? usersRows : []);
      const safeMaintenance = Array.isArray(maintRows) ? maintRows : [];
      setMaintenance(safeMaintenance);
      setCoordinationDates(
        safeMaintenance.reduce((acc, item) => {
          acc[item.id] = item.coordinated_withdrawal_date
            ? String(item.coordinated_withdrawal_date).slice(0, 10)
            : "";
          return acc;
        }, {})
      );
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar activos TI", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, year]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const selected = useMemo(
    () => assets.find((a) => String(a.id) === String(selectedId || "")) || null,
    [assets, selectedId]
  );

  const selectedIsMobile = useMemo(() => isMobileTiAsset(selected), [selected]);

  const currentCorporateNumber = useMemo(() => {
    if (!selected) return null;
    return corporateNumbers.find(
      (item) => String(item.asset_id || "") === String(selected.id) && String(item.status || "").toLowerCase() === "assigned"
    ) || null;
  }, [corporateNumbers, selected]);

  const availableCorporateNumbers = useMemo(
    () => corporateNumbers.filter((item) => String(item.status || "").toLowerCase() === "available"),
    [corporateNumbers]
  );

  const legacyNoActaAssignment = useMemo(() => {
    const current = assignmentsHistory.find((assignment) => assignment.assigned_to_user_id);
    if (!current) return null;
    const hasSystemActa = actas.some(
      (acta) => acta.tipo === "entrega" && String(acta.recipient_user_id) === String(current.assigned_to_user_id),
    );
    return hasSystemActa ? null : current;
  }, [assignmentsHistory, actas]);

  const filteredCorporateNumbers = useMemo(() => {
    return corporateNumbers.filter((item) => {
      const matchesStatus =
        corporateFilterStatus === "all"
          ? true
          : String(item.status || "").toLowerCase() === corporateFilterStatus;
      const haystack = [
        item.number,
        item.asset_name,
        item.asset_code,
        item.assigned_user_name,
        item.assigned_user_cedula,
        item.assigned_user_department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = corporateSearch.trim()
        ? haystack.includes(corporateSearch.trim().toLowerCase())
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [corporateNumbers, corporateFilterStatus, corporateSearch]);

  const filteredAssets = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.brand || "").toLowerCase().includes(q) ||
        (a.model || "").toLowerCase().includes(q) ||
        (a.serial_number || "").toLowerCase().includes(q) ||
        (a.imei || "").toLowerCase().includes(q) ||
        (a.invoice_number || "").toLowerCase().includes(q) ||
        (a.assigned_to_name || "").toLowerCase().includes(q)
    );
  }, [assets, search]);

  const loadHistory = async (assetId) => {
    setHistoryLoading(true);
    try {
      const [rows, assignmentRows] = await Promise.all([
        getTiAssetHistory(assetId),
        getTiAssetAssignmentsHistory(assetId),
      ]);
      setHistory(rows);
      setAssignmentsHistory(assignmentRows);
    } catch (_e) {
      setHistory([]);
      setAssignmentsHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadAccessories = useCallback(async (assetId) => {
    setAccessoriesLoading(true);
    try {
      const rows = await listTiAccessories(assetId);
      setAccessories(Array.isArray(rows) ? rows : []);
    } catch (_e) {
      setAccessories([]);
    } finally {
      setAccessoriesLoading(false);
    }
  }, []);

  const loadActas = useCallback(async (assetId) => {
    setActasLoading(true);
    try {
      const rows = await listTiActas(assetId);
      setActas(Array.isArray(rows) ? rows : []);
    } catch (_e) {
      setActas([]);
    } finally {
      setActasLoading(false);
    }
  }, []);

  const loadCorporateNumbers = useCallback(async () => {
    setCorporateNumbersLoading(true);
    try {
      const rows = await listTiCorporateNumbers();
      setCorporateNumbers(Array.isArray(rows) ? rows : []);
    } catch (_e) {
      setCorporateNumbers([]);
    } finally {
      setCorporateNumbersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "numeros-corporativos") {
      loadCorporateNumbers();
    }
  }, [activeTab, loadCorporateNumbers]);

  const handleSelectAsset = (a) => {
    setSelectedId(a.id);
    setIsEditing(false);
    setNewStatus(a.status || "unassigned");
    setEditFields({
      name: a.name || "",
      brand: a.brand || "",
      model: a.model || "",
      serial_number: a.serial_number || "",
      imei: a.imei || "",
      purchase_date: a.purchase_date ? String(a.purchase_date).slice(0, 10) : "",
      characteristics: safeChars(a.characteristics),
      maintenance_frequency_months: a.maintenance_frequency_months || 12,
    });
    setShowAccForm(false);
    setEditingAccId(null);
    setSelectedCorporateNumberId("");
    setCorporateChangeReason("");
    loadHistory(a.id);
    loadAccessories(a.id);
    loadActas(a.id);
    if (isMobileTiAsset(a)) {
      loadCorporateNumbers();
    } else {
      setCorporateNumbers([]);
    }
  };

  const setField = (key) => (e) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const setEditField = (key) => (e) =>
    setEditFields((p) => ({ ...p, [key]: e.target.value }));

  const createAsset = async () => {
    if (!form.name.trim()) return showToast("El nombre es requerido", "warning");
    if (!form.serial_number.trim())
      return showToast("El número de serie es requerido", "warning");
    if (!form.purchase_date)
      return showToast("La fecha de compra es requerida", "warning");
    setSaving(true);
    try {
      await createTiAsset(form);
      showToast("Activo creado correctamente", "success");
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo crear el activo", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveAsset = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateTiAsset(selected.id, editFields);
      showToast("Activo actualizado", "success");
      await loadAll();
      loadHistory(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar", "error");
    } finally {
      setSaving(false);
    }
  };

  const openAssignModal = () => {
    if (!selected) return;
    const acItems = [
      {
        item_type: "equipo",
        asset_id: selected.id,
        name: selected.name,
        brand_model: [selected.brand, selected.model].filter(Boolean).join(" "),
        serial_imei: [selected.serial_number, selected.imei].filter(Boolean).join(" / ") || "-",
        is_new: false,
        physical_condition: "",
        observations: "",
      },
      ...accessories.map((acc) => ({
        item_type: "accesorio",
        accessory_id: acc.id,
        name: acc.name,
        brand_model: [acc.brand, acc.model].filter(Boolean).join(" "),
        serial_imei: [acc.serial_number, acc.imei].filter(Boolean).join(" / ") || "-",
        is_new: acc.is_new,
        physical_condition: acc.physical_condition ?? "",
        observations: acc.observations || "",
      })),
    ];
    const preUser = selected.assigned_to_user_id ? String(selected.assigned_to_user_id) : "";
    const preUserObj = users.find((u) => String(u.id) === preUser);
    const preNombre  = preUserObj ? (preUserObj.fullname || preUserObj.name || preUserObj.email) : "";

    setAssignModal({
      assigned_to_user_id: preUser,
      recipient_nombre: preNombre,
      recipient_cedula: "",
      recipient_cargo: "",
      reason: "",
      acta_items: acItems,
    });
    setRecipientSource(null);
    setShowAssignModal(true);

    // Auto-fetch profile if there's a current assignee
    if (preUser) {
      fetchAndFillRecipient(preUser, preNombre);
    }
  };

  const doAssign = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const payload = {
        assigned_to_user_id: assignModal.assigned_to_user_id ? Number(assignModal.assigned_to_user_id) : null,
        reason: assignModal.reason || null,
        recipient_nombre: assignModal.recipient_nombre || null,
        recipient_cedula: assignModal.recipient_cedula || null,
        recipient_cargo: assignModal.recipient_cargo || null,
        acta_items: assignSkipActa ? [] : assignModal.acta_items.map((it) => ({
          ...it,
          physical_condition: it.physical_condition !== "" && it.physical_condition != null ? Number(it.physical_condition) : null,
        })),
        skip_acta: assignSkipActa,
      };
      const result = await assignTiAsset(selected.id, payload);
      const tipoMsg = payload.assigned_to_user_id ? "Equipo asignado" : "Asignación liberada";
      showToast(
        assignSkipActa
          ? `${tipoMsg} sin acta — puedes subir la evidencia desde el historial`
          : `${tipoMsg}${result?.acta_id ? ` · Acta #${result.acta_id} generada` : ""}`,
        "success"
      );
      setShowAssignModal(false);
      setAssignSkipActa(false);
      await loadAll();
      loadHistory(selected.id);
      loadActas(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar asignación", "error");
    } finally {
      setSaving(false);
    }
  };

  // Batch assign multiple assets
  const doBatchAssign = async () => {
    if (!selectedAssets.size) {
      showToast("Selecciona al menos un equipo", "error");
      return;
    }
    setSaving(true);
    try {
      // Build acta items from selected assets with their state data
      const acta_items = Array.from(selectedAssets).map((assetId) => {
        const asset = assets.find((a) => a.id === assetId);
        const itemKey = `asset-${assetId}`;
        const itemData = batchAssignForm[itemKey] || {};

        return {
          item_type: "equipo",
          asset_id: assetId,
          name: asset?.name || "",
          brand_model: [asset?.brand, asset?.model].filter(Boolean).join(" ") || "",
          serial_imei: [asset?.serial_number, asset?.imei].filter(Boolean).join(" / ") || null,
          is_new: itemData.is_new !== null ? itemData.is_new : null,
          physical_condition: itemData.physical_condition !== "" && itemData.physical_condition != null ? Number(itemData.physical_condition) : null,
          observations: itemData.observations || null,
        };
      });

      const payload = {
        asset_ids: Array.from(selectedAssets),
        assigned_to_user_id: batchAssignForm.assigned_to_user_id ? Number(batchAssignForm.assigned_to_user_id) : null,
        reason: batchAssignForm.reason || null,
        recipient_nombre: batchAssignForm.recipient_nombre || null,
        recipient_cedula: batchAssignForm.recipient_cedula || null,
        recipient_cargo: batchAssignForm.recipient_cargo || null,
        acta_items: batchSkipActa ? [] : acta_items,
        skip_acta: batchSkipActa,
      };
      const result = await assignMultipleTiAssets(payload);
      showToast(
        batchSkipActa
          ? `${result.assets_assigned} equipos asignados sin acta — puedes subir evidencia desde el historial`
          : `${result.assets_assigned} equipos asignados · Acta #${result.acta_code} generada`,
        "success"
      );
      setShowBatchAssignModal(false);
      setSelectedAssets(new Set());
      setBatchAssignForm({ assigned_to_user_id: "", recipient_nombre: "", recipient_cedula: "", recipient_cargo: "", reason: "" });
      setBatchSkipActa(false);
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo asignar múltiples equipos", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveCorporateNumberAssignment = async () => {
    if (!selected) return;
    if (!selectedIsMobile) {
      showToast("Solo los dispositivos celulares pueden tener numero corporativo", "warning");
      return;
    }
    if (!selectedCorporateNumberId) {
      showToast("Selecciona un numero corporativo disponible", "warning");
      return;
    }
    if (currentCorporateNumber && String(currentCorporateNumber.id) === String(selectedCorporateNumberId)) {
      showToast("Ese numero ya esta asignado a este dispositivo", "warning");
      return;
    }

    setSaving(true);
    try {
      if (currentCorporateNumber) {
        await changeTiCorporateNumber(currentCorporateNumber.id, {
          new_number_id: Number(selectedCorporateNumberId),
          reason: corporateChangeReason || null,
        });
        showToast("Numero corporativo actualizado", "success");
      } else {
        await assignTiCorporateNumber(selectedCorporateNumberId, {
          asset_id: selected.id,
          assigned_to_user_id: selected.assigned_to_user_id || null,
        });
        showToast("Numero corporativo asignado", "success");
      }

      setSelectedCorporateNumberId("");
      setCorporateChangeReason("");
      await Promise.all([loadCorporateNumbers(), loadAll()]);
      loadHistory(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo guardar el numero corporativo", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetCorporateEditor = () => {
    setEditingCorporateId(null);
    setCorporateForm({ number: "", status: "available" });
    setShowCorporateCreate(false);
  };

  const startEditCorporateNumber = (row) => {
    setEditingCorporateId(row.id);
    setCorporateForm({
      number: row.number || "",
      status: row.status || "available",
    });
    setShowCorporateCreate(true);
  };

  const submitCorporateNumber = async () => {
    const cleanNumber = String(corporateForm.number || "").trim();
    if (!cleanNumber) {
      showToast("El numero corporativo es obligatorio", "warning");
      return;
    }

    setSaving(true);
    try {
      if (editingCorporateId) {
        await updateTiCorporateNumber(editingCorporateId, {
          number: cleanNumber,
          status: corporateForm.status,
        });
        showToast("Numero corporativo actualizado", "success");
      } else {
        await createTiCorporateNumber({
          number: cleanNumber,
        });
        showToast("Numero corporativo creado", "success");
      }

      resetCorporateEditor();
      await loadCorporateNumbers();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo guardar el numero corporativo", "error");
    } finally {
      setSaving(false);
    }
  };

  // Batch helper: fetch profile
  const fetchAndFillBatchRecipient = async (userId, baseNombre = "") => {
    if (!userId) {
      setBatchRecipientSource(null);
      return;
    }
    setBatchRecipientLoading(true);
    try {
      const info = await getTiActaRecipientInfo(userId);
      const nombre  = info?.nombre  || baseNombre;
      const cedula  = info?.cedula  || "";
      const cargo   = info?.cargo   || "";

      setBatchAssignForm((p) => ({
        ...p,
        recipient_nombre: nombre,
        recipient_cedula: cedula,
        recipient_cargo:  cargo,
      }));

      if (cedula && cargo) {
        setBatchRecipientSource("profile");
      } else if (nombre) {
        setBatchRecipientSource("partial");
      } else {
        setBatchRecipientSource("empty");
      }
    } catch (error) {
      console.error("Error fetching batch recipient info:", error);
    } finally {
      setBatchRecipientLoading(false);
    }
  };

  // FASE 6: Liberar equipo
  const doLiberateAsset = async () => {
    if (!liberatingAssetId) {
      showToast("No hay equipo seleccionado", "error");
      return;
    }
    if (liberateForm.photoFiles.length < 2) {
      showToast("Se requieren al menos 2 fotos para liberar el equipo", "error");
      return;
    }
    setSaving(true);
    try {
      await liberateTiAsset(liberatingAssetId, liberateForm.photoFiles, liberateForm.notes || "");
      showToast(`Equipo liberado · Acta de retiro generada`, "success");
      setShowLiberateModal(false);
      setLiberateForm({ notes: "", photoFiles: [], photoPreviews: [] });
      setLiberatingAssetId(null);
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo liberar el equipo", "error");
    } finally {
      setSaving(false);
    }
  };

  // Cargar fotos de liberación
  const loadLiberationPhotos = async (assetId) => {
    if (!assetId) return;
    setLiberationPhotosLoading(true);
    try {
      const photos = await getTiLiberationPhotos(assetId);
      const normalizedPhotos = Array.isArray(photos) ? photos : [];
      const nextPreviewEntries = await Promise.all(
        normalizedPhotos.map(async (photo) => {
          if (!photo?.id) return [String(photo?.id || ""), ""];
          try {
            const file = await getTiLiberationPhotoFile(photo.id);
            return [String(photo.id), URL.createObjectURL(file.blob)];
          } catch (_error) {
            return [String(photo.id), ""];
          }
        }),
      );

      setLiberationPhotoPreviewUrls((current) => {
        revokeObjectUrls(Object.values(current));
        return Object.fromEntries(nextPreviewEntries.filter(([key]) => key));
      });
      setLiberationPhotos(normalizedPhotos);
    } catch (error) {
      console.error("Error loading liberation photos:", error);
      setLiberationPhotoPreviewUrls((current) => {
        revokeObjectUrls(Object.values(current));
        return {};
      });
      setLiberationPhotos([]);
    } finally {
      setLiberationPhotosLoading(false);
    }
  };

  const openAssignmentEvidence = async (assignment) => {
    if (!assignment?.id) return;
    try {
      const file = await getTiAssignmentEvidenceFile(assignment.id);
      openBlobInNewTab(file.blob);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo abrir la evidencia", "error");
    }
  };

  const openLiberationPhoto = async (photoId) => {
    if (!photoId) return;
    try {
      const file = await getTiLiberationPhotoFile(photoId);
      openBlobInNewTab(file.blob);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo abrir la foto de liberacion", "error");
    }
  };

  useEffect(() => {
    return () => {
      revokeObjectUrls(Object.values(liberationPhotoPreviewUrls));
    };
  }, [liberationPhotoPreviewUrls]);

  // Shared helper: fetch profile and update modal recipient fields
  const fetchAndFillRecipient = async (userId, baseNombre = "") => {
    if (!userId) {
      setRecipientSource(null);
      return;
    }
    setRecipientLoading(true);
    try {
      const info = await getTiActaRecipientInfo(userId);
      const nombre  = info?.nombre  || baseNombre;
      const cedula  = info?.cedula  || "";
      const cargo   = info?.cargo   || "";

      setAssignModal((p) => ({
        ...p,
        recipient_nombre: nombre,
        recipient_cedula: cedula,
        recipient_cargo:  cargo,
      }));

      // Determine data source quality for UX indicator
      if (cedula && cargo) {
        setRecipientSource("profile");     // full data from profile
      } else if (nombre) {
        setRecipientSource("partial");     // only name, no cedula/cargo
      } else {
        setRecipientSource("empty");       // new hire — nothing in system
      }
    } catch (_e) {
      setRecipientSource("empty");
    } finally {
      setRecipientLoading(false);
    }
  };

  const handleModalUserChange = async (userId) => {
    // Immediate optimistic update from in-memory users list
    const u = users.find((x) => String(x.id) === String(userId));
    const fallbackNombre = u ? (u.fullname || u.name || u.email) : "";
    setAssignModal((p) => ({
      ...p,
      assigned_to_user_id: userId,
      recipient_nombre: fallbackNombre,
      recipient_cedula: "",
      recipient_cargo:  "",
    }));
    setRecipientSource(null);

    // Then fetch full profile (cedula + cargo + corrected name)
    await fetchAndFillRecipient(userId, fallbackNombre);
  };

  const saveAccessory = async () => {
    if (!selected || !accForm.name.trim()) return showToast("El nombre es requerido", "warning");
    setSaving(true);
    try {
      if (editingAccId) {
        await updateTiAccessory(selected.id, editingAccId, {
          ...accForm,
          physical_condition: accForm.physical_condition !== "" ? Number(accForm.physical_condition) : null,
        });
        showToast("Accesorio actualizado", "success");
      } else {
        await createTiAccessory(selected.id, {
          ...accForm,
          physical_condition: accForm.physical_condition !== "" ? Number(accForm.physical_condition) : null,
        });
        showToast("Accesorio agregado", "success");
      }
      setAccForm({ name: "", brand: "", model: "", serial_number: "", imei: "", is_new: false, physical_condition: "", observations: "" });
      setShowAccForm(false);
      setEditingAccId(null);
      await loadAccessories(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo guardar el accesorio", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEditAccessory = (acc) => {
    setEditingAccId(acc.id);
    setAccForm({
      name: acc.name || "",
      brand: acc.brand || "",
      model: acc.model || "",
      serial_number: acc.serial_number || "",
      imei: acc.imei || "",
      is_new: Boolean(acc.is_new),
      physical_condition: acc.physical_condition ?? "",
      observations: acc.observations || "",
    });
    setShowAccForm(true);
  };

  const deleteAccessory = async (accId) => {
    if (!selected) return;
    setSaving(true);
    try {
      await deleteTiAccessory(selected.id, accId);
      showToast("Accesorio eliminado", "success");
      await loadAccessories(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo eliminar el accesorio", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadActaPdf = async (actaId, tipo) => {
    setDownloadingActaPdf(actaId);
    try {
      const res = await getTiActaPdf(actaId, tipo);
      const blobUrl = window.URL.createObjectURL(res.blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      showToast(e?.response?.data?.message || "No se pudo generar el PDF", "error");
    } finally {
      setDownloadingActaPdf(null);
    }
  };

  const handleStartWorkflow = async (payloadSigners) => {
    if (!payloadSigners?.length) return showToast("Selecciona al menos un firmante", "warning");
    if (!workflowActa) return;
    setStartingWorkflow(true);
    try {
      await startTiActaSignatureWorkflow(workflowActa.id, { signers: payloadSigners });
      showToast("Flujo de firma iniciado", "success");
      if (selected) await loadActas(selected.id);
      setWorkflowActa(null);
    } catch (e) {
      showToast(e?.response?.data?.message || "No se pudo iniciar el flujo de firma", "error");
    } finally {
      setStartingWorkflow(false);
    }
  };

  const handleSignedActaUpload = async (actaId, file) => {
    if (!file) return;
    setUploadingActaId(actaId);
    try {
      await uploadTiActaSigned(actaId, file);
      showToast("Acta firmada subida. Checklist del colaborador actualizado.", "success");
      if (selected) loadActas(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo subir el acta firmada", "error");
    } finally {
      setUploadingActaId(null);
    }
  };

  const handleLegacySignedActaUpload = async (assignmentId, file) => {
    if (!file) return;
    setUploadingActaId(`legacy-${assignmentId}`);
    try {
      await uploadTiLegacyActaSigned(assignmentId, file);
      showToast("Acta histórica subida y vinculada al equipo", "success");
      if (selected) {
        await Promise.all([loadActas(selected.id), loadHistory(selected.id)]);
      }
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo subir el acta histórica", "error");
    } finally {
      setUploadingActaId(null);
    }
  };

  const doStatus = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateTiAssetStatus(selected.id, { status: newStatus });
      showToast("Estado actualizado", "success");
      await loadAll();
      loadHistory(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cambiar estado", "error");
    } finally {
      setSaving(false);
    }
  };

  const generateSchedules = async () => {
    setSaving(true);
    try {
      const result = await generateTiMaintenanceFuture();
      const created = result?.created_count || 0;
      const existing = result?.skipped_existing || 0;
      showToast(
        created > 0
          ? `${created} nuevo${created !== 1 ? "s" : ""} registro${created !== 1 ? "s" : ""} generado${created !== 1 ? "s" : ""} para ${result?.assets || 0} equipos`
          : `Cronograma al día: ${existing} registro${existing !== 1 ? "s" : ""} existente${existing !== 1 ? "s" : ""}, sin cambios`,
        created > 0 ? "success" : "info"
      );
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo generar los cronogramas", "error");
    } finally {
      setSaving(false);
    }
  };

  const refreshSchedules = async () => {
    setSaving(true);
    try {
      const result = await refreshTiMaintenanceSchedule();
      const created = result?.created_count || 0;
      showToast(
        created > 0
          ? `Cronograma actualizado: ${created} nuevo${created !== 1 ? "s" : ""} registro${created !== 1 ? "s" : ""} agregado${created !== 1 ? "s" : ""}`
          : "Cronograma al día, sin cambios pendientes",
        created > 0 ? "success" : "info"
      );
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar el cronograma", "error");
    } finally {
      setSaving(false);
    }
  };

  const completeMaintenanceRow = async (id) => {
    setSaving(true);
    try {
      await completeTiMaintenance(id, {});
      showToast("Mantenimiento completado", "success");
      await loadAll();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo completar el mantenimiento",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const requestMaintenanceDelivery = async (id) => {
    setSaving(true);
    try {
      const result = await requestTiMaintenanceDelivery(id);
      showToast(
        `Notificado al asignado: entrega del ${result?.delivery_from_date || "-"} al ${result?.delivery_to_date || "-"}`,
        "success"
      );
      await loadAll();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo notificar la entrega del equipo",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const clearMaintenanceSchedule = async () => {
    setSaving(true);
    try {
      const result = await clearTiMaintenance();
      showToast(`Cronogramas eliminados: ${result?.deleted_count || 0}`, "success");
      await loadAll();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudieron eliminar los cronogramas",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const openCoordModal = (m) => {
    setCoordModal({ id: m.id, assetName: m.asset_name });
    setCoordModalDate(m.coordinated_withdrawal_date ? String(m.coordinated_withdrawal_date).slice(0, 10) : "");
  };

  const saveCoordinationDate = async () => {
    if (!coordModal?.id) return;
    const coordinated = String(coordModalDate || "").trim();
    if (!coordinated) return showToast("Ingresa fecha de coordinación de retiro", "warning");
    setSaving(true);
    try {
      await setTiMaintenanceCoordinationDate(coordModal.id, {
        coordinated_withdrawal_date: coordinated,
      });
      showToast("Fecha de coordinación guardada", "success");
      setCoordModal(null);
      await loadAll();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo guardar la fecha de coordinación",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const rows = await listTiMaintenanceReports();
      setReports(Array.isArray(rows) ? rows : []);
    } catch (_e) {
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const result = await generateTiMaintenanceReport(
        reportPeriodType === "monthly"
          ? { period_type: "monthly", year: reportYear, month: reportMonth }
          : { period_type: "annual", year: reportYear }
      );
      showToast(`Informe generado · SHA-256: ${String(result?.sha256 || "").slice(0, 16)}`, "success");
      await loadReports();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo generar el informe", "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  const createManualMaintenance = async () => {
    if (!manualForm.asset_id || !manualForm.fecha_programada) {
      showToast("Selecciona equipo y fecha", "warning");
      return;
    }
    setSaving(true);
    try {
      await createTiMaintenance({
        asset_id: Number(manualForm.asset_id),
        planned_date: manualForm.fecha_programada,
        notes: [
          manualForm.tipo,
          manualForm.responsable ? `Responsable: ${manualForm.responsable}` : null,
          manualForm.observaciones,
        ]
          .filter(Boolean)
          .join(" | "),
      });
      showToast("Mantenimiento programado", "success");
      setManualForm({ asset_id: "", tipo: "Preventivo", fecha_programada: "", responsable: "", observaciones: "" });
      setShowManualForm(false);
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo programar el mantenimiento", "error");
    } finally {
      setSaving(false);
    }
  };

  const filteredMaintenance = useMemo(() => {
    if (deviceFilter === "all") return maintenance;
    return maintenance.filter((m) => {
      const hay = String(m.asset_name || "").toLowerCase();
      if (deviceFilter === "computadora") return hay.includes("comput") || hay.includes("laptop") || hay.includes("pc");
      if (deviceFilter === "celular") return hay.includes("cel") || hay.includes("movil") || hay.includes("phone");
      return true;
    });
  }, [maintenance, deviceFilter]);

  const monthStart = useMemo(
    () => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1),
    [calendarMonth]
  );
  const calendarDays = useMemo(() => {
    const start = new Date(monthStart);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    const days = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [monthStart]);
  const maintenanceByDate = useMemo(() => {
    const map = {};
    maintenance.forEach((m) => {
      const key = String(m.planned_date || "").slice(0, 10);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [maintenance]);

  const dep = selected
    ? {
        pct: selected.depreciation_pct,
        days: selected.depreciation_days,
      }
    : null;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Activos TI</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {assets.length} equipo{assets.length !== 1 ? "s" : ""} registrado
            {assets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={loadAll}
            icon={FiRefreshCw}
          >
            Recargar
          </Button>
          {canCreate && (
            <Button
              type="button"
              variant="primary"
              icon={showCreate ? FiChevronUp : FiPlus}
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? "Cancelar" : "Nuevo equipo"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => { setActiveTab('dispositivos'); setShowCreate(false); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'dispositivos'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Dispositivos
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('numeros-corporativos'); setShowCreate(false); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'numeros-corporativos'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Numeros corporativos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cronograma')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cronograma'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Cronograma
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('todas-actas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'todas-actas'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Actas generadas
        </button>
      </div>

      {activeTab === 'dispositivos' && (
      <>

      {/* KPIs */}
      {!loading && assets.length > 0 && (() => {
        const total       = assets.length;
        const assigned    = assets.filter((a) => a.status === "assigned").length;
        const available   = assets.filter((a) => a.status === "unassigned" || a.status === "available").length;
        const maintenance = assets.filter((a) => a.status === "in_maintenance").length;
        const damaged     = assets.filter((a) => a.status === "damaged").length;
        const kpis = [
          { label: "Total",             value: total,       color: "text-slate-900" },
          { label: "Asignados",         value: assigned,    color: "text-blue-700"  },
          { label: "Disponibles",       value: available,   color: "text-green-700" },
          { label: "En mantenimiento",  value: maintenance, color: "text-amber-700", hide: maintenance === 0 },
          { label: "Dañados",           value: damaged,     color: "text-red-700",   hide: damaged === 0 },
        ].filter((k) => !k.hide);
        return (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`grid divide-x divide-slate-100`} style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))` }}>
              {kpis.map((k) => (
                <div key={k.label} className="flex flex-col items-center justify-center px-4 py-5 text-center">
                  <span className={`text-2xl font-semibold tracking-tight leading-none ${k.color}`}>{k.value}</span>
                  <span className="mt-1.5 text-xs font-medium text-slate-400">{k.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-4">Registrar nuevo equipo</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FieldInput
              label="Nombre del equipo"
              required
              placeholder="Ej: Laptop Dell"
              value={form.name}
              onChange={setField("name")}
            />
            <FieldInput
              label="Marca"
              placeholder="Ej: Dell, HP, Apple"
              value={form.brand}
              onChange={setField("brand")}
            />
            <FieldInput
              label="Modelo"
              placeholder="Ej: Latitude 5420"
              value={form.model}
              onChange={setField("model")}
            />
            <FieldInput
              label="Número de serie"
              required
              placeholder="Ej: SN-123456789"
              value={form.serial_number}
              onChange={setField("serial_number")}
            />
            <FieldInput
              label="IMEI (opcional)"
              placeholder="Solo para equipos móviles"
              value={form.imei}
              onChange={setField("imei")}
            />
            <div>
              <Label required>Fecha de compra</Label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                value={form.purchase_date}
                onChange={setField("purchase_date")}
              />
            </div>
            <FieldInput
              label="Valor de compra (USD)"
              type="number"
              step="0.01"
              placeholder="Ej: 500.00"
              value={form.purchase_value}
              onChange={setField("purchase_value")}
            />
            <div className="sm:col-span-2 lg:col-span-2">
              <Label>Características</Label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                placeholder="RAM, disco, procesador, etc."
                value={form.characteristics}
                onChange={setField("characteristics")}
              />
            </div>
            <div>
              <Label>Frecuencia de mantenimiento (meses)</Label>
              <input
                type="number"
                min={1}
                max={24}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                value={form.maintenance_frequency_months}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    maintenance_frequency_months: Number(e.target.value || 12),
                  }))
                }
              />
            </div>
          </div>

          {/* FASE 3: Depreciation Info */}
          {form.purchase_value && parseFloat(form.purchase_value) > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 p-4 rounded-xl bg-amber-50 border border-amber-200">
              {(() => {
                const depr = calculateDepreciation(form.purchase_value);
                return (
                  <>
                    <div>
                      <p className="text-xs font-medium text-amber-700">Categoría</p>
                      <p className="text-sm text-amber-900 font-semibold">{depr.category === 'asset' ? 'Activo fijo' : 'Bien de control'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-amber-700">Depreciación anual</p>
                      <p className="text-sm text-amber-900 font-semibold">${depr.annual_depreciation.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-amber-700">Valor residual (3 años)</p>
                      <p className="text-sm text-amber-900 font-semibold">${depr.residual_value.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-amber-700">Régimen</p>
                      <p className="text-xs text-amber-800">{depr.note}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="primary"
              icon={FiPlus}
              disabled={saving}
              onClick={createAsset}
            >
              Registrar equipo
            </Button>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Asset List */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <FiSearch
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                placeholder="Buscar por nombre, serie, IMEI, factura o usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {selectedAssets.size > 0 && canWrite && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={FiUser}
                disabled={saving}
                onClick={() => setShowBatchAssignModal(true)}
                className="w-full mt-2"
              >
                Asignar {selectedAssets.size} equipo{selectedAssets.size !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-1.5 max-h-[500px]">
            {loading ? (
              <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
            ) : filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FiCpu size={28} className="text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">
                  {search ? "Sin resultados" : "No hay equipos registrados"}
                </p>
              </div>
            ) : (
              filteredAssets.map((a) => (
                <div
                  key={a.id}
                  className={`w-full rounded-xl border px-3 py-2.5 transition-colors flex items-center gap-2 ${
                    String(selectedId) === String(a.id)
                      ? "border-slate-300 bg-slate-50 shadow-sm"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {/* Checkbox for batch selection */}
                  <input
                    type="checkbox"
                    checked={selectedAssets.has(a.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      const newSelected = new Set(selectedAssets);
                      if (newSelected.has(a.id)) {
                        newSelected.delete(a.id);
                      } else {
                        newSelected.add(a.id);
                      }
                      setSelectedAssets(newSelected);
                    }}
                    className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
                  />

                  <button
                    type="button"
                    onClick={() => handleSelectAsset(a)}
                    className="flex-1 text-left"
                  >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {a.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {[a.brand, a.model].filter(Boolean).join(" · ") || "Sin especificar"}
                      </p>
                      {a.serial_number && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {a.serial_number}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {a.assigned_to_name || "Sin asignación"}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  {a.depreciation_pct !== null && a.depreciation_pct !== undefined && (
                    <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          a.depreciation_pct >= 90
                            ? "bg-red-400"
                            : a.depreciation_pct >= 60
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                        }`}
                        style={{ width: `${Math.min(a.depreciation_pct, 100)}%` }}
                      />
                    </div>
                  )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-6">
              <FiCpu size={36} className="text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">
                Selecciona un equipo para ver sus detalles
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {selected.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[selected.brand, selected.model].filter(Boolean).join(" · ") ||
                      "Sin especificar"}
                  </p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {/* Depreciation */}
              {dep?.pct !== null && dep?.pct !== undefined && (
                <DepreciationBar pct={dep.pct} days={dep.days} />
              )}

              {/* Info section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <SectionTitle icon={FiCpu}>Información del equipo</SectionTitle>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <FiEdit2 size={12} /> Habilitar edición
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setIsEditing(false); handleSelectAsset(selected); }}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      <FiX size={12} /> Cancelar
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldInput label="Nombre" required value={editFields.name || ""} onChange={setEditField("name")} />
                    <FieldInput label="Marca" value={editFields.brand || ""} onChange={setEditField("brand")} />
                    <FieldInput label="Modelo" value={editFields.model || ""} onChange={setEditField("model")} />
                    <FieldInput label="Número de serie" required value={editFields.serial_number || ""} onChange={setEditField("serial_number")} />
                    <FieldInput label="IMEI (opcional)" value={editFields.imei || ""} onChange={setEditField("imei")} />
                    <div>
                      <Label>Fecha de compra</Label>
                      <input type="date" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors" value={editFields.purchase_date || ""} onChange={setEditField("purchase_date")} />
                    </div>
                    <div className="sm:col-span-2">
                      <FieldInput label="Características" placeholder="RAM, disco, procesador, etc." value={safeChars(editFields.characteristics)} onChange={setEditField("characteristics")} />
                    </div>
                    <div>
                      <Label>Frec. mantenimiento (meses)</Label>
                      <input type="number" min={1} max={24} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors" value={editFields.maintenance_frequency_months || 12} onChange={(e) => setEditFields((p) => ({ ...p, maintenance_frequency_months: Number(e.target.value || 12) }))} />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="button" variant="primary" icon={FiCheck} disabled={saving} onClick={async () => { await saveAsset(); setIsEditing(false); }}>
                        Guardar cambios
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {[
                      ["Nombre", selected.name],
                      ["Marca", selected.brand || "-"],
                      ["Modelo", selected.model || "-"],
                      ["N° de serie", selected.serial_number || "-"],
                      ["IMEI", selected.imei || "-"],
                      ["Fecha de compra", selected.purchase_date ? String(selected.purchase_date).slice(0, 10) : "-"],
                      ["Características", safeChars(selected.characteristics) || "-"],
                      ["Frec. mantenimiento", `${selected.maintenance_frequency_months || 12} meses`],
                    ].map(([lbl, val]) => (
                      <div key={lbl} className="flex flex-col">
                        <span className="text-xs text-slate-400">{lbl}</span>
                        <span className="text-slate-800 font-medium truncate">{val}</span>
                      </div>
                    ))}
                    <div className="col-span-2 flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                      <FiLock size={10} /> Bloqueado — usa "Habilitar edición" para modificar
                    </div>
                  </div>
                )}
              </div>

              {/* Accessories */}
              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <SectionTitle icon={FiPackage}>Accesorios</SectionTitle>
                  <button
                    type="button"
                    onClick={() => { setShowAccForm((v) => !v); setEditingAccId(null); setAccForm({ name: "", brand: "", model: "", serial_number: "", imei: "", is_new: false, physical_condition: "", observations: "" }); }}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    {showAccForm ? <><FiX size={12} /> Cancelar</> : <><FiPlus size={12} /> Agregar accesorio</>}
                  </button>
                </div>
                {showAccForm && (
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Label required>Nombre</Label>
                        <input className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-slate-400" placeholder="Ej: Cargador, Mouse, Funda..." value={accForm.name} onChange={(e) => setAccForm((p) => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Marca</Label>
                        <input className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-slate-400" value={accForm.brand} onChange={(e) => setAccForm((p) => ({ ...p, brand: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Modelo</Label>
                        <input className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-slate-400" value={accForm.model} onChange={(e) => setAccForm((p) => ({ ...p, model: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Serie</Label>
                        <input className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-slate-400" value={accForm.serial_number} onChange={(e) => setAccForm((p) => ({ ...p, serial_number: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Estado (1-10)</Label>
                        <input type="number" min={1} max={10} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-slate-400" value={accForm.physical_condition} onChange={(e) => setAccForm((p) => ({ ...p, physical_condition: e.target.value }))} />
                      </div>
                      <div>
                        <Label>¿Es nuevo?</Label>
                        <select className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-slate-400" value={accForm.is_new ? "1" : "0"} onChange={(e) => setAccForm((p) => ({ ...p, is_new: e.target.value === "1" }))}>
                          <option value="0">Usado</option>
                          <option value="1">Nuevo</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <Label>Observaciones</Label>
                        <input className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-slate-400" value={accForm.observations} onChange={(e) => setAccForm((p) => ({ ...p, observations: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="primary" icon={FiCheck} disabled={saving} onClick={saveAccessory}>
                        {editingAccId ? "Actualizar" : "Agregar"}
                      </Button>
                    </div>
                  </div>
                )}
                {accessoriesLoading ? (
                  <p className="text-xs text-slate-400 text-center py-3">Cargando...</p>
                ) : accessories.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">Sin accesorios registrados</p>
                ) : (
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 uppercase text-[10px]">
                          <th className="px-3 py-2 text-left font-medium">Nombre</th>
                          <th className="px-3 py-2 text-left font-medium">Marca/Modelo</th>
                          <th className="px-3 py-2 text-left font-medium">Nuevo/Usado</th>
                          <th className="px-3 py-2 text-left font-medium">Estado</th>
                          <th className="px-3 py-2 text-left font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {accessories.map((acc, i) => (
                          <tr key={acc.id} className={`border-t border-slate-100 ${i % 2 === 1 ? "bg-slate-50" : ""}`}>
                            <td className="px-3 py-2 font-medium text-slate-800">{acc.name}</td>
                            <td className="px-3 py-2 text-slate-500">{[acc.brand, acc.model].filter(Boolean).join(" ") || "-"}</td>
                            <td className="px-3 py-2"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${acc.is_new ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{acc.is_new ? "Nuevo" : "Usado"}</span></td>
                            <td className="px-3 py-2 text-slate-600">{acc.physical_condition != null ? `${acc.physical_condition}/10` : "-"}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => startEditAccessory(acc)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><FiEdit2 size={11} /></button>
                                <button type="button" onClick={() => deleteAccessory(acc.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><FiTrash2 size={11} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Assignment */}
              <div className="border-t border-slate-100 pt-5">
                <SectionTitle icon={FiUser}>Asignación</SectionTitle>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{selected.assigned_to_name || "Sin asignación"}</p>
                    {selected.assigned_at && <p className="text-xs text-slate-400">Desde {new Date(selected.assigned_at).toLocaleDateString("es-EC")}</p>}
                  </div>
                  {canWrite && (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        icon={FiUser}
                        disabled={saving || (selected.status && !['available', 'unassigned'].includes(selected.status))}
                        title={selected.status && !['available', 'unassigned'].includes(selected.status) ? `No se puede asignar: equipo en estado "${selected.status}"` : undefined}
                        onClick={openAssignModal}
                      >
                        {selected.assigned_to_user_id ? "Reasignar" : "Asignar equipo"}
                      </Button>
                      {selected.assigned_to_user_id && (
                        <Button
                          type="button"
                          variant="secondary"
                          icon={FiX}
                          disabled={saving || selected.status !== 'assigned'}
                          title={selected.status !== 'assigned' ? `No se puede liberar: equipo no está asignado` : undefined}
                          onClick={() => {
                            setLiberatingAssetId(selected.id);
                            loadLiberationPhotos(selected.id);
                            setShowLiberateModal(true);
                          }}
                        >
                          Liberar
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <SectionTitle icon={FiShield}>Numero corporativo</SectionTitle>
                {!selectedIsMobile ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-medium text-slate-700">No aplica para este equipo</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      El numero corporativo solo puede asignarse a dispositivos celulares.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.01em] text-slate-400">Estado actual</p>
                        {corporateNumbersLoading ? (
                          <p className="mt-2 text-sm text-slate-500">Cargando numeros corporativos...</p>
                        ) : currentCorporateNumber ? (
                          <>
                            <p className="mt-1 font-mono text-base font-semibold text-slate-900">{currentCorporateNumber.number}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Vinculado al dispositivo y listo para trazabilidad operativa.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mt-1 text-sm font-medium text-slate-700">Sin numero asignado</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Selecciona un numero disponible para este celular.
                            </p>
                          </>
                        )}
                      </div>
                      <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        currentCorporateNumber ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {currentCorporateNumber ? "Activo" : "Pendiente"}
                      </span>
                    </div>

                    {!canManageCorporateNumber ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-sm font-medium text-slate-700">Accion restringida</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          Solo los roles <span className="font-semibold text-slate-700">ti</span> y <span className="font-semibold text-slate-700">jefe_ti</span> pueden asignar o cambiar numeros corporativos.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="space-y-3">
                          <div>
                            <Label required>{currentCorporateNumber ? "Cambiar numero" : "Asignar numero"}</Label>
                            <select
                              value={selectedCorporateNumberId}
                              onChange={(e) => setSelectedCorporateNumberId(e.target.value)}
                              disabled={corporateNumbersLoading || availableCorporateNumbers.length === 0}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="">
                                {corporateNumbersLoading
                                  ? "Cargando numeros..."
                                  : availableCorporateNumbers.length
                                  ? "Selecciona un numero disponible"
                                  : "No hay numeros disponibles"}
                              </option>
                              {availableCorporateNumbers.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.number}
                                </option>
                              ))}
                            </select>
                          </div>
                          {currentCorporateNumber ? (
                            <div>
                              <Label>Motivo del cambio</Label>
                              <input
                                type="text"
                                value={corporateChangeReason}
                                onChange={(e) => setCorporateChangeReason(e.target.value)}
                                placeholder="Ej: reposicion de linea o cambio operativo"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="primary"
                            icon={FiCheck}
                            disabled={saving || corporateNumbersLoading || !selectedCorporateNumberId}
                            onClick={saveCorporateNumberAssignment}
                          >
                            {currentCorporateNumber ? "Actualizar numero" : "Asignar numero"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status */}
              {canWrite && (
                <div className="border-t border-slate-100 pt-5">
                  <SectionTitle icon={FiAlertCircle}>Estado del equipo</SectionTitle>
                  <div className="flex gap-2">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                    >
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving}
                      onClick={doStatus}
                    >
                      Actualizar
                    </Button>
                  </div>
                </div>
              )}

              {/* History */}
              <div className="border-t border-slate-100 pt-5">
                <SectionTitle icon={FiClock}>Historial de eventos</SectionTitle>
                <div className="max-h-48 overflow-auto rounded-xl border border-slate-100 bg-slate-50">
                  {historyLoading ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Cargando...
                    </p>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Sin eventos registrados
                    </p>
                  ) : (
                    history.map((h, i) => (
                      <div
                        key={h.id}
                        className={`px-3 py-2.5 text-xs ${
                          i < history.length - 1 ? "border-b border-slate-100" : ""
                        }`}
                      >
                        <p className="font-medium text-slate-700">{h.event_type}</p>
                        {h.notes && (
                          <p className="text-slate-500 mt-0.5">{h.notes}</p>
                        )}
                        <p className="text-slate-400 mt-0.5">
                          {new Date(h.created_at).toLocaleString("es-EC", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <SectionTitle icon={FiUser}>Historial de asignación</SectionTitle>
                <div className="max-h-56 overflow-auto rounded-xl border border-slate-100 bg-slate-50">
                  {historyLoading ? (
                    <p className="text-xs text-slate-400 text-center py-4">Cargando...</p>
                  ) : assignmentsHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">Sin movimientos de asignación</p>
                  ) : (
                    assignmentsHistory.map((a, i) => (
                      <div key={a.id} className={`px-3 py-2.5 text-xs ${i < assignmentsHistory.length - 1 ? "border-b border-slate-100" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-700">
                              {a.action === "unassign"
                                ? `Liberado por ${a.created_by_name || "usuario"}`
                                : `Asignado a ${a.assigned_to_name || "usuario"} por ${a.created_by_name || "usuario"}`}
                            </p>
                            <p className="text-slate-500 mt-0.5">Antes: {a.previous_user_name || "Sin asignación"} · Ahora: {a.assigned_to_name || "Sin asignación"}</p>
                            {a.reason ? <p className="text-slate-500 mt-0.5">Motivo: {a.reason}</p> : null}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <p className="text-slate-400">{new Date(a.created_at).toLocaleString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                              {a.sin_acta && (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Sin acta</span>
                              )}
                            </div>
                          </div>
                          {a.sin_acta && (
                            <div className="shrink-0">
                              {a.evidence_drive_file_id || a.evidence_file_url ? (
                                <button
                                  type="button"
                                  onClick={() => openAssignmentEvidence(a)}
                                  className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700 hover:bg-green-100 transition-colors"
                                >
                                  <FiCheck size={9} /> Evidencia
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEvidenceModal({ assignmentId: a.id, label: `Asignación #${a.id}` })}
                                  className="flex items-center gap-1 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                                >
                                  <FiFileText size={9} /> Subir evidencia
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actas generadas */}
              <div className="border-t border-slate-100 pt-5">
                <SectionTitle icon={FiFileText}>Actas generadas</SectionTitle>
                {actasLoading ? (
                  <p className="text-xs text-slate-400 text-center py-3">Cargando actas...</p>
                ) : actas.length === 0 ? (
                  legacyNoActaAssignment ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                      <div className="flex items-start gap-2">
                        <FiAlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-amber-800">Acta histórica previa a SPI</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                            Esta entrega fue registrada antes de que el sistema generara actas automáticamente. Finanzas debe cargar aquí el PDF del acta firmada para dejarlo vinculado al equipo.
                          </p>
                          {canUploadLegacyActa && (
                            <label className="mt-2 inline-flex cursor-pointer">
                              <span className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors">
                                {uploadingActaId === `legacy-${legacyNoActaAssignment.id}`
                                  ? <FiRefreshCw size={11} className="animate-spin" />
                                  : <FiDownload size={11} className="rotate-180" />}
                                Subir acta firmada histórica
                              </span>
                              <input type="file" accept=".pdf,application/pdf" className="hidden"
                                disabled={uploadingActaId !== null}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLegacySignedActaUpload(legacyNoActaAssignment.id, f); e.target.value = ""; }} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-3">Sin actas generadas para este equipo</p>
                  )
                ) : (
                  <div className="space-y-2">
                    {legacyNoActaAssignment && (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-[11px] leading-relaxed text-amber-800">Acta histórica previa a SPI. Puedes reemplazar el PDF firmado si es necesario.</p>
                        <label className="inline-flex shrink-0 cursor-pointer">
                          <span className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors">
                            {uploadingActaId === `legacy-${legacyNoActaAssignment.id}`
                              ? <FiRefreshCw size={11} className="animate-spin" />
                              : <FiDownload size={11} className="rotate-180" />}
                            Reemplazar
                          </span>
                          <input type="file" accept=".pdf,application/pdf" className="hidden"
                            disabled={uploadingActaId !== null}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLegacySignedActaUpload(legacyNoActaAssignment.id, f); e.target.value = ""; }} />
                        </label>
                      </div>
                    )}
                    {actas.map((acta) => (
                      <div key={acta.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${acta.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                                {acta.tipo}
                              </span>
                              <span className="text-xs font-medium text-slate-700">{acta.acta_code || `#${String(acta.id).padStart(6, "0")}`}</span>
                              {acta.is_complete ? (
                                <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                  <FiCheck size={9} /> Firmada
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  Pendiente firma
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{acta.recipient_nombre || "Sin nombre"} · {acta.recipient_cargo || "-"}</p>
                            <p className="text-[10px] text-slate-400">{new Date(acta.generated_at).toLocaleString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDownloadActaPdf(acta.id, acta.tipo)}
                              disabled={downloadingActaPdf === acta.id}
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors whitespace-nowrap cursor-pointer disabled:cursor-wait disabled:opacity-60"
                            >
                              {downloadingActaPdf === acta.id ? <FiRefreshCw size={10} className="animate-spin" /> : <FiDownload size={10} />} PDF
                            </button>
                            {!acta.is_complete && !acta.signed_at && !acta.signed_pdf_drive_file_id && !acta.signed_pdf_sha256 && (
                              <button
                                type="button"
                                onClick={() => setEditingActa(acta)}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <FiEdit2 size={10} /> Editar
                              </button>
                            )}
                            {!acta.is_complete && !acta.signed_at && !acta.signed_pdf_drive_file_id && !acta.signed_pdf_sha256 && !acta.signature_workflow_id && (
                              <button
                                type="button"
                                onClick={() => setWorkflowActa(acta)}
                                className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <FiShield size={10} /> Firma
                              </button>
                            )}
                            {acta.signature_workflow_id && !acta.is_complete && (
                              <span className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 whitespace-nowrap">
                                <FiRefreshCw size={10} /> En firma
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Upload firmada */}
                        {!acta.is_complete ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                              {uploadingActaId === acta.id ? (
                                <><FiRefreshCw size={11} className="animate-spin" /> Subiendo...</>
                              ) : (
                                <><FiDownload size={11} className="rotate-180" /> Subir acta firmada (PDF)</>
                              )}
                            </span>
                            <input type="file" accept=".pdf,application/pdf" className="hidden"
                              disabled={uploadingActaId === acta.id}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSignedActaUpload(acta.id, f); e.target.value = ""; }}
                            />
                          </label>
                        ) : (
                          acta.signed_pdf_drive_url && (
                            <a href={acta.signed_pdf_drive_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-green-700 hover:underline">
                              <FiDownload size={10} /> Ver acta firmada en Drive
                            </a>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales actas */}
      <TiActaEditModal
        open={Boolean(editingActa)}
        acta={editingActa}
        onClose={() => setEditingActa(null)}
        onSaved={async () => { setEditingActa(null); if (selected) await loadActas(selected.id); }}
      />
      <TiWorkflowStartModal
        open={Boolean(workflowActa)}
        acta={workflowActa}
        users={users}
        submitting={startingWorkflow}
        onClose={() => setWorkflowActa(null)}
        onSubmit={handleStartWorkflow}
      />
      {downloadingActaPdf !== null && (
        <div className="fixed inset-0 z-[30] flex items-center justify-center bg-[#0F172A]/60">
          <div className="z-[40] flex flex-col items-center gap-5 rounded-2xl border border-[#E5E7EB] bg-white px-10 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]">
            <FiRefreshCw size={28} className="animate-spin text-[#2563EB]" />
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[17px] font-semibold leading-snug tracking-tight text-[#1F2937]">Generando PDF</span>
              <span className="max-w-[260px] text-[13px] leading-relaxed text-[#6B7280]">Preparando el acta en Google Docs. Esto puede tomar unos segundos.</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de asignacion / retiro con acta */}
      <Modal
        open={showAssignModal}
        onClose={() => { setShowAssignModal(false); setAssignSkipActa(false); }}
        title={assignModal.assigned_to_user_id ? "Asignación de equipo" : "Retiro de equipo"}
        maxWidth="max-w-3xl"
      >
        <div className="overflow-auto px-6 py-4 space-y-5" style={{ maxHeight: "65vh" }}>

          {/* Toggle Con acta / Sin acta */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Tipo de registro</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAssignSkipActa(false)}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                  !assignSkipActa
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                Con acta
                <p className="text-[10px] font-normal mt-0.5 opacity-70">Genera documento firmable</p>
              </button>
              <button
                type="button"
                onClick={() => setAssignSkipActa(true)}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                  assignSkipActa
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                Sin acta
                <p className="text-[10px] font-normal mt-0.5 opacity-70">Solo registra la asignación</p>
              </button>
            </div>
            {assignSkipActa && (
              <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                La asignación quedará registrada sin acta. Puedes adjuntar la evidencia de entrega desde el historial de asignaciones del equipo.
              </p>
            )}
          </div>

              {/* Datos del colaborador */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Datos del colaborador</p>
                  {/* Profile source indicator */}
                  {recipientLoading && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <FiRefreshCw size={10} className="animate-spin" /> Cargando perfil...
                    </span>
                  )}
                  {!recipientLoading && recipientSource === "profile" && (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      <FiCheck size={9} /> Datos del perfil — editables
                    </span>
                  )}
                  {!recipientLoading && recipientSource === "partial" && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Perfil incompleto — completa cédula y cargo
                    </span>
                  )}
                  {!recipientLoading && recipientSource === "empty" && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Sin perfil registrado — ingresa los datos manualmente
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Colaborador</Label>
                    <select
                      value={assignModal.assigned_to_user_id}
                      onChange={(e) => handleModalUserChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                    >
                      <option value="">Sin asignación (retiro)</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.fullname || u.name || u.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label required>Nombre completo</Label>
                    <input
                      className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-900 focus:outline-none transition-colors ${
                        recipientLoading
                          ? "border-slate-200 bg-slate-100 text-slate-400"
                          : "border-slate-200 bg-white focus:border-blue-400"
                      }`}
                      placeholder="Ej: María Fernanda González Ortega"
                      value={assignModal.recipient_nombre}
                      disabled={recipientLoading}
                      onChange={(e) => setAssignModal((p) => ({ ...p, recipient_nombre: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label required>Cédula</Label>
                    <input
                      className={`w-full rounded-xl border px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none transition-colors ${
                        recipientLoading
                          ? "border-slate-200 bg-slate-100 text-slate-400"
                          : !assignModal.recipient_cedula
                          ? "border-amber-200 bg-amber-50 focus:border-blue-400 focus:bg-white"
                          : "border-slate-200 bg-white focus:border-blue-400"
                      }`}
                      placeholder="10 dígitos"
                      value={assignModal.recipient_cedula}
                      disabled={recipientLoading}
                      onChange={(e) => setAssignModal((p) => ({ ...p, recipient_cedula: e.target.value }))}
                    />
                    {!recipientLoading && !assignModal.recipient_cedula && assignModal.assigned_to_user_id && (
                      <p className="mt-1 text-[10px] text-amber-600">Cédula no encontrada en el perfil — ingresa manualmente</p>
                    )}
                  </div>
                  <div>
                    <Label required>Cargo</Label>
                    <input
                      className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-900 focus:outline-none transition-colors ${
                        recipientLoading
                          ? "border-slate-200 bg-slate-100 text-slate-400"
                          : !assignModal.recipient_cargo
                          ? "border-amber-200 bg-amber-50 focus:border-blue-400 focus:bg-white"
                          : "border-slate-200 bg-white focus:border-blue-400"
                      }`}
                      placeholder="Ej: Analista Comercial"
                      value={assignModal.recipient_cargo}
                      disabled={recipientLoading}
                      onChange={(e) => setAssignModal((p) => ({ ...p, recipient_cargo: e.target.value }))}
                    />
                    {!recipientLoading && !assignModal.recipient_cargo && assignModal.assigned_to_user_id && (
                      <p className="mt-1 text-[10px] text-amber-600">Cargo no encontrado en el perfil — ingresa manualmente</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Motivo</Label>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-colors"
                      placeholder="Motivo de la asignación / retiro"
                      value={assignModal.reason}
                      onChange={(e) => setAssignModal((p) => ({ ...p, reason: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Hint about editability */}
                <p className="mt-2 text-[10px] text-slate-400">
                  Los datos se cargan automáticamente del perfil del colaborador registrado en el sistema. Puedes editarlos antes de generar el acta.
                </p>
              </div>

              {/* Tabla de inventario del acta */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Inventario y estado de activos</p>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-white text-[10px] uppercase">
                        <th className="px-2 py-2 text-left font-medium w-7">No.</th>
                        <th className="px-2 py-2 text-left font-medium">Equipo/Accesorio</th>
                        <th className="px-2 py-2 text-left font-medium">Marca/Modelo</th>
                        <th className="px-2 py-2 text-left font-medium">Serie/IMEI</th>
                        <th className="px-2 py-2 text-left font-medium w-24">¿Nuevo o Usado?</th>
                        <th className="px-2 py-2 text-left font-medium w-20">Estado (1-10)</th>
                        <th className="px-2 py-2 text-left font-medium">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignModal.acta_items.map((item, idx) => (
                        <tr key={idx} className={`border-t border-slate-100 ${idx % 2 === 1 ? "bg-slate-50" : ""}`}>
                          <td className="px-2 py-2 text-slate-500 text-center">{idx + 1}</td>
                          <td className="px-2 py-2">
                            <p className="font-medium text-slate-800">{item.name}</p>
                            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${item.item_type === "equipo" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                              {item.item_type === "equipo" ? "Equipo" : "Accesorio"}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-slate-500">{item.brand_model || "-"}</td>
                          <td className="px-2 py-2 text-slate-500 font-mono text-[10px]">{item.serial_imei || "-"}</td>
                          <td className="px-2 py-2">
                            <select
                              value={item.is_new ? "1" : "0"}
                              onChange={(e) => {
                                const updated = [...assignModal.acta_items];
                                updated[idx] = { ...updated[idx], is_new: e.target.value === "1" };
                                setAssignModal((p) => ({ ...p, acta_items: updated }));
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs focus:outline-none focus:border-slate-400"
                            >
                              <option value="0">Usado</option>
                              <option value="1">Nuevo</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={1}
                              max={10}
                              placeholder="-"
                              value={item.physical_condition ?? ""}
                              onChange={(e) => {
                                const updated = [...assignModal.acta_items];
                                updated[idx] = { ...updated[idx], physical_condition: e.target.value };
                                setAssignModal((p) => ({ ...p, acta_items: updated }));
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs focus:outline-none focus:border-slate-400"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              placeholder="Observación..."
                              value={item.observations || ""}
                              onChange={(e) => {
                                const updated = [...assignModal.acta_items];
                                updated[idx] = { ...updated[idx], observations: e.target.value };
                                setAssignModal((p) => ({ ...p, acta_items: updated }));
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs focus:outline-none focus:border-slate-400"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Los campos Equipo/Accesorio, Marca/Modelo y Serie/IMEI se generan automáticamente del registro del activo.</p>
              </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button type="button" variant="secondary" onClick={() => setShowAssignModal(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" icon={FiFileText} disabled={saving} onClick={doAssign}>
            {saving ? "Guardando..." : "Confirmar y generar acta"}
          </Button>
        </div>
      </Modal>

      {/* ─? Modal de asignación múltiple ─?─?─?─?─?─?─?─?─?─?─?─?─?─?─?─?─? */}
      <Modal
        open={showBatchAssignModal}
        onClose={() => { setShowBatchAssignModal(false); setBatchSkipActa(false); }}
        title={batchAssignForm.assigned_to_user_id ? "Asignar múltiples equipos" : "Liberar múltiples equipos"}
        maxWidth="max-w-2xl"
      >
        <div className="overflow-auto px-6 py-4 space-y-5" style={{ maxHeight: "65vh" }}>

          {/* Toggle Con acta / Sin acta */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Tipo de registro</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBatchSkipActa(false)}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                  !batchSkipActa
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                Con acta
                <p className="text-[10px] font-normal mt-0.5 opacity-70">Genera documento firmable</p>
              </button>
              <button
                type="button"
                onClick={() => setBatchSkipActa(true)}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                  batchSkipActa
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                Sin acta
                <p className="text-[10px] font-normal mt-0.5 opacity-70">Solo registra la asignación</p>
              </button>
            </div>
            {batchSkipActa && (
              <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                La asignación quedará registrada sin acta. Puedes adjuntar la evidencia de entrega desde el historial de asignaciones de cada equipo.
              </p>
            )}
          </div>

          {/* Datos del colaborador */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Datos del colaborador</p>
              {batchRecipientLoading && (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <FiRefreshCw size={10} className="animate-spin" /> Cargando perfil...
                </span>
              )}
              {!batchRecipientLoading && batchRecipientSource === "profile" && (
                <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                  <FiCheck size={9} /> Datos del perfil — editables
                </span>
              )}
              {!batchRecipientLoading && batchRecipientSource === "partial" && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Perfil incompleto — completa cédula y cargo
                </span>
              )}
              {!batchRecipientLoading && batchRecipientSource === "empty" && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  Sin perfil registrado — ingresa los datos manualmente
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Colaborador</Label>
                <select
                  value={batchAssignForm.assigned_to_user_id}
                  onChange={(e) => {
                    const userId = e.target.value;
                    setBatchAssignForm((p) => ({ ...p, assigned_to_user_id: userId }));
                    if (userId) {
                      const user = users.find((u) => String(u.id) === String(userId));
                      fetchAndFillBatchRecipient(userId, user?.fullname || user?.name || "");
                    } else {
                      setBatchRecipientSource(null);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                >
                  <option value="">Sin asignación (liberar)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullname || u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label required>Nombre completo</Label>
                <input
                  className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-900 focus:outline-none transition-colors ${
                    batchRecipientLoading
                      ? "border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-200 bg-white focus:border-blue-400"
                  }`}
                  placeholder="Ej: María Fernanda González Ortega"
                  value={batchAssignForm.recipient_nombre}
                  disabled={batchRecipientLoading}
                  onChange={(e) => setBatchAssignForm((p) => ({ ...p, recipient_nombre: e.target.value }))}
                />
              </div>
              <div>
                <Label required>Cédula</Label>
                <input
                  className={`w-full rounded-xl border px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none transition-colors ${
                    batchRecipientLoading
                      ? "border-slate-200 bg-slate-100 text-slate-400"
                      : !batchAssignForm.recipient_cedula
                      ? "border-amber-200 bg-amber-50 focus:border-blue-400 focus:bg-white"
                      : "border-slate-200 bg-white focus:border-blue-400"
                  }`}
                  placeholder="10 dígitos"
                  value={batchAssignForm.recipient_cedula}
                  disabled={batchRecipientLoading}
                  onChange={(e) => setBatchAssignForm((p) => ({ ...p, recipient_cedula: e.target.value }))}
                />
              </div>
              <div>
                <Label required>Cargo</Label>
                <input
                  className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-900 focus:outline-none transition-colors ${
                    batchRecipientLoading
                      ? "border-slate-200 bg-slate-100 text-slate-400"
                      : !batchAssignForm.recipient_cargo
                      ? "border-amber-200 bg-amber-50 focus:border-blue-400 focus:bg-white"
                      : "border-slate-200 bg-white focus:border-blue-400"
                  }`}
                  placeholder="Ej: Analista Comercial"
                  value={batchAssignForm.recipient_cargo}
                  disabled={batchRecipientLoading}
                  onChange={(e) => setBatchAssignForm((p) => ({ ...p, recipient_cargo: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Motivo</Label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-colors"
                  placeholder="Motivo de la asignación / retiro"
                  value={batchAssignForm.reason}
                  onChange={(e) => setBatchAssignForm((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>
            </div>

            <p className="mt-2 text-[10px] text-slate-400">
              Se generará una acta con todos los {selectedAssets.size} equipo{selectedAssets.size !== 1 ? 's' : ''} seleccionado{selectedAssets.size !== 1 ? 's' : ''} y sus accesorios.
            </p>
          </div>

          {/* Inventario de equipos con estado */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Inventario y estado de activos</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white text-[10px] uppercase">
                    <th className="px-2 py-2 text-left font-medium w-7">No.</th>
                    <th className="px-2 py-2 text-left font-medium">Equipo</th>
                    <th className="px-2 py-2 text-left font-medium">Marca/Modelo</th>
                    <th className="px-2 py-2 text-left font-medium w-24">¿Nuevo o Usado?</th>
                    <th className="px-2 py-2 text-left font-medium w-20">Estado (1-10)</th>
                    <th className="px-2 py-2 text-left font-medium">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(selectedAssets).map((assetId, idx) => {
                    const asset = assets.find((a) => a.id === assetId);
                    if (!asset) return null;

                    // Get or initialize item data
                    const itemKey = `asset-${assetId}`;
                    const itemData = batchAssignForm[itemKey] || { is_new: null, physical_condition: null, observations: "" };

                    return (
                      <tr key={assetId} className={`border-t border-slate-100 ${idx % 2 === 1 ? "bg-slate-50" : ""}`}>
                        <td className="px-2 py-2 text-slate-500 text-center">{idx + 1}</td>
                        <td className="px-2 py-2">
                          <p className="font-medium text-slate-800">{asset.name}</p>
                          <span className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-blue-50 text-blue-600">
                            Equipo
                          </span>
                        </td>
                        <td className="px-2 py-2 text-slate-500">{[asset.brand, asset.model].filter(Boolean).join(" ") || "-"}</td>
                        <td className="px-2 py-2">
                          <select
                            value={itemData.is_new ? "1" : "0"}
                            onChange={(e) => {
                              setBatchAssignForm((p) => ({
                                ...p,
                                [itemKey]: { ...itemData, is_new: e.target.value === "1" }
                              }));
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs focus:outline-none focus:border-slate-400"
                          >
                            <option value="0">Usado</option>
                            <option value="1">Nuevo</option>
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={1}
                            max={10}
                            placeholder="-"
                            value={itemData.physical_condition ?? ""}
                            onChange={(e) => {
                              setBatchAssignForm((p) => ({
                                ...p,
                                [itemKey]: { ...itemData, physical_condition: e.target.value }
                              }));
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs focus:outline-none focus:border-slate-400"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            placeholder="Observación..."
                            value={itemData.observations || ""}
                            onChange={(e) => {
                              setBatchAssignForm((p) => ({
                                ...p,
                                [itemKey]: { ...itemData, observations: e.target.value }
                              }));
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs focus:outline-none focus:border-slate-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Completa el estado de cada equipo. Los datos se incluirán en el acta.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button type="button" variant="secondary" onClick={() => setShowBatchAssignModal(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" icon={FiFileText} disabled={saving} onClick={doBatchAssign}>
            {saving ? "Guardando..." : "Confirmar y generar acta"}
          </Button>
        </div>
      </Modal>

      {/* Modal subir evidencia sin acta */}
      <Modal
        open={!!evidenceModal}
        onClose={() => { setEvidenceModal(null); setEvidenceFile(null); }}
        title="Subir evidencia de entrega"
        maxWidth="max-w-sm"
      >
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            Adjunta la evidencia física de entrega para la asignación <span className="font-medium text-slate-800">{evidenceModal?.label}</span>.
            Puede ser una firma escaneada, correo impreso, foto del acta manual, etc.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Archivo <span className="text-slate-400">(PDF, imagen)</span>
            </label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {evidenceFile && (
              <p className="mt-1.5 text-xs text-green-700 font-medium">{evidenceFile.name}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button variant="ghost" onClick={() => { setEvidenceModal(null); setEvidenceFile(null); }}>Cancelar</Button>
          <Button
            variant="primary"
            icon={FiFileText}
            disabled={!evidenceFile || evidenceSaving}
            onClick={async () => {
              setEvidenceSaving(true);
              try {
                await uploadAssignmentEvidence(evidenceModal.assignmentId, evidenceFile);
                showToast("Evidencia adjuntada correctamente", "success");
                setEvidenceModal(null);
                setEvidenceFile(null);
                if (selected) loadHistory(selected.id);
              } catch (err) {
                showToast(err?.response?.data?.message || "No se pudo subir el archivo", "error");
              } finally {
                setEvidenceSaving(false);
              }
            }}
          >
            {evidenceSaving ? "Subiendo..." : "Adjuntar evidencia"}
          </Button>
        </div>
      </Modal>

      {/* FASE 6: Modal de liberación de equipo */}
      <Modal
        open={showLiberateModal}
        onClose={() => {
          setShowLiberateModal(false);
          setLiberateForm({ notes: "", photoFiles: [], photoPreviews: [] });
        }}
        title="Liberar equipo"
        maxWidth="max-w-lg"
      >
        <div className="overflow-auto px-6 py-4 space-y-4" style={{ maxHeight: "75vh" }}>
          <p className="text-sm text-slate-600">
            Se requieren <span className="font-semibold">mínimo 2 fotos</span> del estado del equipo para generar el acta de retiro.
          </p>

          {/* Multi-photo upload */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 block mb-2">
              Fotografías del equipo{" "}
              <span className={liberateForm.photoFiles.length >= 2 ? "text-green-500" : "text-red-400"}>
                ({liberateForm.photoFiles.length}/mín. 2)
              </span>
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;
                const previews = [];
                let loaded = 0;
                files.forEach((file, idx) => {
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    previews[idx] = evt.target?.result;
                    loaded++;
                    if (loaded === files.length) {
                      setLiberateForm((p) => ({
                        ...p,
                        photoFiles: [...p.photoFiles, ...files],
                        photoPreviews: [...p.photoPreviews, ...previews],
                      }));
                    }
                  };
                  reader.readAsDataURL(file);
                });
              }}
              className="w-full text-xs cursor-pointer border border-dashed border-slate-300 rounded-xl px-3 py-2 bg-slate-50 hover:bg-slate-100 transition"
            />
            {liberateForm.photoPreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {liberateForm.photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200">
                    <img src={src} alt={`Foto ${idx + 1}`} className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      onClick={() => setLiberateForm((p) => ({
                        ...p,
                        photoFiles: p.photoFiles.filter((_, i) => i !== idx),
                        photoPreviews: p.photoPreviews.filter((_, i) => i !== idx),
                      }))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      —
                    </button>
                    <p className="text-[9px] text-slate-400 text-center py-0.5">Foto {idx + 1}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 block mb-2">
              Observaciones (opcional)
            </label>
            <textarea
              value={liberateForm.notes}
              onChange={(e) => setLiberateForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Estado del equipo, rayones, daños, etc."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
              rows={3}
            />
          </div>

          {/* Liberation photos history */}
          {liberationPhotosLoading ? (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">Cargando evidencias de liberaciones anteriores...</p>
            </div>
          ) : null}

          {liberationPhotos.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Fotos de liberaciones anteriores ({liberationPhotos.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {liberationPhotos.map((photo) => (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => openLiberationPhoto(photo.id)}
                    title={`${new Date(photo.liberated_at).toLocaleDateString("es-EC")} · ${photo.liberated_by_name || ""}`}
                    className="block overflow-hidden rounded-lg border border-slate-200 transition hover:border-blue-400"
                  >
                    {liberationPhotoPreviewUrls[String(photo.id)] ? (
                      <img
                        src={liberationPhotoPreviewUrls[String(photo.id)]}
                        alt="Evidencia de liberacion"
                        className="w-full h-20 object-cover"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-20 bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                        Sin preview
                      </div>
                    )}
                    <p className="text-[9px] text-slate-500 px-1.5 py-1 truncate">
                      {new Date(photo.liberated_at).toLocaleDateString("es-EC")}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button type="button" variant="secondary" onClick={() => setShowLiberateModal(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={FiCheck}
            disabled={saving || liberateForm.photoFiles.length < 2}
            onClick={doLiberateAsset}
          >
            {saving ? "Procesando..." : "Generar acta de retiro"}
          </Button>
        </div>
      </Modal>

      </>
      )}

      {activeTab === 'numeros-corporativos' && (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.01em] text-slate-400">Total</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{corporateNumbers.length}</p>
            <p className="mt-1 text-xs text-slate-500">Numeros registrados en inventario TI.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.01em] text-slate-400">Disponibles</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-emerald-700">
              {corporateNumbers.filter((item) => String(item.status || "").toLowerCase() === "available").length}
            </p>
            <p className="mt-1 text-xs text-slate-500">Listos para asignarse a celulares.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.01em] text-slate-400">Asignados</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-blue-700">
              {corporateNumbers.filter((item) => String(item.status || "").toLowerCase() === "assigned").length}
            </p>
            <p className="mt-1 text-xs text-slate-500">Vinculados a equipo y colaborador.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.01em] text-slate-400">Inactivos</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-amber-700">
              {corporateNumbers.filter((item) => String(item.status || "").toLowerCase() === "inactive").length}
            </p>
            <p className="mt-1 text-xs text-slate-500">Reservados fuera de uso operativo.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6 xl:self-start">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingCorporateId ? "Editar numero corporativo" : "Nuevo numero corporativo"}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Administra el inventario de lineas y deja listas solo las que TI debe operar.
                </p>
              </div>
              {(showCorporateCreate || editingCorporateId) ? (
                <button
                  type="button"
                  onClick={resetCorporateEditor}
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
              ) : null}
            </div>

            {!canWrite ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Modo solo lectura</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Tu rol puede consultar el inventario de lineas, pero no crear ni editar numeros corporativos.
                </p>
              </div>
            ) : !showCorporateCreate && !editingCorporateId ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Alta controlada</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Registra un nuevo numero y luego podras asignarlo solo desde TI o Jefe TI a un dispositivo celular.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  icon={FiPlus}
                  className="mt-4"
                  onClick={() => setShowCorporateCreate(true)}
                >
                  Agregar numero
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <Label required>Numero corporativo</Label>
                  <input
                    type="text"
                    value={corporateForm.number}
                    onChange={(e) => setCorporateForm((prev) => ({ ...prev, number: e.target.value }))}
                    placeholder="Ej: 0999999999"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
                {editingCorporateId ? (
                  <div>
                    <Label>Estado administrativo</Label>
                    <select
                      value={corporateForm.status}
                      onChange={(e) => setCorporateForm((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                    >
                      <option value="available">Disponible</option>
                      <option value="assigned">Asignado</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      Un numero asignado no puede pasar manualmente a otro estado mientras siga vinculado a un equipo.
                    </p>
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    icon={FiCheck}
                    disabled={saving}
                    onClick={submitCorporateNumber}
                  >
                    {editingCorporateId ? "Guardar cambios" : "Registrar numero"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Inventario de numeros corporativos</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Filtra por estado y revisa a que equipo celular y a que colaborador esta asociada cada linea.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_200px_auto]">
                  <div className="relative">
                    <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={corporateSearch}
                      onChange={(e) => setCorporateSearch(e.target.value)}
                      placeholder="Buscar por numero, equipo o colaborador"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>
                  <select
                    value={corporateFilterStatus}
                    onChange={(e) => setCorporateFilterStatus(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="available">Disponibles</option>
                    <option value="assigned">Asignados</option>
                    <option value="inactive">Inactivos</option>
                  </select>
                  <Button type="button" variant="secondary" icon={FiRefreshCw} onClick={loadCorporateNumbers}>
                    Recargar
                  </Button>
                </div>
              </div>
            </div>

            {corporateNumbersLoading ? (
              <div className="flex items-center justify-center py-16">
                <FiRefreshCw size={20} className="animate-spin text-slate-300" />
              </div>
            ) : filteredCorporateNumbers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FiShield size={32} className="text-slate-200" />
                <p className="mt-3 text-sm font-medium text-slate-500">Sin numeros para este filtro</p>
                <p className="mt-1 text-xs text-slate-400">Ajusta la busqueda o registra una nueva linea corporativa.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 p-4 lg:hidden">
                  {filteredCorporateNumbers.map((row) => {
                    const statusValue = String(row.status || "").toLowerCase();
                    const statusClass =
                      statusValue === "assigned"
                        ? "bg-blue-50 text-blue-700"
                        : statusValue === "inactive"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-700";
                    return (
                      <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-slate-900">{row.number}</p>
                            <p className="mt-1 text-xs text-slate-500">{row.asset_name || "Sin equipo asignado"}</p>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>
                            {statusValue === "assigned" ? "Asignado" : statusValue === "inactive" ? "Inactivo" : "Disponible"}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.01em] text-slate-400">Equipo</p>
                            <p className="mt-1 text-sm font-medium text-slate-800">{row.asset_name || "Sin asignar"}</p>
                            <p className="text-xs text-slate-500">{row.asset_code || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.01em] text-slate-400">Colaborador</p>
                            <p className="mt-1 text-sm font-medium text-slate-800">{row.assigned_user_name || "Sin colaborador"}</p>
                            <p className="text-xs text-slate-500">{row.assigned_user_cedula || row.assigned_user_department || "-"}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.01em] text-slate-400">Actualizado</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {row.updated_at
                                ? new Date(row.updated_at).toLocaleString("es-EC", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          {canWrite ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              icon={FiEdit2}
                              onClick={() => startEditCorporateNumber(row)}
                            >
                              Editar
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">Solo lectura</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden lg:block">
                  <div className="overflow-x-auto">
                    <table className="min-w-[920px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-[0.01em] text-slate-400">
                          <th className="px-4 py-3 font-medium">Numero</th>
                          <th className="px-4 py-3 font-medium">Estado</th>
                          <th className="px-4 py-3 font-medium">Equipo</th>
                          <th className="px-4 py-3 font-medium">Colaborador</th>
                          <th className="px-4 py-3 font-medium">Area</th>
                          <th className="px-4 py-3 font-medium">Actualizado</th>
                          <th className="px-4 py-3 font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCorporateNumbers.map((row) => {
                          const statusValue = String(row.status || "").toLowerCase();
                          const statusClass =
                            statusValue === "assigned"
                              ? "bg-blue-50 text-blue-700"
                              : statusValue === "inactive"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-green-50 text-green-700";
                          return (
                            <tr key={row.id} className="border-b border-slate-50 align-top transition-colors hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <p className="font-mono text-sm font-semibold text-slate-900">{row.number}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                                  {statusValue === "assigned" ? "Asignado" : statusValue === "inactive" ? "Inactivo" : "Disponible"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {row.asset_name ? (
                                  <>
                                    <p className="text-sm font-medium text-slate-800">{row.asset_name}</p>
                                    <p className="mt-0.5 text-xs text-slate-400">{row.asset_code || "Sin codigo"}</p>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-400">Sin asignar</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {row.assigned_user_name ? (
                                  <>
                                    <p className="text-sm font-medium text-slate-800">{row.assigned_user_name}</p>
                                    <p className="mt-0.5 text-xs text-slate-400">{row.assigned_user_cedula || "Sin cedula"}</p>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-400">Sin colaborador</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">{row.assigned_user_department || "-"}</td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                {row.updated_at
                                  ? new Date(row.updated_at).toLocaleString("es-EC", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "-"}
                              </td>
                              <td className="px-4 py-3">
                                {canWrite ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    icon={FiEdit2}
                                    onClick={() => startEditCorporateNumber(row)}
                                  >
                                    Editar
                                  </Button>
                                ) : (
                                  <span className="text-xs text-slate-400">Solo lectura</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </>
      )}

      {/* Tab: Cronograma */}
      {activeTab === 'cronograma' && (
        <>
          {/* Cronograma de mantenimiento */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FiCalendar size={15} className="text-slate-400" />
                <span className="text-sm font-semibold text-slate-800">Cronograma de mantenimiento</span>
                <span className="text-xs text-slate-400">({filteredMaintenance.length} de {maintenance.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="primary" icon={FiCalendar} disabled={saving} onClick={generateSchedules}>
                  Generar
                </Button>
                <button type="button" title="Actualizar cronograma" disabled={saving} onClick={refreshSchedules}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors active:scale-[0.97]">
                  <FiRefreshCw size={15} />
                </button>
                <button type="button" title="Programar mantenimiento manual" disabled={saving} onClick={() => setShowManualForm(true)}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors active:scale-[0.97]">
                  <FiPlus size={15} />
                </button>
                <button type="button" title="Eliminar todos los cronogramas" disabled={saving} onClick={clearMaintenanceSchedule}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors active:scale-[0.97]">
                  <FiTrash2 size={15} />
                </button>
              </div>
            </div>

            {/* Filtro por tipo */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
              <span className="text-xs text-slate-400 shrink-0">Filtrar:</span>
              {[{ key: "all", label: "Todos" }, { key: "computadora", label: "Computadoras" }, { key: "celular", label: "Celulares" }].map((f) => (
                <button key={f.key} type="button" onClick={() => setDeviceFilter(f.key)}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    deviceFilter === f.key ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              {filteredMaintenance.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <FiCalendar size={28} className="text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">
                    {maintenance.length === 0
                      ? `Sin cronogramas para ${year}. Usa "Generar" para crearlos.`
                      : "Sin resultados para este filtro."}
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-slate-400 border-b border-slate-100">
                      <th className="px-4 py-3 text-left font-medium">Equipo</th>
                      <th className="px-4 py-3 text-left font-medium">Asignado a</th>
                      <th className="px-4 py-3 text-left font-medium">Tipo</th>
                      <th className="px-4 py-3 text-left font-medium">Cumple</th>
                      <th className="px-4 py-3 text-left font-medium">Máximo</th>
                      <th className="px-4 py-3 text-left font-medium">Estado</th>
                      <th className="px-4 py-3 text-left font-medium sr-only">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaintenance.map((m) => {
                      const tipo = (String(m.notes || "").split("|")[0] || "Preventivo").trim();
                      const coordDate = m.coordinated_withdrawal_date ? String(m.coordinated_withdrawal_date).slice(0, 10) : null;
                      return (
                        <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800 leading-tight">{m.asset_name}</p>
                            {m.model && <p className="text-xs text-slate-400 mt-0.5">{m.model}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{m.assigned_to_name || "Sin asignar"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              tipo === "Correctivo" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                            }`}>{tipo}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs font-mono">
                            {new Date(m.planned_date).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="font-mono text-slate-600">
                              {m.max_due_date ? new Date(m.max_due_date).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                            </span>
                            {coordDate && <p className="text-[11px] text-slate-400 mt-0.5">Retiro: {coordDate}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              m.status === "completed" ? "bg-green-50 text-green-700"
                              : m.status === "overdue" ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-600"
                            }`}>
                              {MAINTENANCE_STATUS_LABELS[m.status] || m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {m.status !== "completed" ? (
                              <div className="flex items-center gap-1">
                                <button type="button" title="Coordinar fecha de retiro" disabled={saving} onClick={() => openCoordModal(m)}
                                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors active:scale-[0.97]">
                                  <FiCalendar size={13} />
                                </button>
                                <button type="button" title="Solicitar entrega para mantenimiento" disabled={saving} onClick={() => requestMaintenanceDelivery(m.id)}
                                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors active:scale-[0.97]">
                                  <FiTruck size={13} />
                                </button>
                                <button type="button" title="Marcar como completado" disabled={saving} onClick={() => completeMaintenanceRow(m.id)}
                                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-green-50 hover:text-green-700 hover:border-green-200 disabled:opacity-50 transition-colors active:scale-[0.97]">
                                  <FiCheck size={13} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Completado</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Calendario colapsible */}
            <div className="border-t border-slate-100">
              <button type="button" onClick={() => setShowCalendar((v) => !v)}
                className="cursor-pointer flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <FiCalendar size={14} className="text-slate-400" />
                  <span>Calendario mensual</span>
                  {!showCalendar && (
                    <span className="text-xs text-slate-400 font-normal">
                      - {monthStart.toLocaleDateString("es-EC", { month: "long", year: "numeric" })}
                    </span>
                  )}
                </div>
                {showCalendar ? <FiChevronUp size={15} className="text-slate-400" /> : <FiChevronDown size={15} className="text-slate-400" />}
              </button>
              {showCalendar && (
                <div className="px-4 pb-4 border-t border-slate-100">
                  <div className="flex items-center justify-end gap-2 py-3">
                    <button type="button" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                      &larr;
                    </button>
                    <span className="text-sm text-slate-600 min-w-[140px] text-center">
                      {monthStart.toLocaleDateString("es-EC", { month: "long", year: "numeric" })}
                    </span>
                    <button type="button" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                      &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-xs text-slate-500 mb-1">
                    {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => (
                      <div key={d} className="px-1 py-1 font-semibold text-center">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((d) => {
                      const key = d.toISOString().slice(0, 10);
                      const dayItems = maintenanceByDate[key] || [];
                      const inMonth = d.getMonth() === monthStart.getMonth() && d.getFullYear() === monthStart.getFullYear();
                      return (
                        <div key={key} className={`min-h-[80px] rounded-xl border p-1.5 ${inMonth ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100"}`}>
                          <p className={`text-[11px] mb-1 font-medium ${inMonth ? "text-slate-700" : "text-slate-400"}`}>{d.getDate()}</p>
                          <div className="space-y-1">
                            {dayItems.slice(0, 2).map((item) => {
                              const tipoItem = (String(item.notes || "").split("|")[0] || "Preventivo").trim();
                              const cls = item.status === "completed"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : item.status === "overdue"
                                ? "bg-red-50 border-red-200 text-red-700"
                                : "bg-blue-50 border-blue-200 text-blue-700";
                              return (
                                <div key={item.id} className={`rounded border px-1 py-0.5 text-[10px] leading-tight ${cls}`}>
                                  <p className="font-semibold truncate">{item.asset_name}</p>
                                  <p className="truncate opacity-80">{tipoItem}</p>
                                </div>
                              );
                            })}
                            {dayItems.length > 2 && <p className="text-[10px] text-slate-400">+{dayItems.length - 2}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informes de cronograma */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FiFileText size={15} className="text-slate-400" />
                <span className="text-sm font-semibold text-slate-800">Informes de cronograma</span>
                <span className="text-xs text-slate-400">({reports.length})</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={reportPeriodType} onChange={(e) => setReportPeriodType(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none">
                  <option value="annual">Anual</option>
                  <option value="monthly">Mensual</option>
                </select>
                <input type="number" min={2020} max={2100} value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value || new Date().getFullYear()))}
                  className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none" />
                {reportPeriodType === "monthly" && (
                  <select value={reportMonth} onChange={(e) => setReportMonth(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                    ))}
                  </select>
                )}
                <Button type="button" variant="primary" icon={FiFileText} disabled={generatingReport} onClick={handleGenerateReport}>
                  {generatingReport ? "Generando..." : "Generar informe"}
                </Button>
                <button type="button" title="Recargar informes" onClick={loadReports}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 transition-colors active:scale-[0.97]">
                  <FiRefreshCw size={15} />
                </button>
              </div>
            </div>
            {reportsLoading ? (
              <p className="text-sm text-slate-400 text-center py-8">Cargando informes...</p>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <FiFileText size={28} className="text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">No hay informes generados. El sistema los genera automáticamente cada mes.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-slate-400 border-b border-slate-100">
                      <th className="px-4 py-3 text-left font-medium">Período</th>
                      <th className="px-4 py-3 text-left font-medium">Generado</th>
                      <th className="px-4 py-3 text-left font-medium">Por</th>
                      <th className="px-4 py-3 text-left font-medium">Equipos</th>
                      <th className="px-4 py-3 text-left font-medium">SHA-256</th>
                      <th className="px-4 py-3 text-left font-medium">Drive</th>
                      <th className="px-4 py-3 text-left font-medium">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {String(r.period || "").match(/^\d{4}-\d{2}$/) ? `Mes ${r.period}` : `Año ${r.period}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                          {new Date(r.generated_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{r.generated_by_name || "Sistema"}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{r.assets_count ?? "-"}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer"
                            title={r.sha256} onClick={() => navigator.clipboard?.writeText(r.sha256)}>
                            {String(r.sha256 || "").slice(0, 12)}.
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.drive_url ? (
                            <a href={r.drive_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Ver</a>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button type="button"
                            onClick={() => String(r.period || "").match(/^\d{4}-\d{2}$/)
                              ? downloadTiMaintenanceReport({ period_type: "monthly", year: Number(String(r.period).slice(0, 4)), month: Number(String(r.period).slice(5, 7)) })
                              : downloadTiMaintenanceReport({ period_type: "annual", year: Number(r.period) })}
                            className="cursor-pointer inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900">
                            <FiDownload size={12} /> PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal: Programar mantenimiento manual */}
          <Modal open={showManualForm} onClose={saving ? undefined : () => setShowManualForm(false)} title="Programar mantenimiento" maxWidth="max-w-lg">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Equipo *</label>
                <select value={manualForm.asset_id} onChange={(e) => setManualForm((p) => ({ ...p, asset_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-colors">
                  <option value="">Selecciona equipo</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.brand ? ` · ${a.brand}` : ""}{a.model ? ` ${a.model}` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Tipo</label>
                  <select value={manualForm.tipo} onChange={(e) => setManualForm((p) => ({ ...p, tipo: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-colors">
                    <option value="Preventivo">Preventivo</option>
                    <option value="Correctivo">Correctivo</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Fecha programada *</label>
                  <input type="date" value={manualForm.fecha_programada} onChange={(e) => setManualForm((p) => ({ ...p, fecha_programada: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-colors" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Responsable</label>
                <input type="text" placeholder="Nombre del responsable" value={manualForm.responsable} onChange={(e) => setManualForm((p) => ({ ...p, responsable: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Observaciones</label>
                <input type="text" placeholder="Notas adicionales" value={manualForm.observaciones} onChange={(e) => setManualForm((p) => ({ ...p, observaciones: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none transition-colors" />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowManualForm(false)} disabled={saving}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button type="button" onClick={createManualMaintenance} disabled={saving}
                  className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving ? "Guardando..." : "Programar"}
                </button>
              </div>
            </div>
          </Modal>

          {/* Modal: Coordinar fecha de retiro */}
          <Modal open={!!coordModal} onClose={saving ? undefined : () => setCoordModal(null)} title="Coordinar retiro" maxWidth="max-w-sm">
            <div className="space-y-4">
              {coordModal && (
                <p className="text-sm text-slate-600">
                  Equipo: <span className="font-medium text-slate-800">{coordModal.assetName}</span>
                </p>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Fecha coordinada de retiro *</label>
                <input type="date" value={coordModalDate} onChange={(e) => setCoordModalDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-colors" />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setCoordModal(null)} disabled={saving}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button type="button" onClick={saveCoordinationDate} disabled={saving}
                  className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}

      {/* Tab: Todas las actas */}
      {activeTab === 'todas-actas' && (
        <TIActasView />
      )}
    </div>
  );
};

export default TIDeviceManagementPage;
