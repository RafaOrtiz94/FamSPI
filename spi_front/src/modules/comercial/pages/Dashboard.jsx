import React from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import { DashboardLayout } from "../../../core/ui/layouts/DashboardLayout";

// Views
import JefeComercialView from "../components/dashboard/JefeComercialView";
import ComercialView from "../components/dashboard/ComercialView";
import BackofficeView from "../components/dashboard/BackofficeView";
import ACPComercialView from "../components/dashboard/ACPComercialView";

// API
import { getCommercialSummary } from "../../../core/api/dashboardApi";
import { useApi } from "../../../core/hooks/useApi";

const ComercialDashboard = () => {
  const { user } = useAuth();

  // API call for commercial summary
  const { data: summaryData, execute: fetchSummary, loading: summaryLoading, error: summaryError } = useApi(
    getCommercialSummary,
    { globalLoader: false }
  );

  // Debug log in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('Dashboard summaryData:', summaryData);
    console.log('Dashboard summaryError:', summaryError);
    console.log('Dashboard summaryLoading:', summaryLoading);
  }

  const handleRefresh = async () => {
    await fetchSummary();
  };

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
        summaryData={summaryData}
        summaryLoading={summaryLoading}
        summaryError={summaryError}
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
