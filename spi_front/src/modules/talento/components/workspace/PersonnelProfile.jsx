import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { PatternFormat } from "react-number-format";
import {
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiPlus,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import useLocalDraft from "../../hooks/useLocalDraft";
import { profileSections } from "../collaboratorProfileDefinitions";

const MASK_FORMATS = {
  cedula: "##########",
  ruc: "#############",
  landline: "#########",
  phone: "### ### ####",
};

const normalizeFreeText = (value, { trim = false } = {}) => {
  const normalized = String(value || "");
  return trim ? normalized.trim() : normalized;
};

const EMPTY_CHILD = Object.freeze({
  nombre: "",
  cedula: "",
  fecha_nacimiento: "",
});

const EMPTY_EMERGENCY_CONTACT = Object.freeze({
  nombre: "",
  parentesco: "",
  telefono: "",
});

const normalizeDateInputValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return "";
};

const normalizeFieldInputValue = (field, value) => {
  if (value === null || value === undefined) return "";
  const raw = String(value);

  if (field?.type === "date") {
    return normalizeDateInputValue(raw);
  }

  if (field?.digitOnly) {
    return raw.replace(/\D/g, "");
  }

  if (field?.mask) {
    return raw.replace(/\D/g, "");
  }

  return raw;
};

const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");
const isFilled = (value) => String(value || "").trim() !== "";
const isNAValue = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "n/a" || normalized === "na" || normalized === "no aplica";
};

const isTextLike = (field) =>
  !field.mask && field.type !== "email" && field.type !== "date" && field.type !== "number" && field.type !== "select";

const toUpperIfText = (field, value) =>
  isTextLike(field) ? String(value || "").toUpperCase() : value;

