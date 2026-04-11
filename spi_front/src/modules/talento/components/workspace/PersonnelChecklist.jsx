import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  FiCheck,
  FiCheckSquare,
  FiFile,
  FiLoader,
  FiSquare,
  FiUploadCloud,
} from "react-icons/fi";
import { checklistSections } from "../collaboratorProfileDefinitions";

const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const CHECKLIST_ROLE_RULES = {
  computadora_entregada: ["ti", "jefe_ti"],
  salida_equipos: ["ti", "jefe_ti"],
  salida_cuentas: ["ti", "jefe_ti"],
  salida_sri: ["talento_humano", "jefe_talento_humano"],
  liquidacion: ["jefe_financiero", "jefe_talento_humano"],
  eliminacion_accesos_sistemas: ["ti", "jefe_ti"],
  liquidacion_mdt_finiquito: ["jefe_financiero", "jefe_talento_humano"],
  cambio_estado_activo_pasivo: ["talento_humano", "jefe_talento_humano"],
};

const formatRoleRuleLabel = (roles = []) =>
  roles.map((role) => role.replace(/_/g, " ")).join(" / ");

const PersonnelChecklist = ({
  profileData,
  documents = [],
  onChecklistFlagToggle,
  onToggleFlag,
  onDocumentUpload,
  onUpload,
  uploadingDocKey,
  lockedSections = [],
  readOnly = false,
  userRole = "",
  checklistMode = "all",
}) => {
  const handleChecklistFlagToggle = onChecklistFlagToggle || onToggleFlag;
  const handleDocumentUpload = onDocumentUpload || onUpload;
  const normalizedRole = normalizeRole(userRole);

  const visibleSections = useMemo(() => {
    if (checklistMode === "exit") {
      return checklistSections.filter((section) => String(section?.title || "").toLowerCase().includes("salida"));
    }
    if (checklistMode === "entry") {
      return checklistSections.filter((section) => !String(section?.title || "").toLowerCase().includes("salida"));
    }
    return checklistSections;
  }, [checklistMode]);

  const isDocUploaded = (docKey) => documents.some((doc) => doc.doc_type === docKey);

  const getOverallCompletion = () => {
    let total = 0;
    let done = 0;
    visibleSections.forEach((section) => {
      section.items.forEach((item) => {
        total += 1;
        const isChecked =
          item.type === "doc"
            ? isDocUploaded(item.docType)
            : Boolean(profileData?.onboarding?.[item.flagKey]);
        if (isChecked) done += 1;
      });
    });
    return {
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  };

  const getSectionStatus = (section) => {
    const total = section.items.length;
    let done = 0;
    section.items.forEach((item) => {
      if (item.type === "doc") {
        if (isDocUploaded(item.docType)) done += 1;
      } else if (profileData?.onboarding?.[item.flagKey]) {
        done += 1;
      }
    });
    return { total, done, complete: total > 0 && done === total };
  };

  const overall = getOverallCompletion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-brand-hr-primary/15 bg-brand-hr-primary-contrast p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-brand-hr-primary">Progreso del checklist</h3>
            <p className="text-xs text-brand-hr-primary-muted">
              {overall.done} de {overall.total} validaciones completadas
            </p>
          </div>
          <span className="rounded-full bg-brand-hr-primary-soft px-3 py-1 text-xs font-semibold text-brand-hr-primary">
            {overall.percent}%
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-brand-hr-primary-soft">
          <div
            className="h-full rounded-full bg-brand-hr-primary transition-all"
            style={{ width: `${overall.percent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleSections.map((section, sectionIndex) => {
          const { total, done, complete } = getSectionStatus(section);
          const isLocked = lockedSections.includes(section.title);
          const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(sectionIndex * 0.03, 0.18), ease: "easeOut" }}
              className={`flex flex-col rounded-xl border p-4 transition-all ${
                complete
                  ? "border-hr-success/30 bg-hr-success-soft/40"
                  : "border-brand-hr-primary/15 bg-brand-hr-primary-contrast"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-brand-hr-primary">{section.title}</h4>
                  <p className="text-[10px] text-brand-hr-primary-muted">
                    {done} / {total} completado
                  </p>
                </div>
                {complete ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-hr-success-soft text-hr-success">
                    <FiCheck size={14} title="Icono de sección completada" />
                  </div>
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-hr-primary-soft text-brand-hr-primary-muted">
                    <span className="text-[10px] font-bold">{progressPercent}%</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                {section.items.map((item) => {
                  const isDoc = item.type === "doc";
                  const roleRule = !isDoc ? CHECKLIST_ROLE_RULES[item.flagKey] : null;
                  const canToggleByRole =
                    !roleRule || roleRule.some((role) => normalizeRole(role) === normalizedRole);
                  const isChecked = isDoc
                    ? isDocUploaded(item.docType)
                    : Boolean(profileData?.onboarding?.[item.flagKey]);

                  return (
                    <div
                      key={isDoc ? item.docType : item.flagKey}
                      className={`flex items-start gap-2 text-xs ${
                        isChecked ? "text-brand-hr-primary" : "text-brand-hr-primary-muted"
                      }`}
                    >
                      {isDoc ? (
                        <div className="flex w-full items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <FiFile
                              className={`mt-0.5 shrink-0 ${
                                isChecked ? "text-brand-hr-primary" : "text-brand-hr-primary-muted/60"
                              }`}
                              title="Icono de documento requerido"
                            />
                            <span className="text-brand-hr-primary">{item.label}</span>
                          </div>

                          {!isChecked && !readOnly && !isLocked ? (
                            <div className="relative">
                              <input
                                type="file"
                                className="absolute inset-0 cursor-pointer opacity-0"
                                onChange={(event) => handleDocumentUpload?.(item.docType, event.target.files?.[0])}
                                disabled={uploadingDocKey === item.docType}
                                aria-label={`Subir documento ${item.label}`}
                              />
                              <button
                                type="button"
                                aria-label={`Subir documento ${item.label}`}
                                className="flex items-center gap-1 rounded-md bg-brand-hr-primary-soft px-2 py-1 text-[10px] font-medium text-brand-hr-primary hover:bg-brand-hr-primary/10 disabled:opacity-50"
                              >
                                {uploadingDocKey === item.docType ? (
                                  <FiLoader className="animate-spin" title="Icono de carga de documento" />
                                ) : (
                                  <FiUploadCloud title="Icono para subir documento" />
                                )}
                                Subir
                              </button>
                            </div>
                          ) : null}

                          {isChecked ? (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-hr-success">
                              <FiCheck title="Icono de documento cargado" /> Cargado
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              !isLocked &&
                              !readOnly &&
                              canToggleByRole &&
                              handleChecklistFlagToggle?.(item.flagKey)
                            }
                            disabled={isLocked || readOnly || !canToggleByRole}
                            aria-label={`${isChecked ? "Desmarcar" : "Marcar"} item ${item.label}`}
                            className={`mt-0.5 shrink-0 focus:outline-none ${
                              isLocked || readOnly || !canToggleByRole
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer"
                            }`}
                          >
                            {isChecked ? (
                              <FiCheckSquare className="text-brand-hr-primary" title="Icono de item marcado" />
                            ) : (
                              <FiSquare className="text-brand-hr-primary-muted/70 hover:text-brand-hr-primary-muted" title="Icono de item pendiente" />
                            )}
                          </button>
                          <span className={isChecked ? "font-medium text-brand-hr-primary" : ""}>
                            {item.label}
                          </span>
                          {!canToggleByRole && roleRule ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              Solo {formatRoleRuleLabel(roleRule)}
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default PersonnelChecklist;
