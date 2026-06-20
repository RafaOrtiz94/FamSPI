import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  FiChevronRight, FiChevronLeft, FiCheck, FiX, FiUpload, FiAlertCircle,
  FiAlertTriangle, FiCheckCircle, FiRefreshCw, FiFileText, FiSkipForward,
} from "react-icons/fi";
import {
  previewViaticoInvoicesTxt,
  uploadViaticoInvoicesTxt,
  addViaticoDocument,
  listViaticoInvoices,
  createManualNote,
  listManualNotes,
  updateManualNote,
  deleteManualNote,
  createPurchaseNoInvoice,
  listPurchasesNoInvoice,
  listViaticos,
  submitViaticoForReview,
} from "../../../../core/api/viaticosApi";
import { useUI } from "../../../../core/ui/UIContext";
import ManualNoteForm from "./ManualNoteForm";
import ManualNotesTable from "./ManualNotesTable";
import PurchaseNoInvoiceForm from "./PurchaseNoInvoiceForm";
import PurchaseNoInvoiceTable from "./PurchaseNoInvoiceTable";
import ConsolidatedSummary from "./ConsolidatedSummary";

// ── Constantes ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { value: "combustible", label: "COMBUSTIBLE" },
  { value: "alimentacion", label: "ALIMENTACIÓN" },
  { value: "hospedaje", label: "HOSPEDAJE" },
  { value: "transporte", label: "TRANSPORTE" },
  { value: "movilidad", label: "MOVILIDAD" },
  { value: "materiales", label: "MATERIALES" },
];

const EXPENSE_MODES = [
  { value: "with_card", label: "Con tarjeta", settlement: "Pago al banco", approver: "Financiero" },
  { value: "without_card", label: "Sin tarjeta", settlement: "Devolucion", approver: "Talento humano" },
];

const INV_STATUS_BADGE = {
  pendiente_clasificacion: "bg-amber-100 text-amber-700",
  clasificada: "bg-sky-100 text-sky-700",
  aprobada: "bg-emerald-100 text-emerald-700",
  rechazada: "bg-rose-100 text-rose-700",
};

const STEPS = [
  { id: 1, label: "Facturas SRI" },
  { id: 2, label: "Notas manuales" },
  { id: 3, label: "Compras sin factura" },
  { id: 4, label: "Resumen" },
];

const toMoney = (v) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(
    Number.isFinite(Number(v)) ? Number(v) : 0
  );

const fmtDate = (v) => {
  if (!v) return "—";
  return String(v).slice(0, 10);
};

const getModeBreakdown = ({ invoices = [], manualNotes = [], purchases = [] }) => {
  const totals = {
    with_card: { total: 0, count: 0 },
    without_card: { total: 0, count: 0 },
  };

  [...invoices, ...manualNotes, ...purchases].forEach((item) => {
    const mode = item?.expense_mode;
    if (!totals[mode]) return;
    totals[mode].total += Number(item.total || 0);
    totals[mode].count += 1;
  });

  return totals;
};

const focusClass = "focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2";
const primaryBtn = `${focusClass} inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60`;
const secondaryBtn = `${focusClass} inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60`;
const ghostBtn = `${focusClass} inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60`;

// ── Componente principal ──────────────────────────────────────────────────────

