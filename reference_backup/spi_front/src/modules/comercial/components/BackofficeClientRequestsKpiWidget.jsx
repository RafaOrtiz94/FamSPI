import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCheckCircle, FiFileText, FiRefreshCw, FiXCircle } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";
import { getClientRequestsSummary } from "../../../core/api/requestsApi";

const statsConfig = [
  {
    key: "total",
    label: "Solicitudes totales",
    icon: FiFileText,
    accent: "text-blue-600",
  },
  {
    key: "approved",
    label: "Aprobadas",
    icon: FiCheckCircle,
    accent: "text-emerald-600",
  },
  {
    key: "rejected",
    label: "Rechazadas",
    icon: FiXCircle,
    accent: "text-red-600",
  },
];

const formatNumber = (value) => {
  if (typeof value === "number") return value.toLocaleString("es-EC");
  if (typeof value === "string" && value.trim()) return Number(value).toLocaleString("es-EC");
  return "0";
};

const BackofficeClientRequestsKpiWidget = () => {
  const navigate = useNavigate();
  const { showToast } = useUI();
  const [summary, setSummary] = useState({ total: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const showToastRef = useRef(showToast);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClientRequestsSummary();
      setSummary({
        total: Number(data?.total ?? 0),
        approved: Number(data?.approved ?? 0),
        rejected: Number(data?.rejected ?? 0),
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error(error);
      showToastRef.current?.("No pudimos cargar el resumen de solicitudes", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const stats = useMemo(
    () =>
      statsConfig.map((stat) => ({
        ...stat,
        value: summary[stat.key] ?? 0,
      })),
    [summary],
  );

  return (
    <Card className="space-y-4 border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-gray-500">
            Backoffice Comercial
          </p>
          <h2 className="text-2xl font-semibold text-gray-900">Solicitudes de nuevos clientes</h2>
          <p className="text-sm text-gray-500">
            Resumen actualizado de las solicitudes que tú apruebas o rechazas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            leftIcon={FiRefreshCw}
            loading={loading}
            onClick={loadSummary}
          >
            Actualizar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate("/dashboard/backoffice/client-requests")}
          >
            Ir a solicitudes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="flex flex-col rounded-2xl border border-gray-100 bg-gray-50 p-4"
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              <span>{stat.label}</span>
              <stat.icon className={`h-5 w-5 ${stat.accent}`} />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {formatNumber(stat.value)}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        {lastUpdated
          ? `Actualizado a las ${lastUpdated.toLocaleTimeString("es-EC", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "Actualizando datos..."}
      </p>
    </Card>
  );
};

export default BackofficeClientRequestsKpiWidget;
