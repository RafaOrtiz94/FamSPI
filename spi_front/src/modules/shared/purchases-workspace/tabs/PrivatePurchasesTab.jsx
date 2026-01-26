import React, { useEffect } from 'react';

// Importar hook de auth
import { useAuth } from '../../../../core/auth/AuthContext';

// Importar logger centralizado
import logger from '../../../../core/utils/logger';

// Importar páginas según rol
import OperacionesPrivatePurchases from '../../../operaciones/pages/OperacionesPrivatePurchases';
import LogisticaPrivatePurchases from '../../../logistica/pages/LogisticaPrivatePurchases';
import PrivatePurchasesPage from '../../../backoffice/pages/PrivatePurchases';

const normalizeRoles = (user) => {
  if (!user) return [];
  const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? user?.scope ?? [];
  const rolesArray = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
  return rolesArray.map((role) => String(role || '').toLowerCase().trim()).filter(Boolean);
};

const hasRole = (roles, token) => roles.some((role) => role === token || role.includes(token));

const PrivatePurchasesTab = () => {
  const { user } = useAuth();

  const userRoles = normalizeRoles(user);

  // Determinar qué página mostrar según rol
  const isJefeOperaciones = hasRole(userRoles, 'jefe_operaciones');
  const isJefeLogistica = hasRole(userRoles, 'jefe_logistica');

  let PageComponent;
  let assignedRole;

  if (isJefeOperaciones) {
    PageComponent = OperacionesPrivatePurchases;
    assignedRole = 'jefe_operaciones';
  } else if (isJefeLogistica) {
    PageComponent = LogisticaPrivatePurchases;
    assignedRole = 'jefe_logistica';
  } else {
    // backoffice_comercial y roles comerciales/gerencia
    PageComponent = PrivatePurchasesPage;
    assignedRole = 'backoffice_comercial';
  }

  // Logs detallados del flujo de compras privadas
  useEffect(() => {
    logger.info("[FLUJO_COMPRAS_PRIVADAS_FRONTEND] Renderizando tab de compras privadas", {
      user_id: user?.id,
      user_name: user?.name || user?.email,
      roles_usuario: userRoles,
      rol_asignado: assignedRole,
      componente_renderizado: PageComponent?.name,
      permisos: {
        puede_ver_operaciones: isJefeOperaciones,
        puede_ver_logistica: isJefeLogistica,
        puede_ver_backoffice: !isJefeOperaciones && !isJefeLogistica
      }
    });

    logger.requestFlow("INICIO_FLUJO_COMPRAS", "Usuario accedió a sección de compras privadas", {
      rol_asignado: assignedRole,
      contexto: 'workspace_compras_privadas'
    });
  }, [user, userRoles, assignedRole, PageComponent, isJefeOperaciones, isJefeLogistica]);

  return (
    <div className="private-purchases-tab">
      <PageComponent />
    </div>
  );
};

export default PrivatePurchasesTab;
