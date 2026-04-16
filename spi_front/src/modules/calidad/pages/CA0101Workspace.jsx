import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../core/auth/useAuth";
import { useGetActiveAlarms } from "../hooks/useCa0101Queries";
import CA0101Stepper from "../components/CA0101Stepper";

const CA0101Workspace = () => {
  const { user } = useAuth();
  const [expandedAlarmId, setExpandedAlarmId] = useState(null);
  
  // Custom Hook reemplazando manual fetch (T10)
  const { data: activeAlarms = [], isLoading: loading, refetch } = useGetActiveAlarms();

  const toggleStepper = (id) => {
    setExpandedAlarmId(expandedAlarmId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-6">
      {/* Header Premium (Glassmorphism) */}
      <header className="mb-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-6 shadow-2xl flex justify-between items-center transition hover:bg-white/10 duration-300">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-yellow-300 drop-shadow-md">
            GXP Command Center
          </h1>
          <p className="text-sm text-gray-400 mt-1 uppercase tracking-widest font-semibold">
            CA-01-01 | Control de Termohigrómetros y Cadenas Térmicas
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-300">{user?.name || "Auditor"}</p>
            <p className="text-xs text-red-400 font-bold tracking-widest uppercase">
              {user?.role || "Quality Control"}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-red-600 to-orange-500 shadow-lg shadow-red-500/30 flex items-center justify-center font-bold text-white text-lg">
            GXP
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Columna Izquierda: HUD Predictivo */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 hover:shadow-xl hover:shadow-red-500/10 transition-all duration-300">
            <h2 className="text-sm text-gray-400 uppercase tracking-widest font-bold mb-4">Estado del Sistema</h2>
            <div className="flex items-center space-x-4">
              <div className={`p-4 rounded-full ${activeAlarms.length > 0 ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500"}`}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div>
                <p className="text-3xl font-black">{activeAlarms.length}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Desviaciones Abiertas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Trazabilidad / Alarmas Activas */}
        <div className="lg:col-span-2">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/10 bg-black/40 flex justify-between items-center">
              <h2 className="font-bold text-lg text-white">Búsqueda y Trazabilidad Activa</h2>
              <button 
                onClick={() => refetch()}
                className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-3 rounded shadow shadow-red-500/50 transition-colors"
                disabled={loading}
              >
                Refrescar <span className="opacity-70">↻</span>
              </button>
            </div>
            
            <div className="p-0">
              {loading ? (
                <div className="p-8 text-center text-gray-400 animate-pulse">Obteniendo espectro térmico...</div>
              ) : activeAlarms.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-300">Entorno Estabilizado</h3>
                  <p className="text-sm text-gray-500 mt-2">Los termohigrómetros no reportan excursiones recientes (Rango 2-8°C).</p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {activeAlarms.map((alarm) => (
                    <div key={alarm.id} className="p-6 hover:bg-white/5 transition-colors group">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30">
                              {alarm.status}
                            </span>
                            <span className="text-gray-400 text-xs font-mono">{new Date(alarm.created_at).toLocaleString()}</span>
                          </div>
                          <h4 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">{alarm.device_name}</h4>
                          <p className="text-sm text-gray-400">{alarm.location}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-red-500 drop-shadow-md">{alarm.temperature}°C</p>
                          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Excursión</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                         <button 
                            onClick={() => toggleStepper(alarm.id)}
                            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 text-sm font-semibold text-gray-300 transition-all">
                           {expandedAlarmId === alarm.id ? "Contraer Causa Raíz" : "Gestionar CAPA"}
                         </button>
                      </div>

                      {/* Render Condicional del Stepper T09 */}
                      {expandedAlarmId === alarm.id && (
                         <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                           <CA0101Stepper 
                              alarm={alarm} 
                              currentUser={user}
                              onTransitionSuccess={() => refetch()}
                           />
                         </div>
                      )}

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CA0101Workspace;
