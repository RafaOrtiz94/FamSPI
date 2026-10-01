import React, { useState } from "react";
import { FiFileText, FiRefreshCw } from "react-icons/fi";
import { downloadTiAssetTechSpec } from "../../../core/api/tiAssetsApi";
import { useUI } from "../../../core/ui/UIContext";

// Descarga de un clic de la especificacion tecnica (PDF) de un activo TI.
// Lo usan TI (Gestion de dispositivos), financiero (Activos TI financiero) y
// acp_comercial (detalle del activo reservado en inversiones del BC).
const TiAssetTechSpecButton = ({ asset, className = "" }) => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  if (!asset?.id) return null;

  const handleClick = async () => {
    try {
      setLoading(true);
      await downloadTiAssetTechSpec(asset.id, asset.asset_code);
    } catch (error) {
      showToast?.("No se pudo generar la especificación técnica", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="Descargar especificación técnica (PDF)"
      className={
        className ||
        "flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 disabled:opacity-60"
      }
    >
      {loading ? <FiRefreshCw size={11} className="animate-spin" /> : <FiFileText size={11} />}
      {loading ? "Generando..." : "Especificación técnica"}
    </button>
  );
};

export default TiAssetTechSpecButton;
