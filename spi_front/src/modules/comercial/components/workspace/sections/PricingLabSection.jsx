import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
 FiAlertTriangle,
 FiCheckCircle,
 FiClock,
 FiDatabase,
 FiExternalLink,
 FiRefreshCw,
 FiSearch,
 FiShield,
 FiXCircle,
} from "react-icons/fi";
import api from "../../../../../core/api";
import { useAuth } from "../../../../../core/auth/AuthContext";

const STATUS_STYLES = {
 calculated: "border-emerald-200 bg-emerald-50 text-emerald-800",
 blocked: "border-amber-200 bg-amber-50 text-amber-800",
 quarantined: "border-rose-200 bg-rose-50 text-rose-800",
 unsupported: "border-slate-200 bg-slate-50 text-slate-700",
};

const STATUS_LABELS = {
 calculated: "Calculado",
 blocked: "Bloqueado",
 quarantined: "En cuarentena",
 unsupported: "Sin paquete",
};

const INPUT_LABELS = {
 annualDemand: "Demanda anual",
 reticulocyteDemand: "Reticulocitos",
 fluidDemand: "Líquidos corporales",
 plateletDemand: "Plaquetas fluorescentes",
 contractMonths: "Proyección de plazo",
 equipmentCount: "Número de equipos",
 additionalInvestmentsSubtotal: "Inversiones adicionales",
};

const PROCESS_PRICE_LABELS = {
 base: "Unitario base",
 commercial: "Unitario comercial (+15 %)",
 initialTotal: "Total inicial",
 finalTotal: "Total final",
 completeBase: "Completa — base",
 completeCommercial: "Completa — comercial",
 completeInitialTotal: "Completa — total inicial",
 completeFinalTotal: "Completa — total final",
 basicBase: "Básica — base",
 basicCommercial: "Básica — comercial",
 basicInitialTotal: "Básica — total inicial",
 basicFinalTotal: "Básica — total final",
 allPurchasedUnit: "Todo comprado — unitario",
};

const formatNumber = (value, digits = 4) => {
 const number = Number(value);
 if (!Number.isFinite(number)) return "—";
 return number.toLocaleString("es-EC", {
  minimumFractionDigits: 0,
  maximumFractionDigits: digits,
 });
};

const modalityLabel = (value) => ({
 determinacion: "Determinación",
 prueba_efectiva: "Determinación efectiva",
 todo_comprado: "Todo comprado",
}[value] || "No resuelta");

const normalizeProductCode = (value) => {
 const raw = String(value ?? "").trim();
 return /^\d+$/.test(raw) ? raw.replace(/^0+(?=\d)/, "") : raw.toLowerCase();
};

const normalizeItemType = (value) => String(value || "").trim().toLowerCase();

const comparisonKey = (equipmentId, itemType, supplierCode) => [
 String(equipmentId ?? ""),
 normalizeItemType(itemType),
 normalizeProductCode(supplierCode),
].join("::");

const firstFinite = (...values) => {
 for (const value of values) {
  if (value === null || value === undefined || value === "") continue;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
 }
 return null;
};

const formatDetailValue = (value) => {
 if (value === null || value === undefined || value === "") return "No disponible";
 if (typeof value === "boolean") return value ? "Sí" : "No";
 if (typeof value === "object") return JSON.stringify(value);
 return String(value);
};

const inputDetailRows = (inputs = {}) => Object.entries(inputs).flatMap(([group, rawValue]) => {
 if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
  return [{ label: group, value: rawValue, origin: null }];
 }
 if (Object.prototype.hasOwnProperty.call(rawValue, "value")) {
  return [{ label: group, value: rawValue.value, origin: rawValue.origin || null }];
 }
 return Object.entries(rawValue).map(([field, detail]) => ({
  label: `${group}.${field}`,
  value: detail && typeof detail === "object" && Object.prototype.hasOwnProperty.call(detail, "value")
   ? detail.value
   : detail,
  origin: detail && typeof detail === "object" ? detail.origin || null : null,
 }));
});

function buildComparisonRows(entry) {
 const equipmentId = entry?.equipmentId;
 const rows = new Map();
 const ensureRow = ({ itemType, supplierCode, itemKey, name }) => {
  const identity = supplierCode || itemKey || name || `sin-codigo-${rows.size + 1}`;
  const key = comparisonKey(equipmentId, itemType, identity);
  if (!rows.has(key)) {
   rows.set(key, {
    key,
    equipmentId,
    itemType: normalizeItemType(itemType) || "sin_tipo",
    supplierCode: supplierCode || null,
    itemKey: itemKey || null,
    name: name || supplierCode || itemKey || "Producto sin identificar",
    ruleItem: null,
    sheetQuantity: null,
    sheetValues: [],
    historicalQuantity: null,
    historicalItem: null,
   });
  }
  return rows.get(key);
 };

 (entry?.ruleEngine?.items || []).forEach((item) => {
  const row = ensureRow(item);
  row.ruleItem = item;
  row.name = item.name || row.name;
  row.supplierCode = item.supplierCode || row.supplierCode;
 });

 (entry?.predictiveModel?.items || []).forEach((item) => {
  const row = ensureRow({
   itemType: item.itemType,
   supplierCode: item.productId,
   name: item.productName,
  });
  row.historicalItem = item;
  row.historicalQuantity = firstFinite(item.historical?.selectedQuantity);
  row.sheetQuantity = firstFinite(item.registeredQuantity);
  row.name = item.productName || row.name;
 });

 (entry?.calculation?.items || []).forEach((item) => {
  (item.sheetRows || []).forEach((sheetRow) => {
   const row = ensureRow({
    itemType: sheetRow.itemType,
    supplierCode: item.productId,
    name: item.productName,
   });
   const plannedQuantity = firstFinite(sheetRow.plannedQty);
   if (plannedQuantity !== null && !row.sheetValues.includes(plannedQuantity)) {
    row.sheetValues.push(plannedQuantity);
   }
   row.sheetQuantity = row.sheetValues.length === 1 ? row.sheetValues[0] : null;
  });
 });

 return [...rows.values()].sort((left, right) => (
  left.itemType.localeCompare(right.itemType, "es")
  || left.name.localeCompare(right.name, "es")
  || String(left.supplierCode || "").localeCompare(String(right.supplierCode || ""), "es")
 ));
}

const LoadingState = () => (
 <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
  <FiClock className="mx-auto animate-pulse text-blue-500" size={28} />
  <p className="mt-3 text-sm font-medium text-slate-600">Preparando la vista previa de precios…</p>
 </div>
);

const MessageList = ({ title, items = [], tone = "amber" }) => {
 if (!items.length) return null;
 const classes = tone === "rose"
  ? "border-rose-200 bg-rose-50 text-rose-900"
  : "border-amber-200 bg-amber-50 text-amber-900";
 return (
  <div className={`rounded-2xl border p-4 ${classes}`}>
   <p className="text-xs font-bold uppercase tracking-[0.16em]">{title}</p>
   <ul className="mt-2 space-y-1.5 text-sm">
    {items.map((item, index) => (
     <li key={`${item.code || "message"}-${index}`} className="flex gap-2">
      <FiAlertTriangle className="mt-0.5 shrink-0" size={15} />
      <span>{item.message || item.code}</span>
     </li>
    ))}
   </ul>
  </div>
 );
};

const PriceGrid = ({ prices = {} }) => {
 const rows = Object.entries(prices).filter(([, value]) => value !== null && value !== undefined);
 if (!rows.length) {
  return <p className="text-sm text-slate-500">El paquete no produjo precios de proceso publicables.</p>;
 }
 return (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   {rows.map(([key, value]) => (
    <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4">
     <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
      {PROCESS_PRICE_LABELS[key] || key}
     </p>
     <p className="mt-2 text-xl font-bold text-slate-950">US$ {formatNumber(value, 6)}</p>
    </div>
   ))}
  </div>
 );
};

const ItemsTable = ({ items = [] }) => {
 if (!items.length) return null;
 const formatSheetValues = (rows, field) => {
  const values = [...new Set((rows || [])
   .map((row) => row?.[field])
   .filter((value) => value !== null && value !== undefined)
   .map((value) => formatNumber(value, 2)))];
  return values.length ? values.join(" / ") : "—";
 };
 const formatSources = (rows) => [...new Set((rows || [])
  .map((row) => row?.annualQuantitySource)
  .filter(Boolean))].join(" / ");
 return (
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
   <table className="min-w-[980px] w-full text-left text-sm">
    <thead className="bg-slate-50 text-xs uppercase tracking-[0.1em] text-slate-500">
     <tr>
      <th className="px-4 py-3">Producto</th>
      <th className="px-4 py-3">DET/KIT</th>
      <th className="px-4 py-3">Demanda para cálculo</th>
      <th className="px-4 py-3">Producto a entregar</th>
      <th className="px-4 py-3">Cantidad calculada</th>
      <th className="px-4 py-3">US$ KIT propuesto</th>
      <th className="px-4 py-3">US$ DET propuesto</th>
     </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
     {items.map((item) => {
      return (
       <tr key={`${item.productId}-${item.occurrence}`} className="align-top">
        <td className="px-4 py-3">
         <p className="font-semibold text-slate-900">{item.productName}</p>
         <p className="mt-1 text-xs text-slate-500">{item.productId}</p>
        </td>
        <td className="px-4 py-3 text-slate-700">{formatNumber(item.testsPerKit, 2)}</td>
        <td className="px-4 py-3 text-slate-700">
         <p>{formatSheetValues(item.sheetRows, "annualQty")}</p>
         <p className="mt-1 max-w-[260px] text-[11px] leading-4 text-slate-400">{formatSources(item.sheetRows)}</p>
        </td>
        <td className="px-4 py-3 text-slate-700">{formatSheetValues(item.sheetRows, "plannedQty")}</td>
        <td className="px-4 py-3 font-semibold text-slate-900">{formatNumber(item.calculatedQuantity, 4)}</td>
        <td className="px-4 py-3 font-semibold text-blue-700">{formatNumber(item.proposedKitPrice, 6)}</td>
        <td className="px-4 py-3 font-semibold text-indigo-700">{formatNumber(item.proposedDeterminationPrice, 8)}</td>
       </tr>
      );
     })}
    </tbody>
   </table>
  </div>
 );
};

