import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiClock, FiLayers, FiMail, FiPercent, FiSave, FiUserPlus } from "react-icons/fi";
import api from "../../../../../core/api";
import { useParams } from "react-router-dom";
import { useUI } from "../../../../../core/ui/UIContext";
import { useAuth } from "../../../../../core/auth/AuthContext";
import SectionEditorBadge from "../SectionEditorBadge";

const EDITOR_ROLES = {
  operativa: new Set(["jefe_operaciones", "jefe_de_operaciones"]),
  financiera: new Set(["jefe_financiero"]),
};

const CLASS_LABELS = {
  operativa: "Operativas",
  financiera: "Financieras",
};

const calculateFinancialDepreciation = (unitPrice, percentage, projectedMonths) => {
  const base = Number(unitPrice);
  const rate = Number(percentage);
  const months = Number(projectedMonths);
  if (!Number.isFinite(base) || base < 0) {
    return { annual: 0, monthly: 0, projected: 0, net: 0 };
  }
  const annual = base * ((Number.isFinite(rate) && rate >= 0 ? rate : 0) / 100);
  const monthly = annual / 12;
  const projected = monthly * (Number.isFinite(months) && months > 0 ? months : 0);
  return {
    annual,
    monthly,
    projected,
    net: Math.max(0, base - projected),
  };
};

const getNaturalErrorMessage = (err, fallback) => {
 const status = Number(err?.response?.status || 0);
 const raw = String(err?.response?.data?.message || "").trim();
  if (status === 403) return "No tienes permiso para editar esta sección.";
  if (status === 409) return "La información cambió mientras trabajabas. Recarga la sección e inténtalo nuevamente.";
  if (!raw) return fallback;
  if (/\b(4\d\d|5\d\d)\b/.test(raw) || /forbidden|conflict|unauthorized|status/i.test(raw)) return fallback;
  return raw;
};

