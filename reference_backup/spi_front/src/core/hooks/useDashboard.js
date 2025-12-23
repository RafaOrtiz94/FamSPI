// src/hooks/useDashboard.js
import { useMemo } from "react";

/**
 * Hook que procesa solicitudes, mantenimientos o aprobaciones
 * para generar KPIs y datasets de gráficos.
 */
export const useDashboard = (items = []) => {
  const stats = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) {
      return {
        total: 0,
        aprobadas: 0,
        rechazadas: 0,
        pendientes: 0,
      };
    }

    const aprobadas = items.filter((i) => i.status === "aprobado").length;
    const rechazadas = items.filter((i) => i.status === "rechazado").length;
    const pendientes = items.filter((i) => i.status === "pendiente").length;
    const total = items.length;

    return { total, aprobadas, rechazadas, pendientes };
  }, [items]);

  const chartData = useMemo(() => {
    const dateBuckets = new Map();
    items.forEach((item) => {
      if (!item?.created_at) return;
      const date = new Date(item.created_at);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().split("T")[0];
      dateBuckets.set(key, (dateBuckets.get(key) || 0) + 1);
    });

    const timeline = Array.from(dateBuckets.entries())
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .slice(-7);

    const lineLabels = timeline.map(([iso]) =>
      new Date(iso).toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "short",
      })
    );
    const lineValues = timeline.map(([, count]) => count);

    return {
      doughnut: {
        labels: ["Aprobadas", "Rechazadas", "Pendientes"],
        datasets: [
          {
            data: [stats.aprobadas, stats.rechazadas, stats.pendientes],
            backgroundColor: ["#10b981", "#ef4444", "#f59e0b"],
            borderWidth: 2,
          },
        ],
      },
      bar: {
        labels: ["Aprobadas", "Rechazadas", "Pendientes"],
        datasets: [
          {
            label: "Solicitudes",
            data: [stats.aprobadas, stats.rechazadas, stats.pendientes],
            backgroundColor: [
              "rgba(16,185,129,0.6)",
              "rgba(239,68,68,0.6)",
              "rgba(245,158,11,0.6)",
            ],
          },
        ],
      },
      line:
        lineLabels.length > 0
          ? {
              labels: lineLabels,
              datasets: [
                {
                  label: "Tendencia semanal",
                  data: lineValues,
                  fill: true,
                  tension: 0.35,
                  borderColor: "#2563eb",
                  backgroundColor: "rgba(37,99,235,0.15)",
                  pointBackgroundColor: "#1d4ed8",
                },
              ],
            }
          : null,
    };
  }, [items, stats]);

  return { stats, chartData };
};
