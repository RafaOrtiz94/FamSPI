import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiDownload, FiFileText, FiRefreshCw } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";
import { getMyClientRequests } from "../../../core/api/requestsApi";

const escapeCsvValue = (value) => {
  if (value == null) return "";
  const string = value.toString();
  if (string.includes(",") || string.includes('"') || string.includes("\n")) {
    return `"${string.replace(/"/g, '""')}"`;
  }
  return string;
};

const JefeClientReportsWidget = () => {
  const { showToast } = useUI();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyClientRequests({ page: 1, pageSize: 100 });
      const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
      setRequests(rows);
    } catch (error) {
      console.error(error);
      showToast("No fue posible cargar tus solicitudes", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const statusCounts = useMemo(() => {
    const counts = {};
    requests.forEach((req) => {
      const status = req.status || "sin_estado";
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [requests]);

  const approvedRequests = useMemo(
    () => requests.filter((req) => req.status === "approved"),
    [requests]
  );

  const downloadReport = async () => {
    if (!requests.length) {
      showToast("No hay datos para exportar", "info");
      return;
    }

    setDownloading(true);
    try {
      const headers = ["ID", "Cliente", "RUC/Cédula", "Estado", "Fecha"];
      const rows = requests.map((req) => [
        req.id,
        req.commercial_name || req.client_name || "N/A",
        req.ruc_cedula || req.identificador,
        req.status,
        req.created_at,
      ]);
      const csvContent = [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `movimientos-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Informe descargado", "success");
    } catch (error) {
      console.error(error);
      showToast("No se pudo generar el informe", "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-lg">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Visión del jefe comercial</p>
          <h2 className="text-2xl font-semibold text-gray-900">Informes y clientes aprobados</h2>
          <p className="text-sm text-gray-500">
            Descarga un registro completo de los movimientos y verifica rápidamente los clientes que
            tú solicitaste y fueron aprobados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            icon={FiRefreshCw}
            onClick={loadRequests}
            loading={loading}
          >
            Actualizar
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={FiDownload}
            onClick={downloadReport}
            loading={downloading}
          >
            Descargar informe
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["total", "approved", "pending_approval", "rejected"].map((key) => (
          <div
            key={key}
            className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-center text-xs font-semibold text-gray-700"
          >
            <p className="text-[11px] uppercase tracking-[0.3em] text-gray-400">
              {key === "total"
                ? "Total"
                : key === "approved"
                ? "Aprobadas"
                : key === "rejected"
                ? "Rechazadas"
                : "Pendientes"}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {key === "total" ? requests.length : statusCounts[key] || 0}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-2xl border border-dashed border-gray-200 bg-white/80 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Clientes aprobados</p>
          <span className="text-xs uppercase tracking-[0.3em] text-gray-500">
            {approvedRequests.length} registros
          </span>
        </div>
        {approvedRequests.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aún no hay clientes aprobados por tu gestión. Envía una solicitud para comenzar.
          </p>
        ) : (
          <div className="space-y-3">
            {approvedRequests.slice(0, 3).map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{req.commercial_name || "Cliente sin nombre"}</p>
                  <p className="text-xs text-gray-500">
                    {req.ruc_cedula || req.identificador || "RUC no disponible"}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  icon={FiFileText}
                  onClick={() => navigate(`/dashboard/backoffice/client-request/${req.id}`)}
                >
                  Ver detalle
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default JefeClientReportsWidget;
