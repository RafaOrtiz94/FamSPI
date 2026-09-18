import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiX, FiCheckCircle, FiAlertTriangle, FiCheck, FiUpload, FiDownload,
  FiCamera, FiTruck,
} from "react-icons/fi";
import {
  listViaticoInvoices,
  listManualNotes,
  listPurchasesNoInvoice,
  listViaticoAnticipos,
  approveViaticoSegment,
  batchPayViaticos,
  updateViaticoStatus,
  patchViaticoInvoice,
  uploadBatchReceipt,
  exportViaticoMonthPdf,
} from "../../../../core/api/viaticosApi";
import Modal from "../../../../core/ui/components/Modal";
import ViaticosActionModal from "./ViaticosActionModal";
import {
  toMoney, fmtDate,
  EXPENSE_CATEGORIES, FOCUS,
  BTN_PRIMARY, BTN_GHOST, BTN_SUCCESS, BTN_DANGER, BTN_WARN,
  Spinner, EmptyState, StatusBadge, WorkflowBadge, AnticipoBadge,
  fileToBase64,
} from "./viaticosShared";

const getTrackedDistanceKm = (viatico) => {
  const tracked = viatico?.odometer_distance_km ?? viatico?.distance_km;
  if (tracked != null && Number.isFinite(Number(tracked))) return Number(tracked);
  const start = Number(viatico?.odometer_start_km);
  const end = Number(viatico?.odometer_end_km);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
};

