import React, { useEffect, useRef, useState } from "react";
import { FiUploadCloud, FiCheck, FiX, FiClock, FiFileText, FiAlertTriangle, FiRefreshCw, FiPackage, FiGrid } from "react-icons/fi";
import { useUI } from "../../../core/ui/UIContext";
import {
  getBcTemplateStatus,
  uploadBcTemplateVersion,
  activateBcTemplateVersion,
  rejectBcTemplateVersion,
  getBcCatalogDiff,
  syncBcCatalog,
  getBcInvestmentCatalogDiff,
  syncBcInvestmentCatalog,
  getBcEquipmentSheetMappingReport,
} from "../../../core/api/businessCaseTemplateVersionsApi";

const CATALOG_TYPE_LABELS = { reactivo: "Reactivo", control: "Control", calibrador: "Calibrador", material: "Material" };

function CatalogDiffPanel({ diff, loading, syncing, onSync }) {
  if (loading) return <p className="text-sm text-slate-500">Comparando plantilla vigente contra el catálogo…</p>;
  if (!diff) return null;

  const hasEquipmentChanges = diff.equipment?.length > 0;
  const hasUnmatched = diff.unmatched_sheets?.length > 0;

  if (!hasEquipmentChanges && !hasUnmatched) {
    return <p className="text-sm text-slate-500">El catálogo ya coincide con la plantilla vigente — no hay reactivos, calibradores, controles ni materiales por agregar o quitar.</p>;
  }

  return (
    <div className="space-y-4">
      {hasEquipmentChanges && (
        <div className="space-y-3">
          {diff.equipment.map((eq) => (
            <div key={`${eq.equipment_id}-${eq.sheet_name}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-semibold text-slate-800">{eq.equipment_name} <span className="font-normal text-slate-400">(pestaña: {eq.sheet_name})</span></p>
              {eq.added?.length > 0 && (
                <p className="mt-1 text-emerald-700">
                  + Agregar ({eq.added.length}): {eq.added.map((i) => `${i.name} [${CATALOG_TYPE_LABELS[i.type] || i.type}]`).join(", ")}
                </p>
              )}
              {eq.removed?.length > 0 && (
                <p className="mt-1 text-rose-700">
                  − Quitar ({eq.removed.length}): {eq.removed.map((i) => `${i.name} [${CATALOG_TYPE_LABELS[i.type] || i.type}]`).join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {hasUnmatched && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
          <p className="font-semibold text-amber-800">Pestañas sin mapear con certeza ({diff.unmatched_sheets.length})</p>
          <p className="mt-1 text-amber-700">
            No se pudo identificar un único equipo del catálogo para: {diff.unmatched_sheets.join(", ")}. Actualízalas manualmente desde Operaciones → Catálogo de equipos.
          </p>
        </div>
      )}
      {hasEquipmentChanges && (
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <FiRefreshCw size={14} /> {syncing ? "Sincronizando…" : "Sincronizar catálogo con la plantilla vigente"}
        </button>
      )}
    </div>
  );
}

function InvestmentDiffPanel({ diff, loading, syncing, onSync }) {
  if (loading) return <p className="text-sm text-slate-500">Comparando plantilla vigente contra el catálogo de inversiones…</p>;
  if (!diff) return null;

  const hasChanges = diff.has_changes;
  if (!hasChanges) {
    return <p className="text-sm text-slate-500">El catálogo de inversiones adicionales ya coincide con la plantilla vigente.</p>;
  }

  return (
    <div className="space-y-3">
      {diff.added?.length > 0 && (
        <p className="text-sm text-emerald-700">
          + Agregar ({diff.added.length}): {diff.added.map((i) => i.name).join(", ")}
        </p>
      )}
      {diff.removed?.length > 0 && (
        <p className="text-sm text-rose-700">
          − Quitar ({diff.removed.length}): {diff.removed.map((i) => i.name).join(", ")}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Las inversiones nuevas se agregan como "operativa" por defecto — reclasifícalas si corresponde desde el catálogo de inversiones.
      </p>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        <FiRefreshCw size={14} /> {syncing ? "Sincronizando…" : "Sincronizar inversiones con la plantilla vigente"}
      </button>
    </div>
  );
}

// Solo lectura -- no sincroniza nada, muestra a que pestaña del Excel
// activo se asignaria CADA equipo del catalogo si se generara su Sheet real
// hoy (usa el mismo codigo que la generacion real de BC, buildSheetPayloads).
// Sirve para confirmar visualmente, equipo por equipo, que el mapeo sigue
// correcto despues de subir una plantilla nueva -- sin crear ningun BC.
function EquipmentSheetMappingPanel({ report, loading }) {
  if (loading) return <p className="text-sm text-slate-500">Resolviendo pestaña por equipo…</p>;
  if (!report) return null;

  const unmapped = report.filter((r) => !r.matched_sheets?.length);

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {report.map((r) => (
          <div
            key={r.equipment_id}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
              r.matched_sheets?.length ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/60"
            }`}
          >
            <span className="truncate text-slate-700">{r.equipment_name}</span>
            <span className={`shrink-0 font-semibold ${r.matched_sheets?.length ? "text-emerald-700" : "text-amber-700"}`}>
              {r.matched_sheets?.length ? r.matched_sheets.join(", ") : "sin pestaña"}
            </span>
          </div>
        ))}
      </div>
      {unmapped.length > 0 && (
        <p className="text-xs text-amber-700">
          {unmapped.length} equipo{unmapped.length !== 1 ? "s" : ""} sin pestaña en la plantilla actual — puede ser un equipo que la plantilla todavía no cubre.
        </p>
      )}
    </div>
  );
}

// Panel exclusivo de jefe_comercial (el backend ya lo re-valida por rol en
// cada endpoint) para subir nuevas versiones de la plantilla base del
// Business Case. El sistema detecta pestañas/columnas nuevas o eliminadas
// automaticamente y muestra el reporte antes de activar -- nunca se activa
// sola sin confirmacion.

function formatTimestamp(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-EC", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const STATUS_BADGES = {
  active: { label: "Vigente", className: "bg-emerald-100 text-emerald-800" },
  pending_review: { label: "Pendiente de revisión", className: "bg-amber-100 text-amber-800" },
  superseded: { label: "Reemplazada", className: "bg-slate-100 text-slate-600" },
  rejected: { label: "Rechazada", className: "bg-rose-100 text-rose-700" },
};

function DiffReport({ diff }) {
  if (!diff) return null;
  if (diff.is_first_version) {
    return <p className="text-sm text-slate-500">Es la primera versión registrada — no hay una anterior con la cual comparar.</p>;
  }
  if (!diff.has_changes) {
    return <p className="text-sm text-slate-500">No se detectaron cambios de estructura respecto a la versión vigente.</p>;
  }
  return (
    <div className="space-y-2 text-sm">
      {diff.sheets_added?.length ? (
        <p><span className="font-semibold text-emerald-700">Pestañas nuevas:</span> {diff.sheets_added.join(", ")}</p>
      ) : null}
      {diff.sheets_removed?.length ? (
        <p><span className="font-semibold text-rose-700">Pestañas eliminadas:</span> {diff.sheets_removed.join(", ")}</p>
      ) : null}
      {diff.sheet_changes?.map((change) => (
        <div key={change.sheet} className="rounded-lg bg-slate-50 p-2">
          <p className="font-semibold text-slate-700">{change.sheet}</p>
          {change.columns_added?.length ? (
            <p className="text-emerald-700">+ Columnas nuevas: {change.columns_added.join(", ")}</p>
          ) : null}
          {change.columns_removed?.length ? (
            <p className="text-rose-700">− Columnas eliminadas: {change.columns_removed.join(", ")}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function BusinessCaseTemplatePage() {
  const { showToast } = useUI();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState(null);
  const [catalogDiff, setCatalogDiff] = useState(null);
  const [loadingCatalogDiff, setLoadingCatalogDiff] = useState(true);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [investmentDiff, setInvestmentDiff] = useState(null);
  const [loadingInvestmentDiff, setLoadingInvestmentDiff] = useState(true);
  const [syncingInvestments, setSyncingInvestments] = useState(false);
  const [sheetMappingReport, setSheetMappingReport] = useState(null);
  const [loadingSheetMappingReport, setLoadingSheetMappingReport] = useState(true);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getBcTemplateStatus();
      setStatus(data);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar el estado de la plantilla base.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogDiff = async () => {
    setLoadingCatalogDiff(true);
    try {
      const data = await getBcCatalogDiff();
      setCatalogDiff(data);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo comparar el catálogo de reactivos/calibradores/controles/materiales.", "error");
    } finally {
      setLoadingCatalogDiff(false);
    }
  };

  const loadInvestmentDiff = async () => {
    setLoadingInvestmentDiff(true);
    try {
      const data = await getBcInvestmentCatalogDiff();
      setInvestmentDiff(data);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo comparar el catálogo de inversiones adicionales.", "error");
    } finally {
      setLoadingInvestmentDiff(false);
    }
  };

  const loadSheetMappingReport = async () => {
    setLoadingSheetMappingReport(true);
    try {
      const data = await getBcEquipmentSheetMappingReport();
      setSheetMappingReport(data);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo resolver la pestaña por equipo.", "error");
    } finally {
      setLoadingSheetMappingReport(false);
    }
  };

  useEffect(() => {
    load();
    loadCatalogDiff();
    loadInvestmentDiff();
    loadSheetMappingReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncCatalog = async () => {
    setSyncingCatalog(true);
    try {
      const result = await syncBcCatalog();
      showToast(`Catálogo sincronizado: ${result.added} agregados, ${result.removed} quitados.`, "success");
      await loadCatalogDiff();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo sincronizar el catálogo.", "error");
    } finally {
      setSyncingCatalog(false);
    }
  };

  const handleSyncInvestments = async () => {
    setSyncingInvestments(true);
    try {
      const result = await syncBcInvestmentCatalog();
      showToast(`Inversiones sincronizadas: ${result.added} agregadas, ${result.removed} quitadas.`, "success");
      await loadInvestmentDiff();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo sincronizar el catálogo de inversiones.", "error");
    } finally {
      setSyncingInvestments(false);
    }
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await uploadBcTemplateVersion(file);
      showToast("Plantilla subida. Revisa el reporte de cambios antes de activarla.", "success");
      await load();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo subir la plantilla.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (versionId) => {
    setBusyVersionId(versionId);
    try {
      await activateBcTemplateVersion(versionId);
      showToast("Plantilla activada. Los BC nuevos usarán esta versión.", "success");
      await load();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo activar la versión.", "error");
    } finally {
      setBusyVersionId(null);
    }
  };

  const handleReject = async (versionId) => {
    setBusyVersionId(versionId);
    try {
      await rejectBcTemplateVersion(versionId);
      showToast("Versión rechazada.", "info");
      await load();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo rechazar la versión.", "error");
    } finally {
      setBusyVersionId(null);
    }
  };

  const active = status?.active;
  const latest = status?.latest;
  const latestIsPending = latest && latest.status === "pending_review";

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Plantilla base del Business Case</h1>
        <p className="mt-1 text-sm text-slate-500">
          Solo Jefe Comercial puede subir actualizaciones. Cada Business Case nuevo se genera a partir de la versión vigente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <FiCheck size={13} /> Vigente actualmente
          </div>
          {active ? (
            <div className="mt-2">
              <p className="text-sm font-semibold text-slate-800 break-words">{active.filename}</p>
              <p className="mt-1 text-xs text-slate-500">Activada el {formatTimestamp(active.activated_at)}</p>
              <p className="text-xs text-slate-500">Subida por {active.uploaded_by_name}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Aún no se ha activado ninguna versión — se usa la plantilla empaquetada por defecto.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <FiClock size={13} /> Última actualización subida
          </div>
          {latest ? (
            <div className="mt-2">
              <p className="text-sm font-semibold text-slate-800 break-words">{latest.filename}</p>
              <p className="mt-1 text-xs text-slate-500">Subida el {formatTimestamp(latest.uploaded_at)} por {latest.uploaded_by_name}</p>
              {STATUS_BADGES[latest.status] ? (
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGES[latest.status].className}`}>
                  {STATUS_BADGES[latest.status].label}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Todavía no se ha subido ninguna versión.</p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4">
        <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileSelected} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiUploadCloud size={14} />
          {uploading ? "Subiendo y analizando…" : "Subir nueva versión (.xlsx)"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          El sistema detecta pestañas y columnas nuevas o eliminadas automáticamente. No se activa sola — queda pendiente hasta que la confirmes.
        </p>
      </div>

      {latestIsPending ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <FiAlertTriangle size={14} /> Reporte de cambios — {latest.filename}
          </div>
          <div className="mt-3">
            <DiffReport diff={latest.diff_report} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleActivate(latest.id)}
              disabled={busyVersionId === latest.id}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <FiCheck size={14} /> Activar esta versión
            </button>
            <button
              type="button"
              onClick={() => handleReject(latest.id)}
              disabled={busyVersionId === latest.id}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <FiX size={14} /> Rechazar
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FiGrid size={14} /> Pestaña asignada por equipo (verificación)
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Solo lectura — a qué pestaña de la plantilla vigente se conectaría cada equipo si se generara su Business Case hoy. Úsalo para confirmar equipo por equipo que el mapeo sigue correcto tras subir una plantilla nueva.
        </p>
        <div className="mt-3">
          <EquipmentSheetMappingPanel report={sheetMappingReport} loading={loadingSheetMappingReport} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FiPackage size={14} /> Catálogo de reactivos, calibradores, controles y materiales por equipo
        </div>
        <p className="mt-1 text-xs text-slate-500">
          La plantilla activa solo define el documento interno de cada BC — este catálogo es lo que se muestra para seleccionar en la UI y vive en una tabla aparte. Compáralo contra la plantilla vigente y sincronízalo cuando corresponda.
        </p>
        <div className="mt-3">
          <CatalogDiffPanel diff={catalogDiff} loading={loadingCatalogDiff} syncing={syncingCatalog} onSync={handleSyncCatalog} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FiPackage size={14} /> Catálogo de inversiones adicionales
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Igual que el catálogo de equipos: las inversiones seleccionables en la UI viven en una tabla aparte. Si la hoja "BC" agregó o quitó filas en "Inversiones Adicionales", sincronízalas aquí.
        </p>
        <div className="mt-3">
          <InvestmentDiffPanel diff={investmentDiff} loading={loadingInvestmentDiff} syncing={syncingInvestments} onSync={handleSyncInvestments} />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Historial</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : (
          <div className="space-y-2">
            {(status?.history || []).map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <FiFileText className="shrink-0 text-slate-400" size={14} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{version.filename}</p>
                    <p className="text-xs text-slate-400">{formatTimestamp(version.uploaded_at)} · {version.uploaded_by_name}</p>
                  </div>
                </div>
                {STATUS_BADGES[version.status] ? (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGES[version.status].className}`}>
                    {STATUS_BADGES[version.status].label}
                  </span>
                ) : null}
              </div>
            ))}
            {!loading && !(status?.history || []).length ? (
              <p className="text-sm text-slate-500">Sin historial todavía.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
