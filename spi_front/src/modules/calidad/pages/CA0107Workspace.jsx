import React, { useMemo, useState } from "react";
import { FiEdit3, FiAlertCircle, FiDollarSign, FiLink, FiShield, FiTrendingUp, FiActivity, FiUser } from "react-icons/fi";
import { useAuth } from "../../../core/auth/useAuth";
import CA0107Stepper from "../components/CA0107Stepper";
import Modal from "../../../core/ui/components/Modal";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";

const laneCards = [
  { key: "intake", title: "Intake", description: "Formulario de ingreso de quejas.", accent: "from-red-500 to-rose-600", icon: FiEdit3 },
  { key: "investigation", title: "Investigación", description: "Análisis de root cause.", accent: "from-blue-500 to-cyan-600", icon: FiAlertCircle },
  { key: "refunds", title: "Reembolsos", description: "Gestión de compensaciones.", accent: "from-green-500 to-emerald-600", icon: FiDollarSign },
  { key: "capa_link", title: "CAPA", description: "Link a acciones correctivas.", accent: "from-purple-500 to-fuchsia-600", icon: FiLink },
];

const summaryCards = [
  { title: "Flujos activos", value: "4", helper: "Intake, investigación, reembolsos y CAPA.", icon: FiActivity },
  { title: "RBAC", value: "Privado", helper: "Rutas protegidas para calidad y gerencia.", icon: FiShield },
  { title: "Trazabilidad", value: "GXP", helper: "Persistencia y workflow listos.", icon: FiTrendingUp },
  { title: "Integración", value: "CAPA", helper: "Link al sistema de acciones correctivas.", icon: FiLink },
];

export default function CA0107Workspace() {
  const { user } = useAuth();
  const [selectedLane, setSelectedLane] = useState(null);
  const [expandedRecord, setExpandedRecord] = useState(null);

  const userRoles = useMemo(() => user?.roles || [], [user]);
  const canWrite = useMemo(() => userRoles.includes("calidad") || userRoles.includes("gerencia"), [userRoles]);

  const handleLaneClick = (lane) => setSelectedLane(lane.key === selectedLane ? null : lane.key);
  const handleExpandRecord = (record) => setExpandedRecord(record?.id === expandedRecord?.id ? null : record);

  return (
    <div className={WORKSPACE_PAGE_CLASS}>
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiAlertCircle className="text-red-600" />
          Quejas y Reclamos
        </h1>
        <p className="text-sm text-gray-600 mt-1">Sistema de gestión de quejas GXP con investigación y link a CAPA.</p>
      </header>

      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {summaryCards.map((card, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">{card.title}</span>
                <card.icon className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.helper}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {laneCards.map((lane) => (
            <button key={lane.key} onClick={() => handleLaneClick(lane)}
              className={`relative overflow-hidden rounded-lg border p-5 text-left transition-all ${selectedLane === lane.key ? "border-red-500 ring-2 ring-red-500/20" : "border-gray-200 hover:border-gray-300 hover:shadow-md"}`}>
              <div className={`absolute inset-0 bg-gradient-to-br opacity-10 ${lane.accent}`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <lane.icon className="w-6 h-6 text-gray-700" />
                  {canWrite && <span className="text-xs text-green-600 font-medium">Editable</span>}
                </div>
                <h3 className="font-semibold text-gray-900">{lane.title}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{lane.description}</p>
              </div>
            </button>
          ))}
        </div>

        {selectedLane && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 capitalize">
                {laneCards.find(l => l.key === selectedLane)?.title || selectedLane}
              </h3>
              {canWrite && <button className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">+ Nuevo</button>}
            </div>
            <div className="p-4">
              <div className="text-center py-8 text-gray-500">
                <FiUser className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Conecta los hooks/queries del endpoint REST.</p>
              </div>
            </div>
          </div>
        )}

        <Modal open={Boolean(expandedRecord)} onClose={() => handleExpandRecord(null)} maxWidth="max-w-2xl">
          {expandedRecord && <CA0107Stepper record={expandedRecord} onClose={() => handleExpandRecord(null)} />}
        </Modal>
      </div>
    </div>
  );
}