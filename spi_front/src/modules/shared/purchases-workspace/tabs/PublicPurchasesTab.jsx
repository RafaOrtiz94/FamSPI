import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Importar hook de auth
import { useAuth } from '../../../../core/auth/AuthContext';

// Importar páginas según rol
import EquipmentPurchasesPage from '../../../comercial/pages/EquipmentPurchases';
import ACPEquipmentPurchasesPage from '../../../comercial/pages/ACPEquipmentPurchases';

// Importar componentes de las secciones ACP
import { OverviewSection } from './sections/OverviewSection';
import { RequestsSection } from './sections/RequestsSection';
import { AnalyticsSection } from './sections/AnalyticsSection';

// Importar iconos
import { FiBarChart2, FiList, FiTrendingUp, FiBriefcase } from 'react-icons/fi';

const PublicPurchasesTab = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Determinar qué página mostrar según rol
  const isACP = user?.roles?.includes('acp_comercial');

  // Sub-tabs para ACP_COMERCIAL
  const acpSubTabs = useMemo(() => [
    {
      id: 'overview',
      label: 'Vista General',
      icon: FiBarChart2,
      component: OverviewSection,
      color: 'from-blue-50 to-blue-100',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200'
    },
    {
      id: 'requests',
      label: 'Solicitudes',
      icon: FiList,
      component: RequestsSection,
      color: 'from-green-50 to-green-100',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200'
    },
    {
      id: 'analytics',
      label: 'Análisis',
      icon: FiTrendingUp,
      component: AnalyticsSection,
      color: 'from-purple-50 to-purple-100',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200'
    }
  ], []);

  // Si no es ACP, mostrar la página general
  if (!isACP) {
    return (
      <div className="public-purchases-tab">
        <EquipmentPurchasesPage />
      </div>
    );
  }

  // Para ACP_COMERCIAL: mostrar sub-tabs unificadas
  const activeTabData = acpSubTabs.find(tab => tab.id === activeSubTab);
  const ActiveComponent = activeTabData?.component || OverviewSection;

  return (
    <div className="acp-unified-workspace">
      {/* Header Empresarial */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-slate-50 via-blue-50 to-slate-50 border-b border-slate-200"
      >
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <FiBriefcase className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Centro de Compras Públicas ACP
                </h1>
                <p className="text-slate-600 mt-1">
                  Gestión integral del proceso de adquisiciones públicas
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sub-tabs Navigation */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-1 py-4">
            {acpSubTabs.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;

              return (
                <motion.button
                  key={tab.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`
                    relative flex items-center gap-3 px-6 py-4 rounded-lg font-medium transition-all duration-300
                    ${isActive
                      ? `bg-gradient-to-r ${tab.color} ${tab.borderColor} border-2 text-slate-900 shadow-lg transform scale-105`
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-2 border-transparent'
                    }
                  `}
                >
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                    <Icon className={`text-lg ${isActive ? tab.iconColor : 'text-slate-500'}`} />
                  </div>
                  <span className="text-sm font-semibold">{tab.label}</span>

                  {/* Indicador activo */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-full"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="min-h-[600px]"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PublicPurchasesTab;
