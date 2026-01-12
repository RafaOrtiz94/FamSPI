import React, { useState, useEffect } from 'react';
import { getDataOwnership, recordSectionCompletion } from '../../../../core/api/businessCaseApi';
import { formatDateSafe } from '../../../../shared/utils/dateUtils';
import { WORKSPACE_TEXTS } from './i18n';

const OwnershipPanel = ({ businessCaseId, selectedSection, onOwnershipChange }) => {
  console.log('[WORKSPACE_DEBUG] OwnershipPanel props', {
    businessCaseId: typeof businessCaseId,
    selectedSection: typeof selectedSection,
    hasOnOwnershipChange: !!onOwnershipChange
  });

  const [ownership, setOwnership] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadOwnership = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDataOwnership(businessCaseId);

      console.log('[WORKSPACE_DEBUG] OwnershipPanel date fields sample', {
        lastModified: data?.sections?.[Object.keys(data?.sections || {})[0]]?.lastModified,
        lastModifiedType: typeof data?.sections?.[Object.keys(data?.sections || {})[0]]?.lastModified,
        sectionsKeys: Object.keys(data?.sections || {}),
        owner: data?.owner
      });

      setOwnership(data);
    } catch (err) {
      setError('Error cargando ownership');
      console.error('Error loading ownership:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load ownership data on mount and when businessCaseId changes
  useEffect(() => {
    if (businessCaseId) {
      loadOwnership();
    }
  }, [businessCaseId]);

  const handleTakeOwnership = async () => {
    try {
      setLoading(true);
      setError(null);
      // In production, this would call a take ownership endpoint
      // For now, just reload ownership
      await loadOwnership();
      onOwnershipChange && onOwnershipChange();
    } catch (err) {
      setError('Error tomando ownership');
      console.error('Error taking ownership:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSection = async () => {
    if (!selectedSection) return;

    try {
      setLoading(true);
      setError(null);
      await recordSectionCompletion(businessCaseId, selectedSection, 'Completed from ownership panel');
      await loadOwnership(); // Refresh ownership data
      onOwnershipChange && onOwnershipChange();
    } catch (err) {
      setError('Error completando sección');
      console.error('Error completing section:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadOwnership();
  };

  if (loading && !ownership) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{WORKSPACE_TEXTS.ownership.title}</h3>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          ↻ {WORKSPACE_TEXTS.ownership.refresh}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {ownership && (
        <div className="space-y-4">
          {/* Current Section Info */}
          <div className="border-b pb-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{WORKSPACE_TEXTS.ownership.currentSection}:</span> {selectedSection || 'Ninguna'}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">{WORKSPACE_TEXTS.ownership.owner}:</span> {ownership.owner || 'System'}
            </p>
            {ownership.sections && ownership.sections[selectedSection] && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">{WORKSPACE_TEXTS.ownership.lastModified}:</span>{' '}
                {formatDateSafe(ownership.sections[selectedSection].lastModified)}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleTakeOwnership}
              disabled={loading}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '...' : WORKSPACE_TEXTS.ownership.takeOwnership}
            </button>

            {selectedSection && (
              <button
                onClick={handleCompleteSection}
                disabled={loading}
                className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? '...' : WORKSPACE_TEXTS.ownership.markComplete}
              </button>
            )}
          </div>

          {/* Section Status */}
          {ownership.sections && (
            <div className="text-xs text-gray-500">
              <p>{WORKSPACE_TEXTS.ownership.sectionStatus}:</p>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {Object.entries(ownership.sections).map(([section, data]) => (
                  <div key={section} className="flex justify-between">
                    <span>{section}:</span>
                    <span className={data.lastModified ? 'text-green-600' : 'text-gray-400'}>
                      {data.lastModified ? '✓' : '○'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OwnershipPanel;