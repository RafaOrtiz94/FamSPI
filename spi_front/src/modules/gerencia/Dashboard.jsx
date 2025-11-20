import React, { useEffect, useRef, useState, useCallback } from "react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  FiRefreshCw,
  FiDownload,
  FiTrendingUp,
  FiCheckCircle,
  FiXCircle,
  FiSearch,
  FiLogOut,
  FiActivity,
} from "react-icons/fi";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import Button from "../../core/ui/components/Button";
import AttendanceWidget from "../shared/components/AttendanceWidget";
import { useUI } from "../../core/ui/useUI";
import { useApi } from "../../core/hooks/useApi";
import { useDashboard } from "../../core/hooks/useDashboard";
import { getAuditoria } from "../../core/api/auditoriaApi";
import { getRequests } from "../../core/api/requestsApi";
import { logout } from "../../core/api";

import KpiCard from "./components/KpiCard";
import ChartCard from "./components/ChartCard";
import RequestCard from "./components/RequestCard";

import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  LineElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  Filler,
} from "chart.js";

ChartJS.register(
  ArcElement,
  BarElement,
  LineElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  Filler
);

const Dashboard = () => {
  const { showToast, showLoader, hideLoader } = useUI();
  const [query, setQuery] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [auditStats, setAuditStats] = useState({});
  const reportRef = useRef();
  const perPage = 9;

  const {
    data: requestsData,
    loading: loadingRequests,
    execute: fetchRequests,
  } = useApi(getRequests, { globalLoader: true });
  const { data: auditData, execute: fetchAuditoria } = useApi(getAuditoria);

  const load = useCallback(async () => {
    showLoader();
    try {
      await Promise.all([fetchRequests(), fetchAuditoria()]);
    } catch (err) {
      console.error(err);
    } finally {
      hideLoader();
    }
  }, [fetchRequests, fetchAuditoria, showLoader, hideLoader]);

  useEffect(() => {
    if (!initialized) {
      load();
      setInitialized(true);
    }
  }, [initialized, load]);

  const requests = requestsData?.rows || requestsData?.result?.rows || [];
  const audits = auditData?.results || auditData?.rows || [];
  const { stats, chartData } = useDashboard(requests);

  useEffect(() => {
    if (audits.length > 0) {
      const countByModule = {};
      audits.forEach((a) => {
        countByModule[a.module] = (countByModule[a.module] || 0) + 1;
      });
      const sorted = Object.entries(countByModule)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      setAuditStats({
        labels: sorted.map((e) => e[0]),
        data: sorted.map((e) => e[1]),
      });
    }
  }, [audits]);

  const filtered = requests.filter(
    (r) =>
      r.tipo?.toLowerCase().includes(query.toLowerCase()) ||
      r.solicitante?.toLowerCase().includes(query.toLowerCase())
  );
  const current = filtered.slice(0, perPage);

  const handleLogout = async () => {
    try {
      await logout();
      showToast("Sesión cerrada correctamente", "success");
    } catch (err) {
      console.error("❌ Error cerrando sesión:", err);
      showToast("Error al cerrar sesión", "error");
    }
  };

  const exportPDF = async () => {
    try {
      showLoader();
      const canvas = await html2canvas(reportRef.current);
      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      pdf.save("reporte-gerencial.pdf");
      showToast("Reporte exportado correctamente", "success");
    } catch (err) {
      console.error(err);
      showToast("Error al exportar PDF", "error");
    } finally {
      hideLoader();
    }
  };

  const auditChartData = {
    labels: auditStats.labels || [],
    datasets: [
      {
        label: "Registros por módulo",
        data: auditStats.data || [],
        backgroundColor: "#3b82f6",
        borderRadius: 6,
      },
    ],
  };

  return (
    <div ref={reportRef} className="p-6">
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiActivity className="text-blue-600" /> Dashboard Gerencial
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={FiRefreshCw} onClick={load}>
            Actualizar
          </Button>
          <Button variant="primary" icon={FiDownload} onClick={exportPDF}>
            Exportar
          </Button>
          <Button variant="secondary" icon={FiLogOut} onClick={handleLogout}>
            Salir
          </Button>
        </div>
      </header>

      <div className="mb-6">
        <AttendanceWidget />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Solicitudes"
          value={stats.total || 0}
          icon={FiTrendingUp}
          color="blue"
        />
        <KpiCard
          title="Aprobadas"
          value={stats.approved || 0}
          icon={FiCheckCircle}
          color="green"
        />
        <KpiCard
          title="Rechazadas"
          value={stats.rejected || 0}
          icon={FiXCircle}
          color="red"
        />
        <KpiCard
          title="Pendientes"
          value={stats.pending || 0}
          icon={FiRefreshCw}
          color="yellow"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ChartCard title="Estado de Solicitudes">
          <div className="h-64 flex justify-center items-center">
            <Doughnut
              data={chartData.doughnut}
              options={{ maintainAspectRatio: false }}
            />
          </div>
        </ChartCard>
        <ChartCard title="Módulos más activos (Auditoría)">
          <div className="h-64">
            <Bar
              data={auditChartData}
              options={{ maintainAspectRatio: false }}
            />
          </div>
        </ChartCard>
      </section>

      <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Registro de Solicitudes
        </h2>
        <div className="relative w-full md:w-1/3">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por tipo o solicitante..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        {current.length ? (
          current.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onView={(id) =>
                showToast(`Ver detalle solicitud #${id}`, "info")
              }
              onFiles={(files) =>
                showToast(`Tiene ${files.length} archivos adjuntos.`, "info")
              }
            />
          ))
        ) : (
          <div className="col-span-full text-center py-16 text-gray-500 bg-white rounded-2xl border border-gray-200">
            No se encontraron solicitudes.
          </div>
        )}
      </section>

    </div>
  );
};

export default Dashboard;
