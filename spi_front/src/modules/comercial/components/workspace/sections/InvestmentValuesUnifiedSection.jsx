import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FiAlertCircle, FiCheckCircle, FiChevronDown, FiChevronRight, FiClock, FiLayers, FiMail, FiPaperclip, FiPercent, FiRefreshCw, FiSave, FiTrash2, FiUpload, FiUserPlus } from "react-icons/fi";
import api from "../../../../../core/api";
import { useAuth } from "../../../../../core/auth/AuthContext";
import { useUI } from "../../../../../core/ui/UIContext";
import SectionEditorBadge from "../SectionEditorBadge";
import TiAssetReservationPanel from "./TiAssetReservationPanel";
import { listAllTiAssetReservations } from "../../../../../core/api/bcInvestmentTiAssetsApi";

// Roles de valores por clase: gestionan cotizaciones, cierre sin inversiones y
// sincronizacion con la hoja. Ya NO definen quien registra precios.
const OPERATIONAL_ROLES = new Set(["jefe_operaciones", "jefe_de_operaciones", "jefe_ti"]);
const FINANCIAL_ROLES = new Set(["jefe_financiero", "jefe_ti"]);
// Solo jefe_financiero registra el precio unitario de la inversion y la depreciacion;
// el resto de roles los ve en solo lectura. El backend aplica la misma regla.
const PRICE_EDITOR_ROLES = new Set(["jefe_financiero"]);

