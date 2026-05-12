import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../../../../core/auth/AuthContext';
import EquipmentPurchasesPage from '../../../comercial/pages/EquipmentPurchases';
import { RequestsSection } from './sections/RequestsSection';
import { AnalyticsSection } from './sections/AnalyticsSection';
import TechnicalProcedureWorkspace from '../../../servicio/pages/TechnicalProcedureWorkspace';
import TrainingWorkflowWorkspace from '../../../servicio/components/TrainingWorkflowWorkspace';
import { FiList, FiTool, FiBookOpen, FiBarChart2, FiGlobe, FiClock } from 'react-icons/fi';
import SoceTrackSection from './sections/SoceTrackSection';
import { TimelineSection } from './sections/TimelineSection';

const EASE_OUT = [0.23, 1, 0.32, 1];

const normalizeRoles = (user) => {
  if (!user) return [];
  const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? [];
  const rawScopes = user?.scope ?? user?.user?.scope ?? [];
  return [...(Array.isArray(rawRoles) ? rawRoles : [rawRoles]), ...(Array.isArray(rawScopes) ? rawScopes : [rawScopes])]
    .flatMap((r) => String(r || '').split(/[,\s]+/))
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean);
};

const hasRole = (roles, token) => roles.some((r) => r === token || r.includes(token));

const STATUS_BADGE = {
  requests:     null,
  tecnica:      null,
  entrenamiento: null,
  analytics:    null,
};

const PublicPurchasesTab = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('requests');
  const userRoles = useMemo(() => normalizeRoles(user), [user]);

  const isACP       = hasRole(userRoles, 'acp_comercial');
  const isTechnical = hasRole(userRoles, 'jefe_tecnico') || hasRole(userRoles, 'jefe_servicio_tecnico') || hasRole(userRoles, 'tecnico');

  const availableTabs = useMemo(() => {
    const tabs = [{ id: 'requests', label: 'Solicitudes', icon: FiList }];
    if (isACP)                tabs.push({ id: 'soce',         label: 'SOCE',          icon: FiGlobe    });
    if (isTechnical || isACP) tabs.push({ id: 'tecnica',      label: 'Técnica',       icon: FiTool     });
    if (isTechnical)          tabs.push({ id: 'entrenamiento',label: 'Entrenamiento', icon: FiBookOpen });
    if (isACP)                tabs.push({ id: 'timeline',     label: 'Timeline',      icon: FiClock    });
    if (isACP)                tabs.push({ id: 'analytics',    label: 'Análisis',      icon: FiBarChart2});
    return tabs;
  }, [isACP, isTechnical]);

  const RequestsContent = isACP ? RequestsSection : EquipmentPurchasesPage;

  return (
    <div>
      {/* Sub-tab bar — solo cuando hay más de una tab */}
      {availableTabs.length > 1 && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div
              className="flex items-center gap-5 h-9 overflow-x-auto"
              style={{ scrollbarWidth: 'none' }}
              role="tablist"
              aria-label="Sección de compras públicas"
            >
              {availableTabs.map((tab, index) => {
                const Icon     = tab.icon;
                const isActive = activeSubTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.14, ease: EASE_OUT }}
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`
                      relative inline-flex items-center gap-1 h-full text-xs font-medium
                      whitespace-nowrap flex-shrink-0 border-b-2 -mb-px
                      transition-colors duration-150 cursor-pointer
                      ${isActive
                        ? 'border-action-blue text-ink-slate'
                        : 'border-transparent text-warm-ash hover:text-ink-slate'
                      }
                    `}
                  >
                    <Icon size={12} aria-hidden="true" />
                    <span>{tab.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {activeSubTab === 'requests' && (
            isACP ? (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <RequestsContent />
              </div>
            ) : (
              <RequestsContent />
            )
          )}

          {activeSubTab === 'soce' && isACP && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <SoceTrackSection />
            </div>
          )}

          {activeSubTab === 'tecnica' && (isTechnical || isACP) && (
            <TechnicalProcedureWorkspace />
          )}

          {activeSubTab === 'entrenamiento' && isTechnical && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <TrainingWorkflowWorkspace />
            </div>
          )}

          {activeSubTab === 'timeline' && isACP && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <TimelineSection />
            </div>
          )}

          {activeSubTab === 'analytics' && isACP && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <AnalyticsSection />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PublicPurchasesTab;
