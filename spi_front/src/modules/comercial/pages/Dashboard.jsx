import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import { useApi } from "../../../core/hooks/useApi";
import { useDashboard } from "../../../core/hooks/useDashboard";
import { getRequests } from "../../../core/api/requestsApi";
import { DashboardLayout } from "../../shared/components/DashboardComponents";

// Views
import JefeComercialView from "../components/dashboard/JefeComercialView";
import ComercialView from "../components/dashboard/ComercialView";
import BackofficeView from "../components/dashboard/BackofficeView";
import ACPComercialView from "../components/dashboard/ACPComercialView";

const ComercialDashboard = () => {
  const { user } = useAuth();
  const [statsLoading, setStatsLoading] = useState(true);
  const [kpiStats, setKpiStats] = useState({
    total: 0,
    aprobadas: 0,
    rechazadas: 0,
    pending: 0,
  });

  const {
    data: requestsData,
    loading,
    execute: fetchRequests,
  } = useApi(getRequests);

  const load = useCallback(async () => {
    setStatsLoading(true);
    try {
      // Fetch all requests for stats (or filtered by user role in backend if needed)
      const data = await getRequests({ pageSize: 9999 });
      const requests = data.rows || [];

      setKpiStats({
        total: requests.length,
        aprobadas: requests.filter((r) => r.status === "aprobado").length,
        rechazadas: requests.filter((r) => r.status === "rechazado").length,
        pending: requests.filter((r) => r.status === "pendiente").length,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const requests = requestsData?.rows || [];
  // Filter requests for specific views if needed (e.g., only my requests for Comercial)
  // For now passing all, assuming backend filters or view filters

  const { chartData } = useDashboard(requests);

  const renderView = () => {
    const role = user?.role?.toLowerCase() || "";

    if (role.includes("jefe") || role.includes("gerente") || role.includes("director")) {
      return (
        <JefeComercialView
          stats={kpiStats}
          chartData={chartData}
          loading={statsLoading || loading}
          onRefresh={load}
        />
      );
    }

    if (role.includes("backoffice")) {
      return (
        <BackofficeView
          stats={kpiStats}
          recentRequests={requests.filter(r => r.status === 'pendiente')} // Backoffice focuses on pending
          loading={statsLoading || loading}
          onRefresh={load}
        />
      );
    }

    if (role.includes("acp")) {
      return (
        <ACPComercialView
          stats={kpiStats}
          recentRequests={requests}
          loading={statsLoading || loading}
          onRefresh={load}
        />
      );
    }

    // Default to Comercial (Sales Rep) view
    return (
      <ComercialView
        stats={kpiStats}
        recentRequests={requests} // Ideally filtered by 'my requests'
        loading={statsLoading || loading}
        onRefresh={load}
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
