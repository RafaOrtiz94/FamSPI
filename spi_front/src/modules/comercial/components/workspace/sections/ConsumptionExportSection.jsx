import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FiCheckCircle, FiClock, FiXCircle } from "react-icons/fi";
import api from "../../../../../core/api";

// ponytail: esta seccion reemplaza a la antigua "Sincronizacion con Google
// Sheets" -- desde que las cantidades se leen del Sheet (ver
// syncConsumptionQuantitiesFromSheet en el backend) esa pantalla de preview
// manual dejo de tener sentido. Ahora es un resumen de solo lectura de todo
// lo registrado en el BC hasta este punto, sin precios/montos (los precios
// viven en otras secciones que si tienen permisos propios para eso).

const ITEM_TYPE_LABELS = {
 reactivo: "Reactivos",
 determinacion: "Reactivos",
 control: "Controles",
 calibrador: "Calibradores",
 consumible: "Materiales",
 material: "Materiales",
};

const groupConsumptionByType = (items = []) => {
 const groups = {};
 items.forEach((item) => {
 const label = ITEM_TYPE_LABELS[String(item?.type || "").toLowerCase()] || "Otros";
 if (!groups[label]) groups[label] = [];
 groups[label].push(item);
 });
 return groups;
};

const YesNo = ({ value }) => {
 if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
 return value ? (
 <span className="inline-flex items-center gap-1 text-emerald-700"><FiCheckCircle size={12} /> Si</span>
 ) : (
 <span className="inline-flex items-center gap-1 text-gray-500"><FiXCircle size={12} /> No</span>
 );
};

const Field = ({ label, value }) => (
 <div className="rounded-lg bg-white border border-gray-100 px-3 py-2">
 <div className="text-xs font-semibold text-gray-500">{label}</div>
 <div className="text-sm text-gray-900 break-words">{value === null || value === undefined || value === "" ? <span className="text-gray-400">-</span> : String(value)}</div>
 </div>
);

const SectionCard = ({ title, children, empty }) => (
 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
 <h3 className="text-base font-semibold text-gray-900">{title}</h3>
 {empty ? (
 <p className="text-sm text-gray-500">Aun no se ha registrado informacion en esta seccion.</p>
 ) : (
 children
 )}
 </div>
);

const ConsumptionExportSection = ({ businessCase }) => {
 const { id: bcId } = useParams();
 const [complete, setComplete] = useState(null);
 const [consumption, setConsumption] = useState(null);
 const [investments, setInvestments] = useState(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!bcId) return undefined;
 let cancelled = false;
 (async () => {
 setLoading(true);
 const [completeRes, consumptionRes, investmentsRes] = await Promise.allSettled([
 api.get(`/business-case/${bcId}/complete`),
 api.get(`/business-case/${bcId}/consumption-items`),
 api.get(`/business-case/${bcId}/investments`),
 ]);
 if (cancelled) return;
 setComplete(completeRes.status === "fulfilled" ? completeRes.value?.data?.data : null);
 setConsumption(consumptionRes.status === "fulfilled" ? consumptionRes.value?.data?.data : null);
 setInvestments(investmentsRes.status === "fulfilled" ? investmentsRes.value?.data?.data : null);
 setLoading(false);
 })();
 return () => { cancelled = true; };
 }, [bcId]);

