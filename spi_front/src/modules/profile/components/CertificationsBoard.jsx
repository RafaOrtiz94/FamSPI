import React, { useEffect, useMemo, useState } from "react";
import {
  FiAward,
  FiBookOpen,
  FiDownload,
  FiEye,
  FiFileText,
  FiPlus,
  FiShield,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import {
  createMyCertification,
  deleteMyCertification,
  downloadUserCertificationsPdf,
  listMyCertifications,
} from "../../../core/api/userCertificationsApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { formatDateSafe, toDate } from "../../../shared/utils/dateUtils";

const QUALIFICATION_TYPE_OPTIONS = [
  {
    value: "third_level_title",
    label: "Titulo 3er nivel",
    shortLabel: "3er nivel",
    icon: FiAward,
    accent: "blue",
    helper:
      "Usa esta categoria para carreras de tercer nivel y registra la institucion correspondiente.",
  },
  {
    value: "fourth_level_title",
    label: "Titulo 4to nivel",
    shortLabel: "4to nivel",
    icon: FiShield,
    accent: "indigo",
    helper:
      "Usa esta categoria para maestrias, especialidades u otros estudios de cuarto nivel.",
  },
  {
    value: "certification",
    label: "Certificacion",
    shortLabel: "Certificacion",
    icon: FiBookOpen,
    accent: "amber",
    helper:
      "Incluye cursos, diplomados, capacitaciones externas y certificaciones profesionales.",
  },
];

const ACCENT_STYLES = {
  amber: {
    soft: "bg-amber-50 text-amber-700",
    border: "border-amber-200",
    icon: "bg-amber-100 text-amber-700",
  },
  blue: {
    soft: "bg-blue-50 text-blue-700",
    border: "border-blue-200",
    icon: "bg-blue-100 text-blue-700",
  },
  indigo: {
    soft: "bg-indigo-50 text-indigo-700",
    border: "border-indigo-200",
    icon: "bg-indigo-100 text-indigo-700",
  },
  slate: {
    soft: "bg-slate-100 text-slate-700",
    border: "border-slate-200",
    icon: "bg-slate-100 text-slate-700",
  },
};

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all duration-150 ease-out focus:border-blue-600 focus:ring-2 focus:ring-sky-500/20";
const CARD_CLASS =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]";

const EMPTY_FORM = {
  qualificationType: "certification",
  title: "",
  institution: "",
  issuer: "",
  registrationNumber: "",
  issueDate: "",
  expiryDate: "",
  description: "",
};

const resolveQualificationType = (certification = {}) => {
  const metadataType = String(
    certification?.metadata?.qualification_type || "",
  )
    .trim()
    .toLowerCase();
  if (metadataType === "senescyt_record") {
    return null;
  }
  if (
    ["third_level_title", "fourth_level_title", "certification"].includes(
      metadataType,
    )
  ) {
    return metadataType;
  }

  const legacyType = String(certification?.credential_type || "")
    .trim()
    .toLowerCase();
  const level = String(
    certification?.metadata?.nivel_titulo ||
      certification?.metadata?.education_level ||
      certification?.metadata?.degree_level ||
      "",
  )
    .trim()
    .toLowerCase();

  if (legacyType === "title") {
    if (level.includes("cuarto") || level.includes("4")) {
      return "fourth_level_title";
    }
    return "third_level_title";
  }

  return "certification";
};

const getQualificationConfig = (qualificationType) =>
  QUALIFICATION_TYPE_OPTIONS.find((option) => option.value === qualificationType) ||
  {
    value: "certification",
    label: "Certificacion",
    shortLabel: "Certificacion",
    icon: FiFileText,
    accent: "slate",
    helper: "",
  };

const isCredentialVisibleInBoard = (certification) =>
  Boolean(resolveQualificationType(certification));

const getCertificationStatus = (certification) => {
  if (certification?.status && certification?.status_label) {
    return {
      status: certification.status,
      label: certification.status_label,
      color:
        certification.status_color === "red"
          ? "text-red-600"
          : certification.status_color === "amber"
            ? "text-amber-600"
            : certification.status_color === "emerald"
              ? "text-emerald-600"
              : "text-blue-600",
    };
  }

  const expiry = toDate(certification?.expiry_date);
  if (!expiry || !certification?.expiry_date) {
    return {
      status: "permanent",
      label: "Sin caducidad",
      color: "text-blue-600",
    };
  }

  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry < 0) {
    return { status: "expired", label: "Expirada", color: "text-red-600" };
  }
  if (daysUntilExpiry <= 30) {
    return {
      status: "expiring_soon",
      label: `Expira en ${daysUntilExpiry} dias`,
      color: "text-amber-600",
    };
  }
  return { status: "active", label: "Vigente", color: "text-emerald-600" };
};