export default function ViaticosWizard({ allowances = [], onClose, onComplete }) {
  const { showToast, showLoader, hideLoader } = useUI();

  const [allowanceIndex, setAllowanceIndex] = useState(0);
  const [step, setStep] = useState(1);
  const [processedIds, setProcessedIds] = useState([]);
  const [doneScreen, setDoneScreen] = useState(false);

  const currentAllowance = allowances[allowanceIndex] || null;
  const totalAllowances = allowances.length;

  // ── Estado Paso 1: TXT ────────────────────────────────────────────────────

  const [txtFile, setTxtFile] = useState(null);
  const [txtContent, setTxtContent] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [existingInvoices, setExistingInvoices] = useState([]);

  // ── Estado Paso 2: Notas ──────────────────────────────────────────────────

  const [manualNotes, setManualNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  // ── Estado Paso 3: Compras ────────────────────────────────────────────────

  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchaseSaving, setPurchaseSaving] = useState(false);

  // ── Estado Paso 4: Resumen ────────────────────────────────────────────────

  const [freshAllowance, setFreshAllowance] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Inicialización por viático ────────────────────────────────────────────

  const resetStepState = useCallback(() => {
    setStep(1);
    setTxtFile(null);
    setTxtContent("");
    setPreviewing(false);
    setPreviewData(null);
    setInvoiceRows([]);
    setUploading(false);
    setUploadDone(false);
    setExistingInvoices([]);
    setManualNotes([]);
    setNotesLoading(false);
    setNoteSaving(false);
    setPurchases([]);
    setPurchasesLoading(false);
    setPurchaseSaving(false);
    setFreshAllowance(null);
    setSummaryLoading(false);
    setSubmitting(false);
    setSubmitted(false);
  }, []);

  useEffect(() => {
    if (!currentAllowance) return;
    resetStepState();
    // cargar facturas existentes para saber si el paso 1 es saltable
    listViaticoInvoices(currentAllowance.id)
      .then((data) => setExistingInvoices(Array.isArray(data) ? data : []))
      .catch(() => setExistingInvoices([]));
  }, [allowanceIndex, currentAllowance?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carga al entrar a cada paso ───────────────────────────────────────────

  useEffect(() => {
    if (!currentAllowance) return;
    if (step === 2) {
      setNotesLoading(true);
      listManualNotes(currentAllowance.id)
        .then((d) => setManualNotes(Array.isArray(d) ? d : []))
        .catch(() => setManualNotes([]))
        .finally(() => setNotesLoading(false));
    }
    if (step === 3) {
      setPurchasesLoading(true);
      listPurchasesNoInvoice(currentAllowance.id)
        .then((d) => setPurchases(Array.isArray(d) ? d : []))
        .catch(() => setPurchases([]))
        .finally(() => setPurchasesLoading(false));
    }
    if (step === 4) {
      setSummaryLoading(true);
      listViaticos({ start_date: "2020-01-01", end_date: "2099-12-31" })
        .then((list) => {
          const found = Array.isArray(list) ? list.find((a) => a.id === currentAllowance.id) : null;
          setFreshAllowance(found || currentAllowance);
          setSubmitted([
            "pendiente_revision",
            "aprobado_jefe",
            "rechazado_jefe",
            "pendiente_financiero",
            "aprobado_financiero",
            "rechazado_financiero",
            "pendiente_aprobacion_talento",
            "pendiente_aprobacion_financiera",
            "pendiente_aprobacion_mixta",
            "aprobado_talento_humano",
            "aprobado_financiero",
            "aprobado_mixto",
            "devolucion_registrada",
            "pago_banco_registrado",
            "cierre_mixto_registrado",
            "listo_pago",
            "pagado",
            "cerrado",
          ].includes(String(found?.workflow_status || "").toLowerCase()));
        })
        .catch(() => setFreshAllowance(currentAllowance))
        .finally(() => setSummaryLoading(false));
    }
  }, [step, allowanceIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Paso 1: handlers TXT ──────────────────────────────────────────────────

  const handleFileChange = useCallback((file) => {
    if (!file) return;
    setTxtFile(file);
    setPreviewData(null);
    setInvoiceRows([]);
    setUploadDone(false);
    const reader = new FileReader();
    reader.onload = (e) => setTxtContent(e.target.result || "");
    reader.readAsText(file, "utf-8");
  }, []);

  const handlePreview = useCallback(async () => {
    if (!txtContent || !currentAllowance) return;
    setPreviewing(true);
    try {
      const data = await previewViaticoInvoicesTxt(currentAllowance.id, txtContent);
      setPreviewData(data);
      const rows = (data.in_range || []).map((inv) => ({
        ...inv,
        selected: true,
        category: "",
        expense_mode: "",
        file: null,
      }));
      setInvoiceRows(rows);
    } catch (err) {
      showToast(err?.response?.data?.message || "Error analizando TXT", "error");
    } finally {
      setPreviewing(false);
    }
  }, [txtContent, currentAllowance, showToast]);

  const toggleInvoice = (idx) => {
    setInvoiceRows((prev) =>
      prev.map((row, i) =>
        i === idx && row.in_trip_date_range ? { ...row, selected: !row.selected } : row
      )
    );
  };

  const setCategoryForRow = (idx, category) => {
    setInvoiceRows((prev) => prev.map((row, i) => (i === idx ? { ...row, category } : row)));
  };

  const setExpenseModeForRow = (idx, expenseMode) => {
    setInvoiceRows((prev) => prev.map((row, i) => (i === idx ? { ...row, expense_mode: expenseMode } : row)));
  };

  const setFileForRow = (idx, file) => {
    setInvoiceRows((prev) => prev.map((row, i) => (i === idx ? { ...row, file } : row)));
  };

  const selectedRows = invoiceRows.filter((r) => r.selected && r.in_trip_date_range);
  const uncategorizedSelected = selectedRows.filter((r) => !r.category);
  const unmodeSelected = selectedRows.filter((r) => !r.expense_mode);
  const canUpload = selectedRows.length > 0 && uncategorizedSelected.length === 0 && unmodeSelected.length === 0;

  const handleUpload = useCallback(async () => {
    if (!currentAllowance || !canUpload) return;
    setUploading(true);
    showLoader("Cargando facturas...");
    try {
      const categories = {};
      selectedRows.forEach((r) => {
        if (r.access_key && r.category && r.expense_mode) {
          categories[r.access_key] = { category: r.category, expense_mode: r.expense_mode };
        }
      });
      const result = await uploadViaticoInvoicesTxt(currentAllowance.id, txtContent, categories, { flow: "wizard" });
      showToast(`${result.loaded} factura${result.loaded !== 1 ? "s" : ""} cargada${result.loaded !== 1 ? "s" : ""}`, "success");

      // subir documentos de respaldo si hay archivos adjuntos
      const rowsWithFile = selectedRows.filter((r) => r.file);
      for (const row of rowsWithFile) {
        try {
          await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                const base64 = e.target.result.split(",")[1];
                await addViaticoDocument(currentAllowance.id, {
                  doc_type: "support",
                  file_base64: base64,
                  file_name: row.file.name,
                  notes: `Respaldo factura ${row.supplier_name || row.supplier_ruc || row.access_key}`,
                });
                resolve();
              } catch (uploadErr) {
                reject(uploadErr);
              }
            };
            reader.readAsDataURL(row.file);
          });
        } catch {
          // documento de respaldo falla silenciosamente, la factura ya quedó guardada
        }
      }

      setUploadDone(true);
      // refrescar existingInvoices
      const updated = await listViaticoInvoices(currentAllowance.id).catch(() => []);
      setExistingInvoices(Array.isArray(updated) ? updated : []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Error cargando facturas", "error");
    } finally {
      hideLoader();
      setUploading(false);
    }
  }, [currentAllowance, canUpload, selectedRows, txtContent, showLoader, hideLoader, showToast]);

  // ── Paso 2: handlers notas ────────────────────────────────────────────────

  const handleCreateNote = useCallback(async (payload) => {
    if (!currentAllowance) return;
    setNoteSaving(true);
    try {
      await createManualNote(currentAllowance.id, payload, { flow: "wizard" });
      showToast("Nota agregada", "success");
      const updated = await listManualNotes(currentAllowance.id);
      setManualNotes(Array.isArray(updated) ? updated : []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Error agregando nota", "error");
    } finally {
      setNoteSaving(false);
    }
  }, [currentAllowance, showToast]);

  const handleUpdateNote = useCallback(async (noteId, payload) => {
    if (!currentAllowance) return;
    try {
      await updateManualNote(noteId, payload, { flow: "wizard" });
      showToast("Nota actualizada", "success");
      const updated = await listManualNotes(currentAllowance.id);
      setManualNotes(Array.isArray(updated) ? updated : []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Error actualizando nota", "error");
    }
  }, [currentAllowance, showToast]);

  const handleDeleteNote = useCallback(async (noteId) => {
    if (!currentAllowance) return;
    try {
      await deleteManualNote(noteId, { flow: "wizard" });
      showToast("Nota eliminada", "success");
      const updated = await listManualNotes(currentAllowance.id);
      setManualNotes(Array.isArray(updated) ? updated : []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Error eliminando nota", "error");
    }
  }, [currentAllowance, showToast]);

  // ── Paso 3: handlers compras ──────────────────────────────────────────────

  const handleCreatePurchase = useCallback(async (payload) => {
    if (!currentAllowance) return;
    setPurchaseSaving(true);
    try {
      await createPurchaseNoInvoice(currentAllowance.id, payload, { flow: "wizard" });
      showToast("Compra agregada", "success");
      const updated = await listPurchasesNoInvoice(currentAllowance.id);
      setPurchases(Array.isArray(updated) ? updated : []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Error agregando compra", "error");
    } finally {
      setPurchaseSaving(false);
    }
  }, [currentAllowance, showToast]);

  // ── Paso 4: envío a revisión ──────────────────────────────────────────────

  const handleSubmitForReview = useCallback(async () => {
    if (!currentAllowance) return;
    setSubmitting(true);
    showLoader("Enviando a revisión...");
    try {
      await submitViaticoForReview(currentAllowance.id);
      showToast("Viático enviado para revisión", "success");
      setSubmitted(true);
      setProcessedIds((prev) => [...prev.filter((id) => id !== currentAllowance.id), currentAllowance.id]);
    } catch (err) {
      showToast(err?.response?.data?.message || "Error enviando a revisión", "error");
    } finally {
      hideLoader();
      setSubmitting(false);
    }
  }, [currentAllowance, showLoader, hideLoader, showToast]);

  // ── Navegación ────────────────────────────────────────────────────────────

  const goNext = () => setStep((s) => Math.min(4, s + 1));
  const goPrev = () => setStep((s) => Math.max(1, s - 1));

  const handleNextAllowance = () => {
    if (allowanceIndex + 1 < totalAllowances) {
      setAllowanceIndex((i) => i + 1);
      resetStepState();
    } else {
      setDoneScreen(true);
    }
  };

  const handleFinish = () => {
    if (onComplete) onComplete(processedIds);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!currentAllowance && !doneScreen) return null;

  if (doneScreen) {
    return (
      <div className="flex flex-col">
        <div className="border-b border-slate-100 bg-slate-900 p-5">
          <h3 className="text-lg font-bold text-white">Proceso completado</h3>
          <p className="mt-1 text-sm text-slate-300">{totalAllowances} viático{totalAllowances !== 1 ? "s" : ""} procesado{totalAllowances !== 1 ? "s" : ""}</p>
        </div>
        <div className="p-5 space-y-3">
          {allowances.map((a) => {
            const wasProcessed = processedIds.includes(a.id);
            return (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{a.city || `Viático #${a.id}`}</p>
                  <p className="text-xs text-slate-500">{fmtDate(a.visit_date)}</p>
                </div>
                {wasProcessed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <FiCheck size={12} /> Enviado a revisión
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    <FiAlertCircle size={12} /> Guardado como borrador
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="border-t border-slate-100 p-4 flex justify-end">
          <button type="button" onClick={handleFinish} className={primaryBtn}>
            <FiCheck size={14} /> Cerrar
          </button>
        </div>
      </div>
    );
  }

  const tripLabel = currentAllowance.city
    ? `${currentAllowance.city} · ${fmtDate(currentAllowance.visit_date)}`
    : `#${currentAllowance.id} · ${fmtDate(currentAllowance.visit_date)}`;

  const canSkipStep1 = existingInvoices.length > 0;

  return (
    <div className="flex min-h-0 flex-col">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-900 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Viático {allowanceIndex + 1} de {totalAllowances}
            </p>
            <h3 className="mt-0.5 text-lg font-bold text-white">{tripLabel}</h3>
          </div>
          <button type="button" onClick={onClose} className={`${ghostBtn} text-slate-300 hover:bg-slate-700 hover:text-white`}>
            <FiX size={18} />
          </button>
        </div>

        {/* Indicador de pasos */}
        <div className="mt-4 flex items-center gap-1">
          {STEPS.map((s, idx) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  s.id === step ? "bg-blue-500 text-white" :
                  s.id < step ? "bg-emerald-500 text-white" :
                  "bg-slate-700 text-slate-300"
                }`}>
                  {s.id < step ? <FiCheck size={12} /> : s.id}
                </div>
                <span className={`hidden sm:block text-[10px] font-medium truncate ${s.id === step ? "text-slate-200" : "text-slate-500"}`}>
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 transition-colors ${s.id < step ? "bg-emerald-500" : "bg-slate-700"}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Cuerpo — cada paso se mantiene montado pero oculto para no perder estado de formularios */}
      <div className="p-4 sm:p-5">

        {/* Paso 1 — TXT */}
        <div style={{ display: step === 1 ? "block" : "none" }}>
          <Step1Txt
            allowance={currentAllowance}
            txtFile={txtFile}
            previewing={previewing}
            previewData={previewData}
            invoiceRows={invoiceRows}
            uploading={uploading}
            uploadDone={uploadDone}
            existingInvoices={existingInvoices}
            selectedRows={selectedRows}
            uncategorizedSelected={uncategorizedSelected}
            unmodeSelected={unmodeSelected}
            onFileChange={handleFileChange}
            onPreview={handlePreview}
            onToggleInvoice={toggleInvoice}
            onSetCategory={setCategoryForRow}
            onSetExpenseMode={setExpenseModeForRow}
            onSetFile={setFileForRow}
            onUpload={handleUpload}
          />
        </div>

        {/* Paso 2 — Notas */}
        <div style={{ display: step === 2 ? "block" : "none" }}>
          <Step2Notes
            allowance={currentAllowance}
            notes={manualNotes}
            loading={notesLoading}
            saving={noteSaving}
            onCreate={handleCreateNote}
            onUpdate={handleUpdateNote}
            onDelete={handleDeleteNote}
          />
        </div>

        {/* Paso 3 — Compras */}
        <div style={{ display: step === 3 ? "block" : "none" }}>
          <Step3Purchases
            allowance={currentAllowance}
            purchases={purchases}
            loading={purchasesLoading}
            saving={purchaseSaving}
            onCreate={handleCreatePurchase}
          />
        </div>

        {/* Paso 4 — Resumen */}
        <div style={{ display: step === 4 ? "block" : "none" }}>
          <Step4Summary
            allowance={freshAllowance || currentAllowance}
            loading={summaryLoading}
            submitted={submitted}
            submitting={submitting}
            existingInvoices={existingInvoices}
            manualNotes={manualNotes}
            purchases={purchases}
            previewRows={invoiceRows}
            onSubmit={handleSubmitForReview}
          />
        </div>
      </div>

      {/* Footer navegación */}
      <div className="border-t border-slate-100 p-4 flex items-center justify-between gap-3 sm:p-5">
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 1}
          className={secondaryBtn}
        >
          <FiChevronLeft size={16} /> Anterior
        </button>

        <div className="flex items-center gap-2">
          {/* Saltar paso (solo pasos 1, 2, 3 y cuando aplica) */}
          {step === 1 && canSkipStep1 && !uploadDone && (
            <button type="button" onClick={goNext} className={ghostBtn}>
              <FiSkipForward size={14} /> Saltar
            </button>
          )}
          {(step === 2 || step === 3) && (
            <button type="button" onClick={goNext} className={ghostBtn}>
              <FiSkipForward size={14} /> Saltar
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={step === 1 && previewData && !uploadDone && !canSkipStep1}
              className={primaryBtn}
            >
              Siguiente <FiChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNextAllowance}
              className={primaryBtn}
            >
              {allowanceIndex + 1 < totalAllowances ? (
                <>Siguiente viático <FiChevronRight size={16} /></>
              ) : (
                <><FiCheck size={14} /> Finalizar</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Paso 1 ────────────────────────────────────────────────────────────────────

function Step1Txt({
  allowance, txtFile, previewing, previewData, invoiceRows, uploading, uploadDone,
  existingInvoices, selectedRows, uncategorizedSelected, unmodeSelected,
  onFileChange, onPreview, onToggleInvoice, onSetCategory, onSetExpenseMode, onSetFile, onUpload,
}) {
  const fileInputRef = useRef(null);

  const inRangeRows = invoiceRows.filter((r) => r.in_trip_date_range);
  const existingInvoiceTotal = existingInvoices.reduce((sum, row) => sum + Number(row.total || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Facturas SRI — archivo TXT</p>
        <p className="mt-1 text-xs text-slate-500 leading-5">
          Descarga el archivo <strong>RUC_Recibidos.txt</strong> desde el portal del SRI y súbelo aquí.
          Solo se cargarán las facturas dentro del rango de fechas de la salida operacional.
        </p>
      </div>

      {/* Upload zona */}
      <div
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          txtFile ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        />
        {txtFile ? (
          <div className="flex flex-col items-center gap-2">
            <FiFileText className="h-8 w-8 text-blue-500" />
            <p className="text-sm font-semibold text-blue-900">{txtFile.name}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className={secondaryBtn}>
                Cambiar archivo
              </button>
              {!previewData && (
                <button type="button" onClick={onPreview} disabled={previewing} className={`${`inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60`}`}>
                  {previewing ? <><FiRefreshCw className="animate-spin" size={14} /> Analizando...</> : <><FiFileText size={14} /> Analizar TXT</>}
                </button>
              )}
            </div>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-2" htmlFor="wizard-txt-input">
            <FiUpload className="h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600">Haz click para seleccionar el archivo TXT</p>
            <input id="wizard-txt-input" type="file" accept=".txt,text/plain" className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
          </label>
        )}
      </div>

      {/* Preview tabla */}
      {previewData && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {inRangeRows.length} en rango
              </span>
              <span className="text-xs text-slate-500">
                Rango: {previewData.trip_date_range?.start} → {previewData.trip_date_range?.end}
              </span>
            </div>
            {!uploadDone && (
              <button
                type="button"
                onClick={onUpload}
                disabled={uploading || !selectedRows.length}
                className={`inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {uploading ? <FiRefreshCw className="animate-spin" size={14} /> : <FiUpload size={14} />}
                {uploading ? "Cargando..." : `Cargar ${selectedRows.length} factura${selectedRows.length !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>

          {uncategorizedSelected.length > 0 && !uploadDone && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
              <FiAlertTriangle size={14} />
              {uncategorizedSelected.length} factura{uncategorizedSelected.length !== 1 ? "s" : ""} seleccionada{uncategorizedSelected.length !== 1 ? "s" : ""} sin categoría. Clasifícalas para poder cargar.
            </div>
          )}

          {unmodeSelected.length > 0 && !uploadDone && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
              <FiAlertTriangle size={14} />
              {unmodeSelected.length} factura{unmodeSelected.length !== 1 ? "s" : ""} seleccionada{unmodeSelected.length !== 1 ? "s" : ""} sin modo de gasto. Indica si fue con tarjeta o sin tarjeta para poder cargar.
            </div>
          )}

          {uploadDone && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
              <FiCheckCircle size={14} />
              Facturas cargadas exitosamente. Puedes continuar al siguiente paso.
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={inRangeRows.length > 0 && inRangeRows.every((_, i) => invoiceRows.find((r, ri) => ri === invoiceRows.indexOf(invoiceRows.filter(x => x.in_trip_date_range)[i]) && r.selected))}
                      onChange={(e) => {
                        const inRangeIdxs = invoiceRows.reduce((acc, r, i) => r.in_trip_date_range ? [...acc, i] : acc, []);
                        inRangeIdxs.forEach((i) => {
                          if (e.target.checked !== invoiceRows[i].selected) onToggleInvoice(i);
                        });
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600"
                      disabled={uploadDone}
                    />
                  </th>
                  <th className="px-2 py-2 text-left">Proveedor</th>
                  <th className="px-2 py-2 text-left">RUC</th>
                  <th className="px-2 py-2 text-left">Tipo</th>
                  <th className="px-2 py-2 text-left">Número</th>
                  <th className="px-2 py-2 text-left">Emisión</th>
                  <th className="px-2 py-2 text-left">Autorización</th>
                  <th className="px-2 py-2 text-left">Receptor</th>
                  <th className="px-2 py-2 text-right">Subtotal</th>
                  <th className="px-2 py-2 text-right">IVA</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2 text-center">Rango</th>
                  <th className="px-2 py-2 text-left min-w-[130px]">Categoría *</th>
                  <th className="px-2 py-2 text-left min-w-[130px]">Modo *</th>
                  <th className="px-2 py-2 text-left min-w-[120px]">Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoiceRows.map((row, idx) => {
                  const outOfRange = !row.in_trip_date_range;
                  const needsCategory = row.selected && !row.category && !uploadDone;
                  const needsExpenseMode = row.selected && !row.expense_mode && !uploadDone;
                  return (
                    <tr
                      key={row.access_key || idx}
                      className={`transition-colors ${outOfRange ? "opacity-50 bg-slate-50" : row.selected ? "bg-white" : "bg-slate-50/50"} ${(needsCategory || needsExpenseMode) ? "ring-1 ring-inset ring-amber-300" : ""}`}
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={outOfRange || uploadDone}
                          onChange={() => onToggleInvoice(idx)}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-2 py-2 max-w-[160px]">
                        <p className="font-medium text-slate-800 truncate">{row.supplier_name || "—"}</p>
                      </td>
                      <td className="px-2 py-2 font-mono text-slate-500">{row.supplier_ruc || "—"}</td>
                      <td className="px-2 py-2 text-slate-600">{row.receipt_type || "—"}</td>
                      <td className="px-2 py-2 font-mono text-slate-600 whitespace-nowrap">
                        {[row.establishment, row.emission_point, row.sequential].filter(Boolean).join("-") || "—"}
                      </td>
                      <td className="px-2 py-2 font-mono text-slate-600 whitespace-nowrap">{fmtDate(row.issue_date)}</td>
                      <td className="px-2 py-2 font-mono text-slate-500 whitespace-nowrap text-[10px]">
                        {row.authorization_date ? String(row.authorization_date).slice(0, 10) : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono text-slate-500">{row.buyer_id || "—"}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-700">{toMoney(row.subtotal)}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-700">{toMoney(row.iva)}</td>
                      <td className="px-2 py-2 text-right font-mono font-semibold text-slate-900">{toMoney(row.total)}</td>
                      <td className="px-2 py-2 text-center">
                        {outOfRange ? (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded-full px-1.5 py-0.5">Fuera</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">En viaje</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {!outOfRange && (
                          <select
                            value={row.category}
                            disabled={uploadDone || !row.selected}
                            onChange={(e) => onSetCategory(idx, e.target.value)}
                            className={`min-h-8 w-full rounded-lg border px-2 py-1 text-[11px] ${
                              needsCategory ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-white"
                            } disabled:opacity-50`}
                          >
                            <option value="">Seleccionar...</option>
                            {EXPENSE_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {!outOfRange && (
                          <select
                            value={row.expense_mode || ""}
                            disabled={uploadDone || !row.selected}
                            onChange={(e) => onSetExpenseMode(idx, e.target.value)}
                            className={`min-h-8 w-full rounded-lg border px-2 py-1 text-[11px] ${
                              needsExpenseMode ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-white"
                            } disabled:opacity-50`}
                          >
                            <option value="">Seleccionar...</option>
                            {EXPENSE_MODES.map((mode) => (
                              <option key={mode.value} value={mode.value}>{mode.label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {!outOfRange && row.selected && !uploadDone && (
                          <label className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700">
                            <FiUpload size={11} />
                            <span className="truncate max-w-[90px]">{row.file ? row.file.name : "Adjuntar..."}</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => onSetFile(idx, e.target.files?.[0] || null)}
                            />
                          </label>
                        )}
                        {!outOfRange && row.selected && uploadDone && row.file && (
                          <span className="text-[11px] text-emerald-600 truncate block max-w-[100px]">✓ {row.file.name}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estado si ya tiene facturas cargadas y no se ha subido TXT nuevo */}
      {!previewData && existingInvoices.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Proveedor</th>
                <th className="px-3 py-2 text-left">RUC</th>
                <th className="px-3 py-2 text-left">Emision</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {existingInvoices.map((row) => (
                <tr key={row.id || row.access_key} className="bg-white">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{row.supplier_name || "â€”"}</p>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-500">{row.supplier_ruc || "â€”"}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{fmtDate(row.issue_date)}</td>
                  <td className="px-3 py-2">
                    {row.category ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-700">
                        {row.category}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Sin categoria</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${INV_STATUS_BADGE[row.status] || "bg-slate-100 text-slate-600"}`}>
                      {row.status || "â€”"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{toMoney(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total cargado</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-slate-900">{toMoney(existingInvoiceTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {!previewData && existingInvoices.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold flex items-center gap-2"><FiCheckCircle size={14} /> {existingInvoices.length} factura{existingInvoices.length !== 1 ? "s" : ""} ya cargada{existingInvoices.length !== 1 ? "s" : ""}</p>
          <p className="mt-1 text-xs text-emerald-700">Puedes subir un nuevo TXT para agregar más, o saltar al siguiente paso.</p>
        </div>
      )}
    </div>
  );
}

// ── Paso 2 ────────────────────────────────────────────────────────────────────

function Step2Notes({ allowance, notes, loading, saving, onCreate, onUpdate, onDelete }) {
  if (!allowance) return null;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-slate-900">Notas de venta manual</p>
        <p className="mt-1 text-xs text-slate-500">Agrega las notas de venta que no están registradas en el SRI. Puedes agregar varias.</p>
      </div>
      <ManualNoteForm
        allowance={allowance}
        onSubmit={onCreate}
        loading={saving}
        destination={allowance.city}
      />
      {loading ? (
        <p className="text-xs text-slate-400 py-3 flex items-center gap-2"><FiRefreshCw className="animate-spin" size={12} /> Cargando notas...</p>
      ) : (
        <ManualNotesTable
          notes={notes}
          isFinance={false}
          isRequester={true}
          onUpdate={onUpdate}
          onDelete={onDelete}
          dateMin={allowance.notes?.match(/Inicio:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || String(allowance.visit_date || '').slice(0, 10)}
          dateMax={allowance.notes?.match(/Cierre:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || String(allowance.visit_date || '').slice(0, 10)}
        />
      )}
    </div>
  );
}

// ── Paso 3 ────────────────────────────────────────────────────────────────────

function Step3Purchases({ allowance, purchases, loading, saving, onCreate }) {
  if (!allowance) return null;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-slate-900">Compras sin factura</p>
        <p className="mt-1 text-xs text-slate-500">Registra gastos que no generaron ningún comprobante. Requieren aprobación de finanzas y talento humano. Puedes agregar varias.</p>
      </div>
      <PurchaseNoInvoiceForm
        allowance={allowance}
        onSubmit={onCreate}
        loading={saving}
      />
      {loading ? (
        <p className="text-xs text-slate-400 py-3 flex items-center gap-2"><FiRefreshCw className="animate-spin" size={12} /> Cargando compras...</p>
      ) : (
        <PurchaseNoInvoiceTable
          purchases={purchases}
        />
      )}
    </div>
  );
}

// ── Paso 4 ────────────────────────────────────────────────────────────────────

function Step4Summary({
  allowance,
  loading,
  submitted,
  submitting,
  existingInvoices,
  manualNotes,
  purchases,
  previewRows = [],
  onSubmit,
}) {
  if (!allowance) return null;

  const previewInvoices = existingInvoices.length ? existingInvoices : previewRows.filter((row) => row.selected && row.in_trip_date_range);
  const breakdown = getModeBreakdown({ invoices: previewInvoices, manualNotes, purchases });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-slate-900">Resumen del viatico</p>
        <p className="mt-1 text-xs text-slate-500">Revisa el consolidado antes de enviar a aprobacion.</p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-4 text-xs text-slate-400"><FiRefreshCw className="animate-spin" size={12} /> Cargando resumen...</p>
      ) : (
        <ConsolidatedSummary allowance={allowance} />
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Facturas SRI", count: existingInvoices.length },
          { label: "Notas manuales", count: manualNotes.length },
          { label: "Compras sin factura", count: purchases.length },
        ].map(({ label, count }) => (
          <div key={label} className="rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{count}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {EXPENSE_MODES.map((mode) => {
          const item = breakdown[mode.value];
          return (
            <div key={mode.value} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{mode.label}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${mode.value === "with_card" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                  {item.count} registro{item.count !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{toMoney(item.total)}</p>
              <p className="mt-1 text-xs text-slate-500">Aprobador: {mode.approver}</p>
              <p className="text-xs text-slate-500">Liquidacion: {mode.settlement}</p>
            </div>
          );
        })}
      </div>

      {submitted ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <FiCheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Enviado para aprobacion</p>
            <p className="text-xs text-emerald-700">Cada bloque se enviara al aprobador correspondiente segun su modo de gasto.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            Al enviar, el viatico pasara al flujo de aprobacion correspondiente. Los gastos sin tarjeta van a talento humano y los gastos con tarjeta al aprobador financiero.
          </p>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className={`${primaryBtn} w-full sm:w-auto`}
          >
            {submitting ? <FiRefreshCw className="animate-spin" size={14} /> : <FiCheckCircle size={14} />}
            {submitting ? "Enviando..." : "Enviar para aprobacion"}
          </button>
        </div>
      )}
    </div>
  );
}