function ViaticosMonthBatchModal({
  viaticos,
  monthLabel,
  collaboratorName,
  policy,
  onClose,
  onRefresh,
  showToast,
  showLoader,
  hideLoader,
  reviewerMode = "all",
  onRequestCorrection,
}) {
  const [allInvoices, setAllInvoices]     = useState([]);
  const [allNotes, setAllNotes]           = useState([]);
  const [allPurchases, setAllPurchases]   = useState([]);
  const [allAnticipos, setAllAnticipos]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState("resumen");
  const [acting, setActing]               = useState(false);

  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [correctionNote, setCorrectionNote]     = useState("");
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [receiptFile, setReceiptFile]           = useState(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState("");
  const [showBatchRejectModal, setShowBatchRejectModal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [invResults, noteResults, purchaseResults, anticipoResults] = await Promise.all([
        Promise.all(viaticos.map((v) => listViaticoInvoices(v.id).catch(() => []))),
        Promise.all(viaticos.map((v) => listManualNotes(v.id).catch(() => []))),
        Promise.all(viaticos.map((v) => listPurchasesNoInvoice(v.id).catch(() => []))),
        Promise.all(viaticos.map((v) => listViaticoAnticipos(v.id).catch(() => []))),
      ]);
      // listViaticoInvoices trae de la misma tabla tanto facturas SRI reales
      // como notas de venta manual (document_type='nota_venta_manual', sin
      // filtrar en el backend) -- se excluyen aqui para que "Facturas" no
      // duplique lo que ya se muestra por separado en la pestaña "Notas".
      setAllInvoices(invResults.flatMap((invs, i) =>
        invs.filter((inv) => inv.document_type !== "nota_venta_manual").map((inv) => ({ ...inv, _v: viaticos[i] }))
      ));
      setAllNotes(noteResults.flatMap((ns, i) => ns.map((n) => ({ ...n, _v: viaticos[i] }))));
      setAllPurchases(purchaseResults.flatMap((ps, i) => ps.map((p) => ({ ...p, _v: viaticos[i] }))));
      setAllAnticipos(anticipoResults.flat());
    } finally { setLoading(false); }
  }, [viaticos]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // allInvoices ya excluye notas de venta manual (filtrado en loadAll) --
  // aqui solo quedan facturas SRI reales.
  const invoiceTotal  = allInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
  // notesTotal usaba n.amount, un campo que no existe en esta tabla (la
  // columna real es "total") -- siempre mostraba $0.
  const notesTotal    = allNotes.reduce((s, n) => s + Number(n.total || 0), 0);
  const purchasesTotal = allPurchases.reduce((s, p) => s + Number(p.total || 0), 0);
  const batchDeclared = viaticos.reduce((s, v) => s + Number(v.amount || 0), 0);
  const batchKm       = viaticos.reduce((s, v) => s + getTrackedDistanceKm(v), 0);

  const approvable = viaticos.filter((v) => {
    const wf = String(v.workflow_status || "");
    return (wf === "aprobado_jefe" || wf === "pendiente_financiero") && v.finance_approval_status !== "approved";
  });
  const talentoApprovable = viaticos.filter((v) =>
    v.requires_talento_approval && v.talento_approval_status === "pending"
  );
  const payable    = viaticos.filter((v) => v.status === "approved");
  const rejectable = viaticos.filter((v) => v.status === "pending");

  const filteredInvoices = useMemo(() => {
    if (reviewerMode === "finance") return allInvoices.filter((inv) => inv.expense_mode === "with_card");
    if (reviewerMode === "talento") return allInvoices.filter((inv) => inv.expense_mode !== "with_card");
    return allInvoices;
  }, [allInvoices, reviewerMode]);

  const filteredPurchases = useMemo(() => {
    if (reviewerMode === "finance") return allPurchases.filter((p) => p.expense_mode === "with_card");
    if (reviewerMode === "talento") return allPurchases.filter((p) => p.expense_mode !== "with_card");
    return allPurchases;
  }, [allPurchases, reviewerMode]);

  const facturasTabLabel =
    reviewerMode === "talento" ? "Facturas (efectivo)"
    : reviewerMode === "finance" ? "Facturas (tarjeta)"
    : "Facturas";

  const tabs = [
    { id: "resumen",   label: `Resumen (${viaticos.length})` },
    { id: "facturas",  label: loading ? facturasTabLabel : `${facturasTabLabel} (${filteredInvoices.length})` },
    { id: "notas",     label: loading ? "Notas" : allNotes.length ? `Notas (${allNotes.length})` : "Notas" },
    { id: "compras",   label: loading ? "Compras sin factura" : filteredPurchases.length ? `Compras sin factura (${filteredPurchases.length})` : "Compras sin factura" },
    { id: "anticipos", label: loading ? "Anticipos" : allAnticipos.length ? `Anticipos (${allAnticipos.length})` : "Anticipos" },
  ];

  const batchApprove = async () => {
    const targets = reviewerMode === "talento" ? talentoApprovable : approvable;
    if (!targets.length) { showToast("Sin salidas para aprobar", "warning"); return; }
    setActing(true); showLoader(`Aprobando ${targets.length} salida(s)...`);
    try {
      await Promise.all(targets.map((v) => approveViaticoSegment(v.id)));
      showToast(`${targets.length} salida(s) aprobadas`, "success");
      onRefresh(); onClose();
    } catch (err) { showToast(err?.response?.data?.message || "Error aprobando", "error"); }
    finally { setActing(false); hideLoader(); }
  };

  const batchPay = async () => {
    if (!payable.length) { showToast("Sin salidas aprobadas para pagar", "warning"); return; }
    setActing(true); showLoader(`Registrando pago — ${payable.length} salida(s)...`);
    try {
      await batchPayViaticos(payable.map((v) => v.id));
      showToast(`Pago del mes registrado — ${payable.length} salida(s)`, "success");
      onRefresh(); onClose();
    } catch (err) { showToast(err?.response?.data?.message || "Error registrando pago", "error"); }
    finally { setActing(false); hideLoader(); }
  };

  const batchReject = async () => {
    if (!rejectable.length) { showToast("Sin pendientes para rechazar", "warning"); return; }
    setActing(true); showLoader("Rechazando...");
    try {
      await Promise.all(rejectable.map((v) => updateViaticoStatus(v.id, {
        status: "rejected",
        notes: batchRejectReason.trim() || null,
      })));
      showToast(`${rejectable.length} salida(s) rechazadas`, "error");
      setShowBatchRejectModal(false);
      setBatchRejectReason("");
      onRefresh(); onClose();
    } catch (err) { showToast(err?.response?.data?.message || "Error rechazando", "error"); }
    finally { setActing(false); hideLoader(); }
  };

  const patchInvoiceCat = async (invoiceId, category) => {
    try { await patchViaticoInvoice(invoiceId, { category: category || null }); await loadAll(); }
    catch { showToast("Error actualizando concepto", "error"); }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const { blob, fileName } = await exportViaticoMonthPdf(viaticos.map((v) => v.id));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // La respuesta de error tambien llega como Blob (responseType:"blob"),
      // no como JSON parseado -- no vale la pena parsearlo para un toast.
      showToast("Error generando el PDF del expediente", "error");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleSendCorrection = async (v) => {
    if (!correctionNote.trim()) return;
    setCorrectionSaving(true);
    try {
      await onRequestCorrection(v.id, correctionNote.trim());
      showToast("Correccion solicitada", "success");
      setCorrectionTarget(null); setCorrectionNote("");
      onRefresh();
    } catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
    finally { setCorrectionSaving(false); }
  };

  const canApproveAll = reviewerMode === "talento"
    ? talentoApprovable.length > 0
    : approvable.length > 0;

  const allCerrado = viaticos.every((v) => v.workflow_status === "cerrado");
  const allPaid    = viaticos.every((v) => v.status === "paid");
  const somePendingCierre = viaticos.some((v) => v.workflow_status !== "cerrado");

  return (
    <Modal open onClose={onClose} maxWidth="max-w-4xl" hideHeader>
      <ViaticosActionModal
        open={showBatchRejectModal}
        title="Rechazar salidas del expediente"
        description={`El motivo se registrará para ${rejectable.length} salida(s) pendientes del mes.`}
        label="Motivo del rechazo"
        value={batchRejectReason}
        onChange={setBatchRejectReason}
        onClose={() => {
          if (acting) return;
          setShowBatchRejectModal(false);
          setBatchRejectReason("");
        }}
        onConfirm={batchReject}
        confirmLabel="Rechazar salidas"
        placeholder="Describe el motivo del rechazo"
        multiline
        required
        loading={acting}
      />
      {/* Header */}
      <div className="bg-[#1E293B] px-5 py-4 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400">{collaboratorName}</p>
            <h2 className="mt-0.5 text-lg font-bold text-white">Expediente {monthLabel}</h2>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="font-mono">{viaticos.length} salidas operacionales</span>
              <span className="font-mono font-semibold text-slate-200">{toMoney(batchDeclared)} declarado</span>
              {!loading && <span className="font-mono">{toMoney(invoiceTotal)} en facturas</span>}
              {batchKm > 0 && <span className="font-mono text-sky-300">{batchKm.toFixed(1)} km</span>}
              {reviewerMode !== "all" && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${reviewerMode === "talento" ? "bg-violet-500/20 text-violet-200" : "bg-blue-500/20 text-blue-200"}`}>
                  {reviewerMode === "talento" ? "Vista Talento" : "Vista Finanzas"}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf || loading}
              title="Exportar PDF del expediente"
              className={`rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white disabled:opacity-50 ${FOCUS}`}
            >
              {exportingPdf ? <Spinner size={16} /> : <FiDownload size={16} />}
            </button>
            <button onClick={onClose} className={`rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white ${FOCUS}`}>
              <FiX size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      {!loading && (
        <div className="grid grid-cols-5 divide-x divide-slate-100 border-b border-slate-100 bg-white shrink-0">
          {[
            { label: "Facturas SRI",    val: toMoney(invoiceTotal),  cls: "text-slate-900" },
            { label: "Notas manuales",  val: toMoney(notesTotal),    cls: "text-slate-900" },
            { label: "Compras sin factura", val: toMoney(purchasesTotal), cls: "text-slate-900" },
            { label: "Km recorridos",   val: `${batchKm.toFixed(1)} km`, cls: "text-sky-700" },
            { label: "Total declarado", val: toMoney(batchDeclared), cls: "font-semibold text-slate-900" },
          ].map(({ label, val, cls }) => (
            <div key={label} className="px-3 py-2.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
              <p className={`mt-0.5 font-mono text-sm ${cls}`}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-slate-100 px-4 pt-1.5 overflow-x-auto shrink-0">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-semibold transition ${FOCUS} ${activeTab === t.id ? "border-b-2 border-[#2563EB] text-[#2563EB]" : "text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
            <Spinner /> Cargando datos del mes...
          </div>
        ) : (
          <>
            {/* ── Resumen ── */}
            {activeTab === "resumen" && (
              <div className="divide-y divide-slate-100">
                {viaticos.map((v) => {
                  const wf = String(v.workflow_status || "");
                  const needsFinanceApprove = (wf === "aprobado_jefe" || wf === "pendiente_financiero") && v.finance_approval_status !== "approved";
                  const needsTalentoApprove = v.requires_talento_approval && v.talento_approval_status === "pending";
                  const canCorrect = onRequestCorrection && (reviewerMode === "talento" || reviewerMode === "finance");
                  const isCorrecting = correctionTarget?.id === v.id;

                  return (
                    <div key={v.id} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-2 h-2 w-2 shrink-0 rounded-full ${v.status === "approved" ? "bg-[#16A34A]" : v.status === "paid" ? "bg-[#2563EB]" : v.status === "rejected" ? "bg-[#DC2626]" : "bg-[#D97706]"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-slate-500">{fmtDate(v.visit_date)}</span>
                            {v.city && <span className="text-xs text-slate-700">{v.city}</span>}
                            <StatusBadge status={v.status} />
                            <WorkflowBadge status={v.workflow_status} />
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                            <span className="font-mono">{toMoney(v.amount || 0)}</span>
                            {Number(v.invoices_count || 0) > 0 && <span>{v.invoices_count} facturas</span>}
                            {Number(v.final_balance_amount || 0) > 0 && (
                              <span className={`font-mono font-semibold ${v.final_balance_result === "por_devolver" ? "text-[#DC2626]" : "text-[#16A34A]"}`}>
                                {v.final_balance_result === "por_devolver" ? "Saldo a devolver" : "Valor a pagar"}: {toMoney(v.final_balance_amount)}
                              </span>
                            )}
                            {v.uses_personal_vehicle ? (
                              <span className="inline-flex items-center gap-1 font-mono text-sky-700">
                                <FiTruck size={11} /> {getTrackedDistanceKm(v).toFixed(1)} km en vehiculo personal
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500"><FiTruck size={11} /> Sin vehiculo personal</span>
                            )}
                          </div>
                          {v.uses_personal_vehicle && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                              {v.odometer_start_km != null && <span className="font-mono text-slate-600">Inicio: {Number(v.odometer_start_km).toFixed(1)} km</span>}
                              {v.odometer_end_km != null && <span className="font-mono text-slate-600">Fin: {Number(v.odometer_end_km).toFixed(1)} km</span>}
                              {v.odometer_start_photo_drive_url && (
                                <a href={v.odometer_start_photo_drive_url} target="_blank" rel="noopener noreferrer"
                                  className={`inline-flex min-h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-700 active:scale-[0.97] ${FOCUS}`}>
                                  <FiCamera size={11} /> Foto inicial
                                </a>
                              )}
                              {v.odometer_end_photo_drive_url && (
                                <a href={v.odometer_end_photo_drive_url} target="_blank" rel="noopener noreferrer"
                                  className={`inline-flex min-h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-700 active:scale-[0.97] ${FOCUS}`}>
                                  <FiCamera size={11} /> Foto final
                                </a>
                              )}
                            </div>
                          )}
                          {v.reviewer_observation && (
                            <p className="mt-1.5 rounded-lg border border-orange-100 bg-orange-50 px-2.5 py-1.5 text-[11px] text-orange-800 italic">
                              "{v.reviewer_observation}"
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex gap-1.5 flex-wrap justify-end">
                          {reviewerMode === "finance" && needsFinanceApprove && (
                            <button disabled={acting} onClick={async () => {
                              showLoader("Aprobando...");
                              try { await approveViaticoSegment(v.id); showToast("Aprobado", "success"); await loadAll(); onRefresh(); }
                              catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
                              finally { hideLoader(); }
                            }} className={`${BTN_SUCCESS} text-xs min-h-8 px-3 rounded-lg`}>
                              <FiCheckCircle size={12} /> Aprobar
                            </button>
                          )}
                          {reviewerMode === "talento" && needsTalentoApprove && (
                            <button disabled={acting} onClick={async () => {
                              showLoader("Aprobando...");
                              try { await approveViaticoSegment(v.id); showToast("Aprobado por talento", "success"); await loadAll(); onRefresh(); }
                              catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
                              finally { hideLoader(); }
                            }} className={`${BTN_SUCCESS} text-xs min-h-8 px-3 rounded-lg`}>
                              <FiCheckCircle size={12} /> Aprobar
                            </button>
                          )}
                          {canCorrect && !isCorrecting && (
                            <button onClick={() => { setCorrectionTarget(v); setCorrectionNote(""); }}
                              className={`${BTN_WARN} text-xs min-h-8 px-3 rounded-lg`}>
                              <FiAlertTriangle size={11} /> Correccion
                            </button>
                          )}
                        </div>
                      </div>

                      {isCorrecting && (
                        <div className="mt-3 ml-5 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-amber-800">Indicar que debe corregir el declarante</p>
                          <textarea
                            rows={3}
                            value={correctionNote}
                            onChange={(e) => setCorrectionNote(e.target.value)}
                            placeholder="Ej: La factura no esta en rango de fechas. Por favor reemplazar."
                            className="w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
                          />
                          <div className="flex gap-2">
                            <button disabled={correctionSaving || !correctionNote.trim()}
                              onClick={() => handleSendCorrection(v)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                              {correctionSaving ? <Spinner size={12} /> : <FiCheck size={12} />}
                              Enviar correccion
                            </button>
                            <button onClick={() => setCorrectionTarget(null)} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Facturas ── */}
            {activeTab === "facturas" && (
              <div className="px-5 py-4">
                {filteredInvoices.length === 0 ? (
                  <EmptyState title={
                    reviewerMode === "talento" ? "Sin gastos en efectivo este mes"
                    : reviewerMode === "finance" ? "Sin gastos con tarjeta este mes"
                    : "Sin facturas en este mes"
                  } />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-[#1E293B] text-[10px] uppercase tracking-wider text-slate-300">
                        <tr>
                          <th className="px-3 py-2.5 text-left">Salida</th>
                          <th className="px-3 py-2.5 text-left">Emisor</th>
                          <th className="px-3 py-2.5 text-left">Comprobante</th>
                          <th className="px-3 py-2.5 text-left">Fecha</th>
                          <th className="px-3 py-2.5 text-left">Concepto</th>
                          <th className="px-3 py-2.5 text-left">Modo</th>
                          <th className="px-3 py-2.5 text-right">Total</th>
                          <th className="px-3 py-2.5 text-center">Rango</th>
                          <th className="px-3 py-2.5 text-center">Doc.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredInvoices.map((inv) => {
                          const docLink = inv.document_drive_link || null;
                          return (
                          <tr key={inv.id} className={`hover:bg-slate-50 ${!inv.in_trip_date_range ? "opacity-60" : ""}`}>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-400 whitespace-nowrap">{fmtDate(inv._v?.visit_date)}</td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-800 truncate max-w-[130px]">{inv.supplier_name || "—"}</p>
                              <p className="font-mono text-[10px] text-slate-400">{inv.supplier_ruc}</p>
                            </td>
                            <td className="px-3 py-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                              {[inv.establishment, inv.emission_point, inv.sequential].filter(Boolean).join("-") || "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">{fmtDate(inv.issue_date)}</td>
                            <td className="px-3 py-2">
                              <select value={inv.category || ""}
                                onChange={(e) => patchInvoiceCat(inv.id, e.target.value)}
                                className="min-h-8 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]">
                                <option value="">Sin clasificar</option>
                                {EXPENSE_CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${inv.expense_mode === "with_card" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                                {inv.expense_mode === "with_card" ? "Con tarjeta" : "Sin tarjeta"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{toMoney(inv.total)}</td>
                            <td className="px-3 py-2 text-center">
                              {inv.in_trip_date_range
                                ? <FiCheckCircle size={13} className="mx-auto text-[#16A34A]" />
                                : <FiAlertTriangle size={13} className="mx-auto text-[#D97706]" />}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {docLink ? (
                                <a href={docLink} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[#2563EB] hover:underline">
                                  <FiCamera size={12} />
                                </a>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500">Total</td>
                          <td className="px-3 py-2 text-right font-mono text-sm font-bold text-slate-900">
                            {toMoney(filteredInvoices.reduce((s, i) => s + Number(i.total || 0), 0))}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Notas manuales ── */}
            {activeTab === "notas" && (
              <div className="px-5 py-4">
                {allNotes.length === 0 ? (
                  <EmptyState title="Sin notas manuales en este mes" />
                ) : (
                  <div className="space-y-2">
                    {allNotes.map((n, idx) => {
                      const docLink = n.document_drive_link || n.drive_link || null;
                      return (
                      <div key={n.id || idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{n.supplier_name || n.details_text || "—"}</p>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                            <span className="font-mono">{fmtDate(n.issue_date || n._v?.visit_date)}</span>
                            <span className="font-mono">{n.supplier_ruc}</span>
                            <span className={`rounded-full px-1.5 py-0.5 font-semibold ${n.expense_mode === "with_card" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                              {n.expense_mode === "with_card" ? "Con tarjeta" : "Sin tarjeta"}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {docLink && (
                            <a href={docLink} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline">
                              <FiCamera size={12} /> Ver
                            </a>
                          )}
                          <span className="font-mono text-sm font-semibold text-slate-800">{toMoney(n.total)}</span>
                        </div>
                      </div>
                      );
                    })}
                    <div className="flex justify-end pt-1">
                      <span className="text-xs text-slate-500">Total: <span className="font-mono font-semibold">{toMoney(notesTotal)}</span></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Compras sin factura ── */}
            {activeTab === "compras" && (
              <div className="px-5 py-4">
                {filteredPurchases.length === 0 ? (
                  <EmptyState title="Sin compras sin factura en este mes" />
                ) : (
                  <div className="space-y-2">
                    {filteredPurchases.map((p) => {
                      const docLink = p.document_drive_link || null;
                      return (
                        <div key={p.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800">{p.description || "—"}</p>
                              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                <span className="font-mono">{fmtDate(p.purchase_date)}</span>
                                <span className={`rounded-full px-1.5 py-0.5 font-semibold ${p.expense_mode === "with_card" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                                  {p.expense_mode === "with_card" ? "Con tarjeta" : "Sin tarjeta"}
                                </span>
                                <span className="font-mono">{fmtDate(p._v?.visit_date)}</span>
                              </div>
                              {p.justification && (
                                <p className="mt-1 text-[11px] italic text-slate-500">{p.justification}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <span className="font-mono text-sm font-semibold text-slate-800">{toMoney(p.total)}</span>
                              {docLink ? (
                                <a href={docLink} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline">
                                  <FiCamera size={12} /> Ver justificante
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                                  <FiAlertTriangle size={11} /> Sin justificante
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-end pt-1">
                      <span className="text-xs text-slate-500">Total: <span className="font-mono font-semibold">{toMoney(filteredPurchases.reduce((s, p) => s + Number(p.total || 0), 0))}</span></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Anticipos ── */}
            {activeTab === "anticipos" && (
              <div className="px-5 py-4">
                {allAnticipos.length === 0 ? (
                  <EmptyState title="Sin anticipos en este mes" />
                ) : (
                  <div className="space-y-3">
                    {allAnticipos.map((a) => (
                      <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-base font-bold text-slate-900">{toMoney(a.amount)}</span>
                          <AnticipoBadge status={a.status} />
                        </div>
                        {a.purpose && <p className="text-xs text-slate-600">{a.purpose}</p>}
                        {a.status === "applied" && a.applied_amount != null && (
                          <div className="rounded-lg bg-slate-50 p-2.5 text-xs space-y-1 border border-slate-100">
                            <div className="flex justify-between"><span className="text-slate-500">Anticipo:</span><span className="font-mono">{toMoney(a.amount)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Gasto real:</span><span className="font-mono">{toMoney(a.applied_amount)}</span></div>
                            <div className={`flex justify-between font-semibold ${Number(a.difference_amount || 0) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                              <span>{Number(a.difference_amount || 0) >= 0 ? "Devolucion:" : "Diferencia:"}</span>
                              <span className="font-mono">{toMoney(Math.abs(Number(a.difference_amount || 0)))}</span>
                            </div>
                          </div>
                        )}
                        <p className="text-[11px] text-slate-400">{fmtDate(a.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-white px-5 py-3.5 shrink-0 space-y-3">
        {/* Cierre con comprobante — talento */}
        {reviewerMode === "talento" && allPaid && somePendingCierre && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <FiCheckCircle size={14} className="mt-0.5 shrink-0 text-[#16A34A]" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">Mes pagado — sube el comprobante para cerrar</p>
                <p className="text-[11px] text-emerald-700">El comprobante sera visible para el declarante.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 transition">
                <FiUpload size={12} className="text-emerald-600" />
                {receiptFile ? receiptFile.name : "Elegir comprobante (PDF / imagen)"}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
              </label>
              {receiptFile && (
                <button disabled={receiptUploading}
                  onClick={async () => {
                    setReceiptUploading(true);
                    try {
                      const base64 = await fileToBase64(receiptFile);
                      await uploadBatchReceipt({ allowance_ids: viaticos.map((v) => v.id), file_base64: base64, file_name: receiptFile.name });
                      showToast("Comprobante subido — expediente cerrado", "success");
                      setReceiptFile(null);
                      onRefresh(); onClose();
                    } catch (err) { showToast(err?.response?.data?.message || "Error subiendo comprobante", "error"); }
                    finally { setReceiptUploading(false); }
                  }}
                  className={`${BTN_SUCCESS} text-xs`}>
                  {receiptUploading ? <Spinner size={13} /> : <FiCheck size={13} />}
                  Subir y cerrar
                </button>
              )}
              {receiptFile && (
                <button onClick={() => setReceiptFile(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
              )}
            </div>
          </div>
        )}

        {/* Expediente ya cerrado */}
        {allCerrado && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
            <FiCheckCircle size={14} className="text-[#16A34A]" />
            <span className="text-xs font-semibold text-slate-700">Expediente cerrado</span>
            {viaticos[0]?.payment_receipt_drive_url && (
              <a href={viaticos[0].payment_receipt_drive_url} target="_blank" rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline">
                <FiDownload size={11} /> Ver comprobante
              </a>
            )}
          </div>
        )}

        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-2">
          {reviewerMode !== "talento" && canApproveAll && (
            <button disabled={acting} onClick={batchApprove} className={BTN_SUCCESS}>
              <FiCheckCircle size={14} />
              Aprobar {reviewerMode === "finance" ? approvable.length : talentoApprovable.length} salida(s)
            </button>
          )}
          {reviewerMode === "talento" && canApproveAll && (
            <button disabled={acting} onClick={batchApprove} className={BTN_SUCCESS}>
              <FiCheckCircle size={14} /> Aprobar {talentoApprovable.length} salida(s)
            </button>
          )}
          {reviewerMode !== "talento" && payable.length > 0 && (
            <button disabled={acting} onClick={batchPay} className={BTN_PRIMARY}>
              <FiCheckCircle size={14} /> Pagar {payable.length} salida(s)
            </button>
          )}
          {reviewerMode !== "talento" && rejectable.length > 0 && (
            <button
              disabled={acting}
              onClick={() => {
                setBatchRejectReason("");
                setShowBatchRejectModal(true);
              }}
              className={BTN_DANGER}
            >
              Rechazar mes
            </button>
          )}
          <button onClick={onClose} className={`${BTN_GHOST} ml-auto`}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}

export default ViaticosMonthBatchModal;
