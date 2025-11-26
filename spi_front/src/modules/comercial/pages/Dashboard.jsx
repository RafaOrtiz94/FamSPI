import React from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import { DashboardLayout } from "../../shared/components/DashboardComponents";

// Views
import JefeComercialView from "../components/dashboard/JefeComercialView";
import ComercialView from "../components/dashboard/ComercialView";
import BackofficeView from "../components/dashboard/BackofficeView";
import ACPComercialView from "../components/dashboard/ACPComercialView";

const ComercialDashboard = () => {
  const { user } = useAuth();
  const handleRefresh = () => {};

  const renderView = () => {
    const role = user?.role?.toLowerCase() || "";

    if (role.includes("jefe") || role.includes("gerente") || role.includes("director")) {
      return (
        <JefeComercialView
          onRefresh={handleRefresh}
        />
      );
    }

    if (role.includes("backoffice")) {
      return (
        <BackofficeView
          onRefresh={handleRefresh}
        />
      );
    }

    if (role.includes("acp")) {
      return (
        <ACPComercialView
          onRefresh={handleRefresh}
        />
      );
    }

    // Default to Comercial (Sales Rep) view
    return (
      <ComercialView
        onRefresh={handleRefresh}
      />
    );
  };

  return (
    <DashboardLayout>
      {renderView()}
    </DashboardLayout>
  );
};

export default ComercialDashboard;
