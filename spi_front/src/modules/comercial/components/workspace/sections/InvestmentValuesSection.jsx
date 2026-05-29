import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiClock, FiSave } from "react-icons/fi";
import api from "../../../../../core/api";
import { useParams } from "react-router-dom";
import { useUI } from "../../../../../core/ui/UIContext";
import { useAuth } from "../../../../../core/auth/AuthContext";

const EDITOR_ROLES = {
  operativa: new Set(["jefe_operaciones", "jefe_de_operaciones"]),
  financiera: new Set(["jefe_financiero"]),
};

const CLASS_LABELS = {
  operativa: "Operativas",
  financiera: "Financieras",
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

function DeadlineBanner({ deadlineAt }) {
  const now = Date.now();
  const deadline = deadlineAt ? new Date(deadlineAt).getTime() : null;
  if (!deadline) return null;

  const diffMs = deadline - now;
  const isExpired = diffMs <= 0;
  const hoursLeft = Math.max(0, Math.floor(diffMs / 3600000));
  const minutesLeft = Math.max(0, Math.floor((diffMs % 3600000) / 60000));

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
        isExpired
          ? "border-red-200 bg-red-50 text-red-800"
          : hoursLeft < 6
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-blue-100 bg-blue-50 text-blue-800"
      }`}
    >
      {isExpired ? <FiAlertCircle size={16} className="flex-shrink-0" /> : <FiClock size={16} className="flex-shrink-0" />}
      {isExpired ? (
        <span>El plazo de 48 horas ha vencido. Completa los valores lo antes posible.</span>
      ) : (
        <span>
          Plazo: <strong>{hoursLeft}h {minutesLeft}m restantes</strong> —{" "}
          {new Date(deadline).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}
        </span>
      )}
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
  const [deadlineAt, setDeadlineAt] = useState(null);
  const [dirtyMap, setDirtyMap] = useState({});
  const [syncStatus, setSyncStatus] = useState(null);
  const [cartStatus, setCartStatus] = useState(null);

  const role = (user?.role || user?.scope || user?.role_name || "").toLowerCase();
  const isEditor = EDITOR_ROLES[investmentClass]?.has(role) ?? false;
  const canEdit = isEditor && permissions.canEdit !== false && ownership?.canUserEdit !== false;

  const load = useCallback(async () => {
    if (!bcId) return;
    try {
      setLoading(true);
      const res = await api.get(`/business-case/${bcId}/investments/values`, {
        params: { class: investmentClass },
      });
      const payload = res?.data?.data || {};
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setDeadlineAt(payload.deadline_at || null);
      setSyncStatus(payload.sync_status || null);
      setCartStatus(payload.cart || null);
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
        })),
      });
      const syncInfo = response?.data?.data?.sheet_sync;
      await load();
      setDirtyMap({});
      if (investmentClass === "operativa" && syncInfo?.queued === false) {
        showToast("Valores guardados. La sincronización del sheet no se pudo iniciar automáticamente.", "warning");
      } else if (investmentClass === "operativa") {
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

  const dirtyCount = useMemo(() => Object.keys(dirtyMap).length, [dirtyMap]);

  const totalPrice = useMemo(
    () =>
      items.reduce((sum, row) => {
        const price = parseFloat(row.unit_price) || 0;
        const qty = parseInt(row.quantity, 10) || 1;
        return sum + price * qty;
      }, 0),
    [items]
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

      {/* Deadline */}
      <DeadlineBanner deadlineAt={deadlineAt} />
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
      {cartStatus && !cartStatus.confirmed && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <FiAlertCircle size={16} className="flex-shrink-0" />
          <span>Carrito no confirmado. Espera confirmación para iniciar carga formal de valores.</span>
        </div>
      )}

      {/* Read-only notice for non-editors */}
      {!isEditor && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700">
          Solo{" "}
          {investmentClass === "operativa" ? "Jefe de Operaciones / Jefe de Logística" : "Jefe Financiero"} puede
          ingresar los precios de esta sección.
        </div>
      )}

      {/* No items */}
      {!items.length && (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-500 text-sm">
          No hay inversiones {CLASS_LABELS[investmentClass].toLowerCase()} seleccionadas en este BC.
          <br />
          <span className="text-xs text-gray-400 mt-1 block">
            Selecciona ítems en la sección «Inversiones Adicionales» primero.
          </span>
        </div>
      )}

      {/* Items list */}
      {items.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
          {items.map((item) => {
            const isDirty = Boolean(dirtyMap[item.catalog_id]);
            const subtotal =
              (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity, 10) || 1);

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
                  </div>
                  {isDirty && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full flex-shrink-0">
                      <FiClock size={11} />
                      Pendiente
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
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
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Cantidad</label>
                    <div className="border border-gray-100 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-700">
                      {item.quantity ?? "—"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Subtotal</label>
                    <div className="border border-gray-100 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-700 font-semibold">
                      ${subtotal.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                    </div>
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
