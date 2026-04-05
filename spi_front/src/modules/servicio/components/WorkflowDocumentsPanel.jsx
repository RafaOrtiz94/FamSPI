import React, { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiFileText, FiRefreshCw } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import { getWorkflowCatalog, listWorkflowDocuments } from "../../../core/api/servicioApi";

let catalogCache = null;
let catalogPromise = null;

const loadCatalogOnce = async () => {
 if (catalogCache) return catalogCache;
 if (!catalogPromise) {
 catalogPromise = getWorkflowCatalog({ with_compatibility: true, include_inactive: false })
 .then((rows) => {
 catalogCache = Array.isArray(rows) ? rows : [];
 return catalogCache;
 })
 .catch(() => []);
 }
 return catalogPromise;
};

const toDriveLink = (fileId) => (fileId ? `https://drive.google.com/file/d/${fileId}/view` : null);

const formatDate = (value) => {
 if (!value) return "N/D";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "N/D";
 return date.toLocaleString("es-EC");
};

const WorkflowDocumentsPanel = ({ sourceType, sourceId, summary = null }) => {
 const [rows, setRows] = useState([]);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");
 const [catalogRows, setCatalogRows] = useState([]);

 const loadData = async () => {
 if (!sourceType || !sourceId) return;
 setLoading(true);
 setError("");
 try {
 const docs = await listWorkflowDocuments({ source_type: sourceType, source_id: sourceId });
 setRows(Array.isArray(docs) ? docs : []);
 } catch (err) {
 setError(err?.message || "No se pudieron cargar documentos del workflow");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadData();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [sourceType, sourceId]);

 useEffect(() => {
 let mounted = true;
 loadCatalogOnce().then((rows) => {
 if (!mounted) return;
 setCatalogRows(Array.isArray(rows) ? rows : []);
 });
 return () => {
 mounted = false;
 };
 }, []);

 const incompatibleByCode = useMemo(() => {
 const map = {};
 catalogRows.forEach((item) => {
 const code = String(item?.document_code || "").toUpperCase();
 if (!code) return;
 if (item?.compatibility?.is_compatible === false) {
 map[code] = item.compatibility;
 }
 });
 return map;
 }, [catalogRows]);

 const generatedCodes = useMemo(
 () => Array.from(new Set(rows.map((row) => String(row?.document_code || "").toUpperCase()).filter(Boolean))),
 [rows],
 );

 const incompatibleGenerated = generatedCodes.filter((code) => Boolean(incompatibleByCode[code]));

 return (
 <Card className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
 <div className="flex items-center justify-between gap-2">
 <div>
 <p className="text-xs uppercase tracking-wide text-slate-500">Expediente documental ST</p>
 <h4 className="text-sm font-semibold text-slate-900">
 {rows.length} documento{rows.length === 1 ? "" : "s"}
 </h4>
 </div>
 <Button size="sm" variant="secondary" icon={FiRefreshCw} onClick={loadData} loading={loading}>
 Recargar
 </Button>
 </div>

 {summary?.document_codes?.length ? (
 <div className="mt-2 flex flex-wrap gap-1.5">
 {summary.document_codes.map((code) => (
 <span
 key={code}
 className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
 >
 {code}
 </span>
 ))}
 </div>
 ) : null}

 {incompatibleGenerated.length > 0 ? (
 <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
 <div className="flex items-center gap-2 font-medium">
 <FiAlertTriangle size={14} />
 Compatibilidad de plantilla pendiente
 </div>
 <p className="mt-1">
 Hay documentos emitidos con incompatibilidades detectadas: {incompatibleGenerated.join(", ")}.
 </p>
 </div>
 ) : null}

 {error ? (
 <p className="mt-2 text-xs text-rose-700">{error}</p>
 ) : rows.length === 0 ? (
 <p className="mt-2 text-xs text-slate-500">No hay documentos registrados en este workflow.</p>
 ) : (
 <div className="mt-3 space-y-2">
 {rows.slice(0, 8).map((row) => {
 const link = toDriveLink(row?.drive_file_id);
 return (
 <div key={row.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-2">
 <div className="min-w-0">
 <p className="truncate text-xs font-medium text-slate-900">
 {row.document_code} {row.stage_key ? `· ${row.stage_key}` : ""}
 </p>
 <p className="text-xs text-slate-500">{formatDate(row.created_at)}</p>
 </div>
 {link ? (
 <a
 href={link}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline"
 >
 <FiFileText size={12} />
 Ver
 </a>
 ) : (
 <span className="text-xs text-slate-400">Sin archivo</span>
 )}
 </div>
 );
 })}
 </div>
 )}
 </Card>
 );
};

export default WorkflowDocumentsPanel;