const money = (value) =>
  Number(value || 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const calculateFinancialDepreciation = (unitPrice, percentage, projectedMonths) => {
  const base = Number(unitPrice);
  const rate = Number(percentage);
  const months = Number(projectedMonths);
  if (!Number.isFinite(base) || base < 0) return { annual: 0, monthly: 0, projected: 0, net: 0 };
  const annual = base * ((Number.isFinite(rate) && rate >= 0 ? rate : 0) / 100);
  const monthly = annual / 12;
  const projected = monthly * (Number.isFinite(months) && months > 0 ? months : 0);
  return { annual, monthly, projected, net: Math.max(0, base - projected) };
};

function PricingContextHeader({ context = {} }) {
  const primary = Array.isArray(context.primary_equipment_names) ? context.primary_equipment_names : [];
  const backup = Array.isArray(context.backup_equipment_names) ? context.backup_equipment_names : [];
  const formatMonths = (value) => (value == null || value === "" ? "No registrado" : `${value} meses`);
  const equipmentText = (items) => (items.length ? items.join(", ") : "No registrado");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <FiLayers size={17} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">Contexto de la cotizacion</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Una sola vista evita que operaciones y financiero trabajen sobre datos distintos.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Plazo", formatMonths(context.deadline_months)],
          ["Proyeccion de plazo", formatMonths(context.projected_deadline_months)],
          ["Equipo principal", equipmentText(primary)],
          ["Equipo backup", equipmentText(backup)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Cotizaciones (archivos) de un item: el cotizador asignado las sube y
// jefe_financiero las revisa para registrar el valor.
function QuotationFilesPanel({ bcId, item, canUpload, showToast, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const files = Array.isArray(item.quotation_files) ? item.quotation_files : [];

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/business-case/${bcId}/investments/values/${item.catalog_id}/quotation-files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      showToast("Cotización subida. Se notificó a Jefe Financiero para registrar el valor.", "success");
      await onChanged();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo subir la cotización", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (file) => {
    if (!window.confirm(`¿Quitar la cotización "${file.file_name}"?`)) return;
    try {
      setRemovingId(file.id);
      await api.delete(`/business-case/${bcId}/investments/values/quotation-files/${file.id}`);
      showToast("Cotización quitada", "success");
      await onChanged();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo quitar la cotización", "error");
    } finally {
      setRemovingId(null);
    }
  };

  if (!files.length && !canUpload) return null;

  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-800">
          <FiPaperclip size={13} />
          Cotizaciones ({files.length})
        </span>
        {canUpload && (
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 ${uploading ? "pointer-events-none opacity-60" : ""}`}>
            <FiUpload size={13} />
            {uploading ? "Subiendo..." : "Subir cotización"}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>
      {files.length ? (
        <ul className="mt-2 space-y-1.5">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2 rounded-xl border border-violet-100 bg-white px-3 py-1.5">
              <a
                href={file.drive_url || "#"}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-xs font-semibold text-violet-700 hover:underline"
                title={file.file_name}
              >
                {file.file_name}
              </a>
              <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
                {file.uploaded_by_email || ""}
                {file.uploaded_at ? ` · ${new Date(file.uploaded_at).toLocaleDateString("es-EC")}` : ""}
                {canUpload && (
                  <button
                    type="button"
                    onClick={() => handleRemove(file)}
                    disabled={removingId === file.id}
                    title="Quitar cotización"
                    className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <FiTrash2 size={12} />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-violet-700/80">
          Sube aquí la(s) cotización(es) del proveedor (PDF, imagen, Excel o Word). Jefe Financiero las revisará y registrará el valor.
        </p>
      )}
    </div>
  );
}

function mergeInvestmentRows(operationalRows = [], financialRows = []) {
  const rowsById = new Map();
  operationalRows.forEach((row) => {
    rowsById.set(Number(row.catalog_id), {
      ...row,
      operational_unit_price: row.unit_price ?? null,
      financial_unit_price: null,
    });
  });
  financialRows.forEach((row) => {
    const id = Number(row.catalog_id);
    const current = rowsById.get(id) || { ...row, operational_unit_price: null };
    rowsById.set(id, {
      ...current,
      financial_unit_price: row.unit_price ?? null,
      depreciation_percentage: row.depreciation_percentage ?? current.depreciation_percentage ?? null,
      depreciation_annual: row.depreciation_annual ?? null,
      depreciation_monthly: row.depreciation_monthly ?? null,
      depreciation_projected: row.depreciation_projected ?? null,
      depreciated_unit_price: row.depreciated_unit_price ?? null,
    });
  });
  return Array.from(rowsById.values()).sort((left, right) => {
    // Primero los items agregados o con cantidad editada cuyo precio falta revisar.
    const pendingDiff = Number(Boolean(right.price_review_pending_at)) - Number(Boolean(left.price_review_pending_at));
    if (pendingDiff) return pendingDiff;
    const leftOrder = Number.isFinite(Number(left.display_order)) ? Number(left.display_order) : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(Number(right.display_order)) ? Number(right.display_order) : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.name || "").localeCompare(String(right.name || ""), "es");
  });
}

const InvestmentValuesUnifiedSection = ({
  permissions = {},
  operationalOwnership = {},
  financialOwnership = {},
  onSave = () => {},
}) => {
  const { id: bcId } = useParams();
  const { user } = useAuth();
  const { showToast } = useUI();
  const [items, setItems] = useState([]);
  const [pricingContext, setPricingContext] = useState(null);
  const [tiAssetCountsByCatalogId, setTiAssetCountsByCatalogId] = useState({});
  const [syncStatus, setSyncStatus] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [assigneeDrafts, setAssigneeDrafts] = useState({});
  const [dirtyMap, setDirtyMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [closingWithoutItems, setClosingWithoutItems] = useState(false);
  const [assignmentSavingId, setAssignmentSavingId] = useState(null);
  const [quotationRequestingId, setQuotationRequestingId] = useState(null);
  // Override manual de abierto/cerrado por item; sin override, abierto solo si esta pendiente.
  const [expandedMap, setExpandedMap] = useState({});
  // Estado de la ultima sincronizacion con la hoja tras guardar: { status, at }.
  const [lastSync, setLastSync] = useState(null);
  const dirtyRef = useRef({});
  const revRef = useRef({});
  const saveFailedRef = useRef(false);
  const saveRef = useRef(null);
  const itemsRef = useRef([]);
  const draftsRef = useRef({});

  const role = String(user?.role || user?.scope || user?.role_name || "").toLowerCase();
  const canEditAssignedQuotation = Boolean(permissions.canEditAssignedInvestmentValues);
  const canManageQuotations = OPERATIONAL_ROLES.has(role) || FINANCIAL_ROLES.has(role);
  // El cotizador asignado solo sube cotizaciones (QuotationFilesPanel); los
  // precios los registran unicamente los roles de valores.
  const sectionEditable = permissions.canEdit !== false;
  const isPriceEditor = PRICE_EDITOR_ROLES.has(role) && sectionEditable;
  // El precio operativo se elimino (2026-10): solo existe el precio unitario de la inversion.
  const canEditFinancial = isPriceEditor && financialOwnership?.canUserEdit !== false;
  const canEditAny = canEditFinancial;
  // Acciones que no son precios (cerrar sin inversiones, sincronizar hoja): roles de valores, como antes.
  const canManageValues = sectionEditable && (
    (OPERATIONAL_ROLES.has(role) && operationalOwnership?.canUserEdit !== false) ||
    (FINANCIAL_ROLES.has(role) && financialOwnership?.canUserEdit !== false)
  );

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!bcId) return;
    try {
      if (!silent) setLoading(true);
      const [financialRes, assigneesRes, tiReservations] = await Promise.all([
        api.get(`/business-case/${bcId}/investments/values`, { params: { class: "financiera" } }),
        canManageQuotations
          ? api.get(`/business-case/${bcId}/investments/values/assignees`)
          : Promise.resolve(null),
        listAllTiAssetReservations(bcId).catch(() => []),
      ]);
      const countsByCatalogId = {};
      (Array.isArray(tiReservations) ? tiReservations : []).forEach((reservation) => {
        const key = String(reservation.catalog_id);
        countsByCatalogId[key] = (countsByCatalogId[key] || 0) + 1;
      });
      setTiAssetCountsByCatalogId(countsByCatalogId);
      const financialPayload = financialRes?.data?.data || {};
      // Recargar (asignar responsable, subir cotizacion, etc.) no debe pisar
      // precios editados y aun sin guardar: se conservan los campos sucios.
      const localById = new Map(itemsRef.current.map((row) => [Number(row.catalog_id), row]));
      const dirty = dirtyRef.current;
      const merged = mergeInvestmentRows([], financialPayload.items || []).map((row) => {
        const local = localById.get(Number(row.catalog_id));
        if (!local) return row;
        const next = { ...row };
        if (dirty[`${row.catalog_id}:financiera`]) {
          next.financial_unit_price = local.financial_unit_price;
          next.depreciation_percentage = local.depreciation_percentage;
        }
        return next;
      });
      setItems(merged);
      setPricingContext(financialPayload.pricing_context || null);
      setSyncStatus({ financial: financialPayload.sync_status || null });
      setAssignees(Array.isArray(assigneesRes?.data?.data) ? assigneesRes.data.data : []);
      setAssigneeDrafts(Object.fromEntries(merged.map((item) => {
        const key = String(item.catalog_id);
        const saved = item.quotation_assignee_id ? String(item.quotation_assignee_id) : "";
        // Se respeta una seleccion de responsable que aun no se asigno.
        return [key, draftsRef.current[key] ?? saved];
      })));
      setDirtyMap((current) => Object.fromEntries(Object.entries(current).filter(([key]) => dirty[key])));
    } catch (error) {
      console.error("Error loading unified investment values", error);
      showToast("No se pudieron cargar los precios de inversiones", "error");
    } finally {
      setLoading(false);
    }
  }, [bcId, canManageQuotations, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const markDirty = (catalogId, className) => {
    const key = `${catalogId}:${className}`;
    revRef.current[key] = (revRef.current[key] || 0) + 1;
    saveFailedRef.current = false;
    setDirtyMap((current) => ({ ...current, [key]: true }));
  };

  const updateField = (catalogId, field, value, className) => {
    setItems((current) => current.map((row) => (
      Number(row.catalog_id) === Number(catalogId) ? { ...row, [field]: value } : row
    )));
    markDirty(catalogId, className);
  };

  const handleSave = async () => {
    if (!canEditAny || !bcId) return;
    const financialValues = items
      .filter((row) => dirtyMap[`${row.catalog_id}:financiera`] && canEditFinancial)
      .map((row) => ({
        catalog_id: row.catalog_id,
        unit_price: row.financial_unit_price ?? null,
        depreciation_percentage: row.depreciation_percentage ?? null,
      }));

    if (!financialValues.length) return;

    const savedKeys = financialValues.map((v) => `${v.catalog_id}:financiera`);
    const revSnapshot = Object.fromEntries(savedKeys.map((k) => [k, revRef.current[k]]));

    try {
      setSaving(true);
      const responses = [
        await api.post(`/business-case/${bcId}/investments/values`, { class: "financiera", values: financialValues }),
      ];
      const syncs = responses.map((res) => res?.data?.data?.sheet_sync).filter(Boolean);
      const failed = syncs.find((sync) => sync.synced === false && sync.reason !== "no_sheet");
      if (failed) {
        setLastSync({ status: "error", at: new Date() });
        showToast(`Precios guardados, pero no se pudo sincronizar con la hoja: ${failed.error || "error desconocido"}`, "error");
      } else if (syncs.length && syncs.every((sync) => sync.reason === "no_sheet")) {
        setLastSync({ status: "no_sheet", at: new Date() });
      } else {
        setLastSync({ status: "ok", at: new Date() });
      }

      // Solo se limpia lo que no volvio a editarse mientras guardaba.
      const remaining = Object.keys(dirtyRef.current).filter(
        (key) => !(savedKeys.includes(key) && revRef.current[key] === revSnapshot[key]),
      );
      dirtyRef.current = Object.fromEntries(remaining.map((key) => [key, true]));
      setDirtyMap(dirtyRef.current);
      // Recarga silenciosa solo si no hay ediciones nuevas que pisar.
      if (!remaining.length) await load({ silent: true });
    } catch (error) {
      saveFailedRef.current = true;
      setLastSync({ status: "error", at: new Date() });
      showToast(error?.response?.data?.message || "No se pudieron guardar los precios", "error");
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = handleSave;
  dirtyRef.current = dirtyMap;
  itemsRef.current = items;
  draftsRef.current = assigneeDrafts;

  // Autoguardado: tras 1,2 s sin editar se guardan los cambios y el backend
  // sincroniza la hoja. Si falla, no reintenta hasta la siguiente edicion.
  useEffect(() => {
    if (!canEditAny || saving || saveFailedRef.current || !Object.keys(dirtyMap).length) return undefined;
    const timer = setTimeout(() => saveRef.current?.(), 1200);
    return () => clearTimeout(timer);
  }, [dirtyMap, items, saving, canEditAny]);

  // Sincronizacion manual: pasa los precios GUARDADOS a la hoja BC (Precio =
  // valor residual unitario, Total = cantidad x precio) con respaldo previo.
  const handleSyncSheet = async () => {
    if (!bcId) return;
    try {
      setSyncingSheet(true);
      const response = await api.post(`/business-case/${bcId}/investments/values/sync-sheet`);
      const backupName = response?.data?.data?.backup?.name;
      showToast(
        backupName ? `Precios sincronizados con la hoja. Respaldo: ${backupName}` : "Precios sincronizados con la hoja",
        "success",
      );
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo sincronizar con la hoja", "error");
    } finally {
      setSyncingSheet(false);
    }
  };

  const getActionClass = () => (FINANCIAL_ROLES.has(role) ? "financiera" : "operativa");

  const handleAssignQuotation = async (item) => {
    const assigneeId = assigneeDrafts[String(item.catalog_id)] || null;
    try {
      setAssignmentSavingId(item.catalog_id);
      await api.post(`/business-case/${bcId}/investments/values/assignment`, {
        class: getActionClass(),
        catalog_id: item.catalog_id,
        assignee_id: assigneeId,
      });
      await load({ silent: true });
      showToast(assigneeId ? "Responsable de cotizacion asignado" : "Responsable removido", "success");
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo asignar el responsable", "error");
    } finally {
      setAssignmentSavingId(null);
    }
  };

  const handleRequestQuotation = async (item) => {
    try {
      setQuotationRequestingId(item.catalog_id);
      const response = await api.post(`/business-case/${bcId}/investments/values/request-quotation`, {
        class: getActionClass(),
        catalog_id: item.catalog_id,
      });
      await load({ silent: true });
      const notification = response?.data?.data?.notification;
      showToast(
        notification?.sent === false && notification?.reason === "already_requested"
          ? "La cotizacion ya habia sido solicitada"
          : "Cotizacion solicitada al responsable",
        "success",
      );
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo solicitar la cotizacion", "error");
    } finally {
      setQuotationRequestingId(null);
    }
  };

  const dirtyCount = useMemo(() => Object.keys(dirtyMap).length, [dirtyMap]);

  // Items con precio pendiente de revisar (el backend los marca al agregar o editar cantidad).
  const pendingReviewCount = useMemo(() => items.filter((row) => row.price_review_pending_at).length, [items]);
  // Al llegar desde una notificacion (?section=investment_values) se lleva la vista al primer pendiente.
  const [searchParams] = useSearchParams();
  const openedFromLink = searchParams.get("section") === "investment_values";
  const firstPendingRef = useRef(null);
  const scrolledToPendingRef = useRef(false);
  useEffect(() => {
    if (!openedFromLink || loading || !pendingReviewCount || scrolledToPendingRef.current) return;
    scrolledToPendingRef.current = true;
    firstPendingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [openedFromLink, loading, pendingReviewCount]);
  const financialSyncPending = Boolean(syncStatus?.financial?.pending);
  const extraordinaryReopen = Boolean(
    operationalOwnership?.metadata?.extraordinary_reopen?.active ||
    financialOwnership?.metadata?.extraordinary_reopen?.active,
  );
  const closedWithoutInvestments = !extraordinaryReopen && Boolean(
    operationalOwnership?.metadata?.completion_basis === "no_additional_investments_selected" ||
    financialOwnership?.metadata?.completion_basis === "no_additional_investments_selected",
  );
  const canCloseWithoutItems = Boolean(canManageQuotations && canManageValues && !items.length && !closedWithoutInvestments);
  const totals = useMemo(() => items.reduce((acc, row) => {
    const qty = Number(row.quantity || 1);
    const depreciation = calculateFinancialDepreciation(
      row.financial_unit_price,
      row.depreciation_percentage,
      pricingContext?.projected_deadline_months,
    );
    // Lo mismo que escribe la hoja: Precio = valor residual unitario, Total = cantidad x precio.
    acc.sheetTotal += depreciation.net * qty;
    return acc;
  }, { sheetTotal: 0 }), [items, pricingContext?.projected_deadline_months]);

  const handleCloseWithoutItems = async () => {
    if (!bcId || !canCloseWithoutItems) return;
    try {
      setClosingWithoutItems(true);
      await api.post(`/business-case/${bcId}/investments/close-without-items`);
      await load();
      showToast("Precios cerrados como no aplica porque no hay inversiones adicionales", "success");
      onSave();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cerrar precios sin inversiones", "error");
    } finally {
      setClosingWithoutItems(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-3/4 rounded bg-gray-100" />
          <div className="h-3 w-1/2 rounded bg-gray-100" />
          <div className="h-3 w-5/6 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Precios de inversiones</h2>
          <p className="text-sm text-gray-500">
            Jefe Financiero registra el precio unitario y la depreciacion de cada inversion. Los cambios se guardan y se sincronizan con la hoja automaticamente.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <SectionEditorBadge ownership={financialOwnership} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirtyCount > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {dirtyCount} cambios
            </span>
          )}
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700" title="Suma de valor residual unitario x cantidad, igual al total de la hoja">
            Valor total (hoja): ${money(totals.sheetTotal)}
          </span>
          {saving ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <FiRefreshCw size={11} className="animate-spin" /> Guardando y sincronizando...
            </span>
          ) : lastSync && dirtyCount === 0 ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                lastSync.status === "ok" ? "bg-emerald-50 text-emerald-700" : lastSync.status === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {lastSync.status === "ok" && <><FiCheckCircle size={11} /> Hoja sincronizada {lastSync.at.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}</>}
              {lastSync.status === "error" && <><FiAlertCircle size={11} /> Error de sincronizacion</>}
              {lastSync.status === "no_sheet" && "Guardado (el BC aun no tiene hoja)"}
            </span>
          ) : null}
          {canEditAny && saveFailedRef.current && dirtyCount > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || dirtyCount === 0}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:bg-gray-200 disabled:text-gray-500"
            >
              <FiSave size={13} />
              {saving ? "Guardando..." : "Reintentar guardado"}
            </button>
          )}
          {canManageValues && items.length > 0 && (
            <button
              type="button"
              onClick={handleSyncSheet}
              disabled={syncingSheet || saving || dirtyCount > 0}
              title={dirtyCount > 0 ? "Guarda los cambios antes de sincronizar" : "Pasar precios guardados a la hoja de Sheets"}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-600 bg-white px-4 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 disabled:border-gray-200 disabled:text-gray-400"
            >
              <FiRefreshCw size={13} className={syncingSheet ? "animate-spin" : ""} />
              {syncingSheet ? "Sincronizando..." : "Sincronizar con Sheet"}
            </button>
          )}
        </div>
      </div>

      <PricingContextHeader context={pricingContext || {}} />

      {financialSyncPending ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <FiAlertCircle size={16} className="shrink-0" />
          <span>
            Hay inversiones sin precio unitario. Completalas para que la sincronizacion quede lista.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <FiCheckCircle size={16} className="shrink-0" />
          <span>
            Sincronizacion lista: todas las inversiones tienen precio unitario.
          </span>
        </div>
      )}

      {!items.length && (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          <p className="font-semibold text-gray-800">
            {closedWithoutInvestments ? "Precios cerrados como no aplica" : "No hay inversiones seleccionadas en este BC."}
          </p>
          <p className="mt-2">
            {closedWithoutInvestments
              ? "Inversiones adicionales y precios de inversiones ya quedaron completados sin items."
              : "Si el BC no requiere inversiones adicionales, cierra esta etapa para habilitar la continuidad del flujo."}
          </p>
          {canCloseWithoutItems && (
            <button
              type="button"
              onClick={handleCloseWithoutItems}
              disabled={closingWithoutItems}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-blue-200"
            >
              <FiCheckCircle size={16} />
              {closingWithoutItems ? "Cerrando..." : "Cerrar precios sin inversiones"}
            </button>
          )}
        </div>
      )}

      {pendingReviewCount > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <FiAlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            {pendingReviewCount === 1
              ? "1 inversion fue agregada o cambio de cantidad."
              : `${pendingReviewCount} inversiones fueron agregadas o cambiaron de cantidad.`}
            {" "}Aparecen primero y resaltadas hasta que se guarde su precio unitario.
          </span>
        </div>
      )}

      {items.length > 1 && (
        <div className="flex justify-end gap-3 text-xs font-semibold text-blue-700">
          <button type="button" className="hover:underline" onClick={() => setExpandedMap(Object.fromEntries(items.map((row) => [row.catalog_id, true])))}>
            Expandir todo
          </button>
          <button type="button" className="hover:underline" onClick={() => setExpandedMap(Object.fromEntries(items.map((row) => [row.catalog_id, false])))}>
            Colapsar todo
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="divide-y divide-gray-100">
            {items.map((item, itemIndex) => {
              const pendingReview = Boolean(item.price_review_pending_at);
              const qty = Number(item.quantity || 1);
              const reservedTiAssetCount = tiAssetCountsByCatalogId[String(item.catalog_id)] || 0;
              const coveredByTiInventory = reservedTiAssetCount > 0 && reservedTiAssetCount >= Number(item.quantity || 0);
              const depreciation = calculateFinancialDepreciation(
                item.financial_unit_price,
                item.depreciation_percentage,
                pricingContext?.projected_deadline_months,
              );
              // Pendiente = falta el precio unitario (obligatorio) o hay revision de precio abierta.
              // La depreciacion solo se detalla cuando el item tiene porcentaje.
              const hasDepreciation = Number(item.depreciation_percentage) > 0;
              const isPending = pendingReview || !(Number(item.financial_unit_price) > 0);
              const isOpen = expandedMap[item.catalog_id] ?? isPending;
              return (
                <div
                  key={item.catalog_id}
                  ref={pendingReview && itemIndex === 0 ? firstPendingRef : undefined}
                  className={pendingReview ? "border-l-4 border-amber-400 bg-amber-50/60" : ""}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedMap((current) => ({ ...current, [item.catalog_id]: !isOpen }))}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                  >
                    {isOpen ? <FiChevronDown size={16} className="shrink-0 text-gray-400" /> : <FiChevronRight size={16} className="shrink-0 text-gray-400" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{item.name}</span>
                    <span className="hidden shrink-0 text-xs text-gray-500 sm:inline">Cant. {item.quantity ?? "-"}</span>
                    {!isOpen && (
                      <span className="hidden shrink-0 text-xs text-gray-500 md:inline">
                        Unitario ${money(item.financial_unit_price)} · Total ${money(depreciation.net * qty)}
                      </span>
                    )}
                    {dirtyMap[`${item.catalog_id}:financiera`] ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                        <FiClock size={11} /> Sin guardar
                      </span>
                    ) : null}
                    {isPending ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                        <FiAlertCircle size={11} /> Pendiente
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        <FiCheckCircle size={11} /> Completo
                      </span>
                    )}
                  </button>
                  {isOpen && (
                  <div className="space-y-4 px-4 pb-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      {pendingReview && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                            <FiAlertCircle size={11} />
                            Revisar precio{item.price_review_note ? ` · ${item.price_review_note}` : ""}
                          </span>
                          {canEditFinancial && item.financial_unit_price != null && !dirtyMap[`${item.catalog_id}:financiera`] && (
                            <button
                              type="button"
                              onClick={() => markDirty(item.catalog_id, "financiera")}
                              className="text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-950"
                            >
                              El precio actual es correcto
                            </button>
                          )}
                          {dirtyMap[`${item.catalog_id}:financiera`] && (
                            <span className="text-xs text-amber-700">Se marcara como revisado al guardar</span>
                          )}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-gray-500">
                        Cantidad: {item.quantity ?? "-"}
                        {item.characteristics ? ` · ${item.characteristics}` : ""}
                      </div>
                      {item.notes && <div className="mt-1 text-xs text-gray-400">Obs: {item.notes}</div>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.quotation_assignee_name ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                          <FiUserPlus size={11} />
                          Cotiza: {item.quotation_assignee_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Sin responsable de cotizacion</span>
                      )}
                      {item.quotation_status === "requested" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          <FiMail size={11} />
                          Cotizacion solicitada
                        </span>
                      )}
                      {item.quotation_status === "received" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
                          <FiPaperclip size={11} />
                          Cotizacion recibida
                        </span>
                      )}
                      {coveredByTiInventory && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
                          <FiCheckCircle size={11} />
                          Cubierto con inventario TI ({reservedTiAssetCount}/{item.quantity})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vinculacion de activos TI: solo jefe_ti la ve; para el resto es ruido visual. */}
                  {role === "jefe_ti" && (
                    <TiAssetReservationPanel
                      bcId={bcId}
                      catalogId={item.catalog_id}
                      quantity={item.quantity}
                      showToast={showToast}
                      canManage
                    />
                  )}

                  {!coveredByTiInventory && (
                    <QuotationFilesPanel
                      bcId={bcId}
                      item={item}
                      canUpload={canManageQuotations || canEditAssignedQuotation}
                      showToast={showToast}
                      onChanged={() => load({ silent: true })}
                    />
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-gray-500">Precio unitario de la inversion ($)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.financial_unit_price ?? ""}
                        onChange={(event) => updateField(item.catalog_id, "financial_unit_price", event.target.value === "" ? null : Number(event.target.value), "financiera")}
                        disabled={!canEditFinancial || saving}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-gray-500">Depreciacion (%)</span>
                      <div className="relative">
                        <FiPercent size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={item.depreciation_percentage ?? ""}
                          onChange={(event) => updateField(item.catalog_id, "depreciation_percentage", event.target.value === "" ? null : Number(event.target.value), "financiera")}
                          disabled={!canEditFinancial || saving}
                          className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                        />
                      </div>
                    </label>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                      <div className="text-xs font-semibold text-gray-500">Valor residual unitario</div>
                      <div className="mt-1 font-semibold text-gray-900">${money(depreciation.net)}</div>
                      <div className="mt-1 text-[11px] font-medium text-gray-500">
                        {hasDepreciation ? "Precio unitario menos depreciacion proyectada" : "Sin depreciacion: igual al precio unitario"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
                      <div className="text-xs font-semibold text-blue-700">Valor total (hoja)</div>
                      <div className="mt-1 font-semibold text-gray-900">${money(depreciation.net * qty)}</div>
                      <div className="mt-1 text-[11px] font-medium text-gray-500">
                        ${money(depreciation.net)} x {qty}
                      </div>
                    </div>
                  </div>

                  {hasDepreciation && (
                    <div className="grid grid-cols-1 gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs text-emerald-800 sm:grid-cols-2 xl:grid-cols-5">
                      <span>Depreciacion del proceso: <strong>${money(depreciation.projected * qty)}</strong>{qty > 1 ? ` (${money(depreciation.projected)} x ${qty})` : ""}</span>
                      <span>Depreciacion anual: <strong>${money(depreciation.annual)}</strong></span>
                      <span>Depreciacion mensual: <strong>${money(depreciation.monthly)}</strong></span>
                      <span>Depreciacion proyectada: <strong>${money(depreciation.projected)}</strong></span>
                      <span>Proyeccion: <strong>{pricingContext?.projected_deadline_months || 0} meses</strong></span>
                    </div>
                  )}

                  {coveredByTiInventory && (
                    <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                      Este item ya esta cubierto con {reservedTiAssetCount} activo(s) de inventario TI reservados — no requiere cotizacion.
                    </p>
                  )}

                  {canManageQuotations && !coveredByTiInventory && (
                    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-gray-500">Responsable de cotizacion</span>
                        <select
                          value={assigneeDrafts[String(item.catalog_id)] ?? ""}
                          onChange={(event) => setAssigneeDrafts((current) => ({ ...current, [String(item.catalog_id)]: event.target.value }))}
                          disabled={saving || assignmentSavingId === item.catalog_id || quotationRequestingId === item.catalog_id}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                        >
                          <option value="">Selecciona un usuario</option>
                          {assignees.map((assignee) => (
                            <option key={assignee.id} value={assignee.id}>
                              {assignee.name} - {assignee.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => handleAssignQuotation(item)}
                          disabled={saving || assignmentSavingId === item.catalog_id || !assigneeDrafts[String(item.catalog_id)]}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FiUserPlus size={14} />
                          {assignmentSavingId === item.catalog_id ? "Asignando..." : "Asignar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestQuotation(item)}
                          disabled={saving || quotationRequestingId === item.catalog_id || !item.quotation_assignee_id || ["requested", "received"].includes(item.quotation_status)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                        >
                          <FiMail size={14} />
                          {quotationRequestingId === item.catalog_id ? "Solicitando..." : "Solicitar cotizacion"}
                        </button>
                      </div>
                    </div>
                  )}

                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestmentValuesUnifiedSection;
