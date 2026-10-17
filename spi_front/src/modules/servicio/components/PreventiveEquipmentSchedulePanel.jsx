import React, { useEffect, useMemo, useState } from "react";
import Button from "../../../core/ui/components/Button";
import PreventiveOfferModal from "./PreventiveOfferModal";
import ReprogrammingNoticeModal from "./ReprogrammingNoticeModal";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import ServicioMetric from "../design/ServicioMetric";
import ServicioEmptyState from "../design/ServicioEmptyState";

const inputClass = "w-full rounded-[var(--st-radius-md)] border px-3 py-2 text-sm outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

const statusTone = (value) => {
  const status = String(value || "planned").toLowerCase();
  if (status === "completed") return "success";
  if (status === "in_execution") return "info";
  if (status === "cancelled" || status === "offer_rejected") return "danger";
  if (status === "kit_requested" || status === "kit_ready") return "accent";
  if (status === "offer_pending") return "warning";
  return "neutral";
};

const splitLines = (value) => String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);

const parseEvidenceLines = (value) => splitLines(value).map((line, index) => ({ id: `EVI-${index + 1}`, reference: line }));

const PreventiveEquipmentSchedulePanel = ({
  plan = null, compliance = null, capacity = null, busy = false,
  onIssueFst17, onIssueOffer, onOfferDecision, onReprogram, onCoordinate, onWorkOrder, onRequestKit, onWarehouseExit, onCloseExecution,
}) => {
  const items = useMemo(() => (Array.isArray(plan?.items) ? plan.items : []), [plan?.items]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [openOfferModal, setOpenOfferModal] = useState(false);
  const [openReprogramModal, setOpenReprogramModal] = useState(false);
  const [coordinationWindow, setCoordinationWindow] = useState("");
  const [workOrderNumber, setWorkOrderNumber] = useState("");
  const [kitObservations, setKitObservations] = useState("");
  const [executionDraft, setExecutionDraft] = useState({
    executed_at: "", duration_minutes: "", activities: "", parts_replaced: "", consumables: "", evidence: "", notes: "",
  });

  const selectedItem = useMemo(() => items.find((item) => Number(item.id) === Number(selectedItemId)) || items[0] || null, [items, selectedItemId]);

  useEffect(() => {
    setSelectedItemId(items[0]?.id || null);
  }, [plan?.id, items]);

  useEffect(() => {
    if (!selectedItem) return;
    setCoordinationWindow(selectedItem.coordination_window || "");
    setWorkOrderNumber(selectedItem.work_order_number || "");
    setKitObservations("");
    setExecutionDraft({ executed_at: "", duration_minutes: "", activities: "", parts_replaced: "", consumables: "", evidence: "", notes: "" });
  }, [selectedItem]);

  const complianceRate = compliance?.summary?.compliance_rate || 0;
  const pendingOffers = items.filter((item) => item.status === "offer_pending").length;
  const overloadMonths = Array.isArray(capacity?.months) ? capacity.months.filter((month) => month.over_capacity).length : 0;

  return (
    <div className="st-scope space-y-4">
      <ServicioCard className="p-4">
        <h3 className="text-base font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Cronograma preventivo por equipo (F.ST-17)</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <ServicioMetric label="Cumplimiento mensual" value={`${complianceRate}%`} />
          <ServicioMetric label="Ofertas pendientes" value={pendingOffers} />
          <ServicioMetric label="Meses sobre capacidad (Anexo 7)" value={overloadMonths} />
        </div>
      </ServicioCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ServicioCard className="xl:col-span-7 p-0">
          <div className="max-h-[62vh] overflow-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="sticky top-0" style={{ background: "var(--st-surface-sunken)", color: "var(--st-text-faint)" }}>
                <tr>
                  <th className="px-3 py-2">Equipo</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">WO</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4" style={{ color: "var(--st-text-faint)" }} colSpan={6}>Sin equipos en este plan.</td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const selected = Number(selectedItem?.id) === Number(item.id);
                    return (
                      <tr
                        key={item.id}
                        className="cursor-pointer"
                        style={{ borderTop: "1px solid var(--st-border)", background: selected ? "var(--st-accent-soft)" : "transparent" }}
                        onClick={() => setSelectedItemId(item.id)}
                      >
                        <td className="px-3 py-2 font-semibold" style={{ color: "var(--st-text)" }}>{item.equipment_name || `#${item.equipment_id}`}</td>
                        <td className="px-3 py-2" style={{ color: "var(--st-text-muted)" }}>{item.client_name || "N/D"}</td>
                        <td className="px-3 py-2" style={{ color: "var(--st-text-muted)" }}>{item.planned_date || "N/D"}</td>
                        <td className="px-3 py-2" style={{ color: "var(--st-text-muted)" }}>{item.work_order_number || "Pendiente"}</td>
                        <td className="px-3 py-2"><ServicioBadge tone={statusTone(item.status)}>{item.status}</ServicioBadge></td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="secondary" disabled={busy} onClick={(event) => { event.stopPropagation(); setSelectedItemId(item.id); setOpenOfferModal(true); }}>Oferta</Button>
                            <Button size="sm" variant="outline" disabled={busy} onClick={(event) => { event.stopPropagation(); setSelectedItemId(item.id); setOpenReprogramModal(true); }}>Reprog.</Button>
                            <Button size="sm" variant="outline" disabled={busy} onClick={(event) => { event.stopPropagation(); onIssueFst17?.(item); }}>F.ST-17</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </ServicioCard>

        <ServicioCard className="xl:col-span-5 p-4">
          {!selectedItem ? (
            <ServicioEmptyState title="Selecciona un equipo para gestionar su flujo preventivo." />
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>{selectedItem.equipment_name || `Equipo #${selectedItem.equipment_id}`}</h4>
                <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>Cliente: {selectedItem.client_name || "N/D"} · Garantía: {selectedItem.warranty_status}</p>
              </div>

              <div className="rounded-[var(--st-radius-md)] border p-3" style={{ borderColor: "var(--st-border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--st-text)" }}>Coordinación</p>
                <label className="mt-2 block text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
                  Ventana acordada
                  <input className={inputClass} style={inputStyle} value={coordinationWindow} onChange={(event) => setCoordinationWindow(event.target.value)} />
                </label>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => onCoordinate?.(selectedItem, { coordination_window: coordinationWindow || null })}>
                    Registrar coordinación
                  </Button>
                </div>
              </div>

              <div className="rounded-[var(--st-radius-md)] border p-3" style={{ borderColor: "var(--st-border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--st-text)" }}>WO y kits</p>
                <label className="mt-2 block text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
                  Número WO
                  <input className={inputClass} style={inputStyle} value={workOrderNumber} onChange={(event) => setWorkOrderNumber(event.target.value)} />
                </label>
                <label className="mt-2 block text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
                  Observaciones kit
                  <textarea className={inputClass} style={inputStyle} rows={2} value={kitObservations} onChange={(event) => setKitObservations(event.target.value)} />
                </label>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => onWorkOrder?.(selectedItem, { work_order_number: workOrderNumber || null, auto_create: !workOrderNumber })}>Guardar WO</Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRequestKit?.(selectedItem, { observations: kitObservations || null, work_order_number: workOrderNumber || selectedItem.work_order_number || null })}>Solicitar kit</Button>
                  <Button size="sm" variant="secondary" disabled={busy || !selectedItem.latest_kit_id} onClick={() => onWarehouseExit?.(selectedItem, { kit_id: selectedItem.latest_kit_id, warehouse_exit_reference: `SAL-${selectedItem.latest_kit_id}` })}>Salida bodega</Button>
                </div>
              </div>

              <div className="rounded-[var(--st-radius-md)] border p-3" style={{ borderColor: "var(--st-border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--st-text)" }}>Cierre preventivo (WO + F.ST-17 + Anexo 6)</p>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
                    Fecha de ejecución
                    <input type="datetime-local" className={inputClass} style={inputStyle} value={executionDraft.executed_at} onChange={(event) => setExecutionDraft((prev) => ({ ...prev, executed_at: event.target.value }))} />
                  </label>
                  <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
                    Duración (minutos)
                    <input type="number" min="1" className={inputClass} style={inputStyle} value={executionDraft.duration_minutes} onChange={(event) => setExecutionDraft((prev) => ({ ...prev, duration_minutes: event.target.value }))} />
                  </label>
                  <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
                    Actividades (una línea por actividad)
                    <textarea className={inputClass} style={inputStyle} rows={2} value={executionDraft.activities} onChange={(event) => setExecutionDraft((prev) => ({ ...prev, activities: event.target.value }))} />
                  </label>
                  <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
                    Partes reemplazadas (una línea por parte)
                    <textarea className={inputClass} style={inputStyle} rows={2} value={executionDraft.parts_replaced} onChange={(event) => setExecutionDraft((prev) => ({ ...prev, parts_replaced: event.target.value }))} />
                  </label>
                  <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
                    Repuestos/consumibles (una línea por item)
                    <textarea className={inputClass} style={inputStyle} rows={2} value={executionDraft.consumables} onChange={(event) => setExecutionDraft((prev) => ({ ...prev, consumables: event.target.value }))} />
                  </label>
                  <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
                    Evidencia (URL o referencia por línea)
                    <textarea className={inputClass} style={inputStyle} rows={2} value={executionDraft.evidence} onChange={(event) => setExecutionDraft((prev) => ({ ...prev, evidence: event.target.value }))} />
                  </label>
                  <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
                    Observaciones cierre
                    <textarea className={inputClass} style={inputStyle} rows={2} value={executionDraft.notes} onChange={(event) => setExecutionDraft((prev) => ({ ...prev, notes: event.target.value }))} />
                  </label>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      onCloseExecution?.(selectedItem, {
                        executed_at: executionDraft.executed_at || null,
                        duration_minutes: executionDraft.duration_minutes ? Number(executionDraft.duration_minutes) : null,
                        work_order_number: workOrderNumber || selectedItem.work_order_number || null,
                        activities: splitLines(executionDraft.activities),
                        parts_replaced: splitLines(executionDraft.parts_replaced),
                        consumables: splitLines(executionDraft.consumables),
                        evidence: parseEvidenceLines(executionDraft.evidence),
                        report_payload: { anexo_code: "Anexo 6", structured: true },
                        notes: executionDraft.notes || null,
                      })
                    }
                  >
                    Cerrar preventivo
                  </Button>
                </div>
              </div>
            </div>
          )}
        </ServicioCard>
      </div>

      <PreventiveOfferModal
        open={openOfferModal}
        onClose={() => setOpenOfferModal(false)}
        item={selectedItem}
        busy={busy}
        onIssueOffer={(payload) => {
          if (!selectedItem) return;
          onIssueOffer?.(selectedItem, payload);
        }}
        onDecision={(payload) => {
          if (!selectedItem) return;
          onOfferDecision?.(selectedItem, payload);
        }}
      />

      <ReprogrammingNoticeModal
        open={openReprogramModal}
        onClose={() => setOpenReprogramModal(false)}
        item={selectedItem}
        busy={busy}
        onSave={(payload) => {
          if (!selectedItem) return;
          onReprogram?.(selectedItem, payload);
        }}
      />
    </div>
  );
};

export default PreventiveEquipmentSchedulePanel;