const LearningBadge = ({ feedback }) => {
 const status = feedback?.status;
 if (status === "exact_match") {
  return (
   <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
    <FiCheckCircle size={13} /> Coincide
   </span>
  );
 }
 if (status === "different") {
  return (
   <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">
    <FiAlertTriangle size={13} /> Difiere por {formatNumber(feedback?.absoluteError, 0)}
   </span>
  );
 }
 if (status === "awaiting_registered_quantity") {
  return (
   <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">
    <FiClock size={13} /> Pendiente de registro
   </span>
  );
 }
 return (
  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
   Sin evidencia suficiente
  </span>
 );
};

const PredictiveModelPanel = ({ model }) => {
 if (!model) return null;
 const validation = model.validation || {};
 const proxyValidation = model.proxyValidation || {};
 const accuracy = validation.quantityAccuracyPercent;
 const targetMet = model.automaticCorrectionEligible === true;
 const suggestedItems = (model.items || []).filter((item) => Number(item.suggestedQuantity) > 0);
 const knowledgeCoverage = model.productKnowledgeCoverage || {};
 const learningSummary = model.learningSummary || {};
 return (
  <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
   <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
     <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Modelo predictivo hibrido - modo sombra</p>
     <p className="mt-1 text-sm text-slate-700">
      La formula auditada tiene prioridad. El historial solo genera una sugerencia experimental y nunca modifica la oferta.
     </p>
     <p className="mt-2 text-xs font-semibold text-violet-800">
      Uso permitido: priorizar productos y revisar cantidades. No usar para comprar, despachar ni escribir la oferta automaticamente.
     </p>
    </div>
    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${targetMet ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-amber-300 bg-amber-100 text-amber-900"}`}>
     {targetMet ? "Umbral validado" : "Correccion bloqueada"}
   </span>
   </div>

   <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
    <p className="flex items-center gap-2 text-sm font-bold">
     <FiRefreshCw size={15} /> Estamos ajustando las predicciones
    </p>
    <p className="mt-1 text-sm leading-5 text-blue-900">
     Cada registro del Business Case se conserva como observación. Cuando el caso deja de ser borrador puede alimentar futuras sugerencias; el caso actual nunca se usa para predecirse a sí mismo.
    </p>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
     <LearningBadge feedback={{ status: "exact_match" }} />
     <LearningBadge feedback={{ status: "different", absoluteError: 1 }} />
     <LearningBadge feedback={{ status: "awaiting_registered_quantity" }} />
     <LearningBadge feedback={{ status: "prediction_unavailable" }} />
    </div>
    <p className="mt-2 text-xs text-blue-700">
     Estas coincidencias usan la cantidad registrada como proxy de planificación; la precisión oficial solo se valida con despachos completos.
    </p>
   </div>

   <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
    <div className="rounded-xl border border-violet-100 bg-white p-3">
     <p className="text-xs text-slate-500">Objetivo obligatorio</p>
     <p className="mt-1 font-bold text-slate-950">{formatNumber(model.targetAccuracyPercent, 1)}%</p>
    </div>
    <div className="rounded-xl border border-violet-100 bg-white p-3">
      <p className="text-xs text-slate-500">Exactitud operacional</p>
     <p className="mt-1 font-bold text-slate-950">{accuracy === null || accuracy === undefined ? "No medible" : `${formatNumber(accuracy, 3)}%`}</p>
    </div>
    <div className="rounded-xl border border-violet-100 bg-white p-3">
     <p className="text-xs text-slate-500">F1 proxy de presencia</p>
     <p className="mt-1 font-bold text-slate-950">{proxyValidation.presenceF1Percent === null || proxyValidation.presenceF1Percent === undefined ? "No medible" : `${formatNumber(proxyValidation.presenceF1Percent, 3)}%`}</p>
    </div>
    <div className="rounded-xl border border-violet-100 bg-white p-3">
     <p className="text-xs text-slate-500">Exactitud proxy</p>
     <p className="mt-1 font-bold text-slate-950">{proxyValidation.quantityAccuracyPercent === null || proxyValidation.quantityAccuracyPercent === undefined ? "No medible" : `${formatNumber(proxyValidation.quantityAccuracyPercent, 3)}%`}</p>
     <p className="mt-1 text-[11px] text-slate-400">No certifica consumo real</p>
    </div>
    <div className="rounded-xl border border-violet-100 bg-white p-3">
     <p className="text-xs text-slate-500">Coincidencia exacta proxy</p>
     <p className="mt-1 font-bold text-slate-950">{proxyValidation.exactPositivePercent === null || proxyValidation.exactPositivePercent === undefined ? "No medible" : `${formatNumber(proxyValidation.exactPositivePercent, 3)}%`}</p>
    </div>
    <div className="rounded-xl border border-violet-100 bg-white p-3">
      <p className="text-xs text-slate-500">Despachos comparables</p>
      <p className="mt-1 font-bold text-slate-950">{model.operationalValidationCases || 0}</p>
    </div>
    <div className="rounded-xl border border-violet-100 bg-white p-3">
     <p className="text-xs text-slate-500">Confianza</p>
     <p className="mt-1 font-bold capitalize text-slate-950">{model.confidence || "insuficiente"}</p>
    </div>
    <div className="rounded-xl border border-violet-100 bg-white p-3">
     <p className="text-xs text-slate-500">Identidad de catalogo</p>
     <p className="mt-1 font-bold text-slate-950">
      {knowledgeCoverage.verifiedCatalogIdentity || 0}/{knowledgeCoverage.totalProducts || 0}
     </p>
    </div>
    <div className="rounded-xl border border-violet-100 bg-white p-3">
     <p className="text-xs text-slate-500">Codigos ambiguos</p>
     <p className={`mt-1 font-bold ${knowledgeCoverage.ambiguousSupplierCodes ? "text-rose-700" : "text-slate-950"}`}>
      {knowledgeCoverage.ambiguousSupplierCodes || 0}
     </p>
    </div>
    <div className="rounded-xl border border-violet-100 bg-white p-3">
     <p className="text-xs text-slate-500">Coincidencia del caso actual</p>
     <p className="mt-1 font-bold text-slate-950">
      {learningSummary.exactMatchPercent === null || learningSummary.exactMatchPercent === undefined
       ? "Pendiente"
       : `${formatNumber(learningSummary.exactMatchPercent, 2)}%`}
     </p>
     <p className="mt-1 text-[11px] text-slate-400">
      {learningSummary.exactMatchProducts || 0}/{learningSummary.evaluatedProducts || 0} cantidades exactas
     </p>
    </div>
   </div>

   <MessageList title="Bloqueos del modelo" items={model.blockers || []} />

   {suggestedItems.length ? (
    <div className="mt-4">
     <p className="mb-2 text-xs text-slate-500">
      {suggestedItems.length} producto(s) con cantidad positiva de {model.items.length} evaluados. Los productos sin evidencia o con cantidad cero se ocultan.
     </p>
     <div className="overflow-x-auto rounded-xl border border-violet-100 bg-white">
     <table className="min-w-[1100px] w-full text-left text-sm">
      <thead className="bg-violet-50 text-xs uppercase tracking-[0.1em] text-slate-500">
       <tr>
        <th className="px-4 py-3">Producto</th>
        <th className="px-4 py-3">Tipo</th>
        <th className="px-4 py-3">Formula</th>
        <th className="px-4 py-3">P50 historico</th>
        <th className="px-4 py-3">P80</th>
        <th className="px-4 py-3">P95</th>
        <th className="px-4 py-3">Sugerencia</th>
        <th className="px-4 py-3">Registrado</th>
        <th className="px-4 py-3">Resultado</th>
        <th className="px-4 py-3">Pares</th>
        <th className="px-4 py-3">Contexto verificado</th>
        <th className="px-4 py-3">Fuente</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
       {suggestedItems.map((item) => (
        <tr key={`${item.productId}-${item.itemType}`}>
         <td className="px-4 py-3">
          <p className="font-semibold text-slate-900">{item.productName}</p>
          <p className="text-xs text-slate-400">{item.productId}</p>
         </td>
         <td className="px-4 py-3 capitalize text-slate-700">{item.itemType}</td>
         <td className="px-4 py-3 font-semibold text-slate-900">{formatNumber(item.deterministicQuantity, 0)}</td>
         <td className="px-4 py-3 text-slate-700">{formatNumber(item.empiricalRange?.p50, 0)}</td>
         <td className="px-4 py-3 text-slate-700">{formatNumber(item.empiricalRange?.p80, 0)}</td>
         <td className="px-4 py-3 text-slate-700">{formatNumber(item.empiricalRange?.p95, 0)}</td>
         <td className="px-4 py-3 font-bold text-violet-800">{formatNumber(item.suggestedQuantity, 0)}</td>
         <td className="px-4 py-3 font-semibold text-slate-900">{formatNumber(item.registeredQuantity, 0)}</td>
         <td className="px-4 py-3"><LearningBadge feedback={item.learningFeedback} /></td>
         <td className="px-4 py-3 text-slate-700">{item.historical?.peerCount || 0}</td>
         <td className="px-4 py-3 text-xs text-slate-600">
          <p>{item.productKnowledge?.identity?.status === "verified_catalog" ? "Catalogo verificado" : "Solo codigo de proveedor"}</p>
          <p className="mt-1 text-[11px] text-slate-400">
           DET/KIT: {formatNumber(item.productKnowledge?.verifiedSpecifications?.testsPerKit, 0)}
           {" · "}Estabilidad: {formatNumber(item.productKnowledge?.verifiedSpecifications?.stabilityDays, 0)} dias
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
           Perfil observado: {item.productKnowledge?.observedReactiveProfile?.length || 0} reactivo(s)
          </p>
         </td>
         <td className="px-4 py-3 text-xs text-slate-500">
          <p>{item.recommendationSource === "audited_formula" ? "Formula auditada" : item.recommendationSource === "experimental_history" ? "Historial: requiere revision" : "No disponible"}</p>
          {item.historical?.selectedMethod && <p className="mt-1 text-[10px] text-slate-400">{item.historical.selectedMethod}</p>}
         </td>
        </tr>
       ))}
      </tbody>
     </table>
     </div>
    </div>
   ) : (
    <p className="mt-4 rounded-xl border border-dashed border-violet-200 bg-white p-4 text-sm text-slate-600">
     {(model.items || []).length
      ? `Se identificaron ${model.items.length} productos para este equipo, pero todavía no hay cantidad sugerida: el equipo no tiene una fórmula auditada y hay ${model.comparableCases || 0} Business Case(s) comparables con el mismo equipo.`
      : "No hay reactivos, calibradores, controles o materiales identificados para este equipo."}
    </p>
   )}
   <p className="mt-3 text-xs text-slate-500">
    Exactitud operacional = max(0, 100 x (1 - WAPE)) sobre despachos completos, dejando un Business Case fuera por turno. planned_qty solo alimenta sugerencias proxy y no valida el objetivo.
   </p>
  </div>
 );
};

const RULE_STATUS_LABELS = {
 calculated: "Calculado por regla",
 no_rule: "Sin regla",
 unavailable: "Sin fuente de regla",
};

const typeLabel = (value) => ({
 reactivo: "Reactivo",
 calibrador: "Calibrador",
 control: "Control",
 material: "Material",
 consumible: "Consumible",
 electrolito: "Electrolito",
}[value] || value || "Sin tipo");

const ruleStatusForRow = (row) => row.ruleItem?.status || "unavailable";

const QuantityValue = ({ value, unit }) => (
 value === null || value === undefined
  ? <span className="text-[var(--text-secondary)]">No disponible</span>
  : (
   <span className="font-semibold tabular-nums text-[var(--text)]">
    {formatNumber(value, 4)}{unit ? ` ${unit}` : ""}
   </span>
  )
);

const DifferenceSummary = ({ row }) => {
 const ruleQuantity = firstFinite(row.ruleItem?.quantity);
 const comparisons = [
  ["Hoja", row.sheetQuantity],
  ["Histórico", row.historicalQuantity],
 ].filter(([, value]) => value !== null && value !== undefined);
 if (ruleQuantity === null || !comparisons.length) {
  return <span className="text-[var(--text-secondary)]">Sin comparación</span>;
 }
 return (
  <div className="space-y-1">
   {comparisons.map(([label, value]) => {
    const delta = ruleQuantity - Number(value);
    const differs = delta !== 0;
    return (
     <span
      key={label}
      className={`block w-fit rounded-[var(--radius-badge)] px-2 py-0.5 text-xs font-semibold ${
       differs
        ? "bg-[var(--warning-bg)] text-[var(--warning-text)]"
        : "bg-[var(--success-bg)] text-[var(--success-text)]"
      }`}
     >
      {label}: {differs ? `${delta > 0 ? "+" : ""}${formatNumber(delta, 4)}` : "Coincide"}
     </span>
    );
   })}
  </div>
 );
};

// Respuestas anteriores a las dos fuentes traen una sola regla: se muestra como formula validada.
const sourceOf = (item, key) => {
 if (!item) return null;
 if (item.sources) return item.sources[key] || null;
 return key === "auditedFormula" ? item : null;
};
const sourceQuantity = (source) => (source?.status === "calculated" ? firstFinite(source.quantity) : null);

const RECIPE_BASIS_LABELS = {
 per_event: "Un envase por uso",
 per_event_single_use: "Envase de un solo uso",
 stability_capped: "Limitado por vencimiento",
 stability_only: "Solo por vencimiento",
 equipment_manual: "Manual del equipo",
};

const SourceQuantity = ({ source }) => {
 const quantity = sourceQuantity(source);
 if (quantity === null) {
  return <span className="text-xs text-[var(--text-secondary)]">{source?.reason?.message ? "Sin dato" : "No disponible"}</span>;
 }
 // Receta del documento oficial: usos previstos y envases que se abren, no la presentación.
 if (source.containers !== null && source.containers !== undefined && source.source === "official_document") {
  return (
   <span className="block">
    <span className="block font-semibold tabular-nums text-[var(--text)]">{formatNumber(source.containers, 4)} envase(s)</span>
    <span className="block text-xs text-[var(--text-secondary)]">
     {source.uses ? `${formatNumber(source.uses, 4)} uso(s)` : RECIPE_BASIS_LABELS[source.basis] || "No se usa en este proceso"}
    </span>
   </span>
  );
 }
 // La unidad larga va en el detalle; en la columna solo cabe una corta.
 return <QuantityValue value={quantity} unit={String(source.unit || "").length <= 12 ? source.unit : undefined} />;
};

const AGREEMENT_LABELS = {
 match: "Las dos fuentes coinciden",
 differs: "Las fuentes difieren",
 single_source: "Una sola fuente",
 none: "Sin fuente calculable",
};

const SourceBlock = ({ title, source }) => (
 <div className="rounded-[var(--radius-control)] border border-[var(--border)] p-3">
  <p className="font-semibold text-[var(--text)]">{title}</p>
  {source?.status === "calculated" ? (
   <div className="mt-1 space-y-1 text-[var(--text-secondary)]">
    <p className="whitespace-pre-wrap">{formatDetailValue(source.formula)}</p>
    {source.unit && <p>Unidad: {source.unit}</p>}
    {source.basis && <p>Base: {RECIPE_BASIS_LABELS[source.basis] || source.basis}</p>}
    {source.annualAuditedQuantity !== null && source.annualAuditedQuantity !== undefined && (
     <p>Fórmula anual auditada (360 días): {formatDetailValue(source.annualAuditedQuantity)}</p>
    )}
    {source.rule?.source?.title && <p>Fuente: {source.rule.source.title}</p>}
    {(source.incomplete || []).length > 0 && <p>Dato que la ficha no declara: {source.incomplete.join(", ")}</p>}
   </div>
  ) : (
   <p className="mt-1 text-[var(--text-secondary)]">{source?.reason?.message || "No disponible."}</p>
  )}
 </div>
);

const RuleDetail = ({ row }) => {
 const item = row.ruleItem;
 const detailId = `rule-detail-${row.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
 if (!item) return <span className="text-xs text-[var(--text-secondary)]">Sin detalle</span>;
 const inputs = inputDetailRows(item.inputs);
 return (
  <details className="group">
   <summary
    className="cursor-pointer rounded-[var(--radius-control)] px-2 py-1 text-sm font-semibold text-[var(--action)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
    aria-controls={detailId}
   >
    Ver detalle
   </summary>
   <div id={detailId} className="mt-3 min-w-[280px] space-y-4 border-l-2 border-[var(--border)] pl-3 text-sm">
    <div>
     <div className="space-y-2">
      <SourceBlock title="Fuente 1 · Fórmula validada" source={sourceOf(item, "auditedFormula")} />
      <SourceBlock title="Fuente 2 · Documento oficial del producto" source={sourceOf(item, "officialDocument")} />
     </div>
     {item.agreement?.status && (
      <p className="mt-2 text-[var(--text-secondary)]">{AGREEMENT_LABELS[item.agreement.status] || item.agreement.status}</p>
     )}
     {item.validation?.status === "pending_expert" && (
      <div className="mt-2 rounded-[var(--radius-control)] bg-[var(--warning-bg)] p-2 text-[var(--warning-text)]">
       <p className="font-semibold">Pendiente de validación por Aplicaciones</p>
       <ul className="mb-0 mt-1 list-disc pl-5">
        {(item.validation.conventions || []).map((convention) => <li key={convention}>{convention}</li>)}
       </ul>
      </div>
     )}
    </div>

    <div>
     <p className="font-semibold text-[var(--text)]">Entradas y origen</p>
     <dl className="mt-2 divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
      {inputs.map((input) => (
       <div key={input.label} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(150px,1fr)_minmax(120px,1fr)]">
        <dt className="font-medium text-[var(--text)]">{input.label}</dt>
        <dd className="text-[var(--text-secondary)]">
         <span className="block break-words">{formatDetailValue(input.value)}</span>
         {input.origin && <span className="block text-xs">Origen: {input.origin}</span>}
        </dd>
       </div>
      ))}
     </dl>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
     <div>
      <p className="font-semibold text-[var(--text)]">Ficha vigente</p>
      <p className="mt-1 text-[var(--text-secondary)]">
       {item.specVersion
        ? `ID ${item.specVersion.id} · vigente desde ${item.specVersion.validFrom || "fecha no disponible"}`
        : "Sin ficha vigente"}
      </p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
       Estado: {item.verification?.specStatus || "missing"} · Cálculo {item.verification?.calculationVerified ? "verificado" : "no verificado"}
      </p>
     </div>
     <div>
      <p className="font-semibold text-[var(--text)]">Documento de origen</p>
      {item.source?.url ? (
       <a
        href={item.source.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex items-center gap-1 text-[var(--action)] underline underline-offset-2"
       >
        {item.source.title || item.source.documentId || "Abrir documento"}
        {item.source.documentVersion ? ` v${item.source.documentVersion}` : ""}
        <FiExternalLink aria-hidden="true" size={14} />
       </a>
      ) : (
       <p className="mt-1 text-[var(--text-secondary)]">Documento no disponible</p>
      )}
     </div>
    </div>
   </div>
  </details>
 );
};

const RECIPE_GROUP_LABELS = { calibradores: "calibradores", controles: "controles", materiales: "materiales" };

// Receta: lo que la ficha vigente de cada reactivo con demanda dice que necesita para funcionar.
const RecipesPanel = ({ recipes }) => {
 const active = (recipes || []).filter((recipe) => recipe.active);
 if (!active.length) return null;
 const complete = active.filter((recipe) => recipe.complete).length;
 return (
  <details className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]">
   <summary className="cursor-pointer rounded-[var(--radius-panel)] px-4 py-3 text-sm font-semibold text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
    Recetas por reactivo · {active.length} con demanda · {complete} completa(s)
   </summary>
   <div className="space-y-3 border-t border-[var(--border)] p-4 text-sm">
    <p className="text-xs text-[var(--text-secondary)]">
     Se arman desde la ficha vigente del fabricante en cada lectura: si la ficha cambia, la receta cambia sola.
     Un calibrador suma las calibraciones de todos los reactivos que lo usan; un control toma la mayor cantidad de corridas.
    </p>
    {active.map((recipe) => (
     <div key={recipe.reagentCode} className="rounded-[var(--radius-control)] border border-[var(--border)] p-3">
      <p className="font-semibold text-[var(--text)]">
       {recipe.reagentName || recipe.reagentCode}
       <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
        {recipe.reagentCode} · {recipe.reagentQuantity === null ? "sin cantidad" : `${formatNumber(recipe.reagentQuantity, 4)} kit(s)`}
       </span>
      </p>
      <p className="mb-0 mt-1 text-xs text-[var(--text-secondary)]">
       {recipe.events?.calibrationEvents === null || recipe.events?.calibrationEvents === undefined
        ? "La ficha no declara cada cuánto se calibra"
        : `${formatNumber(recipe.events.calibrationEvents, 4)} calibración(es)`}
       {" · "}
       {recipe.events?.qcRuns === null || recipe.events?.qcRuns === undefined
        ? "la ficha no declara cada cuánto se corre control"
        : `${formatNumber(recipe.events.qcRuns, 4)} corrida(s) de control`}
       {(recipe.events?.notCounted || []).includes("reagent_lot_change") ? " · no incluye calibraciones por cambio de lote" : ""}
      </p>
      {recipe.components.length > 0 ? (
       <ul className="mb-0 mt-2 space-y-1 pl-0 text-[var(--text-secondary)]">
        {recipe.components.map((component) => (
         <li key={`${component.itemType}-${component.supplierCode}`} className="flex flex-wrap justify-between gap-2">
          <span>{typeLabel(component.itemType)} · {component.name || component.supplierCode}</span>
          <span className="tabular-nums">
           {component.usesFromReagent !== null && component.usesFromReagent !== undefined ? `${formatNumber(component.usesFromReagent, 4)} uso(s) de este reactivo · ` : ""}
           {component.containers !== null && component.containers !== undefined
            ? `${formatNumber(component.containers, 4)} envase(s) en total${component.uses ? ` para ${formatNumber(component.uses, 4)} uso(s)` : ""}`
            : component.reason || "Sin cantidad calculable"}
          </span>
         </li>
        ))}
       </ul>
      ) : (
       <p className="mb-0 mt-2 text-[var(--text-secondary)]">
        {recipe.specVersionId ? "La ficha no vincula productos a este reactivo." : "El reactivo no tiene ficha vigente."}
       </p>
      )}
      {recipe.specVersionId && recipe.missingGroups.length > 0 && recipe.components.length > 0 && (
       <p className="mb-0 mt-2 text-xs text-[var(--warning-text)]">
        La ficha no declara: {recipe.missingGroups.map((group) => RECIPE_GROUP_LABELS[group] || group).join(", ")}.
       </p>
      )}
     </div>
    ))}
   </div>
  </details>
 );
};

const CONVENTION_FIELDS = [
 ["demandBasis", "Demanda registrada", [["annual", "Es anual (privado: promedio mensual × 12)"], ["process", "Es la de todo el proceso (público)"]]],
 ["reagentStability", "Vencimiento del reactivo a bordo", [["ignored", "No se repone por vencimiento"], ["counted", "Se repone al vencer"]]],
 ["reagentQcTests", "Pruebas de control y calibración", [["excluded", "Ya están en la demanda"], ["included", "Sumarlas a la demanda"]]],
 ["qcBasis", "Frecuencia de control", [["document", "Según la ficha del reactivo"], ["laboratory", "Según el laboratorio"]]],
 ["conservation", "Conservación de calibradores y controles", [["document_best", "Alicuotar y congelar si la ficha lo permite"], ["open", "Envase abierto hasta vencer"]]],
];
const CONTROL_CLASS = "mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-control)] bg-[var(--surface)] px-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--focus)]";

// Convenciones que Aplicaciones aún no confirma: cambiarlas recalcula sin guardar nada.
const ConventionsPanel = ({ active, overrides, onChange, onReset, busy }) => (
 <section aria-labelledby="conventions-title" className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
   <div>
    <h3 id="conventions-title" className="font-semibold text-[var(--text)]">Convenciones del cálculo</h3>
    <p className="mt-1 text-sm text-[var(--text-secondary)]">
     Pendientes de confirmar con Aplicaciones. Cambiarlas recalcula la vista; no guarda nada.{busy ? " Recalculando…" : ""}
    </p>
   </div>
   {Object.keys(overrides).length > 0 && (
    <button
     type="button"
     onClick={onReset}
     className="min-h-10 rounded-[var(--radius-control)] border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
    >
     Volver a las convenciones por defecto
    </button>
   )}
  </div>
  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
   {CONVENTION_FIELDS.map(([field, label, options]) => (
    <label key={field} className="text-sm font-medium text-[var(--text)]">
     {label}
     <select value={active?.[field] || options[0][0]} onChange={(event) => onChange(field, event.target.value)} className={CONTROL_CLASS}>
      {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
     </select>
    </label>
   ))}
   <label className="text-sm font-medium text-[var(--text)]">
    Lotes de reactivo por año
    <select
     value={active?.reagentLotsPerYear || ""}
     onChange={(event) => onChange("reagentLotsPerYear", event.target.value ? Number(event.target.value) : null)}
     className={CONTROL_CLASS}
    >
     <option value="">No contar cambios de lote</option>
     {[1, 2, 3, 4, 6, 12].map((value) => <option key={value} value={value}>{value}</option>)}
    </select>
   </label>
  </div>
 </section>
);

const accuracyText = (measure) => (
 measure?.accuracyPercent === null || measure?.accuracyPercent === undefined
  ? "sin casos"
  : `${formatNumber(measure.accuracyPercent, 1)} % (${measure.exact} de ${measure.cases} exactos)`
);

// Exactitud contra los casos validados de este Business Case.
const AccuracyPanel = ({ accuracy }) => {
 if (!accuracy) return null;
 return (
  <div className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
   <p className="font-semibold text-[var(--text)]">
    Exactitud medida · meta {formatNumber(accuracy.targetPercent, 1)} % · {accuracy.validatedCount} producto(s) validado(s)
   </p>
   {accuracy.validatedCount > 0 ? (
    <dl className="mb-0 mt-2 grid gap-2 text-[var(--text-secondary)] sm:grid-cols-2 xl:grid-cols-4">
     {[
      ["Cantidad principal", accuracy.primaryQuantity],
      ["Fórmula validada", accuracy.auditedFormula],
      ["Documento oficial", accuracy.officialDocument],
      ["Con ajuste aprendido", accuracy.learned],
     ].map(([label, measure]) => (
      <div key={label}>
       <dt className="font-medium text-[var(--text)]">{label}</dt>
       <dd className="mb-0">{accuracyText(measure)}</dd>
      </div>
     ))}
    </dl>
   ) : (
    <p className="mb-0 mt-1 text-[var(--text-secondary)]">
     Aún no hay cantidades validadas. Valide productos en la columna "Validación" para medir contra la meta.
    </p>
   )}
  </div>
 );
};

// Datos que faltan en las fichas del fabricante, ordenados por impacto.
const DataGapsPanel = ({ gaps }) => {
 if (!gaps?.length) return null;
 const blocking = gaps.filter((gap) => gap.blocks).length;
 return (
  <details className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]">
   <summary className="cursor-pointer rounded-[var(--radius-panel)] px-4 py-3 text-sm font-semibold text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
    Fichas incompletas · {gaps.length} dato(s) faltante(s) · {blocking} impiden calcular
   </summary>
   <div className="max-h-96 overflow-auto border-t border-[var(--border)]">
    <table className="w-full text-left text-sm">
     <caption className="sr-only">Datos faltantes en las fichas del fabricante, ordenados por impacto</caption>
     <thead className="bg-[var(--surface-subtle)] text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">
      <tr>
       <th scope="col" className="px-4 py-2">Producto</th>
       <th scope="col" className="px-4 py-2">Tipo</th>
       <th scope="col" className="px-4 py-2">Qué falta</th>
       <th scope="col" className="px-4 py-2">Efecto</th>
      </tr>
     </thead>
     <tbody className="divide-y divide-[var(--border)]">
      {gaps.map((gap) => (
       <tr key={`${gap.itemType}-${gap.supplierCode}-${gap.code}`}>
        <td className="px-4 py-2">
         <span className="font-medium text-[var(--text)]">{gap.name || gap.supplierCode}</span>
         <span className="block text-xs text-[var(--text-secondary)]">{gap.supplierCode}</span>
        </td>
        <td className="px-4 py-2 text-[var(--text-secondary)]">{typeLabel(gap.itemType)}</td>
        <td className="px-4 py-2 text-[var(--text-secondary)]">{gap.message}</td>
        <td className="px-4 py-2">
         <span className={`inline-flex rounded-[var(--radius-badge)] px-2 py-0.5 text-xs font-semibold ${
          gap.blocks ? "bg-[var(--warning-bg)] text-[var(--warning-text)]" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
         }`}
         >
          {gap.blocks ? "Impide calcular" : "Resta precisión"}
         </span>
        </td>
       </tr>
      ))}
     </tbody>
    </table>
   </div>
  </details>
 );
};

// Validar la cantidad de un producto: confirma la calculada o registra la correcta.
const ValidationCell = ({ row, onSave, onRemove }) => {
 const item = row.ruleItem;
 const validation = item?.expertValidation || null;
 const [value, setValue] = useState("");
 const [busy, setBusy] = useState(false);
 if (!item?.supplierCode) return <span className="text-xs text-[var(--text-secondary)]">Sin código</span>;
 const predicted = item.status === "calculated" ? firstFinite(item.quantity) : null;
 const run = async (action) => { setBusy(true); try { await action(); setValue(""); } finally { setBusy(false); } };
 const buttonClass = "min-h-9 rounded-[var(--radius-control)] border border-[var(--border-control)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:opacity-60";
 return (
  <div className="min-w-[150px] space-y-2 text-xs">
   {validation && (
    <p className={`mb-0 w-fit rounded-[var(--radius-badge)] px-2 py-0.5 font-semibold ${
     validation.matches ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]"
    }`}
    >
     {validation.origin === "dispatch" ? "Despachado" : "Validado"}: {formatNumber(validation.validatedQuantity, 4)}
     {validation.matches ? " · coincide" : ""}
    </p>
   )}
   {item.learned && (
    <p className="mb-0 text-[var(--text-secondary)]">
     {item.learned.applicable
      ? `Ajuste aprendido: ${formatNumber(item.learned.adjustedQuantity, 4)} (× ${formatNumber(item.learned.factor, 2)}, ${item.learned.cases} casos)`
      : `${item.learned.cases} de ${item.learned.minCases} casos para aprender un ajuste`}
    </p>
   )}
   <div className="flex flex-wrap items-center gap-1">
    {predicted !== null && !validation?.matches && (
     <button type="button" disabled={busy} className={buttonClass} onClick={() => run(() => onSave(row, predicted))}>
      Es correcta
     </button>
    )}
    <label className="sr-only" htmlFor={`validate-${row.key}`}>Cantidad correcta de {row.name}</label>
    <input
     id={`validate-${row.key}`}
     type="number"
     min="0"
     step="any"
     value={value}
     onChange={(event) => setValue(event.target.value)}
     placeholder="Corregir"
     className="min-h-9 w-20 rounded-[var(--radius-control)] border border-[var(--border-control)] bg-[var(--surface)] px-2 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--focus)]"
    />
    <button type="button" disabled={busy || value === "" || Number(value) < 0} className={buttonClass} onClick={() => run(() => onSave(row, Number(value)))}>
     Guardar
    </button>
    {validation?.origin === "expert" && (
     <button type="button" disabled={busy} className={buttonClass} onClick={() => run(() => onRemove(row))}>
      Quitar
     </button>
    )}
   </div>
  </div>
 );
};

const SIMULATION_SIZES = [5000, 10000, 20000];

// Entregas P90 sumadas por año del proceso (cada trimestre ya va redondeado).
const deliveriesByYear = (quarters = []) => {
 const years = new Map();
 quarters.forEach((quarter) => {
  const year = Math.floor((quarter.fromMonth - 1) / 12) + 1;
  years.set(year, (years.get(year) || 0) + (Number(quarter.p90) || 0));
 });
 return [...years.entries()].map(([year, p90]) => ({ year, p90 }));
};

const SimulationProducts = ({ products, filters }) => {
 const query = String(filters.query || "").trim().toLocaleLowerCase("es");
 const visible = products.filter((product) => {
  if (filters.itemType && product.itemType !== filters.itemType) return false;
  if (query && !`${product.name} ${product.supplierCode}`.toLocaleLowerCase("es").includes(query)) return false;
  return true;
 });
 if (!visible.length) return <p className="mb-0 text-sm text-[var(--text-secondary)]">Ningún producto simulado coincide con los filtros.</p>;
 const cell = "px-3 py-2 text-right tabular-nums";
 return (
  <div className="max-h-[32rem] overflow-auto rounded-[var(--radius-control)] border border-[var(--border)]">
   <table className="min-w-[1240px] w-full text-left text-sm">
    <caption className="sr-only">Distribución de cantidades por producto en los escenarios simulados</caption>
    <thead className="sticky top-0 bg-[var(--surface-subtle)] text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">
     <tr>
      <th scope="col" className="px-3 py-2">Producto</th>
      <th scope="col" className="px-3 py-2">Tipo</th>
      <th scope="col" className="px-3 py-2 text-right">Predicción</th>
      <th scope="col" className="px-3 py-2 text-right">Cálculo actual</th>
      <th scope="col" className="px-3 py-2 text-right">P10</th>
      <th scope="col" className="px-3 py-2 text-right">P50</th>
      <th scope="col" className="px-3 py-2 text-right">P90 (recomendado)</th>
      <th scope="col" className="px-3 py-2 text-right">P95</th>
      <th scope="col" className="px-3 py-2">Clientes parecidos</th>
      <th scope="col" className="px-3 py-2">Entregas por año (P90)</th>
     </tr>
    </thead>
    <tbody className="divide-y divide-[var(--border)]">
     {visible.map((product) => (
      <tr key={product.key} className="align-top">
       <td className="px-3 py-2">
        <span className="font-medium text-[var(--text)]">{product.name || product.supplierCode}</span>
        <span className="block text-xs text-[var(--text-secondary)]">{product.supplierCode} · {product.unit}</span>
       </td>
       <td className="px-3 py-2 text-[var(--text-secondary)]">{typeLabel(product.itemType)}</td>
       <td className={`${cell} font-semibold text-[var(--text)]`}>
        {formatNumber(product.prediction?.quantity ?? product.p90, 2)}
        <span className="block text-xs font-normal text-[var(--text-secondary)]">
         {product.fromSheet
          ? "DET/AÑO del Sheet"
          : product.prediction?.basis === "calibrated_by_similar_clients"
           ? `Ajustada con ${product.prediction.calibratedWith} cliente(s) parecido(s)`
           : product.prediction?.basis === "validated_formula" ? "Fórmula validada"
            : product.prediction?.basis === "client_history" ? "Entregado en el proceso anterior"
            : String(product.prediction?.basis || "").startsWith("reference_") ? "Consumo real de otros clientes"
            : product.prediction?.basis === "equipment_manual" ? "Manual del equipo"
             : product.prediction?.basis === "calibrated_scenarios" ? "Mediana de escenarios calibrados con procesos reales"
              : product.prediction?.basis === "simulation_p50" ? "Mediana de la simulación" : "P90 de la simulación"}
        </span>
       </td>
       <td className={cell}>{product.deterministicQuantity === null ? "—" : formatNumber(product.deterministicQuantity, 2)}</td>
       <td className={cell}>{formatNumber(product.p10, 2)}</td>
       <td className={cell}>{formatNumber(product.p50, 2)}</td>
       <td className={`${cell} font-semibold text-[var(--text)]`}>{formatNumber(product.p90, 2)}</td>
       <td className={cell}>{formatNumber(product.p95, 2)}</td>
       <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">
        {product.similar
         ? (
          <>
           <span className="block">{product.similar.clients} cliente(s): P50 {formatNumber(product.similar.p50, 2)} · P90 {formatNumber(product.similar.p90, 2)}</span>
           {product.similar.validatedClients > 0 && <span className="block">Validado en {product.similar.validatedClients}: {formatNumber(product.similar.validated, 2)}</span>}
          </>
         )
         : "Sin clientes parecidos"}
       </td>
       <td className="min-w-[180px] px-3 py-2 text-xs text-[var(--text-secondary)]">
        <span className="block">{deliveriesByYear(product.deliveriesByQuarter).map((year) => `Año ${year.year}: ${formatNumber(year.p90, 2)}`).join(" · ")}</span>
        {(product.deliveriesByQuarter || []).length > 1 && (
         <details>
          <summary className="cursor-pointer text-[var(--action)]">Por trimestre</summary>
          {product.deliveriesByQuarter.map((quarter) => `M${quarter.fromMonth}-${quarter.toMonth}: ${formatNumber(quarter.p90, 2)}`).join(" · ")}
         </details>
        )}
       </td>
      </tr>
     ))}
    </tbody>
   </table>
  </div>
 );
};

// Simulación Monte Carlo: el consumo en miles de escenarios distintos del laboratorio.
const AUTOMATIC_LABELS = {
 simulated: "Se simuló ahora porque cambiaron las estadísticas del cliente.",
 current: "Al día: las estadísticas del cliente no cambiaron desde la última simulación.",
 no_statistics: "Aún no hay estadísticas del cliente (reactivos con demanda, plazo y equipo): se simulará sola cuando existan.",
 manual: "Recalculada a pedido con las convenciones de la pantalla.",
};

const SimulationHistory = ({ history }) => {
 if (!history?.length) return null;
 return (
  <details className="rounded-[var(--radius-control)] border border-[var(--border)]">
   <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
    Historial de simulaciones ({history.length})
   </summary>
   <ul className="mb-0 space-y-1 border-t border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)]">
    {history.map((run) => (
     <li key={run.id}>
      {run.createdAt ? new Date(run.createdAt).toLocaleString("es-EC") : "—"} · {run.trigger === "auto" ? "automática" : `manual (${run.createdBy || "—"})`} · {formatNumber(run.scenarios, 0)} escenarios · P90 total: {formatNumber(run.p90Totals?.reactivo, 0)} kits, {formatNumber(run.p90Totals?.calibrador, 0)} calibradores, {formatNumber(run.p90Totals?.control, 0)} controles, {formatNumber(run.p90Totals?.material, 0)} materiales
     </li>
    ))}
   </ul>
  </details>
 );
};

const SimulationPanel = ({ simulation, busy, error, onRun, filters }) => {
 const [size, setSize] = useState(SIMULATION_SIZES[0]);
 const equipment = simulation?.equipment || [];
 return (
  <section aria-labelledby="simulation-title" className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4">
   <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
    <div className="max-w-3xl">
     <h3 id="simulation-title" className="font-semibold text-[var(--text)]">Simulación de escenarios</h3>
     <p className="mb-0 mt-1 text-sm text-[var(--text-secondary)]">
      Automática: cuando el cliente tiene estadísticas y cambian, se simulan solos al menos 5.000 escenarios del laboratorio (demanda, repeticiones, controles fuera de rango, recalibraciones, cambios de lote, frecuencias de control, conservación y entregas en el tiempo). Cada simulación queda en el historial y alimenta la predicción de clientes parecidos. No escribe en la oferta.
     </p>
     {simulation?.automatic?.status && AUTOMATIC_LABELS[simulation.automatic.status] && (
      <p className="mb-0 mt-1 text-sm font-medium text-[var(--text)]">{AUTOMATIC_LABELS[simulation.automatic.status]}</p>
     )}
    </div>
    <div className="flex flex-wrap items-end gap-2">
     <label className="text-sm font-medium text-[var(--text)]">
      Recalcular con las convenciones de la pantalla (opcional)
      <select value={size} onChange={(event) => setSize(Number(event.target.value))} className={CONTROL_CLASS}>
       {SIMULATION_SIZES.map((value) => <option key={value} value={value}>{formatNumber(value, 0)}</option>)}
      </select>
     </label>
     <button
      type="button"
      onClick={() => onRun(size)}
      disabled={busy}
      className="min-h-10 rounded-[var(--radius-control)] bg-[var(--action)] px-4 text-sm font-semibold text-[var(--action-text,#fff)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:opacity-60"
     >
      {busy ? "Simulando…" : `Recalcular ${formatNumber(size, 0)} escenarios`}
     </button>
    </div>
   </div>
   {error && <p className="mb-0 mt-3 rounded-[var(--radius-control)] bg-[var(--warning-bg)] p-2 text-sm text-[var(--warning-text)]">{error}</p>}
   {!equipment.length && !busy && (
    <p className="mb-0 mt-3 text-sm text-[var(--text-secondary)]">Este Business Case aún no tiene simulación.</p>
   )}
   {equipment.map((entry) => (
    <div key={entry.equipmentId} className="mt-4 space-y-3">
     <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="mb-0 font-semibold text-[var(--text)]">{entry.equipmentName || entry.equipmentCode}</p>
      <p className="mb-0 text-xs text-[var(--text-secondary)]">
       {entry.trigger === "auto" ? "Automática" : "Manual"} · {formatNumber(entry.scenarios, 0)} escenarios · semilla {entry.seed} · {formatNumber(entry.durationMs / 1000, 1)} s
       {entry.createdAt ? ` · ${new Date(entry.createdAt).toLocaleString("es-EC")}` : ""}
      </p>
     </div>
     <p className="mb-0 text-sm text-[var(--text-secondary)]">
      Perfil del cliente: {formatNumber(entry.profile?.monthlyDemand, 0)} pruebas/mes · {entry.profile?.months} meses · {entry.profile?.reagentCount} reactivo(s) · {entry.profile?.workDaysPerWeek || "—"} días/semana · {entry.profile?.shifts || "—"} turno(s)
     </p>
     <p className="mb-0 text-sm text-[var(--text-secondary)]">
      {entry.coverage?.validatedCount
       ? `Contra lo validado: ${entry.coverage.withinP10P90} de ${entry.coverage.validatedCount} caen entre P10 y P90 · exactitud de la predicción ${accuracyText(entry.coverage.prediction)} · del P50 ${accuracyText(entry.coverage.p50)} · del P90 ${accuracyText(entry.coverage.p90)}`
       : "Sin cantidades validadas para medir la cobertura de la simulación."}
     </p>
     <details className="rounded-[var(--radius-control)] border border-[var(--border)]">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
       Clientes con estadística parecida ({(entry.similarClients || []).length})
      </summary>
      <ul className="mb-0 space-y-1 border-t border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)]">
       {(entry.similarClients || []).length ? entry.similarClients.map((client) => (
        <li key={client.businessCaseId}>
         {client.clientName || client.businessCaseId} · distancia {formatNumber(client.distance, 2)} · {formatNumber(client.profile?.monthlyDemand, 0)} pruebas/mes · {client.profile?.months} meses
        </li>
       )) : <li>Aún no hay otros clientes simulados con este equipo.</li>}
      </ul>
     </details>
     <details className="rounded-[var(--radius-control)] border border-[var(--border)]">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
       Variables de cada escenario ({(entry.variables || []).length})
      </summary>
      <ul className="mb-0 space-y-1 border-t border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)]">
       {(entry.variables || []).map((variable) => <li key={variable.key}>{variable.label}: {variable.range}</li>)}
      </ul>
     </details>
     <SimulationHistory history={entry.history} />
     <SimulationProducts products={entry.products || []} filters={filters} />
    </div>
   ))}
  </section>
 );
};

const ComparisonTable = ({ rows, onSaveValidation, onRemoveValidation }) => {
 if (!rows.length) {
  return (
   <p className="rounded-[var(--radius-panel)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
    Ningún producto coincide con los filtros seleccionados.
   </p>
  );
 }
 return (
  <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]">
   <table className="min-w-[1380px] w-full text-left text-sm">
    <caption className="sr-only">Comparación de cantidades por producto entre fórmula validada, documento oficial, hoja e histórico</caption>
    <thead className="bg-[var(--surface-subtle)] text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">
     <tr>
      <th scope="col" className="px-4 py-3">Producto</th>
      <th scope="col" className="px-4 py-3">Tipo</th>
      <th scope="col" className="px-4 py-3 text-right">Fórmula validada</th>
      <th scope="col" className="px-4 py-3 text-right">Documento oficial</th>
      <th scope="col" className="px-4 py-3 text-right">Hoja</th>
      <th scope="col" className="px-4 py-3 text-right">Histórico</th>
      <th scope="col" className="px-4 py-3">Diferencia</th>
      <th scope="col" className="px-4 py-3">Estado</th>
      <th scope="col" className="px-4 py-3">Validación</th>
      <th scope="col" className="px-4 py-3">Trazabilidad</th>
     </tr>
    </thead>
    <tbody className="divide-y divide-[var(--border)]">
     {rows.map((row) => {
      const status = ruleStatusForRow(row);
      const verified = row.ruleItem?.verification?.calculationVerified === true;
      return (
       <tr key={row.key} className="align-top hover:bg-[var(--surface-subtle)]">
        <td className="px-4 py-3">
         <p className="font-semibold text-[var(--text)]">{row.name}</p>
         <p className="mt-1 text-xs text-[var(--text-secondary)]">{row.supplierCode || "Sin código de proveedor"}</p>
        </td>
        <td className="px-4 py-3 text-[var(--text-secondary)]">{typeLabel(row.itemType)}</td>
        <td className="px-4 py-3 text-right"><SourceQuantity source={sourceOf(row.ruleItem, "auditedFormula")} /></td>
        <td className="px-4 py-3 text-right"><SourceQuantity source={sourceOf(row.ruleItem, "officialDocument")} /></td>
        <td className="px-4 py-3 text-right">
         {row.sheetValues.length > 1 && row.sheetQuantity === null
          ? <span className="text-[var(--text-secondary)]">{row.sheetValues.map((value) => formatNumber(value, 4)).join(" / ")}</span>
          : <QuantityValue value={row.sheetQuantity} />}
        </td>
        <td className="px-4 py-3 text-right"><QuantityValue value={row.historicalQuantity} /></td>
        <td className="px-4 py-3"><DifferenceSummary row={row} /></td>
        <td className="px-4 py-3">
         <span className={`inline-flex rounded-[var(--radius-badge)] px-2 py-1 text-xs font-semibold ${
          status === "calculated"
           ? "bg-[var(--success-bg)] text-[var(--success-text)]"
           : "bg-[var(--warning-bg)] text-[var(--warning-text)]"
         }`}
         >
          {RULE_STATUS_LABELS[status] || status}
         </span>
         <span className="mt-1 block text-xs text-[var(--text-secondary)]">
          {verified ? "Cálculo verificado" : "Cálculo no verificado"}
         </span>
         {row.ruleItem?.demandSource === "sheet" && (
          <span className="mt-1 block text-xs font-semibold text-[var(--text)]">Demanda real (DET/AÑO del Sheet)</span>
         )}
         {["match", "differs"].includes(row.ruleItem?.agreement?.status) && (
          <span className="mt-1 block text-xs text-[var(--text-secondary)]">
           {AGREEMENT_LABELS[row.ruleItem.agreement.status]}
          </span>
         )}
        </td>
        <td className="px-4 py-3">
         {onSaveValidation
          ? <ValidationCell row={row} onSave={onSaveValidation} onRemove={onRemoveValidation} />
          : null}
        </td>
        <td className="px-4 py-3"><RuleDetail row={row} /></td>
       </tr>
      );
     })}
    </tbody>
   </table>
  </div>
 );
};

const EquipmentCard = ({ entry, rows, defaultOpen = false, onSaveValidation, onRemoveValidation }) => (
 <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
  <details open={defaultOpen || undefined}>
   <summary className="cursor-pointer list-none border-b border-[var(--border)] bg-[var(--surface)] p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
     <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Equipo</p>
      <h3 className="mt-1 text-lg font-bold text-[var(--text)]">{entry.equipmentName}</h3>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
       {`Reactivos: DET/AÑO/PROCESO del Sheet (${entry.ruleEngine?.summary?.reagentsFromSheetCount || 0} en uso) · se predicen calibradores, controles y materiales · `}
       {rows.length} producto(s) · {entry.ruleEngine?.summary?.calculatedCount || 0} calculado(s) · {entry.ruleEngine?.summary?.noRuleCount || 0} sin regla · fórmula validada {entry.ruleEngine?.summary?.auditedFormulaCount || 0} · documento oficial {entry.ruleEngine?.summary?.officialDocumentCount || 0}
      </p>
     </div>
     <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLES[entry.status] || STATUS_STYLES.unsupported}`}>
      {STATUS_LABELS[entry.status] || entry.status}
     </span>
    </div>
   </summary>

   <div className="space-y-5 p-5">
    <div>
     <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Comparación por producto</p>
      <p className="text-xs text-[var(--text-secondary)]">Regla en modo sombra · no escribe en la oferta</p>
     </div>
     <ComparisonTable
      rows={rows}
      onSaveValidation={onSaveValidation ? (row, quantity) => onSaveValidation(entry, row, quantity) : null}
      onRemoveValidation={onRemoveValidation ? (row) => onRemoveValidation(entry, row) : null}
     />
    </div>

    <AccuracyPanel accuracy={entry.ruleEngine?.accuracy} />
    <RecipesPanel recipes={entry.ruleEngine?.recipes} />
    <DataGapsPanel gaps={entry.ruleEngine?.dataGaps} />

    <div>
     <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Entradas trazadas</p>
     <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Object.entries(entry.inputs || {}).map(([key, value]) => (
       <div key={key} className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-xs text-slate-500">{INPUT_LABELS[key] || key}</p>
        <p className="mt-1 text-base font-bold text-slate-900">{formatNumber(value, 4)}</p>
        <p className="mt-1 truncate text-[11px] text-slate-400" title={entry.inputEvidence?.[key]?.source}>
         {entry.inputEvidence?.[key]?.source || "Sin fuente"}
        </p>
       </div>
      ))}
     </div>
    </div>

    <MessageList title="Bloqueos" items={entry.blockers} tone={entry.status === "quarantined" ? "rose" : "amber"} />
    <MessageList title="Advertencias" items={entry.warnings} />
    <details className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]">
     <summary className="cursor-pointer rounded-[var(--radius-panel)] px-4 py-3 text-sm font-semibold text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
      Ver precios, métricas históricas y proyección auditada
     </summary>
     <div className="space-y-5 border-t border-[var(--border)] p-4">
      <PredictiveModelPanel model={entry.predictiveModel} />
      {entry.calculation && (
       <>
        <div>
         <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Precios de proceso</p>
         <PriceGrid prices={entry.calculation.processPrices} />
        </div>
        <div>
         <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Proyección por producto</p>
          <p className="text-xs text-slate-400">{entry.calculation.traceCount} reglas trazadas</p>
         </div>
         <ItemsTable items={entry.calculation.items} />
        </div>
       </>
      )}
     </div>
    </details>
   </div>
  </details>
 </section>
);

