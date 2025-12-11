import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiTruck,
  FiSearch,
  FiClipboard,
  FiShoppingCart,
  FiHome,
  FiCalendar,
  FiUsers,
  FiBriefcase,
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import { DashboardHeader } from "../../../../core/ui/layouts/DashboardLayout";
import { useAuth } from "../../../../core/auth/useAuth";

const BackofficeView = ({ onRefresh }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const normalizedRole = (user?.role || "").toLowerCase();
  const isBackofficeCommercial = normalizedRole === "backoffice_comercial";

  const cards = useMemo(() => {
    if (isBackofficeCommercial) {
      return [
        {
          title: "Inicio",
          subtitle: "Regresa al dashboard comercial",
          icon: FiHome,
          route: "/dashboard/comercial",
        },
        {
          title: "Permisos y vacaciones",
          subtitle: "Solicita ausencias o revisa permisos",
          icon: FiCalendar,
          route: "/dashboard/talento-humano/permisos",
        },
        {
          title: "Solicitudes",
          subtitle: "Módulo dedicado de nuevas solicitudes",
          icon: FiClipboard,
          route: "/dashboard/comercial/solicitudes",
        },
        {
          title: "Clientes",
          subtitle: "Control de clientes y visitas",
          icon: FiUsers,
          route: "/dashboard/comercial/clientes",
        },
        {
          title: "Business Case",
          subtitle: "Oportunidades y casos de negocio",
          icon: FiBriefcase,
          route: "/dashboard/business-case",
        },
      ];
    }

    return [
      {
        title: "Logística",
        subtitle: "Despachos y envíos",
        icon: FiTruck,
        route: "/dashboard/comercial/logistica",
      },
      {
        title: "Solicitudes",
        subtitle: "Módulo dedicado",
        icon: FiSearch,
        route: "/dashboard/comercial/solicitudes",
      },
      {
        title: "Solicitudes pendientes",
        subtitle: "Revisa y decide cada solicitud de cliente",
        icon: FiClipboard,
        route: "/dashboard/backoffice/client-requests",
      },
      {
        title: "Solicitudes de compra",
        subtitle: "Handoff y seguimiento hacia ACP",
        icon: FiShoppingCart,
        route: "/dashboard/comercial/equipment-purchases",
      },
    ];
  }, [isBackofficeCommercial]);

  return (
    <>
      <DashboardHeader
        title="Backoffice Comercial"
        subtitle="Gestión administrativa y logística"
        actions={
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Actualizar
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
            onClick={() => navigate(card.route)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-md text-blue-600">
                <card.icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{card.title}</p>
                <p className="text-xs text-gray-500">{card.subtitle}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};

export default BackofficeView;
