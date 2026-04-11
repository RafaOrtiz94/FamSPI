import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { PatternFormat } from "react-number-format";
import {
  FiChevronDown,
  FiChevronUp,
  FiPlus,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import useLocalDraft from "../../hooks/useLocalDraft";
import { profileSections } from "../collaboratorProfileDefinitions";

const MASK_FORMATS = {
  cedula: "##########",
  ruc: "#############",
  phone: "### ### ####",
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

const normalizeChild = (child = {}) => ({
  nombre: String(child?.nombre || "").trim(),
  cedula: normalizeDigits(child?.cedula || ""),
  fecha_nacimiento: normalizeDateInputValue(child?.fecha_nacimiento || ""),
});

const normalizeEmergencyContact = (contact = {}) => ({
  nombre: String(contact?.nombre || "").trim(),
  parentesco: String(contact?.parentesco || "").trim(),
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
  const first = normalizeChild(children[0] || {});
  const second = normalizeChild(children[1] || {});
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
  const first = normalizeEmergencyContact(contacts[0] || {});
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

const PersonnelProfile = ({
  profileData,
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
  workflowStage,
}) => {
  const handleProfileFieldChange = onProfileFieldChange || onChange;
  const handleProfileSave = onProfileSave || onSave;
  const [openSections, setOpenSections] = useState(new Set(["personal", "laboral"]));
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
      <div className="rounded-xl border border-brand-hr-primary/15 bg-brand-hr-primary-soft/50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-brand-hr-primary-muted">
            <p className="font-semibold text-brand-hr-primary">Borrador local activo</p>
            <p>
              {saveTimestamp
                ? `Borrador guardado localmente: ${saveTimestamp}`
                : "Se guardaran cambios parciales cada 30 segundos."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draftExists ? (
              <>
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  aria-label="Restaurar borrador local del perfil"
                  tabIndex={10}
                  className="rounded-md border border-brand-hr-primary/25 bg-brand-hr-primary-contrast px-3 py-1.5 text-xs font-semibold text-brand-hr-primary transition hover:bg-brand-hr-primary-soft"
                >
                  Restaurar borrador
                </button>
                <button
                  type="button"
                  onClick={clearDraft}
                  aria-label="Limpiar borrador local del perfil"
                  tabIndex={11}
                  className="rounded-md border border-brand-hr-primary/20 bg-brand-hr-primary-contrast px-3 py-1.5 text-xs font-semibold text-brand-hr-primary-muted transition hover:bg-brand-hr-primary-soft"
                >
                  Limpiar borrador
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {sections.map((section, sectionIndex) => {
        const isOpen = openSections.has(section.key);

        return (
          <div
            key={section.key}
            className="overflow-hidden rounded-xl border border-brand-hr-primary/15 bg-brand-hr-primary-contrast transition-all hover:shadow-sm"
          >
            <button
              type="button"
              onClick={() => toggleSection(section.key)}
              aria-label={`${isOpen ? "Contraer" : "Expandir"} sección ${section.title}`}
              tabIndex={sectionIndex * 100 + 20}
              className="flex w-full items-center justify-between bg-brand-hr-primary-soft/45 px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-brand-hr-primary">{section.title}</span>
                {errors[section.key] ? (
                  <span className="rounded bg-hr-warning-soft px-2 py-0.5 text-[10px] font-bold text-hr-warning-muted">
                    !
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-brand-hr-primary-muted">
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
                  {section.fields.map((field, fieldIndex) => {
                    const fieldPath = `${section.key}.${field.key}`;
                    const hasError = Boolean(errors[fieldPath]);
                    const inputClass = `w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus:border-brand-hr-primary focus:ring-1 focus:ring-brand-hr-primary ${
                      hasError
                        ? "border-hr-warning bg-hr-warning-soft/30"
                        : "border-brand-hr-primary/25 bg-brand-hr-primary-contrast"
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
                        <label className="block text-xs font-medium text-brand-hr-primary-muted">
                          {field.label}
                          {field.required ? <span className="ml-1 text-hr-warning">*</span> : null}
                        </label>

                        {field.readOnly ? (
                          <div className="rounded-md border border-transparent bg-brand-hr-primary-soft px-3 py-2 text-sm text-brand-hr-primary">
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
                            onChange={(event) => handleChange(section.key, field.key, event.target.value)}
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
                            onChange={(event) => handleChange(section.key, field.key, event.target.value)}
                            className={inputClass}
                            disabled={readOnly}
                            tabIndex={resolveFieldTabIndex(sectionIndex, fieldIndex)}
                            aria-label={`Campo ${field.label}`}
                          />
                        )}

                        {hasError ? (
                          <p className="text-[10px] text-hr-warning-muted">{errors[fieldPath]}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {section.key === "familiar" ? (
                  <div className="space-y-3 rounded-xl border border-brand-hr-primary/15 bg-brand-hr-primary-soft/35 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-brand-hr-primary">Hijos</p>
                        <p className="text-xs text-brand-hr-primary-muted">
                          Puedes agregar uno o varios registros.
                        </p>
                      </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={handleAddChild}
                          className="inline-flex items-center gap-2 rounded-md border border-brand-hr-primary/20 bg-brand-hr-primary-contrast px-3 py-1.5 text-xs font-semibold text-brand-hr-primary hover:bg-brand-hr-primary-soft"
                          aria-label="Agregar hijo"
                        >
                          <FiPlus />
                          Agregar hijo/a
                        </button>
                      ) : null}
                    </div>

                    {children.length === 0 ? (
                      <p className="rounded-md border border-dashed border-brand-hr-primary/20 bg-brand-hr-primary-contrast px-3 py-2 text-xs text-brand-hr-primary-muted">
                        No hay hijos registrados.
                      </p>
                    ) : (
                      children.map((child, childIndex) => (
                        <div
                          key={`child-${childIndex}`}
                          className="grid grid-cols-1 gap-3 rounded-lg border border-brand-hr-primary/15 bg-brand-hr-primary-contrast p-3 sm:grid-cols-3"
                        >
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-brand-hr-primary-muted">
                              Nombre hijo/a
                            </label>
                            <input
                              type="text"
                              value={child.nombre}
                              disabled={readOnly}
                              onChange={(event) =>
                                handleChildChange(childIndex, "nombre", event.target.value)
                              }
                              className="w-full rounded-md border border-brand-hr-primary/25 bg-brand-hr-primary-contrast px-3 py-2 text-sm shadow-sm focus:border-brand-hr-primary focus:ring-1 focus:ring-brand-hr-primary"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-brand-hr-primary-muted">
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
                              className="w-full rounded-md border border-brand-hr-primary/25 bg-brand-hr-primary-contrast px-3 py-2 text-sm shadow-sm focus:border-brand-hr-primary focus:ring-1 focus:ring-brand-hr-primary"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-brand-hr-primary-muted">
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
                                className="w-full rounded-md border border-brand-hr-primary/25 bg-brand-hr-primary-contrast px-3 py-2 text-sm shadow-sm focus:border-brand-hr-primary focus:ring-1 focus:ring-brand-hr-primary"
                              />
                              {!readOnly ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChild(childIndex)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
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

                {section.key === "emergencia" ? (
                  <div className="space-y-3 rounded-xl border border-brand-hr-primary/15 bg-brand-hr-primary-soft/35 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-brand-hr-primary">
                          Contactos de emergencia
                        </p>
                        <p className="text-xs text-brand-hr-primary-muted">
                          Puedes registrar multiples contactos.
                        </p>
                      </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={handleAddEmergencyContact}
                          className="inline-flex items-center gap-2 rounded-md border border-brand-hr-primary/20 bg-brand-hr-primary-contrast px-3 py-1.5 text-xs font-semibold text-brand-hr-primary hover:bg-brand-hr-primary-soft"
                          aria-label="Agregar contacto de emergencia"
                        >
                          <FiPlus />
                          Agregar contacto
                        </button>
                      ) : null}
                    </div>

                    {emergencyContacts.length === 0 ? (
                      <p className="rounded-md border border-dashed border-brand-hr-primary/20 bg-brand-hr-primary-contrast px-3 py-2 text-xs text-brand-hr-primary-muted">
                        No hay contactos de emergencia registrados.
                      </p>
                    ) : (
                      emergencyContacts.map((contact, contactIndex) => (
                        <div
                          key={`emergency-${contactIndex}`}
                          className="grid grid-cols-1 gap-3 rounded-lg border border-brand-hr-primary/15 bg-brand-hr-primary-contrast p-3 sm:grid-cols-3"
                        >
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-brand-hr-primary-muted">
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
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-md border border-brand-hr-primary/25 bg-brand-hr-primary-contrast px-3 py-2 text-sm shadow-sm focus:border-brand-hr-primary focus:ring-1 focus:ring-brand-hr-primary"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-brand-hr-primary-muted">
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
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-md border border-brand-hr-primary/25 bg-brand-hr-primary-contrast px-3 py-2 text-sm shadow-sm focus:border-brand-hr-primary focus:ring-1 focus:ring-brand-hr-primary"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-brand-hr-primary-muted">
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
                                className="w-full rounded-md border border-brand-hr-primary/25 bg-brand-hr-primary-contrast px-3 py-2 text-sm shadow-sm focus:border-brand-hr-primary focus:ring-1 focus:ring-brand-hr-primary"
                              />
                              {!readOnly ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEmergencyContact(contactIndex)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
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
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-xl border border-brand-hr-primary/15 bg-brand-hr-primary-contrast/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-brand-hr-primary-muted">
          Etapa del flujo: <span className="font-semibold text-brand-hr-primary">{workflowStage || "no definida"}</span>
        </p>
        <button
          type="button"
          onClick={handleSaveWithFeedback}
          disabled={readOnly || loading || saving}
          aria-label="Guardar perfil del colaborador"
          tabIndex={10000}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-hr-primary px-4 py-2 text-sm font-semibold text-brand-hr-primary-contrast transition hover:bg-brand-hr-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiSave title="Icono de guardado de perfil" />
          {saving ? "Guardando..." : "Guardar perfil"}
        </button>
      </div>
    </div>
  );
};

export default PersonnelProfile;
