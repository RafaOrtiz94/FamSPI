import React from "react";
import { FiSave, FiMenu } from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";

const PersonnelHeader = ({
  selectedRequest,
  selectedCollaborator,
  selectedApplicant,
  onSave,
  saving,
  loading,
  onToggleSidebar, // For mobile if needed
}) => {
  if (!selectedRequest && !selectedCollaborator) {
    return (
      <div className="flex h-16 items-center border-b border-gray-200 bg-white px-6">
        <h1 className="text-lg font-bold text-gray-900">Workspace de Personal</h1>
      </div>
    );
  }

  if (selectedCollaborator) {
    return (
      <div className="sticky top-0 z-10 flex flex-col gap-4 border-b border-gray-200 bg-white px-6 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {selectedCollaborator.fullname || selectedCollaborator.email}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                Colaborador activo
              </span>
              {selectedCollaborator.department_name && (
                <>
                  <span></span>
                  <span>{selectedCollaborator.department_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={FiSave}
            onClick={onSave}
            disabled={saving || loading}
            className="w-full sm:w-auto"
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-4 border-b border-gray-200 bg-white px-6 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile menu button could go here */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">
            {selectedRequest.position_title}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
              {selectedRequest.request_number}
            </span>
            <span>•</span>
            <span>{selectedRequest.department_name}</span>
            <span>•</span>
            <span
              className={`font-semibold ${selectedRequest.status === "completada"
                ? "text-emerald-600"
                : "text-blue-600"
                }`}
            >
              {selectedRequest.status === "completada"
                ? "Completada"
                : "En Proceso"}
            </span>
            {selectedApplicant?.fullname && (
              <>
                <span></span>
                <span className="text-blue-600 font-semibold">
                  Postulante: {selectedApplicant.fullname}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          icon={FiSave}
          onClick={onSave}
          disabled={saving || loading}
          className="w-full sm:w-auto"
        >
          {saving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
};

export default PersonnelHeader;
