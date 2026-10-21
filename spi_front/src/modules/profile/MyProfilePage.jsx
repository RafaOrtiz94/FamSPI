import React, { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiAward,
  FiCamera,
  FiFileText,
  FiSave,
} from "react-icons/fi";
import { getAttendancePunctualitySummary } from "../../core/api/attendanceApi";
import { fetchMyProfile, upsertMyProfile } from "../../core/api/userProfileApi";
import { isTransientApiError } from "../../core/api/index";
import { useAuth } from "../../core/auth/AuthContext";
import { readCachedResource, writeCachedResource } from "../../core/pwa/localCache";
import { usePwaStatus } from "../../core/pwa/PwaStatusContext";
import Modal from "../../core/ui/components/Modal";
import PunctualityWinnerBadge from "../../core/ui/components/PunctualityWinnerBadge";
import { useUI } from "../../core/ui/UIContext";
import { WORKSPACE_PAGE_CLASS } from "../../core/ui/workspaceLayout";
import CertificationsBoard from "./components/CertificationsBoard";
import ProfileDocumentsBoard from "./components/ProfileDocumentsBoard";
import PersonnelProfile from "../talento/components/workspace/PersonnelProfile";
import {
  defaultProfile as talentProfileDefaults,
  profileSections as talentProfileSections,
  MARITAL_STATUS_OPTIONS,
} from "../talento/components/collaboratorProfileDefinitions";

const emptyMetadata = {
  phone: "",
  personal: {
    ...talentProfileDefaults.personal,
  },
  laboral: {
    ...talentProfileDefaults.laboral,
  },
  domicilio: {
    ...talentProfileDefaults.domicilio,
  },
  emergencia: {
    ...talentProfileDefaults.emergencia,
  },
  estudios: {
    ...talentProfileDefaults.estudios,
  },
};

const emptyPreferences = {
  theme: "light",
};

const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const reviewSections = [
  {
    key: "personal",
    title: "Contacto personal",
    fields: [
      { key: "telefono_personal", label: "Telefono personal", required: true },
      { key: "email_personal", label: "Email personal", required: true },
      {
        key: "estado_civil",
        label: "Estado civil",
        required: false,
        type: "select",
        options: MARITAL_STATUS_OPTIONS,
        placeholder: "Selecciona estado civil",
      },
    ],
  },
  {
    key: "domicilio",
    title: "Domicilio",
    fields: [
      { key: "ciudad_domicilio", label: "Ciudad", required: true },
      {
        key: "movilizacion",
        label: "Movilizacion",
        required: false,
        type: "select",
        options: talentProfileSections
          .find((section) => section.key === "domicilio")
          ?.fields?.find((field) => field.key === "movilizacion")?.options || [],
        placeholder: "Selecciona tipo de movilizacion",
      },
      { key: "direccion_domicilio", label: "Direccion", required: true },
      { key: "telefono_fijo", label: "Telefono fijo", required: false },
    ],
  },
  {
    key: "emergencia",
    title: "Contacto de emergencia",
    fields: [
      {
        key: "persona_contacto",
        label: "Persona de contacto",
        required: true,
      },
      {
        key: "parentesco_contacto",
        label: "Parentesco",
        required: true,
      },
      {
        key: "telefono_contacto",
        label: "Telefono de contacto",
        required: true,
      },
    ],
  },
];

const MY_PROFILE_SYNC_FIELD_MAP = {
  personal: new Set([
    "genero",
    "tipo_sangre",
    "lugar_nacimiento",
    "fecha_nacimiento",
    "estado_civil",
    "telefono_personal",
    "email_personal",
  ]),
  domicilio: new Set([
    "ciudad_domicilio",
    "movilizacion",
    "direccion_domicilio",
    "telefono_fijo",
  ]),
  emergencia: new Set([
    "persona_contacto",
    "parentesco_contacto",
    "telefono_contacto",
  ]),
  estudios: new Set(["nivel_instruccion"]),
};

