import React, { useCallback, useState } from "react";
import { FiChevronDown, FiChevronRight, FiClock, FiCopy, FiExternalLink, FiLink, FiPaperclip } from "react-icons/fi";
import { getInvestmentPriceHistory, reuseInvestmentQuotationFile } from "../../../../../core/api/businessCaseApi";

const money = (value) =>
  Number(value || 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("es-EC") : "-");

// quotation_date llega como AAAA-MM-DD: se muestra sin pasar por Date para no correr un dia por zona horaria.
const formatPlainDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "-";
};

// Historico del mismo item del catalogo en otros Business Cases: referencia
// de precio (ultimo, promedio, rango), copiar precio y reutilizar cotizaciones.
// Carga perezosa: solo consulta al abrirse.
export default function InvestmentPriceHistoryPanel({
  bcId,
  item,
  canUsePrice = false,
  canReuseFile = false,
  showToast,
  onUsePrice,
  onFileReused,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(null);
  const [reusingFileId, setReusingFileId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getInvestmentPriceHistory({
        catalog_id: item.catalog_id,
        exclude_business_case_id: bcId,
        limit: 50,
      });
      setHistory(data);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar el historico del item", "error");
    } finally {
      setLoading(false);
    }
  }, [bcId, item.catalog_id, showToast]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !history && !loading) load();
  };

  const linkedDriveUrls = new Set((item.quotation_files || []).map((file) => file.drive_url).filter(Boolean));

  const handleReuse = async (file) => {
    try {
      setReusingFileId(file.id);
      await reuseInvestmentQuotationFile(bcId, item.catalog_id, file.id);
      showToast("Cotizacion vinculada a este item", "success");
      await onFileReused?.();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo reutilizar la cotizacion", "error");
    } finally {
      setReusingFileId(null);
    }
  };

  const summary = history?.summary?.[0] || null;
  const rows = history?.items || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        {open ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
        <FiClock size={13} className="text-slate-500" />
        Historico de este item en otros Business Case
        {summary ? <span className="ml-auto text-slate-500">{summary.cases_count} BC</span> : null}
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-3">
          {loading && <p className="text-xs text-slate-500">Cargando historico...</p>}

          {!loading && history && !rows.length && (
            <p className="text-xs text-slate-500">Este item aun no tiene precios ni cotizaciones en otros Business Case.</p>
          )}

          {!loading && summary && summary.priced_count > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[
                ["Ultimo precio", `$${money(summary.last_financial_unit_price)}`],
                ["Promedio", `$${money(summary.avg_financial_unit_price)}`],
                ["Rango", `$${money(summary.min_financial_unit_price)} - $${money(summary.max_financial_unit_price)}`],
                ["Ultima vez", formatDate(summary.last_priced_at)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-0.5 font-semibold text-slate-900">{value}</div>
                </div>
              ))}
            </div>
          )}

          {!loading && rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((row) => {
                const files = Array.isArray(row.quotation_files) ? row.quotation_files : [];
                const hasPrice = Number(row.financial_unit_price) > 0;
                return (
                  <li key={row.business_case_id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 text-xs">
                        <div className="font-semibold text-slate-900">
                          {row.client_name || "Cliente sin nombre"}
                          <span className="ml-2 font-normal text-slate-500">{formatDate(row.priced_at)}</span>
                        </div>
                        <div className="mt-0.5 text-slate-600">
                          Cant. {row.quantity ?? "-"}
                          {row.characteristics ? ` · ${row.characteristics}` : ""}
                        </div>
                        <div className="mt-0.5 text-slate-700">
                          Financiero <strong>${money(row.financial_unit_price)}</strong>
                          {row.depreciation_percentage != null ? ` · Dep. ${row.depreciation_percentage}%` : ""}
                          {Number(row.operational_unit_price) > 0 ? ` · Operativo $${money(row.operational_unit_price)}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <a
                          href={`/dashboard/business-case/workspace/${row.business_case_id}?section=investment_values`}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir el Business Case de origen"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
                        >
                          <FiExternalLink size={13} />
                        </a>
                        {canUsePrice && hasPrice && (
                          <button
                            type="button"
                            onClick={() => onUsePrice?.(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            <FiCopy size={12} />
                            Usar este precio
                          </button>
                        )}
                      </div>
                    </div>
                    {files.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {files.map((file) => {
                          const alreadyLinked = linkedDriveUrls.has(file.drive_url);
                          return (
                            <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2 py-1 text-xs">
                              <a
                                href={file.drive_url || "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-w-0 items-center gap-1 truncate font-semibold text-violet-700 hover:underline"
                                title={file.file_name}
                              >
                                <FiPaperclip size={11} className="shrink-0" />
                                <span className="truncate">{file.file_name}</span>
                              </a>
                              <span className="flex shrink-0 items-center gap-2 text-slate-500">
                                {file.supplier_name || "Proveedor no registrado"}
                                {file.quotation_date ? ` · ${formatPlainDate(file.quotation_date)}` : ""}
                                {canReuseFile && (
                                  alreadyLinked ? (
                                    <span className="font-semibold text-emerald-700">Vinculada</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleReuse(file)}
                                      disabled={reusingFileId === file.id}
                                      className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-2 py-0.5 font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                                    >
                                      <FiLink size={11} />
                                      {reusingFileId === file.id ? "Vinculando..." : "Reutilizar"}
                                    </button>
                                  )
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