const equipmentPairs = useMemo(
  () => (Array.isArray(businessCase?.extra?.equipment_details) ? businessCase.extra.equipment_details : []),
  [businessCase],
);
const isBackupInstalledSimultaneously = (pair) => {
 const value = pair?.backup_install_simultaneous;
 return value === true || ["true", "1", "yes", "si", "sí"].includes(String(value ?? "").trim().toLowerCase());
};
 const feasibilityDecision = businessCase?.modern_bc_metadata?.feasibility?.decision || null;
 const consumptionGroups = useMemo(() => groupConsumptionByType(consumption?.items || []), [consumption]);
 const lab = complete?.labEnvironment || null;
 const lis = complete?.lisIntegration || null;
 const requirements = complete?.requirements || null;
 const deliveries = complete?.deliveries || null;

 if (loading) {
 return (
 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
 <div className="flex items-center justify-center gap-2 text-gray-500">
 <FiClock className="animate-pulse" />
 Cargando resumen...
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-5">
 <div>
 <h2 className="text-xl font-bold text-gray-900 tracking-tight">Resumen del Business Case</h2>
 <p className="text-sm text-gray-500 mt-1">
 Vista de solo lectura de todo lo registrado hasta este punto (no incluye precios ni montos).
 </p>
 </div>

 <SectionCard title="Datos generales">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
 <Field label="Cliente" value={businessCase?.client_name} />
 <Field label="Codigo de proceso" value={businessCase?.process_code} />
 <Field label="Objeto de contratacion" value={businessCase?.contract_object} />
 <Field label="Tipo de compra" value={businessCase?.bc_purchase_type} />
 <Field label="Estado" value={businessCase?.canonical_state || businessCase?.status} />
 <Field label="Plazo (meses)" value={businessCase?.deadline_months} />
 </div>
 </SectionCard>

 <SectionCard title="Equipo seleccionado" empty={!equipmentPairs.length}>
 <div className="space-y-2">
 {equipmentPairs.map((pair) => (
 <div key={pair.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 <Field label="Equipo principal" value={pair.primary_name} />
 <Field
  label="Equipo backup"
  value={pair.requires_backup && isBackupInstalledSimultaneously(pair) ? pair.backup_name : "No se instala simultaneamente"}
 />
 </div>
 ))}
 </div>
 </SectionCard>

 <SectionCard title="Reactivos, calibradores, controles y materiales" empty={!consumption?.items?.length}>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {Object.entries(consumptionGroups).map(([label, items]) => (
 <div key={label} className="border border-gray-100 rounded-xl">
 <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/70 text-sm font-semibold text-gray-800">
 {label} <span className="text-xs text-gray-400 font-normal">({items.length})</span>
 </div>
 <div className="divide-y divide-gray-50 max-h-64 overflow-auto">
 {items.map((item) => (
 <div key={item.key} className="flex items-center justify-between px-3 py-2 text-sm gap-3">
 <span className="text-gray-700 truncate">{item.name}</span>
 <span className="font-semibold text-gray-900 flex-shrink-0">{item.annualQty ?? 0}</span>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </SectionCard>

 <SectionCard title="Entorno de laboratorio" empty={!lab}>
 {lab && (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
 <Field label="Dias por semana" value={lab.work_days_per_week} />
 <Field label="Turnos por dia" value={lab.shifts_per_day} />
 <Field label="Horas por turno" value={lab.hours_per_shift} />
 <Field label="Controles de calidad por turno" value={lab.quality_controls_per_shift} />
 <Field label="Niveles de control" value={lab.control_levels} />
 <Field label="Frecuencia QC rutina" value={lab.routine_qc_frequency} />
 <Field label="Pruebas especiales" value={lab.special_tests} />
 <Field label="Frecuencia QC especiales" value={lab.special_qc_frequency} />
 </div>
 )}
 </SectionCard>

 <SectionCard title="Integracion LIS" empty={!lis}>
 {lis && (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
 <div className="rounded-lg bg-white border border-gray-100 px-3 py-2">
 <div className="text-xs font-semibold text-gray-500">Incluye LIS</div>
 <div><YesNo value={lis.includes_lis} /></div>
 </div>
 <Field label="Proveedor LIS" value={lis.lis_provider} />
 <div className="rounded-lg bg-white border border-gray-100 px-3 py-2">
 <div className="text-xs font-semibold text-gray-500">Incluye hardware</div>
 <div><YesNo value={lis.includes_hardware} /></div>
 </div>
 <Field label="Pacientes mensuales" value={lis.monthly_patients} />
 <Field label="Sistema actual" value={lis.current_system_name} />
 <Field label="Proveedor sistema actual" value={lis.current_system_provider} />
 </div>
 )}
 </SectionCard>

 <SectionCard title="Requerimientos y entregas" empty={!requirements && !deliveries}>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
 {requirements && (
 <>
 <Field label="Plazo (meses)" value={requirements.deadline_months} />
 <Field label="Plazo proyectado (meses)" value={requirements.projected_deadline_months} />
 </>
 )}
 {deliveries && (
 <>
 <Field label="Tipo de entrega" value={deliveries.delivery_type} />
 <div className="rounded-lg bg-white border border-gray-100 px-3 py-2">
 <div className="text-xs font-semibold text-gray-500">Determinacion efectiva</div>
 <div><YesNo value={deliveries.effective_determination} /></div>
 </div>
 </>
 )}
 </div>
 </SectionCard>

 <SectionCard title="Inversiones adicionales" empty={!investments?.length}>
 <div className="divide-y divide-gray-50">
 {(investments || []).map((inv) => (
 <div key={inv.id} className="flex items-center justify-between py-2 text-sm gap-3">
 <span className="text-gray-700">{inv.concept}</span>
 <span className="text-xs text-gray-500 flex-shrink-0">{inv.category || inv.investment_type}</span>
 </div>
 ))}
 </div>
 </SectionCard>

 <SectionCard title="Viabilidad" empty={!feasibilityDecision}>
 {feasibilityDecision && (
 <div className="flex flex-wrap items-center gap-2 text-sm">
 {feasibilityDecision.is_feasible ? (
 <span className="inline-flex items-center gap-2 text-emerald-700"><FiCheckCircle /> Factible</span>
 ) : (
 <span className="inline-flex items-center gap-2 text-rose-700"><FiXCircle /> No factible</span>
 )}
 <span className="text-gray-400">·</span>
 <span className="text-gray-600">
 Decidido el {feasibilityDecision.decided_at ? new Date(feasibilityDecision.decided_at).toLocaleDateString("es-EC") : "-"}
 </span>
 </div>
 )}
 </SectionCard>
 </div>
 );
};

export default ConsumptionExportSection;
