import React, { useEffect, useMemo, useState } from "react";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";

const inputClass =
 "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100";

const convertFilesToDataUrl = async (files = []) => {
 const list = Array.from(files || []);
 return Promise.all(
 list.map(
 (file) =>
 new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = () =>
 resolve({
 name: file.name,
 type: file.type,
 data: reader.result,
 });
 reader.onerror = reject;
 reader.readAsDataURL(file);
 }),
 ),
 );
};

const mapWorkflowPackagesToDraft = (packages = []) =>
 (Array.isArray(packages) ? packages : []).map((pkg, index) => ({
 package_label: pkg.package_label || pkg.label || `BULTO-${index + 1}`,
 package_type: pkg.package_type || "",
 package_weight_kg:
 pkg.package_weight_kg === null || pkg.package_weight_kg === undefined
 ? ""
 : String(pkg.package_weight_kg),
 package_dimensions: pkg.package_dimensions || "",
 items_summary: Array.isArray(pkg.items_summary) ? pkg.items_summary.join("\n") : "",
 evidence: Array.isArray(pkg.evidence) ? pkg.evidence : [],
 evidence_files: [],
 }));

const WithdrawalPackagingPanel = ({
 workflow = null,
 onSave,
 busy = false,
}) => {
 const state = workflow?.workflow_state || {};
 const [packageDraft, setPackageDraft] = useState({
 package_label: "",
 package_type: "",
 package_weight_kg: "",
 package_dimensions: "",
 items_summary: "",
 evidence_files: [],
 });
 const [packagingNotes, setPackagingNotes] = useState("");
 const [packages, setPackages] = useState([]);

 useEffect(() => {
 setPackages(mapWorkflowPackagesToDraft(state?.packaging?.packages));
 setPackagingNotes(state?.packaging?.notes || "");
 }, [workflow?.id, state?.packaging]);

 const totalEvidence = useMemo(
 () =>
 packages.reduce(
 (sum, pkg) =>
 sum +
 (Array.isArray(pkg.evidence) ? pkg.evidence.length : 0) +
 (Array.isArray(pkg.evidence_files) ? pkg.evidence_files.length : 0),
 0,
 ),
 [packages],
 );

 const addPackage = () => {
 const label = String(packageDraft.package_label || "").trim();
 if (!label) return;
 setPackages((prev) => [
 ...prev,
 {
 ...packageDraft,
 package_label: label,
 },
 ]);
 setPackageDraft({
 package_label: "",
 package_type: "",
 package_weight_kg: "",
 package_dimensions: "",
 items_summary: "",
 evidence_files: [],
 });
 };

 const removePackage = (index) => {
 setPackages((prev) => prev.filter((_item, idx) => idx !== index));
 };

 const savePackages = async () => {
 if (typeof onSave !== "function") return;
 const payload = {
 packages: packages.map((pkg) => ({
 package_label: pkg.package_label,
 package_type: pkg.package_type || null,
 package_weight_kg: pkg.package_weight_kg ? Number(pkg.package_weight_kg) : null,
 package_dimensions: pkg.package_dimensions || null,
 items_summary:
 typeof pkg.items_summary === "string"
 ? pkg.items_summary
 .split("\n")
 .map((line) => line.trim())
 .filter(Boolean)
 : [],
 evidence: Array.isArray(pkg.evidence) ? pkg.evidence : [],
 evidence_files: Array.isArray(pkg.evidence_files) ? pkg.evidence_files : [],
 })),
 notes: packagingNotes || null,
 };
 await onSave(payload);
 };

 return (
 <Card className="p-4">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <h4 className="text-sm font-semibold text-slate-900">Embalaje, etiquetas y control de bultos</h4>
 <div className="text-xs text-slate-600">
 Bultos: <span className="font-semibold">{packages.length}</span> | Evidencias:{" "}
 <span className="font-semibold">{totalEvidence}</span>
 </div>
 </div>

 <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-xs font-medium text-slate-600">
 Etiqueta / Bulto
 <input
 className={inputClass}
 value={packageDraft.package_label}
 onChange={(event) =>
 setPackageDraft((prev) => ({ ...prev, package_label: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Tipo de empaque
 <input
 className={inputClass}
 value={packageDraft.package_type}
 onChange={(event) =>
 setPackageDraft((prev) => ({ ...prev, package_type: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Peso (kg)
 <input
 type="number"
 min="0"
 step="0.01"
 className={inputClass}
 value={packageDraft.package_weight_kg}
 onChange={(event) =>
 setPackageDraft((prev) => ({ ...prev, package_weight_kg: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Medidas
 <input
 className={inputClass}
 value={packageDraft.package_dimensions}
 onChange={(event) =>
 setPackageDraft((prev) => ({ ...prev, package_dimensions: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600 md:col-span-2">
 Contenido (una línea por item)
 <textarea
 className={inputClass}
 rows={3}
 value={packageDraft.items_summary}
 onChange={(event) =>
 setPackageDraft((prev) => ({ ...prev, items_summary: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600 md:col-span-2">
 Evidencias fotográficas
 <input
 type="file"
 accept="image/*"
 multiple
 className={inputClass}
 onChange={async (event) => {
 const files = await convertFilesToDataUrl(event.target.files);
 setPackageDraft((prev) => ({ ...prev, evidence_files: files }));
 }}
 />
 </label>
 </div>

 <div className="mt-3 flex justify-end">
 <Button size="sm" variant="secondary" onClick={addPackage}>
 Agregar bulto
 </Button>
 </div>

 {packages.length > 0 ? (
 <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
 <table className="min-w-full text-left text-xs">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="px-3 py-2">Etiqueta</th>
 <th className="px-3 py-2">Tipo</th>
 <th className="px-3 py-2">Peso</th>
 <th className="px-3 py-2">Evidencias</th>
 <th className="px-3 py-2">Acción</th>
 </tr>
 </thead>
 <tbody>
 {packages.map((pkg, index) => (
 <tr key={`${pkg.package_label}-${index}`} className="border-t border-slate-100">
 <td className="px-3 py-2 font-semibold text-slate-700">{pkg.package_label}</td>
 <td className="px-3 py-2 text-slate-600">{pkg.package_type || "N/D"}</td>
 <td className="px-3 py-2 text-slate-600">
 {pkg.package_weight_kg || "N/D"}
 </td>
 <td className="px-3 py-2 text-slate-600">
 {(Array.isArray(pkg.evidence) ? pkg.evidence.length : 0) +
 (Array.isArray(pkg.evidence_files) ? pkg.evidence_files.length : 0)}
 </td>
 <td className="px-3 py-2">
 <button
 type="button"
 className="text-rose-600 hover:underline"
 onClick={() => removePackage(index)}
 >
 Quitar
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <p className="mt-3 text-xs text-slate-500">Aún no hay bultos registrados.</p>
 )}

 <label className="mt-3 block text-xs font-medium text-slate-600">
 Notas de embalaje
 <textarea
 className={inputClass}
 rows={2}
 value={packagingNotes}
 onChange={(event) => setPackagingNotes(event.target.value)}
 />
 </label>

 <div className="mt-3 flex justify-end">
 <Button size="sm" loading={busy} onClick={savePackages}>
 Guardar embalaje
 </Button>
 </div>
 </Card>
 );
};

export default WithdrawalPackagingPanel;