const computeAgeFromBirthDate = (rawBirthDate) => {
  const normalizedDate = normalizeDateInputValue(rawBirthDate);
  if (!normalizedDate) return "";

  const birthDate = new Date(`${normalizedDate}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : "";
};

const normalizeChild = (child = {}, options = {}) => ({
  nombre: normalizeFreeText(child?.nombre || "", options),
  cedula: normalizeDigits(child?.cedula || ""),
  fecha_nacimiento: normalizeDateInputValue(child?.fecha_nacimiento || ""),
});

const normalizeEmergencyContact = (contact = {}, options = {}) => ({
  nombre: normalizeFreeText(contact?.nombre || "", options),
  parentesco: normalizeFreeText(contact?.parentesco || "", options),
  telefono: normalizeDigits(contact?.telefono || ""),
});

const ensureChildren = (profileData = {}) => {
  const children = profileData?.familiar?.hijos;
  if (Array.isArray(children) && children.length > 0) {
    return children.map((child) => normalizeChild(child));
  }

  return [
    {
      nombre: profileData?.familiar?.nombre_primer_hijo || "",
      cedula: profileData?.familiar?.cedula_primer_hijo || "",
      fecha_nacimiento: profileData?.familiar?.fecha_nacimiento_primer_hijo || "",
    },
    {
      nombre: profileData?.familiar?.nombre_segundo_hijo || "",
      cedula: profileData?.familiar?.cedula_segundo_hijo || "",
      fecha_nacimiento: profileData?.familiar?.fecha_nacimiento_segundo_hijo || "",
    },
  ]
    .map((child) => normalizeChild(child))
    .filter(
      (child) =>
        (isFilled(child.nombre) && !isNAValue(child.nombre)) ||
        (isFilled(child.cedula) && !isNAValue(child.cedula)) ||
        (isFilled(child.fecha_nacimiento) && !isNAValue(child.fecha_nacimiento)),
    );
};

const ensureEmergencyContacts = (profileData = {}) => {
  const contacts = profileData?.emergencia?.contactos;
  if (Array.isArray(contacts) && contacts.length > 0) {
    return contacts.map((contact) => normalizeEmergencyContact(contact));
  }

  const legacy = normalizeEmergencyContact({
    nombre: profileData?.emergencia?.persona_contacto || "",
    parentesco: profileData?.emergencia?.parentesco_contacto || "",
    telefono: profileData?.emergencia?.telefono_contacto || "",
  });

  return (isFilled(legacy.nombre) && !isNAValue(legacy.nombre)) ||
    (isFilled(legacy.parentesco) && !isNAValue(legacy.parentesco)) ||
    (isFilled(legacy.telefono) && !isNAValue(legacy.telefono))
    ? [legacy]
    : [];
};

const childrenToLegacy = (children = []) => {
  const first = normalizeChild(children[0] || {}, { trim: true });
  const second = normalizeChild(children[1] || {}, { trim: true });
  const fallback = "N/A";

  return {
    nombre_primer_hijo: first.nombre || fallback,
    cedula_primer_hijo: first.cedula || fallback,
    fecha_nacimiento_primer_hijo: first.fecha_nacimiento || fallback,
    nombre_segundo_hijo: second.nombre || fallback,
    cedula_segundo_hijo: second.cedula || fallback,
    fecha_nacimiento_segundo_hijo: second.fecha_nacimiento || fallback,
  };
};

const emergencyToLegacy = (contacts = []) => {
  const first = normalizeEmergencyContact(contacts[0] || {}, { trim: true });
  const fallback = "N/A";

  return {
    persona_contacto: first.nombre || fallback,
    parentesco_contacto: first.parentesco || fallback,
    telefono_contacto: first.telefono || fallback,
  };
};

const toOptionEntries = (options = []) =>
  (Array.isArray(options) ? options : []).map((option) => {
    if (typeof option === "string") {
      return { value: option, label: option };
    }
    return {
      value: String(option?.value || ""),
      label: String(option?.label || option?.value || ""),
    };
  });

const buildDraftId = (explicitDraftKey, profileData = {}) => {
  if (explicitDraftKey) return explicitDraftKey;
  const personal = profileData?.personal || {};
  const laboral = profileData?.laboral || {};
  const identity = personal?.cedula || personal?.ruc || personal?.email_personal || laboral?.email_famproject;
  return identity ? `profile:${String(identity).trim().toLowerCase()}` : "profile:anon";
};

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "No se pudo guardar el perfil. Intenta nuevamente.";

const formatLocalDateTime = (rawDate) => {
  if (!rawDate) return "";
  try {
    return new Date(rawDate).toLocaleString();
  } catch (_error) {
    return "";
  }
};

const normalizeQualificationType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const QUALIFICATION_GROUPS = [
  {
    key: "third_level_title",
    title: "Titulos 3er nivel",
    emptyLabel: "Sin titulos de 3er nivel registrados.",
  },
  {
    key: "fourth_level_title",
    title: "Titulos 4to nivel",
    emptyLabel: "Sin titulos de 4to nivel registrados.",
  },
  {
    key: "certification",
    title: "Certificaciones",
    emptyLabel: "Sin certificaciones registradas.",
  },
];

const REQUEST_QUALIFICATION_TYPE_OPTIONS = [
  { value: "third_level_title", label: "Titulo 3er nivel" },
  { value: "fourth_level_title", label: "Titulo 4to nivel" },
  { value: "certification", label: "Certificacion" },
];

const formatQualificationMeta = (qualification = {}) => {
  const meta = [];
  if (qualification.institution) meta.push(qualification.institution);
  else if (qualification.issuer) meta.push(qualification.issuer);
  if (qualification.registration_number) meta.push(`Reg. ${qualification.registration_number}`);
  if (qualification.issue_date) meta.push(qualification.issue_date);
  return meta.join(" · ");
};

const resolveQualificationDocumentUrl = (qualification = {}) =>
  qualification?.drive_url || qualification?.file_url || "";

const PersonnelProfile = ({
  profileData,
  qualifications = [],
  qualificationMigrationPending = { total: 0, items: [] },
  onQualificationsChange,
  onResolveQualificationPending,
  onProfileFieldChange,
  onChange,
  onProfileSave,
  onSave,
  loading,
  saving,
  errors = {},
  readOnly = false,
  sections = profileSections,
  draftKey,
  showCentralQualifications = false,
  workflowStage,
  panelTitle = "Ficha del expediente",
  panelDescription = "Mantiene la fuente central de verdad del colaborador con una estructura clara, editable y sin duplicidades.",
  showDraftTools = true,
  showSaveBar = true,
  extendedSectionPanels = true,
  saveButtonLabel = "Guardar ficha",
}) => {
  const handleProfileFieldChange = onProfileFieldChange || onChange;
  const handleProfileSave = onProfileSave || onSave;
  const [openSections, setOpenSections] = useState(new Set(["personal", "laboral"]));
  const [qualificationDraft, setQualificationDraft] = useState({
    qualification_type: "third_level_title",
    title: "",
    institution: "",
  });
  const resolvedDraftId = useMemo(
    () => buildDraftId(draftKey, profileData),
    [draftKey, profileData],
  );

  const {
    draftExists,
    draftUpdatedAt,
    lastSavedAt,
    restoreDraft,
    clearDraft,
    persistDraft,
  } = useLocalDraft({
    draftId: resolvedDraftId,
    value: profileData,
    enabled: Boolean(profileData),
    intervalMs: 30000,
  });

  const children = useMemo(() => ensureChildren(profileData), [profileData]);
  const emergencyContacts = useMemo(
    () => ensureEmergencyContacts(profileData),
    [profileData],
  );
  const qualificationGroups = useMemo(() => {
    const grouped = new Map(
      QUALIFICATION_GROUPS.map((group) => [group.key, { ...group, items: [] }]),
    );

    (Array.isArray(qualifications) ? qualifications : []).forEach((qualification) => {
      const key = normalizeQualificationType(qualification?.qualification_type);
      if (!grouped.has(key)) return;
      grouped.get(key).items.push(qualification);
    });

    return Array.from(grouped.values());
  }, [qualifications]);

  const editableQualifications = useMemo(
    () => (Array.isArray(qualifications) ? qualifications : []),
    [qualifications],
  );
  const sectionSummaries = useMemo(
    () =>
      sections.map((section) => {
        const total = Array.isArray(section.fields) ? section.fields.length : 0;
        const done = (section.fields || []).reduce((count, field) => {
          const value = profileData?.[section.key]?.[field.key];
          return count + (String(value || "").trim() !== "" ? 1 : 0);
        }, 0);
        return {
          key: section.key,
          title: section.title,
          total,
          done,
          complete: total > 0 && done === total,
        };
      }),
    [profileData, sections],
  );
  const completedSections = sectionSummaries.filter((section) => section.complete).length;

  const updateQualificationDraft = useCallback((key, value) => {
    setQualificationDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const handleAddQualification = useCallback(() => {
    if (showCentralQualifications || typeof onQualificationsChange !== "function") return;

    const title = String(qualificationDraft.title || "").trim();
    const institution = String(qualificationDraft.institution || "").trim();
    if (!title && !institution) {
      toast.error("Completa al menos el titulo o la institucion.");
      return;
    }

    onQualificationsChange([
      ...editableQualifications,
      {
        id: `draft-${Date.now()}`,
        qualification_type: qualificationDraft.qualification_type,
        title: title || "Registro academico",
        institution: institution || null,
      },
    ]);

    setQualificationDraft((current) => ({
      ...current,
      title: "",
      institution: "",
    }));
  }, [
    editableQualifications,
    onQualificationsChange,
    qualificationDraft.institution,
    qualificationDraft.qualification_type,
    qualificationDraft.title,
    showCentralQualifications,
  ]);

  const handleRemoveQualification = useCallback((indexToRemove) => {
    if (showCentralQualifications || typeof onQualificationsChange !== "function") return;
    onQualificationsChange(editableQualifications.filter((_, index) => index !== indexToRemove));
  }, [editableQualifications, onQualificationsChange, showCentralQualifications]);

  useEffect(() => {
    const normalizedStage = String(workflowStage || "")
      .trim()
      .toLowerCase();
    if (!normalizedStage) return;
    const currentStage = String(profileData?.onboarding?.workflow_stage || "")
      .trim()
      .toLowerCase();
    if (currentStage === normalizedStage) return;
    handleProfileFieldChange?.("onboarding", "workflow_stage", normalizedStage);
  }, [handleProfileFieldChange, profileData?.onboarding?.workflow_stage, workflowStage]);

  useEffect(() => {
    const birthDate = profileData?.personal?.fecha_nacimiento || "";
    const computedAge = computeAgeFromBirthDate(birthDate);
    const currentAge = String(profileData?.personal?.edad || "").trim();
    if (computedAge !== currentAge) {
      handleProfileFieldChange?.("personal", "edad", computedAge);
    }
  }, [
    handleProfileFieldChange,
    profileData?.personal?.edad,
    profileData?.personal?.fecha_nacimiento,
  ]);

  const toggleSection = useCallback((sectionKey) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  }, []);

  const syncChildren = useCallback(
    (nextChildren) => {
      const normalizedChildren = (Array.isArray(nextChildren) ? nextChildren : []).map((child) =>
        normalizeChild(child),
      );
      handleProfileFieldChange?.("familiar", "hijos", normalizedChildren);
      const legacy = childrenToLegacy(normalizedChildren);
      Object.entries(legacy).forEach(([legacyKey, legacyValue]) => {
        handleProfileFieldChange?.("familiar", legacyKey, legacyValue);
      });
    },
    [handleProfileFieldChange],
  );

  const syncEmergencyContacts = useCallback(
    (nextContacts) => {
      const normalizedContacts = (Array.isArray(nextContacts) ? nextContacts : []).map((contact) =>
        normalizeEmergencyContact(contact),
      );
      handleProfileFieldChange?.("emergencia", "contactos", normalizedContacts);
      const legacy = emergencyToLegacy(normalizedContacts);
      Object.entries(legacy).forEach(([legacyKey, legacyValue]) => {
        handleProfileFieldChange?.("emergencia", legacyKey, legacyValue);
      });
    },
    [handleProfileFieldChange],
  );

  const handleChange = useCallback(
    (sectionKey, fieldKey, value) => {
      const nextValue = value === null || value === undefined ? "" : value;
      handleProfileFieldChange?.(sectionKey, fieldKey, nextValue);

      if (sectionKey === "personal" && fieldKey === "fecha_nacimiento") {
        handleProfileFieldChange?.(
          "personal",
          "edad",
          computeAgeFromBirthDate(nextValue),
        );
      }
    },
    [handleProfileFieldChange],
  );

  const handleAddChild = useCallback(() => {
    if (readOnly) return;
    syncChildren([...(children || []), { ...EMPTY_CHILD }]);
  }, [children, readOnly, syncChildren]);

  const handleChildChange = useCallback(
    (index, key, value) => {
      const next = [...(children || [])];
      const current = normalizeChild(next[index] || {});
      const nextValue =
        key === "cedula"
          ? normalizeDigits(value)
          : key === "fecha_nacimiento"
            ? normalizeDateInputValue(value)
            : String(value || "");
      next[index] = { ...current, [key]: nextValue };
      syncChildren(next);
    },
    [children, syncChildren],
  );

  const handleRemoveChild = useCallback(
    (index) => {
      if (readOnly) return;
      const next = [...(children || [])];
      next.splice(index, 1);
      syncChildren(next);
    },
    [children, readOnly, syncChildren],
  );

  const handleAddEmergencyContact = useCallback(() => {
    if (readOnly) return;
    syncEmergencyContacts([
      ...(emergencyContacts || []),
      { ...EMPTY_EMERGENCY_CONTACT },
    ]);
  }, [emergencyContacts, readOnly, syncEmergencyContacts]);

  const handleEmergencyContactChange = useCallback(
    (index, key, value) => {
      const next = [...(emergencyContacts || [])];
      const current = normalizeEmergencyContact(next[index] || {});
      const nextValue = key === "telefono" ? normalizeDigits(value) : String(value || "");
      next[index] = { ...current, [key]: nextValue };
      syncEmergencyContacts(next);
    },
    [emergencyContacts, syncEmergencyContacts],
  );

  const handleRemoveEmergencyContact = useCallback(
    (index) => {
      if (readOnly) return;
      const next = [...(emergencyContacts || [])];
      next.splice(index, 1);
      syncEmergencyContacts(next);
    },
    [emergencyContacts, readOnly, syncEmergencyContacts],
  );

  const handleRestoreDraft = useCallback(() => {
    const draftData = restoreDraft();
    if (!draftData || typeof draftData !== "object") {
      toast.error("No se encontro un borrador valido para restaurar.");
      return;
    }

    Object.entries(draftData).forEach(([sectionKey, sectionValue]) => {
      if (!sectionValue || typeof sectionValue !== "object") return;
      Object.entries(sectionValue).forEach(([fieldKey, fieldValue]) => {
        handleChange(sectionKey, fieldKey, fieldValue ?? "");
      });
    });

    if (Array.isArray(draftData?.familiar?.hijos)) {
      syncChildren(draftData.familiar.hijos);
    }
    if (Array.isArray(draftData?.emergencia?.contactos)) {
      syncEmergencyContacts(draftData.emergencia.contactos);
    }

    toast.success("Borrador local restaurado.");
  }, [handleChange, restoreDraft, syncChildren, syncEmergencyContacts]);

  const handleSaveWithFeedback = useCallback(async () => {
    if (readOnly || !handleProfileSave) return;
    persistDraft();
    await toast.promise(Promise.resolve(handleProfileSave()), {
      loading: "Sincronizando expediente...",
      success: () => {
        clearDraft();
        return "Perfil actualizado en Drive y DB";
      },
      error: (error) => `Error: ${getErrorMessage(error)}`,
    });
  }, [clearDraft, handleProfileSave, persistDraft, readOnly]);

  const saveTimestamp = useMemo(
    () => formatLocalDateTime(lastSavedAt || draftUpdatedAt),
    [draftUpdatedAt, lastSavedAt],
  );

  if (!profileData) return null;

  const resolveFieldTabIndex = (sectionIndex, fieldIndex) => sectionIndex * 100 + fieldIndex + 30;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Expediente central
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">{panelTitle}</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">{panelDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {completedSections}/{sectionSummaries.length} secciones completas
              </span>
              {saveTimestamp ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Ultimo borrador: {saveTimestamp}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Autosave local cada 30 segundos
                </span>
              )}
              {readOnly ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Solo lectura
                </span>
              ) : null}
            </div>
          </div>
          {showDraftTools ? (
            <div className="flex flex-wrap items-center gap-2">
              {draftExists ? (
                <>
                  <button
                    type="button"
                    onClick={handleRestoreDraft}
                    aria-label="Restaurar borrador local del perfil"
                    tabIndex={10}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
                  >
                    Restaurar borrador
                  </button>
                  <button
                    type="button"
                    onClick={clearDraft}
                    aria-label="Limpiar borrador local del perfil"
                    tabIndex={11}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[0.97]"
                  >
                    Limpiar borrador
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {sectionSummaries.map((section) => (
            <div
              key={`summary-${section.key}`}
              className={`rounded-2xl border px-4 py-3 ${
                section.complete
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {section.title}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {section.done}/{section.total} campos
              </p>
            </div>
          ))}
        </div>
      </div>

      {sections.map((section, sectionIndex) => {
        const isOpen = openSections.has(section.key);
        const sectionFields =
          extendedSectionPanels && section.key === "emergencia" ? [] : section.fields;

        return (
          <div
            key={section.key}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-all"
          >
            <button
              type="button"
              onClick={() => toggleSection(section.key)}
              aria-label={`${isOpen ? "Contraer" : "Expandir"} sección ${section.title}`}
              tabIndex={sectionIndex * 100 + 20}
              className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-4 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{section.title}</span>
                {errors[section.key] ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    Revisar
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                {isOpen ? (
                  <FiChevronUp title="Icono para contraer sección" />
                ) : (
                  <FiChevronDown title="Icono para expandir sección" />
                )}
              </div>
            </button>

            {isOpen ? (
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionFields.map((field, fieldIndex) => {
                    const fieldPath = `${section.key}.${field.key}`;
                    const hasError = Boolean(errors[fieldPath]);
                    const inputClass = `min-h-11 w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${isTextLike(field) ? "uppercase" : ""} ${
                      hasError
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-200 bg-white"
                    }`;
                    const rawFieldValue = profileData?.[section.key]?.[field.key];
                    const fieldValue = normalizeFieldInputValue(field, rawFieldValue);
                    const maskFormat = MASK_FORMATS[field.mask];
                    const optionEntries = toOptionEntries(field.options);

                    return (
                      <div
                        key={field.key}
                        className={`space-y-1 ${field.fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}
                      >
                        <label className="block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                          {field.label}
                          {field.required ? <span className="ml-1 text-amber-600">*</span> : null}
                        </label>

                        {field.readOnly ? (
                          <div className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {fieldValue || "N/A"}
                          </div>
                        ) : field.type === "select" ? (
                          <select
                            value={fieldValue}
                            onChange={(event) => handleChange(section.key, field.key, event.target.value)}
                            className={inputClass}
                            disabled={readOnly}
                            tabIndex={resolveFieldTabIndex(sectionIndex, fieldIndex)}
                            aria-label={`Campo ${field.label}`}
                          >
                            <option value="">
                              {field.placeholder || "Selecciona una opcion"}
                            </option>
                            {optionEntries.map((option) => (
                              <option key={`${field.key}-${option.value}`} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : field.multiline ? (
                          <textarea
                            rows={field.rows || 3}
                            placeholder={field.placeholder}
                            value={fieldValue}
                            onChange={(event) => handleChange(section.key, field.key, toUpperIfText(field, event.target.value))}
                            className={inputClass}
                            disabled={readOnly}
                            tabIndex={resolveFieldTabIndex(sectionIndex, fieldIndex)}
                            aria-label={`Campo ${field.label}`}
                          />
                        ) : maskFormat ? (
                          <PatternFormat
                            format={maskFormat}
                            allowEmptyFormatting={false}
                            mask="_"
                            value={fieldValue}
                            valueIsNumericString
                            onValueChange={({ value }) => handleChange(section.key, field.key, value)}
                            className={inputClass}
                            disabled={readOnly}
                            placeholder={field.placeholder}
                            tabIndex={resolveFieldTabIndex(sectionIndex, fieldIndex)}
                            aria-label={`Campo ${field.label}`}
                          />
                        ) : (
                          <input
                            type={field.type || "text"}
                            inputMode={field.inputMode}
                            pattern={field.pattern}
                            maxLength={field.maxLength}
                            placeholder={field.placeholder}
                            value={fieldValue}
                            onChange={(event) =>
                              handleChange(
                                section.key,
                                field.key,
                                field.digitOnly
                                  ? event.target.value.replace(/\D/g, "")
                                  : toUpperIfText(field, event.target.value),
                              )
                            }
                            className={inputClass}
                            disabled={readOnly}
                            tabIndex={resolveFieldTabIndex(sectionIndex, fieldIndex)}
                            aria-label={`Campo ${field.label}`}
                          />
                        )}

                        {hasError ? (
                          <p className="text-[10px] text-amber-700">{errors[fieldPath]}</p>
                        ) : field.helperText ? (
                          <p className="text-[10px] text-slate-500">{field.helperText}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {extendedSectionPanels && section.key === "familiar" ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Hijos</p>
                        <p className="text-xs text-slate-500">
                          Puedes agregar uno o varios registros.
                        </p>
                      </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={handleAddChild}
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.97]"
                          aria-label="Agregar hijo"
                        >
                          <FiPlus />
                          Agregar hijo/a
                        </button>
                      ) : null}
                    </div>

                    {children.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
                        No hay hijos registrados.
                      </p>
                    ) : (
                      children.map((child, childIndex) => (
                        <div
                          key={`child-${childIndex}`}
                          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3"
                        >
                          <div className="space-y-1">
                            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                              Nombre hijo/a
                            </label>
                            <input
                              type="text"
                              value={child.nombre}
                              disabled={readOnly}
                              onChange={(event) =>
                                handleChildChange(childIndex, "nombre", event.target.value.toUpperCase())
                              }
                              className="uppercase min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                              Cedula
                            </label>
                            <PatternFormat
                              format={MASK_FORMATS.cedula}
                              allowEmptyFormatting={false}
                              mask="_"
                              value={child.cedula}
                              valueIsNumericString
                              disabled={readOnly}
                              onValueChange={({ value }) =>
                                handleChildChange(childIndex, "cedula", value)
                              }
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                              Fecha nacimiento
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={child.fecha_nacimiento}
                                disabled={readOnly}
                                onChange={(event) =>
                                  handleChildChange(childIndex, "fecha_nacimiento", event.target.value)
                                }
                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              />
                              {!readOnly ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChild(childIndex)}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-[0.97]"
                                  aria-label="Eliminar hijo"
                                >
                                  <FiTrash2 />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}

                {extendedSectionPanels && section.key === "emergencia" ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Contactos de emergencia
                        </p>
                        <p className="text-xs text-slate-500">
                          Puedes registrar multiples contactos.
                        </p>
                      </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={handleAddEmergencyContact}
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.97]"
                          aria-label="Agregar contacto de emergencia"
                        >
                          <FiPlus />
                          Agregar contacto
                        </button>
                      ) : null}
                    </div>

                    {emergencyContacts.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
                        No hay contactos de emergencia registrados.
                      </p>
                    ) : (
                      emergencyContacts.map((contact, contactIndex) => (
                        <div
                          key={`emergency-${contactIndex}`}
                          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3"
                        >
                          <div className="space-y-1">
                            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                              Nombre
                            </label>
                            <input
                              type="text"
                              value={contact.nombre}
                              disabled={readOnly}
                              onChange={(event) =>
                                handleEmergencyContactChange(
                                  contactIndex,
                                  "nombre",
                                  event.target.value.toUpperCase(),
                                )
                              }
                              className="uppercase min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                              Parentesco
                            </label>
                            <input
                              type="text"
                              value={contact.parentesco}
                              disabled={readOnly}
                              onChange={(event) =>
                                handleEmergencyContactChange(
                                  contactIndex,
                                  "parentesco",
                                  event.target.value.toUpperCase(),
                                )
                              }
                              className="uppercase min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                              Telefono
                            </label>
                            <div className="flex items-center gap-2">
                              <PatternFormat
                                format={MASK_FORMATS.phone}
                                allowEmptyFormatting={false}
                                mask="_"
                                value={contact.telefono}
                                valueIsNumericString
                                disabled={readOnly}
                                onValueChange={({ value }) =>
                                  handleEmergencyContactChange(contactIndex, "telefono", value)
                                }
                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              />
                              {!readOnly ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEmergencyContact(contactIndex)}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-[0.97]"
                                  aria-label="Eliminar contacto de emergencia"
                                >
                                  <FiTrash2 />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}

                {extendedSectionPanels && section.key === "estudios" ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                    <div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">
                            Credenciales centralizadas del expediente
                          </p>
                          <p className="text-sm text-slate-600">
                            Este bloque consolida títulos y certificaciones desde la fuente
                            única de Talento Humano.
                          </p>
                        </div>
                        {showCentralQualifications ? (
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            Solo lectura en esta ficha
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {showCentralQualifications ? (
                      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm text-slate-600">
                        Los títulos y certificaciones ya no se editan aquí para colaboradores activos.
                        Se visualizan desde el expediente central y se originan en `Mi Perfil` o en los
                        flujos operativos autorizados.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        En solicitudes previas a contratación aún se conservan campos simples de
                        estudios porque `personnel_request_profiles` sigue usando ese formato temporal.
                      </div>
                    )}

                    {!showCentralQualifications ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Credenciales de la solicitud
                            </p>
                            <p className="text-sm text-slate-600">
                              Este bloque se guarda separado del perfil y luego se migra a `collaborator_qualifications`.
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            Pre-contratacion
                          </span>
                        </div>

                        {!readOnly ? (
                          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                              Tipo
                              <select
                                value={qualificationDraft.qualification_type}
                                onChange={(event) =>
                                  updateQualificationDraft("qualification_type", event.target.value)
                                }
                                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              >
                                {REQUEST_QUALIFICATION_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                              Titulo o nombre
                              <input
                                type="text"
                                value={qualificationDraft.title}
                                onChange={(event) =>
                                  updateQualificationDraft("title", event.target.value)
                                }
                                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                              Institucion
                              <input
                                type="text"
                                value={qualificationDraft.institution}
                                onChange={(event) =>
                                  updateQualificationDraft("institution", event.target.value)
                                }
                                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              />
                            </label>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={handleAddQualification}
                                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 ease-out hover:bg-blue-700 active:scale-[0.97]"
                              >
                                <FiPlus className="mr-2" />
                                Agregar
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 space-y-3">
                          {editableQualifications.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                              Aun no hay credenciales cargadas para esta solicitud.
                            </div>
                          ) : (
                            editableQualifications.map((qualification, index) => {
                              const typeLabel =
                                REQUEST_QUALIFICATION_TYPE_OPTIONS.find(
                                  (option) =>
                                    option.value === normalizeQualificationType(qualification?.qualification_type),
                                )?.label || "Registro";
                              return (
                                <div
                                  key={qualification?.id || `request-qualification-${index}`}
                                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {qualification?.title || "Registro academico"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {[typeLabel, qualification?.institution].filter(Boolean).join(" · ")}
                                    </p>
                                  </div>
                                  {!readOnly ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveQualification(index)}
                                      className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-transform duration-150 ease-out hover:bg-rose-100 active:scale-[0.97]"
                                    >
                                      <FiTrash2 className="mr-2" />
                                      Quitar
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}

                    {showCentralQualifications && Number(qualificationMigrationPending?.total || 0) > 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-amber-900">
                              Credenciales legacy pendientes de migracion
                            </p>
                            <p className="text-sm text-amber-800">
                              Hay {qualificationMigrationPending.total} registro(s) historico(s) que aun no entran a
                              `collaborator_qualifications` porque requieren reclasificacion o validacion manual.
                            </p>
                          </div>
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                            Revision manual
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {qualificationMigrationPending.items.map((item) => (
                            <div
                              key={`pending-qualification-${item.id}`}
                              className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3"
                            >
                              <p className="text-sm font-semibold text-slate-900">
                                {item.title || "Registro sin titulo"}
                              </p>
                              <p className="mt-1 text-xs text-slate-600">
                                {item.pending_reason_label}
                              </p>
                              {!readOnly && typeof onResolveQualificationPending === "function" ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {item.pending_reason_code === "title_level_missing" ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onResolveQualificationPending(item.id, {
                                            action: "migrate_qualification",
                                            qualificationType: "third_level_title",
                                          })
                                        }
                                        className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                                      >
                                        Marcar 3er nivel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onResolveQualificationPending(item.id, {
                                            action: "migrate_qualification",
                                            qualificationType: "fourth_level_title",
                                          })
                                        }
                                        className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
                                      >
                                        Marcar 4to nivel
                                      </button>
                                    </>
                                  ) : null}

                                  {item.pending_reason_code === "document_reclassification_required" ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onResolveQualificationPending(item.id, {
                                          action: "reclassify_document",
                                          documentType: "SENESCYT_RECORD",
                                        })
                                      }
                                      className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                                    >
                                      Mover a documento SENESCYT
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                              {resolveQualificationDocumentUrl(item) ? (
                                <div className="mt-3">
                                  <a
                                    href={resolveQualificationDocumentUrl(item)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  >
                                    <FiEye className="mr-2" />
                                    Abrir respaldo
                                  </a>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {qualificationGroups.map((group) => (
                        <div
                          key={group.key}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-slate-900">
                                {group.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {group.items.length > 0
                                  ? "Registros vigentes en la fuente central"
                                  : group.emptyLabel}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {group.items.length}
                            </span>
                          </div>

                          {group.items.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                              {group.emptyLabel}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {group.items.map((qualification) => {
                                const primaryLabel =
                                  qualification?.title ||
                                  qualification?.file_name ||
                                  "Registro sin titulo";
                                const secondaryLabel = formatQualificationMeta(qualification);
                                const documentUrl = resolveQualificationDocumentUrl(qualification);
                                return (
                                  <div
                                    key={qualification?.id || `${group.key}-${primaryLabel}`}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                                  >
                                    <p className="text-sm font-semibold text-slate-900">
                                      {primaryLabel}
                                    </p>
                                    {secondaryLabel ? (
                                      <p className="mt-1 text-xs text-slate-500">
                                        {secondaryLabel}
                                      </p>
                                    ) : null}
                                    {documentUrl ? (
                                      <div className="mt-3">
                                        <a
                                          href={documentUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                        >
                                          <FiEye className="mr-2" />
                                          Abrir respaldo
                                        </a>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {showSaveBar ? (
        <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Etapa del flujo: <span className="font-semibold text-slate-900">{workflowStage || "no definida"}</span>
          </p>
          <button
            type="button"
            onClick={handleSaveWithFeedback}
            disabled={readOnly || loading || saving}
            aria-label="Guardar perfil del colaborador"
            tabIndex={10000}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 active:scale-[0.97]"
          >
            <FiSave title="Icono de guardado de perfil" />
            {saving ? "Guardando..." : saveButtonLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default PersonnelProfile;