function PricingContextHeader({ context = {} }) {
  const primary = Array.isArray(context.primary_equipment_names) ? context.primary_equipment_names : [];
  const backup = Array.isArray(context.backup_equipment_names) ? context.backup_equipment_names : [];
  const formatMonths = (value) => value == null || value === "" ? "No registrado" : `${value} meses`;
  const equipmentText = (items) => items.length ? items.join(", ") : "No registrado";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <FiLayers size={17} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">Contexto de la cotizacion</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Esta informacion acompana cada solicitud de precio para que el responsable cotice con el contexto completo del Business Case.
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

const InvestmentValuesSection = ({ investmentClass, permissions = {}, ownership = {} }) => {
  const { id: bcId } = useParams();
  const { showToast } = useUI();
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyMap, setDirtyMap] = useState({});
  const [syncStatus, setSyncStatus] = useState(null);
  const [pricingContext, setPricingContext] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [assigneeDrafts, setAssigneeDrafts] = useState({});
  const [assignmentSavingId, setAssignmentSavingId] = useState(null);
  const [quotationRequestingId, setQuotationRequestingId] = useState(null);

  const role = (user?.role || user?.scope || user?.role_name || "").toLowerCase();
  const isEditor = EDITOR_ROLES[investmentClass]?.has(role) ?? false;
  // Precios en tiempo real, sin carrito ni cierre: solo bloquea si la
  // seccion fue bloqueada por otra via generica.
  const canEdit = isEditor && permissions.canEdit !== false && ownership?.canUserEdit !== false;

  const load = useCallback(async () => {
    if (!bcId) return;
    try {
      setLoading(true);
      const [res, assigneesRes] = await Promise.all([
        api.get(`/business-case/${bcId}/investments/values`, {
          params: { class: investmentClass },
        }),
        api.get(`/business-case/${bcId}/investments/values/assignees`),
      ]);
      const payload = res?.data?.data || {};
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setSyncStatus(payload.sync_status || null);
      setPricingContext(payload.pricing_context || null);
      setAssignees(Array.isArray(assigneesRes?.data?.data) ? assigneesRes.data.data : []);
      setAssigneeDrafts(Object.fromEntries(
        (Array.isArray(payload.items) ? payload.items : []).map((item) => [
          String(item.catalog_id),
          item.quotation_assignee_id ? String(item.quotation_assignee_id) : "",
        ]),
      ));
      setDirtyMap({});
    } catch (err) {
      console.error("Error loading investment values", err);
      showToast("No se pudieron cargar los valores de inversión", "error");
    } finally {
      setLoading(false);
    }
  }, [bcId, investmentClass, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const updatePrice = (catalogId, value) => {
    setItems((prev) =>
      prev.map((row) =>
        row.catalog_id === catalogId ? { ...row, unit_price: value } : row
      )
    );
    setDirtyMap((prev) => ({ ...prev, [catalogId]: true }));
  };

  const updateDepreciation = (catalogId, value) => {
    setItems((prev) =>
      prev.map((row) =>
        row.catalog_id === catalogId ? { ...row, depreciation_percentage: value } : row
      )
    );
    setDirtyMap((prev) => ({ ...prev, [catalogId]: true }));
  };

  const handleSave = async () => {
    if (!canEdit || !bcId) return;
    const dirtyItems = items.filter((row) => dirtyMap[row.catalog_id]);
    if (!dirtyItems.length) {
      showToast("No hay cambios pendientes", "info");
      return;
    }

    try {
      setSaving(true);
      const response = await api.post(`/business-case/${bcId}/investments/values`, {
        class: investmentClass,
        values: dirtyItems.map((row) => ({
          catalog_id: row.catalog_id,
          unit_price: row.unit_price ?? null,
          ...(investmentClass === "financiera" ? { depreciation_percentage: row.depreciation_percentage ?? null } : {}),
        })),
      });
      const syncInfo = response?.data?.data?.sheet_sync;
      await load();
      setDirtyMap({});
      if (syncInfo?.queued === false) {
        showToast("Valores guardados. La sincronización del sheet no se pudo iniciar automáticamente.", "warning");
      } else if (investmentClass === "operativa" || investmentClass === "financiera") {
        showToast(`Valores ${CLASS_LABELS[investmentClass].toLowerCase()} guardados y sincronización iniciada`, "success");
      } else {
        showToast(`Valores ${CLASS_LABELS[investmentClass].toLowerCase()} guardados`, "success");
      }
    } catch (err) {
      showToast(
        getNaturalErrorMessage(err, "No se pudieron guardar los valores"),
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAssignQuotation = async (item) => {
    const assigneeId = assigneeDrafts[String(item.catalog_id)] || null;
    try {
      setAssignmentSavingId(item.catalog_id);
      await api.post(`/business-case/${bcId}/investments/values/assignment`, {
        class: investmentClass,
        catalog_id: item.catalog_id,
        assignee_id: assigneeId,
      });
      await load();
      showToast(assigneeId ? "Responsable de cotizacion asignado" : "Responsable de cotizacion removido", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo asignar el responsable", "error");
    } finally {
      setAssignmentSavingId(null);
    }
  };

  const handleRequestQuotation = async (item) => {
    try {
      setQuotationRequestingId(item.catalog_id);
      const response = await api.post(`/business-case/${bcId}/investments/values/request-quotation`, {
        class: investmentClass,
        catalog_id: item.catalog_id,
      });
      await load();
      const notification = response?.data?.data?.notification;
      showToast(
        notification?.sent === false && notification?.reason === "already_requested"
          ? "La cotizacion ya habia sido solicitada"
          : notification?.sent === false
            ? "Solicitud registrada, pero no se pudo enviar el correo"
            : "Cotizacion solicitada y correo enviado al responsable",
        notification?.sent === false && notification?.reason !== "already_requested" ? "warning" : "success",
      );
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo solicitar la cotizacion", "error");
    } finally {
      setQuotationRequestingId(null);
    }
  };

  const dirtyCount = useMemo(() => Object.keys(dirtyMap).length, [dirtyMap]);

  const totalPrice = useMemo(
    () =>
      items.reduce((sum, row) => {
        const basePrice = parseFloat(row.unit_price) || 0;
        const depreciation = calculateFinancialDepreciation(
          basePrice,
          row.depreciation_percentage,
          pricingContext?.projected_deadline_months,
        );
        const price = investmentClass === "financiera" ? depreciation.projected : basePrice;
        const qty = parseInt(row.quantity, 10) || 1;
        return sum + price * qty;
      }, 0),
    [items, investmentClass, pricingContext?.projected_deadline_months]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Inversiones Adicionales — {CLASS_LABELS[investmentClass]}
          </h2>
          <p className="text-sm text-gray-500">
            {investmentClass === "operativa"
              ? "Productos y adquisiciones. Ingresa el precio unitario final de cada ítem."
              : "Servicios y mano de obra. Ingresa el precio unitario final de cada ítem."}
          </p>
          <div className="mt-2">
            <SectionEditorBadge ownership={ownership} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirtyCount > 0 && (
            <div className="text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
              {dirtyCount} pendientes
            </div>
          )}
          {items.length > 0 && (
            <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              Total: ${totalPrice.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
            </div>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || dirtyCount === 0}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
            >
              <FiSave size={13} />
              {saving ? "Guardando..." : "Guardar valores"}
            </button>
          )}
        </div>
      </div>

      <PricingContextHeader context={pricingContext || {}} />
      {syncStatus?.pending && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <FiAlertCircle size={16} className="flex-shrink-0" />
          <span>{syncStatus?.message || "Pendiente de sincronizacion"}</span>
        </div>
      )}
      {!syncStatus?.pending && syncStatus && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <FiCheckCircle size={16} className="flex-shrink-0" />
          <span>{syncStatus?.message}</span>
        </div>
      )}
      {/* Read-only notice for non-editors */}
      {!isEditor && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700">
          Solo{" "}
          {investmentClass === "operativa" ? "Jefe de Operaciones" : "Jefe Financiero"} puede
          ingresar los precios de esta sección.
        </div>
      )}

      {/* No items */}
      {!items.length && (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-500 text-sm">
          No hay inversiones con cantidad asignada en este BC.
          <br />
          <span className="text-xs text-gray-400 mt-1 block">
            Asigna cantidades en «Inversiones Adicionales» para que aparezcan aquí.
          </span>
        </div>
      )}

      {/* Items list */}
      {items.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
          {items.map((item) => {
            const isDirty = Boolean(dirtyMap[item.catalog_id]);
            const baseUnitPrice = parseFloat(item.unit_price) || 0;
            const depreciation = parseFloat(item.depreciation_percentage) || 0;
            const depreciationValues = calculateFinancialDepreciation(
              baseUnitPrice,
              depreciation,
              pricingContext?.projected_deadline_months,
            );
            const depreciatedUnitPrice = investmentClass === "financiera"
              ? depreciationValues.net
              : baseUnitPrice;
            const subtotal = depreciatedUnitPrice * (parseInt(item.quantity, 10) || 1);

            return (
              <div key={item.catalog_id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-500">
                      Categoría: {item.category || "Sin categoría"}
                      {item.quantity != null && ` · Cantidad: ${item.quantity}`}
                      {item.characteristics && ` · ${item.characteristics}`}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-gray-400 mt-0.5">Obs: {item.notes}</div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  {isDirty && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full flex-shrink-0">
                      <FiClock size={11} />
                      Pendiente
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Precio unitario ($)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_price ?? ""}
                      onChange={(e) =>
                        updatePrice(
                          item.catalog_id,
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      disabled={!canEdit || saving}
                      placeholder="0.00"
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 disabled:bg-gray-50"
                    />
                  </div>
                  {investmentClass === "financiera" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500">Depreciacion (%)</label>
                      <div className="relative">
                        <FiPercent size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={item.depreciation_percentage ?? ""}
                          onChange={(e) =>
                            updateDepreciation(
                              item.catalog_id,
                              e.target.value === "" ? null : Number(e.target.value)
                            )
                          }
                          disabled={!canEdit || saving}
                          placeholder="0"
                          className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Cantidad</label>
                    <div className="border border-gray-100 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-700">
                      {item.quantity ?? "—"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Valor neto proyectado</label>
                    <div className="border border-gray-100 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-700 font-semibold">
                      ${subtotal.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {investmentClass === "financiera" && (
                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs text-emerald-800 sm:grid-cols-2 lg:grid-cols-4">
                    <span>Precio base: <strong>${baseUnitPrice.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</strong></span>
                    <span>Depreciacion anual: <strong>${depreciationValues.annual.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</strong></span>
                    <span>Depreciacion mensual: <strong>${depreciationValues.monthly.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</strong></span>
                    <span>Depreciacion proyectada ({pricingContext?.projected_deadline_months || 0} meses): <strong>${depreciationValues.projected.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</strong></span>
                    <span>Valor neto proyectado: <strong>${depreciatedUnitPrice.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</strong></span>
                    <span className="sm:col-span-2 lg:col-span-4">Calculo: {depreciation}% anual; depreciacion mensual = depreciacion anual / 12.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Responsable de cotizacion</label>
                    <select
                      value={assigneeDrafts[String(item.catalog_id)] ?? (item.quotation_assignee_id ? String(item.quotation_assignee_id) : "")}
                      onChange={(e) => setAssigneeDrafts((prev) => ({ ...prev, [String(item.catalog_id)]: e.target.value }))}
                      disabled={!canEdit || saving || assignmentSavingId === item.catalog_id || quotationRequestingId === item.catalog_id}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                    >
                      <option value="">Selecciona un usuario</option>
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>
                          {assignee.name} - {assignee.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => handleAssignQuotation(item)}
                      disabled={!canEdit || saving || assignmentSavingId === item.catalog_id || !assigneeDrafts[String(item.catalog_id)]}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FiUserPlus size={14} />
                      {assignmentSavingId === item.catalog_id ? "Asignando..." : "Asignar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestQuotation(item)}
                      disabled={!canEdit || saving || quotationRequestingId === item.catalog_id || !item.quotation_assignee_id || item.quotation_status === "requested"}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                    >
                      <FiMail size={14} />
                      {quotationRequestingId === item.catalog_id ? "Solicitando..." : "Solicitar cotizacion"}
                    </button>
                  </div>
                </div>

                {item.updated_by_role && !isDirty && (
                  <div className="text-xs text-gray-400">
                    Último: {item.updated_by_role}
                    {item.updated_by_email ? ` (${item.updated_by_email})` : ""}
                  </div>
                )}
              </div>
            );
          })}

          {/* Footer total */}
          <div className="px-4 py-3 flex justify-end">
            <div className="text-sm font-bold text-gray-900">
              Total {CLASS_LABELS[investmentClass]}:{" "}
              <span className="text-emerald-700">
                ${totalPrice.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestmentValuesSection;