const MY_PROFILE_UPDATE_SECTIONS = talentProfileSections
  .filter((section) => MY_PROFILE_SYNC_FIELD_MAP[section.key])
  .map((section) => ({
    ...section,
    fields: (section.fields || [])
      .filter((field) => MY_PROFILE_SYNC_FIELD_MAP[section.key].has(field.key))
      .map((field) =>
        section.key === "laboral" && field.key === "telefono_celular_famproject"
          ? { ...field, readOnly: true }
          : field,
      ),
  }))
  .filter((section) => section.fields.length > 0);

const tabOptions = [
  { id: "documents", label: "Documentos", icon: FiFileText },
  { id: "credentials", label: "Títulos y Certificaciones", icon: FiAward },
];
const MY_PROFILE_CACHE_KEY = "my_profile_snapshot";

const mergeMetadata = (rawMetadata = {}) => ({
  ...emptyMetadata,
  ...rawMetadata,
  personal: {
    ...emptyMetadata.personal,
    ...(rawMetadata.personal || {}),
  },
  domicilio: {
    ...emptyMetadata.domicilio,
    ...(rawMetadata.domicilio || {}),
  },
  emergencia: {
    ...emptyMetadata.emergencia,
    ...(rawMetadata.emergencia || {}),
  },
  laboral: {
    ...emptyMetadata.laboral,
    ...(rawMetadata.laboral || {}),
  },
  estudios: {
    ...emptyMetadata.estudios,
    ...(rawMetadata.estudios || {}),
  },
});

const buildReviewData = (source = {}) => {
  const result = {};
  reviewSections.forEach((section) => {
    result[section.key] = {
      ...(source?.[section.key] || {}),
    };
  });
  return result;
};

const sanitizeText = (value, maxLength = 160) =>
  Array.from(String(value || ""))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 || char === "\n" || char === "\r" || char === "\t";
    })
    .join("")
    .replace(/\s{2,}/g, " ")
    .slice(0, maxLength);

const sanitizePhone = (value) =>
  String(value || "")
    .replace(/[^\d+()\-\s]/g, "")
    .slice(0, 20);

