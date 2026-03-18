import React from "react";
import { FiUploadCloud, FiFileText, FiCheck, FiDownload, FiTrash2 } from "react-icons/fi";
import { documentTypes, checklistSections } from "../collaboratorProfileDefinitions";

const PersonnelDocuments = ({
  documents,
  onUpload,
  onDelete, // Assuming we might want to delete docs eventually, though original didn't explicitly show it
  uploadingDocKey,
  lockedSections = [],
  readOnly = false,
}) => {
  const getDocStatus = (docKey) => {
    const doc = documents.find((d) => d.doc_type === docKey);
    return doc;
  };

  const isLocked = (docKey) => {
    const section = checklistSections.find((s) =>
      s.items.some((item) => item.type === "doc" && item.docType === docKey)
    );
    return section ? lockedSections.includes(section.title) : false;
  };

  const uploadedCount = documentTypes.filter((docType) => getDocStatus(docType.key)).length;
  const totalCount = documentTypes.length;
  const percent = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Progreso documental</h3>
            <p className="text-xs text-slate-500">
              {uploadedCount} de {totalCount} documentos cargados
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {percent}%
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {documentTypes.map((docType) => {
        const existingDoc = getDocStatus(docType.key);
        const locked = isLocked(docType.key);
        const isUploading = uploadingDocKey === docType.key;

        return (
          <div
            key={docType.key}
            className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
              existingDoc
                ? "border-blue-200 bg-blue-50/20"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div>
              <div className="mb-2 flex items-start justify-between">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    existingDoc ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <FiFileText size={18} />
                </div>
                {existingDoc && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    SUBIDO
                  </span>
                )}
              </div>
              <h5 className="mb-1 text-xs font-semibold text-gray-900 leading-tight">
                {docType.label}
              </h5>
              <p className="text-[10px] text-gray-500">
                {existingDoc
                  ? `Subido el ${new Date(existingDoc.uploaded_at || Date.now()).toLocaleDateString()}`
                  : "Pendiente"}
              </p>
            </div>

            <div className="mt-4">
              {existingDoc ? (
                <div className="flex gap-2">
                  <a
                    href={existingDoc.drive_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-center text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    Ver archivo
                  </a>
                  {/* Delete button could go here if implemented */}
                </div>
              ) : (
                <label
                  className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium transition ${
                    locked || readOnly || isUploading
                      ? "cursor-not-allowed bg-gray-50 text-gray-400"
                      : "hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 text-gray-600"
                  }`}
                >
                  {isUploading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  ) : (
                    <>
                      <FiUploadCloud />
                      <span>Subir PDF/IMG</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={locked || readOnly || isUploading}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        onUpload(docType.key, e.target.files[0]);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default PersonnelDocuments;
