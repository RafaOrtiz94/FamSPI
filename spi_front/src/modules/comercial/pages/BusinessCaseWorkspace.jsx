import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getBusinessCase,
  getUIGuidance,
  recordSectionCompletion,
  normalizeUIGuidanceResponse,
  createAutosaveManager
} from "../../../core/api/businessCaseApi";
import { useUI } from "../../../core/ui/UIContext";
import CaseHeader from "../components/workspace/CaseHeader";
import WorkspaceContent from "../components/workspace/WorkspaceContent";
import WorkspaceFooter from "../components/workspace/WorkspaceFooter";
import OwnershipPanel from "../components/workspace/OwnershipPanel";
import UIGuidancePanel from "../components/workspace/UIGuidancePanel";
import BusinessCasePicker from "../components/BusinessCasePicker";
import ErrorBoundary from "../../../core/ui/components/ErrorBoundary";

const BusinessCaseWorkspace = () => {
  const { id: bcId } = useParams();
  const { showToast } = useUI();
  const [selectedSection, setSelectedSection] = useState("general");
  const [businessCase, setBusinessCase] = useState(null);
  const [uiGuidance, setUiGuidance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Autosave manager ref
  const autosaveManagerRef = useRef(null);

  const handleSectionSelect = (sectionId) => {
    setSelectedSection(sectionId);
  };

  const handleSectionSave = async () => {
    if (!uiGuidance) return;

    console.log("DEBUG: handleSectionSave called");

    try {
      // Refresh UI guidance to get updated completion indicators
      const data = await getUIGuidance(bcId);
      console.log("DEBUG: New UI guidance data", data);
      setUiGuidance(data);
      console.log("DEBUG: uiGuidance state updated");
      showToast("Sección guardada y datos actualizados", "success");
    } catch (err) {
      console.error("Failed to refresh UI guidance after save:", err);
      showToast("Error actualizando datos después del guardado", "error");
    }
  };

  const handleSectionComplete = async () => {
    if (!uiGuidance || !selectedSection) return;

    try {
      // Check if user can complete this section
      const sectionRule = uiGuidance.sectionOwnership.rules[selectedSection];
      if (!sectionRule?.canUserComplete) {
        showToast("No tienes permisos para completar esta sección", "error");
        return;
      }

      await recordSectionCompletion(bcId, selectedSection, "Manual completion from workspace");
      showToast(`Sección ${selectedSection} marcada como completada`, "success");

      // Refresh UI guidance to update completion indicators
      const data = await getUIGuidance(bcId);
      setUiGuidance(data);
    } catch (err) {
      console.error("Failed to complete section:", err);
      // Show backend error verbatim
      showToast(err.response?.data?.message || err.message || "Error completando sección", "error");
    }
  };

  // Initialize autosave manager and fetch data on mount and when bcId changes
  useEffect(() => {
    const fetchWorkspaceData = async () => {
      if (!bcId) {
        // No bcId provided - show picker instead of workspace
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Create autosave manager
        autosaveManagerRef.current = createAutosaveManager(bcId);

        // Load complete business case and UI guidance in parallel
        const [businessCaseData, uiGuidanceData] = await Promise.all([
          getBusinessCase(bcId),
          getUIGuidance(bcId)
        ]);

        console.log('[WORKSPACE_DEBUG] getUIGuidance response shape', { hasUIGuidance: !!uiGuidanceData, keys: Object.keys(uiGuidanceData||{}) });

        // Normalize UI guidance response
        const normalizedUIGuidance = normalizeUIGuidanceResponse(uiGuidanceData);

        setBusinessCase(businessCaseData);
        setUiGuidance(normalizedUIGuidance);
      } catch (err) {
        console.error("Failed to fetch workspace data:", err);
        setError(err.message || "Failed to load workspace data");
        showToast("Error cargando datos del workspace", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceData();

    // Cleanup function
    return () => {
      if (autosaveManagerRef.current) {
        autosaveManagerRef.current.destroy();
        autosaveManagerRef.current = null;
      }
    };
  }, [bcId]); // Removed showToast from dependencies to prevent infinite re-renders

  const handleRefresh = async () => {
    if (!bcId) return;

    try {
      const data = await getUIGuidance(bcId);
      setUiGuidance(data);
      showToast("Datos actualizados", "success");
    } catch (err) {
      console.error("Failed to refresh UI guidance:", err);
      showToast("Error actualizando datos", "error");
    }
  };

  const handleStateTransition = () => {
    console.log("State transition clicked");
  };

  // Show picker when no bcId is provided
  if (!bcId) {
    return <BusinessCasePicker />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
              Business Case Workspace
            </p>
            <h1 className="text-2xl font-bold text-gray-900">Workspace Moderno</h1>
            <p className="text-sm text-gray-600">
              Gestión colaborativa de casos de negocio por secciones
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
              Business Case Workspace
            </p>
            <h1 className="text-2xl font-bold text-gray-900">Workspace Moderno</h1>
            <p className="text-sm text-gray-600">
              Gestión colaborativa de casos de negocio por secciones
            </p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error cargando workspace</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!uiGuidance) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
              Business Case Workspace
            </p>
            <h1 className="text-2xl font-bold text-gray-900">Workspace Moderno</h1>
            <p className="text-sm text-gray-600">
              Gestión colaborativa de casos de negocio por secciones
            </p>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-600">No se encontraron datos del workspace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
            Business Case Workspace
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Workspace Moderno</h1>
          <p className="text-sm text-gray-600">
            Gestión colaborativa de casos de negocio por secciones
          </p>
        </div>
      </div>

      <CaseHeader uiGuidance={uiGuidance} onRefresh={handleRefresh} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content - 3 columns */}
        <div className="lg:col-span-3">
          <WorkspaceContent
            selectedSection={selectedSection}
            businessCase={businessCase}
            uiGuidance={uiGuidance}
            onSectionSelect={handleSectionSelect}
            onSectionSave={handleSectionSave}
          />
        </div>

        {/* Side Panels - 1 column */}
        <div className="lg:col-span-1 space-y-6">
          <ErrorBoundary title="Panel de Ownership" message="Error en el panel de ownership y completion.">
            <OwnershipPanel
              businessCaseId={bcId}
              selectedSection={selectedSection}
              onOwnershipChange={handleRefresh}
            />
          </ErrorBoundary>

          <ErrorBoundary title="Panel de UI Guidance" message="Error en el panel de guidance.">
            <UIGuidancePanel
              businessCaseId={bcId}
              selectedSection={selectedSection}
              onGuidanceChange={handleRefresh}
            />
          </ErrorBoundary>
        </div>
      </div>

      <WorkspaceFooter
        selectedSection={selectedSection}
        uiGuidance={uiGuidance}
        onSectionSave={handleSectionSave}
        onSectionComplete={handleSectionComplete}
        onStateTransition={handleStateTransition}
      />
    </div>
  );
};

export default BusinessCaseWorkspace;
