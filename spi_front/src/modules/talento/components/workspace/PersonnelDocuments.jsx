import React, { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { FiChevronDown, FiEye, FiFileText, FiUploadCloud } from "react-icons/fi";
import { checklistSections, documentTypes } from "../collaboratorProfileDefinitions";
import DocumentPreviewModal from "./DocumentPreviewModal";

const ACCEPTED_DOCUMENT_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

const DOCUMENT_GROUPS = {
  profile: {
    title: "Documentos originados en Mi Perfil",
    description:
      "Agrupa los documentos que el colaborador carga desde Mi Perfil y que se sincronizan automaticamente con el expediente central de Talento Humano.",
  },
  contracts: {
    title: "Contratos obligatorios de ingreso",
    description:
      "Incluye los contratos obligatorios del ingreso laboral: Contrato FAM y Contrato MDT, ambos controlados por Talento Humano.",
  },
  induction: {
    title: "Documentos de induccion y firmas",
    description:
      "Concentra los soportes de induccion, accion de personal, registro de induccion y control de firmas del colaborador.",
  },
  talento_humano: {
    title: "Documentos gestionados por Talento Humano",
    description:
      "Reune los documentos que Talento Humano administra directamente dentro del expediente laboral del colaborador.",
  },
  financiero: {
    title: "Documentos gestionados por Financiero",
    description:
      "Muestra los documentos financieros del expediente que solo pueden ser controlados por el area financiera.",
  },
  automatico: {
    title: "Actas integradas automaticamente",
    description:
      "Muestra las actas integradas desde Activos TI y Entregas de Colaboradores. Estas actas se visualizan aqui y no se cargan manualmente.",
  },
};

const resolveDocumentUrl = (document) =>
  document?.signed_url ||
  document?.download_url ||
  document?.url ||
  document?.file_url ||
  document?.drive_url ||
  "";

const resolveDocumentType = (document) =>
  document?.canonical_doc_type || document?.doc_type || "";

const resolveIntegrationStatus = (document) =>
  String(document?.integration_status || "").trim().toLowerCase();

const DocumentCard = ({
  definition,
  existingDoc,
  locked,
  readOnly,
  isUploading,
  uploadPercent,
  onDocumentUpload,
  onUpload,
  onDocumentPreview,
  onPreview,
}) => {
  const handleDocumentUpload = onDocumentUpload || onUpload;
  const handleDocumentPreview = onDocumentPreview || onPreview;
  const disabled = locked || readOnly || isUploading;
  const previewUrl = resolveDocumentUrl(existingDoc);
  const isAutomatic =
    String(definition?.ownerArea || "").trim().toLowerCase() === "automatico";
  const integrationStatus = resolveIntegrationStatus(existingDoc);
  const isSignedAutomatic = isAutomatic && integrationStatus === "signed";
  const isDraftAutomatic = isAutomatic && integrationStatus === "draft";
  const uploadDisabled = disabled || isAutomatic;

  const onDropAccepted = useCallback(
    (acceptedFiles) => {
      const nextFile = acceptedFiles?.[0];
      if (!nextFile) return;
      handleDocumentUpload?.(definition.key, nextFile);
    },
    [definition.key, handleDocumentUpload],
  );

  const onDropRejected = useCallback(() => {
    toast.error("Archivo invalido. Solo se permiten archivos PDF, JPG o PNG.");
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDropAccepted,
    onDropRejected,
    accept: ACCEPTED_DOCUMENT_TYPES,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    disabled: uploadDisabled,
  });

  return (
    <motion.div
      {...getRootProps()}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
        existingDoc
          ? "border-hr-success/30 bg-hr-success-soft/30"
          : "border-brand-hr-primary/15 bg-brand-hr-primary-contrast hover:border-brand-hr-primary/35"
      }`}
    >
      <input {...getInputProps()} />

      {isDragActive && !disabled ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-brand-hr-primary bg-brand-hr-primary/10">
          <p className="rounded-full bg-brand-hr-primary px-4 py-2 text-xs font-semibold text-brand-hr-primary-contrast">
            Soltar para subir
          </p>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-start justify-between">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              existingDoc
                ? "bg-hr-success-soft text-hr-success"
                : "bg-brand-hr-primary-soft text-brand-hr-primary-muted"
            }`}
          >
            <FiFileText size={18} title="Icono de documento" />
          </div>
          {existingDoc ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isSignedAutomatic
                  ? "bg-hr-success-soft text-hr-success-muted"
                  : isDraftAutomatic
                    ? "bg-amber-100 text-amber-700"
                    : "bg-hr-success-soft text-hr-success-muted"
              }`}
            >
              {isSignedAutomatic ? "FIRMADA" : isDraftAutomatic ? "BORRADOR" : "SUBIDO"}
            </span>
          ) : null}
        </div>

        <h5 className="mb-1 text-xs font-semibold leading-tight text-brand-hr-primary">
          {definition.label}
        </h5>
        <p className="text-[10px] text-brand-hr-primary-muted">
          {existingDoc
            ? isSignedAutomatic
              ? `Acta firmada el ${new Date(
                  existingDoc.signed_at || existingDoc.uploaded_at || Date.now(),
                ).toLocaleDateString()}`
              : isDraftAutomatic
                ? `Borrador generado el ${new Date(
                    existingDoc.generated_at || existingDoc.uploaded_at || Date.now(),
                  ).toLocaleDateString()}`
                : `Subido el ${new Date(
                    existingDoc.uploaded_at || Date.now(),
                  ).toLocaleDateString()}`
            : isAutomatic
              ? "Pendiente de recepcion desde el modulo de origen"
              : "Pendiente de carga documental"}
        </p>
        {isAutomatic && !existingDoc ? (
          <p className="mt-2 text-[10px] text-brand-hr-primary-muted">
            Este documento debe generarse o sincronizarse desde el modulo origen correspondiente.
          </p>
        ) : null}
        {isDraftAutomatic && !previewUrl ? (
          <p className="mt-2 text-[10px] text-brand-hr-primary-muted">
            El borrador ya existe en el modulo origen, pero todavia no expone un enlace disponible para consulta.
          </p>
        ) : null}

        {isUploading ? (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-medium text-brand-hr-primary-muted">
              <span>Subiendo...</span>
              <span>{uploadPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-brand-hr-primary-soft">
              <div
                className="h-full rounded-full bg-brand-hr-primary transition-all"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {existingDoc ? (
          <div className="flex flex-wrap items-stretch gap-2">
            <button
              type="button"
              onClick={() =>
                handleDocumentPreview?.({
                  ...existingDoc,
                  displayLabel: definition.label,
                })
              }
              aria-label={`Previsualizar documento ${definition.label}`}
              title="Previsualizar"
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-brand-hr-primary/20 bg-brand-hr-primary-contrast px-3 py-1.5 text-xs font-medium text-brand-hr-primary transition hover:bg-brand-hr-primary-soft"
            >
              <FiEye className="h-4 w-4 shrink-0" title="Icono de previsualizacion" />
              <span className="min-w-0 truncate max-[430px]:hidden">
                {isSignedAutomatic ? "Ver firmada" : isDraftAutomatic ? "Ver borrador" : "Previsualizar"}
              </span>
            </button>
            {!uploadDisabled && !isAutomatic ? (
              <button
                type="button"
                onClick={open}
                aria-label={`Reemplazar documento ${definition.label}`}
                title="Reemplazar"
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-brand-hr-primary/20 bg-brand-hr-primary-contrast px-3 py-1.5 text-xs font-medium text-brand-hr-primary-muted transition hover:bg-brand-hr-primary-soft"
              >
                <FiUploadCloud
                  className="h-4 w-4 shrink-0"
                  title="Icono de reemplazo de documento"
                />
                <span className="min-w-0 truncate max-[430px]:hidden">
                  Reemplazar
                </span>
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={open}
            disabled={uploadDisabled}
            aria-label={`Subir documento ${definition.label}`}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-xs font-medium transition ${
              uploadDisabled
                ? "cursor-not-allowed border-brand-hr-primary/15 bg-brand-hr-primary-soft text-brand-hr-primary-muted/80"
                : "cursor-pointer border-brand-hr-primary/30 bg-brand-hr-primary-contrast text-brand-hr-primary-muted hover:border-brand-hr-primary hover:bg-brand-hr-primary-soft hover:text-brand-hr-primary"
            }`}
          >
              <FiUploadCloud title="Icono para cargar documento" />
            {isAutomatic ? "Pendiente por integracion" : "Cargar PDF o imagen"}
          </button>
        )}

        {previewUrl && !existingDoc?.drive_url ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-[10px] font-medium text-brand-hr-primary-muted underline"
          >
            Abrir archivo en una nueva pestana
          </a>
        ) : null}
      </div>
    </motion.div>
  );
};

