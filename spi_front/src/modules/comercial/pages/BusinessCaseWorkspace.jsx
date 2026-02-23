import React, { useCallback, useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getBusinessCase,
  getUIGuidance,
  normalizeUIGuidanceResponse,
  createAutosaveManager,
  recordSectionCompletion,
} from "../../../core/api/businessCaseApi";
import { useUI } from "../../../core/ui/UIContext";
import { recordBusinessCaseTelemetry } from "../../../core/utils/businessCaseTelemetry";
import { getApiErrorMessage } from "../../../core/utils/apiErrors";
import CaseHeader from "../components/workspace/CaseHeader";
import WorkspaceContent from "../components/workspace/WorkspaceContent";
import UIGuidancePanel from "../components/workspace/UIGuidancePanel";
import BusinessCasePicker from "../components/BusinessCasePicker";
import ErrorBoundary from "../../../core/ui/components/ErrorBoundary";
import { BusinessCaseWorkspaceContext } from "../components/workspace/BusinessCaseWorkspaceContext";

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

  const handleSectionSave = useCallback(async (options = {}) => {
    if (!uiGuidance) return;
    if (options?.refresh === false) return;

    const startedAt = Date.now();
    try {
      const shouldMarkComplete = options?.markComplete !== false;
      if (bcId && options?.section && shouldMarkComplete) {
        const sectionLabel = String(options.section || "seccion").replace(/_/g, " ");
        const confirmMessage =
          `Vas a confirmar y cerrar la seccion "${sectionLabel}".\n\n` +
          "Si continuas, se bloqueara y avanzara al siguiente paso.\n\n" +
          "¿Deseas continuar?";
        const confirmed = window.confirm(confirmMessage);
        if (confirmed) {
          await recordSectionCompletion(bcId, options.section, options?.reason || null);
        } else {
          showToast("Puedes seguir editando esta seccion antes de continuar.", "info");
        }
      }
      // Refresh UI guidance and business case to rehydrate saved fields
      const [data, businessCaseData] = await Promise.all([
        getUIGuidance(bcId),
        getBusinessCase(bcId)
      ]);
      setUiGuidance(normalizeUIGuidanceResponse(data));
      setBusinessCase(businessCaseData);
      showToast("Seccion guardada y datos actualizados", "success");
      recordBusinessCaseTelemetry({
        section: "workspace",
        type: "refresh_after_save_success",
        durationMs: Date.now() - startedAt,
        success: true,
      });
    } catch (err) {
      console.error("Failed to refresh UI guidance after save:", err);
      showToast(getApiErrorMessage(err, "Error actualizando datos despues del guardado"), "error");
      recordBusinessCaseTelemetry({
        section: "workspace",
        type: "refresh_after_save_error",
        durationMs: Date.now() - startedAt,
        success: false,
      });
    }
  }, [bcId, showToast, uiGuidance]);


  // Initialize autosave manager and fetch data on mount and when bcId changes
  const fetchWorkspaceData = useCallback(async () => {
    if (!bcId) {
      // No bcId provided - show picker instead of workspace
      setLoading(false);
      return;
    }

    const startedAt = Date.now();
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

      // Normalize UI guidance response
      const normalizedUIGuidance = normalizeUIGuidanceResponse(uiGuidanceData);

      setBusinessCase(businessCaseData);
      setUiGuidance(normalizedUIGuidance);
      recordBusinessCaseTelemetry({
        section: "workspace",
        type: "initial_load_success",
        durationMs: Date.now() - startedAt,
        success: true,
      });
    } catch (err) {
      console.error("Failed to fetch workspace data:", err);
      setError(getApiErrorMessage(err, "Failed to load workspace data"));
      showToast(getApiErrorMessage(err, "Error cargando datos del workspace"), "error");
      recordBusinessCaseTelemetry({
        section: "workspace",
        type: "initial_load_error",
        durationMs: Date.now() - startedAt,
        success: false,
      });
    } finally {
      setLoading(false);
    }
  }, [bcId, showToast]);

  useEffect(() => {
    fetchWorkspaceData();

    // Cleanup function
    return () => {
      if (autosaveManagerRef.current) {
        autosaveManagerRef.current.destroy();
        autosaveManagerRef.current = null;
      }
    };
  }, [fetchWorkspaceData]);

  useEffect(() => {
    const preflow = uiGuidance?.preflow;
    const shouldWarn = Boolean(preflow?.isActive && !preflow?.readyToStartProcess && !preflow?.processCreated);
    if (!shouldWarn) return undefined;

    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uiGuidance?.preflow]);

  const handleRefresh = async () => {
    if (!bcId) return;

    try {
      const data = await getUIGuidance(bcId);
      setUiGuidance(normalizeUIGuidanceResponse(data));
      showToast("Datos actualizados", "success");
    } catch (err) {
      console.error("Failed to refresh UI guidance:", err);
      showToast(getApiErrorMessage(err, "Error actualizando datos"), "error");
    }
  };

  // Show picker when no bcId is provided
  if (!bcId) {
    return <BusinessCasePicker />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-4 lg:p-8 space-y-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
              Business Case Workspace
            </p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Workspace Moderno</h1>
            <p className="text-sm text-gray-600">
              Gestión colaborativa de casos de negocio por secciones
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Cargando workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 lg:p-8 space-y-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
              Business Case Workspace
            </p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Workspace Moderno</h1>
            <p className="text-sm text-gray-600">
              Gestión colaborativa de casos de negocio por secciones
            </p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center shadow-sm">
          <div className="text-red-500 mb-4 bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-red-900 mb-2">Error cargando workspace</h3>
          <p className="text-red-700 mb-6">{error}</p>
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

  const workspaceContextValue = {
    bcId,
    selectedSection,
    setSelectedSection: handleSectionSelect,
    businessCase,
    uiGuidance,
    onSectionSave: handleSectionSave,
    onRefresh: handleRefresh,
  };

  return (
    <BusinessCaseWorkspaceContext.Provider value={workspaceContextValue}>
    <div className="p-4 lg:p-8 space-y-6 bg-gray-50 min-h-screen">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
            Business Case Workspace
          </p>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Workspace Moderno</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión colaborativa de casos de negocio por secciones
          </p>
          {(businessCase?.modern_bc_metadata?.source_module === "equipment_purchases" ||
            businessCase?.modern_bc_metadata?.auto_created === true) && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                <span>Auto desde Compras Publicas</span>
                {businessCase?.modern_bc_metadata?.source_purchase_request_id && (
                  <span>#{String(businessCase.modern_bc_metadata.source_purchase_request_id).slice(0, 8)}</span>
                )}
              </div>
            )}
        </div>
      </div>

      <CaseHeader uiGuidance={uiGuidance} onRefresh={handleRefresh} />

      <div className="space-y-6">
        <WorkspaceContent
          selectedSection={selectedSection}
          businessCase={businessCase}
          uiGuidance={uiGuidance}
          onSectionSelect={handleSectionSelect}
          onSectionSave={handleSectionSave}
        />
      </div>

      <ErrorBoundary title="Panel de UI Guidance" message="Error en el panel de guidance.">
        <UIGuidancePanel
          businessCaseId={bcId}
          selectedSection={selectedSection}
        />
      </ErrorBoundary>
    </div>
    </BusinessCaseWorkspaceContext.Provider>
  );
};

export default BusinessCaseWorkspace;


