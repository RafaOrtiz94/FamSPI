import React, { useMemo, useState } from "react";
import { FiCheck, FiAlertOctagon, FiShield, FiActivity, FiX } from "react-icons/fi";

const steps = [
  { key: "reported", label: "Reportado", icon: FiAlertOctagon },
  { key: "contained", label: "Contenido", icon: FiShield },
  { key: "investigating", label: "Investigando", icon: FiActivity },
  { key: "resolved", label: "Resuelto", icon: FiCheck },
  { key: "closed", label: "Cerrado", icon: FiCheck }
];

export default function CA0111Stepper({ record, onClose }) {
  const [notes, setNotes] = useState("");
  const currentStatus = useMemo(() => record?.status || "reported", [record]);
  const activeStepIndex = useMemo(() => steps.findIndex(s => s.key === currentStatus), [currentStatus]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Flujo de Incidentes</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <FiX className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${index <= activeStepIndex ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                  {index < activeStepIndex ? <FiCheck className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs font-medium mt-2 ${index <= activeStepIndex ? "text-gray-900" : "text-gray-400"}`}>{step.label}</span>
              </div>
              {index < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${index < activeStepIndex ? "bg-orange-600" : "bg-gray-200"}`} />}
            </React.Fragment>
          ))}
        </div>
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Información del Incidente</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Tipo:</span><span className="ml-2 font-medium">{record?.incident_type || "N/A"}</span></div>
            <div><span className="text-gray-500">Severidad:</span><span className="ml-2 font-medium capitalize">{record?.severity || "N/A"}</span></div>
            <div><span className="text-gray-500">Título:</span><span className="ml-2 font-medium">{record?.title || "N/A"}</span></div>
            <div><span className="text-gray-500">Ubicación:</span><span className="ml-2 font-medium">{record?.location || "N/A"}</span></div>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notas..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            rows={3}
          />
        </div>
      </div>
      <div className="flex items-center justify-end px-4 py-3 border-t border-gray-200 bg-gray-50">
        <button onClick={onClose} className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700">Cerrar</button>
      </div>
    </div>
  );
}