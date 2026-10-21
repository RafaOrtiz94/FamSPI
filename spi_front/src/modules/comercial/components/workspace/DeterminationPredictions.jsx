import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheck, FiEdit2 } from "react-icons/fi";
import api from "../../../../core/api";
import Modal from "../../../../core/ui/components/Modal";

// Prediccion del motor en Determinaciones: calibradores, controles y materiales. Los reactivos no
// se predicen (salen de DET/AÑO/PROCESO del Sheet). Jefe de Servicio valida o cambia con motivo.

export const SECTION_ITEM_TYPE = { controles: "control", calibradores: "calibrador", materiales: "material" };
export const PREDICTION_VALIDATOR_ROLES = new Set([
 "jefe_servicio", "jefe_tecnico", "jefe_servicio_tecnico", "jefe_de_servicio_tecnico", "jefe_de_tecnico",
 "jefe_ti", "jefe_de_ti", "admin", "administrador",
]);
const MIN_REASON_LENGTH = 5;
export const MIN_JUSTIFICATION_LENGTH = 20;

const normalizeCode = (value) => {
 const digits = String(value ?? "").replace(/\D/g, "");
 return digits ? digits.replace(/^0+(?=\d)/, "") : "";
};
export const predictionKey = (equipmentId, itemType, code) => `${Number(equipmentId)}::${itemType}::${normalizeCode(code)}`;

const BASIS_LABELS = {
 validated_formula: "Fórmula validada",
 sheet_demand: "DET/AÑO del Sheet",
 client_history: "Entregado en el proceso anterior del cliente",
 reference_same_code: "Consumo real de otros clientes",
 reference_same_name: "Consumo real de otros clientes (mismo producto, otro código)",
 reference_family_median: "Mediana de su familia en clientes reales",
 reference_expert: "Consumo declarado por jefe_servicio en otro proceso",
 equipment_manual: "Manual del equipo",
 simulation_p90: "Simulación (P90)",
 simulation_p50: "Simulación (mediana)",
 calibrated_scenarios: "Escenarios calibrados con procesos reales",
 calibrated_by_similar_clients: "Ajustada con clientes parecidos",
 qc_calendar: "Estimación por calendario de QC (equipo sin referencias)",
};

const formatQuantity = (value) => (Number.isFinite(Number(value)) ? Number(value).toLocaleString("es-EC") : "—");

export function useDeterminationPredictions(businessCaseId) {
 const [data, setData] = useState(null);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");

 const load = useCallback(async () => {
  if (!businessCaseId) return;
  setLoading(true);
  setError("");
  try {
   const response = await api.get(`/business-case/${businessCaseId}/determinations/predictions`);
   setData(response?.data?.data || null);
  } catch (requestError) {
   setError(requestError?.response?.data?.message || "No se pudo cargar la predicción del motor.");
  } finally {
   setLoading(false);
  }
 }, [businessCaseId]);

 useEffect(() => { load(); }, [load]);

 const byKey = useMemo(() => new Map((data?.items || []).map((item) => [
  predictionKey(item.equipmentId, item.itemType, item.supplierCode), item,
 ])), [data]);

 const validate = useCallback(async (items) => {
  await api.put(`/business-case/${businessCaseId}/determinations/predictions`, { items });
  await load();
 }, [businessCaseId, load]);

 return { data, byKey, loading, error, reload: load, validate };
}

