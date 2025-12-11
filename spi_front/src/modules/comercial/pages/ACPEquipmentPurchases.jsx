import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getEquipmentPurchaseStats } from "../../../core/api/equipmentPurchasesApi";
import EquipmentPurchaseWidget from "../components/EquipmentPurchaseWidget";
import { useUI } from "../../../core/ui/useUI";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";

const STATUS_OVERVIEW = [
  { key: "waiting_provider_response", label: "Esperando respuesta de proveedor" },
  { key: "waiting_proforma", label: "Solicitando proforma" },
  { key: "proforma_received", label: "Proforma recibida" },
  {
    key: "waiting_signed_proforma",
    label: "Reservado y esperando proforma firmada",
  },
  { key: "pending_contract", label: "Pendiente contrato" },
  { key: "completed", label: "Completado" },
];

const HERO_LINE_KEYS = [
  { key: "waiting_provider_response", label: "Esperando respuesta de proveedor" },
  { key: "waiting_proforma", label: "Solicitando proforma" },
  { key: "proforma_received", label: "Proforma recibida" },
  {
    key: "waiting_signed_proforma",
    label: "Reservado y esperando proforma firmada",
  },
  { key: "pending_contract", label: "Pendiente contrato" },
  { key: "completed", label: "Completado" },
];

const ACPEquipmentPurchasesPage = () => {
  const { showToast } = useUI();
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await getEquipmentPurchaseStats();
      setStats(data);
    } catch (error) {
      console.error(error);
      showToast("No se pudo cargar el estado de las solicitudes", "error");
    } finally {
      setLoadingStats(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const totalRequests = stats?.total ?? 0;

  const heroStatusLine = useMemo(() => {
    return HERO_LINE_KEYS.map((item) => {
      const count = stats?.[item.key] ?? 0;
      return `${count} ${item.label.toLowerCase()}`;
    }).join(" • ");
  }, [stats]);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-4">
        <div className="rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-xl shadow-slate-900/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-200">
                Compras de equipos
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Dashboard ACP Comercial
              </h1>
              <p className="max-w-2xl text-sm text-slate-200">
                Monitorea las solicitudes de compra y coordina el avance con los proveedores
                a través del cronograma de equipos.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="border border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={loadStats}
              disabled={loadingStats}
            >
              {loadingStats ? "Actualizando..." : "Refrescar conteos"}
            </Button>
          </div>
          <div className="mt-4 space-y-1 text-xs uppercase tracking-widest text-slate-200/80">
            <p>Total: {totalRequests}</p>
            <p className="text-[10px] font-light">{heroStatusLine}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS_OVERVIEW.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-center shadow-sm shadow-slate-500/5"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {stats?.[item.key] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
              Listado compacto
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              Solicitudes activas
            </h2>
          </div>
          <p className="text-sm font-medium text-slate-500">
            Muestra hasta 9 tarjetas por página con búsqueda y paginación.
          </p>
        </div>
        <Card className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-lg">
          <EquipmentPurchaseWidget showCreation={false} compactList />
        </Card>
      </section>
    </div>
  );
};

export default ACPEquipmentPurchasesPage;
