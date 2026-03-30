import React, { useMemo } from "react";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import Modal from "../../../../core/ui/components/Modal";

const PDF_WORKER_URL = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

const resolveDocumentUrl = (document) =>
  document?.signed_url ||
  document?.download_url ||
  document?.url ||
  document?.file_url ||
  document?.drive_url ||
  "";

const isGoogleDriveUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return /(^|\.)drive\.google\.com$/i.test(parsed.hostname);
  } catch (_error) {
    return false;
  }
};

const extractDriveFileId = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get("id");
    if (fromQuery) return fromQuery;
    const match = parsed.pathname.match(/\/file\/d\/([^/]+)/i);
    return match?.[1] || null;
  } catch (_error) {
    return null;
  }
};

const isPdfDocument = (document, url) => {
  const mimeType = String(document?.mime_type || document?.content_type || "").toLowerCase();
  if (mimeType.includes("pdf")) return true;
  return /\.pdf(?:$|\?)/i.test(url);
};

const isImageDocument = (document, url) => {
  const mimeType = String(document?.mime_type || document?.content_type || "").toLowerCase();
  if (mimeType.includes("image/")) return true;
  return /\.(png|jpg|jpeg|webp)(?:$|\?)/i.test(url);
};

const DocumentPreviewModal = ({ open, onPreviewClose, onClose, document }) => {
  const handlePreviewClose = onPreviewClose || onClose;
  const previewUrl = useMemo(() => resolveDocumentUrl(document), [document]);
  const isDriveUrl = useMemo(() => isGoogleDriveUrl(previewUrl), [previewUrl]);
  const driveFileId = useMemo(() => extractDriveFileId(previewUrl), [previewUrl]);
  const driveOpenUrl = useMemo(() => {
    if (!driveFileId) return previewUrl;
    return `https://drive.google.com/file/d/${driveFileId}/view`;
  }, [driveFileId, previewUrl]);
  const isPdf = useMemo(() => isPdfDocument(document, previewUrl), [document, previewUrl]);
  const isImage = useMemo(() => isImageDocument(document, previewUrl), [document, previewUrl]);
  const title = document?.displayLabel || document?.doc_type || "Previsualizacion de documento";

  return (
    <Modal open={open} onClose={handlePreviewClose} title={title} maxWidth="max-w-6xl">
      {!previewUrl ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-brand-hr-primary/15 bg-brand-hr-primary-soft/40 p-6 text-sm text-brand-hr-primary-muted">
          No existe un enlace valido para previsualizar este documento.
        </div>
      ) : null}

      {previewUrl && isDriveUrl ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Google Drive no permite previsualizacion embebida dentro de SPI por politicas CSP.
            Abre el archivo en una pestaña nueva para visualizarlo.
          </div>
          <a
            href={driveOpenUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir archivo en Google Drive"
            className="inline-flex rounded-lg border border-brand-hr-primary/25 bg-brand-hr-primary-contrast px-4 py-2 text-sm font-semibold text-brand-hr-primary transition hover:bg-brand-hr-primary-soft"
          >
            Abrir en Google Drive
          </a>
        </div>
      ) : null}

      {previewUrl && !isDriveUrl && isPdf ? (
        <div className="h-[72vh] overflow-hidden rounded-2xl border border-brand-hr-primary/15 bg-white">
          <Worker workerUrl={PDF_WORKER_URL}>
            <Viewer fileUrl={previewUrl} />
          </Worker>
        </div>
      ) : null}

      {previewUrl && !isDriveUrl && !isPdf && isImage ? (
        <div className="flex max-h-[72vh] min-h-[260px] items-center justify-center overflow-auto rounded-2xl border border-brand-hr-primary/15 bg-brand-hr-primary-soft/20 p-3">
          <img
            src={previewUrl}
            alt={title}
            className="max-h-[68vh] w-auto max-w-full rounded-xl object-contain"
          />
        </div>
      ) : null}

      {previewUrl && !isDriveUrl && !isPdf && !isImage ? (
        <div className="space-y-4 rounded-2xl border border-brand-hr-primary/15 bg-brand-hr-primary-soft/20 p-6">
          <p className="text-sm text-brand-hr-primary-muted">
            Este tipo de archivo no tiene preview embebido. Puedes abrirlo en una nueva pestaña.
          </p>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir documento en nueva pestaña"
            className="inline-flex rounded-lg border border-brand-hr-primary/25 bg-brand-hr-primary-contrast px-4 py-2 text-sm font-semibold text-brand-hr-primary transition hover:bg-brand-hr-primary-soft"
          >
            Abrir documento
          </a>
        </div>
      ) : null}
    </Modal>
  );
};

export default DocumentPreviewModal;
