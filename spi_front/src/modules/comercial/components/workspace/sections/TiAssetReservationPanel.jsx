import React, { useCallback, useEffect, useState } from "react";
import { FiEye, FiHardDrive, FiLink, FiSearch, FiX } from "react-icons/fi";
import Modal from "../../../../../core/ui/components/Modal";
import {
  listTiAssetReservations,
  releaseTiAssetReservation,
  reserveTiAsset,
  searchReservableTiAssets,
} from "../../../../../core/api/bcInvestmentTiAssetsApi";

// Vincula activos TI concretos (por serie) a un item de inversiones adicionales.
// Dos modos:
//  - canManage=false (cualquier rol con acceso a inversiones): solo lectura --
//    ve que activos quedaron reservados, sin buscador ni botones.
//  - canManage=true (jefe_ti): ademas puede vincular/liberar activos. El
//    buscador NO se muestra de entrada (la mayoria de items no son de TI) --
//    aparece solo cuando jefe_ti activa "Vincular activo TI". Sin tope de
//    cantidad: una sola unidad de la inversion puede requerir varios activos
//    (ej. "Computadores x2" -> CPU + monitor + teclado + mouse por cada uno).
// Se usa tanto en InvestmentsSection.jsx (cantidad y caracteristicas) como en
// InvestmentValuesUnifiedSection.jsx (precios y cotizacion).
const TiAssetReservationPanel = ({ bcId, catalogId, quantity, showToast, canManage = false }) => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyAssetId, setBusyAssetId] = useState(null);
  const [detailAsset, setDetailAsset] = useState(null);

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

  const formatCharacteristics = (value) => {
    if (!value) return null;
    if (typeof value === "string") return value;
    try {
      const entries = Object.entries(value).filter(([, v]) => v !== null && v !== "" && v !== undefined);
      if (!entries.length) return null;
      return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
    } catch {
      return null;
    }
  };

  const AssetRow = ({ asset, action }) => {
    const thumb = asset.initial_condition_photos?.[0]?.url || asset.initial_condition_photos?.[0]?.drive_url;
    return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        {thumb && (
          <img
            src={thumb}
            alt=""
            onClick={() => setDetailAsset(asset)}
            className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-slate-200 object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-900">{asset.asset_code ? `${asset.asset_code} — ` : ""}{asset.name}</p>
          <p className="text-[11px] text-slate-500">
            {asset.brand || asset.model ? `${asset.brand || ""} ${asset.model || ""}`.trim() + " · " : ""}
            Serie: {asset.serial_number || "sin serie"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setDetailAsset(asset)}
          title="Ver informacion del activo"
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
        >
          <FiEye size={13} />
        </button>
        {action}
      </div>
    </li>
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
        <FiHardDrive size={16} />
        Activos TI reservados{reservations.length > 0 || quantity ? ` (${reservations.length}${quantity ? `/${quantity}` : ""})` : ""}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Cargando reservas...</p>
      ) : reservations.length === 0 ? (
        <p className="text-xs text-slate-500">
          {canManage ? "Aun no hay activos TI vinculados a este item." : "Este item no tiene activos TI vinculados."}
        </p>
      ) : (
        <ul className="space-y-2">
          {reservations.map((r) => (
            <AssetRow
              key={r.id}
              asset={r}
              action={canManage ? (
                <button
                  type="button"
                  onClick={() => release(r.id)}
                  disabled={busyAssetId === r.id}
                  className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {busyAssetId === r.id ? "..." : "Liberar"}
                </button>
              ) : null}
            />
          ))}
        </ul>
      )}

      {/* Solo jefe_ti puede vincular; el buscador queda oculto hasta que lo pide,
          para no meterle un buscador de activos TI a items que no tienen nada
          que ver (ej. polizas, refrigeradores). */}
      {canManage && (
        linking ? (
          <div className="space-y-2 border-t border-blue-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-900">Buscar activo para vincular</span>
              <button type="button" onClick={() => { setLinking(false); setResults([]); setQ(""); }} className="text-slate-400 hover:text-slate-600">
                <FiX size={14} />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && search()}
                placeholder="Buscar por nombre, marca, modelo o serie"
                className="min-h-[38px] w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-sky-200"
                autoFocus
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
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    action={
                      <button
                        type="button"
                        onClick={() => reserve(asset.id)}
                        disabled={busyAssetId === asset.id}
                        className="shrink-0 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busyAssetId === asset.id ? "..." : "Reservar"}
                      </button>
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLinking(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
          >
            <FiLink size={12} />
            Vincular activo TI
          </button>
        )
      )}

      <Modal open={Boolean(detailAsset)} onClose={() => setDetailAsset(null)} title="Informacion del activo" maxWidth="max-w-lg">
        {detailAsset && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{detailAsset.name}</p>
              {detailAsset.asset_code && <p className="font-mono text-xs text-slate-500">{detailAsset.asset_code}</p>}
            </div>
            {Array.isArray(detailAsset.initial_condition_photos) && detailAsset.initial_condition_photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {detailAsset.initial_condition_photos.map((photo) => (
                  <a key={photo.index} href={photo.url || photo.drive_url} target="_blank" rel="noreferrer">
                    <img
                      src={photo.url || photo.drive_url}
                      alt={`Foto ${photo.index} del activo`}
                      className="h-32 w-full rounded-xl border border-slate-200 object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
              <div><dt className="text-slate-500">Marca</dt><dd className="font-semibold text-slate-900">{detailAsset.brand || "-"}</dd></div>
              <div><dt className="text-slate-500">Modelo</dt><dd className="font-semibold text-slate-900">{detailAsset.model || "-"}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Numero de serie</dt><dd className="font-semibold text-slate-900">{detailAsset.serial_number || "-"}</dd></div>
              {(detailAsset.status || detailAsset.asset_status) && (
                <div className="col-span-2"><dt className="text-slate-500">Estado</dt><dd className="font-semibold text-slate-900">{detailAsset.status || detailAsset.asset_status}</dd></div>
              )}
            </dl>
            {formatCharacteristics(detailAsset.characteristics) && (
              <div>
                <p className="text-xs font-semibold text-slate-500">Caracteristicas</p>
                <p className="mt-1 text-xs text-slate-700">{formatCharacteristics(detailAsset.characteristics)}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TiAssetReservationPanel;
