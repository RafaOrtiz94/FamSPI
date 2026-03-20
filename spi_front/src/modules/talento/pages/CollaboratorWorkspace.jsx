import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBriefcase,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSave,
  FiShield,
  FiUploadCloud,
  FiUser,
} from "react-icons/fi";
import toast from "react-hot-toast";

import {
  DashboardLayout,
  DashboardHeader,
} from "../../../core/ui/layouts/DashboardLayout";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import SaveStatusIndicator from "../../../core/ui/components/SaveStatusIndicator";
import { useAuth } from "../../../core/auth/AuthContext";
import {
  getCollaboratorProfile,
  updateCollaboratorProfile,
  uploadCollaboratorDocument,
} from "../../../core/api/collaboratorsApi";
import { getUserCertifications } from "../../../core/api/userCertificationsApi";
import {
  defaultProfile as defaultProfileTemplate,
  profileSections as profileSectionsTemplate,
  documentTypes as documentTypesTemplate,
  checklistSections as checklistSectionsTemplate,
} from "../components/collaboratorProfileDefinitions";

const numericOnlyFields = new Set([
  "cedula",
  "telefono_personal",
  "telefono_celular_famproject",
  "telefono_fijo",
  "telefono_contacto",
  "cedula_conyuge",
  "cedula_primer_hijo",
  "cedula_segundo_hijo",
]);

const tabDefinitions = [
  { key: "summary", label: "Resumen" },
  { key: "profile", label: "Perfil" },
  { key: "documents", label: "Documentos" },
  { key: "checklist", label: "Checklist" },
  { key: "credentials", label: "Credenciales" },
  { key: "offboarding", label: "Salida" },
];

const toneMap = {
  amber: {
    badge: "bg-amber-100 text-amber-800",
    card: "border-amber-200 bg-amber-50 text-amber-950",
  },
  red: {
    badge: "bg-rose-100 text-rose-800",
    card: "border-rose-200 bg-rose-50 text-rose-950",
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-800",
    card: "border-emerald-200 bg-emerald-50 text-emerald-950",
  },
  slate: {
    badge: "bg-slate-100 text-slate-700",
    card: "border-slate-200 bg-slate-50 text-slate-900",
  },
};

const statusClasses = {
  expired: "bg-rose-100 text-rose-700",
  expiring_soon: "bg-amber-100 text-amber-800",
  permanent: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
};

const formatDate = (value, options = {}) => {
  if (!value) return "No registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No registrado";
  return date.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  });
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isOffboardingSection = (title) => {
  const normalized = normalizeText(title);
  return normalized.includes("salida") && normalized.includes("desvinculacion");
};

