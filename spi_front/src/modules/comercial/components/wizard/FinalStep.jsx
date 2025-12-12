import React from "react";
import { FiCheckCircle, FiExternalLink } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const FinalStep = ({ onPrev }) => {
  const { state, clearDraft } = useBusinessCaseWizard();
  const { showToast } = useUI();
  const navigate = useNavigate();

  const finalize = () => {
    if (!state.businessCaseId) {
      showToast("No hay Business Case para finalizar", "warning");
      return;
    }

    // Limpiar draft del localStorage
    localStorage.removeItem('business_case_wizard_draft');
    clearDraft();

    // Redirigir a vista unificada
    navigate(`/dashboard/business-case/${state.businessCaseId}/view`);

    showToast('Business Case creado exitosamente', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
          <FiCheckCircle />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">¡Listo!</h2>
          <p className="text-sm text-gray-500">Revisa el resumen y finaliza el Business Case.</p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <p className="text-sm text-gray-700">ID de Business Case: {state.businessCaseId || "Sin generar"}</p>
        <p className="text-sm text-gray-700">Equipo seleccionado: {state.selectedEquipment?.name || "Sin equipo"}</p>
        <p className="text-sm text-gray-700">Determinaciones: {state.determinations?.length || 0}</p>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onPrev} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700">
          Regresar
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 inline-flex items-center gap-2"
          >
            <FiExternalLink /> Exportar PDF
          </button>
          <button
            type="button"
            onClick={finalize}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white"
          >
            Finalizar Business Case
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalStep;
