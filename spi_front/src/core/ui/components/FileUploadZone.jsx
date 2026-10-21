/**
 * FileUploadZone
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained file upload area with three visual states:
 *   1. idle        — dashed drop zone with CTA
 *   2. file-ready  — selected file preview with remove option
 *   3. uploaded    — success card with document link
 *
 * Props
 * ─────
 *   id            string   – unique id for the hidden <input>
 *   accept        string   – MIME / extension filter  e.g. ".pdf,.docx"
 *   label         string   – action label ("Subir contrato firmado")
 *   description   string   – helper text below label  e.g. "PDF — máx. 10 MB"
 *   file          File     – currently selected File object (controlled)
 *   onFileChange  fn(File|null) – called when the user picks or removes a file
 *   onUpload      fn()     – called when the upload button is clicked
 *   uploading     bool     – show spinner + disable button
 *   disabled      bool     – prevents picking a new file (zone grayed out)
 *   uploadedLink  string   – when set, renders the success state
 *   uploadedLabel string   – label shown in the success card (default "Archivo cargado")
 *   uploadedAt    string   – optional ISO timestamp shown in the success card
 *   errorMessage  string   – in-zone error message
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useRef, useState } from 'react';
import {
  FiUpload,
  FiFile,
  FiCheckCircle,
  FiLoader,
  FiX,
  FiExternalLink,
  FiAlertCircle,
} from 'react-icons/fi';

/* ── helpers ────────────────────────────────────────────────────────────── */
function humanSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(file) {
  if (!file) return null;
  const ext = file.name?.split('.').pop()?.toLowerCase();
  const colors = {
    pdf:  'text-red-500  bg-red-50',
    doc:  'text-action-blue bg-blue-50',
    docx: 'text-action-blue bg-blue-50',
    xls:  'text-operative-green bg-green-50',
    xlsx: 'text-operative-green bg-green-50',
    png:  'text-caution-amber bg-amber-50',
    jpg:  'text-caution-amber bg-amber-50',
    jpeg: 'text-caution-amber bg-amber-50',
  };
  return colors[ext] || 'text-warm-ash bg-fog';
}

/* ── component ──────────────────────────────────────────────────────────── */
const FileUploadZone = ({
  id,
  accept = '.pdf,.doc,.docx',
  label = 'Seleccionar archivo',
  description,
  file,
  onFileChange,
  onUpload,
  uploading = false,
  disabled = false,
  uploadedLink,
  uploadedLabel = 'Archivo cargado',
  uploadedAt,
  errorMessage,
}) => {
  const inputRef     = useRef(null);
  const [dragging, setDragging] = useState(false);

  /* ── already uploaded — success state ─────────────────────────────────── */
  if (uploadedLink) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="p-2 rounded-xl bg-operative-green/10 shrink-0">
          <FiCheckCircle className="text-operative-green" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-operative-green leading-tight">{uploadedLabel}</p>
          {uploadedAt && (
            <p className="text-[11px] text-warm-ash mt-0.5">
              Subido: {new Date(uploadedAt).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          )}
        </div>
        <a
          href={uploadedLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-green-200 text-xs font-semibold text-operative-green hover:bg-green-100 transition-colors shrink-0"
        >
          <FiExternalLink size={12} />
          Ver
        </a>
      </div>
    );
  }

  /* ── event handlers ────────────────────────────────────────────────────── */
  const handleInputChange = (e) => {
    const picked = e.target.files?.[0] ?? null;
    onFileChange?.(picked);
    e.target.value = '';           // reset so re-picking same file triggers change
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) onFileChange?.(dropped);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled && !uploading) setDragging(true);
  };

  /* ── file selected ─────────────────────────────────────────────────────── */
  if (file) {
    const iconClass = fileIcon(file);
    return (
      <div className="space-y-3">
        {/* file preview card */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
          errorMessage ? 'border-alert-red bg-red-50' : 'border-soft-border bg-paper-white'
        }`}>
          <div className={`p-2 rounded-xl shrink-0 ${iconClass}`}>
            <FiFile size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-slate truncate leading-tight">{file.name}</p>
            <p className="text-[11px] text-warm-ash mt-0.5">{humanSize(file.size)}</p>
          </div>
          {!uploading && (
            <button
              type="button"
              onClick={() => onFileChange?.(null)}
              className="p-1.5 rounded-lg text-warm-ash hover:text-alert-red hover:bg-red-50 transition-colors shrink-0"
              title="Quitar archivo"
            >
              <FiX size={14} />
            </button>
          )}
        </div>

        {/* inline error */}
        {errorMessage && (
          <div className="flex items-start gap-2 text-xs text-alert-red">
            <FiAlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* upload button */}
        <button
          type="button"
          onClick={onUpload}
          disabled={uploading || disabled}
          className="w-full min-h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-action-blue text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition"
        >
          {uploading ? (
            <>
              <FiLoader className="animate-spin" size={14} />
              Subiendo…
            </>
          ) : (
            <>
              <FiUpload size={14} />
              {label}
            </>
          )}
        </button>
      </div>
    );
  }

  /* ── empty / drop zone ─────────────────────────────────────────────────── */
  const isInteractive = !disabled && !uploading;
  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
        disabled={!isInteractive}
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onClick={() => isInteractive && inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
          px-4 py-8 text-center transition-all duration-150
          ${isInteractive ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
          ${dragging
            ? 'border-action-blue bg-blue-50 scale-[1.01]'
            : isInteractive
            ? 'border-slate-200 bg-paper-white hover:border-action-blue hover:bg-blue-50/40'
            : 'border-slate-200 bg-fog'
          }
        `}
      >
        <div className={`p-3 rounded-2xl transition-colors ${dragging ? 'bg-action-blue/10 text-action-blue' : 'bg-fog text-warm-ash'}`}>
          <FiUpload size={22} />
        </div>

        <div>
          <p className={`text-sm font-semibold transition-colors ${dragging ? 'text-action-blue' : 'text-ink-slate'}`}>
            {dragging ? 'Suelta el archivo aquí' : 'Arrastrá o hacé clic para seleccionar'}
          </p>
          {description && (
            <p className="text-xs text-warm-ash mt-1">{description}</p>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 text-xs text-alert-red">
          <FiAlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;
