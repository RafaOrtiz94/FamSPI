import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle, FiBarChart2, FiCalendar, FiCheck, FiChevronDown,
  FiChevronRight, FiChevronUp, FiCpu, FiDownload, FiEdit2, FiFileText,
  FiInfo, FiPackage, FiPlus, FiRefreshCw, FiSearch, FiShield,
  FiUploadCloud, FiUser, FiUsers, FiX,
} from "react-icons/fi";
import { useUI } from "../../../core/ui/UIContext";
import Modal from "../../../core/ui/components/Modal";
import { useAuth } from "../../../core/auth/AuthContext";
import { getUsers, getSignerCandidates } from "../../../core/api/usersApi";
import {
  listCollabCatalog, createCollabCatalogItem, updateCollabCatalogItem,
  listCollabRenewals, completeCollabRenewal,
  listCollabSessions, createCollabSession, updateCollabSession, getCollabSession,
  getCollabActaRecipientInfo,
  createCollabTiSession, listCollabDeliveriesByUser, listCollabSessionsByUser,
  listCollabDeliveryDocsByUser, listCollabDeliveryDocs, uploadCollabDeliveryDoc,
  getCollabFullReport, getCollabCollaboratorReport,
  getCollabActaSignatureWorkflow, startCollabActaSignatureWorkflow,
  downloadCollabFullReportPdf, downloadCollabCollaboratorReportPdf,
} from "../../../core/api/collabDeliveriesApi";
import {
  listTiAssets, createTiAsset,
  getTiAssetAssignmentsHistory, listTiActas, listTiAllActas, getTiActa, updateTiActa,
  getTiActaSignatureWorkflow,
  listTiFinancialDocs, uploadTiFinancialDoc,
  getTiActaPdf, downloadTiActa, downloadTiAssetReport, downloadTiCollaboratorReport,
  downloadTiMaintenanceReport, startTiActaSignatureWorkflow,
} from "../../../core/api/tiAssetsApi";
import { downloadSignatureWorkflowFinalPdf, validateSignerProfiles } from "../../../core/api/signatureWorkflowsApi";

// ── Constantes ────────────────────────────────────────────────────────────────

const COLLAB_CATEGORIES = ["ropa", "epp", "herramienta", "logistica", "suministros"];

const TALLAS = ["XS","S","M","L","XL","XXL","XXXL","28","30","32","34","36","38","40","42","44","46"];
const UNIDADES = ["unidad","par","juego","caja","resma","paquete","rollo"];

// Campos estandarizados por categoría — fuente de verdad para catálogo y sesiones.
// Tipos especiales: "serial" → serial_number, "condition" → physical_condition, "renewal" → renewal_date.
// Tipos de atributo: "text", "date", "number", "talla_select", "unidad_select".
const CATEGORY_FIELDS = {
  ropa: [
    { key: "talla",    label: "Talla",               type: "talla_select" },
    { key: "color",    label: "Color",               type: "text" },
    { key: "cantidad", label: "Cantidad",            type: "number" },
    { key: "_renewal", label: "Fecha de renovación", type: "renewal" },
  ],
  epp: [
    { key: "marca",               label: "Marca",               type: "text" },
    { key: "referencia",          label: "Referencia / Modelo", type: "text" },
    { key: "talla",               label: "Talla",               type: "text" },
    { key: "norma_certificacion", label: "Norma / Certificación",type: "text" },
    { key: "fecha_expedicion",    label: "Fecha expedición",    type: "date" },
    { key: "fecha_expiracion",    label: "Fecha vencimiento",   type: "date" },
    { key: "_serial",    label: "N° de serie",       type: "serial" },
    { key: "_condition", label: "Condición (1-10)",  type: "condition" },
    { key: "_renewal",   label: "Fecha de renovación",type: "renewal" },
  ],
  herramienta: [
    { key: "marca",           label: "Marca",           type: "text" },
    { key: "modelo",          label: "Modelo",          type: "text" },
    { key: "caracteristicas", label: "Características", type: "text" },
    { key: "_serial",    label: "N° de serie",       type: "serial" },
    { key: "_condition", label: "Condición (1-10)",  type: "condition" },
    { key: "_renewal",   label: "Fecha de renovación",type: "renewal" },
  ],
  logistica: [
    { key: "marca",           label: "Marca / Banco",   type: "text" },
    { key: "referencia",      label: "Referencia / N°", type: "text" },
    { key: "caracteristicas", label: "Características", type: "text" },
    { key: "_renewal",        label: "Fecha de renovación",type: "renewal" },
  ],
  suministros: [
    { key: "cantidad", label: "Cantidad", type: "number" },
    { key: "unidad",   label: "Unidad",   type: "unidad_select" },
  ],
};

// Permisos por rol: qué categorías y tipos puede gestionar cada rol
const ROLE_SESSION_PERMISSIONS = {
  financiero:      { logistica: ["entrega","retiro"], suministros: ["entrega","retiro"] },
  jefe_financiero: { logistica: ["entrega","retiro"], suministros: ["entrega","retiro"] },
  talento_humano:  { ropa: ["entrega","retiro"], epp: ["entrega","retiro"], herramienta: ["entrega","retiro"], suministros: ["entrega","retiro"] },
  jefe_tecnico:    { herramienta: ["entrega","retiro"] },
};
const FULL_ACCESS_ROLES = ["financiero","jefe_financiero"];

function getRolePerms(role) {
  return ROLE_SESSION_PERMISSIONS[role] || ROLE_SESSION_PERMISSIONS["financiero"];
}
function canCreateSessions(role) {
  return role in ROLE_SESSION_PERMISSIONS;
}
const CATEGORY_LABELS = {
  ropa: "Ropa de trabajo", epp: "EPP", herramienta: "Herramientas de trabajo",
  logistica: "Logística", ti: "Herramientas de comunicación",
  suministros: "Suministros de oficina",
};
const CATEGORY_COLORS = {
  ropa:        "bg-slate-100 text-slate-600 border-slate-200",
  epp:         "bg-orange-50 text-orange-700 border-orange-100",
  herramienta: "bg-amber-50 text-amber-700 border-amber-100",
  logistica:   "bg-blue-100 text-blue-700 border-blue-200",
  ti:          "bg-violet-50 text-violet-700 border-violet-200",
  suministros: "bg-green-50 text-green-700 border-green-200",
};
const COLLAB_STATUS_COLORS = {
  entregado: "bg-green-50 text-green-700",
  retirado:  "bg-slate-100 text-slate-500",
  perdido:   "bg-red-50 text-red-700",
  dañado:    "bg-amber-50 text-amber-700",
};
const TI_STATUS_LABELS = {
  unassigned: "Sin asignar", assigned: "Asignado", damaged: "Dañado",
  in_maintenance: "En mantenimiento", retired: "Dado de baja", available: "Disponible",
  disponible: "Disponible", asignado: "Asignado", mantenimiento: "Mantenimiento",
  baja: "Dado de baja", extraviado: "Extraviado",
};
const TI_STATUS_COLORS = {
  unassigned:    "bg-slate-100 text-slate-600",
  assigned:      "bg-blue-50 text-blue-700",
  damaged:       "bg-red-50 text-red-700",
  in_maintenance:"bg-amber-50 text-amber-700",
  retired:       "bg-slate-200 text-slate-500",
  available:     "bg-green-50 text-green-700",
  disponible:    "bg-green-50 text-green-700",
  asignado:      "bg-blue-50 text-blue-700",
  mantenimiento: "bg-amber-50 text-amber-700",
  baja:          "bg-red-50 text-red-600",
  extraviado:    "bg-red-100 text-red-800",
};
const SIGNATURE_WORKFLOW_STYLES = {
  prepared: "bg-slate-100 text-slate-700",
  sent: "bg-blue-50 text-blue-700",
  in_progress: "bg-indigo-50 text-indigo-700",
  partially_signed: "bg-violet-50 text-violet-700",
  completed: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-slate-200 text-slate-700",
};

// ── Micro-componentes ─────────────────────────────────────────────────────────

const CategoryBadge = ({ category }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[category] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
    {CATEGORY_LABELS[category] || category}
  </span>
);

const TiStatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TI_STATUS_COLORS[status] || "bg-slate-100 text-slate-600"}`}>
    {TI_STATUS_LABELS[status] || status}
  </span>
);

const SignatureWorkflowBadge = ({ status, isComplete }) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized) {
    return (
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SIGNATURE_WORKFLOW_STYLES[normalized] || "bg-slate-100 text-slate-700"}`}>
        {normalized.replace(/_/g, " ")}
      </span>
    );
  }
  if (isComplete) {
    return (
      <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
        <FiCheck size={9} /> Firmada
      </span>
    );
  }
  return <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>;
};

const SectionLabel = ({ children }) => (
  <p className="text-xs font-semibold text-slate-400 mb-3">{children}</p>
);

const EmptyState = ({ icon: Icon, message }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <Icon size={28} className="text-slate-200 mb-2" />
    <p className="text-sm text-slate-400">{message}</p>
  </div>
);

const RenewalBadge = ({ date }) => {
  if (!date) return null;
  const days = Math.ceil((new Date(date) - new Date()) / 86400000);
  const color = days < 0 ? "bg-red-50 text-red-700" : days <= 30 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
      <FiCalendar size={9} />
      {days < 0 ? `Vencida ${Math.abs(days)}d` : days === 0 ? "Vence hoy" : `${days}d`}
    </span>
  );
};

