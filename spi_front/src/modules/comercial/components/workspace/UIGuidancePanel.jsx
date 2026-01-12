import React, { useState, useEffect } from 'react';
import { getUIGuidance } from '../../../../core/api/businessCaseApi';
import { WORKSPACE_TEXTS, getSectionGuidance } from './i18n';

const UIGuidancePanel = ({ businessCaseId, selectedSection, onGuidanceChange }) => {
  const [guidance, setGuidance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load guidance data on mount and when businessCaseId or selectedSection changes
  useEffect(() => {
    if (businessCaseId) {
      loadGuidance();
    }
  }, [businessCaseId, selectedSection]); // loadGuidance stable, no need in deps

  const loadGuidance = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUIGuidance(businessCaseId);
      setGuidance(data);
    } catch (err) {
      setError('Error cargando guidance');
      console.error('Error loading guidance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadGuidance();
  };

  if (loading && !guidance) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-blue-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-blue-200 rounded w-1/2 mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-blue-200 rounded"></div>
            <div className="h-3 bg-blue-200 rounded w-4/5"></div>
          </div>
        </div>
      </div>
    );
  }

  const sectionGuidance = getSectionGuidance(selectedSection);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-blue-900">{WORKSPACE_TEXTS.guidance.title}</h3>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          ↻ {WORKSPACE_TEXTS.guidance.refresh}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {guidance && (
        <div className="space-y-4">
          {/* Section Info */}
          <div className="border-b border-blue-200 pb-3">
            <h4 className="font-medium text-blue-900">{sectionGuidance.title}</h4>
            <p className="text-sm text-blue-700 mt-1">{sectionGuidance.description}</p>
          </div>

          {/* Tips */}
          {sectionGuidance.tips && sectionGuidance.tips.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-blue-900 mb-2">{WORKSPACE_TEXTS.common.tips}</h5>
              <ul className="text-sm text-blue-800 space-y-1">
                {sectionGuidance.tips.map((tip, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {sectionGuidance.warnings && sectionGuidance.warnings.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-orange-900 mb-2">{WORKSPACE_TEXTS.common.warnings}</h5>
              <ul className="text-sm text-orange-800 space-y-1">
                {sectionGuidance.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-orange-500 mr-2">!</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Workflow State */}
          {guidance.workflowState && (
            <div className="text-xs text-blue-600 border-t border-blue-200 pt-3">
              <p>
                <span className="font-medium">{WORKSPACE_TEXTS.common.currentStatus}:</span> {guidance.workflowState.currentStage}
              </p>
              {guidance.workflowState.availableTransitions && guidance.workflowState.availableTransitions.length > 0 && (
                <p className="mt-1">
                  <span className="font-medium">{WORKSPACE_TEXTS.common.availableTransitions}:</span>{' '}
                  {guidance.workflowState.availableTransitions.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Permissions */}
          {guidance.permissions && (
            <div className="text-xs text-gray-500 border-t border-blue-200 pt-3">
              <p>{WORKSPACE_TEXTS.common.permissions}: {guidance.permissions.canEdit ? WORKSPACE_TEXTS.common.edit : WORKSPACE_TEXTS.common.readOnly}</p>
            </div>
          )}
        </div>
      )}

      {!guidance && !loading && (
        <div className="text-center py-4">
          <p className="text-blue-700 text-sm">{WORKSPACE_TEXTS.guidance.noGuidance}</p>
        </div>
      )}
    </div>
  );
};

export default UIGuidancePanel;
