import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FiAlertCircle, FiCpu, FiImage, FiRefreshCw, FiShield } from "react-icons/fi";
import famLogo from "../../../assets/famproject_logo.png";
import { getPublicTiAsset } from "../api/tiAssetsPublicApi";

const STATUS_LABELS = {
  available: "Disponible",
  assigned: "Asignado",
  unassigned: "Sin asignar",
  damaged: "Dañado",
  in_maintenance: "En mantenimiento",
  retired: "Retirado",
};

const DetailRow = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || "-"}</p>
  </div>
);

export default function TIAssetPublicLookupPage() {
  const { assetCode = "" } = useParams();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const decodedCode = useMemo(() => {
    try {
      return decodeURIComponent(assetCode);
    } catch (_error) {
      return assetCode;
    }
  }, [assetCode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getPublicTiAsset(decodedCode)
      .then((data) => {
        if (!active) return;
        setAsset(data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError?.response?.data?.message || "No se pudo consultar el activo TI.");
        setAsset(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [decodedCode]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header className="rounded-3xl bg-slate-950 px-5 py-5 text-white shadow-xl shadow-slate-200 sm:px-7">
          <img src={famLogo} alt="FamProject" className="h-8 w-auto" />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Consulta publica</p>
              <h1 className="mt-2 text-2xl font-bold">Activo TI</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Informacion actual consultada desde FamSPI mediante codigo QR.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs text-slate-200">
              <FiShield size={14} />
              Codigo verificado
            </span>
          </div>
        </header>

        {loading ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
              <FiRefreshCw className="animate-spin" size={18} />
              Consultando activo...
            </div>
          </section>
        ) : error ? (
          <section className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-800 shadow-sm">
            <div className="flex items-start gap-3">
              <FiAlertCircle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-semibold">No se pudo verificar el activo</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-500">
                  <FiCpu size={18} />
                  <span className="text-xs font-semibold uppercase tracking-[0.16em]">Equipo</span>
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">{asset?.name || "Activo TI"}</h2>
                <p className="mt-1 font-mono text-sm font-semibold text-cyan-700">{asset?.asset_code || decodedCode}</p>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {STATUS_LABELS[asset?.status] || asset?.status || "Sin estado"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailRow label="Marca / modelo" value={[asset?.brand, asset?.model].filter(Boolean).join(" ")} />
              <DetailRow label="Numero de serie" value={asset?.serial_number} />
              <DetailRow label="IMEI" value={asset?.imei} />
              <DetailRow label="Estado fisico" value={asset?.physical_condition_score ? `${asset.physical_condition_score}/10` : null} />
              <DetailRow label="Estado funcional" value={asset?.functional_condition_score ? `${asset.functional_condition_score}/10` : null} />
              <DetailRow label="Custodia actual" value={asset?.custody_label} />
              {asset?.custody_type === "client" ? (
                <>
                  <DetailRow label="Cliente asignado" value={asset?.client_name} />
                  <DetailRow label="Direccion cliente" value={asset?.client_address} />
                  <DetailRow label="Ubicacion / sede" value={asset?.location_label} />
                </>
              ) : asset?.custody_type === "warehouse" ? (
                <>
                  <DetailRow label="Bodega" value={asset?.warehouse_code} />
                  <DetailRow label="Direccion bodega" value={asset?.warehouse_address || asset?.location_label} />
                  <DetailRow label="Seccion" value={asset?.warehouse_section} />
                  <DetailRow label="Percha" value={asset?.warehouse_shelf} />
                </>
              ) : (
                <DetailRow label="Ubicacion" value={asset?.location_label} />
              )}
              <DetailRow label="Ultima actualizacion" value={asset?.updated_at ? new Date(asset.updated_at).toLocaleString("es-EC") : null} />
            </div>
            {asset?.initial_condition_photos?.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center gap-2 text-slate-600">
                  <FiImage size={16} />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">Fotos de registro</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {asset.initial_condition_photos.map((photo) => (
                    <a
                      key={photo.index}
                      href={photo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={photo.url}
                        alt={`Foto de registro ${photo.index}`}
                        className="h-44 w-full object-cover transition-transform group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                      <div className="px-3 py-2 text-xs font-semibold text-slate-600">
                        Foto {photo.index}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