const GroupGrid = ({
  items,
  getDocStatus,
  isLocked,
  uploadingDocKey,
  uploadProgress,
  canUploadDocument,
  readOnly,
  handleDocumentUpload,
  handleDocumentPreview,
}) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {items.map((docType) => {
      const existingDoc = getDocStatus(docType.key);
      const locked = isLocked(docType.key);
      const isUploading = uploadingDocKey === docType.key;
      const uploadPercent = Number(uploadProgress?.[docType.key] || 0);
      const uploadAllowed =
        typeof canUploadDocument === "function" ? canUploadDocument(docType) : true;

      return (
        <DocumentCard
          key={docType.key}
          definition={docType}
          existingDoc={existingDoc}
          locked={locked}
          readOnly={readOnly || !uploadAllowed}
          isUploading={isUploading}
          uploadPercent={uploadPercent}
          onDocumentUpload={handleDocumentUpload}
          onDocumentPreview={handleDocumentPreview}
        />
      );
    })}
  </div>
);

const PersonnelDocuments = ({
  documents,
  onDocumentUpload,
  onUpload,
  onDocumentPreview,
  uploadingDocKey,
  uploadProgress = {},
  lockedSections = [],
  documentDefinitions = documentTypes,
  canUploadDocument,
  readOnly = false,
}) => {
  const [previewDocument, setPreviewDocument] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState([]);
  const handleDocumentUpload = onDocumentUpload || onUpload;
  const handleDocumentPreview = onDocumentPreview || setPreviewDocument;

  const getDocStatus = useCallback(
    (docKey) => documents.find((doc) => resolveDocumentType(doc) === docKey),
    [documents],
  );

  const isLocked = useCallback(
    (docKey) => {
      const section = checklistSections.find((itemSection) =>
        itemSection.items.some(
          (item) => item.type === "doc" && item.docType === docKey,
        ),
      );
      return section ? lockedSections.includes(section.title) : false;
    },
    [lockedSections],
  );

  const uploadedCount = useMemo(
    () => documentDefinitions.filter((docType) => getDocStatus(docType.key)).length,
    [documentDefinitions, getDocStatus],
  );
  const totalCount = documentDefinitions.length;
  const percent =
    totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;

  const groupedDefinitions = useMemo(() => {
    const groups = new Map();
    documentDefinitions.forEach((definition) => {
      const groupKey = definition?.group || definition?.ownerArea || "talento_humano";
      const current = groups.get(groupKey) || [];
      current.push(definition);
      groups.set(groupKey, current);
    });

    return Array.from(groups.entries()).map(([groupKey, items]) => {
      const meta = DOCUMENT_GROUPS[groupKey] || {
        title: "Documentos",
        description: "Bloque documental del expediente central.",
      };
      const done = items.filter((item) => getDocStatus(item.key)).length;
      return {
        groupKey,
        meta,
        items,
        done,
        total: items.length,
      };
    });
  }, [documentDefinitions, getDocStatus]);
  const toggleGroup = useCallback((groupKey) => {
    setExpandedGroups((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey],
    );
  }, []);

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
            <h3 className="text-sm font-semibold text-brand-hr-primary">
              Avance documental del expediente
            </h3>
            <p className="text-xs text-brand-hr-primary-muted">
              {uploadedCount} de {totalCount} documentos visibles ya tienen un archivo registrado en el expediente
            </p>
          </div>
          <span className="rounded-full bg-brand-hr-primary-soft px-3 py-1 text-xs font-semibold text-brand-hr-primary">
            {percent}%
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-brand-hr-primary-soft">
          <div
            className="h-full rounded-full bg-brand-hr-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {documentDefinitions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No hay documentos visibles asignados a tu area dentro de este expediente.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedDefinitions.map(({ groupKey, meta, items, done, total }) => {
            const isExpanded = expandedGroups.includes(groupKey);

            return (
              <div
                key={groupKey}
                className="overflow-hidden rounded-2xl border border-brand-hr-primary/10 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(groupKey)}
                  aria-expanded={isExpanded}
                  aria-controls={`documents-group-${groupKey}`}
                  className="flex w-full cursor-pointer items-start justify-between gap-4 px-4 py-4 text-left transition hover:bg-brand-hr-primary-soft/20"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-hr-primary">{meta.title}</p>
                    <p className="mt-1 text-xs text-brand-hr-primary-muted">
                      {meta.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-brand-hr-primary-soft px-3 py-1 text-xs font-semibold text-brand-hr-primary">
                      {done}/{total}
                    </span>
                    <FiChevronDown
                      className={`h-4 w-4 shrink-0 text-brand-hr-primary-muted transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                <motion.div
                  id={`documents-group-${groupKey}`}
                  initial={false}
                  animate={{
                    height: isExpanded ? "auto" : 0,
                    opacity: isExpanded ? 1 : 0,
                  }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-slate-100 px-4 py-4">
                    <GroupGrid
                      items={items}
                      getDocStatus={getDocStatus}
                      isLocked={isLocked}
                      uploadingDocKey={uploadingDocKey}
                      uploadProgress={uploadProgress}
                      canUploadDocument={canUploadDocument}
                      readOnly={readOnly}
                      handleDocumentUpload={handleDocumentUpload}
                      handleDocumentPreview={handleDocumentPreview}
                    />
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      )}

      <DocumentPreviewModal
        open={Boolean(previewDocument)}
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </motion.div>
  );
};

export default PersonnelDocuments;
