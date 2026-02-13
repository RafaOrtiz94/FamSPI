import React from "react";
import { FiChevronRight } from "react-icons/fi";

const RequestList = ({ requests, selectedRequestId, onSelect }) => {
  if (requests.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No hay solicitudes aprobadas.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {requests.map((request) => (
        <button
          key={request.id}
          onClick={() => onSelect(request)}
          className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition ${
            String(request.id) === String(selectedRequestId)
              ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400"
              : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-900 truncate">
              {request.position_title}
            </p>
            {request.status === "completada" ? (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Colaborador
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                Postulante
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{request.request_number}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {request.department_name || "N/A"}
          </p>
        </button>
      ))}
    </div>
  );
};

export default RequestList;
