import React from "react";
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiRefreshCw, FiSlash } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";

const statusMeta = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "healthy_mock" || normalized === "stub_ready") {
    return {
      label: normalized === "healthy_mock" ? "Operativo (mock)" : "Stub listo",
      icon: FiCheckCircle,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (normalized === "disabled") {
    return {
      label: "Deshabilitado",
      icon: FiSlash,
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }
  if (normalized === "blocked_contract") {
    return {
      label: "Bloqueado por contrato",
      icon: FiAlertTriangle,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (normalized === "degraded") {
    return {
      label: "Configuración incompleta",
      icon: FiAlertTriangle,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  return {
    label: "Sin estado",
    icon: FiActivity,
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
};

const titleMap = {
  navify: "Navify",
  online_support: "Online Support",
  rexis: "REXIS",
  goapp: "GoApp",
};

const ExternalIntegrationHealthPanel = ({
  providers = [],
  loading = false,
  onRefresh = null,
}) => {
  const safeProviders = Array.isArray(providers) ? providers : [];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Salud de Integraciones</h2>
          <p className="text-xs text-slate-500">
            Estado de feature flag, contrato y cola por proveedor externo.
          </p>
        </div>
        {onRefresh ? (
          <Button
            variant="secondary"
            size="sm"
            icon={FiRefreshCw}
            onClick={onRefresh}
            loading={loading}
          >
            Recargar salud
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {safeProviders.map((provider) => {
          const meta = statusMeta(provider?.status);
          const StatusIcon = meta.icon;
          const missingConfig = Array.isArray(provider?.missing_config) ? provider.missing_config : [];
          const missingContractData = Array.isArray(provider?.missing_contract_data)
            ? provider.missing_contract_data
            : [];

          return (
            <article
              key={provider?.provider || Math.random()}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {titleMap[provider?.provider] || provider?.provider || "Proveedor"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Pendientes cola: {provider?.pending_jobs || 0} · Fallidos: {provider?.failed_jobs || 0}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${meta.className}`}>
                  <StatusIcon size={13} />
                  {meta.label}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600">
                  Feature flag: {provider?.enabled ? "ON" : "OFF"}
                </span>
                <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600">
                  Contrato: {provider?.contract_approved ? "Aprobado" : "Pendiente"}
                </span>
              </div>

              {missingConfig.length > 0 ? (
                <p className="mt-2 text-xs text-rose-700">
                  Config faltante: {missingConfig.join(", ")}
                </p>
              ) : null}

              {missingContractData.length > 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  Datos externos faltantes: {missingContractData.join(" · ")}
                </p>
              ) : null}
            </article>
          );
        })}

        {safeProviders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            No hay información de salud disponible.
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default ExternalIntegrationHealthPanel;
