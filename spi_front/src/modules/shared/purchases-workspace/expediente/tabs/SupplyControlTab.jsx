/**
 * SupplyControlTab
 * ─────────────────────────────────────────────────────────────────────────────
 * Control de insumos / supply control tab for purchase expediente.
 *
 * Flow:
 *   1. acp_comercial / jefe_comercial activate the control and choose type
 *      (bc_maximums or commercial_deliverables)
 *   2. Comercial creates delivery requests against the BC-defined ceilings
 *   3. Jefe de operaciones reviews each request and sets how much to actually
 *      send per line (approved_qty — can be partial)
 *   4. Jefe de logística confirms the physical shipment and adds dispatch notes
 *      → A delivery_dispatch record is created with timestamp + actor
 *      → If partial, the system auto-creates a new pending request for remainder
 *
 * Visual features:
 *   · Progress bar per item: delivered / max, alert ring at ≥80%
 *   · Shipment history table per ceiling (timestamp, who, qty, notes)
 *   · Remainder badge on auto-created follow-up requests
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FiAlertTriangle, FiCheckCircle, FiClock, FiGrid,
  FiLoader, FiPackage, FiSend, FiTruck,
} from 'react-icons/fi';
import RoleGatedAction from '../../components/RoleGatedAction';
import TabBadge from '../../components/TabBadge';
import { activateSupplyControl, getEquipmentPurchaseApiError } from '../../../../../core/api/equipmentPurchasesApi';
import { setPrivatePurchaseSupplyControlType } from '../../../../../core/api/privatePurchasesApi';
import {
  createDeliveryRequest,
  listDeliveryCeilings,
  listDeliveryDispatches,
  listDeliveryRequests,
  opsApproveDeliveryRequest,
  confirmDeliveryRequest,
  cancelDeliveryRequest,
} from '../../../../../core/api/deliveryRequestsApi';
import { requestSupply, opsApproveSupply, registerDispatch } from '../../../../../core/api/equipmentPurchasesApi';

/* ── constants ────────────────────────────────────────────────────────────── */
const SUPPLY_CONTROL_TYPES = {
  bc_maximums:             { label: 'Máximos del Business Case',  description: 'Los topes máximos por ítem se obtienen directamente del BC vinculado.' },
  commercial_deliverables: { label: 'Entregables comerciales',    description: 'Los topes se definen manualmente desde los entregables de la oferta.' },
  open_orders:             { label: 'Pedidos abiertos',           description: 'Reactivos, calibradores, controles y materiales sin máximo. El sistema lleva el historial de cada pedido.' },
  none:                    { label: 'Sin control',                description: 'Esta solicitud no requiere seguimiento de insumos.' },
};

const SUPPLY_CONTROL_ACTIVATE_ROLES  = ['acp_comercial', 'jefe_comercial', 'jefe_de_comercial'];
const DELIVERY_REQUEST_CREATOR_ROLES = ['comercial', 'asesor_comercial', 'analista_comercial', 'backoffice', 'backoffice_comercial', 'acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'];
const DR_OPS_APPROVE_ROLES           = ['jefe_operaciones', 'operaciones', 'acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'];
const DR_LOGISTICS_CONFIRM_ROLES     = ['jefe_logistica', 'acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'];

const ALERT_THRESHOLD = 0.80; // warn when delivered / max >= 80%

/* ── helpers ──────────────────────────────────────────────────────────────── */
function pct(delivered, max) {
  if (!max || max <= 0) return 0;
  return Math.min(1, delivered / max);
}

function fmtQty(qty, unit) {
  const n = Number(qty ?? 0);
  return `${n % 1 === 0 ? n : n.toFixed(2)} ${unit || ''}`.trim();
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
}

