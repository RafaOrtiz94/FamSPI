import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiExternalLink, FiLayers, FiSave } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import Card from "../../../../../core/ui/components/Card";

// Parametros por producto: valor del fabricante (Method Sheet vigente) y ajuste
// del laboratorio. El motor de calculo usa ajuste ?? fabricante.

const TYPE_TABS = [
  { key: "reactivo", label: "Reactivos" },
  { key: "calibrador", label: "Calibradores" },
  { key: "control", label: "Controles" },
  { key: "material", label: "Materiales" },
];

const STATUS = {
  verified: { label: "Verificado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  extracted: { label: "Extraído, sin revisar", className: "bg-blue-50 text-blue-700 border-blue-200" },
  partial: { label: "Ficha incompleta", className: "bg-amber-50 text-amber-800 border-amber-200" },
  requires_review: { label: "Revisar", className: "bg-red-50 text-red-700 border-red-200" },
  pending: { label: "Sin ficha", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const EVENT_LABELS = {
  reagent_lot_change: "cambio de lote",
  reagent_pack_change: "cambio de pack",
};

function formatDays(days) {
  if (days === null || days === undefined) return null;
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days % 7 === 0) return `${days / 7} sem`;
  return `${Math.round(days * 10) / 10} d`;
}

function formatHours(hours) {
  if (hours === null || hours === undefined) return null;
  return hours <= 48 ? `${hours} h` : formatDays(hours / 24);
}

function formatPresentation(p) {
  if (!p) return "—";
  const parts = [];
  if (p.containers && p.volumeMl) parts.push(`${p.containers} × ${p.volumeMl} mL`);
  else if (p.containers) parts.push(`${p.containers} u`);
  if (p.levels) parts.push(`${p.levels} niveles`);
  if (p.tests) parts.push(`${p.tests} pruebas`);
  return parts.join(" · ") || "—";
}

function calibrationSummary(m) {
  if (!m) return null;
  const c = m.calibration || {};
  const parts = (c.events || []).map((e) => EVENT_LABELS[e] || e);
  if (c.intervalDays) parts.push(`cada ${formatDays(c.intervalDays)}`);
  if (c.onboardPackIntervalDays) parts.push(`tras ${formatDays(c.onboardPackIntervalDays)} a bordo`);
  if (c.sameLotIntervalDays) parts.push(`${formatDays(c.sameLotIntervalDays)} mismo lote`);
  if (c.onboardKitIntervalDays) parts.push(`${formatDays(c.onboardKitIntervalDays)} mismo kit a bordo`);
  return parts.length ? parts.join(", ") : null;
}

const inputClass = "w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100";

// Celda editable: muestra el valor efectivo; en edicion, el input guarda solo
// el ajuste y el placeholder recuerda el valor del fabricante.
function ParamCell({ editing, value, manufacturerValue, format, unit, onChange }) {
  const adjusted = value !== undefined && value !== null && value !== "";
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          step="any"
          value={value ?? ""}
          placeholder={manufacturerValue ?? "—"}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          aria-label={`Ajuste en ${unit}`}
        />
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
    );
  }
  const shown = adjusted ? Number(value) : manufacturerValue;
  return (
    <div>
      <span className={adjusted ? "font-semibold text-violet-700" : "text-gray-800"}>
        {shown !== null && shown !== undefined ? format(shown) : "—"}
      </span>
      {adjusted && (
        <div className="text-[11px] text-gray-400">
          Fabricante: {manufacturerValue !== null && manufacturerValue !== undefined ? format(manufacturerValue) : "—"}
        </div>
      )}
    </div>
  );
}

