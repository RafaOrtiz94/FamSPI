import React from "react";
import { ARIA_LABELS } from "./EquipmentPurchaseWidget.constants";

/**
 * EquipmentSelector Component
 * Handles equipment selection with type toggles
 * @param {Object} props
 * @param {Array} props.equipment - Available equipment list
 * @param {Array} props.selectedEquipment - Currently selected equipment
 * @param {Function} props.onToggleEquipment - Toggle equipment selection
 * @param {Function} props.onUpdateType - Update equipment type
 * @param {string} props.className - Additional CSS classes
 */
const EquipmentSelector = ({
 equipment,
 selectedEquipment,
 onToggleEquipment,
 onUpdateType,
 className = ""
}) => {
 return (
 <div className={className}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
 Equipos y tipo
 </p>
 <span className="text-xs text-slate-500">
 {selectedEquipment.length} seleccionados
 </span>
 </div>

 <div className="max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
 {equipment.length === 0 ? (
 <div className="text-center py-8">
 <p className="text-sm text-slate-500">No hay equipos disponibles</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 gap-3">
 {equipment.map((eq) => {
 const selected = selectedEquipment.find((e) => e.id === eq.id);
 return (
 <EquipmentItem
 key={eq.id}
 equipment={eq}
 selected={selected}
 onToggle={() => onToggleEquipment(eq.id)}
 onUpdateType={(type) => onUpdateType(eq.id, type)}
 />
 );
 })}
 </div>
 )}
 </div>
 </div>
 );
};

/**
 * EquipmentItem Component
 * Individual equipment selection item
 */
const EquipmentItem = ({ equipment, selected, onToggle, onUpdateType }) => {
 const { name, sku, serial, status } = equipment;

 return (
 <div
 className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 ${selected
 ? 'border-slate-900/20 bg-white shadow-sm'
 : 'border-slate-200 bg-white/90 hover:bg-white'
 }`}
 >
 <input
 type="checkbox"
 checked={!!selected}
 onChange={onToggle}
 className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
 aria-label={`${ARIA_LABELS.equipmentSelection}: ${name}`}
 />

 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
 <div className="flex flex-wrap gap-1 text-xs text-slate-500">
 {sku && <span>SKU: {sku}</span>}
 {serial && <span>• Serie {serial}</span>}
 {status && <span>• {status}</span>}
 </div>
 </div>

 {selected && (
 <EquipmentTypeSelector
 currentType={selected.type}
 onChange={(type) => onUpdateType(type)}
 />
 )}
 </div>
 );
};

/**
 * EquipmentTypeSelector Component
 * Type selection buttons for equipment
 */
const EquipmentTypeSelector = ({ currentType, onChange }) => {
 return (
 <div className="flex gap-2">
 <TypeButton
 type="new_available"
 label="Nuevo disponible"
 selected={currentType === "new_available"}
 onClick={() => onChange("new_available")}
 />
 <TypeButton
 type="new_import"
 label="Nuevo para importación"
 selected={currentType === "new_import"}
 onClick={() => onChange("new_import")}
 />
 <TypeButton
 type="cu"
 label="CU"
 selected={currentType === "cu"}
 onClick={() => onChange("cu")}
 />
 </div>
 );
};

/**
 * TypeButton Component
 * Individual type selection button
 */
const TypeButton = ({ type, label, selected, onClick }) => {
 const baseClasses = "px-3 py-1 text-xs rounded-full font-semibold border transition-all";
 const selectedClasses = selected
 ? type === "new_available"
 ? "bg-emerald-100 text-emerald-700 border-emerald-200"
 : type === "new_import"
 ? "bg-amber-100 text-amber-700 border-amber-200"
 : "bg-sky-100 text-sky-700 border-sky-200"
 : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";

 return (
 <button
 type="button"
 onClick={onClick}
 className={`${baseClasses} ${selectedClasses}`}
 aria-pressed={selected}
 aria-label={`Seleccionar tipo ${label} para equipo`}
 >
 {label}
 </button>
 );
};

export default EquipmentSelector;
