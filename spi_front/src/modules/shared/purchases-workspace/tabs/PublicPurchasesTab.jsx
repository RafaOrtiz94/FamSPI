import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Importar hook de auth
import { useAuth } from '../../../../core/auth/AuthContext';

// Importar páginas según rol
import EquipmentPurchasesPage from '../../../comercial/pages/EquipmentPurchases';

// Importar componentes de las secciones ACP
import { RequestsSection } from './sections/RequestsSection';
import { AnalyticsSection } from './sections/AnalyticsSection';

// Importar iconos
import { FiList, FiTrendingUp } from 'react-icons/fi';

const normalizeRoles = (user) => {
 if (!user) return [];
 const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? [];
 const rawScopes = user?.scope ?? user?.user?.scope ?? [];
 const rolesArray = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
 const scopesArray = Array.isArray(rawScopes) ? rawScopes : [rawScopes];
 return [...rolesArray, ...scopesArray]
 .flatMap((role) => String(role || "").split(/[,\s]+/))
 .map((token) => token.toLowerCase().trim())
 .filter(Boolean);
};

const hasRole = (roles, token) => roles.some((role) => role === token || role.includes(token));

const PublicPurchasesTab = () => {
 const { user } = useAuth();
 const [activeSubTab, setActiveSubTab] = useState('requests');
 const userRoles = useMemo(() => normalizeRoles(user), [user]);

 // Determinar qué página mostrar según rol
 const isACP = hasRole(userRoles, "acp_comercial");

 // Sub-tabs para ACP_COMERCIAL
 const acpSubTabs = useMemo(() => [
 {
 id: 'requests',
 label: 'Solicitudes',
 icon: FiList,
 component: RequestsSection,
 },
 {
 id: 'analytics',
 label: 'Análisis',
 icon: FiTrendingUp,
 component: AnalyticsSection,
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
 const ActiveComponent = activeTabData?.component || RequestsSection;

 return (
 <div className="acp-unified-workspace">
 {/* Header compacto */}
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 className="bg-white border-b border-slate-200"
 >
 <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
 <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h1 className="text-lg font-semibold text-slate-900">Compras Públicas ACP</h1>
 <p className="text-xs text-slate-500">Seguimiento del flujo público por etapa</p>
 </div>
 </div>
 </div>
 </motion.div>

 {/* Sub-tabs */}
 <div className="bg-white border-b border-slate-200">
 <div className="max-w-7xl mx-auto px-4 sm:px-6">
 <div className="flex flex-wrap gap-2 py-2">
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
 relative inline-flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors text-sm
 ${isActive
 ? 'bg-slate-900 text-white'
 : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
 }
 `}
 >
 <Icon className={`${isActive ? 'text-white' : 'text-slate-500'}`} />
 <span>{tab.label}</span>
 </motion.button>
 );
 })}
 </div>
 </div>
 </div>

 {/* Content Area */}
 <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
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
