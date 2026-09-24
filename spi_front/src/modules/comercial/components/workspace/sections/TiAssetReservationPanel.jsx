import React, { useCallback, useEffect, useState } from "react";
import { FiHardDrive, FiSearch } from "react-icons/fi";
import {
  listTiAssetReservations,
  releaseTiAssetReservation,
  reserveTiAsset,
  searchReservableTiAssets,
} from "../../../../../core/api/bcInvestmentTiAssetsApi";

// Vincula activos TI concretos (por serie) a un item ya guardado de inversiones
// adicionales. Solo jefe_ti (ver EDIT_ROLES/OPERATIONAL_ROLES y backend
// businessCase.routes.js). Cada activo vinculado queda reservado exclusivamente
// para este Business Case hasta que se libere (BC no factible) o se entregue el
// expediente de compras. Se usa tanto en InvestmentsSection.jsx (cantidad y
// caracteristicas) como en InvestmentValuesUnifiedSection.jsx (precios y
// cotizacion) -- es donde jefe_ti realmente trabaja cada item, uno por uno.
const TiAssetReservationPanel = ({ bcId, catalogId, quantity, showToast }) => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyAssetId, setBusyAssetId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReservations(await listTiAssetReservations(bcId, catalogId));
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudieron cargar las reservas de activos TI", "error");
    } finally {
      setLoading(false);
    }
  }, [bcId, catalogId, showToast]);

  useEffect(() => { load(); }, [load]);

  const search = async () => {
    setSearching(true);
    try {
      setResults(await searchReservableTiAssets(bcId, catalogId, q));
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo buscar activos TI", "error");
    } finally {
      setSearching(false);
    }
  };

  const reserve = async (assetId) => {
    setBusyAssetId(assetId);
    try {
      setReservations(await reserveTiAsset(bcId, catalogId, assetId));
      setResults((prev) => prev.filter((asset) => asset.id !== assetId));
      showToast("Activo TI reservado para este Business Case", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo reservar el activo", "error");
    } finally {
      setBusyAssetId(null);
    }
  };

  const release = async (reservationId) => {
    setBusyAssetId(reservationId);
    try {
      setReservations(await releaseTiAssetReservation(bcId, catalogId, reservationId));
      showToast("Reserva liberada", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo liberar la reserva", "error");
    } finally {
      setBusyAssetId(null);
    }
  };

  const reachedLimit = reservations.length >= Number(quantity || 0);

  return (
    <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
        <FiHardDrive size={16} />
        Activos TI reservados ({reservations.length}/{quantity || 0})
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Cargando reservas...</p>
      ) : reservations.length === 0 ? (
        <p className="text-xs text-slate-500">Aun no hay activos TI vinculados a este item.</p>
      ) : (
        <ul className="space-y-2">
          {reservations.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900">{r.asset_code ? `${r.asset_code} — ` : ""}{r.name}</p>
                <p className="text-[11px] text-slate-500">
                  {r.brand || r.model ? `${r.brand || ""} ${r.model || ""}`.trim() + " · " : ""}
                  Serie: {r.serial_number || "sin serie"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => release(r.id)}
                disabled={busyAssetId === r.id}
                className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {busyAssetId === r.id ? "..." : "Liberar"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {reachedLimit ? (
        <p className="text-[11px] text-emerald-700">Ya se reservaron tantos activos como la cantidad del item.</p>
      ) : (
        <div className="space-y-2 border-t border-blue-100 pt-3">
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && search()}
              placeholder="Buscar por nombre, marca, modelo o serie"
              className="min-h-[38px] w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-sky-200"
            />
            <button
              type="button"
              onClick={search}
              disabled={searching}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <FiSearch size={12} />
              {searching ? "..." : "Buscar"}
            </button>
          </div>
          {results.length > 0 && (
            <ul className="max-h-40 space-y-1.5 overflow-y-auto">
              {results.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900">{asset.asset_code ? `${asset.asset_code} — ` : ""}{asset.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {asset.brand || asset.model ? `${asset.brand || ""} ${asset.model || ""}`.trim() + " · " : ""}
                      Serie: {asset.serial_number || "sin serie"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => reserve(asset.id)}
                    disabled={busyAssetId === asset.id}
                    className="shrink-0 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busyAssetId === asset.id ? "..." : "Reservar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default TiAssetReservationPanel;