function SourceCell({ item }) {
  const status = STATUS[item.spec?.status] || STATUS.pending;
  return (
    <div className="space-y-1">
      <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
        {status.label}
      </span>
      {item.spec?.sourceUrl && (
        <a
          href={item.spec.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
          title={item.spec.notes || undefined}
        >
          {item.spec.sourceTitle} v{item.spec.documentVersion}
          <FiExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function LinkedList({ list }) {
  if (!list?.length) return <span className="text-gray-400">—</span>;
  return (
    <ul className="space-y-0.5">
      {list.map((l) => (
        <li key={l.code} className={l.inBusinessCase ? "text-gray-800" : "text-gray-400"}>
          {l.name || l.code}
          {!l.inBusinessCase && <span className="ml-1 text-[11px]">(no está en el BC)</span>}
        </li>
      ))}
    </ul>
  );
}

const LabProductParametersCard = ({ bcId, canEdit }) => {
  const { showToast } = useUI();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("reactivo");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!bcId) return;
    setLoading(true);
    try {
      const { data: res } = await api.get(`/business-case/${bcId}/lab-environment/product-parameters`);
      setData(res?.data || null);
    } catch (err) {
      showToast("No se pudieron cargar los parámetros por producto", "error");
    } finally {
      setLoading(false);
    }
  }, [bcId, showToast]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => data?.items || [], [data]);
  const counts = useMemo(() => TYPE_TABS.reduce((acc, t) => ({
    ...acc, [t.key]: items.filter((i) => i.itemType === t.key).length,
  }), {}), [items]);
  const rows = items.filter((i) => i.itemType === tab);

  const draftFor = (item) => drafts[item.code] ?? item.overrides ?? {};
  const setField = (item, field, value) => setDrafts((prev) => ({
    ...prev,
    [item.code]: { ...(prev[item.code] ?? item.overrides ?? {}), [field]: value },
  }));

  const startEdit = () => { setDrafts({}); setEditing(true); };
  const cancelEdit = () => { setDrafts({}); setEditing(false); };

  const save = async () => {
    const changed = Object.entries(drafts).map(([code, overrides]) => ({ code, overrides }));
    if (!changed.length) { setEditing(false); return; }
    setSaving(true);
    try {
      const { data: res } = await api.put(`/business-case/${bcId}/lab-environment/product-parameters`, { items: changed });
      setData(res?.data || null);
      setDrafts({});
      setEditing(false);
      showToast("Ajustes del laboratorio guardados", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Error guardando los ajustes", "error");
    } finally {
      setSaving(false);
    }
  };

  const adjustedCount = items.filter((i) => Object.keys(i.overrides || {}).some((k) => k !== "note")).length;

  return (
    <Card className="p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 bg-white">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 mb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <FiLayers size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">Parámetros por producto</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Calibración, control y estabilidad según el documento vigente del fabricante.
              Si el laboratorio trabaja distinto, registre el ajuste; el cálculo usará el ajuste.
            </p>
            {adjustedCount > 0 && (
              <p className="text-xs text-violet-700 mt-1 font-medium">{adjustedCount} producto(s) con ajuste del laboratorio</p>
            )}
          </div>
        </div>
        {canEdit && data?.available && items.length > 0 && (
          editing ? (
            <div className="flex gap-2">
              <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50">
                Cancelar
              </button>
              <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                <FiSave size={16} /> {saving ? "Guardando..." : "Guardar ajustes"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={startEdit} className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50">
              Ajustar
            </button>
          )
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando parámetros...</p>}

      {!loading && data && !data.available && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          La ficha técnica de productos aún no está cargada en la base de datos (migraciones 305-307).
        </p>
      )}

      {!loading && data?.available && items.length === 0 && (
        <p className="text-sm text-gray-500">
          El Business Case todavía no tiene consumos con cantidad. Sincronice el Sheet para ver los productos.
        </p>
      )}

      {!loading && data?.available && items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mb-4" role="tablist">
            {TYPE_TABS.filter((t) => counts[t.key] > 0).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full px-3 py-1 text-sm font-semibold border transition-colors ${
                  tab === t.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {t.label} <span className="opacity-70">{counts[t.key]}</span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="py-2 px-3 font-semibold">Producto</th>
                  {tab === "reactivo" ? (
                    <>
                      <th className="py-2 px-3 font-semibold">Calibración (fabricante)</th>
                      <th className="py-2 px-3 font-semibold">Recalibrar cada</th>
                      <th className="py-2 px-3 font-semibold">Control cada</th>
                      <th className="py-2 px-3 font-semibold">A bordo</th>
                      <th className="py-2 px-3 font-semibold">Calibrador</th>
                      <th className="py-2 px-3 font-semibold">Controles</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2 px-3 font-semibold">Presentación</th>
                      <th className="py-2 px-3 font-semibold">Estable abierto (2-8 °C)</th>
                      <th className="py-2 px-3 font-semibold">A bordo</th>
                    </>
                  )}
                  <th className="py-2 px-3 font-semibold">Fuente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const m = item.manufacturer;
                  const d = draftFor(item);
                  return (
                    <tr key={`${item.code}-${item.equipmentName}`} className="border-b border-gray-50 align-top">
                      <td className="py-2 px-3">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-[11px] text-gray-400">{item.code} · {item.equipmentName}</div>
                      </td>
                      {tab === "reactivo" ? (
                        <>
                          <td className="py-2 px-3 text-gray-700">
                            {calibrationSummary(m) || <span className="text-gray-400">Sin dato</span>}
                            {m?.calibration?.replicate && <div className="text-[11px] text-gray-400">Réplica: {m.calibration.replicate}</div>}
                          </td>
                          <td className="py-2 px-3">
                            <ParamCell editing={editing} value={d.calibration_interval_days} manufacturerValue={m?.calibrationIntervalDays} format={formatDays} unit="días"
                              onChange={(v) => setField(item, "calibration_interval_days", v)} />
                          </td>
                          <td className="py-2 px-3">
                            <ParamCell editing={editing} value={d.qc_interval_hours} manufacturerValue={m?.qcIntervalHours} format={formatHours} unit="horas"
                              onChange={(v) => setField(item, "qc_interval_hours", v)} />
                            {m?.qcPerKit && <div className="text-[11px] text-gray-400">y por kit</div>}
                          </td>
                          <td className="py-2 px-3">
                            <ParamCell editing={editing} value={d.onboard_days} manufacturerValue={m?.onboardDays} format={formatDays} unit="días"
                              onChange={(v) => setField(item, "onboard_days", v)} />
                          </td>
                          <td className="py-2 px-3"><LinkedList list={m?.linkedCalibrators} /></td>
                          <td className="py-2 px-3"><LinkedList list={m?.linkedControls} /></td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-3 text-gray-700">
                            {formatPresentation(item.spec?.presentation)}
                            {m?.singleUse && <div className="text-[11px] text-gray-400">Envase de un solo uso</div>}
                            {m?.onboardAliquotSingleUse && <div className="text-[11px] text-gray-400">Alícuota en analizador: un solo uso</div>}
                          </td>
                          <td className="py-2 px-3">
                            <ParamCell editing={editing} value={d.open_days} manufacturerValue={m?.openDays} format={formatDays} unit="días"
                              onChange={(v) => setField(item, "open_days", v)} />
                          </td>
                          <td className="py-2 px-3">
                            {m?.onboardUntilExpiration ? <span className="text-gray-800">Hasta vencimiento</span> : (
                              <ParamCell editing={editing} value={d.onboard_days} manufacturerValue={m?.onboardDays} format={formatDays} unit="días"
                                onChange={(v) => setField(item, "onboard_days", v)} />
                            )}
                          </td>
                        </>
                      )}
                      <td className="py-2 px-3"><SourceCell item={item} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
};

export default LabProductParametersCard;
