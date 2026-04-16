import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiLock,
  FiRefreshCw,
  FiSearch,
  FiSend,
} from "react-icons/fi";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Input from "../../../core/ui/components/Input";
import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";
import {
  createDeliveryRequest,
  listDeliveryCeilings,
} from "../../../core/api/deliveryRequestsApi";

const VIEW_ROLES = new Set([
  "comercial",
  "backoffice_comercial",
  "acp_comercial",
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
  "jefe_operaciones",
  "operaciones",
  "jefe_logistica",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "tecnico",
  "servicio_tecnico",
  "admin",
  "administrador",
]);

const MUTATE_ROLES = new Set([
  "comercial",
  "backoffice_comercial",
  "acp_comercial",
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
  "admin",
  "administrador",
]);

const API_ERROR_MESSAGES = {
  MAX_EXCEEDED: "La cantidad solicitada supera el saldo disponible.",
  ITEM_NOT_ALLOWED: "El item seleccionado no esta permitido para este maximo.",
  CEILING_NOT_ACTIVE: "El techo de maximos no esta activo y no permite solicitudes.",
  PUBLIC_PLAN_NOT_APPROVED: "No existe un plan de entregas publico aprobado para este caso.",
  OUTSIDE_DELIVERY_WINDOW: "No hay un tramo vigente de entrega para la fecha seleccionada.",
  TRANCHE_MAX_EXCEEDED: "La cantidad solicitada supera el maximo permitido del tramo vigente.",
};

const normalizeRoleList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }
  if (value === undefined || value === null) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const buildRoleSet = (user) => {
  const roles = new Set();
  [
    ...normalizeRoleList(user?.role),
    ...normalizeRoleList(user?.scope),
    ...normalizeRoleList(user?.role_name),
    ...normalizeRoleList(user?.roles),
    ...normalizeRoleList(user?.scopes),
  ].forEach((role) => roles.add(role));
  return roles;
};

const toShortDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const toFixed3 = (value) => Number(value || 0).toFixed(3);

const resolveReferenceLabel = (line) => {
  if (line.equipment_model_id) return `Equipo #${line.equipment_model_id}`;
  if (line.integration_product_map_id) return `Mapa #${line.integration_product_map_id}`;
  if (line.odoo_product_id) return `Odoo #${line.odoo_product_id}`;
  return "Sin referencia";
};

const extractApiErrorCode = (error) =>
  error?.response?.data?.code || error?.code || null;

const resolveApiErrorMessage = (error) => {
  const status = Number(error?.response?.status || 0);
  if (status === 403) {
    return "No tienes permisos para realizar esta accion.";
  }

  const code = extractApiErrorCode(error);
  if (code && API_ERROR_MESSAGES[code]) return API_ERROR_MESSAGES[code];
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "No se pudo completar la operacion."
  );
};

const statusPillClass = (status) => {
  if (status === "active") return "bg-green-100 text-green-800";
  if (status === "approved") return "bg-blue-100 text-blue-800";
  if (status === "draft") return "bg-amber-100 text-amber-800";
  if (status === "closed") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
};

