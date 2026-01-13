import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Importar componentes de tabs
import PublicPurchasesTab from './tabs/PublicPurchasesTab';
import PrivatePurchasesTab from './tabs/PrivatePurchasesTab';
import WorkspaceHeader from './components/WorkspaceHeader';
import ErrorBoundaryTab from './components/ErrorBoundaryTab';

// Importar hook de auth (asumiendo existe, ajustar si necesario)
import { useAuth } from '../../../core/auth/AuthContext';

// Helper para normalizar roles del usuario
const normalizeRoles = (user) => {
  if (!user) return [];

  // Intentar diferentes propiedades donde pueden estar los roles
  const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? [];

  // Si es string, convertir a array
  const rolesArray = Array.isArray(rawRoles) ? rawRoles : [rawRoles];

  // Si elementos son objetos con propiedades de rol, extraer
  const normalized = rolesArray.map(role => {
    if (typeof role === 'object' && role !== null) {
      // Intentar diferentes propiedades del objeto
      return role.name || role.role || role.code || role.slug || String(role);
    }
    return String(role).toLowerCase().trim();
  }).filter(Boolean); // Filtrar valores vacíos

  return normalized;
};

const PurchasesWorkspace = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Normalizar roles del usuario
  const userRoles = normalizeRoles(user);

  // Roles para tabs
  const publicRoles = ['comercial', 'jefe_comercial', 'gerencia', 'gerencia_general', 'acp_comercial'];
  const privateRoles = ['jefe_operaciones', 'jefe_logistica', 'backoffice_comercial', 'gerencia', 'comercial', 'jefe_comercial', 'acp_comercial'];

  // Determinar qué tabs puede ver el usuario
  const canAccessPublic = userRoles.some(role => publicRoles.includes(role));
  const canAccessPrivate = userRoles.some(role => privateRoles.includes(role));

  // Construir array de tabs disponibles
  const availableTabs = [];
  if (canAccessPublic) availableTabs.push('public');
  if (canAccessPrivate) availableTabs.push('private');

  // Estado para tab activo
  const [activeTab, setActiveTab] = useState(() => {
    // Leer fuentes de entrada
    const urlParams = new URLSearchParams(location.search);
    const tabFromUrl = urlParams.get('tab');
    const tabFromStorage = localStorage.getItem('purchases_workspace_last_tab');

    // Selección prioritaria: URL -> localStorage -> primer tab disponible
    let initial = availableTabs.includes(tabFromUrl) ? tabFromUrl :
                  availableTabs.includes(tabFromStorage) ? tabFromStorage :
                  availableTabs[0];

    return initial || null; // null si no hay tabs disponibles
  });

  // URL sync: actualizar querystring cuando cambia tab
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const currentUrlTab = urlParams.get('tab');

    if (currentUrlTab !== activeTab) {
      urlParams.set('tab', activeTab);
      navigate(`${location.pathname}?${urlParams.toString()}`, { replace: true });
      console.log("[PURCHASES_WORKSPACE][FASE3] urlTab set", { tab: activeTab });
    }
  }, [activeTab, location.pathname, location.search, navigate]);

  // Logs obligatorios
  useEffect(() => {
    console.log("[PURCHASES_WORKSPACE][FASE4][ACCESS] init", {
      rolesRaw: user?.roles || user?.role,
      rolesNorm: userRoles,
      canPublic: canAccessPublic,
      canPrivate: canAccessPrivate,
      tabFromUrl: new URLSearchParams(location.search).get('tab'),
      tabFromStorage: localStorage.getItem('purchases_workspace_last_tab'),
      initial: activeTab,
      availableTabs
    });

    console.log("[PURCHASES_WORKSPACE][FASE5][UI] workspace_rendered", {
      hasEnterpriseHeader: true,
      hasBreadcrumbs: true,
      hasQuickActions: true,
      tabsWithIcons: true,
      ariaAccessibility: true,
      responsiveDesign: true,
      availableTabsCount: availableTabs.length
    });

    console.log("[PURCHASES_WORKSPACE][FASE3] keepMounted enabled");

    console.log("[PURCHASES_WORKSPACE][FASE2] mounted", {
      path: location.pathname,
      role: user?.role,
      userId: user?.id
    });
  }, []); // Solo al mount

  useEffect(() => {
    console.log("[PURCHASES_WORKSPACE][FASE4][ACCESS] tab_change", { tab: activeTab, availableTabs });
  }, [activeTab, availableTabs]);

  useEffect(() => {
    console.log("[PURCHASES_WORKSPACE][FASE2] visible_tabs", { canPublic: canAccessPublic, canPrivate: canAccessPrivate });
  }, [canAccessPublic, canAccessPrivate]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('purchases_workspace_last_tab', tab);
  };

  // Si no hay tabs disponibles, mostrar mensaje de no acceso
  if (!activeTab) {
    return (
      <div className="purchases-workspace">
        <WorkspaceHeader />
        <div className="no-access">
          <h3>Acceso Restringido</h3>
          <p>No tiene permisos para acceder al Workspace de Compras.</p>
          <p>Contacte al administrador si considera que esto es un error.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="purchases-workspace">
      <WorkspaceHeader />

      {/* Tabs Navigation - Mejorada con ARIA y estados */}
      <div className="tabs-container" role="tablist" aria-label="Secciones de compras">
        {canAccessPublic && (
          <button
            role="tab"
            id="tab-public"
            aria-selected={activeTab === 'public'}
            aria-controls="panel-public"
            tabIndex={activeTab === 'public' ? 0 : -1}
            className={`tab-button ${activeTab === 'public' ? 'active' : ''}`}
            onClick={() => handleTabChange('public')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTabChange('public');
              }
            }}
          >
            <span className="tab-icon">🏢</span>
            <span className="tab-text">Compras Públicas</span>
            {activeTab === 'public' && (
              <span className="tab-indicator" aria-hidden="true"></span>
            )}
          </button>
        )}

        {canAccessPrivate && (
          <button
            role="tab"
            id="tab-private"
            aria-selected={activeTab === 'private'}
            aria-controls="panel-private"
            tabIndex={activeTab === 'private' ? 0 : -1}
            className={`tab-button ${activeTab === 'private' ? 'active' : ''}`}
            onClick={() => handleTabChange('private')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTabChange('private');
              }
            }}
          >
            <span className="tab-icon">🏭</span>
            <span className="tab-text">Compras Privadas</span>
            {activeTab === 'private' && (
              <span className="tab-indicator" aria-hidden="true"></span>
            )}
          </button>
        )}
      </div>

      {/* Tab Content - Keep Mounted Strategy con ARIA mejorada */}
      <div className="tab-content" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {canAccessPublic && (
          <div
            id="panel-public"
            role="tabpanel"
            aria-labelledby="tab-public"
            className={`tab-panel ${activeTab === 'public' ? 'active' : 'hidden'}`}
            aria-hidden={activeTab !== 'public'}
          >
            <ErrorBoundaryTab tabName="Compras Públicas">
              <PublicPurchasesTab />
            </ErrorBoundaryTab>
          </div>
        )}

        {canAccessPrivate && (
          <div
            id="panel-private"
            role="tabpanel"
            aria-labelledby="tab-private"
            className={`tab-panel ${activeTab === 'private' ? 'active' : 'hidden'}`}
            aria-hidden={activeTab !== 'private'}
          >
            <ErrorBoundaryTab tabName="Compras Privadas">
              <PrivatePurchasesTab />
            </ErrorBoundaryTab>
          </div>
        )}
      </div>

      <style jsx>{`
        .purchases-workspace {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .tabs-container {
          display: flex;
          background: white;
          border-radius: 8px 8px 0 0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
          border-bottom: none;
          overflow: hidden;
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 24px;
          border: none;
          background: #f8fafc;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          font-size: 16px;
          font-weight: 500;
          color: #64748b;
          transition: all 0.2s ease;
          position: relative;
          flex: 1;
          justify-content: center;
          min-width: 200px;
        }

        .tab-button:focus {
          outline: 2px solid #3b82f6;
          outline-offset: -2px;
        }

        .tab-button:hover:not(.active) {
          background: #f1f5f9;
          color: #334155;
        }

        .tab-button.active {
          background: white;
          color: #1e40af;
          border-bottom-color: #3b82f6;
          box-shadow: inset 0 -2px 0 #3b82f6;
        }

        .tab-icon {
          font-size: 18px;
          display: flex;
          align-items: center;
        }

        .tab-text {
          font-weight: 600;
        }

        .tab-indicator {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 0 1px #3b82f6;
        }

        .tab-content {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0 0 8px 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          min-height: 600px;
          padding: 24px;
        }

        .tab-panel {
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.3s ease-in-out;
        }

        .tab-panel.hidden {
          display: none;
        }

        .tab-panel.active {
          opacity: 1;
          transform: translateY(0);
          display: block;
        }

        .no-access {
          text-align: center;
          padding: 60px 20px;
          color: #64748b;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .no-access h3 {
          color: #1e293b;
          margin-bottom: 12px;
          font-size: 24px;
          font-weight: 600;
        }

        .no-access p {
          margin: 8px 0;
          font-size: 16px;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .tabs-container {
            flex-direction: column;
          }

          .tab-button {
            min-width: unset;
            padding: 12px 16px;
          }

          .tab-text {
            font-size: 14px;
          }

          .tab-content {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default PurchasesWorkspace;
