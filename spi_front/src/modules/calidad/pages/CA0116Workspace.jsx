import React, { useState } from "react";
import { FiActivity, FiFileText } from "react-icons/fi";

export default function CA0116Workspace() {
  const [selectedLane, setSelectedLane] = useState(null);
  const lanes = [
    { key: "batches", title: "Lotes", desc: "Lotes de muestreo" },
    { key: "analysis", title: "Analisis", desc: "Resultados" },
    { key: "approvals", title: "Aprobaciones", desc: "Aprobaciones" },
    { key: "releases", title: "Liberaciones", desc: "Liberaciones" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <FiActivity className="text-blue-600" />
          Muestreo y Aprobacion
        </h1>
        <p className="mt-1 text-sm text-gray-600">Sistema de muestreo GXP.</p>
      </header>
      <div className="flex-1 p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {lanes.map((lane) => (
            <button
              key={lane.key}
              type="button"
              onClick={() => setSelectedLane(lane.key)}
              className={`rounded-lg border p-5 text-left ${
                selectedLane === lane.key ? "border-blue-500 ring-2" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <FiFileText className="h-6 w-6 text-gray-700" />
                <span className="text-xs font-medium text-green-600">Editable</span>
              </div>
              <h3 className="font-semibold text-gray-900">{lane.title}</h3>
              <p className="text-sm text-gray-600">{lane.desc}</p>
            </button>
          ))}
        </div>
        {selectedLane ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="py-8 text-center text-gray-500">
              <FiActivity className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-sm">Conecta los hooks/queries.</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
