import React from "react";
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiRefreshCw, FiSlash } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import ServicioCard from "../design/ServicioCard";

const statusMeta = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "healthy_mock" || normalized === "stub_ready") {
    return { label: normalized === "healthy_mock" ? "Operativo (mock)" : "Stub listo", icon: FiCheckCircle, tone: "var(--st-success)" };
  }
  if (normalized === "disabled") {
    return { label: "Deshabilitado", icon: FiSlash, tone: "var(--st-text-faint)" };
  }
  // "Bloqueado por contrato" NO es una falla del sistema -- es un proveedor
  // pendiente de firma comercial, estado esperado y estable (§3.9 del plan
  // de rework: no debe confundirse visualmente con un error real). Antes ya
  // se distinguian en el codigo (blocked_contract vs degraded) pero con los
  // mismos colores de alerta (ambar/rosa) que el resto de la app nunca usa
  // -- este componente era el unico de todo el modulo que no usaba
  // tokens.css, coloreaba con clases Tailwind sueltas (slate/emerald/rose).
  if (normalized === "blocked_contract") {
    return { label: "Sin contrato — pendiente de firma comercial", icon: FiAlertTriangle, tone: "var(--st-text-muted)" };
  }
  if (normalized === "degraded") {
    return { label: "Error de configuración", icon: FiAlertTriangle, tone: "var(--st-danger)" };
  }
  return { label: "Sin estado", icon: FiActivity, tone: "var(--st-text-faint)" };
};

const titleMap = { navify: "Navify", online_support: "Online Support", rexis: "REXIS", goapp: "GoApp" };

const ExternalIntegrationHealthPanel = ({ providers = [], loading = false, onRefresh = null }) => {
  const safeProviders = Array.isArray(providers) ? providers : [];
  return (
    <ServicioCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Salud de integraciones</h2>
          <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>Estado de feature flag, contrato y cola por proveedor externo.</p>
        </div>
        {onRefresh ? <Button variant="secondary" size="sm" icon={FiRefreshCw} onClick={onRefresh} loading={loading}>Recargar salud</Button> : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {safeProviders.map((provider) => {
          const meta = statusMeta(provider?.status);
          const StatusIcon = meta.icon;
          const missingConfig = Array.isArray(provider?.missing_config) ? provider.missing_config : [];
          const missingContractData = Array.isArray(provider?.missing_contract_data) ? provider.missing_contract_data : [];
          const isContractPending = String(provider?.status || "").toLowerCase() === "blocked_contract";

          return (
            <div
              key={provider?.provider || Math.random()}
              className="rounded-[var(--st-radius-md)] border p-3"
              style={{ borderColor: "var(--st-border)", background: isContractPending ? "var(--st-surface-sunken)" : "var(--st-surface)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>{titleMap[provider?.provider] || provider?.provider || "Proveedor"}</p>
                  <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>Pendientes cola: {provider?.pending_jobs || 0} · Fallidos: {provider?.failed_jobs || 0}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-[3px] px-2 py-1 text-xs font-medium" style={{ color: meta.tone }}>
                  <StatusIcon size={13} /> {meta.label}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded-[var(--st-radius-sm)] border px-2 py-1" style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)" }}>Feature flag: {provider?.enabled ? "ON" : "OFF"}</span>
                <span className="rounded-[var(--st-radius-sm)] border px-2 py-1" style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)" }}>Contrato: {provider?.contract_approved ? "Aprobado" : "Pendiente"}</span>
              </div>

              {missingConfig.length > 0 ? (
                <p className="mt-2 text-xs" style={{ color: "var(--st-danger)" }}>Config faltante: {missingConfig.join(", ")}</p>
              ) : null}
              {missingContractData.length > 0 ? (
                <p className="mt-2 text-xs" style={{ color: "var(--st-text-muted)" }}>Datos externos faltantes: {missingContractData.join(" · ")}</p>
              ) : null}
            </div>
          );
        })}

        {safeProviders.length === 0 ? (
          <p className="rounded-[var(--st-radius-md)] border border-dashed p-4 text-sm" style={{ borderColor: "var(--st-border)", color: "var(--st-text-faint)" }}>
            No hay información de salud disponible.
          </p>
        ) : null}
      </div>
    </ServicioCard>
  );
};

export default ExternalIntegrationHealthPanel;
