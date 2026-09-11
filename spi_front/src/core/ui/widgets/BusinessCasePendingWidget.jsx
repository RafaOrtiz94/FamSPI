import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiArrowRight } from "react-icons/fi";
import api, { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../api";
import { useAuth } from "../../auth/useAuth";
import { isPendingForUser, getFlowStateBadge } from "../../utils/businessCaseFlowState";
import Card from "../components/Card";

// Widget de "Business Case pendientes de tu turno" para dashboards por rol
// (comercial, servicio, financiero/operaciones, gerencia). Reusa la misma
// logica de flow_state que BusinessCasePicker -- unica fuente de verdad.
// Se oculta por completo si no hay pendientes, para no ensuciar el
// dashboard cuando no aplica.
const BusinessCasePendingWidget = ({ maxItems = 4 }) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/business-case");
      const items = Array.isArray(data?.items) ? data.items : [];
      setPending(items.filter((bc) => isPendingForUser(bc, role)));
    } catch (error) {
      console.error("Error cargando Business Case pendientes:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [role]);

  useEffect(() => { load(); }, [load]);
  useScopedAutoUpdate([DATA_UPDATE_SCOPES.BUSINESS_CASE], () => load({ silent: true }));

  if (loading || pending.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiBell className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">
            Business Case pendientes de tu turno ({pending.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard/business-case")}
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
        >
          Ver todos <FiArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-2">
        {pending.slice(0, maxItems).map((bc) => {
          const badge = getFlowStateBadge(bc);
          const id = bc.business_case_id || bc.id;
          return (
            <div
              key={id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 transition hover:border-amber-300"
              onClick={() => navigate(`/dashboard/business-case/workspace/${id}`)}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{bc.client_name || "Cliente"}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>

      {pending.length > maxItems && (
        <p className="mt-2 text-center text-[11px] text-amber-700">
          +{pending.length - maxItems} más
        </p>
      )}
    </Card>
  );
};

export default BusinessCasePendingWidget;
