import React from "react";

const CHECKLIST_ITEMS = [
 { key: "guide_vs_proforma", label: "Guía coincide con proforma" },
 { key: "packaging_integrity", label: "Empaque íntegro" },
 { key: "tilt_indicator", label: "Indicador de inclinación sin alerta" },
 { key: "handling_indicator", label: "Indicador de manipulación sin alerta" },
 { key: "serial_match", label: "Serie coincide con documentación" },
 { key: "accessories_match", label: "Accesorios completos" },
];

const STATUS_OPTIONS = [
 { value: "OK", label: "OK" },
 { value: "ISSUE", label: "Observado" },
 { value: "NA", label: "N/A" },
];

const InstallationReceptionStepper = ({
 draft = {},
 errors = {},
 disabled = false,
 onChange = () => {},
 onChecklistChange = () => {},
}) => {
 const checklist = draft.checklist || {};
 return (
 <div className="space-y-4">
 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-sm text-slate-700">
 Referencia guía
 <input
 type="text"
 value={draft.guide_reference || ""}
 onChange={(event) => onChange("guide_reference", event.target.value)}
 disabled={disabled}
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
 />
 </label>
 <label className="text-sm text-slate-700">
 Referencia proforma
 <input
 type="text"
 value={draft.proforma_reference || ""}
 onChange={(event) => onChange("proforma_reference", event.target.value)}
 disabled={disabled}
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
 />
 </label>
 </div>

 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
 Checklist F.ST-14
 </p>
 <div className="mt-3 space-y-2">
 {CHECKLIST_ITEMS.map((item) => (
 <div key={item.key} className="rounded-md border border-slate-200 bg-white px-3 py-2">
 <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
 <p className="text-sm text-slate-700">{item.label}</p>
 <select
 value={checklist[item.key] || ""}
 onChange={(event) => onChecklistChange(item.key, event.target.value)}
 disabled={disabled}
 className="w-full rounded border border-slate-300 px-2 py-1 text-sm md:w-44"
 >
 <option value="">Seleccionar...</option>
 {STATUS_OPTIONS.map((option) => (
 <option key={`${item.key}-${option.value}`} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 </div>
 {errors[item.key] ? (
 <p className="mt-1 text-xs text-rose-700">{errors[item.key]}</p>
 ) : null}
 </div>
 ))}
 </div>
 </div>

 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-sm text-slate-700">
 Hallazgos
 <textarea
 rows={3}
 value={draft.findings || ""}
 onChange={(event) => onChange("findings", event.target.value)}
 disabled={disabled}
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
 />
 </label>
 <label className="text-sm text-slate-700">
 Acciones derivadas
 <textarea
 rows={3}
 value={draft.corrective_actions || ""}
 onChange={(event) => onChange("corrective_actions", event.target.value)}
 disabled={disabled}
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
 />
 </label>
 </div>

 <label className="text-sm text-slate-700">
 Cadena de custodia / traslado
 <textarea
 rows={2}
 value={draft.logistics_chain_notes || ""}
 onChange={(event) => onChange("logistics_chain_notes", event.target.value)}
 disabled={disabled}
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
 />
 </label>

 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-sm text-slate-700">
 Resultado F.ST-14
 <select
 value={draft.result || "pass"}
 onChange={(event) => onChange("result", event.target.value)}
 disabled={disabled}
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
 >
 <option value="pass">Aprobado</option>
 <option value="failed">No aprobado</option>
 </select>
 </label>
 <label className="text-sm text-slate-700">
 Evidencias fotográficas
 <input
 type="file"
 multiple
 accept="image/*"
 disabled={disabled}
 onChange={(event) => {
 const files = Array.from(event.target.files || []);
 if (!files.length) return;
 const readers = files.map(
 (file) =>
 new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = () => resolve(reader.result);
 reader.onerror = reject;
 reader.readAsDataURL(file);
 }),
 );
 Promise.all(readers)
 .then((base64List) => {
 onChange("photos", [...(Array.isArray(draft.photos) ? draft.photos : []), ...base64List]);
 })
 .catch(() => {});
 }}
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
 />
 </label>
 </div>
 </div>
 );
};

export default InstallationReceptionStepper;
