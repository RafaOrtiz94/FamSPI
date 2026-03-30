import React, { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { FiEye, FiFileText, FiUploadCloud } from "react-icons/fi";
import { checklistSections, documentTypes } from "../collaboratorProfileDefinitions";
import DocumentPreviewModal from "./DocumentPreviewModal";

const ACCEPTED_DOCUMENT_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

const resolveDocumentUrl = (document) =>
  document?.signed_url ||
  document?.download_url ||
  document?.url ||
  document?.file_url ||
  document?.drive_url ||
  "";

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

  const onDropAccepted = useCallback(
    (acceptedFiles) => {
      const nextFile = acceptedFiles?.[0];
      if (!nextFile) return;
      handleDocumentUpload?.(definition.key, nextFile);
    },
    [definition.key, handleDocumentUpload],
  );

  const onDropRejected = useCallback(() => {
    toast.error("Archivo invalido. Solo se permite PDF, JPG o PNG.");
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDropAccepted,
    onDropRejected,
    accept: ACCEPTED_DOCUMENT_TYPES,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    disabled,
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
            <span className="rounded-full bg-hr-success-soft px-2 py-0.5 text-[10px] font-bold text-hr-success-muted">
              SUBIDO
            </span>
          ) : null}
        </div>

        <h5 className="mb-1 text-xs font-semibold leading-tight text-brand-hr-primary">
          {definition.label}
        </h5>
        <p className="text-[10px] text-brand-hr-primary-muted">
          {existingDoc
            ? `Subido el ${new Date(existingDoc.uploaded_at || Date.now()).toLocaleDateString()}`
            : "Pendiente"}
        </p>

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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleDocumentPreview?.({ ...existingDoc, displayLabel: definition.label })}
              aria-label={`Previsualizar documento ${definition.label}`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-brand-hr-primary/20 bg-brand-hr-primary-contrast px-3 py-1.5 text-xs font-medium text-brand-hr-primary transition hover:bg-brand-hr-primary-soft"
            >
              <FiEye title="Icono de previsualización" />
              Previsualizar
            </button>
            {!disabled ? (
              <button
                type="button"
                onClick={open}
                aria-label={`Reemplazar documento ${definition.label}`}
                className="inline-flex items-center justify-center rounded-md border border-brand-hr-primary/20 bg-brand-hr-primary-contrast px-3 py-1.5 text-xs font-medium text-brand-hr-primary-muted transition hover:bg-brand-hr-primary-soft"
              >
                Reemplazar
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={open}
            disabled={disabled}
            aria-label={`Subir documento ${definition.label}`}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-xs font-medium transition ${
              disabled
                ? "cursor-not-allowed border-brand-hr-primary/15 bg-brand-hr-primary-soft text-brand-hr-primary-muted/80"
                : "cursor-pointer border-brand-hr-primary/30 bg-brand-hr-primary-contrast text-brand-hr-primary-muted hover:border-brand-hr-primary hover:bg-brand-hr-primary-soft hover:text-brand-hr-primary"
            }`}
          >
            <FiUploadCloud title="Icono para cargar documento" />
            Subir PDF/IMG
          </button>
        )}

        {previewUrl && !existingDoc?.drive_url ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-[10px] font-medium text-brand-hr-primary-muted underline"
          >
            Abrir en nueva pestaña
          </a>
        ) : null}
      </div>
    </motion.div>
  );
};

const PersonnelDocuments = ({
  documents,
  onDocumentUpload,
  onUpload,
  onDocumentPreview,
  uploadingDocKey,
  uploadProgress = {},
  lockedSections = [],
  readOnly = false,
}) => {
  const [previewDocument, setPreviewDocument] = useState(null);
  const handleDocumentUpload = onDocumentUpload || onUpload;
  const handleDocumentPreview = onDocumentPreview || setPreviewDocument;

  const getDocStatus = useCallback(
    (docKey) => documents.find((doc) => doc.doc_type === docKey),
    [documents],
  );

  const isLocked = useCallback(
    (docKey) => {
      const section = checklistSections.find((itemSection) =>
        itemSection.items.some((item) => item.type === "doc" && item.docType === docKey),
      );
      return section ? lockedSections.includes(section.title) : false;
    },
    [lockedSections],
  );

  const uploadedCount = useMemo(
    () => documentTypes.filter((docType) => getDocStatus(docType.key)).length,
    [getDocStatus],
  );
  const totalCount = documentTypes.length;
  const percent = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;

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
            <h3 className="text-sm font-semibold text-brand-hr-primary">Progreso documental</h3>
            <p className="text-xs text-brand-hr-primary-muted">
              {uploadedCount} de {totalCount} documentos cargados
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {documentTypes.map((docType) => {
          const existingDoc = getDocStatus(docType.key);
          const locked = isLocked(docType.key);
          const isUploading = uploadingDocKey === docType.key;
          const uploadPercent = Number(uploadProgress?.[docType.key] || 0);

          return (
            <DocumentCard
              key={docType.key}
              definition={docType}
              existingDoc={existingDoc}
              locked={locked}
              readOnly={readOnly}
              isUploading={isUploading}
              uploadPercent={uploadPercent}
              onDocumentUpload={handleDocumentUpload}
              onDocumentPreview={handleDocumentPreview}
            />
          );
        })}
      </div>

      <DocumentPreviewModal
        open={Boolean(previewDocument)}
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </motion.div>
  );
};

export default PersonnelDocuments;