// Celda de una fila: prediccion, estado de validacion y acciones.
export function PredictionCell({ prediction, canValidate, onValidate, onChange, onJustify, busy }) {
 if (!prediction) {
  return (
   <span className="text-xs text-gray-400" title="Ningún reactivo con DET/AÑO en el Sheet lo usa, su ficha del fabricante no tiene los datos para calcularlo, o falta una estadística del laboratorio.">
    Sin predicción
   </span>
  );
 }
 const validation = prediction.validation;
 return (
  <div className="min-w-[170px] space-y-1">
   <div className="font-semibold text-gray-900">
    {formatQuantity(prediction.predicted)} <span className="text-xs font-normal text-gray-500">{prediction.unit}</span>
   </div>
   {Number.isFinite(Number(prediction.expectedConsumption)) && Number(prediction.expectedConsumption) !== Number(prediction.predicted) && (
    <div className="text-[11px] text-gray-600">
     Consumo esperado {formatQuantity(prediction.expectedConsumption)} · {prediction.partialDeliveries} entregas en presentaciones completas
    </div>
   )}
   <div className="text-[11px] text-gray-500" title={prediction.basisDetail || undefined}>{BASIS_LABELS[prediction.basis] || "Motor"}</div>
   {prediction.knowledgeApplied && <div className="text-[11px] text-sky-800">Aprendido de jefe_servicio: {prediction.knowledgeApplied}</div>}
   {validation && (
    <div className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${validation.changed ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
     {validation.changed ? `Cambiado a ${formatQuantity(validation.quantity)}` : "Validado"}
    </div>
   )}
   {validation?.changed && validation.reason && (
    <div className="max-w-[260px] text-[11px] text-gray-600" title={validation.reason}>Motivo: {validation.reason}</div>
   )}
   {prediction.needsJustification && (
    <div className="w-fit rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
     Sheet {formatQuantity(prediction.sheetPlanned)} ({prediction.sheetDifference > 0 ? "+" : ""}{formatQuantity(prediction.sheetDifference)}): falta justificar
    </div>
   )}
   {canValidate && prediction.needsJustification && onJustify && (
    <button
     type="button"
     disabled={busy}
     onClick={() => onJustify(prediction)}
     className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60"
    >
     <FiEdit2 className="h-3 w-3" /> Justificar diferencia
    </button>
   )}
   {canValidate && !prediction.needsJustification && (
    <div className="flex flex-wrap gap-1 pt-0.5">
     {!validation && (
      <button
       type="button"
       disabled={busy}
       onClick={() => onValidate(prediction)}
       className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
      >
       <FiCheck className="h-3 w-3" /> Validar
      </button>
     )}
     <button
      type="button"
      disabled={busy}
      onClick={() => onChange(prediction)}
      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
     >
      <FiEdit2 className="h-3 w-3" /> Cambiar
     </button>
    </div>
   )}
  </div>
 );
}

// Ventana para cambiar la cantidad: el motivo es obligatorio cuando difiere de la prediccion.
export function PredictionChangeModal({ prediction, onClose, onSave }) {
 const [quantity, setQuantity] = useState("");
 const [reason, setReason] = useState("");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");

 useEffect(() => {
  if (!prediction) return;
  setQuantity(String(prediction.validation?.quantity ?? prediction.predicted ?? ""));
  setReason(prediction.validation?.reason || "");
  setError("");
 }, [prediction]);

 if (!prediction) return null;
 const numeric = Number(quantity);
 const validNumber = quantity !== "" && Number.isFinite(numeric) && numeric >= 0;
 const changed = validNumber && numeric !== Number(prediction.predicted);
 const reasonOk = !changed || reason.trim().length >= MIN_REASON_LENGTH;

 const save = async () => {
  setSaving(true);
  setError("");
  try {
   await onSave({
    equipmentId: prediction.equipmentId,
    itemType: prediction.itemType,
    supplierCode: prediction.supplierCode,
    quantity: numeric,
    reason: changed ? reason.trim() : null,
   });
   onClose();
  } catch (requestError) {
   setError(requestError?.response?.data?.message || "No se pudo guardar el cambio.");
  } finally {
   setSaving(false);
  }
 };

 return (
  <Modal open title="Cambiar la predicción del motor" onClose={saving ? undefined : onClose} disableClose={saving}>
   <div className="space-y-4 px-4 py-4 text-sm sm:px-6">
    <div>
     <p className="font-semibold text-gray-900">{prediction.name}</p>
     <p className="text-xs text-gray-500">
      ID {prediction.supplierCode} · predicción {formatQuantity(prediction.predicted)} {prediction.unit}
      {prediction.p50 !== undefined ? ` · escenarios P50 ${formatQuantity(prediction.p50)}, P90 ${formatQuantity(prediction.p90)}` : ""}
     </p>
    </div>
    <label className="block font-medium text-gray-800">
     Cantidad correcta ({prediction.unit})
     <input
      type="number"
      min="0"
      step="1"
      value={quantity}
      onChange={(event) => setQuantity(event.target.value)}
      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
     />
    </label>
    <label className="block font-medium text-gray-800">
     ¿Por qué cambia?
     <textarea
      rows={3}
      value={reason}
      onChange={(event) => setReason(event.target.value)}
      placeholder="Ej.: el laboratorio corre 3 niveles de control por turno; se calibra cada semana por política interna."
      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
     />
     <span className="mt-1 block text-xs text-gray-500">
      {changed ? "Obligatorio: el motivo enseña al motor para las próximas predicciones." : "Si la cantidad no cambia, se registra como validada."}
     </span>
    </label>
    {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
    <div className="flex justify-end gap-2">
     <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
      Cancelar
     </button>
     <button
      type="button"
      onClick={save}
      disabled={saving || !validNumber || !reasonOk}
      className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
     >
      {saving ? "Guardando…" : changed ? "Guardar cambio" : "Validar"}
     </button>
    </div>
   </div>
  </Modal>
 );
}

// Justificacion de una diferencia con PRODUCTO A ENTREGAR: UN motivo y UN dato que reproduzcan la cantidad
// del Sheet. Queda en la matriz de conocimiento y se reutiliza en procesos nuevos (los motivos transferibles).
// Las formulas son las mismas del backend (knowledgeMatrix.js), que vuelve a validar al guardar.
export const JUSTIFICATION_TOLERANCE = 0.1;
const ceilQuantity = (value) => Math.ceil(Number(value) - 1e-9);
const deliverQuantity = (quantity, deliveries) => {
 const q = Number(quantity);
 if (!Number.isFinite(q) || q <= 0) return 0;
 return deliveries > 1 ? deliveries * ceilQuantity(q / deliveries) : ceilQuantity(q);
};
export const JUSTIFICATION_FORMULAS = {
 monthly_consumption: ({ value, months }) => ceilQuantity(value * months),
 analyzers: ({ value, expected, deliveries }) => deliverQuantity(expected * value, deliveries),
 extra_per_delivery: ({ value, expected, deliveries }) => Math.max(deliveries, 1) * (ceilQuantity((expected || 0) / Math.max(deliveries, 1)) + value),
 client_stock: ({ value, expected, deliveries }) => deliverQuantity(Math.max((expected || 0) - value, 0), deliveries),
};
// Valor sugerido para que la cantidad cuadre con el Sheet (el usuario lo corrige si no es real).
const suggestedValue = (reason, { sheet, expected, months, deliveries }) => {
 if (reason === "monthly_consumption") return months ? Number((sheet / months).toFixed(2)) : "";
 if (reason === "analyzers") return expected > 0 ? Math.max(1, Math.round(sheet / expected)) : 1;
 if (reason === "extra_per_delivery") return Math.max(0, Math.round((sheet - deliverQuantity(expected, deliveries)) / Math.max(deliveries, 1)));
 if (reason === "client_stock") return Math.max(0, Math.round((expected || 0) - sheet));
 return "";
};
export const DEFAULT_REASONS = [
 { key: "monthly_consumption", label: "El laboratorio consume esa cantidad", field: "Unidades por mes", min: 0, transferable: true },
 { key: "analyzers", label: "Más analizadores usan el producto", field: "Número de analizadores que lo usan", min: 1, integer: true, transferable: true },
 { key: "extra_per_delivery", label: "Reserva o mínimo por entrega", field: "Unidades extra por entrega", min: 0, integer: true, transferable: true },
 { key: "client_stock", label: "Stock que ya tiene el cliente", field: "Unidades en stock", min: 0, integer: true, transferable: false },
 { key: "commercial", label: "Decisión comercial", field: null, transferable: false },
];

export function SheetDifferenceModal({ prediction, reasons = DEFAULT_REASONS, processMonths, onClose, onSave }) {
 const [reason, setReason] = useState("");
 const [value, setValue] = useState("");
 const [note, setNote] = useState("");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");

 useEffect(() => {
  setReason("");
  setValue("");
  setNote("");
  setError("");
 }, [prediction]);

 if (!prediction) return null;
 const sheet = Number(prediction.sheetPlanned);
 const deliveries = Math.max(Number(prediction.partialDeliveries) || 1, 1);
 const expected = Number(prediction.expectedConsumption ?? prediction.predicted) || 0;
 const months = Number(processMonths) || 0;
 const selected = reasons.find((entry) => entry.key === reason) || null;
 const numeric = value === "" ? null : Number(value);
 const validValue = numeric !== null && Number.isFinite(numeric) && numeric >= (selected?.min ?? 0) && (!selected?.integer || Number.isInteger(numeric));
 const formula = JUSTIFICATION_FORMULAS[reason];
 const computed = selected?.field && validValue && formula ? formula({ value: numeric, expected, months, deliveries }) : null;
 const fits = computed !== null && Math.abs(computed - sheet) <= Math.max(1, JUSTIFICATION_TOLERANCE * sheet);
 const ready = selected && (selected.field ? fits : note.trim().length >= 10);

 const choose = (key) => {
  setReason(key);
  setError("");
  setValue(String(suggestedValue(key, { sheet, expected, months, deliveries })));
 };

 const save = async () => {
  setSaving(true);
  setError("");
  try {
   await onSave({
    equipmentId: prediction.equipmentId,
    itemType: prediction.itemType,
    supplierCode: prediction.supplierCode,
    quantity: sheet,
    justification: { reason, value: selected?.field ? numeric : null, note: note.trim() || null },
   });
   onClose();
  } catch (requestError) {
   setError(requestError?.response?.data?.message || "No se pudo guardar la justificación.");
  } finally {
   setSaving(false);
  }
 };

 return (
  <Modal open title="Justificar la diferencia con el motor" onClose={saving ? undefined : onClose} disableClose={saving}>
   <div className="space-y-4 px-4 py-4 text-sm sm:px-6">
    <div>
     <p className="font-semibold text-gray-900">{prediction.name}</p>
     <p className="text-xs text-gray-500">
      Motor {formatQuantity(prediction.predicted)} (consumo esperado {formatQuantity(expected)}{deliveries > 1 ? `, ${deliveries} entregas` : ""}) · PRODUCTO A ENTREGAR (Sheet) {formatQuantity(sheet)} {prediction.unit}
     </p>
    </div>
    <fieldset className="space-y-2">
     <legend className="font-medium text-gray-800">¿Por qué {formatQuantity(sheet)}?</legend>
     {reasons.map((entry) => (
      <label key={entry.key} className="flex items-start gap-2 text-gray-800">
       <input type="radio" name="justification-reason" value={entry.key} checked={reason === entry.key} onChange={() => choose(entry.key)} className="mt-1" />
       <span>{entry.label}</span>
      </label>
     ))}
    </fieldset>
    {selected?.field && (
     <label className="block font-medium text-gray-800">
      {selected.field}
      <input
       type="number"
       min={selected.min ?? 0}
       step={selected.integer ? 1 : 0.01}
       value={value}
       onChange={(event) => setValue(event.target.value)}
       aria-label={selected.field}
       className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className={`mt-1 block text-xs ${fits ? "text-emerald-700" : "text-rose-700"}`}>
       {computed === null ? "Escriba el dato." : `Con este dato la cantidad da ${formatQuantity(computed)}; el Sheet dice ${formatQuantity(sheet)}.${fits ? "" : " Ajuste el dato para que cuadre."}`}
      </span>
     </label>
    )}
    {selected && (
     <label className="block font-medium text-gray-800">
      {selected.field ? "Nota (opcional)" : "Describa la decisión"}
      <input
       type="text"
       value={note}
       onChange={(event) => setNote(event.target.value)}
       aria-label={selected.field ? "Nota" : "Describa la decisión"}
       className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
      />
      {!selected.field && <span className="mt-1 block text-xs text-gray-500">Mínimo 10 caracteres. No se usa para predecir.</span>}
     </label>
    )}
    {selected && (
     <p className="text-xs text-gray-500">
      {selected.transferable ? "Este dato se guarda en la matriz de conocimiento y se usa para predecir procesos nuevos." : "Este dato es propio de este cliente: no se usa en otros procesos."}
     </p>
    )}
    {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
    <div className="flex justify-end gap-2">
     <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
      Cancelar
     </button>
     <button type="button" onClick={save} disabled={saving || !ready} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
      {saving ? "Guardando…" : "Guardar justificación"}
     </button>
    </div>
   </div>
  </Modal>
 );
}
