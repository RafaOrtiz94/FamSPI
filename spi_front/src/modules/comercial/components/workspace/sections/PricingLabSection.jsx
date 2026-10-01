import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
 FiAlertTriangle,
 FiCheckCircle,
 FiClock,
 FiDatabase,
 FiRefreshCw,
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
     No hay reactivos, calibradores, controles o materiales identificados para este equipo.
    </p>
   )}
   <p className="mt-3 text-xs text-slate-500">
    Exactitud operacional = max(0, 100 x (1 - WAPE)) sobre despachos completos, dejando un Business Case fuera por turno. planned_qty solo alimenta sugerencias proxy y no valida el objetivo.
   </p>
  </div>
 );
};

const EquipmentCard = ({ entry }) => (
 <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
  <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-5 sm:flex-row sm:items-start sm:justify-between">
   <div>
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Equipo auditado</p>
    <h3 className="mt-1 text-lg font-bold text-slate-950">{entry.equipmentName}</h3>
    <p className="mt-1 text-xs text-slate-500">
     {entry.scope?.equipment || "Sin equivalencia"} · {entry.calculation?.packageId || "Paquete no disponible"}
    </p>
   </div>
   <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLES[entry.status] || STATUS_STYLES.unsupported}`}>
    {STATUS_LABELS[entry.status] || entry.status}
   </span>
  </div>

  <div className="space-y-5 p-5">
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
 </section>
);

export default function PricingLabSection() {
 const { id: businessCaseId } = useParams();
 const { user } = useAuth();
 const [data, setData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [error, setError] = useState("");
 const role = String(user?.role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
 const isPricingLabTi = role === "jefe_ti" || role === "jefe_de_ti";

 const loadPreview = useCallback(async ({ refresh = false } = {}) => {
  if (!businessCaseId || !isPricingLabTi) return;
  refresh ? setRefreshing(true) : setLoading(true);
  setError("");
  try {
   const response = refresh
    ? await api.post(`/business-case/${businessCaseId}/pricing-lab/preview`, {})
    : await api.get(`/business-case/${businessCaseId}/pricing-lab/preview`);
   setData(response?.data?.data || null);
  } catch (requestError) {
   setError(requestError?.response?.data?.message || "No se pudo cargar el laboratorio de precios.");
  } finally {
   setLoading(false);
   setRefreshing(false);
  }
 }, [businessCaseId, isPricingLabTi]);

 useEffect(() => {
  loadPreview();
 }, [loadPreview]);

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

   {!data?.equipment?.length ? (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
     <FiDatabase className="mx-auto text-slate-400" size={30} />
     <p className="mt-3 font-semibold text-slate-700">No hay equipos seleccionados para calcular.</p>
    </div>
   ) : (
    <div className="space-y-5">
     {data.equipment.map((entry) => <EquipmentCard key={entry.equipmentId} entry={entry} />)}
    </div>
   )}
  </div>
 );
}
