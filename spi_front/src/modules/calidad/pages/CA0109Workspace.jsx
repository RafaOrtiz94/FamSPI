import React, { useMemo, useState } from "react";
import { FiActivity, FiCheckCircle, FiAlertTriangle, FiTrendingUp, FiShield, FiZap } from "react-icons/fi";
import { useAuth } from "../../../core/auth/useAuth";
import CA0109Stepper from "../components/CA0109Stepper";
const laneCards = [
  { key: "rca", title: "RCA", description: "Root Cause Analysis", accent: "from-violet-500 to-purple-600", icon: FiAlertTriangle },
  { key: "action_plan", title: "Plan de Acción", description: "Action plans", accent: "from-blue-500 to-cyan-600", icon: FiCheckCircle },
  { key: "escalation", title: "Escalación", description: "Escalations", accent: "from-orange-500 to-amber-600", icon: FiZap },
  { key: "effectiveness", title: "Efectividad", description: "Effectiveness", accent: "from-green-500 to-emerald-600", icon: FiTrendingUp },
];
const summaryCards = [
  { title: "Flujos activos", value: "4", helper: "RCA, action plan, escalation, effectiveness", icon: FiActivity },
  { title: "RBAC", value: "Privado", helper: "Rutas protegidas", icon: FiShield },
  { title: "Trazabilidad", value: "GXP", helper: "Workflow y SLA listos", icon: FiTrendingUp },
  { title: "Integración", value: "CAPA", helper: "Sistema de acciones correctivas", icon: FiCheckCircle },
];
export default function CA0109Workspace() {
  const { user } = useAuth();
  const [selectedLane, setSelectedLane] = useState(null);
  const [expandedRecord, setExpandedRecord] = useState(null);
  const userRoles = useMemo(() => user?.roles || [], [user]);
  const canWrite = useMemo(() => userRoles.includes("calidad") || userRoles.includes("gerencia"), [userRoles]);
  const handleLaneClick = (lane) => setSelectedLane(lane.key === selectedLane ? null : lane.key);
  const handleExpandRecord = (record) => setExpandedRecord(record?.id === expandedRecord?.id ? null : record);
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FiActivity className="text-violet-600" />CAPA (Acciones Correctivas)</h1>
        <p className="text-sm text-gray-600 mt-1">Sistema de gestión de acciones correctivas GXP.</p>
      </header>
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {summaryCards.map((card, i) => (<div key={i} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">{card.title}</span><card.icon className="w-5 h-5 text-gray-400" />}</div><p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p><p className="text-xs text-gray-500 mt-1">{card.helper}</p></div>))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {laneCards.map((lane) => (<button key={lane.key} onClick={() => handleLaneClick(lane)} className={`relative overflow-hidden rounded-lg border p-5 text-left transition-all ${selectedLane === lane.key ? "border-violet-500 ring-2 ring-violet-500/20" : "border-gray-200 hover:border-gray-300 hover:shadow-md"}`}><div className={`absolute inset-0 bg-gradient-to-br opacity-10 ${lane.accent}`} /><div className="relative"><div className="flex items-center justify-between mb-3"><lane.icon className="w-6 h-6 text-gray-700" />{canWrite && <span className="text-xs text-green-600 font-medium">Editable</span>}</div><h3 className="font-semibold text-gray-900">{lane.title}</h3><p className="text-sm text-gray-600 mt-1 line-clamp-2">{lane.description}</p></div></button>))}
        </div>
        {selectedLane && (<div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"><div className="border-b border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between"><h3 className="font-semibold text-gray-900 capitalize">{laneCards.find(l => l.key === selectedLane)?.title || selectedLane}</h3>{canWrite && <button className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700">+ Nuevo</button>}</div><div className="p-4"><div className="text-center py-8 text-gray-500"><FiActivity className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-sm">Conecta los hooks/queries del endpoint REST.</p></div></div></div>)}
        {expandedRecord && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"><CA0109Stepper record={expandedRecord} onClose={() => handleExpandRecord(null)} /></div></div>)}
      </div>
    </div>
  );
}