const resolveCertificationDocumentUrl = (certification = {}) =>
  certification?.drive_url || certification?.file_url || "";

const buildCertificationPayload = (formData) => {
  const qualificationType = formData.qualificationType;
  const isTitle = qualificationType === "third_level_title" || qualificationType === "fourth_level_title";

  return {
    title: formData.title.trim(),
    issuer: (formData.issuer || formData.institution || "").trim(),
    issue_date: formData.issueDate || "",
    expiry_date: formData.expiryDate || "",
    credential_type: isTitle ? "title" : "certification",
    description: formData.description.trim(),
    metadata: {
      qualification_type: qualificationType,
      institution: formData.institution.trim() || null,
      registration_number: formData.registrationNumber.trim() || null,
      degree_level: isTitle
        ? qualificationType === "third_level_title"
          ? "tercer nivel"
          : "cuarto nivel"
        : null,
      description: formData.description.trim() || null,
    },
  };
};

const SummaryCard = ({ label, value, tone = "slate" }) => {
  const accent = ACCENT_STYLES[tone] || ACCENT_STYLES.slate;
  return (
    <div className={`rounded-2xl border ${accent.border} bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]`}>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
};

const CreateCertificationModal = ({ onClose, onSuccess }) => {
  const { showToast, showLoader, hideLoader } = useUI();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const activeTypeConfig = getQualificationConfig(formData.qualificationType);

  const updateField = (key, value) =>
    setFormData((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      showToast("El titulo es obligatorio", "warning");
      return;
    }

    try {
      setSaving(true);
      showLoader();
      await createMyCertification(buildCertificationPayload(formData), file || undefined);
      showToast("Credencial creada", "success");
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      showToast(error?.message || "No se pudo crear la credencial", "error");
    } finally {
      setSaving(false);
      hideLoader();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              Nueva credencial profesional
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Registra titulos o certificaciones en la fuente central del expediente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition-all duration-150 ease-out hover:bg-slate-50 active:scale-[0.97]"
            aria-label="Cerrar modal de credenciales"
          >
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div className="space-y-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Categoria
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              {QUALIFICATION_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = formData.qualificationType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField("qualificationType", option.value)}
                    className={`rounded-2xl border p-4 text-left transition-all duration-150 ease-out active:scale-[0.97] ${
                      isActive
                        ? "border-blue-200 bg-blue-50 shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`rounded-2xl p-2 ${ACCENT_STYLES[option.accent].icon}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {option.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {option.shortLabel}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">{activeTypeConfig.helper}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Titulo o nombre de la credencial
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(event) => updateField("title", event.target.value)}
                className={INPUT_CLASS}
                placeholder={
                  formData.qualificationType === "certification"
                    ? "Ej. Scrum Master, Curso de Power BI, Diplomado en Finanzas"
                    : "Ej. Ingenieria Comercial, Maestria en Seguridad y Salud"
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Institucion
              </label>
              <input
                type="text"
                value={formData.institution}
                onChange={(event) => updateField("institution", event.target.value)}
                className={INPUT_CLASS}
                placeholder="Universidad, instituto o entidad emisora"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Emisor visible
              </label>
              <input
                type="text"
                value={formData.issuer}
                onChange={(event) => updateField("issuer", event.target.value)}
                className={INPUT_CLASS}
                placeholder="Opcional si coincide con la institucion"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Fecha de emision
              </label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(event) => updateField("issueDate", event.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Fecha de expiracion
              </label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(event) => updateField("expiryDate", event.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Numero de registro o folio
              </label>
              <input
                type="text"
                value={formData.registrationNumber}
                onChange={(event) => updateField("registrationNumber", event.target.value)}
                className={INPUT_CLASS}
                placeholder="Opcional"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Observacion
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(event) => updateField("description", event.target.value)}
                className={`${INPUT_CLASS} resize-none`}
                placeholder="Detalle relevante para Talento Humano"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Archivo de respaldo
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:rounded-2xl file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-2 text-xs text-slate-500">
                Formatos permitidos: PDF, JPG, PNG, WEBP.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-150 ease-out hover:bg-slate-50 active:scale-[0.97]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-all duration-150 ease-out hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar credencial"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ViewCertificationModal = ({ certification, onClose, onDelete }) => {
  const qualificationType = resolveQualificationType(certification);
  const config = getQualificationConfig(qualificationType);
  const Icon = config.icon;
  const accent = ACCENT_STYLES[config.accent] || ACCENT_STYLES.slate;
  const status = getCertificationStatus(certification);
  const metadata = certification?.metadata || {};
  const documentUrl = resolveCertificationDocumentUrl(certification);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex items-start gap-3">
            <div className={`rounded-2xl p-3 ${accent.icon}`}>
              <Icon size={20} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                {certification?.title || "Credencial"}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accent.soft}`}>
                  {config.label}
                </span>
                <span className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold ${status.color}`}>
                  {status.label}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition-all duration-150 ease-out hover:bg-slate-50 active:scale-[0.97]"
            aria-label="Cerrar detalle de credencial"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Institucion</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {metadata?.institution || certification?.issuer || "No registrada"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Registro / folio</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {metadata?.registration_number || "No registrado"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Fecha de emision</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {formatDateSafe(certification?.issue_date) || "No registrada"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Fecha de expiracion</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {formatDateSafe(certification?.expiry_date) || "Sin caducidad"}
              </p>
            </div>
          </div>

          {certification?.description ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Observacion</p>
              <p className="mt-2 text-sm text-slate-700">{certification.description}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            {documentUrl ? (
              <a
                href={documentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-blue-700 active:scale-[0.97]"
              >
                <FiEye size={16} />
                Ver respaldo
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => onDelete(certification?.id)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-all duration-150 ease-out hover:bg-red-100 active:scale-[0.97]"
            >
              <FiTrash2 size={16} />
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CredentialCard = ({ certification, onOpen, onDelete }) => {
  const qualificationType = resolveQualificationType(certification);
  const config = getQualificationConfig(qualificationType);
  const Icon = config.icon;
  const accent = ACCENT_STYLES[config.accent] || ACCENT_STYLES.slate;
  const status = getCertificationStatus(certification);
  const documentUrl = resolveCertificationDocumentUrl(certification);
  const institution =
    certification?.metadata?.institution || certification?.issuer || "Institucion no registrada";

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`rounded-2xl p-3 ${accent.icon}`}>
            <Icon size={18} />
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accent.soft}`}>
                {config.label}
              </span>
              <span className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold ${status.color}`}>
                {status.label}
              </span>
            </div>
            <h4 className="mt-3 text-base font-semibold text-slate-900">
              {certification?.title}
            </h4>
            <p className="mt-1 text-sm text-slate-500">{institution}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Emision</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {formatDateSafe(certification?.issue_date) || "No registrada"}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Registro</p>
          <p className="mt-1 truncate text-sm font-medium text-slate-900">
            {certification?.metadata?.registration_number || "No registrado"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {documentUrl ? (
          <a
            href={documentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-all duration-150 ease-out hover:bg-blue-100 active:scale-[0.97]"
          >
            <FiEye size={16} />
            Abrir respaldo
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => onOpen(certification)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-150 ease-out hover:bg-slate-50 active:scale-[0.97]"
        >
          <FiEye size={16} />
          Ver detalle
        </button>
        <button
          type="button"
          onClick={() => onDelete(certification?.id)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-all duration-150 ease-out hover:bg-red-100 active:scale-[0.97]"
        >
          <FiTrash2 size={16} />
          Eliminar
        </button>
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
  const [viewingCertification, setViewingCertification] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const summary = useMemo(() => {
    return certifications.reduce(
      (acc, certification) => {
        const status = getCertificationStatus(certification);
        const qualificationType = resolveQualificationType(certification);
        acc.total += 1;
        if (qualificationType === "third_level_title") acc.thirdLevel += 1;
        if (qualificationType === "fourth_level_title") acc.fourthLevel += 1;
        if (qualificationType === "certification") acc.certifications += 1;
        if (status.status === "expired") acc.expired += 1;
        if (status.status === "expiring_soon") acc.expiringSoon += 1;
        if (status.status === "active") acc.active += 1;
        if (status.status === "permanent") acc.permanent += 1;
        return acc;
      },
      {
        total: 0,
        thirdLevel: 0,
        fourthLevel: 0,
        certifications: 0,
        active: 0,
        permanent: 0,
        expiringSoon: 0,
        expired: 0,
      },
    );
  }, [certifications]);

  const loadCertifications = async () => {
    try {
      setLoading(true);
      const response = await listMyCertifications(false);
      const visibleCredentials = (Array.isArray(response?.data) ? response.data : []).filter(
        isCredentialVisibleInBoard,
      );
      setCertifications(visibleCredentials);
    } catch (error) {
      console.error(error);
      showToast("No se pudieron cargar las credenciales", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertifications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (certificationId) => {
    if (!window.confirm("¿Eliminar esta credencial del expediente?")) return;
    try {
      await deleteMyCertification(certificationId);
      if (viewingCertification?.id === certificationId) {
        setViewingCertification(null);
      }
      showToast("Credencial eliminada", "success");
      await loadCertifications();
    } catch (error) {
      console.error(error);
      showToast(error?.message || "No se pudo eliminar la credencial", "error");
    }
  };

  const handleDownloadPdf = async () => {
    if (!user?.id || downloadingPdf) return;
    try {
      setDownloadingPdf(true);
      showLoader();
      const pdfBlob = await downloadUserCertificationsPdf(user.id);
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `credenciales_${user.fullname || "usuario"}_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast("PDF descargado exitosamente", "success");
    } catch (error) {
      console.error(error);
      showToast(error?.message || "No se pudo descargar el PDF", "error");
    } finally {
      setDownloadingPdf(false);
      hideLoader();
    }
  };

  return (
    <div className="space-y-5">
      <div className={CARD_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <FiAward size={22} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Credenciales profesionales
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Registra títulos y certificaciones en una estructura compatible con el
                expediente central de Talento Humano.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {certifications.length > 0 ? (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-150 ease-out hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiDownload size={16} />
                {downloadingPdf ? "Descargando..." : "Descargar PDF"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-all duration-150 ease-out hover:bg-blue-700 active:scale-[0.97]"
            >
              <FiPlus size={16} />
              Agregar credencial
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Total registradas" value={summary.total} tone="slate" />
          <SummaryCard label="Titulos 3er nivel" value={summary.thirdLevel} tone="blue" />
          <SummaryCard label="Titulos 4to nivel" value={summary.fourthLevel} tone="indigo" />
          <SummaryCard label="Certificaciones" value={summary.certifications} tone="amber" />
          <SummaryCard label="Por vencer" value={summary.expiringSoon} tone="amber" />
          <SummaryCard label="Expiradas" value={summary.expired} tone="slate" />
        </div>

        {(summary.expiringSoon > 0 || summary.expired > 0) && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {summary.expiringSoon > 0
              ? `${summary.expiringSoon} credencial(es) requieren revision por vencimiento proximo. `
              : ""}
            {summary.expired > 0
              ? `${summary.expired} credencial(es) ya figuran como expiradas.`
              : ""}
          </div>
        )}
      </div>

      {loading ? (
        <div className={`${CARD_CLASS} text-center text-sm text-slate-500`}>
          Cargando credenciales...
        </div>
      ) : certifications.length === 0 ? (
        <div className={`${CARD_CLASS} text-center`}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <FiFileText size={20} />
          </div>
          <h4 className="mt-4 text-base font-semibold text-slate-900">
            Aun no tienes credenciales registradas
          </h4>
          <p className="mt-2 text-sm text-slate-500">
            Agrega aquí tus titulos y certificaciones para que se reflejen en tu
            expediente centralizado.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {certifications.map((certification) => (
            <CredentialCard
              key={certification.id}
              certification={certification}
              onOpen={setViewingCertification}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showCreateModal ? (
        <CreateCertificationModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadCertifications}
        />
      ) : null}

      {viewingCertification ? (
        <ViewCertificationModal
          certification={viewingCertification}
          onClose={() => setViewingCertification(null)}
          onDelete={handleDelete}
        />
      ) : null}
    </div>
  );
};

export default CertificationsBoard;