const CollaboratorWorkspace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.role || user?.role_name || user?.rol || "").toLowerCase();
  const canUnlockSections =
    role === "talento_humano" ||
    role === "gerencia_general" ||
    role === "gerencia";
  const { id } = useParams();

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docUploading, setDocUploading] = useState(null);
  const [profileErrors, setProfileErrors] = useState({});
  const [sectionSaving, setSectionSaving] = useState({});
  const [openSections, setOpenSections] = useState(
    () => new Set(["personal", "laboral"]),
  );
  const [collaborator, setCollaborator] = useState(null);
  const [certifications, setCertifications] = useState([]);
  const [certificationSummary, setCertificationSummary] = useState({
    active: 0,
    expired: 0,
    expiring_soon: 0,
  });
  const [profileLastReviewedAt, setProfileLastReviewedAt] = useState(null);
  const [offboardingSaving, setOffboardingSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [saveStatus, setSaveStatus] = useState("saved");
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const autosaveTimers = useRef({});
  const profileRef = useRef(null);
  const fieldRefs = useRef({});

  const defaultProfile = useMemo(() => defaultProfileTemplate, []);
  const profileSections = useMemo(() => profileSectionsTemplate, []);
  const documentTypes = useMemo(() => documentTypesTemplate, []);
  const checklistSections = useMemo(() => checklistSectionsTemplate, []);

  const mergeProfile = (incoming = {}) => {
    const merged = {};
    Object.keys(defaultProfile).forEach((section) => {
      merged[section] = {
        ...defaultProfile[section],
        ...(incoming?.[section] || {}),
      };
    });
    return merged;
  };

  const isNAValue = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    return (
      normalized === "n/a" || normalized === "na" || normalized === "no aplica"
    );
  };

  const isFieldComplete = (value, field) => {
    if (field?.allowNA && isNAValue(value)) return true;
    return value !== null && value !== undefined && String(value).trim() !== "";
  };

  const documentsByType = useMemo(() => {
    const grouped = new Map();
    documents.forEach((doc) => {
      if (!doc?.doc_type) return;
      const current = grouped.get(doc.doc_type);
      if (!current) {
        grouped.set(doc.doc_type, doc);
        return;
      }
      const currentStamp =
        current.created_at ||
        current.updated_at ||
        current.uploaded_at ||
        current.id ||
        0;
      const nextStamp =
        doc.created_at || doc.updated_at || doc.uploaded_at || doc.id || 0;
      if (String(nextStamp) >= String(currentStamp))
        grouped.set(doc.doc_type, doc);
    });
    return grouped;
  }, [documents]);

  const uploadedDocTypes = useMemo(
    () => new Set(documents.map((doc) => doc.doc_type)),
    [documents],
  );
  const isDocUploaded = (docType) => uploadedDocTypes.has(docType);

  const profileCompletion = useMemo(() => {
    if (!profileData)
      return {
        total: 0,
        done: 0,
        percent: 0,
        requiredTotal: 0,
        requiredDone: 0,
        requiredPercent: 0,
      };
    let total = 0;
    let done = 0;
    let requiredTotal = 0;
    let requiredDone = 0;
    profileSections.forEach((section) => {
      section.fields.forEach((field) => {
        const value = profileData?.[section.key]?.[field.key];
        total += 1;
        if (isFieldComplete(value, field)) done += 1;
        if (field.required) {
          requiredTotal += 1;
          if (isFieldComplete(value, field)) requiredDone += 1;
        }
      });
    });
    return {
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      requiredTotal,
      requiredDone,
      requiredPercent:
        requiredTotal > 0
          ? Math.round((requiredDone / requiredTotal) * 100)
          : 100,
    };
  }, [profileData, profileSections]);

  const checklistProgress = useMemo(() => {
    if (!profileData) return { total: 0, done: 0, bySection: [] };
    const bySection = checklistSections.map((section) => {
      const total = section.items.length;
      const done = section.items.reduce((acc, item) => {
        if (item.type === "doc")
          return acc + (isDocUploaded(item.docType) ? 1 : 0);
        return acc + (profileData?.onboarding?.[item.flagKey] ? 1 : 0);
      }, 0);
      return { title: section.title, total, done };
    });
    return {
      total: bySection.reduce((acc, entry) => acc + entry.total, 0),
      done: bySection.reduce((acc, entry) => acc + entry.done, 0),
      bySection,
    };
  }, [checklistSections, profileData, uploadedDocTypes]);

  const documentsCompletion = useMemo(() => {
    const total = documentTypes.length;
    const done = documentTypes.reduce(
      (acc, doc) => acc + (isDocUploaded(doc.key) ? 1 : 0),
      0,
    );
    return {
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [documentTypes, uploadedDocTypes]);

  const getOffboardingProgress = () =>
    checklistProgress.bySection.find((section) =>
      isOffboardingSection(section.title),
    ) || { total: 0, done: 0 };

  const offboardingFlow = useMemo(() => {
    const onboarding = profileData?.onboarding || {};
    return {
      requested: Boolean(onboarding.offboarding_requested),
      requestCode: String(onboarding.offboarding_request_code || ""),
      requestReason: String(onboarding.offboarding_request_reason || ""),
      requestedAt: onboarding.offboarding_requested_at || "",
      requestedBy: String(onboarding.offboarding_requested_by || ""),
      cancelledAt: onboarding.offboarding_cancelled_at || "",
      cancelledBy: String(onboarding.offboarding_cancelled_by || ""),
    };
  }, [profileData]);

  const isOffboardingComplete = () => {
    const { total, done } = getOffboardingProgress();
    return total > 0 && done === total;
  };

  const reviewStatus = useMemo(() => {
    if (!profileLastReviewedAt)
      return {
        pending: true,
        label: "Revision anual pendiente",
        tone: "amber",
      };
    const lastDate = new Date(profileLastReviewedAt);
    if (Number.isNaN(lastDate.getTime()))
      return {
        pending: true,
        label: "Revision anual pendiente",
        tone: "amber",
      };
    const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 365)
      return { pending: true, label: "Revision anual vencida", tone: "red" };
    return { pending: false, label: "Revision anual al dia", tone: "emerald" };
  }, [profileLastReviewedAt]);

  const collaboratorStatus = useMemo(() => {
    const employeeStatus = (profileData?.laboral?.estatus_empleado || "")
      .trim()
      .toLowerCase();
    if (employeeStatus) {
      if (employeeStatus === "desvinculado")
        return { label: "Desvinculado", tone: "red" };
      return {
        label: employeeStatus.charAt(0).toUpperCase() + employeeStatus.slice(1),
        tone: "emerald",
      };
    }
    if (collaborator?.active === false)
      return { label: "Inactivo", tone: "amber" };
    return { label: "Activo", tone: "emerald" };
  }, [collaborator, profileData]);

  const offboardingEnabled = useMemo(
    () =>
      Boolean(profileData?.laboral?.fecha_salida) ||
      String(profileData?.laboral?.estatus_empleado || "").toLowerCase() ===
        "desvinculado" ||
      offboardingFlow.requested,
    [offboardingFlow.requested, profileData],
  );

  const visibleTabs = useMemo(
    () =>
      tabDefinitions.filter(
        (tab) => tab.key !== "offboarding" || offboardingEnabled,
      ),
    [offboardingEnabled],
  );

  const getSectionCompletion = (sectionTitle) => {
    const entry = checklistProgress.bySection.find(
      (item) => item.title === sectionTitle,
    );
    const total = entry?.total || 0;
    const done = entry?.done || 0;
    return { total, done, complete: total > 0 && done === total };
  };

  const getProfileSectionCompletion = (section) => {
    const total = section.fields.length;
    const done = section.fields.reduce(
      (acc, field) =>
        acc +
        (isFieldComplete(profileData?.[section.key]?.[field.key], field)
          ? 1
          : 0),
      0,
    );
    const requiredTotal = section.fields.filter(
      (field) => field.required,
    ).length;
    const requiredDone = section.fields.reduce((acc, field) => {
      if (!field.required) return acc;
      return (
        acc +
        (isFieldComplete(profileData?.[section.key]?.[field.key], field)
          ? 1
          : 0)
      );
    }, 0);
    return {
      total,
      done,
      complete: total > 0 && done === total,
      requiredTotal,
      requiredDone,
    };
  };

  const getLockedSections = () =>
    profileData?.onboarding?.locked_sections || [];

  const markSaved = () => {
    setSaveStatus("saved");
    setLastSavedAt(new Date().toISOString());
  };

  const loadProfile = async () => {
    if (!id) return;
    setProfileLoading(true);
    try {
      const [profileResult, certsResult] = await Promise.allSettled([
        getCollaboratorProfile(id),
        getUserCertifications(id),
      ]);
      if (profileResult.status === "rejected") throw profileResult.reason;
      const response = profileResult.value;
      setProfileData(mergeProfile(response.data?.profile || {}));
      setDocuments(response.data?.documents || []);
      setCollaborator(response.data?.user || null);
      setProfileLastReviewedAt(response.data?.profile_last_reviewed_at || null);
      setSaveStatus("saved");
      if (certsResult.status === "fulfilled") {
        setCertifications(certsResult.value.data || []);
        setCertificationSummary(
          certsResult.value.summary || {
            active: 0,
            expired: 0,
            expiring_soon: 0,
          },
        );
      } else {
        setCertifications([]);
        setCertificationSummary({ active: 0, expired: 0, expiring_soon: 0 });
      }
    } catch (error) {
      console.error("Error cargando colaborador:", error);
      toast.error("Error al cargar el perfil del colaborador");
      setSaveStatus("error");
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [id]);
  useEffect(() => {
    profileRef.current = profileData;
  }, [profileData]);
  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab))
      setActiveTab("summary");
  }, [activeTab, visibleTabs]);
  useEffect(() => {
    if (!profileData?.personal) return;
    const birth = profileData.personal.fecha_nacimiento;
    if (!birth) return;
    const date = new Date(birth);
    if (Number.isNaN(date.getTime())) return;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate()))
      age -= 1;
    const nextAge = age >= 0 ? String(age) : "";
    if (nextAge !== profileData.personal.edad) {
      setProfileData((prev) => ({
        ...prev,
        personal: { ...prev.personal, edad: nextAge },
      }));
    }
  }, [profileData?.personal?.fecha_nacimiento]);
  useEffect(
    () => () => {
      Object.values(autosaveTimers.current).forEach((timer) =>
        clearTimeout(timer),
      );
    },
    [],
  );

  const saveSection = async (sectionKey, { silent = true } = {}) => {
    if (!id || !profileRef.current) return;
    const payload = {
      [sectionKey]: profileRef.current?.[sectionKey],
      onboarding: profileRef.current?.onboarding || {},
    };
    setSectionSaving((prev) => ({ ...prev, [sectionKey]: true }));
    setSaveStatus("saving");
    try {
      await updateCollaboratorProfile(id, payload);
      markSaved();
      if (!silent) toast.success("Seccion guardada");
    } catch (error) {
      console.error("Error guardando seccion:", error);
      setSaveStatus("error");
      if (!silent) toast.error("No se pudo guardar la seccion");
    } finally {
      setSectionSaving((prev) => ({ ...prev, [sectionKey]: false }));
    }
  };

  const scheduleAutosave = (sectionKey) => {
    const existing = autosaveTimers.current[sectionKey];
    if (existing) clearTimeout(existing);
    setSaveStatus("unsaved");
    autosaveTimers.current[sectionKey] = setTimeout(
      () => saveSection(sectionKey, { silent: true }),
      1200,
    );
  };

  const handleProfileChange = (sectionKey, fieldKey, value) => {
    const cleanValue = numericOnlyFields.has(fieldKey)
      ? value.replace(/[^\d]/g, "")
      : value;
    setProfileData((prev) => ({
      ...(prev || {}),
      [sectionKey]: {
        ...((prev && prev[sectionKey]) || {}),
        [fieldKey]: cleanValue,
      },
    }));
    setProfileErrors((prev) => {
      const next = { ...prev };
      delete next[`${sectionKey}.${fieldKey}`];
      return next;
    });
    setSaveStatus("unsaved");
    scheduleAutosave(sectionKey);
  };

  const validateProfile = () => {
    const errors = {};
    let firstInvalidKey = null;
    profileSections.forEach((section) => {
      section.fields.forEach((field) => {
        const fieldName = `${section.key}.${field.key}`;
        const fieldValue = profileData?.[section.key]?.[field.key];
        if (field.required && !isFieldComplete(fieldValue, field)) {
          errors[fieldName] = "Este campo es obligatorio.";
          if (!firstInvalidKey) firstInvalidKey = fieldName;
          return;
        }
        if (
          field.type === "email" &&
          fieldValue &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fieldValue).trim())
        ) {
          errors[fieldName] = "Ingresa un correo valido.";
          if (!firstInvalidKey) firstInvalidKey = fieldName;
          return;
        }
        if (
          field.key.includes("cedula") &&
          fieldValue &&
          !isNAValue(fieldValue) &&
          String(fieldValue).length !== 10
        ) {
          errors[fieldName] = "La cedula debe tener 10 digitos.";
          if (!firstInvalidKey) firstInvalidKey = fieldName;
        }
      });
    });
    return { errors, firstInvalidKey };
  };

  const handleSaveProfile = async () => {
    if (!profileData) return;
    const { errors, firstInvalidKey } = validateProfile();
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveStatus("error");
      toast.error(
        "Corrige los campos obligatorios para guardar el expediente.",
      );
      const firstField = fieldRefs.current[firstInvalidKey];
      firstField?.focus?.();
      firstField?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }
    setProfileSaving(true);
    setSaveStatus("saving");
    try {
      await updateCollaboratorProfile(id, profileData || defaultProfile);
      markSaved();
      toast.success("Expediente actualizado correctamente");
    } catch (error) {
      console.error("Error guardando perfil:", error);
      setSaveStatus("error");
      toast.error("No se pudo guardar el expediente");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDocumentUpload = async (docType, file) => {
    if (!id || !file) return;
    setDocUploading(docType);
    setSaveStatus("saving");
    try {
      await uploadCollaboratorDocument(id, docType, file);
      toast.success("Documento cargado correctamente");
      await loadProfile();
      markSaved();
    } catch (error) {
      console.error("Error subiendo documento:", error);
      setSaveStatus("error");
      toast.error("No se pudo subir el documento");
    } finally {
      setDocUploading(null);
    }
  };

  const handleChecklistToggle = (flagKey) => {
    setProfileData((prev) => ({
      ...(prev || {}),
      onboarding: {
        ...(prev?.onboarding || {}),
        [flagKey]: !prev?.onboarding?.[flagKey],
      },
    }));
    setSaveStatus("unsaved");
    scheduleAutosave("onboarding");
  };

  const handleOnboardingFieldChange = (fieldKey, value) => {
    setProfileData((prev) => ({
      ...(prev || {}),
      onboarding: { ...(prev?.onboarding || {}), [fieldKey]: value },
    }));
    setSaveStatus("unsaved");
    scheduleAutosave("onboarding");
  };

  const saveOnboardingPatch = async (patch, successMessage) => {
    if (!id || !profileData) return false;
    const nextProfile = {
      ...profileData,
      onboarding: { ...(profileData?.onboarding || {}), ...patch },
    };
    setProfileData(nextProfile);
    profileRef.current = nextProfile;
    setSaveStatus("saving");
    try {
      await updateCollaboratorProfile(id, {
        onboarding: nextProfile.onboarding,
      });
      markSaved();
      if (successMessage) toast.success(successMessage);
      return true;
    } catch (error) {
      console.error("Error guardando requerimiento de salida:", error);
      setSaveStatus("error");
      toast.error("No se pudo actualizar el requerimiento de salida");
      return false;
    }
  };

  const handleActivateOffboardingRequest = async () => {
    if (!canUnlockSections) return;
    const reason = String(
      profileData?.onboarding?.offboarding_request_reason || "",
    ).trim();
    if (!reason) {
      toast.error("Ingresa la justificacion del requerimiento de salida.");
      return;
    }
    await saveOnboardingPatch(
      {
        offboarding_requested: true,
        offboarding_requested_at: new Date().toISOString(),
        offboarding_requested_by: user?.email || user?.fullname || "usuario",
        offboarding_cancelled_at: "",
        offboarding_cancelled_by: "",
      },
      "Requerimiento de salida iniciado",
    );
  };

  const handleCancelOffboardingRequest = async () => {
    if (!canUnlockSections) return;
    await saveOnboardingPatch(
      {
        offboarding_requested: false,
        offboarding_cancelled_at: new Date().toISOString(),
        offboarding_cancelled_by: user?.email || user?.fullname || "usuario",
      },
      "Requerimiento de salida cancelado",
    );
  };

  const handleFinalizeOffboarding = async () => {
    if (!profileData) return;
    if (!isOffboardingComplete())
      return toast.error(
        "Completa la salida: equipos, cuentas, SRI y liquidacion.",
      );
    if (!profileData?.laboral?.fecha_salida)
      return toast.error("Registra la fecha de salida antes de finalizar.");
    setOffboardingSaving(true);
    setSaveStatus("saving");
    try {
      const nextProfile = {
        ...profileData,
        laboral: {
          ...(profileData?.laboral || {}),
          estatus_empleado: "desvinculado",
        },
      };
      await updateCollaboratorProfile(id, nextProfile);
      setProfileData(nextProfile);
      markSaved();
      toast.success("Desvinculacion completada");
    } catch (error) {
      console.error("Error finalizando desvinculacion:", error);
      setSaveStatus("error");
      toast.error("No se pudo finalizar la desvinculacion");
    } finally {
      setOffboardingSaving(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) return navigate(-1);
    navigate("/dashboard/talento-humano/colaboradores");
  };

  const groupedDocuments = useMemo(() => {
    const missing = [];
    const uploaded = [];
    documentTypes.forEach((doc) => {
      const latestDocument = documentsByType.get(doc.key);
      const entry = {
        ...doc,
        uploaded: Boolean(latestDocument),
        latestDocument,
      };
      if (entry.uploaded) uploaded.push(entry);
      else missing.push(entry);
    });
    return [...missing, ...uploaded];
  }, [documentTypes, documentsByType]);

  const nextActions = useMemo(() => {
    const actions = [];
    if (profileCompletion.requiredDone < profileCompletion.requiredTotal)
      actions.push({
        title: "Completar datos obligatorios del perfil",
        detail: `${profileCompletion.requiredTotal - profileCompletion.requiredDone} campos requeridos pendientes.`,
        tab: "profile",
      });
    if (documentsCompletion.done < documentsCompletion.total)
      actions.push({
        title: "Cargar documentos faltantes",
        detail: `${documentsCompletion.total - documentsCompletion.done} tipos documentales pendientes.`,
        tab: "documents",
      });
    if (checklistProgress.done < checklistProgress.total)
      actions.push({
        title: "Cerrar checklist operativo",
        detail: `${checklistProgress.total - checklistProgress.done} items pendientes por verificar.`,
        tab: "checklist",
      });
    if (reviewStatus.pending)
      actions.push({
        title: "Regularizar revision anual",
        detail: profileLastReviewedAt
          ? `Ultima revision: ${formatDate(profileLastReviewedAt)}.`
          : "No existe revision registrada.",
        tab: "summary",
      });
    if (
      certificationSummary.expired > 0 ||
      certificationSummary.expiring_soon > 0
    )
      actions.push({
        title: "Revisar certificaciones",
        detail: `${certificationSummary.expired} vencidas y ${certificationSummary.expiring_soon} por vencer.`,
        tab: "credentials",
      });
    return actions;
  }, [
    certificationSummary,
    checklistProgress,
    documentsCompletion,
    profileCompletion,
    profileLastReviewedAt,
    reviewStatus,
  ]);

  const summaryMetrics = [
    {
      key: "profile",
      title: "Perfil requerido",
      value: `${profileCompletion.requiredPercent}%`,
      detail: `${profileCompletion.requiredDone}/${profileCompletion.requiredTotal || 0} campos obligatorios completos`,
      tone: "emerald",
      icon: FiUser,
    },
    {
      key: "documents",
      title: "Documentos",
      value: `${documentsCompletion.done}/${documentsCompletion.total}`,
      detail: "Tipos documentales cargados",
      tone:
        documentsCompletion.done === documentsCompletion.total
          ? "emerald"
          : "amber",
      icon: FiFileText,
    },
    {
      key: "checklist",
      title: "Checklist operativo",
      value: `${checklistProgress.done}/${checklistProgress.total}`,
      detail:
        checklistProgress.total > 0
          ? `${Math.round((checklistProgress.done / checklistProgress.total) * 100)}% verificado`
          : "Sin datos",
      tone:
        checklistProgress.done === checklistProgress.total &&
        checklistProgress.total > 0
          ? "emerald"
          : "amber",
      icon: FiShield,
    },
    {
      key: "review",
      title: "Revision anual",
      value: reviewStatus.pending ? "Pendiente" : "Al dia",
      detail: profileLastReviewedAt
        ? `Ultima revision ${formatDate(profileLastReviewedAt)}`
        : "Sin revision registrada",
      tone: reviewStatus.tone,
      icon: FiClock,
    },
  ];

  if (profileLoading) {
    return (
      <DashboardLayout includeWidgets={false}>
        <div
          className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
          role="status"
          aria-live="polite"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-800">
              Cargando expediente del colaborador
            </p>
            <p className="text-sm text-slate-500">
              Estamos consolidando perfil, documentos y credenciales.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout includeWidgets={false}>
      <DashboardHeader
        title="Workspace verificable del colaborador"
        subtitle="Consolida perfil, documentos, checklist y credenciales en un solo expediente operativo."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="secondary"
              onClick={handleBack}
              leftIcon={FiArrowLeft}
            >
              Volver
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              leftIcon={FiSave}
            >
              Guardar expediente
            </Button>
          </div>
        }
      />

      <div className="sticky top-3 z-20 mb-6 space-y-4 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${toneMap[collaboratorStatus.tone].badge}`}
              >
                {collaboratorStatus.label}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${toneMap[reviewStatus.tone].badge}`}
              >
                {reviewStatus.label}
              </span>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                {collaborator?.fullname || collaborator?.email || "Colaborador"}
              </h2>
              <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                  <FiMail className="shrink-0 text-slate-500" />
                  <span className="truncate">
                    {collaborator?.email || "Sin correo registrado"}
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                  <FiBriefcase className="text-slate-500" />
                  <span>
                    {profileData?.laboral?.cargo || "Cargo no registrado"}
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                  <FiMapPin className="text-slate-500" />
                  <span>
                    {collaborator?.department_name ||
                      profileData?.laboral?.area ||
                      "Sin departamento"}
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                  <FiPhone className="text-slate-500" />
                  <span>
                    {profileData?.personal?.telefono_personal ||
                      "Sin telefono personal"}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <SaveStatusIndicator status={saveStatus} lastSaved={lastSavedAt} />
            <p className="max-w-sm text-sm text-slate-500">
              El expediente se puede guardar por seccion y tambien consolidarse
              manualmente al final.
            </p>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.key ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryMetrics.map((metric) => {
              const Icon = metric.icon;
              const tone = toneMap[metric.tone] || toneMap.slate;
              return (
                <Card key={metric.key} className={`border ${tone.card} p-5`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {metric.title}
                      </p>
                      <p className="text-3xl font-semibold tracking-tight">
                        {metric.value}
                      </p>
                      <p className="text-sm text-slate-600">{metric.detail}</p>
                    </div>
                    <span className="rounded-2xl bg-white/80 p-3 shadow-sm">
                      <Icon className="text-slate-700" />
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
            <Card className="space-y-5 p-6">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-slate-950">
                  Panorama del expediente
                </h3>
                <p className="text-sm text-slate-500">
                  Esta vista resume lo pendiente y ayuda a decidir donde
                  intervenir primero.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      Perfil completo
                    </span>
                    <span className="text-slate-500">
                      {profileCompletion.done}/{profileCompletion.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-900 transition-all"
                      style={{ width: `${profileCompletion.percent}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      Documentacion cargada
                    </span>
                    <span className="text-slate-500">
                      {documentsCompletion.done}/{documentsCompletion.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${documentsCompletion.percent}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      Checklist operativo
                    </span>
                    <span className="text-slate-500">
                      {checklistProgress.done}/{checklistProgress.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-emerald-600 transition-all"
                      style={{
                        width: `${checklistProgress.total ? Math.round((checklistProgress.done / checklistProgress.total) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>
            <Card className="space-y-5 p-6">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-slate-950">
                  Siguientes acciones
                </h3>
                <p className="text-sm text-slate-500">
                  Prioridades sugeridas para cerrar el expediente de forma
                  verificable.
                </p>
              </div>
              {nextActions.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  El expediente no presenta pendientes criticos en esta
                  revision.
                </div>
              ) : (
                <div className="space-y-3">
                  {nextActions.map((action) => (
                    <button
                      key={`${action.tab}-${action.title}`}
                      type="button"
                      onClick={() => setActiveTab(action.tab)}
                      className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                      <span className="mt-0.5 rounded-xl bg-white p-2 shadow-sm">
                        <FiAlertCircle className="text-slate-600" />
                      </span>
                      <span className="space-y-1">
                        <span className="block font-semibold text-slate-900">
                          {action.title}
                        </span>
                        <span className="block text-sm text-slate-500">
                          {action.detail}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {activeTab === "profile" && (
        <Card className="space-y-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-slate-950">
                Perfil del colaborador
              </h3>
              <p className="text-sm text-slate-500">
                Completa y valida los datos del expediente. Los campos
                obligatorios se marcan con asterisco.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {profileCompletion.done}/{profileCompletion.total} campos
                completos
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                {profileCompletion.requiredDone}/
                {profileCompletion.requiredTotal || 0} obligatorios completos
              </span>
            </div>
          </div>
          <div className="space-y-4">
            {profileSections.map((section) => {
              const isOpen = openSections.has(section.key);
              const completion = getProfileSectionCompletion(section);
              const isLocked = getLockedSections().includes(section.key);
              return (
                <div
                  key={section.key}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSections((prev) => {
                          const next = new Set(prev);
                          if (next.has(section.key)) next.delete(section.key);
                          else next.add(section.key);
                          return next;
                        })
                      }
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span className="mt-0.5 rounded-xl bg-white p-2 shadow-sm">
                        {isOpen ? (
                          <FiChevronDown className="text-slate-600" />
                        ) : (
                          <FiChevronRight className="text-slate-600" />
                        )}
                      </span>
                      <span className="min-w-0 space-y-1">
                        <span className="block truncate text-base font-semibold text-slate-900">
                          {section.title}
                        </span>
                        <span className="block text-sm text-slate-500">
                          {completion.done}/{completion.total} campos completos
                          {completion.requiredTotal > 0
                            ? ` · ${completion.requiredDone}/${completion.requiredTotal} obligatorios`
                            : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {isLocked && (
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                          Bloqueado
                        </span>
                      )}
                      {!isLocked && completion.complete && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Completo
                        </span>
                      )}
                      {canUnlockSections && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setProfileData((prev) => {
                              const lockedSet = new Set(
                                prev?.onboarding?.locked_sections || [],
                              );
                              const manualSet = new Set(
                                prev?.onboarding?.manual_unlocked_sections ||
                                  [],
                              );
                              if (isLocked) {
                                lockedSet.delete(section.key);
                                manualSet.add(section.key);
                              } else {
                                lockedSet.add(section.key);
                                manualSet.delete(section.key);
                              }
                              return {
                                ...(prev || {}),
                                onboarding: {
                                  ...(prev?.onboarding || {}),
                                  locked_sections: Array.from(lockedSet),
                                  manual_unlocked_sections:
                                    Array.from(manualSet),
                                },
                              };
                            });
                            setSaveStatus("unsaved");
                            scheduleAutosave("onboarding");
                          }}
                        >
                          {isLocked ? "Desbloquear" : "Bloquear"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          saveSection(section.key, { silent: false })
                        }
                        disabled={sectionSaving[section.key]}
                      >
                        {sectionSaving[section.key]
                          ? "Guardando..."
                          : "Guardar seccion"}
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="grid gap-4 p-4 md:grid-cols-2">
                      {section.fields.map((field) => {
                        const fieldKey = `${section.key}.${field.key}`;
                        const hasError = Boolean(profileErrors[fieldKey]);
                        const isTextArea = Boolean(field.multiline);
                        const Control = isTextArea ? "textarea" : "input";
                        return (
                          <label
                            key={field.key}
                            className={`text-sm ${field.fullWidth ? "md:col-span-2" : ""}`}
                          >
                            <span className="mb-1.5 flex items-center gap-1 font-medium text-slate-700">
                              <span>{field.label}</span>
                              {field.required && (
                                <span className="text-rose-500">*</span>
                              )}
                              {field.allowNA && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                  Admite N/A
                                </span>
                              )}
                            </span>
                            <Control
                              ref={(node) => {
                                if (node) fieldRefs.current[fieldKey] = node;
                              }}
                              type={
                                !isTextArea
                                  ? field.allowNA && field.type === "date"
                                    ? "text"
                                    : field.type || "text"
                                  : undefined
                              }
                              rows={isTextArea ? field.rows || 3 : undefined}
                              inputMode={field.inputMode}
                              pattern={field.pattern || undefined}
                              maxLength={field.maxLength}
                              placeholder={field.placeholder || ""}
                              readOnly={field.readOnly || isLocked}
                              disabled={isLocked}
                              value={
                                profileData?.[section.key]?.[field.key] || ""
                              }
                              onChange={(e) =>
                                handleProfileChange(
                                  section.key,
                                  field.key,
                                  e.target.value,
                                )
                              }
                              aria-invalid={hasError}
                              aria-describedby={
                                hasError ? `${fieldKey}-error` : undefined
                              }
                              className={`w-full rounded-2xl border px-4 py-3 text-sm transition placeholder:text-slate-400 ${field.readOnly ? "bg-slate-100 text-slate-500" : "bg-white text-slate-900"} ${hasError ? "border-rose-300 ring-2 ring-rose-100 focus:border-rose-400" : "border-slate-200 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"}`}
                            />
                            {hasError && (
                              <span
                                id={`${fieldKey}-error`}
                                className="mt-1 block text-xs text-rose-600"
                              >
                                {profileErrors[fieldKey]}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === "documents" && (
        <div className="space-y-6">
          <Card className="space-y-2 p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-slate-950">
                  Documentacion del expediente
                </h3>
                <p className="text-sm text-slate-500">
                  Los documentos faltantes aparecen primero. Usa PDF o imagenes
                  legibles.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {documentsCompletion.done}/{documentsCompletion.total} tipos
                cargados
              </span>
            </div>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            {groupedDocuments.map((doc) => {
              const inputId = `doc-upload-${doc.key}`;
              const latestDocument = doc.latestDocument;
              return (
                <Card
                  key={doc.key}
                  className={`border p-5 ${doc.uploaded ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${doc.uploaded ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                        >
                          {doc.uploaded ? "Cargado" : "Pendiente"}
                        </span>
                        {latestDocument?.created_at && (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                            Ultima version{" "}
                            {formatDate(latestDocument.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-semibold text-slate-900">
                          {doc.label}
                        </h4>
                        <p className="text-sm text-slate-500">
                          {latestDocument?.filename
                            ? `Archivo actual: ${latestDocument.filename}`
                            : "Todavia no existe un archivo registrado para este tipo documental."}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-[170px]">
                      <input
                        id={inputId}
                        type="file"
                        className="sr-only"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={(e) =>
                          handleDocumentUpload(doc.key, e.target.files?.[0])
                        }
                      />
                      <label
                        htmlFor={inputId}
                        className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${docUploading === doc.key ? "cursor-wait bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                        aria-label={`${doc.uploaded ? "Reemplazar" : "Subir"} ${doc.label}`}
                      >
                        <FiUploadCloud />
                        <span>
                          {docUploading === doc.key
                            ? "Subiendo..."
                            : doc.uploaded
                              ? "Reemplazar"
                              : "Subir"}
                        </span>
                      </label>
                      <p className="text-xs text-slate-500">
                        Formatos sugeridos: PDF, PNG, JPG.
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "checklist" && (
        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
          <Card className="space-y-4 p-6">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-slate-950">
                Checklist operativo
              </h3>
              <p className="text-sm text-slate-500">
                Verifica hitos de ingreso, tecnologia, beneficios y salida segun
                corresponda.
              </p>
            </div>
            <div className="space-y-4">
              {checklistSections.map((section) => {
                const completion = getSectionCompletion(section.title);
                const sectionLockedByFlow =
                  isOffboardingSection(section.title) && !offboardingEnabled;
                return (
                  <div
                    key={section.title}
                    className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {section.title}
                        </p>
                        <p className="text-sm text-slate-500">
                          {completion.done}/{completion.total} items verificados
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                        {completion.complete ? "Completo" : "Pendiente"}
                      </span>
                    </div>
                    {sectionLockedByFlow && (
                      <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Esta seccion se habilita cuando existe un requerimiento
                        de salida activo o el colaborador ya esta desvinculado.
                      </div>
                    )}
                    <div className="space-y-2">
                      {section.items.map((item) => {
                        const checked =
                          item.type === "doc"
                            ? isDocUploaded(item.docType)
                            : Boolean(profileData?.onboarding?.[item.flagKey]);
                        if (item.type === "doc") {
                          const inputId =
                            `checklist-upload-${section.title}-${item.docType}`
                              .toLowerCase()
                              .replace(/[^a-z0-9_-]/g, "-");
                          const uploadingThisDoc =
                            docUploading === item.docType;
                          return (
                            <div
                              key={`${section.title}-${item.label}`}
                              className={`rounded-2xl border px-3 py-3 text-sm ${checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                  <span
                                    aria-hidden="true"
                                    className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border ${checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent"}`}
                                  >
                                    <FiCheckCircle className="h-3 w-3" />
                                  </span>
                                  <span className="space-y-1">
                                    <span className="block font-medium text-slate-800">
                                      {item.label}
                                    </span>
                                    <span className="block text-xs text-slate-500">
                                      {checked
                                        ? "El respaldo documental ya esta cargado."
                                        : "Sube el documento desde este mismo item para completar el control."}
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full lg:w-auto">
                                  <input
                                    id={inputId}
                                    type="file"
                                    className="sr-only"
                                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                                    onChange={(e) =>
                                      handleDocumentUpload(
                                        item.docType,
                                        e.target.files?.[0],
                                      )
                                    }
                                    disabled={sectionLockedByFlow}
                                  />
                                  <div className="flex flex-col gap-2 sm:flex-row">
                                    <label
                                      htmlFor={inputId}
                                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${sectionLockedByFlow || uploadingThisDoc ? "cursor-not-allowed bg-slate-200 text-slate-500" : "cursor-pointer bg-slate-900 text-white hover:bg-slate-800"}`}
                                    >
                                      <FiUploadCloud />
                                      <span>
                                        {uploadingThisDoc
                                          ? "Subiendo..."
                                          : checked
                                            ? "Reemplazar"
                                            : "Subir"}
                                      </span>
                                    </label>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setActiveTab("documents")}
                                    >
                                      Ver soporte
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <label
                            key={`${section.title}-${item.label}`}
                            className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm ${checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                handleChecklistToggle(item.flagKey)
                              }
                              disabled={
                                !canUnlockSections || sectionLockedByFlow
                              }
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                            />
                            <span className="space-y-1">
                              <span className="block font-medium text-slate-800">
                                {item.label}
                              </span>
                              {!canUnlockSections && (
                                <span className="block text-xs text-slate-500">
                                  Solo Talento Humano o Gerencia puede
                                  actualizar este control.
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="space-y-5 p-6">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-slate-950">
                Contexto de verificacion
              </h3>
              <p className="text-sm text-slate-500">
                Usa este resumen para justificar el estado del expediente
                durante auditoria interna.
              </p>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Campos obligatorios
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {profileCompletion.requiredDone} de{" "}
                  {profileCompletion.requiredTotal || 0} completados.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Documentos cargados
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {documentsCompletion.done} de {documentsCompletion.total}{" "}
                  tipos documentales disponibles.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Revision anual
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {profileLastReviewedAt
                    ? `Ultima revision registrada ${formatDate(profileLastReviewedAt)}.`
                    : "No existe revision anual registrada."}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">
                    Flujo de requerimiento de salida
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${offboardingFlow.requested ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    {offboardingFlow.requested ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="mt-3 grid gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">
                      Codigo del requerimiento
                    </span>
                    <input
                      type="text"
                      value={offboardingFlow.requestCode}
                      onChange={(e) =>
                        handleOnboardingFieldChange(
                          "offboarding_request_code",
                          e.target.value,
                        )
                      }
                      placeholder="REQ-SAL-2026-001"
                      disabled={!canUnlockSections}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                    />
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">
                      Justificacion de salida
                    </span>
                    <textarea
                      rows={3}
                      value={offboardingFlow.requestReason}
                      onChange={(e) =>
                        handleOnboardingFieldChange(
                          "offboarding_request_reason",
                          e.target.value,
                        )
                      }
                      placeholder="Detalla por que se inicia la salida del colaborador."
                      disabled={!canUnlockSections}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {canUnlockSections ? (
                    <>
                      <Button
                        size="sm"
                        onClick={handleActivateOffboardingRequest}
                        disabled={
                          offboardingFlow.requested ||
                          !offboardingFlow.requestReason.trim()
                        }
                      >
                        Iniciar requerimiento
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleCancelOffboardingRequest}
                        disabled={!offboardingFlow.requested}
                      >
                        Cancelar requerimiento
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">
                      Solo Talento Humano o Gerencia puede activar o cancelar el
                      requerimiento de salida.
                    </span>
                  )}
                </div>

                {offboardingFlow.requestedAt && (
                  <p className="mt-2 text-xs text-slate-500">
                    Iniciado{" "}
                    {formatDate(offboardingFlow.requestedAt, {
                      month: "2-digit",
                    })}{" "}
                    por{" "}
                    {offboardingFlow.requestedBy || "usuario no identificado"}.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "credentials" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Vigentes
              </p>
              <p className="mt-2 text-3xl font-semibold text-emerald-900">
                {certificationSummary.active}
              </p>
            </Card>
            <Card className="border border-amber-200 bg-amber-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                Por vencer
              </p>
              <p className="mt-2 text-3xl font-semibold text-amber-900">
                {certificationSummary.expiring_soon}
              </p>
            </Card>
            <Card className="border border-rose-200 bg-rose-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
                Vencidas
              </p>
              <p className="mt-2 text-3xl font-semibold text-rose-900">
                {certificationSummary.expired}
              </p>
            </Card>
          </div>
          <Card className="space-y-4 p-6">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-slate-950">
                Credenciales y titulos
              </h3>
              <p className="text-sm text-slate-500">
                Consolida certificaciones activas, permanentes y con riesgo de
                vencimiento.
              </p>
            </div>
            {certifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No existen certificaciones registradas para este colaborador.
              </div>
            ) : (
              <div className="space-y-3">
                {certifications.map((cert) => {
                  const badgeClass =
                    statusClasses[cert.status] || "bg-slate-100 text-slate-700";
                  return (
                    <div
                      key={cert.id}
                      className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-base font-semibold text-slate-900">
                            {cert.title}
                          </h4>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
                          >
                            {cert.status_label ||
                              (cert.expiry_date
                                ? "Con vencimiento"
                                : "Sin caducidad")}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          {cert.issuer || "Emisor no registrado"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-slate-500 md:justify-end">
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Emitida {formatDate(cert.issue_date)}
                        </span>
                        {cert.expiry_date && (
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Vence {formatDate(cert.expiry_date)}
                          </span>
                        )}
                        {cert.days_until_expiry !== null &&
                          cert.days_until_expiry !== undefined && (
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              {cert.days_until_expiry < 0
                                ? `${Math.abs(cert.days_until_expiry)} dias vencida`
                                : `${cert.days_until_expiry} dias restantes`}
                            </span>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "offboarding" && (
        <Card className="space-y-5 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-slate-950">
                Salida y desvinculacion
              </h3>
              <p className="text-sm text-slate-500">
                Este bloque debe usarse solo cuando el colaborador este en
                proceso de salida o cierre administrativo.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${isOffboardingComplete() ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
            >
              {isOffboardingComplete()
                ? "Checklist completo"
                : "Checklist pendiente"}
            </span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">
              Requerimiento de salida
            </p>
            {offboardingFlow.requested ? (
              <p className="mt-1">
                Flujo activo
                {offboardingFlow.requestCode
                  ? ` (${offboardingFlow.requestCode})`
                  : ""}{" "}
                iniciado por{" "}
                {offboardingFlow.requestedBy || "usuario no identificado"}.
              </p>
            ) : (
              <p className="mt-1">
                No existe requerimiento activo; este bloque se mantiene visible
                solo por contexto historico de salida/desvinculacion.
              </p>
            )}
          </div>
          <div className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">
                  Condiciones de cierre
                </p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex gap-2">
                    <FiCheckCircle className="mt-0.5 shrink-0 text-slate-400" />
                    Entrega de equipos y activos.
                  </li>
                  <li className="flex gap-2">
                    <FiCheckCircle className="mt-0.5 shrink-0 text-slate-400" />
                    Cierre de cuentas, accesos y herramientas.
                  </li>
                  <li className="flex gap-2">
                    <FiCheckCircle className="mt-0.5 shrink-0 text-slate-400" />
                    Registro de salida en SRI.
                  </li>
                  <li className="flex gap-2">
                    <FiCheckCircle className="mt-0.5 shrink-0 text-slate-400" />
                    Liquidacion validada y fecha de salida registrada.
                  </li>
                </ul>
              </div>
            </div>
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    Estado actual
                  </p>
                  <p className="text-sm text-slate-500">
                    {getOffboardingProgress().done}/
                    {getOffboardingProgress().total} items cerrados
                  </p>
                </div>
                <Button
                  variant={isOffboardingComplete() ? "danger" : "secondary"}
                  onClick={handleFinalizeOffboarding}
                  disabled={
                    offboardingSaving ||
                    !isOffboardingComplete() ||
                    !canUnlockSections
                  }
                >
                  {offboardingSaving
                    ? "Guardando..."
                    : "Finalizar desvinculacion"}
                </Button>
              </div>
              {!canUnlockSections && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Solo Talento Humano o Gerencia puede cerrar la desvinculacion.
                </div>
              )}
              {!isOffboardingComplete() && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  El cierre esta bloqueado hasta completar todos los items de
                  salida y registrar la fecha de salida.
                </div>
              )}
              {isOffboardingComplete() &&
                !profileData?.laboral?.fecha_salida && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                    Falta registrar la fecha de salida para completar el cierre.
                  </div>
                )}
            </div>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
};

export default CollaboratorWorkspace;
