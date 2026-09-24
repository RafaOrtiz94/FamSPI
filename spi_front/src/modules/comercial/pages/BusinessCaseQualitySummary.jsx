import React, { useCallback, useEffect, useState } from "react";
import {
  getBusinessCaseQualitySummaryItems,
  getBusinessCaseQualitySummaryList,
} from "../../../core/api/businessCaseApi";
import { useUI } from "../../../core/ui/UIContext";

// Vista de solo-lectura para jefe_calidad y lorena.loaiza@fam-project.com:
// solo el resumen (producto + id del sheets de origen), no el workspace
// completo del Business Case.
export default function BusinessCaseQualitySummary() {
  const { showToast } = useUI();
  const [businessCases, setBusinessCases] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    getBusinessCaseQualitySummaryList()
      .then((data) => setBusinessCases(data))
      .catch(() => showToast("No se pudo cargar la lista de Business Cases", "error"))
      .finally(() => setLoadingList(false));
  }, [showToast]);

  const loadItems = useCallback(
    (id) => {
      setSelectedId(id);
      setLoadingItems(true);
      getBusinessCaseQualitySummaryItems(id)
        .then((data) => setItems(data))
        .catch(() => showToast("No se pudo cargar el resumen de productos", "error"))
        .finally(() => setLoadingItems(false));
    },
    [showToast]
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-900">Business Cases</h2>
        {loadingList && <p className="px-1 text-sm text-slate-500">Cargando...</p>}
        <ul className="space-y-1">
          {businessCases.map((bc) => (
            <li key={bc.id}>
              <button
                type="button"
                onClick={() => loadItems(bc.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  selectedId === bc.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700"
                }`}
              >
                <div>{bc.client_name || "Sin nombre"}</div>
                <div className="text-xs text-slate-400">{bc.bc_stage || bc.status || "—"}</div>
              </button>
            </li>
          ))}
          {!loadingList && !businessCases.length && (
            <li className="px-1 text-sm text-slate-500">Sin Business Cases</li>
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {!selectedId && <p className="text-sm text-slate-500">Selecciona un Business Case para ver su resumen.</p>}
        {selectedId && loadingItems && <p className="text-sm text-slate-500">Cargando productos...</p>}
        {selectedId && !loadingItems && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Producto</th>
                  <th className="px-3 py-2 text-left font-semibold">ID (Sheets de origen)</th>
                  <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.item_id || item.name} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{item.name}</td>
                    <td className="px-3 py-2 font-mono text-slate-700">{item.item_id || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{item.type}</td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={3} className="px-3 py-5 text-center text-slate-500">
                      Sin productos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
