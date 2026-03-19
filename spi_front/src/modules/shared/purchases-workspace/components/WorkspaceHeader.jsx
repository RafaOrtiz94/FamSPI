import React from 'react';
import { useAuth } from '../../../../core/auth/AuthContext';

const WorkspaceHeader = () => {
 const { user } = useAuth();

 // Determinar subtítulo según rol del usuario
 const getRoleSubtitle = () => {
 if (!user?.role) return 'Vista unificada de compras públicas y privadas';

 const role = user.role.toLowerCase();
 if (role.includes('comercial') || role.includes('acp')) {
 return 'Gestión completa de adquisiciones públicas y privadas';
 }
 if (role.includes('operaciones') || role.includes('logistica')) {
 return 'Seguimiento y gestión de compras privadas';
 }
 if (role.includes('gerencia') || role.includes('backoffice')) {
 return 'Supervisión y aprobación de procesos de compra';
 }
 return 'Vista unificada de compras públicas y privadas';
 };

 return (
 <header className="workspace-header" role="banner">
 <div className="header-content">
 <div className="title-section">
 <h1 className="workspace-title">Workspace de Compras</h1>
 <p className="workspace-subtitle">{getRoleSubtitle()}</p>
 </div>

 <nav aria-label="Navegación de migas de pan" className="breadcrumb">
 <ol className="breadcrumb-list">
 <li className="breadcrumb-item">
 <a href="/dashboard" className="breadcrumb-link">Dashboard</a>
 </li>
 <li className="breadcrumb-item" aria-hidden="true">
 <span className="breadcrumb-separator">›</span>
 </li>
 <li className="breadcrumb-item">
 <span className="breadcrumb-current">Compras</span>
 </li>
 <li className="breadcrumb-item" aria-hidden="true">
 <span className="breadcrumb-separator">›</span>
 </li>
 <li className="breadcrumb-item" aria-current="page">
 <span className="breadcrumb-current">Workspace</span>
 </li>
 </ol>
 </nav>
 </div>

 {/* Panel de acciones rápidas (opcional - UI para navegación interna) */}
 <div className="quick-actions" role="toolbar" aria-label="Acciones rápidas">
 <button
 type="button"
 className="action-btn secondary"
 onClick={() => {
 // Navegar a sección de solicitudes dentro del tab actual
 const currentTab = window.location.search.includes('tab=private') ? 'private' : 'public';
 console.log(`[PURCHASES_WORKSPACE][FASE5] quick_action: navigate to requests in ${currentTab} tab`);
 }}
 aria-label="Ir a sección de solicitudes"
 >
 Ver Solicitudes
 </button>
 <button
 type="button"
 className="action-btn secondary"
 onClick={() => {
 // Navegar a sección de pendientes
 console.log('[PURCHASES_WORKSPACE][FASE5] quick_action: navigate to pending items');
 }}
 aria-label="Ver elementos pendientes"
 >
 Pendientes
 </button>
 </div>

 <style jsx>{`
 .workspace-header {
 margin-bottom: 32px;
 padding: 24px;
 background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
 border: 1px solid #e9ecef;
 border-radius: 8px;
 box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
 }

 .header-content {
 display: flex;
 justify-content: space-between;
 align-items: flex-start;
 margin-bottom: 16px;
 }

 .title-section {
 flex: 1;
 }

 .workspace-title {
 margin: 0 0 8px 0;
 font-size: 32px;
 font-weight: 700;
 color: #1a202c;
 line-height: 1.2;
 }

 .workspace-subtitle {
 margin: 0;
 font-size: 16px;
 color: #718096;
 font-weight: 400;
 line-height: 1.4;
 }

 .breadcrumb {
 margin-top: 8px;
 }

 .breadcrumb-list {
 display: flex;
 align-items: center;
 list-style: none;
 margin: 0;
 padding: 0;
 font-size: 14px;
 }

 .breadcrumb-item {
 display: flex;
 align-items: center;
 }

 .breadcrumb-link {
 color: #3182ce;
 text-decoration: none;
 padding: 4px 8px;
 border-radius: 4px;
 transition: background-color 0.2s;
 }

 .breadcrumb-link:hover {
 background-color: #edf2f7;
 text-decoration: underline;
 }

 .breadcrumb-current {
 color: #4a5568;
 font-weight: 500;
 }

 .breadcrumb-separator {
 margin: 0 8px;
 color: #a0aec0;
 font-weight: bold;
 }

 .quick-actions {
 display: flex;
 gap: 12px;
 margin-top: 20px;
 padding-top: 20px;
 border-top: 1px solid #e2e8f0;
 }

 .action-btn {
 padding: 8px 16px;
 border: 1px solid #d1d5db;
 border-radius: 6px;
 background: white;
 color: #374151;
 font-size: 14px;
 font-weight: 500;
 cursor: pointer;
 transition: all 0.2s;
 }

 .action-btn:hover {
 background: #f9fafb;
 border-color: #9ca3af;
 }

 .action-btn:focus {
 outline: 2px solid #3182ce;
 outline-offset: 2px;
 }

 @media (max-width: 768px) {
 .workspace-header {
 padding: 16px;
 }

 .header-content {
 flex-direction: column;
 gap: 16px;
 }

 .workspace-title {
 font-size: 28px;
 }

 .quick-actions {
 flex-wrap: wrap;
 }
 }
 `}</style>
 </header>
 );
};

export default WorkspaceHeader;
