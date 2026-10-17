import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiExternalLink, FiPaperclip, FiRefreshCw, FiSearch, FiX } from "react-icons/fi";
import { getInvestmentPriceHistory } from "../../../core/api/businessCaseApi";
import { useUI } from "../../../core/ui/UIContext";

const money = (value) =>
  value == null
    ? "-"
    : `$${Number(value).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("es-EC") : "-");

// quotation_date llega como AAAA-MM-DD: sin pasar por Date para no correr un dia por zona horaria.
const formatPlainDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "-";
};

const PURCHASE_TYPE_LABELS = {
  public: "Publico",
  comodato_publico: "Publico",
  private_comodato: "Privado comodato",
  comodato_privado: "Privado comodato",
  private_sale: "Privado venta",
};

// Matriz historica de inversiones adicionales: que se pago por cada item en BCs
// anteriores, con que proveedor y con que cotizacion. Se reutiliza desde el
// panel "Historico" de Precios financieros y operativos de cada BC.
export default function InvestmentPriceHistoryPage() {
  const { showToast } = useUI();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [summary, setSummary] = useState([]);
  const [rows, setRows] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const filters = { q: appliedSearch || undefined, from: fromDate || undefined };
    try {
      setLoading(true);
      const [all, detail] = await Promise.all([
        getInvestmentPriceHistory({ ...filters, limit: 500 }),
        selectedItem
          ? getInvestmentPriceHistory({ ...filters, catalog_id: selectedItem.catalog_id, limit: 500 })
          : Promise.resolve(null),
      ]);
      setSummary(all.summary || []);
      const source = detail || all;
      setRows(source.items || []);
      setTruncated(Boolean(source.truncated));
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar el historico de inversiones", "error");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, fromDate, selectedItem, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Historico de inversiones adicionales</h1>
          <p className="text-sm text-slate-600">
            Precios y cotizaciones registrados en Business Case anteriores, para reutilizarlos en los nuevos.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500">Buscar</span>
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Item, cliente, caracteristicas o proveedor"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500">Precios desde</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Resumen por item</h2>
          <p className="text-xs text-slate-500">Precio financiero base unitario. Elige un item para ver su detalle.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/70 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Item</th>
                <th className="px-4 py-2 text-right font-semibold">BC</th>
                <th className="px-4 py-2 text-right font-semibold">Ultimo</th>
                <th className="px-4 py-2 text-right font-semibold">Promedio</th>
                <th className="px-4 py-2 text-right font-semibold">Minimo</th>
                <th className="px-4 py-2 text-right font-semibold">Maximo</th>
                <th className="px-4 py-2 text-right font-semibold">Cotizaciones</th>
                <th className="px-4 py-2 text-left font-semibold">Ultima vez</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => {
                const active = selectedItem?.catalog_id === row.catalog_id;
                return (
                  <tr
                    key={row.catalog_id}
                    onClick={() => setSelectedItem(active ? null : row)}
                    className={`cursor-pointer border-t border-slate-100 ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}
                  >
                    <td className="px-4 py-2 font-semibold text-slate-800">{row.item_name}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{row.cases_count}</td>
                    <td className="px-4 py-2 text-right text-slate-900">{money(row.last_financial_unit_price)}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{money(row.avg_financial_unit_price)}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{money(row.min_financial_unit_price)}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{money(row.max_financial_unit_price)}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{row.quotation_files_count}</td>
                    <td className="px-4 py-2 text-slate-600">{formatDate(row.last_priced_at)}</td>
                  </tr>
                );
              })}
              {!loading && !summary.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No hay inversiones con precio o cotizacion para estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {selectedItem ? `Detalle: ${selectedItem.item_name}` : "Detalle por Business Case"}
            </h2>
            <p className="text-xs text-slate-500">
              {rows.length} registro(s){truncated ? " · se muestran los 500 mas recientes, afina los filtros" : ""}
            </p>
          </div>
          {selectedItem && (
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <FiX size={12} /> Quitar filtro de item
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/70 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Fecha</th>
                <th className="px-4 py-2 text-left font-semibold">Item</th>
                <th className="px-4 py-2 text-left font-semibold">Cliente</th>
                <th className="px-4 py-2 text-right font-semibold">Cant.</th>
                <th className="px-4 py-2 text-left font-semibold">Caracteristicas</th>
                <th className="px-4 py-2 text-right font-semibold">Financiero</th>
                <th className="px-4 py-2 text-right font-semibold">Dep. %</th>
                <th className="px-4 py-2 text-right font-semibold">Operativo</th>
                <th className="px-4 py-2 text-left font-semibold">Cotizaciones</th>
                <th className="px-4 py-2" aria-label="Abrir BC" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const files = Array.isArray(row.quotation_files) ? row.quotation_files : [];
                return (
                  <tr key={`${row.business_case_id}-${row.catalog_id}`} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatDate(row.priced_at)}</td>
                    <td className="px-4 py-2 font-semibold text-slate-800">{row.item_name}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {row.client_name || "-"}
                      <div className="text-xs text-slate-500">{PURCHASE_TYPE_LABELS[row.bc_purchase_type] || row.bc_purchase_type || ""}</div>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{row.quantity ?? "-"}</td>
                    <td className="max-w-xs px-4 py-2 text-xs text-slate-600">{row.characteristics || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-semibold text-slate-900">{money(row.financial_unit_price)}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{row.depreciation_percentage ?? "-"}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-slate-700">{money(row.operational_unit_price)}</td>
                    <td className="px-4 py-2 text-xs">
                      {files.length ? (
                        <ul className="space-y-1">
                          {files.map((file) => (
                            <li key={file.id}>
                              <a
                                href={file.drive_url || "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:underline"
                                title={file.file_name}
                              >
                                <FiPaperclip size={11} />
                                {file.supplier_name || file.file_name}
                              </a>
                              {file.quotation_date ? <span className="ml-1 text-slate-500">{formatPlainDate(file.quotation_date)}</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">Sin archivo</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to={`/dashboard/business-case/workspace/${row.business_case_id}?section=investment_values`}
                        title="Abrir Business Case"
                        className="inline-flex rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      >
                        <FiExternalLink size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-500">Sin registros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
