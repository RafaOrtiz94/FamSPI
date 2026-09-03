import React, { useMemo } from "react";
import { FiArchive, FiGrid, FiRefreshCw } from "react-icons/fi";

import { useAuth } from "../../../../core/auth/AuthContext";
import ConsumableFilesTab from "./tabs/ConsumableFilesTab";

const normalizeRoles = (user) => {
  if (!user) return [];
  const raw = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? user?.scope ?? [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .flatMap((item) => String(item || "").split(/[,\s]+/))
    .map((item) => item.toLowerCase().trim())
    .filter(Boolean);
};

const StandaloneConsumableFileDetail = ({ fileId, processName, onRefresh }) => {
  const { user } = useAuth();
  const userRoles = useMemo(() => normalizeRoles(user), [user]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-medium uppercase tracking-wider text-warm-ash">
                Control de Consumibles
              </span>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <FiArchive size={10} aria-hidden="true" />
                Sin compra vinculada
              </span>
            </div>
            <h2 className="mt-0.5 truncate text-base font-semibold tracking-tight text-ink-slate">
              {processName || "Expediente de Control de Consumibles"}
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-warm-ash">
              <FiGrid size={12} aria-hidden="true" />
              Gestion independiente de insumos, pedidos y despachos.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg p-1.5 text-warm-ash transition-colors duration-150 hover:bg-slate-100"
            aria-label="Actualizar expediente de Control de Consumibles"
          >
            <FiRefreshCw size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
        <div className="p-5">
          <ConsumableFilesTab fileId={fileId} type="standalone" userRoles={userRoles} />
        </div>
      </div>
    </div>
  );
};

export default StandaloneConsumableFileDetail;
