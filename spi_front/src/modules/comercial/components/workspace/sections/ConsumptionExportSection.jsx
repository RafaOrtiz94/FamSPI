import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
 FiAlertTriangle,
 FiCheckCircle,
 FiClock,
 FiDatabase,
 FiLayers,
 FiPackage,
 FiTrendingUp,
 FiXCircle,
} from "react-icons/fi";
import api from "../../../../../core/api";

const ITEM_TYPE_CONFIG = {
 reactivo: { label: "Reactivos", accent: "emerald" },
 determinacion: { label: "Reactivos", accent: "emerald" },
 control: { label: "Controles", accent: "sky" },
 calibrador: { label: "Calibradores", accent: "amber" },
 consumible: { label: "Materiales", accent: "slate" },
 material: { label: "Materiales", accent: "slate" },
};

const GROUP_ORDER = ["Reactivos", "Controles", "Calibradores", "Materiales", "Otros"];

const ACCENT_CLASSES = {
 emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
 sky: "border-sky-100 bg-sky-50 text-sky-700",
 amber: "border-amber-100 bg-amber-50 text-amber-700",
 slate: "border-slate-100 bg-slate-50 text-slate-700",
 rose: "border-rose-100 bg-rose-50 text-rose-700",
 blue: "border-blue-100 bg-blue-50 text-blue-700",
};

const toNumber = (value) => {
 if (value === null || value === undefined || value === "") return 0;
 const parsed = Number(value);
 return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value) =>
 toNumber(value).toLocaleString("es-EC", { maximumFractionDigits: 2 });

const hasPositive = (value) => toNumber(value) > 0;

const displayValue = (value) =>
 hasPositive(value) ? (
  <span className="font-semibold text-gray-950">{formatNumber(value)}</span>
 ) : (
  <span className="text-gray-300">0</span>
 );

const normalizeBoolean = (value) => {
 if (value === null || value === undefined) return null;
 if (typeof value === "boolean") return value;
 const normalized = String(value).trim().toLowerCase();
 if (["true", "1", "yes", "si", "sí"].includes(normalized)) return true;
 if (["false", "0", "no"].includes(normalized)) return false;
 return null;
};

const getItemConfig = (type) => ITEM_TYPE_CONFIG[String(type || "").toLowerCase()] || { label: "Otros", accent: "slate" };

const groupConsumptionByType = (items = []) => {
 const groups = {};
 items.forEach((item) => {
  const { label } = getItemConfig(item?.type);
  if (!groups[label]) groups[label] = [];
  groups[label].push(item);
 });
 return GROUP_ORDER
  .filter((label) => groups[label]?.length)
  .map((label) => ({ label, items: groups[label] }));
};

const summarizeGroup = (items = []) => ({
 total: items.length,
 annualReady: items.filter((item) => hasPositive(item?.annualQty ?? item?.annualQuantity)).length,
 plannedReady: items.filter((item) => hasPositive(item?.plannedQty)).length,
 referenceReady: items.filter((item) => hasPositive(item?.referenceQty)).length,
 annualSum: items.reduce((sum, item) => sum + toNumber(item?.annualQty ?? item?.annualQuantity), 0),
 plannedSum: items.reduce((sum, item) => sum + toNumber(item?.plannedQty), 0),
});

const getInvestmentName = (investment = {}) =>
 investment.concept ||
 investment.name ||
 investment.catalog_name ||
 investment.investment_name ||
 investment.description ||
 "Inversion sin nombre";

const getInvestmentCategory = (investment = {}) =>
 investment.category || investment.investment_type || investment.type || "Sin categoria";

const YesNo = ({ value }) => {
 const normalized = normalizeBoolean(value);
 if (normalized === null) return <span className="text-gray-400">-</span>;
 return normalized ? (
  <span className="inline-flex items-center gap-1 text-emerald-700"><FiCheckCircle size={12} /> Si</span>
 ) : (
  <span className="inline-flex items-center gap-1 text-gray-500"><FiXCircle size={12} /> No</span>
 );
};

const EmptyState = ({ children }) => (
 <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
  {children}
 </div>
);

const Field = ({ label, value }) => (
 <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{label}</div>
  <div className="mt-1 text-sm font-semibold text-gray-900 break-words">
   {value === null || value === undefined || value === "" ? <span className="text-gray-400">-</span> : value}
  </div>
 </div>
);

