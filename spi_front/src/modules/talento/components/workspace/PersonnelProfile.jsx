import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { PatternFormat } from "react-number-format";
import { FiChevronDown, FiChevronUp, FiSave } from "react-icons/fi";
import useLocalDraft from "../../hooks/useLocalDraft";
import { profileSections } from "../collaboratorProfileDefinitions";

const MASK_FORMATS = {
  cedula: "##########",
  ruc: "#############",
  phone: "### ### ####",
};

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

  const handleChange = useCallback(
    (sectionKey, fieldKey, value) => {
      handleProfileFieldChange?.(sectionKey, fieldKey, value);
    },
    [handleProfileFieldChange],
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

    toast.success("Borrador local restaurado.");
  }, [handleChange, restoreDraft]);

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
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
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

                      {hasError ? <p className="text-[10px] text-hr-warning-muted">{errors[fieldPath]}</p> : null}
                    </div>
                  );
                })}
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
