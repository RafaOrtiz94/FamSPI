import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FiAlertCircle, FiCheckCircle, FiClock, FiLayers, FiMail, FiPercent, FiSave, FiUserPlus } from "react-icons/fi";
import api from "../../../../../core/api";
import { useAuth } from "../../../../../core/auth/AuthContext";
import { useUI } from "../../../../../core/ui/UIContext";
import SectionEditorBadge from "../SectionEditorBadge";

const OPERATIONAL_ROLES = new Set(["jefe_operaciones", "jefe_de_operaciones"]);
const FINANCIAL_ROLES = new Set(["jefe_financiero"]);

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
  const [syncStatus, setSyncStatus] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [assigneeDrafts, setAssigneeDrafts] = useState({});
  const [dirtyMap, setDirtyMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closingWithoutItems, setClosingWithoutItems] = useState(false);
  const [assignmentSavingId, setAssignmentSavingId] = useState(null);
  const [quotationRequestingId, setQuotationRequestingId] = useState(null);

  const role = String(user?.role || user?.scope || user?.role_name || "").toLowerCase();
  const canEditOperational =
    OPERATIONAL_ROLES.has(role) && permissions.canEdit !== false && operationalOwnership?.canUserEdit !== false;
  const canEditFinancial =
    FINANCIAL_ROLES.has(role) && permissions.canEdit !== false && financialOwnership?.canUserEdit !== false;
  const canEditAny = canEditOperational || canEditFinancial;

  const load = useCallback(async () => {
    if (!bcId) return;
    try {
      setLoading(true);
      const [operationalRes, financialRes, assigneesRes] = await Promise.all([
        api.get(`/business-case/${bcId}/investments/values`, { params: { class: "operativa" } }),
        api.get(`/business-case/${bcId}/investments/values`, { params: { class: "financiera" } }),
        api.get(`/business-case/${bcId}/investments/values/assignees`),
      ]);
      const operationalPayload = operationalRes?.data?.data || {};
      const financialPayload = financialRes?.data?.data || {};
      const merged = mergeInvestmentRows(operationalPayload.items || [], financialPayload.items || []);
      setItems(merged);
      setPricingContext(financialPayload.pricing_context || operationalPayload.pricing_context || null);
      setSyncStatus({
        operational: operationalPayload.sync_status || null,
        financial: financialPayload.sync_status || null,
      });
      setAssignees(Array.isArray(assigneesRes?.data?.data) ? assigneesRes.data.data : []);
      setAssigneeDrafts(Object.fromEntries(merged.map((item) => [
        String(item.catalog_id),
        item.quotation_assignee_id ? String(item.quotation_assignee_id) : "",
      ])));
      setDirtyMap({});
    } catch (error) {
      console.error("Error loading unified investment values", error);
      showToast("No se pudieron cargar los precios de inversiones", "error");
    } finally {
      setLoading(false);
    }
  }, [bcId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const markDirty = (catalogId, className) => {
    setDirtyMap((current) => ({ ...current, [`${catalogId}:${className}`]: true }));
  };

  const updateField = (catalogId, field, value, className) => {
    setItems((current) => current.map((row) => (
      Number(row.catalog_id) === Number(catalogId) ? { ...row, [field]: value } : row
    )));
    markDirty(catalogId, className);
  };

  const handleSave = async () => {
    if (!canEditAny || !bcId) return;
    const operationalValues = items
      .filter((row) => dirtyMap[`${row.catalog_id}:operativa`] && canEditOperational)
      .map((row) => ({ catalog_id: row.catalog_id, unit_price: row.operational_unit_price ?? null }));
    const financialValues = items
      .filter((row) => dirtyMap[`${row.catalog_id}:financiera`] && canEditFinancial)
      .map((row) => ({
        catalog_id: row.catalog_id,
        unit_price: row.financial_unit_price ?? null,
        depreciation_percentage: row.depreciation_percentage ?? null,
      }));

    if (!operationalValues.length && !financialValues.length) {
      showToast("No hay cambios pendientes para tu rol", "info");
      return;
    }

    try {
      setSaving(true);
      const requests = [];
      if (operationalValues.length) {
        requests.push(api.post(`/business-case/${bcId}/investments/values`, { class: "operativa", values: operationalValues }));
      }
      if (financialValues.length) {
        requests.push(api.post(`/business-case/${bcId}/investments/values`, { class: "financiera", values: financialValues }));
      }
      await Promise.all(requests);
      await load();
      showToast("Precios guardados y sincronizacion de Sheet iniciada", "success");
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudieron guardar los precios", "error");
    } finally {
      setSaving(false);
    }
  };

  const getActionClass = () => (canEditFinancial ? "financiera" : "operativa");

  const handleAssignQuotation = async (item) => {
    const assigneeId = assigneeDrafts[String(item.catalog_id)] || null;
    try {
      setAssignmentSavingId(item.catalog_id);
      await api.post(`/business-case/${bcId}/investments/values/assignment`, {
        class: getActionClass(),
        catalog_id: item.catalog_id,
        assignee_id: assigneeId,
      });
      await load();
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
      await load();
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
  const financialSyncPending = Boolean(syncStatus?.financial?.pending);
  const operationalSyncPending = Boolean(syncStatus?.operational?.pending);
  const closedWithoutInvestments = Boolean(
    operationalOwnership?.metadata?.completion_basis === "no_additional_investments_selected" ||
    financialOwnership?.metadata?.completion_basis === "no_additional_investments_selected",
  );
  const canCloseWithoutItems = Boolean(canEditAny && !items.length && !closedWithoutInvestments);
  const totals = useMemo(() => items.reduce((acc, row) => {
    const qty = Number(row.quantity || 1);
    const op = Number(row.operational_unit_price || 0);
    const depreciation = calculateFinancialDepreciation(
      row.financial_unit_price,
      row.depreciation_percentage,
      pricingContext?.projected_deadline_months,
    );
    acc.operational += op * qty;
    acc.financial += depreciation.projected * qty;
    return acc;
  }, { operational: 0, financial: 0 }), [items, pricingContext?.projected_deadline_months]);

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
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Precios financieros y operativos</h2>
          <p className="text-sm text-gray-500">
            Una sola seccion para evitar reescrituras: operaciones registra precio operativo y financiero registra precio financiero/depreciacion.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <SectionEditorBadge ownership={operationalOwnership} />
            <SectionEditorBadge ownership={financialOwnership} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirtyCount > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {dirtyCount} cambios
            </span>
          )}
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Operativo: ${money(totals.operational)}
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Financiero: ${money(totals.financial)}
          </span>
          {canEditAny && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || dirtyCount === 0}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:bg-gray-200 disabled:text-gray-500"
            >
              <FiSave size={13} />
              {saving ? "Guardando..." : "Guardar precios"}
            </button>
          )}
        </div>
      </div>

      <PricingContextHeader context={pricingContext || {}} />

      {financialSyncPending ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <FiAlertCircle size={16} className="shrink-0" />
          <span>
            Hay precios financieros pendientes por completar antes de que la sincronizacion quede completa.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <FiCheckCircle size={16} className="shrink-0" />
          <span>
            Sincronizacion financiera lista. Los valores operativos pendientes son opcionales segun aplique.
          </span>
        </div>
      )}

      {!financialSyncPending && operationalSyncPending && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <FiAlertCircle size={16} className="shrink-0" />
          <span>
            Existen valores operativos sin registrar, pero no bloquean la sincronizacion financiera de este proceso.
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
              ? "Inversiones adicionales, precios operativos y precios financieros ya quedaron completados sin items."
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

      {items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const qty = Number(item.quantity || 1);
              const depreciation = calculateFinancialDepreciation(
                item.financial_unit_price,
                item.depreciation_percentage,
                pricingContext?.projected_deadline_months,
              );
              return (
                <div key={item.catalog_id} className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">{item.name}</div>
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
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-gray-500">Precio operativo ($)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.operational_unit_price ?? ""}
                        onChange={(event) => updateField(item.catalog_id, "operational_unit_price", event.target.value === "" ? null : Number(event.target.value), "operativa")}
                        disabled={!canEditOperational || saving}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-gray-500">Precio financiero base ($)</span>
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
                      <div className="text-xs font-semibold text-gray-500">Depreciacion del proceso</div>
                      <div className="mt-1 font-semibold text-gray-900">${money(depreciation.projected * qty)}</div>
                      {qty > 1 && (
                        <div className="mt-1 text-[11px] font-medium text-gray-500">
                          ${money(depreciation.projected)} x {qty}
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                      <div className="text-xs font-semibold text-gray-500">Subtotal operativo</div>
                      <div className="mt-1 font-semibold text-gray-900">${money(Number(item.operational_unit_price || 0) * qty)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs text-emerald-800 sm:grid-cols-2 xl:grid-cols-5">
                    <span>Depreciacion anual: <strong>${money(depreciation.annual)}</strong></span>
                    <span>Depreciacion mensual: <strong>${money(depreciation.monthly)}</strong></span>
                    <span>Depreciacion proyectada: <strong>${money(depreciation.projected)}</strong></span>
                    <span>Proyeccion: <strong>{pricingContext?.projected_deadline_months || 0} meses</strong></span>
                    <span>Valor residual unitario: <strong>${money(depreciation.net)}</strong></span>
                  </div>

                  {canEditAny && (
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
                          disabled={saving || quotationRequestingId === item.catalog_id || !item.quotation_assignee_id || item.quotation_status === "requested"}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                        >
                          <FiMail size={14} />
                          {quotationRequestingId === item.catalog_id ? "Solicitando..." : "Solicitar cotizacion"}
                        </button>
                      </div>
                    </div>
                  )}

                  {dirtyMap[`${item.catalog_id}:operativa`] || dirtyMap[`${item.catalog_id}:financiera`] ? (
                    <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                      <FiClock size={11} />
                      Cambios pendientes
                    </div>
                  ) : null}
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