function StatusPill({ status }) {
  const map = {
    pending:     { label: 'Pendiente',        cls: 'bg-amber-100 text-amber-700' },
    ops_approved:{ label: 'Aprobado por ops', cls: 'bg-blue-100 text-blue-700'  },
    confirmed:   { label: 'Despachado',       cls: 'bg-green-100 text-operative-green' },
    cancelled:   { label: 'Cancelado',        cls: 'bg-slate-100 text-warm-ash'  },
  };
  const s = map[status] || { label: status, cls: 'bg-slate-100 text-warm-ash' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

/* ── Progress bar (with max) ──────────────────────────────────────────────── */
function ItemProgress({ item }) {
  // open_orders lines have no max — show a simple totals counter instead
  if (item.max_quantity == null) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs font-medium text-ink-slate capitalize">{item.item_type}</span>
        <span className="text-xs font-mono text-warm-ash">
          Total entregado: <strong className="text-ink-slate">{fmtQty(item.delivered_qty, item.unit)}</strong>
        </span>
      </div>
    );
  }

  const ratio      = pct(item.delivered_qty, item.max_quantity);
  const pctDisplay = Math.round(ratio * 100);
  const isAlert    = ratio >= ALERT_THRESHOLD;
  const isFull     = ratio >= 1;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink-slate capitalize">{item.item_type}</span>
        <span className={`font-mono ${isFull ? 'text-alert-red' : isAlert ? 'text-caution-amber' : 'text-warm-ash'}`}>
          {fmtQty(item.delivered_qty, item.unit)} / {fmtQty(item.max_quantity, item.unit)}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFull ? 'bg-alert-red' : isAlert ? 'bg-caution-amber' : 'bg-action-blue'}`}
          style={{ width: `${pctDisplay}%` }}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-warm-ash">
          Saldo: {fmtQty(Math.max(0, item.max_quantity - item.delivered_qty), item.unit)}
        </span>
        {isAlert && !isFull && (
          <span className="flex items-center gap-0.5 text-[10px] text-caution-amber font-medium">
            <FiAlertTriangle size={10} />{pctDisplay}% consumido
          </span>
        )}
        {isFull && (
          <span className="flex items-center gap-0.5 text-[10px] text-alert-red font-medium">
            <FiAlertTriangle size={10} />Máximo alcanzado
          </span>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
const SupplyControlTab = ({ purchase, type, userRoles, refresh }) => {
  const [loading, setLoading]             = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [error, setError]                 = useState(null);
  const [selectedType, setSelectedType]   = useState(purchase?.supply_control_type || null);

  // Ceiling data
  const [ceilings, setCeilings]           = useState([]);
  const [ceilingsLoading, setCeilingsLoading] = useState(false);

  // Per-ceiling request + dispatch data
  const [requests, setRequests]           = useState([]);      // all delivery_requests
  const [dispatches, setDispatches]       = useState([]);      // all dispatch records

  // New request drafts: { [lineId]: qty }
  const [requestDrafts, setRequestDrafts] = useState({});
  const [requestNotes, setRequestNotes]   = useState('');

  // Ops partial approve drafts: { [lineId]: approvedQty }
  const [approveDrafts, setApproveDrafts] = useState({});

  // Confirm dispatch notes per request
  const [dispatchNotesDraft, setDispatchNotesDraft] = useState({});

  const [reloadKey, setReloadKey]         = useState(0);

  const isPrivate        = type === 'private' || purchase?.purchase_type === 'private';
  const linkedBcId       = purchase?.extra?.auto_business_case_id || purchase?.business_case_id || null;
  const hasBc            = Boolean(linkedBcId);
  const supplyControlType = purchase?.supply_control_type || 'pending';
  const isActive         = supplyControlType !== 'none' && supplyControlType !== 'pending';
  const isOpenOrders     = supplyControlType === 'open_orders';
  const recommendedType  = isPrivate ? (hasBc ? 'bc_maximums' : 'open_orders') : (hasBc ? 'bc_maximums' : 'commercial_deliverables');
  const typeInfo         = SUPPLY_CONTROL_TYPES[supplyControlType] || { label: 'Pendiente', description: 'Aún no se ha activado el control' };

  // open_orders is only offered for private purchases without a BC
  const showOpenOrdersOption = isPrivate && !hasBc;

  useEffect(() => {
    if (supplyControlType === 'pending' && !selectedType) {
      setSelectedType(recommendedType);
    }
  }, [supplyControlType, selectedType, recommendedType]);

  /* ── load ceilings + requests + dispatches ─────────────────────────────── */
  const loadData = useCallback(async () => {
    if (!isActive) return;
    setCeilingsLoading(true);
    setError(null);
    try {
      const ceilData = await listDeliveryCeilings({
        status: 'active',
        purchaseType: isPrivate ? 'private' : 'public',
        privatePurchaseId: isPrivate ? String(purchase?.id) : undefined,
        businessCaseId: !isPrivate ? (linkedBcId || undefined) : undefined,
        limit: 50,
      });
      const rows = Array.isArray(ceilData?.rows) ? ceilData.rows : Array.isArray(ceilData) ? ceilData : [];
      setCeilings(rows);

      if (rows.length) {
        const [reqData, dispData] = await Promise.all([
          Promise.all(rows.map((c) => listDeliveryRequests({ ceiling_id: c.id, limit: 50 }))),
          Promise.all(rows.map((c) => listDeliveryDispatches({ ceiling_id: c.id, limit: 100 }))),
        ]);
        setRequests(reqData.flat().filter(Boolean));
        setDispatches(dispData.flat().filter(Boolean));
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo cargar la matriz de insumos');
    } finally {
      setCeilingsLoading(false);
    }
  }, [isActive, isPrivate, linkedBcId, reloadKey]); // eslint-disable-line

  useEffect(() => { loadData(); }, [loadData]);

  /* ── actions ───────────────────────────────────────────────────────────── */
  const reload = () => setReloadKey((k) => k + 1);

  const handleActivate = async (controlType) => {
    setLoading(true);
    setError(null);
    try {
      if (isPrivate) {
        await setPrivatePurchaseSupplyControlType(purchase.id, {
          controlType,
          hasCommercialDeliverables: controlType === 'commercial_deliverables',
          expected_updated_at: purchase.updated_at,
        });
      } else {
        await activateSupplyControl(purchase.id, {
          supplyControlType: controlType,
          expected_updated_at: purchase.updated_at,
        });
      }
      await refresh();
    } catch (err) {
      setError(getEquipmentPurchaseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (ceiling) => {
    const lines = (ceiling.lines || [])
      .map((line) => ({ ceilingLineId: Number(line.id), requestedQty: Number(requestDrafts[line.id] || 0) }))
      .filter((l) => l.requestedQty > 0);

    if (!lines.length) {
      setError('Ingresá al menos una cantidad mayor a 0.');
      return;
    }
    setRequestLoading(true);
    setError(null);
    try {
      if (isPrivate) {
        await createDeliveryRequest({
          ceilingId: Number(ceiling.id),
          privatePurchaseId: String(purchase.id),
          lines,
          notes: requestNotes.trim() || null,
        });
      } else {
        await requestSupply(purchase.id, {
          ceiling_id: Number(ceiling.id),
          lines,
          notes: requestNotes.trim() || null,
        });
      }
      setRequestDrafts({});
      setRequestNotes('');
      reload();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo crear la solicitud');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleOpsApprove = async (req) => {
    const lines = (req.lines || [])
      .map((l) => {
        const key = `${req.id}_${l.id}`;
        const val = approveDrafts[key];
        return val != null ? { lineId: l.id, approvedQty: Number(val) } : null;
      })
      .filter(Boolean);

    setRequestLoading(true);
    setError(null);
    try {
      if (isPrivate) {
        await opsApproveDeliveryRequest(req.id, lines.length ? { lines } : {});
      } else {
        await opsApproveSupply(purchase.id, { delivery_request_id: req.id });
      }
      setApproveDrafts((prev) => {
        const next = { ...prev };
        (req.lines || []).forEach((l) => delete next[`${req.id}_${l.id}`]);
        return next;
      });
      reload();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo aprobar');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleConfirmDispatch = async (req) => {
    setRequestLoading(true);
    setError(null);
    try {
      const notes = dispatchNotesDraft[req.id] || null;
      if (isPrivate) {
        await confirmDeliveryRequest(req.id, { dispatchNotes: notes });
      } else {
        await registerDispatch(purchase.id, { delivery_request_id: req.id });
      }
      setDispatchNotesDraft((prev) => { const n = { ...prev }; delete n[req.id]; return n; });
      reload();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo registrar el despacho');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleCancel = async (reqId) => {
    setRequestLoading(true);
    setError(null);
    try {
      await cancelDeliveryRequest(reqId);
      reload();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo cancelar');
    } finally {
      setRequestLoading(false);
    }
  };

  /* ── pending / not-active states ──────────────────────────────────────── */
  if (supplyControlType === 'pending') {
    return (
      <div className="flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-ink-slate">Control de Insumos</h2>
            <p className="text-xs text-warm-ash mt-0.5">Solicitudes, despachos y trazabilidad</p>
          </div>
          <TabBadge status="pendiente" />
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
            <div className="flex items-center gap-2 mb-4">
              <FiGrid className="text-action-blue" size={18} />
              <h3 className="text-sm font-semibold text-ink-slate">Activar control de insumos</h3>
            </div>
            <p className="text-xs text-warm-ash mb-4">Seleccioná el tipo de control antes de activar. No se puede cambiar una vez activado.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(SUPPLY_CONTROL_TYPES)
                .filter(([key]) => {
                  if (key === 'bc_maximums')  return hasBc;           // only if BC exists
                  if (key === 'open_orders')  return showOpenOrdersOption; // only private without BC
                  return true;
                })
                .map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedType(key)}
                    disabled={loading}
                    className={`p-4 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                      selectedType === key ? 'border-action-blue bg-action-blue/5' : 'border-soft-border hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-semibold text-ink-slate mb-1">{info.label}</div>
                    <div className="text-xs text-warm-ash">{info.description}</div>
                    {key === 'bc_maximums' && (
                      <div className="text-[10px] text-action-blue mt-1 font-medium">BC #{linkedBcId}</div>
                    )}
                    {key === 'open_orders' && (
                      <div className="text-[10px] text-action-blue mt-1 font-medium">
                        Reactivos · Calibradores · Controles · Materiales
                      </div>
                    )}
                  </button>
                ))}
            </div>
            <RoleGatedAction allowedRoles={SUPPLY_CONTROL_ACTIVATE_ROLES} userRoles={userRoles}>
              <button
                onClick={() => selectedType && handleActivate(selectedType)}
                disabled={!selectedType || loading}
                className="mt-5 w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-action-blue text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
              >
                {loading ? <><FiLoader className="animate-spin" size={15} />Activando...</> : 'Activar control'}
              </button>
            </RoleGatedAction>
          </div>
          {error && <p className="text-xs text-alert-red">{error}</p>}
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-ink-slate">Control de Insumos</h2>
            <p className="text-xs text-warm-ash mt-0.5">No aplica</p>
          </div>
          <TabBadge status="n/a" />
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="p-5 bg-fog rounded-2xl w-fit mb-4"><FiGrid className="text-warm-ash" size={32} /></div>
          <h3 className="text-sm font-semibold text-ink-slate mb-1">Sin control de insumos</h3>
          <p className="text-xs text-warm-ash text-center max-w-sm">Esta solicitud no requiere seguimiento de insumos.</p>
        </div>
      </div>
    );
  }

  /* ── ACTIVE ────────────────────────────────────────────────────────────── */
  const ceilingRequests   = (cId) => requests.filter((r) => Number(r.delivery_ceiling_id) === Number(cId));
  const ceilingDispatches = (cId) => dispatches.filter((d) => Number(d.delivery_ceiling_id) === Number(cId));

  return (
    <div className="flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Control de Insumos</h2>
          <p className="text-xs text-warm-ash mt-0.5">{typeInfo.label}</p>
        </div>
        <TabBadge status="ok" />
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>
        )}

        {ceilingsLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-warm-ash text-sm">
            <FiLoader className="animate-spin" size={16} />Cargando matriz...
          </div>
        ) : ceilings.length === 0 ? (
          <div className="bg-white rounded-xl border border-soft-border p-8 text-center">
            <FiPackage className="mx-auto text-warm-ash mb-2" size={28} />
            <p className="text-sm text-warm-ash">No hay matriz de insumos activa para este expediente.</p>
          </div>
        ) : (
          ceilings.map((ceiling) => {
            const cReqs  = ceilingRequests(ceiling.id);
            const cDisps = ceilingDispatches(ceiling.id);
            const openReqs = cReqs.filter((r) => r.status === 'pending' || r.status === 'ops_approved');

            return (
              <div key={ceiling.id} className="bg-white rounded-xl border border-soft-border shadow-ambient overflow-hidden">
                {/* Ceiling header */}
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FiPackage className="text-action-blue" size={15} />
                    <span className="text-sm font-semibold text-ink-slate">
                      {isOpenOrders
                        ? 'Pedidos abiertos'
                        : linkedBcId
                        ? `BC #${linkedBcId}`
                        : `Ceiling #${ceiling.id}`}
                    </span>
                    {isOpenOrders && (
                      <span className="text-[10px] text-warm-ash">
                        Reactivos · Calibradores · Controles · Materiales
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-warm-ash uppercase tracking-wide">
                    {isOpenOrders ? 'Sin máximo' : typeInfo.label}
                  </span>
                </div>

                {/* ── Progress per item ────────────────────────────────────── */}
                <div className="p-5 space-y-4 border-b border-slate-100">
                  <h4 className="text-xs font-semibold text-warm-ash uppercase tracking-wider">
                    {isOpenOrders ? 'Totales entregados' : 'Consumo por ítem'}
                  </h4>
                  {(ceiling.lines || []).map((line) => (
                    <ItemProgress key={line.id} item={line} />
                  ))}
                </div>

                {/* ── New request form ─────────────────────────────────────── */}
                <RoleGatedAction allowedRoles={DELIVERY_REQUEST_CREATOR_ROLES} userRoles={userRoles}>
                  <div className="p-5 border-b border-slate-100 space-y-3">
                    <h4 className="text-xs font-semibold text-warm-ash uppercase tracking-wider flex items-center gap-1.5">
                      <FiSend size={11} />Nueva solicitud de envío
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr className="text-left text-warm-ash">
                            <th className="px-4 py-2 font-medium">Ítem</th>
                            <th className="px-4 py-2 font-medium">Máximo</th>
                            <th className="px-4 py-2 font-medium">Entregado</th>
                            <th className="px-4 py-2 font-medium">Saldo</th>
                            <th className="px-4 py-2 font-medium">Solicitar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(ceiling.lines || []).map((line) => {
                            const hasMax = line.max_quantity != null;
                            const balance = hasMax
                              ? Number(line.remaining_effective_qty ?? line.remaining_qty ?? Math.max(0, line.max_quantity - line.delivered_qty))
                              : null;
                            const blocked = hasMax ? balance <= 0 : false;
                            return (
                              <tr key={line.id} className="border-b border-slate-100 last:border-0">
                                <td className="px-4 py-2.5 font-medium text-ink-slate">{line.item_type}</td>
                                <td className="px-4 py-2.5 font-mono text-warm-ash">{hasMax ? fmtQty(line.max_quantity, line.unit) : 'Sin maximo'}</td>
                                <td className="px-4 py-2.5 font-mono text-warm-ash">{fmtQty(line.delivered_qty, line.unit)}</td>
                                <td className={`px-4 py-2.5 font-mono font-medium ${blocked ? 'text-alert-red' : 'text-operative-green'}`}>
                                  {hasMax ? fmtQty(balance, line.unit) : 'Abierto'}
                                </td>
                                <td className="px-4 py-2.5">
                                  <input
                                    type="number" min="0" max={hasMax ? balance : undefined} step="0.001"
                                    disabled={blocked}
                                    value={requestDrafts[line.id] || ''}
                                    onChange={(e) => setRequestDrafts((p) => ({ ...p, [line.id]: e.target.value }))}
                                    placeholder="0"
                                    className="w-24 min-h-9 rounded-lg border border-slate-200 px-2 font-mono text-xs disabled:bg-slate-50 disabled:text-slate-300"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <textarea
                      value={requestNotes}
                      onChange={(e) => setRequestNotes(e.target.value)}
                      placeholder="Notas para operaciones / logística (opcional)"
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateRequest(ceiling)}
                      disabled={requestLoading}
                      className="min-h-10 px-4 inline-flex items-center gap-1.5 rounded-xl bg-action-blue text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.97]"
                    >
                      {requestLoading ? <FiLoader className="animate-spin" size={13} /> : <FiSend size={13} />}
                      Solicitar envío
                    </button>
                  </div>
                </RoleGatedAction>

                {/* ── Open requests (pending / ops_approved) ───────────────── */}
                {openReqs.length > 0 && (
                  <div className="p-5 border-b border-slate-100 space-y-3">
                    <h4 className="text-xs font-semibold text-warm-ash uppercase tracking-wider flex items-center gap-1.5">
                      <FiClock size={11} />Solicitudes abiertas
                    </h4>
                    {openReqs.map((req) => (
                      <div key={req.id} className={`rounded-xl border p-4 space-y-3 ${
                        req.notes?.startsWith('Sobrante') ? 'border-caution-amber/40 bg-amber-50/40' : 'border-slate-200'
                      }`}>
                        {/* Request header */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-warm-ash">#{req.id}</span>
                            <StatusPill status={req.status} />
                            {req.notes?.startsWith('Sobrante') && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                Sobrante auto
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-warm-ash">{fmtDate(req.requested_at)}</span>
                        </div>

                        {/* Lines */}
                        <div className="space-y-1.5">
                          {(req.lines || []).map((line) => (
                            <div key={line.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                              <span className="text-ink-slate">{line.item_type}</span>
                              <div className="flex items-center gap-3 font-mono">
                                <span className="text-warm-ash">
                                  Solicitado: <strong className="text-ink-slate">{fmtQty(line.requested_qty, line.unit)}</strong>
                                </span>
                                {line.approved_qty != null && (
                                  <span className={`${Number(line.approved_qty) < Number(line.requested_qty) ? 'text-caution-amber' : 'text-operative-green'}`}>
                                    Aprobado: <strong>{fmtQty(line.approved_qty, line.unit)}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {req.notes && (
                          <p className="text-[11px] text-warm-ash italic">"{req.notes}"</p>
                        )}

                        {/* Ops: approve with optional partial quantities */}
                        {req.status === 'pending' && (
                          <RoleGatedAction allowedRoles={DR_OPS_APPROVE_ROLES} userRoles={userRoles}>
                            <div className="border-t border-slate-200 pt-3 space-y-2">
                              <p className="text-xs font-medium text-ink-slate">
                                Aprobar envío — establecé la cantidad a despachar por ítem:
                              </p>
                              <div className="space-y-2">
                                {(req.lines || []).map((line) => {
                                  const key = `${req.id}_${line.id}`;
                                  return (
                                    <div key={line.id} className="flex items-center gap-3">
                                      <span className="text-xs text-warm-ash flex-1">{line.item_type}</span>
                                      <span className="text-xs font-mono text-warm-ash">
                                        (solicitado: {fmtQty(line.requested_qty, line.unit)})
                                      </span>
                                      <input
                                        type="number" min="0.001" max={line.requested_qty} step="0.001"
                                        placeholder={line.requested_qty}
                                        value={approveDrafts[key] ?? ''}
                                        onChange={(e) => setApproveDrafts((p) => ({ ...p, [key]: e.target.value }))}
                                        className="w-24 min-h-8 rounded-lg border border-slate-200 px-2 font-mono text-xs"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="text-[10px] text-warm-ash">
                                Dejá en blanco para aprobar la cantidad solicitada completa. Si aprobás menos, el sistema creará una nueva solicitud por el sobrante automáticamente.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleOpsApprove(req)}
                                disabled={requestLoading}
                                className="min-h-9 px-4 inline-flex items-center gap-1.5 rounded-xl bg-action-blue text-white text-xs font-semibold disabled:opacity-50 active:scale-[0.97]"
                              >
                                {requestLoading ? <FiLoader className="animate-spin" size={12} /> : <FiCheckCircle size={12} />}
                                Aprobar y programar despacho
                              </button>
                            </div>
                          </RoleGatedAction>
                        )}

                        {/* Logistics: confirm shipment */}
                        {req.status === 'ops_approved' && (
                          <RoleGatedAction allowedRoles={DR_LOGISTICS_CONFIRM_ROLES} userRoles={userRoles}>
                            <div className="border-t border-slate-200 pt-3 space-y-2">
                              <p className="text-xs font-medium text-ink-slate flex items-center gap-1.5">
                                <FiTruck size={12} className="text-operative-green" />
                                Confirmar despacho físico
                              </p>
                              <div className="bg-slate-50 rounded-lg p-2.5 space-y-1 text-xs">
                                {(req.lines || []).map((line) => (
                                  <div key={line.id} className="flex justify-between">
                                    <span className="text-warm-ash">{line.item_type}</span>
                                    <span className="font-mono font-medium text-ink-slate">
                                      {fmtQty(line.approved_qty ?? line.requested_qty, line.unit)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <textarea
                                value={dispatchNotesDraft[req.id] || ''}
                                onChange={(e) => setDispatchNotesDraft((p) => ({ ...p, [req.id]: e.target.value }))}
                                placeholder="Notas del despacho: transportista, guía, observaciones..."
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleConfirmDispatch(req)}
                                disabled={requestLoading}
                                className="min-h-9 px-4 inline-flex items-center gap-1.5 rounded-xl bg-operative-green text-white text-xs font-semibold disabled:opacity-50 active:scale-[0.97]"
                              >
                                {requestLoading ? <FiLoader className="animate-spin" size={12} /> : <FiTruck size={12} />}
                                Confirmar envío
                              </button>
                            </div>
                          </RoleGatedAction>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Dispatch history ──────────────────────────────────────── */}
                <div className="p-5 space-y-3">
                  <h4 className="text-xs font-semibold text-warm-ash uppercase tracking-wider flex items-center gap-1.5">
                    <FiTruck size={11} />Historial de envíos
                    {cDisps.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-mono">{cDisps.length}</span>
                    )}
                  </h4>

                  {cDisps.length === 0 ? (
                    <p className="text-xs text-warm-ash">Aún no se han registrado envíos.</p>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100 text-warm-ash">
                          <tr>
                            <th className="px-4 py-2 font-medium text-left"># Despacho</th>
                            <th className="px-4 py-2 font-medium text-left">Fecha y hora</th>
                            <th className="px-4 py-2 font-medium text-left">Ítems despachados</th>
                            <th className="px-4 py-2 font-medium text-left">Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cDisps.map((dispatch) => (
                            <tr key={dispatch.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                              <td className="px-4 py-3 font-mono text-warm-ash">#{dispatch.id}</td>
                              <td className="px-4 py-3 text-ink-slate whitespace-nowrap">{fmtDate(dispatch.dispatched_at)}</td>
                              <td className="px-4 py-3">
                                <div className="space-y-0.5">
                                  {(dispatch.lines || []).map((dl) => (
                                    <div key={dl.id} className="flex gap-2">
                                      <span className="text-warm-ash">{dl.item_type}:</span>
                                      <span className="font-mono font-medium text-ink-slate">{fmtQty(dl.dispatched_qty, dl.unit)}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-warm-ash italic max-w-xs">
                                {dispatch.notes || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SupplyControlTab;