export default function DeliveryCeilingsPage() {
  const { user } = useAuth();
  const { showToast } = useUI();

  const roleSet = useMemo(() => buildRoleSet(user), [user]);
  const canView = useMemo(() => Array.from(roleSet).some((role) => VIEW_ROLES.has(role)), [roleSet]);
  const canMutate = useMemo(
    () => Array.from(roleSet).some((role) => MUTATE_ROLES.has(role)),
    [roleSet],
  );

  const [businessCaseId, setBusinessCaseId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dataset, setDataset] = useState({
    rows: [],
    total: 0,
    page: 1,
    limit: 50,
    open_statuses_used_for_reservation: [],
  });
  const [selectedCeilingId, setSelectedCeilingId] = useState("");
  const [requestedQtyByLine, setRequestedQtyByLine] = useState({});
  const [lastRequest, setLastRequest] = useState(null);

  const selectedCeiling = useMemo(
    () =>
      dataset.rows.find((row) => String(row.id) === String(selectedCeilingId)) ||
      dataset.rows[0] ||
      null,
    [dataset.rows, selectedCeilingId],
  );

  useEffect(() => {
    if (!selectedCeiling) return;
    setSelectedCeilingId(String(selectedCeiling.id));
  }, [selectedCeiling]);

  useEffect(() => {
    setRequestedQtyByLine({});
  }, [selectedCeilingId]);

  const loadCeilings = useCallback(
    async ({ preserveSelection = true } = {}) => {
      if (!canView) return;
      setLoading(true);
      try {
        const data = await listDeliveryCeilings({
          businessCaseId: businessCaseId.trim() || undefined,
          status: statusFilter || undefined,
          limit: 50,
          page: 1,
        });
        setDataset(data || { rows: [], total: 0, page: 1, limit: 50 });
        if (!preserveSelection) {
          setSelectedCeilingId("");
        }
      } catch (error) {
        showToast(resolveApiErrorMessage(error), "error");
      } finally {
        setLoading(false);
      }
    },
    [businessCaseId, canView, showToast, statusFilter],
  );

  useEffect(() => {
    loadCeilings({ preserveSelection: false });
  }, [loadCeilings]);

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadCeilings({ preserveSelection: false });
  };

  const handleChangeQty = (lineId, value) => {
    const normalized = String(value || "");
    if (!normalized) {
      setRequestedQtyByLine((previous) => ({ ...previous, [lineId]: "" }));
      return;
    }
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric) || numeric < 0) return;
    setRequestedQtyByLine((previous) => ({ ...previous, [lineId]: normalized }));
  };

  const handleCreateRequest = async (event) => {
    event.preventDefault();

    if (!selectedCeiling) {
      showToast("Selecciona un techo de maximos para continuar.", "warning");
      return;
    }
    if (selectedCeiling.status !== "active") {
      showToast(API_ERROR_MESSAGES.CEILING_NOT_ACTIVE, "error");
      return;
    }

    const linesPayload = (selectedCeiling.lines || [])
      .map((line) => ({
        ceilingLineId: Number(line.id),
        requestedQty: Number(requestedQtyByLine[line.id]),
        remainingEffectiveQty: Number(line.remaining_effective_qty || 0),
      }))
      .filter((line) => Number.isFinite(line.requestedQty) && line.requestedQty > 0);

    if (!linesPayload.length) {
      showToast("Ingresa al menos una cantidad mayor a 0.", "warning");
      return;
    }

    const invalidLine = linesPayload.find(
      (line) => line.requestedQty > line.remainingEffectiveQty + 1e-9,
    );
    if (invalidLine) {
      showToast(
        `La linea ${invalidLine.ceilingLineId} excede el saldo disponible.`,
        "error",
      );
      return;
    }

    try {
      setSubmitting(true);
      const response = await createDeliveryRequest({
        ceilingId: Number(selectedCeiling.id),
        lines: linesPayload.map(({ ceilingLineId, requestedQty }) => ({
          ceilingLineId,
          requestedQty,
        })),
      });
      setLastRequest(response?.request || null);
      setRequestedQtyByLine({});
      showToast("Solicitud de entrega creada correctamente.", "success");
      await loadCeilings({ preserveSelection: true });
    } catch (error) {
      showToast(resolveApiErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return (
      <Card className="space-y-3">
        <div className="flex items-start gap-2 text-amber-700">
          <FiAlertTriangle className="mt-0.5" />
          <div>
            <h1 className="text-lg font-semibold">Acceso restringido</h1>
            <p className="text-sm">
              Tu rol no tiene permiso para consultar maximos y saldos de entrega.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-slate-900">Maximos y saldos por Business Case</h1>
          <p className="text-sm text-slate-600">
            Consulta techos activos y crea solicitudes parciales de entrega.
          </p>
        </div>

        <form className="grid gap-3 md:grid-cols-[1fr_220px_auto_auto]" onSubmit={handleSearch}>
          <Input
            label="Business Case ID (UUID)"
            value={businessCaseId}
            onChange={(event) => setBusinessCaseId(event.target.value)}
            placeholder="Ej: 94e35f39-7d4f-4c4c-9c44-0e70fa40f872"
            containerClassName="mb-0"
          />
          <div className="mb-0">
            <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Todos</option>
              <option value="active">Activo</option>
              <option value="approved">Aprobado</option>
              <option value="draft">Borrador</option>
              <option value="closed">Cerrado</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" icon={FiSearch} loading={loading}>
              Buscar
            </Button>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => loadCeilings({ preserveSelection: true })}
              icon={FiRefreshCw}
              loading={loading}
            >
              Actualizar
            </Button>
          </div>
        </form>
      </Card>

      {!dataset.rows.length && !loading ? (
        <Card>
          <p className="text-sm text-slate-600">
            No hay techos de maximos para los filtros seleccionados.
          </p>
        </Card>
      ) : null}

      {selectedCeiling ? (
        <Card className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Techo seleccionado</label>
              <select
                value={selectedCeilingId}
                onChange={(event) => setSelectedCeilingId(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {dataset.rows.map((ceiling) => (
                  <option key={ceiling.id} value={ceiling.id}>
                    #{ceiling.id} | {ceiling.purchase_type} | {ceiling.business_case_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span>
                  Estado:{" "}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPillClass(selectedCeiling.status)}`}>
                    {selectedCeiling.status}
                  </span>
                </span>
                <span className="text-slate-600">{selectedCeiling.purchase_type}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateRequest} className="space-y-3">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Linea</th>
                    <th className="px-3 py-2 text-left font-semibold">Referencia</th>
                    <th className="px-3 py-2 text-right font-semibold">Max</th>
                    <th className="px-3 py-2 text-right font-semibold">Entregado</th>
                    <th className="px-3 py-2 text-right font-semibold">Reservado</th>
                    <th className="px-3 py-2 text-right font-semibold">Saldo disponible</th>
                    <th className="px-3 py-2 text-right font-semibold">Solicitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedCeiling.lines || []).map((line) => {
                    const limitReached = Number(line.remaining_effective_qty || 0) <= 0;
                    return (
                      <tr key={line.id}>
                        <td className="px-3 py-2 text-slate-700">
                          #{line.id} <span className="text-xs text-slate-500">({line.item_type})</span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{resolveReferenceLabel(line)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{toFixed3(line.max_quantity)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{toFixed3(line.delivered_qty)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{toFixed3(line.reserved_open_qty)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                          {toFixed3(line.remaining_effective_qty)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={requestedQtyByLine[line.id] || ""}
                            onChange={(event) => handleChangeQty(line.id, event.target.value)}
                            disabled={!canMutate || selectedCeiling.status !== "active" || limitReached}
                            placeholder="0.000"
                            className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!canMutate ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <FiLock />
                Tu rol puede consultar saldos, pero no crear solicitudes de entrega.
              </div>
            ) : null}

            {selectedCeiling.status !== "active" ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <FiAlertTriangle />
                Solo los techos en estado <strong>active</strong> permiten crear solicitudes.
              </div>
            ) : null}

            {canMutate ? (
              <div className="flex justify-end">
                <Button
                  type="submit"
                  loading={submitting}
                  disabled={selectedCeiling.status !== "active"}
                  icon={FiSend}
                >
                  Crear solicitud de entrega
                </Button>
              </div>
            ) : null}
          </form>
        </Card>
      ) : null}

      {lastRequest ? (
        <Card className="flex items-start gap-3 bg-green-50/60">
          <FiCheckCircle className="mt-0.5 text-green-700" />
          <div>
            <p className="text-sm font-semibold text-green-900">
              Solicitud creada: #{lastRequest.id}
            </p>
            <p className="text-xs text-green-800">
              Estado: {lastRequest.status} | Fecha: {toShortDateTime(lastRequest.requested_at)}
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

