import React, { useState } from "react";
import api from "../../../core/api";
import CA0101AuthModal from "./CA0101AuthModal";
import { generateCapaPdf } from "../utils/ca0101PdfGenerator";

const STATES = [
  { id: "open", label: "Registro de Excursión", color: "bg-red-500", authRequired: false },
  { id: "acknowledged", label: "Acuse de Recibo QA", color: "bg-yellow-500", authRequired: true },
  { id: "resolved", label: "Contención GXP", color: "bg-blue-500", authRequired: true },
  { id: "closed", label: "Cierre & Archivo", color: "bg-green-500", authRequired: true },
];

const CA0101Stepper = ({ alarm, currentUser, onTransitionSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [errorDesc, setErrorDesc] = useState(null);
  
  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingTargetStatus, setPendingTargetStatus] = useState(null);

  // Determinar índice activo según la status
  const currentIndex = STATES.findIndex((s) => s.id === alarm.status);

  const requestTransition = (targetStatus) => {
    const targetStateInfo = STATES.find(s => s.id === targetStatus);
    if (targetStateInfo?.authRequired) {
      setPendingTargetStatus(targetStatus);
      setAuthModalOpen(true);
    } else {
      executeTransition(targetStatus);
    }
  };

  const executeTransition = async (targetStatus) => {
    try {
      setLoading(true);
      setErrorDesc(null);
      await api.put(`/calidad/temperature/alarms/${alarm.id}`, {
        toStatus: targetStatus,
        notes: notes || "Transición ejecutada desde Command Center.",
      });
      setNotes("");
      if (onTransitionSuccess) onTransitionSuccess();
    } catch (error) {
      console.error("Transición GXP Denegada:", error);
      setErrorDesc(error.response?.data?.message || "Error grave de comunicación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-5 bg-black/30 rounded-xl border border-white/5 shadow-inner">
      <h3 className="text-white text-md font-bold mb-6">Secuencia de Aprobación GXP</h3>
      
      {/* Timeline Visual */}
      <div className="relative flex justify-between items-center w-full mb-8">
        {/* Línea de fondo */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-700 -z-10 rounded"></div>
        {/* Línea de progreso (relleno) */}
        <div 
          className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-red-500 -z-10 rounded transition-all duration-500" 
          style={{ width: `${(Math.max(currentIndex, 0) / (STATES.length - 1)) * 100}%` }}
        ></div>

        {STATES.map((stateInfo, idx) => {
          const isCompleted = idx <= currentIndex;
          const isActive = idx === currentIndex + 1;
          const statusColors = isCompleted ? stateInfo.color : "bg-gray-800 border border-gray-600 text-gray-500";
          const pingEffect = isActive ? "animate-pulse shadow-lg shadow-white/20" : "";

          return (
            <div key={stateInfo.id} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${statusColors} ${pingEffect} transition-all duration-300`}>
                {isCompleted ? "✓" : idx + 1}
              </div>
              <span className={`text-[10px] mt-2 uppercase tracking-tight font-bold ${isCompleted ? 'text-white' : 'text-gray-500'}`}>
                {stateInfo.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Controles Operativos (Si faltan pasos para Closed) */}
      {currentIndex > -1 && currentIndex < STATES.length - 1 && (
        <div className="bg-white/5 p-4 rounded-lg flex flex-col space-y-3">
          {errorDesc && (
            <div className="bg-red-500/20 text-red-400 p-2 text-xs rounded border border-red-500/30">
              {errorDesc}
            </div>
          )}
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
            Acción Pendiente: <span className="text-white">{STATES[currentIndex + 1].label}</span>
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones GXP requeridas..."
            className="w-full bg-black/40 border border-white/10 rounded p-2 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 placeholder-gray-600 transition-all"
            rows={2}
            disabled={loading}
          />
          <button
            onClick={() => requestTransition(STATES[currentIndex + 1].id)}
            disabled={loading}
            className={`w-full py-2 rounded text-sm font-bold uppercase transition-all shadow-md
              ${loading ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white hover:shadow-red-500/50'}`}
          >
            {loading ? 'Aplicando firma criptográfica...' : `Confirmar > ${STATES[currentIndex + 1].label}`}
          </button>
        </div>
      )}
      
      {currentIndex === STATES.length - 1 && (
        <div className="text-center p-4 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg flex flex-col items-center">
          <p className="font-semibold text-sm mb-3">✓ Ciclo de Resolución CAPA Completado Definitivamente.</p>
          <button 
            onClick={() => generateCapaPdf(alarm)}
            className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded shadow transition-colors"
          >
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-bold tracking-wider">Generar Acta PDF</span>
          </button>
        </div>
      )}

      {/* 2FA Widget / PDF Sealing Entrypoint */}
      <CA0101AuthModal
         isOpen={authModalOpen}
         onClose={() => setAuthModalOpen(false)}
         onAuthenticated={() => executeTransition(pendingTargetStatus)}
         actionLabel={`Aprobar: ${STATES.find(s => s.id === pendingTargetStatus)?.label}`}
      />
    </div>
  );
};

export default CA0101Stepper;
