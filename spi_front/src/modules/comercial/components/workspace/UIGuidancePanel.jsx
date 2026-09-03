import React, { useState, useEffect } from 'react';
import { getUIGuidance, normalizeUIGuidanceResponse } from '../../../../core/api/businessCaseApi';
import { WORKSPACE_TEXTS, getSectionGuidance } from './i18n';

const UIGuidancePanel = ({ businessCaseId, selectedSection }) => {
 const [guidance, setGuidance] = useState(null);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState(null);
 const [isOpen, setIsOpen] = useState(false);

 useEffect(() => {
 if (businessCaseId && isOpen) {
 loadGuidance();
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [businessCaseId, isOpen]);

 const loadGuidance = async () => {
 try {
 setLoading(true);
 setError(null);
 const data = await getUIGuidance(businessCaseId);
 setGuidance(normalizeUIGuidanceResponse(data));
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

 const sectionGuidance = getSectionGuidance(selectedSection);

 return (
 <div className="fixed left-4 bottom-6 z-40">
 <button
 type="button"
 onClick={() => setIsOpen((prev) => !prev)}
 className="flex items-center justify-center bg-emerald-600 text-white rounded-full shadow-lg h-12 w-12 text-lg font-bold hover:bg-emerald-700 transition-colors"
 aria-expanded={isOpen}
 aria-label="Ayuda"
 title="Ayuda"
 >
 ?
 </button>

 {isOpen && (
 <div className="absolute left-0 bottom-14 w-[320px] max-w-[80vw] bg-blue-50/95 border border-blue-100 rounded-2xl p-5 shadow-xl">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-blue-900 tracking-tight">{WORKSPACE_TEXTS.guidance.title}</h3>
 <button
 onClick={handleRefresh}
 disabled={loading}
 className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
 >
 Actualizar
 </button>
 </div>

 {loading && !guidance && (
 <div className="animate-pulse mb-4">
 <div className="h-4 bg-blue-200 rounded w-3/4 mb-2"></div>
 <div className="h-3 bg-blue-200 rounded w-1/2 mb-3"></div>
 <div className="space-y-2">
 <div className="h-3 bg-blue-200 rounded"></div>
 <div className="h-3 bg-blue-200 rounded w-4/5"></div>
 </div>
 </div>
 )}

 {error && (
 <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
 <p className="text-red-700 text-sm font-medium">{error}</p>
 </div>
 )}

 {guidance && (
 <div className="space-y-4">
 <div className="border-b border-blue-100 pb-3">
 <h4 className="font-bold text-blue-900">{sectionGuidance.title}</h4>
 <p className="text-sm text-blue-700 mt-1 leading-relaxed">{sectionGuidance.description}</p>
 </div>

 {sectionGuidance.tips && sectionGuidance.tips.length > 0 && (
 <div className="bg-white/70 rounded-xl p-3">
 <h5 className="text-xs font-bold uppercase tracking-wide text-blue-900 mb-2">{WORKSPACE_TEXTS.common.tips}</h5>
 <ul className="text-sm text-blue-800 space-y-2">
 {sectionGuidance.tips.map((tip, index) => (
 <li key={index} className="flex items-start">
 <span className="text-blue-500 mr-2 font-bold">-</span>
 <span className="leading-snug">{tip}</span>
 </li>
 ))}
 </ul>
 </div>
 )}

 {sectionGuidance.warnings && sectionGuidance.warnings.length > 0 && (
 <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
 <h5 className="text-xs font-bold uppercase tracking-wide text-orange-900 mb-2">{WORKSPACE_TEXTS.common.warnings}</h5>
 <ul className="text-sm text-orange-800 space-y-2">
 {sectionGuidance.warnings.map((warning, index) => (
 <li key={index} className="flex items-start">
 <span className="text-orange-500 mr-2 font-bold">!</span>
 <span className="leading-snug">{warning}</span>
 </li>
 ))}
 </ul>
 </div>
 )}

 {guidance.workflowState && (
 <div className="text-xs text-blue-600 border-t border-blue-100 pt-3">
 <p className="mb-1">
 <span className="font-bold text-blue-800">{WORKSPACE_TEXTS.common.currentStatus}:</span> {guidance.workflowState.currentStage}
 </p>
 {guidance.workflowState.availableTransitions && guidance.workflowState.availableTransitions.length > 0 && (
 <p>
 <span className="font-bold text-blue-800">{WORKSPACE_TEXTS.common.availableTransitions}:</span>{' '}
 {guidance.workflowState.availableTransitions.join(', ')}
 </p>
 )}
 </div>
 )}

 {guidance.permissions && (
 <div className="text-xs text-gray-500 pt-1">
 <p><span className="font-semibold">{WORKSPACE_TEXTS.common.permissions}:</span> {guidance.permissions.canEdit ? WORKSPACE_TEXTS.common.edit : WORKSPACE_TEXTS.common.readOnly}</p>
 </div>
 )}
 </div>
 )}

 {!guidance && !loading && (
 <div className="text-center py-6">
 <p className="text-blue-700 text-sm font-medium">{WORKSPACE_TEXTS.guidance.noGuidance}</p>
 </div>
 )}
 </div>
 )}
 </div>
 );
};

export default UIGuidancePanel;