const DepBar = ({ pct }) => {
  if (pct == null) return null;
  const color = pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-green-500";
  const textColor = pct >= 90 ? "text-red-600" : pct >= 60 ? "text-amber-600" : "text-green-600";
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
        <span>Depreciación</span>
        <span className={`font-semibold ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
};

const fieldCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none";
const labelCls = "text-xs font-semibold text-slate-500 block mb-1";

const WORKFLOW_ROLE_OPTIONS = [
  { value: "colaborador_receptor", label: "Colaborador receptor" },
  { value: "talento_humano", label: "Talento Humano" },
  { value: "gerencia_general", label: "Gerencia General" },
  { value: "firmante", label: "Firmante" },
];

function buildWorkflowSignerDraft(user = null, role = "firmante") {
  return {
    selectedUserId: user?.id ? String(user.id) : "",
    role,
    isRequired: true,
  };
}

function CollabWorkflowStartModal({ open, acta, session, users = [], submitting, onClose, onSubmit }) {
  const { showToast } = useUI();
  const [profileWarnings, setProfileWarnings] = useState([]);
  const [validating, setValidating] = useState(false);

  const recommendedSigners = useMemo(() => {
    if (!session) return [];
    const collaborator = users.find((user) => String(user.id) === String(session.user_id));
    const talentoHumano = users.find((user) => ["talento_humano", "jefe_talento_humano"].includes(String(user.role || "").toLowerCase()));
    const gerenciaGeneral = users.find((user) => ["gerencia_general", "gerente_general", "director", "gerencia"].includes(String(user.role || "").toLowerCase()));
    return [
      buildWorkflowSignerDraft(collaborator, "colaborador_receptor"),
      buildWorkflowSignerDraft(talentoHumano, "talento_humano"),
      buildWorkflowSignerDraft(gerenciaGeneral, "gerencia_general"),
    ];
  }, [session, users]);

  const [signers, setSigners] = useState([buildWorkflowSignerDraft()]);

  useEffect(() => {
    if (!open) return;
    const seeded = recommendedSigners.filter((signer) => signer.selectedUserId);
    setSigners(seeded.length ? seeded : [buildWorkflowSignerDraft()]);
  }, [open, recommendedSigners]);

  const setSigner = (index, patch) => {
    setProfileWarnings([]);
    setSigners((current) => current.map((signer, signerIndex) => (
      signerIndex === index ? { ...signer, ...patch } : signer
    )));
  };

  const addSigner = () => {
    setProfileWarnings([]);
    setSigners((current) => [...current, buildWorkflowSignerDraft()]);
  };

  const removeSigner = (index) => {
    setProfileWarnings([]);
    setSigners((current) => current.filter((_, signerIndex) => signerIndex !== index));
  };

  const handleSubmit = async () => {
    if (!acta?.id) return;
    if (!signers.length) {
      showToast("Debes agregar al menos un firmante", "warning");
      return;
    }

    const seenUserIds = new Set();
    let payloadSigners;
    try {
      payloadSigners = signers.map((signer, index) => {
        const selectedUser = users.find((user) => String(user.id) === String(signer.selectedUserId || ""));
        if (!selectedUser?.email) throw new Error(`Firmante ${index + 1}: selecciona un usuario válido`);
        if (seenUserIds.has(String(selectedUser.id))) throw new Error(`Firmante ${index + 1}: el usuario ya fue seleccionado`);
        seenUserIds.add(String(selectedUser.id));
        return {
          user_id: selectedUser.id,
          email: selectedUser.email,
          name: selectedUser.fullname || selectedUser.name || selectedUser.email,
          role: signer.role || "firmante",
          sequence_order: index + 1,
          is_required: signer.isRequired !== false,
        };
      });
    } catch (err) {
      showToast(err.message, "warning");
      return;
    }

    // Validar fichas TH antes de crear el workflow
    setValidating(true);
    setProfileWarnings([]);
    try {
      const userIds = payloadSigners.map((s) => s.user_id);
      const incomplete = await validateSignerProfiles(userIds);
      if (incomplete.length > 0) {
        setProfileWarnings(incomplete);
        return;
      }
    } catch {
      // Si el endpoint falla, continuar — no bloquear por error de red
    } finally {
      setValidating(false);
    }

    onSubmit?.({ signers: payloadSigners });
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      disableClose={submitting}
      title="Iniciar firma colectiva"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category="herramienta" />
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Entrega</span>
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-mono text-slate-600">{acta?.acta_code || `#${acta?.id || ""}`}</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900">{session?.collaborator_name || "Colaborador"}</p>
          <p className="text-xs text-slate-500">
            Selecciona el orden de firma. El workflow solo se enviará a los usuarios elegidos aquí.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Firmantes</p>
              <p className="text-xs text-slate-500">El orden de la lista define la secuencia de firma.</p>
            </div>
            <button
              type="button"
              onClick={addSigner}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97]"
            >
              Agregar firmante
            </button>
          </div>

          {signers.map((signer, index) => (
            <div key={`${signer.selectedUserId || "new"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Firmante {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeSigner(index)}
                  disabled={submitting || signers.length === 1}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={labelCls}>Usuario</span>
                  <select
                    value={signer.selectedUserId}
                    onChange={(event) => setSigner(index, { selectedUserId: event.target.value })}
                    className={fieldCls}
                    disabled={submitting}
                  >
                    <option value="">Selecciona un usuario</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {(user.fullname || user.name || user.email)}{user.role ? ` · ${user.role}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={labelCls}>Rol documental</span>
                  <select
                    value={signer.role}
                    onChange={(event) => setSigner(index, { role: event.target.value })}
                    className={fieldCls}
                    disabled={submitting}
                  >
                    {WORKFLOW_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={signer.isRequired !== false}
                  onChange={(event) => setSigner(index, { isRequired: event.target.checked })}
                  disabled={submitting}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                />
                Firma obligatoria
              </label>
            </div>
          ))}
        </div>

        {profileWarnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <FiAlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-amber-800">
                  Ficha incompleta — solicita a Talento Humano completar los datos antes de continuar
                </p>
                <ul className="mt-2 space-y-1.5">
                  {profileWarnings.map((w) => (
                    <li key={w.user_id} className="text-amber-700">
                      <span className="font-medium">{w.fullname || w.email}</span>
                      {" — faltan: "}
                      <span className="font-medium">{w.missing.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || validating}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || validating || profileWarnings.length > 0}
            className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {validating ? "Validando fichas..." : submitting ? "Iniciando..." : "Iniciar firma colectiva"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal crear sesión ────────────────────────────────────────────────────────

const EMPTY_ITEM = { catalog_item_id: "", serial_number: "", physical_condition: "", observations: "", renewal_date: "", attributes: {} };

function createEmptySessionItem() {
  return { ...EMPTY_ITEM, attributes: {} };
}

function mapDeliveryToSessionItem(delivery) {
  return {
    catalog_item_id: delivery?.catalog_item_id ? String(delivery.catalog_item_id) : "",
    serial_number: delivery?.serial_number || "",
    physical_condition: delivery?.physical_condition != null ? String(delivery.physical_condition) : "",
    observations: delivery?.observations || "",
    renewal_date: delivery?.renewal_date ? String(delivery.renewal_date).slice(0, 10) : "",
    attributes: delivery?.attributes && typeof delivery.attributes === "object" ? { ...delivery.attributes } : {},
  };
}

function SessionModal({ catalog, users, tiAssets, onSave, onClose, actorRole }) {
  const { showToast } = useUI();
  const [step, setStep]         = useState(1);
  const [sessionType, setType]  = useState("");
  const [userId, setUserId]     = useState("");
  const [sessionDate, setDate]  = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo]         = useState("entrega");
  const [notes, setNotes]       = useState("");
  const [items, setItems]       = useState([createEmptySessionItem()]);
  const [tiSelected, setTiSel] = useState([]);
  const [tiSearch, setTiSearch] = useState("");
  const [saving, setSaving]     = useState(false);

  // Recipient info (ficha TH como fuente de verdad, editable si está incompleta)
  const [recipientNombre, setRecipientNombre] = useState("");
  const [recipientCedula, setRecipientCedula] = useState("");
  const [recipientCargo,  setRecipientCargo]  = useState("");
  const [recipientSource, setRecipientSource] = useState(null); // "profile" | "partial" | "empty"
  const [recipientLoading, setRecipientLoading] = useState(false);

  const fetchRecipientInfo = async (uid) => {
    if (!uid) { setRecipientNombre(""); setRecipientCedula(""); setRecipientCargo(""); setRecipientSource(null); return; }
    setRecipientLoading(true);
    try {
      const info = await getCollabActaRecipientInfo(uid);
      setRecipientNombre(info?.nombre || "");
      setRecipientCedula(info?.cedula || "");
      setRecipientCargo(info?.cargo  || "");
      if (info?.cedula && info?.cargo) setRecipientSource("profile");
      else if (info?.nombre)           setRecipientSource("partial");
      else                             setRecipientSource("empty");
    } catch { setRecipientSource("empty"); }
    finally { setRecipientLoading(false); }
  };

  const isTi = sessionType === "ti";
  const rolePerms = getRolePerms(actorRole);
  const isFullAccess = FULL_ACCESS_ROLES.includes(actorRole);
  const catCatalog = useMemo(() => catalog.filter((c) => c.category === sessionType && c.active !== false), [catalog, sessionType]);

  const addItem = () => setItems((p) => [...p, createEmptySessionItem()]);
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i));
  const setItem = (i, key, val) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  const setAttr = (i, key, val) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, attributes: { ...it.attributes, [key]: val } } : it));
  const toggleTi = (id) => setTiSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const filteredTi = useMemo(() => {
    const q = tiSearch.toLowerCase();
    return tiAssets.filter((a) =>
      (a.name || a.nombre || "").toLowerCase().includes(q) ||
      (a.brand || a.marca || "").toLowerCase().includes(q) ||
      (a.serial_number || a.numero_serie || "").toLowerCase().includes(q),
    ).slice(0, 60);
  }, [tiAssets, tiSearch]);

  const handleSave = async () => {
    if (!sessionType) return showToast("Selecciona un tipo de sesión", "warning");
    if (!userId) return showToast("Selecciona un colaborador", "warning");
    if (isTi && !tiSelected.length) return showToast("Selecciona al menos un activo TI", "warning");
    if (!isTi) {
      for (const [i, it] of items.entries()) {
        if (!it.catalog_item_id) return showToast(`Ítem ${i + 1}: selecciona del catálogo`, "warning");
        const cat = catalog.find((c) => String(c.id) === String(it.catalog_item_id));
        const schema = cat?.attribute_schema || {};
        const needsSerial = "_serial" in schema || cat?.requires_serial;
        if (needsSerial && !it.serial_number.trim()) return showToast(`Ítem ${i + 1} (${cat?.name}): requiere número de serie`, "warning");
      }
    }
    if (!recipientNombre.trim()) return showToast("Ingresa el nombre completo del colaborador", "warning");
    if (!recipientCedula.trim()) return showToast("Ingresa la cédula del colaborador", "warning");
    if (!recipientCargo.trim())  return showToast("Ingresa el cargo del colaborador", "warning");
    setSaving(true);
    try {
      const recipientData = {
        recipient_nombre: recipientNombre.trim(),
        recipient_cedula: recipientCedula.trim(),
        recipient_cargo:  recipientCargo.trim(),
      };
      let result;
      if (isTi) {
        result = await createCollabTiSession({ user_id: Number(userId), session_date: sessionDate, tipo, notes: notes || null, asset_ids: tiSelected, ...recipientData });
      } else {
        result = await createCollabSession({
          user_id: Number(userId), category: sessionType, session_date: sessionDate, tipo, notes: notes || null,
          ...recipientData,
          items: items.map((it) => ({
            catalog_item_id: Number(it.catalog_item_id),
            serial_number: it.serial_number || null,
            physical_condition: it.physical_condition ? Number(it.physical_condition) : null,
            observations: it.observations || null,
            renewal_date: it.renewal_date || null,
            attributes: it.attributes || {},
          })),
        });
      }
      showToast("Sesión creada correctamente", "success");
      onSave(result);
    } catch (e) {
      showToast(e?.response?.data?.message || "Error al crear la sesión", "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-base font-semibold text-slate-900">Nueva sesión de entrega</p>
            <p className="text-xs text-slate-400 mt-0.5">Paso {step} de 3 — {step === 1 ? "Tipo de sesión" : step === 2 ? "Colaborador y fecha" : "Ítems a entregar"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"><FiX size={16} /></button>
        </div>
        <div className="flex px-6 pt-4 gap-2 shrink-0">
          {[1,2,3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${step > s ? "bg-green-500 border-green-500 text-white" : step === s ? "border-blue-600 text-blue-600" : "border-slate-200 text-slate-400"}`}>
                {step > s ? <FiCheck size={12} /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? "bg-green-400" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-5">
          {step === 1 && (
            <div className="space-y-3">
              <SectionLabel>¿Qué tipo de entrega es esta sesión?</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "ropa",        icon: FiPackage, desc: "Uniformes, calzado de seguridad" },
                  { key: "epp",         icon: FiShield,  desc: "Elementos de protección personal — genera acta" },
                  { key: "herramienta", icon: FiPackage, desc: "Herramientas manuales y eléctricas" },
                  { key: "logistica",   icon: FiPackage, desc: "Mochilas, candados, accesorios" },
                  { key: "suministros", icon: FiPackage, desc: "Papelería, útiles de oficina — sin acta" },
                  { key: "ti",          icon: FiCpu,     desc: "Celulares, laptops, tablets, equipos TI" },
                ].filter(({ key }) => key === "ti" ? isFullAccess : key in rolePerms)
                .map(({ key, icon: Icon, desc }) => (
                  <button key={key} type="button" onClick={() => {
                    setType(key);
                    // Si el rol no puede hacer retiro en esta categoría, forzar entrega
                    const tiposDisp = key === "ti" ? ["entrega","retiro"] : (rolePerms[key] || ["entrega"]);
                    if (!tiposDisp.includes(tipo)) setTipo(tiposDisp[0]);
                  }}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${sessionType === key ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <Icon size={18} className={sessionType === key ? "text-blue-600 mb-2" : "text-slate-400 mb-2"} />
                    <p className={`text-sm font-semibold ${sessionType === key ? "text-blue-700" : "text-slate-800"}`}>{CATEGORY_LABELS[key]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-3">
                {(() => {
                  const tiposDisp = sessionType && sessionType !== "ti"
                    ? (rolePerms[sessionType] || ["entrega","retiro"])
                    : ["entrega","retiro"];
                  return tiposDisp.map((t) => (
                    <label key={t} className={`flex items-center gap-2 cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${tipo === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>
                      <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
                      {t === "entrega" ? "Entrega" : "Retiro"}
                    </label>
                  ));
                })()}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <SectionLabel>Datos del colaborador y fecha</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Colaborador *</label>
                  <select value={userId} onChange={(e) => { setUserId(e.target.value); fetchRecipientInfo(e.target.value); }} className={fieldCls}>
                    <option value="">Selecciona...</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.fullname || u.name || u.email}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nombre completo *</label>
                  <input
                    className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-900 focus:outline-none transition-colors ${recipientLoading ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white focus:border-blue-400"}`}
                    placeholder="Ej: María Fernanda González Ortega"
                    value={recipientNombre}
                    disabled={recipientLoading}
                    onChange={(e) => setRecipientNombre(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Cédula *</label>
                  <input
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none transition-colors ${recipientLoading ? "border-slate-200 bg-slate-100 text-slate-400" : !recipientCedula ? "border-amber-200 bg-amber-50 focus:border-blue-400 focus:bg-white" : "border-slate-200 bg-white focus:border-blue-400"}`}
                    placeholder="10 dígitos"
                    value={recipientCedula}
                    disabled={recipientLoading}
                    onChange={(e) => setRecipientCedula(e.target.value)}
                  />
                  {!recipientLoading && !recipientCedula && userId && (
                    <p className="mt-1 text-[10px] text-amber-600">Cédula no encontrada en la ficha — ingresa manualmente</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Cargo *</label>
                  <input
                    className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-900 focus:outline-none transition-colors ${recipientLoading ? "border-slate-200 bg-slate-100 text-slate-400" : !recipientCargo ? "border-amber-200 bg-amber-50 focus:border-blue-400 focus:bg-white" : "border-slate-200 bg-white focus:border-blue-400"}`}
                    placeholder="Ej: Analista Comercial"
                    value={recipientCargo}
                    disabled={recipientLoading}
                    onChange={(e) => setRecipientCargo(e.target.value)}
                  />
                  {!recipientLoading && !recipientCargo && userId && (
                    <p className="mt-1 text-[10px] text-amber-600">Cargo no encontrado en la ficha — ingresa manualmente</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Fecha de {tipo}</label>
                  <input type="date" value={sessionDate} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Notas de sesión</label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional..." className={fieldCls} />
                </div>
              </div>
            </div>
          )}
          {step === 3 && !isTi && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>Ítems a incluir en la sesión</SectionLabel>
                <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <FiPlus size={12} /> Agregar ítem
                </button>
              </div>
              {items.map((it, i) => {
                const sel = catCatalog.find((c) => String(c.id) === String(it.catalog_item_id));
                const schema = sel?.attribute_schema || {};
                const catFields = CATEGORY_FIELDS[sessionType] || [];
                // Incluye campos especiales con retrocompat para ítems con formato antiguo
                const activeFields = catFields.filter(({ key }) => {
                  if (key === "_serial")    return "_serial" in schema || sel?.requires_serial;
                  if (key === "_condition") return "_condition" in schema || sel?.requires_condition;
                  return key in schema;
                });
                return (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-500">Ítem {i + 1}</p>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="rounded-lg p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><FiX size={12} /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Ítem del catálogo *</label>
                        <select value={it.catalog_item_id} onChange={(e) => setItem(i, "catalog_item_id", e.target.value)} className={fieldCls}>
                          <option value="">Selecciona...</option>
                          {catCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      {activeFields.map(({ key, label, type }) => {
                        const stored = schema[key];
                        const VALID = ["text","date","number","talla_select","unidad_select","serial","condition","renewal"];
                        const fieldType = VALID.includes(stored) ? stored : type;

                        if (fieldType === "serial") return (
                          <div key={key}>
                            <label className={labelCls}>N° de serie *</label>
                            <input type="text" value={it.serial_number} onChange={(e) => setItem(i, "serial_number", e.target.value)} placeholder="Ej: SN-ABC123" className={fieldCls} />
                          </div>
                        );
                        if (fieldType === "condition") return (
                          <div key={key}>
                            <label className={labelCls}>Condición física (1-10)</label>
                            <input type="number" min="1" max="10" value={it.physical_condition} onChange={(e) => setItem(i, "physical_condition", e.target.value)} className={fieldCls} />
                          </div>
                        );
                        if (fieldType === "renewal") return (
                          <div key={key}>
                            <label className={labelCls}>Fecha de renovación</label>
                            <input type="date" value={it.renewal_date} onChange={(e) => setItem(i, "renewal_date", e.target.value)} className={fieldCls} />
                          </div>
                        );
                        if (fieldType === "talla_select") return (
                          <div key={key}>
                            <label className={labelCls}>{label}</label>
                            <select value={it.attributes[key] || ""} onChange={(e) => setAttr(i, key, e.target.value)} className={fieldCls}>
                              <option value="">Selecciona talla...</option>
                              {TALLAS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        );
                        if (fieldType === "unidad_select") return (
                          <div key={key}>
                            <label className={labelCls}>{label}</label>
                            <select value={it.attributes[key] || ""} onChange={(e) => setAttr(i, key, e.target.value)} className={fieldCls}>
                              <option value="">Selecciona...</option>
                              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                        );
                        return (
                          <div key={key} className={key === "caracteristicas" ? "sm:col-span-2" : ""}>
                            <label className={labelCls}>{label}</label>
                            <input
                              type={fieldType === "date" ? "date" : fieldType === "number" ? "number" : "text"}
                              min={fieldType === "number" ? "1" : undefined}
                              step={fieldType === "number" ? "1" : undefined}
                              value={it.attributes[key] || ""}
                              onChange={(e) => setAttr(i, key, e.target.value)}
                              className={fieldCls}
                            />
                          </div>
                        );
                      })}
                      <div className={activeFields.length % 2 === 0 ? "sm:col-span-2" : ""}>
                        <label className={labelCls}>Observaciones</label>
                        <input type="text" value={it.observations} onChange={(e) => setItem(i, "observations", e.target.value)} placeholder="Opcional..." className={fieldCls} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className={`rounded-xl border p-3 text-xs ${sessionType === "suministros" ? "border-green-100 bg-green-50 text-green-700" : "border-slate-100 bg-slate-50 text-slate-500"}`}>
                {sessionType === "suministros"
                  ? <><span className="font-semibold">Sin acta.</span> Los suministros de oficina se registran sin generar acta de entrega.</>
                  : <>Se generará <span className="font-semibold text-slate-700">una sola acta</span> con todos estos ítems para <span className="font-semibold text-slate-700">{CATEGORY_LABELS[sessionType]}</span>.</>}
              </div>
            </div>
          )}
          {step === 3 && isTi && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>Selecciona los activos TI a entregar</SectionLabel>
                <span className="text-xs font-semibold text-blue-600">{tiSelected.length} seleccionado{tiSelected.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="relative">
                <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm focus:border-slate-400 focus:bg-white focus:outline-none"
                  placeholder="Buscar activo..." value={tiSearch} onChange={(e) => setTiSearch(e.target.value)} />
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
                {!filteredTi.length ? <p className="text-xs text-slate-400 p-4 text-center">Sin activos disponibles</p>
                  : filteredTi.map((a) => {
                    const isSelected = tiSelected.includes(a.id);
                    const st = a.status || a.estado || "";
                    const isAvail = ["available","unassigned","disponible"].includes(st);
                    return (
                      <label key={a.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${isSelected ? "bg-blue-50" : isAvail ? "hover:bg-slate-50" : "opacity-50 cursor-not-allowed"}`}>
                        <input type="checkbox" checked={isSelected} disabled={!isAvail && !isSelected} onChange={() => (isAvail || isSelected) && toggleTi(a.id)} className="rounded" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{a.name || a.nombre}</p>
                          <p className="text-xs text-slate-500">{a.brand || a.marca} {a.model || a.modelo} · {a.serial_number || a.numero_serie}</p>
                        </div>
                        <TiStatusBadge status={st} />
                      </label>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button type="button" onClick={() => step > 1 ? setStep((s) => s - 1) : onClose()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            {step === 1 ? "Cancelar" : "Atrás"}
          </button>
          {step < 3 ? (
            <button type="button" onClick={() => {
              if (step === 1 && !sessionType) return showToast("Selecciona un tipo de sesión", "warning");
              if (step === 2 && !userId) return showToast("Selecciona un colaborador", "warning");
              setStep((s) => s + 1);
            }} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Siguiente <FiChevronRight size={14} />
            </button>
          ) : (
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <FiCheck size={14} /> {saving ? "Creando..." : "Crear entrega y acta"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detalle de sesión ─────────────────────────────────────────────────────────

function EditCollabSessionModal({ open, session, catalog, onClose, onSaved }) {
  const { showToast } = useUI();
  const [sessionDate, setSessionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [recipientNombre, setRecipientNombre] = useState("");
  const [recipientCedula, setRecipientCedula] = useState("");
  const [recipientCargo, setRecipientCargo] = useState("");
  const [items, setItems] = useState([createEmptySessionItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    const primaryActa = session.actas?.[0] || null;
    setSessionDate(session.session_date ? String(session.session_date).slice(0, 10) : new Date().toISOString().slice(0, 10));
    setNotes(session.notes || "");
    setRecipientNombre(primaryActa?.recipient_nombre || session.collaborator_name || "");
    setRecipientCedula(primaryActa?.recipient_cedula || "");
    setRecipientCargo(primaryActa?.recipient_cargo || "");
    setItems(session.deliveries?.length ? session.deliveries.map(mapDeliveryToSessionItem) : [createEmptySessionItem()]);
  }, [open, session]);

  const category = session?.category || "";
  const catCatalog = useMemo(() => catalog.filter((item) => item.category === category && item.active !== false), [catalog, category]);

  const addItem = () => setItems((prev) => [...prev, createEmptySessionItem()]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, idx) => idx !== index));
  const setItem = (index, key, value) => setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  const setAttr = (index, key, value) => setItems((prev) => prev.map((item, idx) => (
    idx === index ? { ...item, attributes: { ...item.attributes, [key]: value } } : item
  )));

  const handleSave = async () => {
    if (!session?.id) return;
    if (!recipientNombre.trim()) return showToast("Ingresa el nombre completo del colaborador", "warning");
    if (!recipientCedula.trim()) return showToast("Ingresa la cédula del colaborador", "warning");
    if (!recipientCargo.trim()) return showToast("Ingresa el cargo del colaborador", "warning");
    if (!items.length) return showToast("Agrega al menos un ítem", "warning");

    for (const [index, item] of items.entries()) {
      if (!item.catalog_item_id) return showToast(`Ítem ${index + 1}: selecciona un ítem del catálogo`, "warning");
      const selectedCatalog = catCatalog.find((catalogItem) => String(catalogItem.id) === String(item.catalog_item_id));
      const schema = selectedCatalog?.attribute_schema || {};
      const requiresSerial = "_serial" in schema || selectedCatalog?.requires_serial;
      if (requiresSerial && !String(item.serial_number || "").trim()) {
        return showToast(`Ítem ${index + 1} (${selectedCatalog?.name || "catálogo"}): requiere número de serie`, "warning");
      }
    }

    setSaving(true);
    try {
      await updateCollabSession(session.id, {
        session_date: sessionDate || null,
        notes: notes.trim() || null,
        recipient_nombre: recipientNombre.trim(),
        recipient_cedula: recipientCedula.trim(),
        recipient_cargo: recipientCargo.trim(),
        items: items.map((item) => ({
          catalog_item_id: Number(item.catalog_item_id),
          serial_number: item.serial_number?.trim() || null,
          physical_condition: item.physical_condition ? Number(item.physical_condition) : null,
          observations: item.observations?.trim() || null,
          renewal_date: item.renewal_date || null,
          attributes: item.attributes || {},
        })),
      });
      showToast("Sesión actualizada correctamente", "success");
      await onSaved?.();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar la sesión", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Editar sesión" maxWidth="max-w-4xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={category} />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${session?.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{session?.tipo}</span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">{session?.collaborator_name}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Corrige la fecha, la cédula, el cargo o los ítems. Si la sesión ya tiene firma, workflow o documentos cargados, el backend bloqueará la edición.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre completo *</label>
            <input value={recipientNombre} onChange={(event) => setRecipientNombre(event.target.value)} className={fieldCls} placeholder="Nombre del colaborador" />
          </div>
          <div>
            <label className={labelCls}>Cédula *</label>
            <input value={recipientCedula} onChange={(event) => setRecipientCedula(event.target.value)} className={`${fieldCls} font-mono`} placeholder="10 dígitos" />
          </div>
          <div>
            <label className={labelCls}>Cargo *</label>
            <input value={recipientCargo} onChange={(event) => setRecipientCargo(event.target.value)} className={fieldCls} placeholder="Cargo del colaborador" />
          </div>
          <div>
            <label className={labelCls}>Fecha de sesión</label>
            <input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} className={fieldCls} placeholder="Opcional..." />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Ítems de la sesión</SectionLabel>
            <button type="button" onClick={addItem} className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97]">
              <span className="inline-flex items-center gap-1">
                <FiPlus size={12} />
                Agregar ítem
              </span>
            </button>
          </div>

          {items.map((item, index) => {
            const selectedCatalog = catCatalog.find((catalogItem) => String(catalogItem.id) === String(item.catalog_item_id));
            const schema = selectedCatalog?.attribute_schema || {};
            const categoryFields = CATEGORY_FIELDS[category] || [];
            const activeFields = categoryFields.filter(({ key }) => {
              if (key === "_serial") return "_serial" in schema || selectedCatalog?.requires_serial;
              if (key === "_condition") return "_condition" in schema || selectedCatalog?.requires_condition;
              return key in schema;
            });

            return (
              <div key={`${index}-${item.catalog_item_id || "nuevo"}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Ítem {index + 1}</p>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className="cursor-pointer rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 active:scale-[0.97]">
                      <FiX size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Ítem del catálogo *</label>
                    <select value={item.catalog_item_id} onChange={(event) => setItem(index, "catalog_item_id", event.target.value)} className={fieldCls}>
                      <option value="">Selecciona...</option>
                      {catCatalog.map((catalogItem) => <option key={catalogItem.id} value={catalogItem.id}>{catalogItem.name}</option>)}
                    </select>
                  </div>

                  {activeFields.map(({ key, label, type }) => {
                    const storedType = schema[key];
                    const fieldType = ["text", "date", "number", "talla_select", "unidad_select", "serial", "condition", "renewal"].includes(storedType) ? storedType : type;

                    if (fieldType === "serial") {
                      return (
                        <div key={key}>
                          <label className={labelCls}>N° de serie *</label>
                          <input value={item.serial_number} onChange={(event) => setItem(index, "serial_number", event.target.value)} className={fieldCls} placeholder="Ej: SN-ABC123" />
                        </div>
                      );
                    }
                    if (fieldType === "condition") {
                      return (
                        <div key={key}>
                          <label className={labelCls}>Condición física (1-10)</label>
                          <input type="number" min="1" max="10" value={item.physical_condition} onChange={(event) => setItem(index, "physical_condition", event.target.value)} className={fieldCls} />
                        </div>
                      );
                    }
                    if (fieldType === "renewal") {
                      return (
                        <div key={key}>
                          <label className={labelCls}>Fecha de renovación</label>
                          <input type="date" value={item.renewal_date} onChange={(event) => setItem(index, "renewal_date", event.target.value)} className={fieldCls} />
                        </div>
                      );
                    }
                    if (fieldType === "talla_select") {
                      return (
                        <div key={key}>
                          <label className={labelCls}>{label}</label>
                          <select value={item.attributes[key] || ""} onChange={(event) => setAttr(index, key, event.target.value)} className={fieldCls}>
                            <option value="">Selecciona talla...</option>
                            {TALLAS.map((talla) => <option key={talla} value={talla}>{talla}</option>)}
                          </select>
                        </div>
                      );
                    }
                    if (fieldType === "unidad_select") {
                      return (
                        <div key={key}>
                          <label className={labelCls}>{label}</label>
                          <select value={item.attributes[key] || ""} onChange={(event) => setAttr(index, key, event.target.value)} className={fieldCls}>
                            <option value="">Selecciona...</option>
                            {UNIDADES.map((unidad) => <option key={unidad} value={unidad}>{unidad}</option>)}
                          </select>
                        </div>
                      );
                    }
                    return (
                      <div key={key} className={key === "caracteristicas" ? "sm:col-span-2" : ""}>
                        <label className={labelCls}>{label}</label>
                        <input
                          type={fieldType === "date" ? "date" : fieldType === "number" ? "number" : "text"}
                          min={fieldType === "number" ? "1" : undefined}
                          step={fieldType === "number" ? "1" : undefined}
                          value={item.attributes[key] || ""}
                          onChange={(event) => setAttr(index, key, event.target.value)}
                          className={fieldCls}
                        />
                      </div>
                    );
                  })}

                  <div className={activeFields.length % 2 === 0 ? "sm:col-span-2" : ""}>
                    <label className={labelCls}>Observaciones</label>
                    <input value={item.observations} onChange={(event) => setItem(index, "observations", event.target.value)} className={fieldCls} placeholder="Opcional..." />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SessionDetail({ sessionId, onClose, availableUsers = [], catalog = [], onUpdated }) {
  const { showToast } = useUI();
  const navigate = useNavigate();
  const { user: sessionUser } = useAuth();
  const canInitiateWorkflow = canCreateSessions(sessionUser?.role || "") || ["admin", "administrador"].includes(String(sessionUser?.role || "").toLowerCase());
  const canEditSessions = canInitiateWorkflow;
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(null);
  const [workflowLoading, setWorkflowLoading] = useState(null);
  const [workflowStartActa, setWorkflowStartActa] = useState(null);
  const [startingWorkflow, setStartingWorkflow] = useState(false);
  const [downloadingFinalPdf, setDownloadingFinalPdf] = useState(null);
  const [downloadingActaPdf, setDownloadingActaPdf] = useState(null);
  const [editingSession, setEditingSession] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCollabSession(sessionId)
      .then(setData)
      .catch(() => showToast("No se pudo cargar la sesión", "error"))
      .finally(() => setLoading(false));
  }, [sessionId, showToast]);

  const handleDownload = async (actaId) => {
    setDownloadingActaPdf(actaId);
    try {
      const res = await import("../../../core/api/collabDeliveriesApi").then((m) => m.getCollabActaPdf(actaId));
      const blobUrl = window.URL.createObjectURL(res.blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = res.filename || `acta_${actaId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      showToast(e?.response?.data?.message || "No disponible", "info");
    } finally {
      setDownloadingActaPdf(null);
    }
  };

  const handleUpload = async (actaId, file) => {
    setUploading(actaId);
    try {
      await import("../../../core/api/collabDeliveriesApi").then((m) => m.uploadCollabSignedActa(actaId, file));
      showToast("Acta firmada subida", "success");
      const updated = await getCollabSession(sessionId);
      setData(updated);
    } catch (e) {
      showToast(e?.response?.data?.message || "Error al subir", "error");
    } finally { setUploading(null); }
  };

  const handleOpenWorkflow = async (acta) => {
    setWorkflowLoading(acta.id);
    try {
      let workflowId = Number(acta.signature_workflow_id || 0) || null;
      if (!workflowId) {
        const existing = await getCollabActaSignatureWorkflow(acta.id);
        workflowId = Number(existing?.workflow?.id || existing?.id || 0) || null;
      }
      if (!workflowId) throw new Error("Workflow no disponible");
      navigate(`/dashboard/signatures/workflows/${workflowId}`);
    } catch (e) {
      showToast(e?.response?.data?.message || e?.message || "No se pudo abrir el workflow", "error");
    } finally {
      setWorkflowLoading(null);
    }
  };

  const handleStartWorkflow = async ({ signers }) => {
    if (!workflowStartActa?.id) return;
    setStartingWorkflow(true);
    try {
      const started = await startCollabActaSignatureWorkflow(workflowStartActa.id, { signers });
      const workflowId = Number(started?.workflow?.id || started?.id || 0) || null;
      const updated = await getCollabSession(sessionId);
      setData(updated);
      setWorkflowStartActa(null);
      if (!workflowId) throw new Error("Workflow no disponible");
      navigate(`/dashboard/signatures/workflows/${workflowId}`);
    } catch (error) {
      showToast(error?.response?.data?.message || error?.message || "No se pudo iniciar el workflow", "error");
    } finally {
      setStartingWorkflow(false);
    }
  };

  const handleDownloadFinalPdf = async (acta) => {
    setDownloadingFinalPdf(acta.id);
    try {
      const wfData = await getCollabActaSignatureWorkflow(acta.id);
      const workflowId = Number(wfData?.workflow?.id || wfData?.id || 0) || null;
      const documentId = Number(wfData?.documents?.[0]?.id || 0) || null;
      if (!workflowId || !documentId) throw new Error("Documento final no disponible");
      const res = await downloadSignatureWorkflowFinalPdf(workflowId, documentId);
      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showToast(error?.response?.data?.message || error?.message || "No se pudo descargar el PDF firmado", "error");
    } finally {
      setDownloadingFinalPdf(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-40"><FiRefreshCw size={20} className="animate-spin text-slate-300" /></div>;
  if (!data) return null;

  const primaryActa = data.actas?.[0] || null;
  const hasLockedActa = (data.actas || []).some((acta) =>
    Boolean(acta.signature_workflow_id || acta.is_complete || acta.signed_at || acta.signed_pdf_drive_file_id || acta.signed_pdf_sha256),
  );
  const canEditSession = canEditSessions && data.category !== "ti" && !hasLockedActa;

  const handleSessionUpdated = async () => {
    const updated = await getCollabSession(sessionId);
    setData(updated);
    setEditingSession(false);
    await onUpdated?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <CategoryBadge category={data.category} />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${data.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{data.tipo}</span>
          </div>
          <p className="text-base font-semibold text-slate-900">{data.collaborator_name}</p>
          <p className="text-xs text-slate-500">{data.session_date?.slice(0, 10)} · {data.delivery_count} ítem{data.delivery_count !== 1 ? "s" : ""}</p>
          {data.notes && <p className="text-xs text-slate-500 italic mt-0.5">{data.notes}</p>}
        </div>
        <div className="flex items-center gap-2">
          {canEditSession && (
            <button
              type="button"
              onClick={() => setEditingSession(true)}
              className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97]"
            >
              <FiEdit2 size={12} />
              Editar sesión
            </button>
          )}
          {onClose && <button type="button" onClick={onClose} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 transition-colors"><FiX size={16} /></button>}
        </div>
      </div>
      {primaryActa && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <SectionLabel>Datos del acta</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Nombre</p>
              <p className="text-sm font-medium text-slate-800">{primaryActa.recipient_nombre || data.collaborator_name || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Cédula</p>
              <p className="text-sm font-mono text-slate-700">{primaryActa.recipient_cedula || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Cargo</p>
              <p className="text-sm font-medium text-slate-800">{primaryActa.recipient_cargo || '—'}</p>
            </div>
          </div>
        </div>
      )}
      <div className="border-t border-slate-100 pt-4">
        <SectionLabel>Ítems ({data.deliveries?.length || 0})</SectionLabel>
        <div className="space-y-2">
          {(data.deliveries || []).map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{d.item_name}</p>
                {d.serial_number && <p className="text-xs font-mono text-slate-400">{d.serial_number}</p>}
                {d.renewal_date && <RenewalBadge date={d.renewal_date} />}
              </div>
              <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${COLLAB_STATUS_COLORS[d.status] || "bg-slate-100 text-slate-600"}`}>{d.status}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 pt-4">
        <SectionLabel>Actas ({data.actas?.length || 0})</SectionLabel>
        {!data.actas?.length ? (
          <p className="text-xs text-slate-400 py-2 text-center">Sin actas</p>
        ) : (
          <div className="space-y-2">
            {data.actas.map((acta) => (
              <div key={acta.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${acta.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{acta.tipo}</span>
                    <span className="text-xs font-mono text-slate-500">{acta.acta_code}</span>
                    <SignatureWorkflowBadge status={acta.signature_workflow_status} isComplete={acta.is_complete} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(acta.generated_at).toLocaleDateString("es-EC")} · {acta.items?.length || 0} ítems</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {acta.signature_workflow_id ? (
                    <button
                      type="button"
                      onClick={() => handleOpenWorkflow(acta)}
                      className="cursor-pointer flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700 transition-colors hover:bg-indigo-100 active:scale-[0.97]"
                    >
                      {workflowLoading === acta.id ? <FiRefreshCw size={10} className="animate-spin" /> : <FiFileText size={10} />}
                      Workflow
                    </button>
                  ) : (data.category === "herramienta" && acta.tipo === "entrega" && canInitiateWorkflow) ? (
                    <button
                      type="button"
                      onClick={() => setWorkflowStartActa(acta)}
                      className="cursor-pointer flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 transition-colors hover:bg-blue-100 active:scale-[0.97]"
                    >
                      <FiPlus size={10} />
                      Iniciar firma colectiva
                    </button>
                  ) : null}
                  {String(acta.signature_workflow_status || "").toLowerCase() === "completed" ? (
                    <button
                      type="button"
                      onClick={() => handleDownloadFinalPdf(acta)}
                      disabled={downloadingFinalPdf === acta.id}
                      className="cursor-pointer flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700 hover:bg-green-100 transition-colors active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                    >
                      {downloadingFinalPdf === acta.id
                        ? <FiRefreshCw size={10} className="animate-spin" />
                        : <FiCheck size={10} />}
                      PDF Firmado
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleDownload(acta.id)}
                    disabled={downloadingActaPdf === acta.id}
                    className="cursor-pointer flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50 transition-colors active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                  >
                    {downloadingActaPdf === acta.id
                      ? <FiRefreshCw size={10} className="animate-spin" />
                      : <FiDownload size={10} />}
                    PDF
                  </button>
                  {!acta.is_complete && (
                    <label className="cursor-pointer">
                      <span className={`flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100 transition-colors ${uploading === acta.id ? "opacity-50" : ""}`}>
                        {uploading === acta.id ? <FiRefreshCw size={10} className="animate-spin" /> : <FiUploadCloud size={10} />} Subir firmada
                      </span>
                      <input type="file" accept=".pdf" className="hidden" disabled={uploading !== null}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(acta.id, f); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <CollabWorkflowStartModal
        open={Boolean(workflowStartActa)}
        acta={workflowStartActa}
        session={data}
        users={availableUsers}
        submitting={startingWorkflow}
        onClose={() => setWorkflowStartActa(null)}
        onSubmit={handleStartWorkflow}
      />
      <EditCollabSessionModal
        open={editingSession}
        session={data}
        catalog={catalog}
        onClose={() => setEditingSession(false)}
        onSaved={handleSessionUpdated}
      />
      {downloadingActaPdf !== null && (
        <div className="fixed inset-0 z-[30] flex items-center justify-center bg-[#0F172A]/60">
          <div className="z-[40] flex flex-col items-center gap-5 rounded-2xl border border-[#E5E7EB] bg-white px-10 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]">
            <FiRefreshCw size={28} className="animate-spin text-[#2563EB]" />
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[17px] font-semibold leading-snug tracking-tight text-[#1F2937]">
                Generando PDF
              </span>
              <span className="max-w-[260px] text-[13px] leading-relaxed text-[#6B7280]">
                Preparando el documento en Google Docs. Esto puede tomar unos segundos.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab Activos TI ─ completo ─────────────────────────────────────────────────

const TI_EMPTY_FORM = {
  name: "", brand: "", model: "", serial_number: "", imei: "",
  purchase_date: "", purchase_value: "", maintenance_frequency_months: "12",
};

function TiAssetsTab({ tiAssets, users, onRefresh }) {
  const { showToast } = useUI();
  const navigate = useNavigate();

  const [search, setSearch]         = useState("");
  const [statusF, setStatusF]       = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(TI_EMPTY_FORM);
  const [selectedId, setSelectedId] = useState(null);

  // Detail panel state
  const [detailLoading, setDetailLoading] = useState(false);
  const [assignHistory, setAssignHistory] = useState([]);
  const [actas, setActas]                 = useState([]);
  const [financialDocs, setFinancialDocs] = useState([]);
  const [uploadingDoc, setUploadingDoc]   = useState(null);
  const [showAssignModal, setShowAssign]  = useState(false);
  const [downloadingTiActaPdf, setDownloadingTiActaPdf] = useState(null);
  const [editingTiActa, setEditingTiActa] = useState(null);

  // Reports
  const [reportCollab, setReportCollab] = useState("");
  const [reportYear, setReportYear]     = useState(new Date().getFullYear());

  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleDownloadTiActa = async (actaId, tipo) => {
    setDownloadingTiActaPdf(actaId);
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
      setDownloadingTiActaPdf(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tiAssets.filter((a) =>
      (!statusF || (a.status || a.estado) === statusF) &&
      (!q || (a.name || a.nombre || "").toLowerCase().includes(q) ||
        (a.brand || a.marca || "").toLowerCase().includes(q) ||
        (a.serial_number || a.numero_serie || "").toLowerCase().includes(q) ||
        (a.model || a.modelo || "").toLowerCase().includes(q) ||
        (a.assigned_to_name || "").toLowerCase().includes(q)),
    );
  }, [tiAssets, search, statusF]);

  const selected = useMemo(() => tiAssets.find((a) => String(a.id) === String(selectedId || "")), [tiAssets, selectedId]);

  const stats = useMemo(() => ({
    total:      tiAssets.length,
    assigned:   tiAssets.filter((a) => ["assigned","asignado"].includes(a.status || a.estado)).length,
    available:  tiAssets.filter((a) => ["available","unassigned","disponible"].includes(a.status || a.estado)).length,
    damaged:    tiAssets.filter((a) => ["damaged","in_maintenance","mantenimiento"].includes(a.status || a.estado)).length,
    deprecated: tiAssets.filter((a) => (a.depreciation_pct || 0) >= 100).length,
  }), [tiAssets]);

  const loadDetail = useCallback(async (assetId) => {
    setDetailLoading(true);
    try {
      const [hist, actasRows, finDocs] = await Promise.all([
        getTiAssetAssignmentsHistory(assetId),
        listTiActas(assetId),
        listTiFinancialDocs(assetId),
      ]);
      setAssignHistory(Array.isArray(hist) ? hist : []);
      setActas(Array.isArray(actasRows) ? actasRows : []);
      setFinancialDocs(Array.isArray(finDocs) ? finDocs : []);
    } catch {
      setAssignHistory([]); setActas([]); setFinancialDocs([]);
    } finally { setDetailLoading(false); }
  }, []);

  const handleOpenTiWorkflow = useCallback(async (acta) => {
    try {
      const existing = acta.signature_workflow_id
        ? { workflow: { id: acta.signature_workflow_id } }
        : await getTiActaSignatureWorkflow(acta.id);
      const workflowId = Number(existing?.workflow?.id || existing?.id || 0) || null;
      if (!workflowId) {
        showToast("Esta acta TI aún no tiene workflow de firma vinculado", "info");
        return;
      }
      navigate(`/dashboard/signatures/workflows/${workflowId}`);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo abrir el workflow", "error");
    }
  }, [navigate, showToast]);

  const handleSelect = (a) => { setSelectedId(a.id); loadDetail(a.id); };

  const handleCreate = async () => {
    if (!form.name.trim())          return showToast("El nombre es requerido", "warning");
    if (!form.serial_number.trim()) return showToast("El número de serie es requerido", "warning");
    if (!form.purchase_date)        return showToast("La fecha de compra es requerida", "warning");
    setSaving(true);
    try {
      await createTiAsset(form);
      showToast("Activo registrado correctamente", "success");
      setForm(TI_EMPTY_FORM); setShowCreate(false);
      onRefresh();
    } catch (e) { showToast(e?.response?.data?.message || "Error al crear activo", "error"); }
    finally { setSaving(false); }
  };

  const handleFinancialDocUpload = async (docType, file) => {
    if (!selected || !file) return;
    setUploadingDoc(docType);
    try {
      await uploadTiFinancialDoc(selected.id, docType, file);
      showToast(docType === "factura" ? "Factura subida correctamente" : "Letra de cambio subida correctamente", "success");
      const updated = await listTiFinancialDocs(selected.id);
      setFinancialDocs(Array.isArray(updated) ? updated : []);
    } catch (e) { showToast(e?.response?.data?.message || "No se pudo subir el documento", "error"); }
    finally { setUploadingDoc(null); }
  };

  return (
    <div className="space-y-5">
      {/* Header barra */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            placeholder="Buscar equipo, serie, colaborador..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none">
          <option value="">Todos los estados</option>
          {["unassigned","assigned","available","damaged","in_maintenance","retired"].map((v) => (
            <option key={v} value={v}>{TI_STATUS_LABELS[v]}</option>
          ))}
        </select>
        <button type="button" onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors active:scale-[0.97]">
          {showCreate ? <FiChevronUp size={14} /> : <FiPlus size={14} />} Nuevo equipo
        </button>
      </div>

      {/* KPI strip — DESIGN.md: una superficie, no tarjetas individuales */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="flex flex-wrap sm:flex-nowrap sm:divide-x divide-slate-100">
          {[
            { label: "Total",       value: stats.total,      color: "text-slate-800" },
            { label: "Asignados",   value: stats.assigned,   color: "text-blue-700" },
            { label: "Disponibles", value: stats.available,  color: "text-green-600" },
            { label: "Incidencias", value: stats.damaged,    color: stats.damaged > 0 ? "text-amber-600" : "text-slate-800" },
            { label: "Depreciados", value: stats.deprecated, color: stats.deprecated > 0 ? "text-red-600" : "text-slate-800" },
          ].map((k, i) => (
            <div key={k.label} className={`flex-1 min-w-[50%] sm:min-w-0 px-4 py-3 ${i > 0 && i % 2 === 0 ? "border-t border-slate-100 sm:border-t-0" : i === 1 ? "border-l border-slate-100 sm:border-l-0" : ""}`}>
              <p className="text-xs text-slate-400">{k.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Formulario crear activo */}
      {showCreate && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Registrar nuevo activo TI</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: "name",           label: "Nombre *",              placeholder: "Ej: Laptop Dell XPS" },
              { key: "brand",          label: "Marca",                 placeholder: "Ej: Dell" },
              { key: "model",          label: "Modelo",                placeholder: "Ej: XPS 15" },
              { key: "serial_number",  label: "N° de serie *",         placeholder: "Ej: SN-ABC123" },
              { key: "imei",           label: "IMEI",                  placeholder: "Solo para móviles" },
              { key: "purchase_value", label: "Valor de compra ($)",   placeholder: "Ej: 1200.00", type: "number" },
            ].map(({ key, label, placeholder, type = "text" }) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <input type={type} value={form[key]} onChange={setField(key)} placeholder={placeholder} className={fieldCls} />
              </div>
            ))}
            <div>
              <label className={labelCls}>Fecha de compra *</label>
              <input type="date" value={form.purchase_date} onChange={setField("purchase_date")} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Frec. mantenimiento</label>
              <select value={form.maintenance_frequency_months} onChange={setField("maintenance_frequency_months")} className={fieldCls}>
                {[3,6,12,24].map((m) => <option key={m} value={m}>{m} meses</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setShowCreate(false); setForm(TI_EMPTY_FORM); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="button" onClick={handleCreate} disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <FiPlus size={14} /> {saving ? "Registrando..." : "Registrar equipo"}
            </button>
          </div>
        </div>
      )}

      {/* Panel principal lista + detalle */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Lista */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] flex flex-col">
          <div className="flex-1 overflow-auto p-2 space-y-1 max-h-[560px]">
            {filtered.length === 0
              ? <EmptyState icon={FiCpu} message={search || statusF ? "Sin resultados" : "No hay activos registrados"} />
              : filtered.map((a) => (
              <button key={a.id} type="button" onClick={() => handleSelect(a)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors active:scale-[0.98] ${String(selectedId) === String(a.id) ? "border-slate-300 bg-slate-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.name || a.nombre}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{[a.brand || a.marca, a.model || a.modelo].filter(Boolean).join(" · ") || "Sin especificar"}</p>
                    {(a.serial_number || a.numero_serie) && <p className="text-xs font-mono text-slate-400 mt-0.5">{a.serial_number || a.numero_serie}</p>}
                    <p className="text-xs text-slate-500 mt-0.5">{a.assigned_to_name || "Sin asignación"}</p>
                  </div>
                  <TiStatusBadge status={a.status || a.estado} />
                </div>
                <DepBar pct={a.depreciation_pct} />
              </button>
            ))}
          </div>
        </div>

        {/* Panel detalle */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          {!selected ? (
            <EmptyState icon={FiCpu} message="Selecciona un equipo para ver sus detalles" />
          ) : (
            <div className="p-5 space-y-5 overflow-auto max-h-[680px]">

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{selected.name || selected.nombre}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{[selected.brand || selected.marca, selected.model || selected.modelo].filter(Boolean).join(" · ") || "Sin especificar"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <TiStatusBadge status={selected.status || selected.estado} />
                  <button type="button" onClick={() => downloadTiAssetReport(selected.id)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors">
                    <FiFileText size={11} /> Reporte
                  </button>
                </div>
              </div>

              {/* Depreciación */}
              {selected.depreciation_pct != null && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-slate-600">Depreciación acumulada</span>
                    <span className={`text-sm font-bold ${selected.depreciation_pct >= 90 ? "text-red-600" : selected.depreciation_pct >= 60 ? "text-amber-600" : "text-green-600"}`}>
                      {selected.depreciation_pct}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${selected.depreciation_pct >= 90 ? "bg-red-400" : selected.depreciation_pct >= 60 ? "bg-amber-400" : "bg-green-500"}`}
                      style={{ width: `${Math.min(selected.depreciation_pct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                    <span>Vida útil 3 años</span>
                    <span>Residual: {selected.residual_pct}%</span>
                  </div>
                  {selected.fully_depreciated && (
                    <div className="flex items-center gap-1.5 mt-2 rounded-lg bg-red-50 border border-red-100 px-3 py-1.5">
                      <FiAlertTriangle size={12} className="text-red-500" />
                      <span className="text-xs text-red-700 font-medium">Activo totalmente depreciado</span>
                    </div>
                  )}
                </div>
              )}

              {/* Info campos */}
              <div>
                <SectionLabel>Información del equipo</SectionLabel>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    ["Código",               selected.asset_code || "-"],
                    ["N° de serie",          selected.serial_number || selected.numero_serie || "-"],
                    ["IMEI",                 selected.imei || "-"],
                    ["Fecha de compra",      selected.purchase_date ? String(selected.purchase_date).slice(0, 10) : "-"],
                    ["Valor de compra",      selected.purchase_value ? `$${Number(selected.purchase_value).toLocaleString("es-EC", { minimumFractionDigits: 2 })}` : "-"],
                    ["Frec. mantenimiento",  `${selected.maintenance_frequency_months || 12} meses`],
                    ["Último mantenimiento", selected.last_maintenance_at ? String(selected.last_maintenance_at).slice(0, 10) : "-"],
                  ].map(([lbl, val]) => (
                    <div key={lbl}>
                      <p className="text-xs text-slate-400">{lbl}</p>
                      <p className="text-slate-800 font-medium">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Asignación actual */}
              <div className="border-t border-slate-100 pt-4">
                <SectionLabel>Asignación actual</SectionLabel>
                {selected.assigned_to_name ? (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <FiUser size={14} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{selected.assigned_to_name}</p>
                      {selected.assigned_at && <p className="text-xs text-slate-400">Desde {new Date(selected.assigned_at).toLocaleDateString("es-EC")}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sin asignación actual</p>
                )}
              </div>

              {/* Historial asignaciones */}
              <div className="border-t border-slate-100 pt-4">
                <SectionLabel>Historial de asignaciones</SectionLabel>
                {detailLoading ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Cargando...</p>
                ) : assignHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Sin movimientos registrados</p>
                ) : (
                  <div className="rounded-xl border border-slate-100 overflow-hidden max-h-48 overflow-y-auto">
                    {assignHistory.map((h, i) => (
                      <div key={h.id} className={`px-3 py-2.5 text-xs ${i < assignHistory.length - 1 ? "border-b border-slate-100" : ""}`}>
                        <p className="font-medium text-slate-700">
                          {h.action === "unassign" ? `Retiro — ${h.previous_user_name || "usuario"}` : `Entrega a ${h.assigned_to_name || "usuario"}`}
                        </p>
                        {h.reason && <p className="text-slate-500 mt-0.5">Motivo: {h.reason}</p>}
                        <p className="text-slate-400 mt-0.5">
                          {new Date(h.created_at).toLocaleString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {h.created_by_name && ` · por ${h.created_by_name}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actas generadas */}
              <div className="border-t border-slate-100 pt-4">
                <SectionLabel>Actas generadas</SectionLabel>
                {detailLoading ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Cargando...</p>
                ) : actas.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Sin actas generadas</p>
                ) : (
                  <div className="space-y-2">
                    {actas.map((acta) => (
                      <div key={acta.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${acta.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{acta.tipo}</span>
                            <span className="text-xs font-mono text-slate-500">#{String(acta.id).padStart(6, "0")}</span>
                            <SignatureWorkflowBadge status={acta.signature_workflow_status} isComplete={acta.is_complete} />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{acta.recipient_nombre || "-"} · {new Date(acta.generated_at).toLocaleDateString("es-EC")}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(acta.signature_workflow_id || acta.signature_workflow_status) && (
                            <button
                              type="button"
                              onClick={() => handleOpenTiWorkflow(acta)}
                              className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100 transition-colors"
                            >
                              <FiFileText size={10} /> Workflow
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadTiActa(acta.id, acta.tipo)}
                            disabled={downloadingTiActaPdf === acta.id}
                            className="cursor-pointer flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:text-slate-900 transition-colors active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                          >
                            {downloadingTiActaPdf === acta.id
                              ? <FiRefreshCw size={10} className="animate-spin" />
                              : <FiDownload size={10} />}
                            Borrador
                          </button>
                          {!acta.is_complete && !acta.signed_at && !acta.signed_pdf_drive_file_id && !acta.signed_pdf_sha256 && (
                            <button
                              type="button"
                              onClick={() => setEditingTiActa(acta)}
                              className="cursor-pointer flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors active:scale-[0.97]"
                            >
                              <FiEdit2 size={10} /> Editar
                            </button>
                          )}
                          {acta.is_complete && acta.signed_pdf_drive_url && (
                            <a href={acta.signed_pdf_drive_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 transition-colors">
                              <FiCheck size={10} /> Firmada
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documentos financieros */}
              <div className="border-t border-slate-100 pt-4">
                <SectionLabel>Documentos financieros</SectionLabel>
                <div className="space-y-3">
                  {[
                    { type: "factura",         label: "Factura de compra",       desc: "Factura de compra del equipo" },
                    { type: "letra_de_cambio", label: "Letra de cambio",         desc: "Copia de la letra de cambio con condiciones" },
                  ].map(({ type, label, desc }) => {
                    const doc = financialDocs.find((d) => d.doc_type === type);
                    const uploading = uploadingDoc === type;
                    return (
                      <div key={type} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700">{label}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                            {doc ? (
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700"><FiCheck size={9} /> Subido</span>
                                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">{doc.filename}</span>
                                <span className="text-[10px] text-slate-400">{new Date(doc.uploaded_at).toLocaleDateString("es-EC")}</span>
                              </div>
                            ) : (
                              <span className="inline-flex mt-1.5 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {doc?.drive_url && (
                              <a href={doc.drive_url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:border-slate-300 transition-colors">
                                <FiDownload size={11} />
                              </a>
                            )}
                            <label className="cursor-pointer">
                              <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                                uploading ? "border-slate-200 bg-slate-100 text-slate-400 cursor-wait"
                                  : doc ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                              }`}>
                                {uploading ? <><FiRefreshCw size={11} className="animate-spin" /> Subiendo...</> : <><FiUploadCloud size={11} /> {doc ? "Reemplazar" : "Subir"}</>}
                              </span>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" className="hidden" disabled={!!uploadingDoc}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFinancialDocUpload(type, f); e.target.value = ""; }} />
                            </label>
                          </div>
                        </div>
                        {doc?.sha256 && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">SHA-256:</span>
                            <span className="font-mono text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer hover:bg-slate-50"
                              title={doc.sha256} onClick={() => navigator.clipboard?.writeText(doc.sha256)}>
                              {String(doc.sha256).slice(0, 14)}…
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Reportes PDF */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FiBarChart2 size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-800">Reportes PDF</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">Por equipo</p>
            <p className="text-xs text-slate-400">Historial, actas y depreciación de un activo.</p>
            <select value={selectedId || ""} onChange={(e) => { const f = tiAssets.find((a) => String(a.id) === e.target.value); if (f) handleSelect(f); }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none">
              <option value="">Selecciona un equipo</option>
              {tiAssets.map((a) => <option key={a.id} value={a.id}>{a.name || a.nombre}{(a.serial_number || a.numero_serie) ? ` · ${a.serial_number || a.numero_serie}` : ""}</option>)}
            </select>
            {selectedId && (
              <button type="button" onClick={() => downloadTiAssetReport(selectedId)}
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                <FiDownload size={13} /> Descargar PDF
              </button>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">Por colaborador</p>
            <p className="text-xs text-slate-400">Todos los activos asignados (actuales e históricos).</p>
            <select value={reportCollab} onChange={(e) => setReportCollab(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none">
              <option value="">Selecciona un colaborador</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullname || u.name || u.email}</option>)}
            </select>
            {reportCollab && (
              <button type="button" onClick={() => downloadTiCollaboratorReport(reportCollab)}
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                <FiDownload size={13} /> Descargar PDF
              </button>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">Cronograma anual</p>
            <p className="text-xs text-slate-400">Cronograma de mantenimientos de todos los activos.</p>
            <input type="number" min={2020} max={2100} value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value || new Date().getFullYear()))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none" />
            <button type="button" onClick={() => downloadTiMaintenanceReport({ period_type: "annual", year: reportYear })}
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
              <FiDownload size={13} /> Descargar PDF
            </button>
          </div>
        </div>
      </div>

      {/* Modal asignación rápida desde detalle */}
      {showAssignModal && selected && (
        <QuickTiAssignModal asset={selected} users={users}
          onSave={() => { setShowAssign(false); loadDetail(selected.id); onRefresh(); }}
          onClose={() => setShowAssign(false)} />
      )}
      <TiActaEditModal
        open={Boolean(editingTiActa)}
        acta={editingTiActa}
        onClose={() => setEditingTiActa(null)}
        onSaved={() => { setEditingTiActa(null); if (selectedId) loadDetail(selectedId); }}
      />
      {downloadingTiActaPdf !== null && (
        <div className="fixed inset-0 z-[30] flex items-center justify-center bg-[#0F172A]/60">
          <div className="z-[40] flex flex-col items-center gap-5 rounded-2xl border border-[#E5E7EB] bg-white px-10 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]">
            <FiRefreshCw size={28} className="animate-spin text-[#2563EB]" />
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[17px] font-semibold leading-snug tracking-tight text-[#1F2937]">
                Generando PDF
              </span>
              <span className="max-w-[260px] text-[13px] leading-relaxed text-[#6B7280]">
                Preparando el acta en Google Docs. Esto puede tomar unos segundos.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal asignación TI rápida ────────────────────────────────────────────────

function QuickTiAssignModal({ asset, users, onSave, onClose }) {
  const { showToast } = useUI();
  const [userId, setUserId] = useState("");
  const [notes, setNotes]   = useState("");
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!userId) return showToast("Selecciona un colaborador", "warning");
    setSaving(true);
    try {
      await createCollabTiSession({ user_id: Number(userId), session_date: date, tipo: "entrega", notes: notes || null, asset_ids: [asset.id] });
      showToast("Activo asignado y acta generada", "success");
      onSave();
    } catch (e) { showToast(e?.response?.data?.message || "Error al asignar", "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900">Asignar {asset.name || asset.nombre}</p>
          <button type="button" onClick={onClose} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 transition-colors"><FiX size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Colaborador *</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={fieldCls}>
              <option value="">Selecciona...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullname || u.name || u.email}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Fecha de entrega</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional..." className={fieldCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <FiCheck size={14} /> {saving ? "Asignando..." : "Asignar y crear acta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab Catálogo (con edición inline) ────────────────────────────────────────

function CatalogTab({ catalog, onRefresh, canEdit = true }) {
  const { showToast } = useUI();
  const [newForm, setNewForm]   = useState({ category: "ropa", name: "", description: "", requires_serial: false, requires_condition: false, attr_fields: {} });
  const [saving, setSaving]     = useState(false);
  const [editingId, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleAdd = async () => {
    if (!newForm.name.trim()) return showToast("El nombre es requerido", "warning");
    const attribute_schema = {};
    let requires_serial = false;
    let requires_condition = false;
    (CATEGORY_FIELDS[newForm.category] || []).forEach(({ key, type }) => {
      if (!newForm.attr_fields?.[key]) return;
      if (key === "_serial")         requires_serial = true;
      else if (key === "_condition") requires_condition = true;
      else                           attribute_schema[key] = type;
    });
    setSaving(true);
    try {
      await createCollabCatalogItem({ ...newForm, requires_serial, requires_condition, attribute_schema });
      showToast("Ítem agregado al catálogo", "success");
      setNewForm({ category: "ropa", name: "", description: "", requires_serial: false, requires_condition: false, attr_fields: {} });
      onRefresh();
    } catch (e) { showToast(e?.response?.data?.message || "Error", "error"); }
    finally { setSaving(false); }
  };

  const startEdit = (item) => {
    setEditing(item.id);
    const schema = item.attribute_schema || {};
    const attr_fields = {};
    (CATEGORY_FIELDS[item.category] || []).forEach(({ key }) => {
      if (key === "_serial")    attr_fields[key] = item.requires_serial || false;
      else if (key === "_condition") attr_fields[key] = item.requires_condition || false;
      else if (key === "_renewal")   attr_fields[key] = "_renewal" in schema;
      else attr_fields[key] = key in schema;
    });
    setEditForm({
      name: item.name,
      description: item.description || "",
      attr_fields,
      _category: item.category,
    });
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.name.trim()) return showToast("El nombre es requerido", "warning");
    try {
      const attribute_schema = {};
      let requires_serial = false;
      let requires_condition = false;
      (CATEGORY_FIELDS[editForm._category] || []).forEach(({ key, type }) => {
        if (!editForm.attr_fields?.[key]) return;
        if (key === "_serial")         requires_serial = true;
        else if (key === "_condition") requires_condition = true;
        else                           attribute_schema[key] = type;
      });
      await updateCollabCatalogItem(id, {
        name: editForm.name,
        description: editForm.description,
        requires_serial,
        requires_condition,
        attribute_schema,
      });
      showToast("Ítem actualizado", "success");
      setEditing(null);
      onRefresh();
    } catch (e) { showToast(e?.response?.data?.message || "Error", "error"); }
  };

  const handleToggleActive = async (item) => {
    try {
      await updateCollabCatalogItem(item.id, { active: !item.active });
      showToast(item.active ? "Ítem desactivado" : "Ítem activado", "success");
      onRefresh();
    } catch (e) { showToast(e?.response?.data?.message || "Error", "error"); }
  };

  return (
    <div className="space-y-4">
      {/* Formulario agregar */}
      {canEdit && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Agregar ítem al catálogo</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={newForm.category} onChange={(e) => setNewForm((p) => ({ ...p, category: e.target.value, attr_fields: {} }))} className={fieldCls}>
            {COLLAB_CATEGORIES.map((v) => <option key={v} value={v}>{CATEGORY_LABELS[v]}</option>)}
          </select>
          <input value={newForm.name} onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nombre del ítem *" className={fieldCls} />
          <input value={newForm.description} onChange={(e) => setNewForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descripción" className={fieldCls} />
        </div>
        {(CATEGORY_FIELDS[newForm.category] || []).length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Campos del acta para {CATEGORY_LABELS[newForm.category]}</p>
            <div className="flex flex-wrap gap-3">
              {(CATEGORY_FIELDS[newForm.category] || []).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                  <input type="checkbox" checked={!!newForm.attr_fields?.[key]}
                    onChange={(e) => setNewForm((p) => ({ ...p, attr_fields: { ...p.attr_fields, [key]: e.target.checked } }))}
                    className="rounded" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={handleAdd} disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <FiPlus size={14} /> {saving ? "Guardando..." : "Agregar"}
          </button>
        </div>
      </div>}

      {/* Listas por categoría */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {COLLAB_CATEGORIES.map((cat) => {
          const items = catalog.filter((c) => c.category === cat);
          return (
            <div key={cat} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <CategoryBadge category={cat} />
                <span className="text-xs text-slate-400">{items.length} ítems</span>
              </div>
              <div className="space-y-2">
                {!items.length && <p className="text-xs text-slate-400">Sin ítems</p>}
                {items.map((item) => (
                  <div key={item.id} className={`rounded-xl border ${item.active ? "border-slate-100 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                    {editingId === item.id ? (
                      <div className="p-3 space-y-2">
                        <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none" />
                        <input value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Descripción..." className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 focus:border-blue-400 focus:outline-none" />
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                          {(CATEGORY_FIELDS[editForm._category] || []).map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input type="checkbox"
                                checked={editForm.attr_fields?.[key] || false}
                                onChange={(e) => setEditForm((p) => ({ ...p, attr_fields: { ...p.attr_fields, [key]: e.target.checked } }))}
                                className="rounded" />
                              {label}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <button type="button" onClick={() => handleSaveEdit(item.id)}
                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 transition-colors">
                            <FiCheck size={10} /> Guardar
                          </button>
                          <button type="button" onClick={() => setEditing(null)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800 font-medium truncate">{item.name}</p>
                          {item.description && <p className="text-[10px] text-slate-400 truncate">{item.description}</p>}
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {item.requires_serial    && <span className="text-[9px] bg-slate-100 text-slate-500 rounded px-1">serie</span>}
                            {item.requires_condition && <span className="text-[9px] bg-slate-100 text-slate-500 rounded px-1">cond.</span>}
                            {(CATEGORY_FIELDS[item.category] || [])
                              .filter(({ key }) => key in (item.attribute_schema || {}))
                              .map(({ key, label }) => (
                                <span key={key} className="text-[9px] bg-amber-50 text-amber-600 rounded px-1">{label.toLowerCase()}</span>
                              ))}
                            {!item.active && <span className="text-[9px] bg-red-50 text-red-500 rounded px-1">inactivo</span>}
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => startEdit(item)}
                              className="rounded-lg p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                              <FiEdit2 size={12} />
                            </button>
                            <button type="button" onClick={() => handleToggleActive(item)}
                              className={`rounded-lg p-1 transition-colors ${item.active ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-400 hover:text-green-600 hover:bg-green-50"}`}>
                              {item.active ? <FiX size={12} /> : <FiCheck size={12} />}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Panel detalle acta TI (tab Entregas/Retiros) ─────────────────────────────

function TiActaEditModal({ open, acta, onClose, onSaved }) {
  const { showToast } = useUI();
  const [recipientNombre, setRecipientNombre] = useState("");
  const [recipientCedula, setRecipientCedula] = useState("");
  const [recipientCargo, setRecipientCargo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !acta) return;
    setRecipientNombre(acta.recipient_nombre || "");
    setRecipientCedula(acta.recipient_cedula || "");
    setRecipientCargo(acta.recipient_cargo || "");
  }, [open, acta]);

  const handleSave = async () => {
    if (!acta?.id) return;
    if (!recipientNombre.trim()) return showToast("Ingresa el nombre del colaborador", "warning");
    if (!recipientCedula.trim()) return showToast("Ingresa la cédula del colaborador", "warning");
    if (!recipientCargo.trim()) return showToast("Ingresa el cargo del colaborador", "warning");

    setSaving(true);
    try {
      await updateTiActa(acta.id, {
        recipient_nombre: recipientNombre.trim(),
        recipient_cedula: recipientCedula.trim(),
        recipient_cargo: recipientCargo.trim(),
      });
      showToast("Datos del acta actualizados", "success");
      await onSaved?.();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar el acta", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Editar datos del receptor" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <CategoryBadge category="ti" />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${acta?.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{acta?.tipo}</span>
            {acta?.acta_code && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-mono text-slate-500">{acta.acta_code}</span>}
          </div>
          <p className="text-xs text-slate-500">
            Solo se puede corregir el nombre, cédula y cargo. Los equipos asignados no se modifican.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nombre completo *</label>
            <input value={recipientNombre} onChange={(event) => setRecipientNombre(event.target.value)} className={fieldCls} placeholder="Nombre del colaborador" />
          </div>
          <div>
            <label className={labelCls}>Cédula *</label>
            <input value={recipientCedula} onChange={(event) => setRecipientCedula(event.target.value)} className={`${fieldCls} font-mono`} placeholder="0000000000" />
          </div>
          <div>
            <label className={labelCls}>Cargo *</label>
            <input value={recipientCargo} onChange={(event) => setRecipientCargo(event.target.value)} className={fieldCls} placeholder="Cargo del colaborador" />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TiActaDetail({ acta: actaInitial, onClose, onUpdated, availableUsers = [] }) {
  const { showToast } = useUI();
  const [acta, setActa]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [editingActa, setEditingActa] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [startingWorkflow, setStartingWorkflow]   = useState(false);

  useEffect(() => {
    setLoading(true);
    getTiActa(actaInitial.id)
      .then(setActa)
      .catch(() => showToast("No se pudo cargar el acta", "error"))
      .finally(() => setLoading(false));
  }, [actaInitial.id, showToast]);

  const data = acta || actaInitial;
  const items = acta?.items || [];

  const isAlreadySigned = data.is_complete || data.signed_at || data.signed_pdf_drive_file_id || data.signed_pdf_sha256;
  const canEditTiActa = !isAlreadySigned;
  const canStartWorkflow = !isAlreadySigned && !data.signature_workflow_id;

  const handleActaUpdated = async () => {
    const updated = await getTiActa(actaInitial.id);
    setActa(updated);
    setEditingActa(false);
    await onUpdated?.();
  };

  const handleStartWorkflow = async (signerIds) => {
    if (!signerIds?.length) return showToast("Selecciona al menos un firmante", "warning");
    setStartingWorkflow(true);
    try {
      await startTiActaSignatureWorkflow(data.id, { signers: signerIds.map((id) => ({ user_id: id })) });
      showToast("Flujo de firma iniciado", "success");
      const updated = await getTiActa(actaInitial.id);
      setActa(updated);
      setShowWorkflowModal(false);
      await onUpdated?.();
    } catch (e) {
      showToast(e?.response?.data?.message || "No se pudo iniciar el flujo de firma", "error");
    } finally {
      setStartingWorkflow(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await getTiActaPdf(data.id, data.tipo);
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
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <CategoryBadge category="ti" />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${data.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{data.tipo}</span>
            <span className="rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">Activos TI</span>
            {data.acta_code && <span className="font-mono text-[10px] text-slate-400">{data.acta_code}</span>}
          </div>
          <p className="text-base font-semibold text-slate-900">{data.recipient_nombre || "—"}</p>
          {data.recipient_cedula && <p className="text-xs text-slate-500">C.I. {data.recipient_cedula}{data.recipient_cargo ? ` · ${data.recipient_cargo}` : ""}</p>}
          <p className="text-xs text-slate-400 mt-0.5">{data.generated_at ? new Date(data.generated_at).toLocaleDateString("es-EC") : "—"} · por {data.generated_by_name || "—"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {data.is_complete
            ? <span className="flex items-center gap-1 rounded-full bg-green-50 border border-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700"><FiCheck size={9}/> Firmada</span>
            : <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>}
          {onClose && <button type="button" onClick={onClose} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 transition-colors"><FiX size={15}/></button>}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="cursor-pointer flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
        >
          {downloadingPdf ? <FiRefreshCw size={12} className="animate-spin"/> : <FiDownload size={12}/>}
          Descargar PDF borrador
        </button>
        {canEditTiActa && (
          <button
            type="button"
            onClick={() => setEditingActa(true)}
            className="cursor-pointer flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors active:scale-[0.97]"
          >
            <FiEdit2 size={12}/> Editar acta
          </button>
        )}
        {canStartWorkflow && (
          <button
            type="button"
            onClick={() => setShowWorkflowModal(true)}
            className="cursor-pointer flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors active:scale-[0.97]"
          >
            <FiShield size={12}/> Iniciar firma FamSign
          </button>
        )}
        {data.signature_workflow_id && !isAlreadySigned && (
          <span className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
            <FiRefreshCw size={12}/> Firma en proceso
          </span>
        )}
        {data.is_complete && data.signed_pdf_drive_url && (
          <a href={data.signed_pdf_drive_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors">
            <FiCheck size={12}/> Ver acta firmada
          </a>
        )}
      </div>

      {/* Equipos del acta */}
      <div className="border-t border-slate-100 pt-4">
        <SectionLabel>Equipos en esta acta</SectionLabel>
        {loading ? (
          <p className="text-xs text-slate-400 py-3 text-center flex items-center gap-2 justify-center"><FiRefreshCw size={13} className="animate-spin"/> Cargando...</p>
        ) : !items.length ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">{data.asset_name || "—"}</p>
            {data.asset_code && <p className="text-[10px] font-mono text-slate-400">{data.asset_code}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={item.id || i} className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.name || item.item_type || "Equipo"}</p>
                  {item.brand_model && <p className="text-xs text-slate-500">{item.brand_model}</p>}
                  {item.serial_imei && <p className="text-xs font-mono text-slate-400">{item.serial_imei}</p>}
                  {item.characteristics && <p className="text-[10px] text-slate-400 italic">{item.characteristics}</p>}
                  {item.observations && <p className="text-[10px] text-slate-500 mt-0.5">{item.observations}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                  <span className="text-[10px] font-medium text-slate-500 capitalize">{item.item_type || "equipo"}</span>
                  {item.physical_condition != null && <span className="text-[10px] text-slate-400">Cond. {item.physical_condition}/10</span>}
                  {item.is_new === true && <span className="text-[10px] font-semibold text-green-600">Nuevo</span>}
                  {item.is_new === false && <span className="text-[10px] text-slate-400">Usado</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <TiActaEditModal
        open={editingActa}
        acta={data}
        onClose={() => setEditingActa(false)}
        onSaved={handleActaUpdated}
      />
      <TiWorkflowStartModal
        open={showWorkflowModal}
        acta={data}
        users={availableUsers}
        submitting={startingWorkflow}
        onClose={() => setShowWorkflowModal(false)}
        onSubmit={handleStartWorkflow}
      />
      {downloadingPdf && (
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
    </div>
  );
}

// ── Modal inicio workflow FamSign para actas TI ───────────────────────────────

function TiWorkflowStartModal({ open, acta, users = [], submitting, onClose, onSubmit }) {
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => { if (open) setSelectedIds([]); }, [open]);

  const toggle = (id) => setSelectedIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[30] flex items-center justify-center bg-[#0F172A]/60">
      <div className="z-[40] w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1F2937]">Iniciar firma FamSign</h2>
            <p className="text-[12px] text-[#6B7280] mt-0.5">
              {acta?.acta_code || `Acta #${acta?.id}`} — {acta?.tipo === "retiro" ? "Retiro" : "Entrega"} de activos TI
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"><FiX size={16}/></button>
        </div>
        <p className="text-[12px] text-[#6B7280] mb-3">Selecciona los firmantes para este documento:</p>
        <div className="max-h-56 overflow-y-auto space-y-1.5 mb-5">
          {users.length === 0 && <p className="text-[12px] text-slate-400 text-center py-4">No hay usuarios disponibles</p>}
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={selectedIds.includes(u.id)}
                onChange={() => toggle(u.id)}
                className="accent-[#2563EB]"
              />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-800 truncate">{u.fullname || u.name || u.email}</p>
                {u.email && <p className="text-[11px] text-slate-400 truncate">{u.email}</p>}
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSubmit(selectedIds)}
            disabled={submitting || !selectedIds.length}
            className="cursor-pointer flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? <FiRefreshCw size={14} className="animate-spin"/> : <FiShield size={14}/>}
            {submitting ? "Iniciando..." : "Iniciar flujo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal detalle activo TI (para Gestión) ────────────────────────────────────

function TiAssetDetailModal({ asset, onClose }) {
  const { showToast } = useUI();
  const [hist, setHist]           = useState([]);
  const [actas, setActas]         = useState([]);
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [uploadingDoc, setUpD]    = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getTiAssetAssignmentsHistory(asset.id),
      listTiActas(asset.id),
      listTiFinancialDocs(asset.id),
    ]).then(([h, a, d]) => {
      setHist(Array.isArray(h) ? h : []);
      setActas(Array.isArray(a) ? a : []);
      setDocs(Array.isArray(d) ? d : []);
    }).catch(() => showToast("No se pudo cargar detalle", "error"))
      .finally(() => setLoading(false));
  }, [asset.id, showToast]);

  const handleDownloadActaPdf = async (actaId, tipo) => {
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

  const handleDocUpload = async (docType, file) => {
    setUpD(docType);
    try {
      await uploadTiFinancialDoc(asset.id, docType, file);
      showToast("Documento subido", "success");
      const updated = await listTiFinancialDocs(asset.id);
      setDocs(Array.isArray(updated) ? updated : []);
    } catch (e) { showToast(e?.response?.data?.message || "Error", "error"); }
    finally { setUpD(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{asset.name || asset.nombre}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{[asset.brand || asset.marca, asset.model || asset.modelo].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TiStatusBadge status={asset.status || asset.estado} />
            <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"><FiX size={16} /></button>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40"><FiRefreshCw size={20} className="animate-spin text-slate-300" /></div>
        ) : (
          <div className="flex-1 overflow-auto p-6 space-y-5">
            {/* Depreciación */}
            {asset.depreciation_pct != null && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-slate-600">Depreciación acumulada</span>
                  <span className={`text-sm font-bold ${asset.depreciation_pct >= 90 ? "text-red-600" : asset.depreciation_pct >= 60 ? "text-amber-600" : "text-green-600"}`}>{asset.depreciation_pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className={`h-full rounded-full ${asset.depreciation_pct >= 90 ? "bg-red-400" : asset.depreciation_pct >= 60 ? "bg-amber-400" : "bg-green-500"}`} style={{ width: `${Math.min(asset.depreciation_pct, 100)}%` }} />
                </div>
                {asset.fully_depreciated && (
                  <div className="flex items-center gap-1.5 mt-2 rounded-lg bg-red-50 border border-red-100 px-3 py-1.5">
                    <FiAlertTriangle size={12} className="text-red-500" />
                    <span className="text-xs text-red-700 font-medium">Activo totalmente depreciado</span>
                  </div>
                )}
              </div>
            )}
            {/* Info equipo */}
            <div>
              <SectionLabel>Información del equipo</SectionLabel>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ["Código",             asset.asset_code || "-"],
                  ["N° de serie",        asset.serial_number || "-"],
                  ["IMEI",               asset.imei || "-"],
                  ["Fecha de compra",    asset.purchase_date ? String(asset.purchase_date).slice(0,10) : "-"],
                  ["Valor de compra",    asset.purchase_value ? `$${Number(asset.purchase_value).toLocaleString("es-EC",{minimumFractionDigits:2})}` : "-"],
                  ["Últ. mantenimiento", asset.last_maintenance_at ? String(asset.last_maintenance_at).slice(0,10) : "-"],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs text-slate-400">{l}</p>
                    <p className="text-slate-800 font-medium">{v}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Historial asignaciones */}
            <div className="border-t border-slate-100 pt-4">
              <SectionLabel>Historial de asignaciones</SectionLabel>
              {!hist.length ? <p className="text-xs text-slate-400 py-2 text-center">Sin historial</p> : (
                <div className="rounded-xl border border-slate-100 overflow-hidden max-h-40 overflow-y-auto">
                  {hist.map((h, i) => (
                    <div key={h.id} className={`px-3 py-2.5 text-xs ${i < hist.length-1 ? "border-b border-slate-100" : ""}`}>
                      <p className="font-medium text-slate-700">{h.action === "unassign" ? `Retiro — ${h.previous_user_name || "-"}` : `Entrega a ${h.assigned_to_name || "-"}`}</p>
                      {h.reason && <p className="text-slate-500 mt-0.5">{h.reason}</p>}
                      <p className="text-slate-400 mt-0.5">{new Date(h.created_at).toLocaleString("es-EC",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}{h.created_by_name ? ` · por ${h.created_by_name}` : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Actas */}
            <div className="border-t border-slate-100 pt-4">
              <SectionLabel>Actas ({actas.length})</SectionLabel>
              {!actas.length ? <p className="text-xs text-slate-400 py-2 text-center">Sin actas</p> : (
                <div className="space-y-2">
                  {actas.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.tipo==="entrega"?"bg-blue-50 text-blue-700":"bg-amber-50 text-amber-700"}`}>{a.tipo}</span>
                          {a.is_complete
                            ? <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700"><FiCheck size={9}/> Firmada</span>
                            : <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{a.recipient_nombre || "-"} · {new Date(a.generated_at).toLocaleDateString("es-EC")}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadActaPdf(a.id, a.tipo)}
                          disabled={downloadingPdf === a.id}
                          className="cursor-pointer flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:text-slate-900 transition-colors active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                        >
                          {downloadingPdf === a.id ? <FiRefreshCw size={10} className="animate-spin"/> : <FiDownload size={10}/>}
                          PDF
                        </button>
                        {a.is_complete && a.signed_pdf_drive_url && (
                          <a href={a.signed_pdf_drive_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 transition-colors">
                            <FiCheck size={10}/> Firmada
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Documentos financieros */}
            <div className="border-t border-slate-100 pt-4">
              <SectionLabel>Documentos financieros</SectionLabel>
              <div className="space-y-2">
                {[
                  { type: "factura", label: "Factura de compra" },
                  { type: "letra_de_cambio", label: "Letra de cambio" },
                ].map(({ type, label }) => {
                  const doc = docs.find((d) => d.doc_type === type);
                  const uploading = uploadingDoc === type;
                  return (
                    <div key={type} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{label}</p>
                        {doc ? (
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700"><FiCheck size={9}/> Subido</span>
                            {doc.sha256 && (
                              <span className="font-mono text-[10px] text-slate-400 cursor-pointer" title={doc.sha256} onClick={() => navigator.clipboard?.writeText(doc.sha256)}>
                                {String(doc.sha256).slice(0,10)}…
                              </span>
                            )}
                          </div>
                        ) : <span className="inline-flex mt-0.5 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {doc?.drive_url && (
                          <a href={doc.drive_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:border-slate-300 transition-colors">
                            <FiDownload size={11}/>
                          </a>
                        )}
                        <label className="cursor-pointer">
                          <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${uploading?"border-slate-200 bg-slate-100 text-slate-400":doc?"border-slate-200 bg-white text-slate-600 hover:bg-slate-50":"border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
                            {uploading ? <FiRefreshCw size={11} className="animate-spin"/> : <FiUploadCloud size={11}/>} {doc?"Reemplazar":"Subir"}
                          </span>
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" className="hidden" disabled={!!uploadingDoc}
                            onChange={(e) => { const f=e.target.files?.[0]; if(f) handleDocUpload(type,f); e.target.value=""; }}/>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
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
    </div>
  );
}

// ── Modal detalle ropa (para Gestión) ────────────────────────────────────────

function RopaDetailModal({ delivery, onClose }) {
  const { showToast } = useUI();
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listCollabDeliveryDocs(delivery.id)
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => showToast("No se pudo cargar documentos", "error"))
      .finally(() => setLoading(false));
  }, [delivery.id, showToast]);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      await uploadCollabDeliveryDoc(delivery.id, file);
      showToast("Factura subida", "success");
      const updated = await listCollabDeliveryDocs(delivery.id);
      setDocs(Array.isArray(updated) ? updated : []);
    } catch (e) { showToast(e?.response?.data?.message || "Error al subir", "error"); }
    finally { setUploading(false); }
  };

  const attr = delivery.attributes || {};
  const factura = docs.find((d) => d.doc_type === "factura");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{delivery.item_name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <CategoryBadge category={delivery.category} />
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLLAB_STATUS_COLORS[delivery.status] || "bg-slate-100 text-slate-600"}`}>{delivery.status}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-colors mt-0.5">
            <FiX size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-5">
          <div>
            <SectionLabel>Información del ítem</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ["Talla",         attr.talla         || "-"],
                ["Cantidad",      attr.cantidad      ? String(attr.cantidad) : "-"],
                ["N° de serie",   delivery.serial_number || "-"],
                ["Condición",     delivery.condition  || "-"],
                ["Fecha entrega", delivery.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString("es-EC") : "-"],
                ["Observaciones", delivery.observations || "-"],
              ].map(([label, value]) => (
                <div key={label} className={label === "Observaciones" ? "col-span-2" : ""}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <SectionLabel>Factura de compra</SectionLabel>
            {loading ? (
              <div className="flex items-center justify-center h-12"><FiRefreshCw size={16} className="animate-spin text-slate-300" /></div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700">Factura</p>
                  {factura ? (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                        <FiCheck size={9} /> Subida
                      </span>
                      {factura.sha256 && (
                        <span className="font-mono text-[10px] text-slate-400 cursor-pointer" title={factura.sha256}
                          onClick={() => navigator.clipboard?.writeText(factura.sha256)}>
                          {String(factura.sha256).slice(0, 10)}…
                        </span>
                      )}
                      {factura.uploaded_by_name && (
                        <span className="text-[10px] text-slate-400">por {factura.uploaded_by_name}</span>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex mt-0.5 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {factura?.drive_url && (
                    <a href={factura.drive_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:border-slate-300 transition-colors">
                      <FiDownload size={11} />
                    </a>
                  )}
                  <label className="cursor-pointer">
                    <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${uploading ? "border-slate-200 bg-slate-100 text-slate-400" : factura ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
                      {uploading ? <FiRefreshCw size={11} className="animate-spin" /> : <FiUploadCloud size={11} />}
                      {factura ? "Reemplazar" : "Subir"}
                    </span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" className="hidden" disabled={uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal detalle herramienta (para Gestión) ──────────────────────────────────

function HerramientaDetailModal({ delivery, onClose }) {
  const { showToast } = useUI();
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listCollabDeliveryDocs(delivery.id)
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => showToast("No se pudo cargar documentos", "error"))
      .finally(() => setLoading(false));
  }, [delivery.id, showToast]);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      await uploadCollabDeliveryDoc(delivery.id, file);
      showToast("Factura subida", "success");
      const updated = await listCollabDeliveryDocs(delivery.id);
      setDocs(Array.isArray(updated) ? updated : []);
    } catch (e) { showToast(e?.response?.data?.message || "Error al subir", "error"); }
    finally { setUploading(false); }
  };

  const attr = delivery.attributes || {};
  const factura = docs.find((d) => d.doc_type === "factura");

  const daysTilRenewal = delivery.renewal_date
    ? Math.ceil((new Date(delivery.renewal_date) - new Date()) / 86400000)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{delivery.item_name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <CategoryBadge category={delivery.category} />
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLLAB_STATUS_COLORS[delivery.status] || "bg-slate-100 text-slate-600"}`}>{delivery.status}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-colors mt-0.5">
            <FiX size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Info de la herramienta */}
          <div>
            <SectionLabel>Información del ítem</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ["Marca",          attr.marca         || "-"],
                ["Características", attr.caracteristicas || "-"],
                ["N° de serie",    delivery.serial_number || "-"],
                ["Condición",      delivery.condition  || "-"],
                ["Fecha entrega",  delivery.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString("es-EC") : "-"],
                ["Observaciones",  delivery.observations || "-"],
              ].map(([label, value]) => (
                <div key={label} className={label === "Características" || label === "Observaciones" ? "col-span-2" : ""}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Alerta renovación */}
          {daysTilRenewal !== null && daysTilRenewal <= 60 && (
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${daysTilRenewal < 0 ? "border-red-100 bg-red-50" : "border-amber-100 bg-amber-50"}`}>
              <FiAlertTriangle size={13} className={daysTilRenewal < 0 ? "text-red-500" : "text-amber-500"} />
              <p className={`text-xs font-medium ${daysTilRenewal < 0 ? "text-red-700" : "text-amber-700"}`}>
                {daysTilRenewal < 0
                  ? `Renovación vencida hace ${Math.abs(daysTilRenewal)} días`
                  : `Renovación en ${daysTilRenewal} días — ${new Date(delivery.renewal_date).toLocaleDateString("es-EC")}`}
              </p>
            </div>
          )}

          {/* Factura */}
          <div className="border-t border-slate-100 pt-4">
            <SectionLabel>Factura de compra</SectionLabel>
            {loading ? (
              <div className="flex items-center justify-center h-12"><FiRefreshCw size={16} className="animate-spin text-slate-300" /></div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700">Factura</p>
                  {factura ? (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                        <FiCheck size={9} /> Subida
                      </span>
                      {factura.sha256 && (
                        <span className="font-mono text-[10px] text-slate-400 cursor-pointer" title={factura.sha256}
                          onClick={() => navigator.clipboard?.writeText(factura.sha256)}>
                          {String(factura.sha256).slice(0, 10)}…
                        </span>
                      )}
                      {factura.uploaded_by_name && (
                        <span className="text-[10px] text-slate-400">por {factura.uploaded_by_name}</span>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex mt-0.5 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {factura?.drive_url && (
                    <a href={factura.drive_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:border-slate-300 transition-colors">
                      <FiDownload size={11} />
                    </a>
                  )}
                  <label className="cursor-pointer">
                    <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${uploading ? "border-slate-200 bg-slate-100 text-slate-400" : factura ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
                      {uploading ? <FiRefreshCw size={11} className="animate-spin" /> : <FiUploadCloud size={11} />}
                      {factura ? "Reemplazar" : "Subir"}
                    </span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" className="hidden" disabled={uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal de reportes ─────────────────────────────────────────────────────────

const CAT_ES_REPORT = {
  ropa: "Ropa de trabajo", epp: "EPP", herramienta: "Herramienta de trabajo",
  logistica: "Logística", ti: "Herramientas TI", suministros: "Suministros",
};
const STATUS_ES_REPORT = { entregado: "Entregado", retirado: "Retirado", perdido: "Perdido", "dañado": "Dañado" };

function _fmtDate(v) { return v ? new Date(v).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""; }

function _buildCSV(rows, titleLine) {
  const headers = [
    "Colaborador", "Email",
    "Categoría", "Ítem", "Estado",
    "Fecha entrega", "Fecha retiro", "Fecha renovación",
    "Número de serie", "Condición física",
    "Marca", "Características", "Banco", "Fecha expedición", "Fecha expiración",
    "Código acta", "Tipo acta", "Fecha acta", "Acta firmada",
    "Observaciones",
  ];
  const csvRows = [titleLine, headers.join(";")];
  for (const r of rows) {
    const attrs = r.attributes || {};
    csvRows.push([
      r.colaborador, r.email,
      CAT_ES_REPORT[r.category] || r.category,
      r.item_name,
      STATUS_ES_REPORT[r.status] || r.status,
      _fmtDate(r.delivery_date), _fmtDate(r.retiro_at), _fmtDate(r.renewal_date),
      r.serial_number || "",
      r.physical_condition || "",
      attrs.marca || attrs.banco || "",
      attrs.caracteristicas || attrs.descripcion || "",
      attrs.banco || "",
      _fmtDate(attrs.fecha_expedicion), _fmtDate(attrs.fecha_expiracion),
      r.acta_code || "", r.acta_tipo || "", r.acta_fecha || "", _fmtDate(r.acta_firmada_at),
      (r.observations || "").replace(/;/g, ","),
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"));
  }
  return "﻿" + csvRows.join("\n");
}

function _downloadCSV(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ReportesModal({ onClose, users }) {
  const { showToast } = useUI();
  const [tab, setTab]           = useState("general"); // "general" | "colaborador"
  const [selUser, setSelUser]   = useState("");
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => !q || (u.fullname || u.name || u.email || "").toLowerCase().includes(q));
  }, [users, search]);

  const [sha256Info, setSha256Info] = useState(null);

  const runReport = async () => {
    if (tab === "colaborador" && !selUser) { showToast("Selecciona un colaborador", "warning"); return; }
    setLoading(true);
    setSha256Info(null);
    try {
      const { blob, sha256, filename } = tab === "general"
        ? await downloadCollabFullReportPdf()
        : await downloadCollabCollaboratorReportPdf(selUser);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setSha256Info(sha256);
      showToast("PDF generado y sellado con SHA-256", "success");
    } catch (e) {
      const msg = e?.response?.status === 404 ? "Sin entregas para este colaborador" : "Error al generar el reporte";
      showToast(msg, "error");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FiBarChart2 size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">Reportes</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <FiX size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {[
            { key: "general",      label: "Reporte General",           icon: FiUsers },
            { key: "colaborador",  label: "Reporte por Colaborador",   icon: FiUser },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {tab === "general" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                <FiUsers size={22} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Todos los colaboradores</p>
                <p className="text-xs text-slate-500 mt-1">PDF sellado con SHA-256. Incluye cada ítem entregado con fechas, número de serie, condición, acta y observaciones, agrupado por colaborador.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar colaborador..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm focus:border-slate-400 focus:bg-white focus:outline-none" />
                {search && <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><FiX size={12}/></button>}
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Sin resultados</p>
                ) : filtered.map((u) => {
                  const isSel = String(u.id) === selUser;
                  return (
                    <button key={u.id} type="button" onClick={() => setSelUser(String(u.id))}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${isSel ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isSel ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                        {(u.fullname || u.name || u.email || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isSel ? "text-blue-700" : "text-slate-800"}`}>{u.fullname || u.name || u.email}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                      </div>
                      {isSel && <FiCheck size={14} className="text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button type="button" onClick={runReport} disabled={loading || (tab === "colaborador" && !selUser)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {loading ? <FiRefreshCw size={14} className="animate-spin" /> : <FiDownload size={14} />}
            {loading ? "Generando PDF..." : "Descargar PDF sellado"}
          </button>

          {sha256Info && (
            <div className="rounded-xl border border-green-100 bg-green-50 p-3">
              <p className="text-[10px] font-semibold text-green-700 mb-1">SHA-256 del documento</p>
              <p className="font-mono text-[9px] text-green-800 break-all leading-relaxed">{sha256Info}</p>
              <p className="text-[9px] text-green-600 mt-1">Guardado en la última página del PDF. Cualquier modificación altera este hash.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Panel de gestión de facturas (financiero) ─────────────────────────────────

function FacturaManagerPanel({ deliveries, userDocs, selectedIds, onToggle, onSelectAll, onClearAll, uploading, onUpload, uploadingCert, onUploadCert }) {
  const facturaItems = deliveries.filter((d) => d.status === "entregado" && d.category !== "logistica");
  const certItems    = deliveries.filter((d) => d.status === "entregado" && d.category === "logistica");
  const allSelected  = facturaItems.length > 0 && facturaItems.every((d) => selectedIds.includes(d.id));

  return (
    <div className="overflow-hidden">

      {/* ── Facturas (ropa, herramienta, epp, suministros) — pueden agruparse ── */}
      {facturaItems.length > 0 && (
        <>
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Facturas de compra</span>
              {selectedIds.length > 0 && (
                <span className="text-xs text-slate-400">{selectedIds.length} seleccionado(s)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={allSelected ? onClearAll : onSelectAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                {allSelected ? "Deseleccionar todo" : "Seleccionar todos"}
              </button>
              <label className={`cursor-pointer flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${uploading ? "border-slate-200 bg-slate-100 text-slate-400" : selectedIds.length > 0 ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" : "border-slate-200 bg-white text-slate-400 cursor-not-allowed"}`}>
                {uploading ? <FiRefreshCw size={11} className="animate-spin"/> : <FiUploadCloud size={11}/>}
                {selectedIds.length > 1 ? "Subir factura grupal" : "Subir factura"}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" className="hidden" disabled={uploading || !selectedIds.length}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
              </label>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {facturaItems.map((d) => {
              const doc = userDocs.find((ud) => ud.delivery_id === d.id && ud.doc_type === "factura");
              const isSelected = selectedIds.includes(d.id);
              return (
                <label key={d.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                  <input type="checkbox" checked={isSelected} onChange={() => onToggle(d.id)} className="rounded shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CategoryBadge category={d.category} />
                      <p className="text-xs font-medium text-slate-800 truncate">{d.item_name}</p>
                    </div>
                    {d.serial_number && <p className="text-[10px] font-mono text-slate-400 mt-0.5">{d.serial_number}</p>}
                    {d.delivery_date && <p className="text-[10px] text-slate-400">{new Date(d.delivery_date).toLocaleDateString("es-EC")}</p>}
                  </div>
                  <div className="shrink-0">
                    {doc ? (
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                          <FiCheck size={9}/> Factura
                        </span>
                        {doc.drive_url && (
                          <a href={doc.drive_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:text-slate-700 transition-colors">
                            <FiDownload size={10}/>
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          {selectedIds.length > 1 && (
            <div className="px-5 py-2 border-t border-slate-100 bg-blue-50">
              <p className="text-xs text-blue-700">
                <span className="font-semibold">{selectedIds.length} ítems.</span> La misma factura se vinculará a todos ellos.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Certificados bancarios (logística) — individuales por ítem ── */}
      {certItems.length > 0 && (
        <>
          <div className={`flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 ${facturaItems.length > 0 ? "border-t border-slate-200" : ""}`}>
            <div>
              <span className="text-xs font-semibold text-slate-700">Certificados bancarios</span>
              <span className="text-xs text-slate-400 ml-2">· Individual por tarjeta entregada</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {certItems.map((d) => {
              const cert = userDocs.find((ud) => ud.delivery_id === d.id && ud.doc_type === "certificado_bancario");
              const isUploading = uploadingCert === d.id;
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CategoryBadge category={d.category} />
                      <p className="text-xs font-medium text-slate-800 truncate">{d.item_name}</p>
                    </div>
                    {d.serial_number && <p className="text-[10px] font-mono text-slate-400 mt-0.5">{d.serial_number}</p>}
                    {d.delivery_date && <p className="text-[10px] text-slate-400">{new Date(d.delivery_date).toLocaleDateString("es-EC")}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {cert ? (
                      <>
                        <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                          <FiCheck size={9}/> Cert.
                        </span>
                        {cert.drive_url && (
                          <a href={cert.drive_url} target="_blank" rel="noreferrer"
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:text-slate-700 transition-colors">
                            <FiDownload size={10}/>
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                    )}
                    <label className="cursor-pointer">
                      <span className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors ${isUploading ? "border-slate-200 bg-slate-100 text-slate-400" : cert ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
                        {isUploading ? <FiRefreshCw size={9} className="animate-spin"/> : <FiUploadCloud size={9}/>}
                        {cert ? "Reemplazar" : "Subir"}
                      </span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" className="hidden"
                        disabled={!!uploadingCert}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadCert(d.id, f); e.target.value = ""; }} />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {facturaItems.length === 0 && certItems.length === 0 && (
        <p className="text-xs text-slate-400 p-6 text-center">Sin ítems activos</p>
      )}
    </div>
  );
}

// ── Modal detalle logística (para Gestión) ────────────────────────────────────

function LogisticaDetailModal({ delivery, onClose }) {
  const { showToast } = useUI();
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listCollabDeliveryDocs(delivery.id)
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => showToast("No se pudo cargar documentos", "error"))
      .finally(() => setLoading(false));
  }, [delivery.id, showToast]);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      await uploadCollabDeliveryDoc(delivery.id, file, "certificado_bancario");
      showToast("Certificado subido", "success");
      const updated = await listCollabDeliveryDocs(delivery.id);
      setDocs(Array.isArray(updated) ? updated : []);
    } catch (e) { showToast(e?.response?.data?.message || "Error al subir", "error"); }
    finally { setUploading(false); }
  };

  const attr = delivery.attributes || {};
  const cert = docs.find((d) => d.doc_type === "certificado_bancario");

  const daysToExpire = attr.fecha_expiracion
    ? Math.ceil((new Date(attr.fecha_expiracion) - new Date()) / 86400000)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{delivery.item_name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <CategoryBadge category={delivery.category} />
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLLAB_STATUS_COLORS[delivery.status] || "bg-slate-100 text-slate-600"}`}>{delivery.status}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-colors mt-0.5">
            <FiX size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Alerta expiración */}
          {daysToExpire !== null && daysToExpire <= 60 && (
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${daysToExpire < 0 ? "border-red-100 bg-red-50" : "border-amber-100 bg-amber-50"}`}>
              <FiAlertTriangle size={13} className={daysToExpire < 0 ? "text-red-500" : "text-amber-500"} />
              <p className={`text-xs font-medium ${daysToExpire < 0 ? "text-red-700" : "text-amber-700"}`}>
                {daysToExpire < 0
                  ? `Documento expirado hace ${Math.abs(daysToExpire)} días`
                  : `Expira en ${daysToExpire} días — ${new Date(attr.fecha_expiracion).toLocaleDateString("es-EC")}`}
              </p>
            </div>
          )}

          {/* Info del documento */}
          <div>
            <SectionLabel>Información del documento</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ["Fecha de expedición", attr.fecha_expedicion ? new Date(attr.fecha_expedicion).toLocaleDateString("es-EC") : "-"],
                ["Fecha de expiración", attr.fecha_expiracion ? new Date(attr.fecha_expiracion).toLocaleDateString("es-EC") : "-"],
                ["N° de serie / referencia", delivery.serial_number || "-"],
                ["Condición", delivery.condition || "-"],
                ["Fecha entrega", delivery.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString("es-EC") : "-"],
                ["Observaciones", delivery.observations || "-"],
              ].map(([label, value]) => (
                <div key={label} className={label === "Observaciones" ? "col-span-2" : ""}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Certificado bancario */}
          <div className="border-t border-slate-100 pt-4">
            <SectionLabel>Certificado bancario</SectionLabel>
            {loading ? (
              <div className="flex items-center justify-center h-12"><FiRefreshCw size={16} className="animate-spin text-slate-300" /></div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700">Certificado bancario</p>
                  {cert ? (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                        <FiCheck size={9} /> Subido
                      </span>
                      {cert.sha256 && (
                        <span className="font-mono text-[10px] text-slate-400 cursor-pointer" title={cert.sha256}
                          onClick={() => navigator.clipboard?.writeText(cert.sha256)}>
                          {String(cert.sha256).slice(0, 10)}…
                        </span>
                      )}
                      {cert.uploaded_by_name && (
                        <span className="text-[10px] text-slate-400">por {cert.uploaded_by_name}</span>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex mt-0.5 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {cert?.drive_url && (
                    <a href={cert.drive_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:border-slate-300 transition-colors">
                      <FiDownload size={11} />
                    </a>
                  )}
                  <label className="cursor-pointer">
                    <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${uploading ? "border-slate-200 bg-slate-100 text-slate-400" : cert ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
                      {uploading ? <FiRefreshCw size={11} className="animate-spin" /> : <FiUploadCloud size={11} />}
                      {cert ? "Reemplazar" : "Subir"}
                    </span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" className="hidden" disabled={uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab Gestión por colaborador ───────────────────────────────────────────────

const TH_FLAG_LABELS = {
  // entregas
  uniformes_entregados:              "Ropa de trabajo entregada",
  epp_entregados:                    "EPP entregado",
  herramientas_trabajo_entregadas:   "Herramientas de trabajo entregadas",
  logistica_entregada:               "Logística entregada",
  acta_entrega_equipos_comunicacion: "Herramientas de comunicación entregadas",
  // retiros
  ropa_retirada:                     "Ropa de trabajo retirada",
  epp_retirado:                      "EPP retirado",
  herramientas_trabajo_retiradas:    "Herramientas de trabajo retiradas",
  logistica_retirada:                "Logística retirada",
  ti_retirado:                       "Herramientas de comunicación retiradas",
};

function CollabGestionTab({ tiAssets, tiActas = [], users, catalog, onRefresh, actorRole }) {
  const { showToast } = useUI();
  const [selectedUser, setUser]       = useState("");
  const [userSearch, setUserSearch]   = useState("");
  const [deliveries, setDeliveries]   = useState([]);
  const [sessions, setSessions]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [detailAsset, setDetailAsset]         = useState(null);
  const [detailDelivery, setDetailDelivery]   = useState(null);
  const [detailLogistica, setDetailLogistica] = useState(null);
  const [detailRopa, setDetailRopa]           = useState(null);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [selectedSession, setSelSess]         = useState(null);
  const [userDocs, setUserDocs]               = useState([]);   // docs de todos los deliveries del usuario
  const [selectedForFactura, setSelFactura]   = useState([]);   // IDs seleccionados para factura grupal
  const [uploadingFactura, setUploadingF]     = useState(false);
  const [uploadingCert, setUploadingCert]     = useState(null); // delivery ID siendo subido (certificado individual)
  const isFinancieroGestion = FULL_ACCESS_ROLES.includes(actorRole);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter((u) => !q || (u.fullname || u.name || u.email || "").toLowerCase().includes(q));
  }, [users, userSearch]);

  const userTiAssets = useMemo(() => {
    if (!selectedUser) return [];
    return tiAssets.filter((a) =>
      String(a.assigned_to_id || a.assigned_to_user_id || "") === String(selectedUser)
    );
  }, [tiAssets, selectedUser]);

  const userTiActas = useMemo(() => {
    if (!selectedUser) return [];
    return tiActas.filter((a) =>
      String(a.recipient_user_id || "") === String(selectedUser)
    );
  }, [tiActas, selectedUser]);

  const groupedDeliveries = useMemo(() => {
    const groups = { ropa: [], epp: [], herramienta: [], logistica: [], suministros: [] };
    for (const d of deliveries) {
      if (groups[d.category]) groups[d.category].push(d);
    }
    return groups;
  }, [deliveries]);

  // Summary actas from sessions
  const allActas = useMemo(() => {
    const actas = [];
    for (const s of sessions) {
      if (s.actas) actas.push(...s.actas);
    }
    return actas;
  }, [sessions]);

  // Onboarding flags inferred from deliveries + sessions + TI actas
  const inferredFlags = useMemo(() => {
    const flags = {};
    // Desde sessions (fuente primaria)
    for (const s of sessions) {
      if (s.tipo === "entrega") {
        if (s.category === "ropa")        flags["uniformes_entregados"] = true;
        if (s.category === "epp")         flags["epp_entregados"] = true;
        if (s.category === "herramienta") flags["herramientas_trabajo_entregadas"] = true;
        if (s.category === "logistica")   flags["logistica_entregada"] = true;
        if (s.category === "ti")          flags["acta_entrega_equipos_comunicacion"] = true;
      }
      if (s.tipo === "retiro") {
        if (s.category === "ropa")        flags["ropa_retirada"] = true;
        if (s.category === "epp")         flags["epp_retirado"] = true;
        if (s.category === "herramienta") flags["herramientas_trabajo_retiradas"] = true;
        if (s.category === "logistica")   flags["logistica_retirada"] = true;
        if (s.category === "ti")          flags["ti_retirado"] = true;
      }
    }
    // Fallback desde deliveries individuales (entregas sin sesión o anteriores)
    for (const d of deliveries) {
      if (d.status === "entregado") {
        if (d.category === "ropa")        flags["uniformes_entregados"] = true;
        if (d.category === "epp")         flags["epp_entregados"] = true;
        if (d.category === "herramienta") flags["herramientas_trabajo_entregadas"] = true;
        if (d.category === "logistica")   flags["logistica_entregada"] = true;
      }
      if (d.status === "retirado") {
        if (d.category === "ropa")        flags["ropa_retirada"] = true;
        if (d.category === "epp")         flags["epp_retirado"] = true;
        if (d.category === "herramienta") flags["herramientas_trabajo_retiradas"] = true;
        if (d.category === "logistica")   flags["logistica_retirada"] = true;
      }
    }
    // TI assets asignados = equipo de comunicación entregado
    if (userTiAssets.length > 0) {
      flags["computadora_entregada"] = true;
      flags["acta_entrega_equipos_comunicacion"] = true;
    }
    return flags;
  }, [sessions, deliveries, userTiAssets]);

  const loadUser = useCallback(async (uid) => {
    if (!uid) { setDeliveries([]); setSessions([]); setUserDocs([]); return; }
    setLoading(true);
    try {
      const promises = [
        listCollabDeliveriesByUser(uid),
        listCollabSessionsByUser(uid),
        ...(isFinancieroGestion ? [listCollabDeliveryDocsByUser(uid)] : []),
      ];
      const [del, sess, docs] = await Promise.all(promises);
      setDeliveries(Array.isArray(del) ? del : []);
      setSessions(Array.isArray(sess) ? sess : []);
      if (isFinancieroGestion) setUserDocs(Array.isArray(docs) ? docs : []);
    } catch { showToast("No se pudo cargar la información del colaborador", "error"); }
    finally { setLoading(false); }
  }, [showToast, isFinancieroGestion]);

  const handleUserSelect = (uid) => { setUser(uid); setSelSess(null); loadUser(uid); };

  const selectedUserObj = useMemo(() => users.find((u) => String(u.id) === String(selectedUser)), [users, selectedUser]);

  const totalItems = deliveries.filter((d) => d.status === "entregado").length;
  const itemsRetired = deliveries.filter((d) => d.status === "retirado").length;
  const renewalAlerts = deliveries.filter((d) => {
    const dateStr = d.renewal_date || d.attributes?.fecha_expiracion;
    if (!dateStr) return false;
    const days = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    return days <= 60;
  });

  return (
    <div className="space-y-5">
      {/* Selector usuario */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">Selecciona un colaborador</p>
        <div className="relative mb-2">
          <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Buscar por nombre o correo..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm focus:border-slate-400 focus:bg-white focus:outline-none" />
          {userSearch && (
            <button type="button" onClick={() => setUserSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <FiX size={13} />
            </button>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
          {filteredUsers.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">Sin resultados</p>
          ) : filteredUsers.map((u) => {
            const isSelected = String(u.id) === String(selectedUser);
            return (
              <button key={u.id} type="button" onClick={() => handleUserSelect(String(u.id))}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isSelected ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                  {(u.fullname || u.name || u.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${isSelected ? "text-blue-700" : "text-slate-800"}`}>{u.fullname || u.name || u.email}</p>
                  <p className="text-[10px] text-slate-400 truncate">{u.email} · {u.role}</p>
                </div>
                {isSelected && <FiCheck size={14} className="text-blue-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {!selectedUser ? (
        <EmptyState icon={FiUsers} message="Selecciona un colaborador para ver su historial completo" />
      ) : loading ? (
        <div className="flex items-center justify-center h-32"><FiRefreshCw size={20} className="animate-spin text-slate-300" /></div>
      ) : (
        <div className="space-y-5">
          {/* Header del colaborador */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <FiUser size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900">{selectedUserObj?.fullname || selectedUserObj?.name || "—"}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedUserObj?.email} · {selectedUserObj?.role_label || selectedUserObj?.role || "—"}</p>
              </div>
              {renewalAlerts.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
                  <FiAlertTriangle size={13} className="text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">{renewalAlerts.length} alerta{renewalAlerts.length !== 1 ? "s" : ""} de renovación</span>
                </div>
              )}
              {isFinancieroGestion && deliveries.length > 0 && (
                <button type="button" onClick={() => setShowFacturaModal(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shrink-0">
                  <FiFileText size={13} /> Facturas
                </button>
              )}
            </div>
            {/* KPI strip */}
            <div className="flex flex-wrap sm:flex-nowrap sm:divide-x divide-slate-100">
              {[
                { label: "Ítems activos",    value: totalItems,          color: "text-slate-800" },
                { label: "Ítems retirados",  value: itemsRetired,        color: "text-slate-500" },
                { label: "Activos TI",       value: userTiAssets.length, color: "text-violet-700" },
                { label: "Sesiones",         value: sessions.length + userTiActas.length, color: "text-slate-800" },
                { label: "Renov. próximas",  value: renewalAlerts.length, color: renewalAlerts.length > 0 ? "text-amber-600" : "text-slate-800" },
              ].map((k, i) => (
                <div key={k.label} className={`flex-1 min-w-[50%] sm:min-w-0 px-4 py-3 ${i > 0 && i % 2 === 0 ? "border-t border-slate-100 sm:border-t-0" : i === 1 ? "border-l border-slate-100 sm:border-l-0" : ""}`}>
                  <p className="text-xs text-slate-400">{k.label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Panel principal — columnas */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

            {/* Columna izquierda: Ropa, Herramientas, Logística */}
            <div className="lg:col-span-2 space-y-4">

              {/* Activos TI */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FiCpu size={15} className="text-violet-500" />
                  <span className="text-sm font-semibold text-slate-800">Herramientas de comunicación</span>
                  <span className="ml-auto text-xs text-slate-400">{userTiAssets.length} equipo{userTiAssets.length !== 1 ? "s" : ""}</span>
                </div>
                {!userTiAssets.length ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Sin activos TI asignados</p>
                ) : (
                  <div className="space-y-2">
                    {userTiAssets.map((a) => {
                      const tiActasSess = sessions.filter((s) => s.category === "ti");
                      return (
                        <button key={a.id} type="button" onClick={() => setDetailAsset(a)}
                          className="w-full text-left rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 hover:border-slate-200 hover:bg-white transition-colors active:scale-[0.98]">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{a.name || a.nombre}</p>
                              <p className="text-xs text-slate-500">{[a.brand||a.marca, a.model||a.modelo].filter(Boolean).join(" · ")}</p>
                              {(a.serial_number||a.numero_serie) && <p className="text-xs font-mono text-slate-400 mt-0.5">{a.serial_number||a.numero_serie}</p>}
                              {a.assigned_at && <p className="text-[10px] text-slate-400 mt-0.5">Asignado {new Date(a.assigned_at).toLocaleDateString("es-EC")}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <TiStatusBadge status={a.status||a.estado} />
                              <span className="text-[10px] text-blue-600 flex items-center gap-0.5"><FiInfo size={10}/> Ver detalle</span>
                            </div>
                          </div>
                          <DepBar pct={a.depreciation_pct} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ropa, EPP, Herramientas, Logística, Suministros */}
              {[
                { key: "ropa",        icon: FiPackage, iconColor: "text-slate-500" },
                { key: "epp",         icon: FiShield,  iconColor: "text-orange-500" },
                { key: "herramienta", icon: FiPackage, iconColor: "text-amber-500" },
                { key: "logistica",   icon: FiPackage, iconColor: "text-blue-500" },
                { key: "suministros", icon: FiPackage, iconColor: "text-green-600" },
              ].map(({ key, icon: Icon, iconColor }) => {
                const items = groupedDeliveries[key] || [];
                return (
                  <div key={key} className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Icon size={15} className={iconColor} />
                      <span className="text-sm font-semibold text-slate-800">{CATEGORY_LABELS[key]}</span>
                      <span className="ml-auto text-xs text-slate-400">{items.length} ítem{items.length!==1?"s":""}</span>
                    </div>
                    {!items.length ? (
                      <p className="text-xs text-slate-400 py-3 text-center">Sin entregas registradas</p>
                    ) : (
                      <div className="space-y-2">
                        {items.map((d) => {
                          const days = d.renewal_date ? Math.ceil((new Date(d.renewal_date) - new Date()) / 86400000) : null;
                          const isRenewAlert = days !== null && days <= 60;
                          const isActive = d.status === "entregado";
                          const isHerr = d.category === "herramienta";
                          const isLog  = d.category === "logistica";
                          const isRopa = d.category === "ropa";
                          const isClickable = isHerr || isLog || isRopa;
                          const El = isClickable ? "button" : "div";
                          const logExpireDays = isLog && d.attributes?.fecha_expiracion
                            ? Math.ceil((new Date(d.attributes.fecha_expiracion) - new Date()) / 86400000)
                            : null;
                          const isExpireAlert = logExpireDays !== null && logExpireDays <= 60;
                          return (
                            <El key={d.id} type={isClickable ? "button" : undefined}
                              onClick={isClickable ? () => isHerr ? setDetailDelivery(d) : isRopa ? setDetailRopa(d) : setDetailLogistica(d) : undefined}
                              className={`w-full text-left rounded-xl border px-3 py-2.5 ${isActive ? "border-slate-100 bg-white" : "border-slate-100 bg-slate-50 opacity-70"} ${isClickable ? "hover:border-slate-200 hover:bg-slate-50 transition-colors active:scale-[0.98] cursor-pointer" : ""}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className={`text-sm font-medium truncate ${isActive ? "text-slate-900" : "text-slate-500"}`}>{d.item_name}</p>
                                  {d.attributes?.marca && <p className="text-xs text-slate-500 mt-0.5">{d.attributes.marca}</p>}
                                  {isRopa && (d.attributes?.talla || d.attributes?.cantidad) && (
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      {[d.attributes.talla ? `Talla: ${d.attributes.talla}` : "", d.attributes.cantidad ? `Cant.: ${d.attributes.cantidad}` : ""].filter(Boolean).join(" · ")}
                                    </p>
                                  )}
                                  {d.serial_number && <p className="text-xs font-mono text-slate-400 mt-0.5">{d.serial_number}</p>}
                                  {d.delivery_date && <p className="text-[10px] text-slate-400 mt-0.5">Entregado {new Date(d.delivery_date).toLocaleDateString("es-EC")}</p>}
                                  {isLog && d.attributes?.fecha_expiracion && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className="text-[10px] text-slate-400">Expira:</span>
                                      <RenewalBadge date={d.attributes.fecha_expiracion} />
                                    </div>
                                  )}
                                  {d.renewal_date && !isLog && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className="text-[10px] text-slate-400">Renovación:</span>
                                      <RenewalBadge date={d.renewal_date} />
                                    </div>
                                  )}
                                  {d.observations && <p className="text-[10px] text-slate-500 italic mt-0.5">{d.observations}</p>}
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${COLLAB_STATUS_COLORS[d.status]||"bg-slate-100 text-slate-600"}`}>{d.status}</span>
                                  {(isRenewAlert || isExpireAlert) && <FiAlertTriangle size={11} className="text-amber-500" />}
                                  {isClickable && <span className="text-[10px] text-blue-600 flex items-center gap-0.5"><FiInfo size={10}/> Ver detalle</span>}
                                </div>
                              </div>
                            </El>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Columna derecha: Sesiones + Flags TH */}
            <div className="space-y-4">
              {/* Checklist TH inferido */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FiShield size={15} className="text-slate-400" />
                  <span className="text-sm font-semibold text-slate-800">Estado en workspace TH</span>
                </div>

                {[
                  {
                    label: "Entregas",
                    color: "text-blue-600",
                    keys: [
                      ["uniformes_entregados",            "Ropa de trabajo entregada"],
                      ["epp_entregados",                   "EPP entregado"],
                      ["herramientas_trabajo_entregadas",  "Herramientas de trabajo entregadas"],
                      ["logistica_entregada",              "Logística entregada"],
                      ["acta_entrega_equipos_comunicacion","Herramientas de comunicación entregadas"],
                    ],
                  },
                  {
                    label: "Retiros",
                    color: "text-amber-600",
                    keys: [
                      ["ropa_retirada",                   "Ropa de trabajo retirada"],
                      ["epp_retirado",                    "EPP retirado"],
                      ["herramientas_trabajo_retiradas",  "Herramientas de trabajo retiradas"],
                      ["logistica_retirada",              "Logística retirada"],
                      ["ti_retirado",                     "Herramientas de comunicación retiradas"],
                    ],
                  },
                ].map(({ label, color, keys }) => (
                  <div key={label} className="mb-4 last:mb-0">
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${color}`}>{label}</p>
                    <div className="space-y-1.5">
                      {keys.map(([key, flagLabel]) => {
                        const done = Boolean(inferredFlags[key]);
                        return (
                          <div key={key} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${done ? "border-green-100 bg-green-50" : "border-slate-100 bg-slate-50"}`}>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-green-500" : "bg-slate-200"}`}>
                              {done && <FiCheck size={10} className="text-white" />}
                            </div>
                            <p className={`text-xs ${done ? "text-green-700 font-medium" : "text-slate-500"}`}>{flagLabel}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <p className="text-[10px] text-slate-400 mt-3 text-center">Se actualiza automáticamente al registrar sesiones de entrega/retiro.</p>
              </div>

              {/* Sesiones del usuario (collab + TI) */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Sesiones del colaborador</span>
                  <span className="text-xs text-slate-400">{sessions.length + userTiActas.length}</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {!sessions.length && !userTiActas.length ? (
                    <p className="text-xs text-slate-400 p-4 text-center">Sin sesiones</p>
                  ) : (
                    [...sessions.map((s) => ({ _kind: "collab", _date: s.session_date, ...s })),
                     ...userTiActas.map((a) => ({ _kind: "ti", _date: a.generated_at?.slice(0,10), ...a }))]
                      .sort((a, b) => (b._date || "").localeCompare(a._date || ""))
                      .map((item) => {
                        if (item._kind === "collab") {
                          const s = item;
                          return (
                            <button key={`c-${s.id}`} type="button" onClick={() => setSelSess(selectedSession?.id === s.id ? null : s)}
                              className={`w-full px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-colors ${selectedSession?.id===s.id?"bg-slate-50":"hover:bg-slate-50"}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <CategoryBadge category={s.category} />
                                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.tipo==="entrega"?"bg-blue-50 text-blue-600":"bg-amber-50 text-amber-600"}`}>{s.tipo}</span>
                                  </div>
                                  <p className="text-xs text-slate-600">{s.session_date?.slice(0,10)} · {s.delivery_count} ítem{s.delivery_count!==1?"s":""}</p>
                                  {s.actas_pending>0 && <span className="text-[10px] text-amber-600">{s.actas_pending} acta{s.actas_pending!==1?"s":""} pendiente</span>}
                                </div>
                                <FiChevronRight size={12} className="text-slate-300 shrink-0 mt-0.5" />
                              </div>
                            </button>
                          );
                        }
                        // Acta TI
                        const a = item;
                        return (
                          <div key={`ti-${a.id}`} className="px-4 py-3 border-b border-slate-100 last:border-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  <CategoryBadge category="ti" />
                                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${a.tipo==="entrega"?"bg-blue-50 text-blue-600":"bg-amber-50 text-amber-600"}`}>{a.tipo}</span>
                                </div>
                                <p className="text-xs text-slate-600">{a._date} · {a.acta_code || `Acta #${a.id}`}</p>
                                {a.asset_name && <p className="text-[10px] text-slate-400 truncate">{a.asset_name}</p>}
                              </div>
                              <div className="shrink-0">
                                {a.is_complete
                                  ? <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-green-700 flex items-center gap-0.5"><FiCheck size={8}/> Firmada</span>
                                  : <span className="rounded-full bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">Pend. firma</span>
                                }
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Detalle sesión seleccionada */}
              {selectedSession && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-4 overflow-auto max-h-96">
                  <SessionDetail sessionId={selectedSession.id} onClose={() => setSelSess(null)} catalog={catalog} onUpdated={onRefresh} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle activo TI */}
      {detailAsset && (
        <TiAssetDetailModal asset={detailAsset} onClose={() => setDetailAsset(null)} />
      )}

      {/* Modal detalle herramienta */}
      {detailDelivery && (
        <HerramientaDetailModal delivery={detailDelivery} onClose={() => setDetailDelivery(null)} />
      )}

      {/* Modal detalle logística */}
      {detailLogistica && (
        <LogisticaDetailModal delivery={detailLogistica} onClose={() => setDetailLogistica(null)} />
      )}

      {/* Modal detalle ropa */}
      {detailRopa && (
        <RopaDetailModal delivery={detailRopa} onClose={() => setDetailRopa(null)} />
      )}

      {/* Modal gestión de facturas */}
      {showFacturaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowFacturaModal(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FiFileText size={15} className="text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">Gestión de facturas — {selectedUserObj?.fullname || selectedUserObj?.name || ""}</span>
              </div>
              <button type="button" onClick={() => setShowFacturaModal(false)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                <FiX size={16} />
              </button>
            </div>
            <FacturaManagerPanel
              deliveries={deliveries}
              userDocs={userDocs}
              selectedIds={selectedForFactura}
              onToggle={(id) => setSelFactura((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])}
              onSelectAll={() => setSelFactura(deliveries.filter((d) => d.status === "entregado" && d.category !== "logistica").map((d) => d.id))}
              onClearAll={() => setSelFactura([])}
              uploading={uploadingFactura}
              onUpload={async (file) => {
                if (!selectedForFactura.length) return showToast("Selecciona al menos un ítem", "warning");
                setUploadingF(true);
                try {
                  await Promise.all(selectedForFactura.map((id) => uploadCollabDeliveryDoc(id, file)));
                  showToast(`Factura vinculada a ${selectedForFactura.length} ítem(s)`, "success");
                  setSelFactura([]);
                  const updated = await listCollabDeliveryDocsByUser(selectedUser);
                  setUserDocs(Array.isArray(updated) ? updated : []);
                } catch (e) { showToast(e?.response?.data?.message || "Error al subir", "error"); }
                finally { setUploadingF(false); }
              }}
              uploadingCert={uploadingCert}
              onUploadCert={async (deliveryId, file) => {
                setUploadingCert(deliveryId);
                try {
                  await uploadCollabDeliveryDoc(deliveryId, file, "certificado_bancario");
                  showToast("Certificado bancario subido", "success");
                  const updated = await listCollabDeliveryDocsByUser(selectedUser);
                  setUserDocs(Array.isArray(updated) ? updated : []);
                } catch (e) { showToast(e?.response?.data?.message || "Error al subir", "error"); }
                finally { setUploadingCert(null); }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const CollabDeliveriesFinancieroPage = () => {
  const { showToast } = useUI();
  const { user } = useAuth();
  const actorRole = user?.role || "";

  const [loading, setLoading]   = useState(false);
  const [catalog, setCatalog]   = useState([]);
  const [users, setUsers]       = useState([]);
  const [signerCandidates, setSignerCandidates] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [tiActas, setTiActas]   = useState([]);
  const [tiAssets, setTiAssets] = useState([]);

  const [activeTab, setActiveTab]       = useState("sesiones");
  const [showModal, setShowModal]       = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedSession, setSession]   = useState(null);
  const [selectedTiActa, setTiActa]    = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const fullAccess = FULL_ACCESS_ROLES.includes(actorRole);
    try {
      const [cat, usr, signers, ren, sess, ti, actas] = await Promise.all([
        listCollabCatalog({ includeInactive: true }),
        getUsers(),
        getSignerCandidates(),
        fullAccess ? listCollabRenewals({ dueDays: 60 }) : Promise.resolve([]),
        listCollabSessions(),
        fullAccess ? listTiAssets() : Promise.resolve([]),
        fullAccess ? listTiAllActas({ limit: 200 }) : Promise.resolve([]),
      ]);
      setCatalog(Array.isArray(cat) ? cat : []);
      setUsers(Array.isArray(usr) ? usr : []);
      setSignerCandidates(Array.isArray(signers) ? signers : []);
      setRenewals(Array.isArray(ren) ? ren : []);
      setSessions(Array.isArray(sess) ? sess : []);
      setTiAssets(Array.isArray(ti) ? ti : []);
      setTiActas(Array.isArray(actas) ? actas : []);
    } catch {
      showToast("No se pudo cargar la información", "error");
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const stats = useMemo(() => ({
    sinFirma:    sessions.reduce((a, s) => a + Number(s.actas_pending || 0), 0)
                 + tiActas.filter((a) => !a.is_complete).length,
    renovVenc:   renewals.filter((r) => new Date(r.scheduled_date) < new Date()).length,
    renovProx:   renewals.filter((r) => { const d = Math.ceil((new Date(r.scheduled_date) - new Date()) / 86400000); return d >= 0 && d <= 30; }).length,
    totalTi:     tiAssets.length,
    totalMovs:   sessions.length + tiActas.length,
  }), [sessions, tiActas, renewals, tiAssets]);

  const handleCompleteRenewal = async (id, status) => {
    try {
      await completeCollabRenewal(id, { status });
      showToast(status === "completed" ? "Renovación completada" : "Cancelada", "success");
      await loadAll();
    } catch (e) { showToast(e?.response?.data?.message || "Error", "error"); }
  };

  const isFinanciero = FULL_ACCESS_ROLES.includes(actorRole);

  const exportReportCSV = async () => {
    try {
      showToast("Generando reporte...", "info");
      const rows = await getCollabFullReport();
      if (!rows.length) { showToast("Sin datos para exportar", "warning"); return; }
      const CAT_ES = { ropa: "Ropa de trabajo", epp: "EPP", herramienta: "Herramienta de trabajo", logistica: "Logística", ti: "Herramientas TI", suministros: "Suministros" };
      const STATUS_ES = { entregado: "Entregado", retirado: "Retirado", perdido: "Perdido", dañado: "Dañado" };
      const fmtDate = (v) => v ? new Date(v).toLocaleDateString("es-EC") : "";
      const headers = [
        "Colaborador","Email",
        "Categoría","Ítem","Serie","Estado",
        "Fecha entrega","Fecha retiro",
        "Condición física","Renovación",
        "Código acta","Tipo acta","Fecha acta","Acta firmada",
        "Observaciones",
      ];
      const csvRows = [headers.join(";")];
      for (const r of rows) {
        csvRows.push([
          r.colaborador, r.email,
          CAT_ES[r.category] || r.category, r.item_name, r.serial_number || "",
          STATUS_ES[r.status] || r.status,
          fmtDate(r.delivery_date), fmtDate(r.retiro_at),
          r.physical_condition || "", fmtDate(r.renewal_date),
          r.acta_code || "", r.acta_tipo || "", r.acta_fecha || "", fmtDate(r.acta_firmada_at),
          (r.observations || "").replace(/;/g, ","),
        ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"));
      }
      const bom = "﻿";
      const blob = new Blob([bom + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `reporte_entregas_${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      showToast("Reporte exportado", "success");
    } catch (e) { showToast("Error al generar reporte", "error"); }
  };

  const TABS = [
    { key: "sesiones",     label: "Entregas/Retiros", icon: FiFileText },
    { key: "gestion",      label: "Gestión",           icon: FiUsers },
    ...(isFinanciero ? [
      { key: "ti",           label: "Activos TI",      icon: FiCpu },
      { key: "renovaciones", label: "Renovaciones",    icon: FiCalendar, badge: stats.renovVenc },
    ] : []),
    { key: "catalogo",     label: "Catálogo",          icon: FiBarChart2 },
  ];

  return (
    <div className="flex min-w-0 flex-col space-y-5 p-4 sm:p-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Entregas a Colaboradores</h1>
          <p className="text-xs text-slate-500 mt-0.5">Ropa · Herramientas · Logística · Activos TI</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={loadAll} disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
          {isFinanciero && (
            <button type="button" onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <FiBarChart2 size={14} /> Reportes
            </button>
          )}
          {canCreateSessions(actorRole) && (
            <button type="button" onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors active:scale-[0.97]">
              <FiPlus size={14} /> Nueva sesión
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="flex flex-wrap sm:flex-nowrap sm:divide-x divide-slate-100">
          {[
            { label: "Movimientos",      value: loading ? "—" : stats.totalMovs,    color: "text-slate-800" },
            { label: "Actas pendientes", value: loading ? "—" : stats.sinFirma,     color: stats.sinFirma > 0 ? "text-amber-600" : "text-slate-800" },
            { label: "Renov. vencidas",  value: loading ? "—" : stats.renovVenc,    color: stats.renovVenc > 0 ? "text-red-600" : "text-slate-800" },
            { label: "Renov. próximas",  value: loading ? "—" : stats.renovProx,    color: "text-slate-800" },
            { label: "Activos TI",       value: loading ? "—" : stats.totalTi,      color: "text-slate-800" },
          ].map((k, i) => (
            <div key={k.label} className={`flex-1 min-w-[50%] sm:min-w-0 px-4 py-3 ${i > 0 && i % 2 === 0 ? "border-t border-slate-100 sm:border-t-0" : i === 1 ? "border-l border-slate-100 sm:border-l-0" : ""}`}>
              {(k.color.includes("amber") || k.color.includes("red")) && <FiAlertTriangle size={12} className={`${k.color} mb-0.5`} />}
              <p className="text-xs text-slate-400">{k.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon, badge }) => (
          <button key={key} type="button" onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <Icon size={14} /> {label}
            {badge > 0 && <span className="ml-1 rounded-full bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5">{badge}</span>}
          </button>
        ))}
      </div>

      {/* ── Tab: Entregas/Retiros */}
      {activeTab === "sesiones" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Lista combinada: sesiones collab + actas TI */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">Historial de movimientos</p>
              <span className="text-xs text-slate-400">{sessions.length + tiActas.length}</span>
            </div>
            <div className="flex-1 overflow-auto max-h-[560px]">
              {loading ? (
                <div className="flex items-center justify-center h-32"><FiRefreshCw size={18} className="animate-spin text-slate-300" /></div>
              ) : sessions.length === 0 && tiActas.length === 0 ? (
                <EmptyState icon={FiFileText} message="Sin movimientos registrados" />
              ) : (
                // Mezclar y ordenar por fecha desc
                [...sessions.map((s) => ({ ...s, _type: "collab", _date: s.session_date })),
                 ...tiActas.map((a)  => ({ ...a, _type: "ti",    _date: a.generated_at?.slice(0, 10) }))]
                  .sort((a, b) => (b._date || "").localeCompare(a._date || ""))
                  .map((item) => {
                    if (item._type === "collab") {
                      const s = item;
                      const isActive = selectedSession?.id === s.id && !selectedTiActa;
                      return (
                        <button key={`c-${s.id}`} type="button"
                          onClick={() => { setSession(isActive ? null : s); setTiActa(null); }}
                          className={`w-full px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-colors ${isActive ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <CategoryBadge category={s.category} />
                                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.tipo === "entrega" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>{s.tipo}</span>
                              </div>
                              <p className="text-sm font-medium text-slate-800 truncate">{s.collaborator_name}</p>
                              <p className="text-xs text-slate-400">{s._date} · {s.delivery_count} ítem{s.delivery_count !== 1 ? "s" : ""}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {s.actas_pending > 0 && <span className="rounded-full bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">{s.actas_pending} pend.</span>}
                              <FiChevronRight size={14} className="text-slate-300" />
                            </div>
                          </div>
                        </button>
                      );
                    }
                    // TI acta
                    const a = item;
                    const isActive = selectedTiActa?.id === a.id;
                    const itemCount = a.item_count || 1;
                    return (
                      <button key={`ti-${a.id}`} type="button"
                        onClick={() => { setTiActa(isActive ? null : a); setSession(null); }}
                        className={`w-full px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-colors ${isActive ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <CategoryBadge category="ti" />
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${a.tipo === "entrega" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>{a.tipo}</span>
                              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-violet-50 text-violet-600 border border-violet-100">TI</span>
                            </div>
                            <p className="text-sm font-medium text-slate-800 truncate">{a.collaborator_name || a.recipient_nombre || "—"}</p>
                            <p className="text-xs text-slate-400">{a._date} · {a.acta_code || `#${a.id}`}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {!a.is_complete && <span className="rounded-full bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">pend.</span>}
                            <FiChevronRight size={14} className="text-slate-300" />
                          </div>
                        </div>
                      </button>
                    );
                  })
              )}
            </div>
          </div>

          {/* Panel detalle */}
          <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5 overflow-auto max-h-[640px]">
            {selectedTiActa ? (
              <TiActaDetail acta={selectedTiActa} onClose={() => setTiActa(null)} onUpdated={loadAll} availableUsers={signerCandidates} />
            ) : selectedSession ? (
              <SessionDetail sessionId={selectedSession.id} onClose={() => setSession(null)} availableUsers={signerCandidates} catalog={catalog} onUpdated={loadAll} />
            ) : (
              <EmptyState icon={FiFileText} message="Selecciona un movimiento para ver los detalles" />
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Gestión por colaborador */}
      {activeTab === "gestion" && (
        <CollabGestionTab tiAssets={tiAssets} tiActas={tiActas} users={users} catalog={catalog} onRefresh={loadAll} actorRole={actorRole} />
      )}

      {/* ── Tab: Activos TI */}
      {activeTab === "ti" && (
        <TiAssetsTab tiAssets={tiAssets} users={users} onRefresh={loadAll} />
      )}

      {/* ── Tab: Renovaciones */}
      {activeTab === "renovaciones" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
          <SectionLabel>Renovaciones próximas y vencidas (60 días)</SectionLabel>
          {renewals.length === 0 ? (
            <EmptyState icon={FiCalendar} message="Sin renovaciones próximas" />
          ) : (
            <div className="space-y-2">
              {renewals.map((r) => {
                const days = Math.ceil((new Date(r.scheduled_date) - new Date()) / 86400000);
                const color = days < 0 ? "border-red-100 bg-red-50" : days <= 7 ? "border-amber-100 bg-amber-50" : "border-slate-100 bg-slate-50";
                return (
                  <div key={r.id} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${color}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.item_name} — {r.collaborator_name}</p>
                      <div className="flex items-center gap-2 mt-0.5"><CategoryBadge category={r.category} /></div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <RenewalBadge date={r.scheduled_date} />
                      <button type="button" onClick={() => handleCompleteRenewal(r.id, "completed")}
                        className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700 hover:bg-green-100 transition-colors">
                        <FiCheck size={10} /> Completar
                      </button>
                      <button type="button" onClick={() => handleCompleteRenewal(r.id, "cancelled")}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-50 transition-colors">
                        <FiX size={10} /> Cancelar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Catálogo */}
      {activeTab === "catalogo" && (
        <CatalogTab catalog={catalog} onRefresh={loadAll} canEdit={isFinanciero} />
      )}

      {/* Modal nueva sesión */}
      {showModal && (
        <SessionModal catalog={catalog} users={users} tiAssets={tiAssets}
          actorRole={actorRole}
          onSave={() => { setShowModal(false); loadAll(); }}
          onClose={() => setShowModal(false)} />
      )}

      {/* Modal reportes */}
      {showReportModal && (
        <ReportesModal users={users} onClose={() => setShowReportModal(false)} />
      )}

    </div>
  );
};

export default CollabDeliveriesFinancieroPage;
