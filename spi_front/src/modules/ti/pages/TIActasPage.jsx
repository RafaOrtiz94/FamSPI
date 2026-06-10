import React, { useCallback, useEffect, useState } from "react";
import {
  FiCheck,
  FiClock,
  FiDownload,
  FiFileText,
  FiFilter,
  FiRefreshCw,
  FiUploadCloud,
} from "react-icons/fi";
import { useUI } from "../../../core/ui/UIContext";
import {
  downloadTiActa,
  listTiAllActas,
  uploadTiActaSigned,
} from "../../../core/api/tiAssetsApi";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_CONFIG = {
  entrega: { label: "Entrega", bg: "bg-blue-50",  text: "text-blue-700",  border: "border-blue-100" },
  retiro:  { label: "Retiro",  bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
};

const ESTADO_CONFIG = {
  true:  { label: "Firmada",          icon: FiCheck, bg: "bg-green-50",  text: "text-green-700"  },
  false: { label: "Pendiente firma",  icon: FiClock, bg: "bg-amber-50",  text: "text-amber-700"  },
};

function TipoBadge({ tipo }) {
  const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.entrega;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function EstadoBadge({ isComplete }) {
  const cfg = ESTADO_CONFIG[String(isComplete)];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

function fmt(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("es-EC", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TIActasPage = () => {
  const { showToast } = useUI();

  const [actas, setActas]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [uploadingId, setUploadingId] = useState(null);

  // Filters
  const [filterTipo, setFilterTipo]         = useState("");
  const [filterEstado, setFilterEstado]     = useState("");

  const loadActas = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterTipo)   params.tipo        = filterTipo;
      if (filterEstado !== "") params.is_complete = filterEstado;
      const rows = await listTiAllActas(params);
      setActas(Array.isArray(rows) ? rows : []);
    } catch {
      showToast("No se pudieron cargar las actas", "error");
    } finally {
      setLoading(false);
    }
  }, [filterTipo, filterEstado, showToast]);

  useEffect(() => { loadActas(); }, [loadActas]);

  const handleDownload = async (acta) => {
    try {
      await downloadTiActa(acta.id, acta.tipo);
    } catch {
      showToast("No se pudo descargar el acta", "error");
    }
  };

  const handleSignedUpload = async (actaId, file) => {
    if (!file) return;
    setUploadingId(actaId);
    try {
      await uploadTiActaSigned(actaId, file);
      showToast("Acta firmada subida correctamente. Checklist del colaborador actualizado.", "success");
      await loadActas();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo subir el acta firmada", "error");
    } finally {
      setUploadingId(null);
    }
  };

  const filteredActas = actas.filter((a) => {
    if (filterTipo   && a.tipo !== filterTipo)          return false;
    if (filterEstado !== "" && String(a.is_complete) !== filterEstado) return false;
    return true;
  });

  // Stats
  const total    = actas.length;
  const firmadas = actas.filter((a) => a.is_complete).length;
  const pendientes = total - firmadas;

  return (
    <div className="flex min-w-0 flex-col space-y-5 p-4 sm:p-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Actas de entrega y retiro</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {total} acta{total !== 1 ? "s" : ""} generada{total !== 1 ? "s" : ""}
            {" · "}{firmadas} firmada{firmadas !== 1 ? "s" : ""}
            {" · "}{pendientes} pendiente{pendientes !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={loadActas}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors active:scale-[0.97] disabled:opacity-50"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total",      value: total,     color: "text-slate-800" },
          { label: "Firmadas",   value: firmadas,  color: "text-green-700" },
          { label: "Pendientes", value: pendientes, color: "text-amber-700" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <p className="text-xs text-slate-400">{k.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <FiFilter size={14} className="text-slate-400 shrink-0" />
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-slate-400 transition-colors"
        >
          <option value="">Todos los tipos</option>
          <option value="entrega">Entrega</option>
          <option value="retiro">Retiro</option>
        </select>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-slate-400 transition-colors"
        >
          <option value="">Todos los estados</option>
          <option value="true">Firmadas</option>
          <option value="false">Pendientes</option>
        </select>
        {(filterTipo || filterEstado) && (
          <button
            type="button"
            onClick={() => { setFilterTipo(""); setFilterEstado(""); }}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filteredActas.length} resultado{filteredActas.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <FiRefreshCw size={20} className="animate-spin text-slate-300" />
          </div>
        ) : filteredActas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <FiFileText size={32} className="text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-500">Sin actas generadas</p>
            <p className="text-xs text-slate-400 mt-1">
              Las actas se crean automáticamente al asignar o retirar equipos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-400">
                  <th className="px-4 py-3 text-left font-medium">N° Acta</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Activo</th>
                  <th className="px-4 py-3 text-left font-medium">Colaborador</th>
                  <th className="px-4 py-3 text-left font-medium">Cargo</th>
                  <th className="px-4 py-3 text-left font-medium">Cédula</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActas.map((acta) => {
                  const isUploading = uploadingId === acta.id;
                  return (
                    <tr key={acta.id} className="hover:bg-slate-50 transition-colors">
                      {/* N° */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          #{String(acta.id).padStart(6, "0")}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        <TipoBadge tipo={acta.tipo} />
                      </td>

                      {/* Activo */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 text-xs">
                          {acta.asset_name || "-"}
                        </p>
                        {acta.asset_code && (
                          <p className="font-mono text-[10px] text-slate-400">{acta.asset_code}</p>
                        )}
                      </td>

                      {/* Colaborador */}
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-800">
                          {acta.recipient_nombre || <span className="text-slate-400 italic">Sin nombre</span>}
                        </p>
                        <p className="text-[10px] text-slate-400">{acta.notes || ""}</p>
                      </td>

                      {/* Cargo */}
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {acta.recipient_cargo || "-"}
                      </td>

                      {/* Cédula */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-600">
                          {acta.recipient_cedula || "-"}
                        </span>
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {fmt(acta.generated_at)}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <EstadoBadge isComplete={acta.is_complete} />
                        {acta.is_complete && acta.signed_at && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(acta.signed_at).toLocaleDateString("es-EC")}
                          </p>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {/* Descargar borrador */}
                          <button
                            type="button"
                            onClick={() => handleDownload(acta)}
                            title="Descargar acta (borrador actualizado)"
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <FiDownload size={11} /> PDF
                          </button>

                          {/* Ver firmada en Drive */}
                          {acta.is_complete && acta.signed_pdf_drive_url && (
                            <a
                              href={acta.signed_pdf_drive_url}
                              target="_blank"
                              rel="noreferrer"
                              title="Ver acta firmada en Drive"
                              className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 text-xs text-green-700 hover:bg-green-100 transition-colors whitespace-nowrap"
                            >
                              <FiCheck size={11} /> Firmada
                            </a>
                          )}

                          {/* Subir firmada */}
                          {!acta.is_complete && (
                            <label className="cursor-pointer" title="Subir acta firmada">
                              <span className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                                isUploading
                                  ? "border-slate-200 bg-slate-100 text-slate-400 cursor-wait"
                                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer"
                              }`}>
                                {isUploading
                                  ? <><FiRefreshCw size={11} className="animate-spin" /> Subiendo...</>
                                  : <><FiUploadCloud size={11} /> Firmar</>
                                }
                              </span>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="hidden"
                                disabled={!!uploadingId}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleSignedUpload(acta.id, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TIActasPage;
