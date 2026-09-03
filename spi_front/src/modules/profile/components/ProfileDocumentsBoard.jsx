import React, { useEffect, useMemo, useState } from "react";
import { FiEye, FiFileText, FiUploadCloud } from "react-icons/fi";
import { useUI } from "../../../core/ui/UIContext";
import {
 listMyProfileDocuments,
 uploadMyProfileDocument,
} from "../../../core/api/userProfileApi";
import { documentTypes } from "../../talento/components/collaboratorProfileDefinitions";

const ACCEPTED_MIME_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";
const OPTIONAL_PROFILE_DOCUMENTS = new Set([
 "PASSPORT",
 "MARRIAGE_CERTIFICATE",
 "CHILD_BIRTH_CERTIFICATE",
]);

const PROFILE_DOCUMENT_DEFINITIONS = documentTypes.filter(
 (document) =>
  String(document?.ownerArea || "").trim().toLowerCase() === "profile" &&
  String(document?.key || "").trim().toUpperCase() !== "SENESCYT_RECORD",
).map((document) => ({
 key: document.key,
 label: document.label,
 required: !OPTIONAL_PROFILE_DOCUMENTS.has(String(document.key || "").trim().toUpperCase()),
}));

const resolveDocumentUrl = (document) =>
 document?.drive_url || document?.file_url || document?.url || "";

const resolveDocumentType = (document) =>
 String(document?.canonical_doc_type || document?.doc_type || "")
  .trim()
  .toUpperCase();

const ProfileDocumentsBoard = () => {
 const { showToast, showLoader, hideLoader } = useUI();
 const [documents, setDocuments] = useState([]);
 const [loading, setLoading] = useState(true);
 const [uploadingKey, setUploadingKey] = useState("");

 const documentsByType = useMemo(() => {
 return documents.reduce((acc, document) => {
 const key = resolveDocumentType(document);
 if (!key || acc[key]) return acc;
 acc[key] = document;
 return acc;
 }, {});
 }, [documents]);

 const completion = useMemo(() => {
 const total = PROFILE_DOCUMENT_DEFINITIONS.length;
 const done = PROFILE_DOCUMENT_DEFINITIONS.filter(
 (item) => documentsByType[item.key],
 ).length;
 return {
 total,
 done,
 percent: total > 0 ? Math.round((done / total) * 100) : 0,
 };
 }, [documentsByType]);

 const loadDocuments = async ({ silent = false } = {}) => {
 try {
 if (!silent) {
 setLoading(true);
 showLoader();
 }
 const data = await listMyProfileDocuments();
 setDocuments(data);
 } catch (error) {
 console.error(error);
 showToast(
 error?.message || "No se pudieron cargar los documentos del perfil",
 "error",
 );
 } finally {
 if (!silent) {
 setLoading(false);
 hideLoader();
 }
 }
 };

 useEffect(() => {
 loadDocuments();
 }, []); // eslint-disable-line react-hooks/exhaustive-deps

 const handleUpload = async (docType, file) => {
 if (!file) return;
 try {
 setUploadingKey(docType);
 showLoader();
 const response = await uploadMyProfileDocument(docType, file);
 setDocuments(Array.isArray(response?.documents) ? response.documents : []);
 showToast("Documento cargado correctamente", "success");
 } catch (error) {
 console.error(error);
 showToast(error?.message || "No se pudo subir el documento", "error");
 } finally {
 setUploadingKey("");
 hideLoader();
 }
 };

 return (
 <div className="space-y-4">
 <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h3 className="text-lg font-semibold text-slate-900">
 Documentos del perfil
 </h3>
 <p className="text-sm text-slate-600">
 Estos archivos alimentan directamente el expediente central de Talento Humano.
 </p>
 </div>
 <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
 {completion.done}/{completion.total} cargados
 </span>
 </div>

 <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
 <div
 className="h-full rounded-full bg-blue-600 transition-all duration-200 ease-out"
 style={{ width: `${completion.percent}%` }}
 />
 </div>
 </div>

 {loading ? (
 <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
 Cargando documentos...
 </div>
 ) : (
 <div className="grid gap-4 md:grid-cols-2">
 {PROFILE_DOCUMENT_DEFINITIONS.map((definition) => {
 const current = documentsByType[definition.key];
 const documentUrl = resolveDocumentUrl(current);
 const isUploading = uploadingKey === definition.key;

 return (
 <div
 key={definition.key}
 className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-start gap-3">
 <div className="rounded-2xl bg-slate-100 p-2 text-slate-600">
 <FiFileText size={18} />
 </div>
 <div>
 <p className="text-sm font-semibold text-slate-900">
 {definition.label}
 </p>
 <p className="text-xs text-slate-500">
 {definition.required ? "Obligatorio" : "Opcional"}
 </p>
 </div>
 </div>
 <span
 className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
 current
 ? "bg-emerald-100 text-emerald-700"
 : "bg-amber-100 text-amber-700"
 }`}
 >
 {current ? "Cargado" : "Pendiente"}
 </span>
 </div>

 <div className="mt-4 flex flex-wrap gap-2">
 <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-all duration-150 ease-out hover:bg-blue-700 active:scale-[0.97]">
 <FiUploadCloud size={16} />
 {isUploading ? "Subiendo..." : current ? "Reemplazar" : "Subir"}
 <input
 type="file"
 accept={ACCEPTED_MIME_TYPES}
 className="hidden"
 disabled={isUploading}
 onChange={(event) => {
 const nextFile = event.target.files?.[0];
 if (nextFile) {
 handleUpload(definition.key, nextFile);
 }
 event.target.value = "";
 }}
 />
 </label>

 {documentUrl ? (
 <a
 href={documentUrl}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-150 ease-out hover:bg-slate-50 active:scale-[0.97]"
 >
 <FiEye size={16} />
 Ver
 </a>
 ) : null}
 </div>

 {current?.file_name ? (
 <p className="mt-3 truncate text-xs text-slate-500">
 {current.file_name}
 </p>
 ) : null}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
};

export default ProfileDocumentsBoard;
