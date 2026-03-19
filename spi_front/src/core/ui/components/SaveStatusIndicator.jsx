import React from "react";
import { FiCheck, FiCloud, FiAlertCircle } from "react-icons/fi";

/**
 * SaveStatusIndicator - Visual indicator for save status
 * Shows saved/saving/unsaved states with appropriate icons and colors
 */
const SaveStatusIndicator = ({ status = "saved", lastSaved = null }) => {
 // Status configurations
 const statusConfig = {
 saved: {
 icon: FiCheck,
 label: "Guardado",
 bgColor: "bg-green-50",
 textColor: "text-green-700",
 iconColor: "text-green-600",
 },
 saving: {
 icon: FiCloud,
 label: "Guardando...",
 bgColor: "bg-blue-50",
 textColor: "text-blue-700",
 iconColor: "text-blue-600",
 animate: true,
 },
 unsaved: {
 icon: FiAlertCircle,
 label: "Cambios sin guardar",
 bgColor: "bg-yellow-50",
 textColor: "text-yellow-700",
 iconColor: "text-yellow-600",
 },
 error: {
 icon: FiAlertCircle,
 label: "Error al guardar",
 bgColor: "bg-red-50",
 textColor: "text-red-700",
 iconColor: "text-red-600",
 },
 };

 const config = statusConfig[status] || statusConfig.saved;
 const Icon = config.icon;

 // Format last saved time
 const formatTime = (date) => {
 if (!date) return null;
 const d = new Date(date);
 return d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
 };

 return (
 <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor}`}>
 <Icon
 size={14}
 className={`${config.iconColor} ${config.animate ? "animate-pulse" : ""}`}
 />
 <span className={`text-sm font-medium ${config.textColor}`}>
 {config.label}
 </span>
 {lastSaved && status === "saved" && (
 <span className="text-xs text-gray-500 ml-1">
 ({formatTime(lastSaved)})
 </span>
 )}
 </div>
 );
};

export default SaveStatusIndicator;