export default function PricingLabSection() {
 const { id: businessCaseId } = useParams();
 const { user } = useAuth();
 const [data, setData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [error, setError] = useState("");
 const [filters, setFilters] = useState({ query: "", family: "", equipment: "", itemType: "", status: "" });
 // Solo las convenciones que el usuario cambió; vacío = las del servidor.
 const [conventions, setConventions] = useState({});
 const [simulation, setSimulation] = useState(null);
 const [simulating, setSimulating] = useState(false);
 const [simulationError, setSimulationError] = useState("");
 const role = String(user?.role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
 const isPricingLabTi = role === "jefe_ti" || role === "jefe_de_ti";

 const loadPreview = useCallback(async ({ refresh = false, quiet = false } = {}) => {
  if (!businessCaseId || !isPricingLabTi) return;
  if (refresh || quiet) setRefreshing(true);
  else setLoading(true);
  setError("");
  try {
   const changed = Object.keys(conventions).length > 0;
   const response = refresh
    ? await api.post(`/business-case/${businessCaseId}/pricing-lab/preview`, changed ? { conventions } : {})
    : await api.get(
     `/business-case/${businessCaseId}/pricing-lab/preview`,
     changed ? { params: { conventions: JSON.stringify(conventions) } } : undefined,
    );
   setData(response?.data?.data || null);
  } catch (requestError) {
   setError(requestError?.response?.data?.message || "No se pudo cargar el laboratorio de precios.");
  } finally {
   setLoading(false);
   setRefreshing(false);
  }
 }, [businessCaseId, isPricingLabTi, conventions]);

 useEffect(() => {
  loadPreview({ quiet: true });
 }, [loadPreview]);

 useEffect(() => {
  if (!businessCaseId || !isPricingLabTi) return;
  api.get(`/business-case/${businessCaseId}/pricing-lab/simulations`)
   .then((response) => setSimulation(response?.data?.data || null))
   .catch(() => setSimulation(null));
 }, [businessCaseId, isPricingLabTi]);

 const runSimulation = async (scenarios) => {
  setSimulating(true);
  setSimulationError("");
  try {
   const response = await api.post(`/business-case/${businessCaseId}/pricing-lab/simulations`, {
    scenarios,
    ...(Object.keys(conventions).length ? { conventions } : {}),
   });
   setSimulation(response?.data?.data || null);
  } catch (requestError) {
   setSimulationError(requestError?.response?.data?.message || "No se pudo simular los escenarios.");
  } finally {
   setSimulating(false);
  }
 };

 const activeConventions = (data?.equipment || []).find((entry) => entry.ruleEngine?.conventions)?.ruleEngine?.conventions || null;
 const changeConvention = (field, value) => setConventions((current) => ({ ...current, [field]: value }));

 const validationPayload = (entry, row) => ({
  equipmentId: entry.equipmentId,
  equipmentCode: entry.equipmentCode || row.ruleItem?.equipmentCode || null,
  itemType: row.ruleItem.itemType,
  supplierCode: row.ruleItem.supplierCode,
 });
 const sendValidation = async (request) => {
  setError("");
  try {
   await request();
   await loadPreview({ quiet: true });
  } catch (requestError) {
   setError(requestError?.response?.data?.message || "No se pudo guardar la validación.");
  }
 };
 const saveValidation = (entry, row, quantity) => sendValidation(() => api.put(
  `/business-case/${businessCaseId}/pricing-lab/rule-validations`,
  {
   ...validationPayload(entry, row),
   validatedQty: quantity,
   predictedQty: row.ruleItem.status === "calculated" ? row.ruleItem.quantity : null,
   predictedSource: row.ruleItem.primarySource || null,
   conventions: activeConventions || {},
  },
 ));
 const removeValidation = (entry, row) => sendValidation(() => api.delete(
  `/business-case/${businessCaseId}/pricing-lab/rule-validations`,
  { data: validationPayload(entry, row) },
 ));

 const equipmentViews = useMemo(() => (data?.equipment || []).map((entry) => {
  const rows = buildComparisonRows(entry);
  const family = rows.find((row) => row.ruleItem?.family)?.ruleItem?.family
   || entry.scope?.family
   || "Familia no identificada";
  return { entry, rows, family: String(family) };
 }), [data]);

 const filterOptions = useMemo(() => ({
  families: [...new Set(equipmentViews.map((view) => view.family))].sort((a, b) => a.localeCompare(b, "es")),
  equipment: equipmentViews
   .map((view) => ({ id: String(view.entry.equipmentId), name: view.entry.equipmentName || `Equipo ${view.entry.equipmentId}` }))
   .sort((a, b) => a.name.localeCompare(b.name, "es")),
  itemTypes: [...new Set(equipmentViews.flatMap((view) => view.rows.map((row) => row.itemType)))]
   .sort((a, b) => a.localeCompare(b, "es")),
  statuses: [...new Set(equipmentViews.flatMap((view) => view.rows.map(ruleStatusForRow)))],
 }), [equipmentViews]);

 const filteredGroups = useMemo(() => {
  const query = String(filters.query || "").trim().toLocaleLowerCase("es");
  const hasRowFilter = Boolean(query || filters.itemType || filters.status);
  const grouped = new Map();
  equipmentViews.forEach((view) => {
   if (filters.family && view.family !== filters.family) return;
   if (filters.equipment && String(view.entry.equipmentId) !== filters.equipment) return;
   const rows = view.rows.filter((row) => {
    if (filters.itemType && row.itemType !== filters.itemType) return false;
    if (filters.status && ruleStatusForRow(row) !== filters.status) return false;
    if (query) {
     const searchable = `${row.name} ${row.supplierCode || ""} ${row.itemType}`.toLocaleLowerCase("es");
     if (!searchable.includes(query)) return false;
    }
    return true;
   });
   if (hasRowFilter && !rows.length) return;
   if (!grouped.has(view.family)) grouped.set(view.family, []);
   grouped.get(view.family).push({ ...view, rows });
  });
  return [...grouped.entries()].map(([family, equipment]) => ({ family, equipment }));
 }, [equipmentViews, filters]);

 const visibleProductCount = filteredGroups.reduce(
  (total, group) => total + group.equipment.reduce((subtotal, view) => subtotal + view.rows.length, 0),
  0,
 );

 const setFilter = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));
 const clearFilters = () => setFilters({ query: "", family: "", equipment: "", itemType: "", status: "" });
 const filtersActive = Object.values(filters).some(Boolean);

 if (!isPricingLabTi) {
  return (
   <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
    Esta sección está restringida a Jefe TI durante su construcción.
   </div>
  );
 }
 if (loading) return <LoadingState />;
 if (error && !data) {
  return (
   <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-900">
    <FiXCircle className="mx-auto" size={28} />
    <p className="mt-3 font-semibold">{error}</p>
    <button type="button" onClick={() => loadPreview()} className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white">
     Reintentar
    </button>
   </div>
  );
 }

 const summary = data?.summary || {};
 const sync = data?.sheetSync || {};
 return (
  <div className="space-y-5">
   <header className="overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-6 text-white shadow-lg">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
     <div className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
       <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-100">EN CONSTRUCCIÓN</span>
       <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
        <FiShield size={13} /> Solo Jefe TI
       </span>
      </div>
      <h2 className="mt-4 text-2xl font-bold tracking-tight">Laboratorio de cálculo automático</h2>
      <p className="mt-2 text-sm leading-6 text-indigo-100">
       Lee las cantidades del Sheet en memoria, las conecta con los paquetes auditados y aplica las mismas reglas de columnas que usa la oferta. No guarda consumos ni escribe precios en la oferta oficial.
      </p>
     </div>
     <button
      type="button"
      onClick={() => loadPreview({ refresh: true })}
      disabled={refreshing}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-indigo-900 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60"
     >
      <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
      {refreshing ? "Leyendo…" : "Leer Sheet y calcular sin guardar"}
     </button>
    </div>
   </header>

   {error && <MessageList title="Error de actualización" items={[{ code: "REQUEST_ERROR", message: error }]} tone="rose" />}

   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
     <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Modalidad detectada</p>
     <p className="mt-2 text-lg font-bold text-slate-950">{modalityLabel(data?.modality)}</p>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
     <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Equipos calculados</p>
     <p className="mt-2 text-lg font-bold text-slate-950">{summary.calculatedCount || 0} / {summary.equipmentCount || 0}</p>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
     <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Lectura del Sheet</p>
     <p className={`mt-2 text-lg font-bold ${sync.ok === false ? "text-rose-700" : sync.ok === true ? "text-emerald-700" : "text-slate-600"}`}>
      {sync.ok === true ? "Leído sin guardar" : sync.ok === false ? "Falló" : "Datos almacenados"}
     </p>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
     <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Estado automático</p>
     <p className={`mt-2 flex items-center gap-2 text-lg font-bold ${summary.calculationReady ? "text-emerald-700" : "text-amber-700"}`}>
      {summary.calculationReady ? <FiCheckCircle /> : <FiAlertTriangle />}
      {summary.calculationReady ? "Calculable" : `${summary.blockerCount || 0} bloqueo(s)`}
     </p>
    </div>
   </div>

   {sync.requested && sync.ok === false && (
    <MessageList title="Lectura no completada" items={[{ code: sync.code, message: sync.message }]} tone="rose" />
   )}
   <MessageList title="Bloqueos generales" items={data?.globalBlockers || []} />

    {activeConventions && (
     <ConventionsPanel
      active={activeConventions}
      overrides={conventions}
      onChange={changeConvention}
      onReset={() => setConventions({})}
      busy={refreshing}
     />
    )}

    {equipmentViews.length > 0 && (
     <SimulationPanel simulation={simulation} busy={simulating} error={simulationError} onRun={runSimulation} filters={filters} />
    )}

    {equipmentViews.length > 0 && (
     <section aria-labelledby="comparison-filters-title" className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
       <div>
        <h3 id="comparison-filters-title" className="font-semibold text-[var(--text)]">Filtrar comparación</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
         {visibleProductCount} producto(s) en {filteredGroups.reduce((count, group) => count + group.equipment.length, 0)} equipo(s)
        </p>
       </div>
       {filtersActive && (
        <button
         type="button"
         onClick={clearFilters}
         className="min-h-10 rounded-[var(--radius-control)] border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        >
         Limpiar filtros
        </button>
       )}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
       <label className="text-sm font-medium text-[var(--text)]">
        Buscar producto
        <span className="mt-1 flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-control)] bg-[var(--surface)] px-3 focus-within:ring-2 focus-within:ring-[var(--focus)]">
         <FiSearch aria-hidden="true" className="shrink-0 text-[var(--text-secondary)]" />
         <input
          type="search"
          value={filters.query}
          onChange={setFilter("query")}
          placeholder="Nombre o código"
          className="min-w-0 flex-1 bg-transparent py-2 text-[var(--text)] outline-none placeholder:text-[var(--text-secondary)]"
         />
        </span>
       </label>
       {[
        ["family", "Familia", filterOptions.families, (value) => value],
        ["equipment", "Equipo", filterOptions.equipment, (value) => value.name],
        ["itemType", "Tipo", filterOptions.itemTypes, typeLabel],
        ["status", "Estado", filterOptions.statuses, (value) => RULE_STATUS_LABELS[value] || value],
       ].map(([field, label, options, getLabel]) => (
        <label key={field} className="text-sm font-medium text-[var(--text)]">
         {label}
         <select
          value={filters[field]}
          onChange={setFilter(field)}
          className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-control)] bg-[var(--surface)] px-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--focus)]"
         >
          <option value="">Todos</option>
          {options.map((option) => {
           const value = typeof option === "object" ? option.id : option;
           return <option key={value} value={value}>{getLabel(option)}</option>;
          })}
         </select>
        </label>
       ))}
      </div>
     </section>
    )}

   {!data?.equipment?.length ? (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
     <FiDatabase className="mx-auto text-slate-400" size={30} />
     <p className="mt-3 font-semibold text-slate-700">No hay equipos seleccionados para calcular.</p>
    </div>
    ) : !filteredGroups.length ? (
     <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
      <p className="font-semibold text-[var(--text)]">No hay productos que coincidan con los filtros.</p>
      <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-[var(--action)] underline underline-offset-2">
       Limpiar filtros
      </button>
     </div>
    ) : (
     <div className="space-y-6">
      {filteredGroups.map((group, familyIndex) => (
       <section key={group.family} aria-labelledby={`family-${familyIndex}`} className="space-y-3">
        <div className="border-b border-[var(--border)] pb-2">
         <h3 id={`family-${familyIndex}`} className="text-lg font-semibold text-[var(--text)]">{group.family}</h3>
         <p className="mt-1 text-sm text-[var(--text-secondary)]">{group.equipment.length} equipo(s)</p>
        </div>
        <div className="space-y-4">
         {group.equipment.map((view, equipmentIndex) => (
          <EquipmentCard
           key={view.entry.equipmentId}
           entry={view.entry}
           rows={view.rows}
           defaultOpen={familyIndex === 0 && equipmentIndex === 0}
           onSaveValidation={saveValidation}
           onRemoveValidation={removeValidation}
          />
         ))}
        </div>
       </section>
      ))}
     </div>
   )}
  </div>
 );
}
