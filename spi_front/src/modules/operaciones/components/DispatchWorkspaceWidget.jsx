import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiCheckCircle, FiRefreshCw } from "react-icons/fi";
import { listBusinessCases } from "../../../core/api/businessCaseApi";

const BC_TYPE_LABELS = {
  public: "Pública",
  comodato_publico: "Pública",
  private_comodato: "Privada",
  private_sale: "Privada",
  comodato_privado: "Privada",
};

const PUBLIC_TYPES = new Set(["public", "comodato_publico"]);

function isFeasibleBC(bc) {
  const meta = bc?.modern_bc_metadata;
  if (!meta || typeof meta !== "object") return false;
  const decision = meta?.feasibility?.decision;
  if (!decision || typeof decision !== "object") return false;
  return Boolean(decision.is_feasible && decision.decided_at);
}

function isPublicBC(bc) {
  return PUBLIC_TYPES.has(bc?.bc_purchase_type);
}

function isWonPublicBC(bc) {
  if (!isPublicBC(bc)) return true; // privadas no requieren "ganado"
  // Proceso público marcado como ganado: status === "ganado" o campo específico
  return (
    String(bc?.status || "").toLowerCase() === "ganado" ||
    Boolean(bc?.modern_bc_metadata?.process_won)
  );
}

const DispatchWorkspaceWidget = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listBusinessCases({ pageSize: 100 });
      const allBCs = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

      const filtered = allBCs.filter((bc) => {
        if (!isFeasibleBC(bc)) return false;
        if (isPublicBC(bc) && !isWonPublicBC(bc)) return false;
        return true;
      });

      setItems(filtered);
    } catch (err) {
      console.error("DispatchWorkspaceWidget load error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-50">
        <div>
          <h3 className="text-base font-bold text-gray-900">Cantidades Máximas</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Business Cases factibles que requieren control de despacho
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          title="Actualizar"
        >
          <FiRefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && (
        <div className="px-5 py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      )}

      {!loading && !items.length && (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          No hay Business Cases factibles pendientes de cantidades máximas.
        </div>
      )}

      {!loading && items.length > 0 && (
        <ul className="divide-y divide-gray-50">
          {items.map((bc) => {
            const decision = bc?.modern_bc_metadata?.feasibility?.decision;
            const isPublic = isPublicBC(bc);
            const typeLabel = BC_TYPE_LABELS[bc?.bc_purchase_type] || "—";
            const decidedAt = decision?.decided_at
              ? new Date(decision.decided_at).toLocaleDateString("es-EC")
              : null;

            return (
              <li key={bc.id}>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/dashboard/business-case/workspace/${bc.id}?section=dispatch_workspace`
                    )
                  }
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {bc.client_name || "Cliente sin nombre"}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isPublic
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {typeLabel}
                      </span>
                      {isPublic && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          Ganado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {bc.process_code && (
                        <span className="text-xs text-gray-500">{bc.process_code}</span>
                      )}
                      {decidedAt && (
                        <span className="text-xs text-gray-400">
                          <FiCheckCircle size={10} className="inline mr-0.5 text-emerald-500" />
                          Factible desde {decidedAt}
                        </span>
                      )}
                    </div>
                  </div>
                  <FiArrowRight size={15} className="text-gray-400 flex-shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && items.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-50">
          <span className="text-xs text-gray-400">
            {items.length} proceso{items.length !== 1 ? "s" : ""} pendiente
            {items.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
};

export default DispatchWorkspaceWidget;
