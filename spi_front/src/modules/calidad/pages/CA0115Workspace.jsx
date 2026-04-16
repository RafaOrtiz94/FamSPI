import React, { useMemo, useState } from "react";
import { FiActivity, FiCheckCircle, FiFileText, FiSearch } from "react-icons/fi";
import { useAuth } from "../../../core/auth/useAuth";

const laneCards = [
  { key: "audits", title: "Auditorías", description: "Gestión de auditorías", accent: "from-blue-500 to-cyan-600", icon: FiSearch },
  { key: "findings", title: "Hallazgos", description: "Hallazgos y NC", accent: "from-red-500 to-rose-600", icon: FiFileText },
  { key: "evidences", title: "Evidencias", description: "Evidencias", accent: "from-violet-500 to-purple-600", icon: FiFileText },
  { key: "checklists", title: "Checklists", description: "Checklists", accent: "from-green-500 to-emerald-600", icon: FiCheckCircle },
];

export default function CA0115Workspace() {
  const { user } = useAuth();
  const [selectedLane, setSelectedLane] = useState(null);
  const userRoles = useMemo(() => user?.roles || [], [user]);
  const canWrite = useMemo(() => userRoles.includes("calidad") || userRoles.includes("gerencia"), [userRoles]);
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FiSearch className="text-blue-600" />Auditorías Internas/Externas</h1>
        <p className="text-sm text-gray-600 mt-1">Sistema de gestión de auditorías GXP.</p>
      </header>
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {laneCards.map((lane) => (<button key={lane.key} onClick={() => setSelectedLane(lane.key)} className={`relative overflow-hidden rounded-lg border p-5 text-left transition-all ${selectedLane === lane.key ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-200 hover:border-gray-300"}`}><div className={`absolute inset-0 bg-gradient-to-br opacity-10 ${lane.accent}`} /><div className="relative"><div className="flex items-center justify-between mb-3"><lane.icon className="w-6 h-6 text-gray-700" />{canWrite && <span className="text-xs text-green-600 font-medium">Editable</span>}</div><h3 className="font-semibold text-gray-900">{lane.title}</h3><p className="text-sm text-gray-600 mt-1">{lane.description}</p></div></button>))}
        </div>
        {selectedLane && (<div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4"><div className="text-center py-8 text-gray-500"><FiActivity className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-sm">Conecta los hooks/queries del endpoint REST.</p></div></div>)}
      </div>
    </div>
  );
}