const sanitizeEmail = (value) =>
  String(value || "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .slice(0, 120);

const getReviewFieldType = (sectionKey, fieldKey) => {
  if (fieldKey.includes("telefono")) return "phone";
  if (fieldKey.includes("email")) return "email";
  if (sectionKey === "domicilio" && fieldKey === "direccion_domicilio") {
    return "address";
  }
  if (fieldKey.includes("ciudad")) return "city";
  if (fieldKey.includes("persona_contacto")) return "name";
  return "text";
};

const sanitizeReviewValue = (sectionKey, fieldKey, value) => {
  const fieldType = getReviewFieldType(sectionKey, fieldKey);
  if (fieldType === "phone") return sanitizePhone(value);
  if (fieldType === "email") return sanitizeEmail(value);
  if (fieldType === "address") return sanitizeText(value, 180);
  if (fieldType === "city") return sanitizeText(value, 80);
  if (fieldType === "name") return sanitizeText(value, 120);
  return sanitizeText(value, 120);
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const getMissingReviewFields = (source = {}) => {
  const missing = [];
  reviewSections.forEach((section) => {
    section.fields.forEach((field) => {
      if (!field.required) return;
      const value = String(source?.[section.key]?.[field.key] || "").trim();
      if (!value) {
        missing.push({
          section: section.key,
          field: field.key,
          label: field.label,
        });
      }
    });
  });
  return missing;
};

const validateReviewProfile = (source = {}) => {
  const errors = [];
  const email = String(source?.personal?.email_personal || "").trim();
  const personalPhone = String(
    source?.personal?.telefono_personal || "",
  ).trim();
  const landline = String(source?.domicilio?.telefono_fijo || "").trim();
  const emergencyPhone = String(
    source?.emergencia?.telefono_contacto || "",
  ).trim();

  if (email && !EMAIL_REGEX.test(email)) {
    errors.push("Ingresa un email personal valido.");
  }
  if (personalPhone && !PHONE_REGEX.test(personalPhone)) {
    errors.push(
      "El telefono personal debe contener entre 7 y 20 caracteres validos.",
    );
  }
  if (landline && !PHONE_REGEX.test(landline)) {
    errors.push(
      "El telefono fijo debe contener entre 7 y 20 caracteres validos.",
    );
  }
  if (emergencyPhone && !PHONE_REGEX.test(emergencyPhone)) {
    errors.push(
      "El telefono de contacto debe contener entre 7 y 20 caracteres validos.",
    );
  }

  return errors;
};

const SummaryMetric = ({ label, value, tone = "slate" }) => {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : "bg-white text-slate-800 border-slate-200";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </div>
  );
};

const MyProfilePage = ({ embedded = false }) => {
  const { showToast, showLoader, hideLoader, theme, setTheme } = useUI();
  const { user, reloadProfile } = useAuth();
  const { isOnline } = usePwaStatus();

  const [profile, setProfile] = useState(null);
  const [metadata, setMetadata] = useState(emptyMetadata);
  const [preferences, setPreferences] = useState(emptyPreferences);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [isPunctualityLeader, setIsPunctualityLeader] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showExpedienteModal, setShowExpedienteModal] = useState(false);
  const [reviewData, setReviewData] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [usingCachedProfile, setUsingCachedProfile] = useState(false);
  const [activeTab, setActiveTab] = useState("documents");
  const [baselineProfile, setBaselineProfile] = useState({
    metadata: emptyMetadata,
    preferences: emptyPreferences,
  });
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const identity = useMemo(() => profile?.identity || user, [profile, user]);

  useEffect(() => {
    if (!identity?.id) {
      setIsPunctualityLeader(false);
      return;
    }

    let cancelled = false;
    const loadPunctuality = async () => {
      try {
        const response = await getAttendancePunctualitySummary();
        if (!cancelled) {
          setIsPunctualityLeader(Boolean(response?.data?.currentUser?.isWinner));
        }
      } catch (_error) {
        if (!cancelled) setIsPunctualityLeader(false);
      }
    };

    loadPunctuality();
    return () => {
      cancelled = true;
    };
  }, [identity?.id]);

  const reviewMissingFields = useMemo(
    () => getMissingReviewFields(metadata),
    [metadata],
  );
  const hasCompleteReviewData = reviewMissingFields.length === 0;

  const needsReview = useMemo(() => {
    if (!hasCompleteReviewData) return true;
    const last = metadata?.profile_last_reviewed_at;
    if (!last) return true;
    const lastDate = new Date(last);
    if (Number.isNaN(lastDate.getTime())) return true;
    const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 365;
  }, [hasCompleteReviewData, metadata?.profile_last_reviewed_at]);

  const reviewSummary = useMemo(() => {
    if (!hasCompleteReviewData) {
      return {
        label: "Revision incompleta",
        tone: "amber",
        nextDue: `${reviewMissingFields.length} campo(s) clave pendiente(s)`,
      };
    }

    const last = metadata?.profile_last_reviewed_at;
    if (!last) {
      return {
        label: "Sin revision registrada",
        tone: "amber",
        nextDue: "Actualiza tu informacion",
      };
    }

    const lastDate = new Date(last);
    if (Number.isNaN(lastDate.getTime())) {
      return {
        label: "Revision no valida",
        tone: "amber",
        nextDue: "Actualiza tu informacion",
      };
    }

    const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    const remaining = Math.max(0, 365 - Math.floor(diffDays));
    if (diffDays >= 365) {
      return {
        label: "Revision vencida",
        tone: "amber",
        nextDue: "Debe actualizarse",
      };
    }

    return {
      label: `Ultima revision: ${lastDate.toLocaleDateString("es-EC")}`,
      tone: "emerald",
      nextDue: `Proxima revision en ${remaining} dias`,
    };
  }, [
    hasCompleteReviewData,
    metadata?.profile_last_reviewed_at,
    reviewMissingFields.length,
  ]);

  const reviewDraftMissingFields = useMemo(
    () => getMissingReviewFields(reviewData),
    [reviewData],
  );

  const hasPendingChanges = useMemo(
    () =>
      JSON.stringify(metadata) !== JSON.stringify(baselineProfile.metadata) ||
      JSON.stringify(preferences) !==
        JSON.stringify(baselineProfile.preferences) ||
      Boolean(avatarFile),
    [
      avatarFile,
      baselineProfile.metadata,
      baselineProfile.preferences,
      metadata,
      preferences,
    ],
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoadFailed(false);
        setUsingCachedProfile(false);
        showLoader();
        const data = await fetchMyProfile();
        setProfile(data);

        const incomingMetadata = mergeMetadata(data?.profile?.metadata || {});
        const incomingPrefs = {
          ...emptyPreferences,
          ...(data?.profile?.preferences || {}),
        };

        setMetadata(incomingMetadata);
        setPreferences(incomingPrefs);
        setBaselineProfile({
          metadata: incomingMetadata,
          preferences: incomingPrefs,
        });
        setLastSavedAt(
          data?.profile?.updated_at || data?.profile?.created_at || null,
        );
        writeCachedResource(MY_PROFILE_CACHE_KEY, data);

        if (data?.profile?.avatar_url) {
          setAvatarPreview(data.profile.avatar_url);
        }
        if (incomingPrefs.theme && incomingPrefs.theme !== theme) {
          setTheme(incomingPrefs.theme);
        }
      } catch (err) {
        console.error(err);
        const cached = readCachedResource(MY_PROFILE_CACHE_KEY, {
          maxAgeMs: 1000 * 60 * 60 * 24 * 7,
        });

        if (cached?.data && isTransientApiError(err)) {
          const data = cached.data;
          const incomingMetadata = mergeMetadata(data?.profile?.metadata || {});
          const incomingPrefs = {
            ...emptyPreferences,
            ...(data?.profile?.preferences || {}),
          };

          setProfile(data);
          setMetadata(incomingMetadata);
          setPreferences(incomingPrefs);
          setBaselineProfile({
            metadata: incomingMetadata,
            preferences: incomingPrefs,
          });
          setLastSavedAt(
            data?.profile?.updated_at || data?.profile?.created_at || cached.cachedAt || null,
          );
          setUsingCachedProfile(true);
          if (data?.profile?.avatar_url) {
            setAvatarPreview(data.profile.avatar_url);
          }
          showToast("Mostrando la última copia local de tu perfil", "warning");
        } else {
          setLoadFailed(true);
          showToast("No se pudo cargar tu perfil", "error");
        }
      } finally {
        hideLoader();
      }
    };

    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openReviewModal = () => {
    setReviewData(buildReviewData(metadata || {}));
    setShowReviewModal(true);
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast("Formato no permitido. Usa PNG, JPEG o WEBP.", "warning");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("La imagen debe pesar maximo 2 MB.", "warning");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (loadFailed) {
      showToast(
        "No se pudo validar la carga del perfil. Reintenta antes de guardar.",
        "warning",
      );
      return;
    }
    if (!hasPendingChanges) {
      showToast("No hay cambios para guardar.", "info");
      return;
    }

    try {
      setSaving(true);
      showLoader();

      const data = await upsertMyProfile({ metadata, preferences, avatarFile });
      const nextMetadata = mergeMetadata(data?.metadata || metadata);
      const nextPreferences = {
        ...emptyPreferences,
        ...(data?.preferences || preferences),
      };

      setProfile((prev) => ({ ...prev, profile: data }));
      setMetadata(nextMetadata);
      setPreferences(nextPreferences);
      setBaselineProfile({
        metadata: nextMetadata,
        preferences: nextPreferences,
      });
      setLastSavedAt(new Date().toISOString());
      if (nextPreferences.theme) {
        setTheme(nextPreferences.theme);
      }
      if (data?.avatar_url) {
        setAvatarPreview(data.avatar_url);
      }
      setAvatarFile(null);
      writeCachedResource(MY_PROFILE_CACHE_KEY, {
        ...(profile || {}),
        profile: data,
      });
      setUsingCachedProfile(false);
      await reloadProfile?.();
      showToast("Perfil actualizado correctamente.", "success");
    } catch (err) {
      console.error(err);
      showToast(getErrorMessage(err, "Error al actualizar el perfil"), "error");
    } finally {
      setSaving(false);
      hideLoader();
    }
  };

  const handleSaveAnnualReview = async () => {
    if (reviewDraftMissingFields.length > 0) {
      showToast(
        "Completa los campos clave antes de cerrar la revision anual.",
        "warning",
      );
      return;
    }

    const validationErrors = validateReviewProfile(reviewData);
    if (validationErrors.length > 0) {
      showToast(validationErrors[0], "warning");
      return;
    }

    try {
      setSaving(true);
      showLoader();

      const nextMetadata = {
        ...metadata,
        ...reviewData,
        profile_last_reviewed_at: new Date().toISOString(),
      };

      const data = await upsertMyProfile({
        metadata: nextMetadata,
        preferences,
        avatarFile: null,
      });

      const persistedMetadata = mergeMetadata(data?.metadata || nextMetadata);
      const persistedPreferences = {
        ...emptyPreferences,
        ...(data?.preferences || preferences),
      };

      setProfile((prev) => ({ ...prev, profile: data }));
      setMetadata(persistedMetadata);
      setPreferences(persistedPreferences);
      setBaselineProfile({
        metadata: persistedMetadata,
        preferences: persistedPreferences,
      });
      setLastSavedAt(new Date().toISOString());
      writeCachedResource(MY_PROFILE_CACHE_KEY, {
        ...(profile || {}),
        profile: data,
      });
      setUsingCachedProfile(false);
      setShowReviewModal(false);
      await reloadProfile?.();
      showToast("Datos actualizados correctamente.", "success");
    } catch (err) {
      console.error(err);
      showToast(getErrorMessage(err, "Error al actualizar"), "error");
    } finally {
      setSaving(false);
      hideLoader();
    }
  };

  const handleExpedienteFieldChange = (section, key, value) => {
    setMetadata((prev) => ({
      ...(prev || {}),
      [section]: {
        ...(prev?.[section] || {}),
        [key]: value,
      },
    }));
  };

  const rootClass = embedded
    ? "flex min-w-0 flex-col gap-5"
    : `${WORKSPACE_PAGE_CLASS} gap-5`;

  return (
    <>
      <div className={rootClass}>
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="relative shrink-0">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 text-2xl font-bold text-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Foto de perfil"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (identity?.fullname || identity?.email || "?").charAt(0).toUpperCase()
                  )}
                </div>
                <PunctualityWinnerBadge visible={isPunctualityLeader} size="lg" />
                <label className="absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition hover:bg-primary-dark active:scale-[0.97]">
                  <FiCamera size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Mi perfil
                </p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">
                  {identity?.fullname || "Nombre no disponible"}
                </h1>
                <p className="mt-1 break-all text-sm text-slate-500">
                  {identity?.email}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {metadata?.laboral?.cargo || "Cargo no registrado"}
                  {" · "}
                  {metadata?.laboral?.telefono_celular_famproject ||
                    metadata?.phone ||
                    "Sin numero asignado por TI"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {identity?.role || "Sin rol"}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      needsReview
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {needsReview ? "Revision pendiente" : "Datos vigentes"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasPendingChanges || loadFailed}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <FiSave size={16} />
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={() => setShowExpedienteModal(true)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
              >
                Abrir expediente
              </button>
              <button
                type="button"
                onClick={openReviewModal}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
              >
                Revision anual
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <SummaryMetric
              label="Revision anual"
              value={reviewSummary.label}
              tone={reviewSummary.tone}
            />
            <SummaryMetric label="Siguiente paso" value={reviewSummary.nextDue} />
            <SummaryMetric
              label="Ultimo guardado"
              value={
                lastSavedAt
                  ? new Date(lastSavedAt).toLocaleString("es-EC")
                  : "Sin cambios guardados"
              }
            />
          </div>
        </header>

        {loadFailed ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            No se pudo cargar el perfil desde el servidor. Reintenta antes de guardar cambios.
          </div>
        ) : null}

        {usingCachedProfile ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            Estás viendo una copia local del perfil. {isOnline ? "Cuando el backend responda, recarga la pantalla para sincronizar." : "Mientras sigas offline, el contenido será solo de consulta."}
          </div>
        ) : null}

        {needsReview ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <FiAlertCircle className="mt-0.5 shrink-0 text-amber-700" size={18} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    Debes confirmar tus datos personales.
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    La revision anual se gestiona desde un modal para no interrumpir el resto de la pantalla.
                  </p>
                  {!hasCompleteReviewData ? (
                    <p className="mt-2 text-xs font-medium text-amber-900">
                      Campos pendientes: {reviewMissingFields.map((field) => field.label).join(", ")}.
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={openReviewModal}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 active:scale-[0.97]"
              >
                Actualizar ahora
              </button>
            </div>
          </div>
        ) : null}

        <nav className="flex flex-wrap gap-2">
          {tabOptions.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${
                  isActive
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "documents" ? <ProfileDocumentsBoard /> : null}
        {activeTab === "credentials" ? <CertificationsBoard /> : null}
      </div>

      <Modal
        isOpen={showExpedienteModal}
        onClose={() => setShowExpedienteModal(false)}
        title="Expediente central"
        maxWidth="max-w-6xl"
      >
        <div className="space-y-4">
          <PersonnelProfile
            profileData={metadata}
            onProfileFieldChange={handleExpedienteFieldChange}
            loading={saving}
            saving={saving}
            readOnly={loadFailed}
            sections={MY_PROFILE_UPDATE_SECTIONS}
            draftKey={`my-profile:${identity?.id || user?.id || "me"}`}
            workflowStage="mi_perfil"
            showDraftTools={false}
            showSaveBar={false}
            extendedSectionPanels={false}
            panelTitle="Ficha sincronizada"
            panelDescription="Aqui solo se muestran los datos personales que el colaborador puede mantener actualizados desde Mi Perfil."
          />

          <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Guarda desde aqui sin salir del expediente central.
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasPendingChanges || loadFailed}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <FiSave size={16} />
              {saving ? "Guardando..." : "Guardar expediente"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="Actualizacion anual de datos"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Actualiza tus datos personales. Los campos marcados como obligatorios deben completarse para cerrar la revision anual.
          </p>

          {reviewDraftMissingFields.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Campos clave pendientes</p>
              <p className="mt-1 text-xs text-amber-800">
                {reviewDraftMissingFields.map((field) => field.label).join(", ")}.
              </p>
            </div>
          ) : null}

          <div className="space-y-4">
            {reviewSections.map((section) => (
              <div
                key={section.key}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <h3 className="text-sm font-semibold text-slate-900">
                  {section.title}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {section.fields.map((field) => {
                    const fieldValue = reviewData?.[section.key]?.[field.key] || "";
                    const hasError = field.required && !String(fieldValue).trim();
                    const fieldType = getReviewFieldType(section.key, field.key);

                    return (
                      <label key={field.key} className="text-xs text-slate-600">
                        <span className="font-medium uppercase tracking-[0.08em]">
                          {field.label}
                          {field.required ? " *" : ""}
                        </span>
                        {field.type === "select" ? (
                          <select
                            value={fieldValue}
                            onChange={(e) =>
                              setReviewData((prev) => ({
                                ...(prev || {}),
                                [section.key]: {
                                  ...(prev?.[section.key] || {}),
                                  [field.key]: e.target.value,
                                },
                              }))
                            }
                            className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 ${
                              hasError
                                ? "border-amber-400 ring-1 ring-amber-200"
                                : "border-slate-200"
                            }`}
                          >
                            <option value="">
                              {field.placeholder || "Selecciona una opcion"}
                            </option>
                            {(field.options || []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={
                              fieldType === "email"
                                ? "email"
                                : fieldType === "phone"
                                  ? "tel"
                                  : "text"
                            }
                            value={fieldValue}
                            onChange={(e) =>
                              setReviewData((prev) => ({
                                ...(prev || {}),
                                [section.key]: {
                                  ...(prev?.[section.key] || {}),
                                  [field.key]: sanitizeReviewValue(
                                    section.key,
                                    field.key,
                                    e.target.value,
                                  ),
                                },
                              }))
                            }
                            className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 ${
                              hasError
                                ? "border-amber-400 ring-1 ring-amber-200"
                                : "border-slate-200"
                            }`}
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowReviewModal(false)}
              className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveAnnualReview}
              disabled={saving}
              className="min-h-11 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Guardando..." : "Guardar actualizacion"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default MyProfilePage;