const MetricCard = ({ icon: Icon, label, value, detail, accent = "blue" }) => (
 <div className={`rounded-3xl border px-4 py-4 shadow-sm ${ACCENT_CLASSES[accent] || ACCENT_CLASSES.blue}`}>
  <div className="flex items-start justify-between gap-3">
   <div>
    <div className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-75">{label}</div>
    <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
   </div>
   <div className="rounded-2xl bg-white/70 p-2 shadow-sm">
    <Icon size={18} />
   </div>
  </div>
  {detail && <div className="mt-2 text-xs font-medium opacity-80">{detail}</div>}
 </div>
);

const SectionCard = ({ title, subtitle, children, empty }) => (
 <section className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
   <div>
    <h3 className="text-base font-black tracking-tight text-gray-950">{title}</h3>
    {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
   </div>
  </div>
  {empty ? <EmptyState>Aun no se ha registrado informacion en esta seccion.</EmptyState> : children}
 </section>
);

const QuantityBadge = ({ item }) => {
 const annual = toNumber(item?.annualQty ?? item?.annualQuantity);
 const planned = toNumber(item?.plannedQty);
 const reference = toNumber(item?.referenceQty);
 if (annual > 0) {
  return <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">Listo</span>;
 }
 if (planned > 0 || reference > 0) {
  return (
   <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
    Dato en otra columna
   </span>
  );
 }
 return <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-500">Pendiente</span>;
};

const ConsumptionGroupCard = ({ label, items }) => {
 const summary = summarizeGroup(items);
 const accent = getItemConfig(items[0]?.type).accent;
 return (
  <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
   <div className={`border-b px-4 py-4 ${ACCENT_CLASSES[accent] || ACCENT_CLASSES.slate}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div>
      <h4 className="text-sm font-black text-gray-950">{label}</h4>
      <p className="mt-1 text-xs text-gray-600">
       {summary.annualReady} con cantidad anual de {summary.total} items
      </p>
     </div>
     <div className="flex gap-2 text-xs font-bold">
      <span className="rounded-full bg-white/80 px-2.5 py-1">Anual {formatNumber(summary.annualSum)}</span>
      <span className="rounded-full bg-white/80 px-2.5 py-1">A enviar {formatNumber(summary.plannedSum)}</span>
     </div>
    </div>
   </div>
   <div className="max-h-[420px] overflow-auto">
    <table className="min-w-[760px] w-full text-sm">
     <thead className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 text-left text-[11px] uppercase tracking-[0.14em] text-gray-400 backdrop-blur">
      <tr>
       <th className="px-4 py-3 font-black">Item</th>
       <th className="px-3 py-3 text-right font-black">Cantidad anual</th>
       <th className="px-3 py-3 text-right font-black">Producto calculado</th>
       <th className="px-3 py-3 text-right font-black">Producto a enviar</th>
       <th className="px-4 py-3 text-right font-black">Estado</th>
      </tr>
     </thead>
     <tbody className="divide-y divide-gray-50">
      {items.map((item) => (
       <tr key={item.key} className="hover:bg-gray-50/70">
        <td className="px-4 py-3">
         <div className="font-semibold text-gray-900">{item.name || "Sin nombre"}</div>
         <div className="mt-0.5 text-xs text-gray-400">
          {item.itemId ? `ID fabricante: ${item.itemId}` : item.key}
         </div>
        </td>
        <td className="px-3 py-3 text-right">{displayValue(item.annualQty ?? item.annualQuantity)}</td>
        <td className="px-3 py-3 text-right">{displayValue(item.referenceQty)}</td>
        <td className="px-3 py-3 text-right">{displayValue(item.plannedQty)}</td>
        <td className="px-4 py-3 text-right"><QuantityBadge item={item} /></td>
       </tr>
      ))}
     </tbody>
    </table>
   </div>
  </div>
 );
};

const ConsumptionExportSection = ({ businessCase }) => {
 const { id: bcId } = useParams();
 const [complete, setComplete] = useState(null);
 const [consumption, setConsumption] = useState(null);
 const [investments, setInvestments] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");

 useEffect(() => {
  if (!bcId) return undefined;
  let cancelled = false;
  (async () => {
   setLoading(true);
   setError("");
   const [completeRes, consumptionRes, investmentsRes] = await Promise.allSettled([
    api.get(`/business-case/${bcId}/complete`),
    api.get(`/business-case/${bcId}/consumption-items`),
    api.get(`/business-case/${bcId}/investments`),
   ]);
   if (cancelled) return;
   setComplete(completeRes.status === "fulfilled" ? completeRes.value?.data?.data : null);
   setConsumption(consumptionRes.status === "fulfilled" ? consumptionRes.value?.data?.data : null);
   setInvestments(investmentsRes.status === "fulfilled" ? investmentsRes.value?.data?.data : null);
   if ([completeRes, consumptionRes, investmentsRes].some((result) => result.status === "rejected")) {
    setError("Algunos datos del resumen no se pudieron cargar. Recarga la pantalla si falta informacion.");
   }
   setLoading(false);
  })();
  return () => { cancelled = true; };
 }, [bcId]);

 const equipmentPairs = useMemo(
  () => (Array.isArray(businessCase?.extra?.equipment_details) ? businessCase.extra.equipment_details : []),
  [businessCase],
 );
 const consumptionItems = useMemo(
  () => (Array.isArray(consumption?.items) ? consumption.items : []),
  [consumption?.items],
 );
 const consumptionGroups = useMemo(() => groupConsumptionByType(consumptionItems), [consumptionItems]);
 const consumptionSummary = useMemo(() => summarizeGroup(consumptionItems), [consumptionItems]);
 const selectedInvestments = useMemo(
  () => (Array.isArray(investments) ? investments : []).filter((item) => item?.selected !== false),
  [investments],
 );

 const lab = complete?.labEnvironment || null;
 const lis = complete?.lisIntegration || null;
 const requirements = complete?.requirements || null;
 const deliveries = complete?.deliveries || null;
 const feasibilityDecision = businessCase?.modern_bc_metadata?.feasibility?.decision || null;

 const isBackupInstalledSimultaneously = (pair) => normalizeBoolean(pair?.backup_install_simultaneous) === true;
 const processType = businessCase?.bc_purchase_type || businessCase?.purchase_type || "-";
 const deadlineMonths = requirements?.deadline_months ?? businessCase?.deadline_months;
 const projectedDeadlineMonths = requirements?.projected_deadline_months ?? businessCase?.projected_deadline_months;

 if (loading) {
  return (
   <div className="rounded-[28px] border border-gray-100 bg-white p-8 shadow-sm">
    <div className="flex items-center justify-center gap-2 text-gray-500">
     <FiClock className="animate-pulse" />
     Cargando resumen...
    </div>
   </div>
  );
 }

 return (
  <div className="space-y-5">
   <div className="overflow-hidden rounded-[32px] border border-gray-100 bg-white shadow-sm">
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-6 text-white sm:px-6">
     <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
       <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Resumen ejecutivo</p>
       <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Business Case consolidado</h2>
       <p className="mt-2 max-w-3xl text-sm text-slate-200">
        Vista de lectura para verificar rapidamente equipos, consumos, cantidades sincronizadas e inversiones registradas.
       </p>
      </div>
      <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm backdrop-blur">
       <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Estado</div>
       <div className="mt-1 font-black">{businessCase?.canonical_state || businessCase?.status || "-"}</div>
      </div>
     </div>
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
     <MetricCard icon={FiDatabase} label="Items consumo" value={formatNumber(consumptionSummary.total)} detail="Reactivos, controles, calibradores y materiales" accent="blue" />
     <MetricCard icon={FiCheckCircle} label="Cant. anual lista" value={formatNumber(consumptionSummary.annualReady)} detail={`Total anual: ${formatNumber(consumptionSummary.annualSum)}`} accent="emerald" />
     <MetricCard icon={FiTrendingUp} label="A enviar" value={formatNumber(consumptionSummary.plannedReady)} detail={`Total a enviar: ${formatNumber(consumptionSummary.plannedSum)}`} accent="amber" />
     <MetricCard icon={FiPackage} label="Inversiones" value={formatNumber(selectedInvestments.length)} detail="Items seleccionados en carrito" accent="slate" />
    </div>
   </div>

   {error && (
    <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
     <FiAlertTriangle className="mt-0.5 flex-shrink-0" />
     {error}
    </div>
   )}

   <SectionCard title="Datos del proceso" subtitle="Informacion base usada por el flujo y por la hoja oficial.">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
     <Field label="Cliente" value={businessCase?.client_name} />
     <Field label="Codigo de proceso" value={businessCase?.process_code} />
     <Field label="Tipo de compra" value={processType} />
     <Field label="Plazo / Proyeccion" value={`${deadlineMonths ?? "-"} / ${projectedDeadlineMonths ?? "-"} meses`} />
     <div className="sm:col-span-2 xl:col-span-4">
      <Field label="Objeto de contratacion" value={businessCase?.contract_object} />
     </div>
    </div>
   </SectionCard>

   <SectionCard title="Equipos" subtitle="Solo se muestra el backup cuando se instala simultaneamente." empty={!equipmentPairs.length}>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
     {equipmentPairs.map((pair, index) => (
      <div key={pair.id || `${pair.primary_id || "primary"}:${index}`} className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
       <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-gray-400">
        <FiLayers />
        Set de equipos
       </div>
       <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Principal" value={pair.primary_name || pair.primary_equipment_name || pair.primary_id} />
        <Field
         label="Backup"
         value={pair.requires_backup && isBackupInstalledSimultaneously(pair)
          ? (pair.backup_name || pair.backup_equipment_name || pair.backup_id)
          : "No se instala simultaneamente"}
        />
       </div>
      </div>
     ))}
    </div>
   </SectionCard>

   <SectionCard
    title="Reactivos, calibradores, controles y materiales"
    subtitle="Cantidad anual cierra determinaciones. Producto a enviar pertenece a Cantidades Maximas."
    empty={!consumptionItems.length}
   >
    <div className="space-y-4">
     <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      Si ves 0 en cantidad anual pero existe valor en producto a enviar, el item no esta listo para cerrar determinaciones; ese dato corresponde al control de cantidades maximas.
     </div>
     <div className="grid grid-cols-1 gap-4">
      {consumptionGroups.map((group) => (
       <ConsumptionGroupCard key={group.label} label={group.label} items={group.items} />
      ))}
     </div>
    </div>
   </SectionCard>

   <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
    <SectionCard title="Entorno de laboratorio" empty={!lab}>
     {lab && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
       <Field label="Dias por semana" value={lab.work_days_per_week} />
       <Field label="Turnos por dia" value={lab.shifts_per_day} />
       <Field label="Horas por turno" value={lab.hours_per_shift} />
       <Field label="Controles por turno" value={lab.quality_controls_per_shift} />
       <Field label="Niveles de control" value={lab.control_levels} />
       <Field label="Frecuencia QC rutina" value={lab.routine_qc_frequency} />
       <Field label="Pruebas especiales" value={lab.special_tests} />
       <Field label="Frecuencia QC especiales" value={lab.special_qc_frequency} />
      </div>
     )}
    </SectionCard>

    <SectionCard title="LIS y entregas" empty={!lis && !deliveries}>
     <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {lis && (
       <>
        <Field label="Incluye LIS" value={<YesNo value={lis.includes_lis} />} />
        <Field label="Proveedor LIS" value={lis.lis_provider} />
        <Field label="Incluye hardware" value={<YesNo value={lis.includes_hardware} />} />
        <Field label="Pacientes mensuales" value={lis.monthly_patients} />
        <Field label="Sistema actual" value={lis.current_system_name} />
        <Field label="Proveedor actual" value={lis.current_system_provider} />
       </>
      )}
      {deliveries && (
       <>
        <Field label="Tipo de entrega" value={deliveries.delivery_type} />
        <Field label="Determinacion efectiva" value={<YesNo value={deliveries.effective_determination} />} />
       </>
      )}
     </div>
    </SectionCard>
   </div>

   <SectionCard title="Inversiones adicionales" subtitle="Lista de items seleccionados; los precios se gestionan en su seccion propia." empty={!selectedInvestments.length}>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
     {selectedInvestments.map((investment) => (
      <div key={investment.id || investment.catalog_id || getInvestmentName(investment)} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
       <div className="font-bold text-gray-900">{getInvestmentName(investment)}</div>
       <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-gray-500">
        <span className="rounded-full bg-white px-2.5 py-1">Categoria: {getInvestmentCategory(investment)}</span>
        <span className="rounded-full bg-white px-2.5 py-1">Cantidad: {formatNumber(investment.quantity ?? 1)}</span>
       </div>
      </div>
     ))}
    </div>
   </SectionCard>

   <SectionCard title="Viabilidad" empty={!feasibilityDecision}>
    {feasibilityDecision && (
     <div className="flex flex-wrap items-center gap-3 text-sm">
      {feasibilityDecision.is_feasible ? (
       <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 font-bold text-emerald-700"><FiCheckCircle /> Factible</span>
      ) : (
       <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-2 font-bold text-rose-700"><FiXCircle /> No factible</span>
      )}
      <span className="text-gray-500">
       Decidido el {feasibilityDecision.decided_at ? new Date(feasibilityDecision.decided_at).toLocaleDateString("es-EC") : "-"}
      </span>
     </div>
    )}
   </SectionCard>
  </div>
 );
};

export default ConsumptionExportSection;
