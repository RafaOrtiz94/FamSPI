import React, { useCallback, useEffect, useState } from "react";
import { useUI } from "../../../../core/ui/UIContext";
import Modal from "../../../../core/ui/components/Modal";
import ProviderEmailChipsInput from "../../../shared/purchases-workspace/components/ProviderEmailChipsInput";
import {
  closeBcAvailability,
  listBcAvailability,
  recordBcSupplierResponse,
  sendBcAvailabilityToSuppliers,
} from "../../../../core/api/bcAvailabilityApi";

const STATUS_LABELS = {
  requested: "Pendiente",
  in_progress: "Consultando proveedores",
  confirmed: "Confirmada",
  rejected: "No disponible",
  cu_pending: "CU — espera al cliente",
  import_pending: "Importación — espera al cliente",
};
const SUPPLIER_RESULTS = {
  available_new: "Disponible nuevo",
  available_cu: "Disponible CU",
  import_only: "Solo importación",
  unavailable: "No disponible",
};
const CLOSE_OPTIONS = [
  ["confirmed", "Confirmar"],
  ["cu_pending", "CU (cliente aprueba)"],
  ["import_pending", "Importación (cliente se compromete)"],
  ["rejected", "No disponible"],
];
const isClosed = (r) => ["confirmed", "rejected"].includes(r.status);
const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const btnClass = "rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50";

const RequestCard = ({ request, onChanged, showToast }) => {
  const [emails, setEmails] = useState("");
  const [notes, setNotes] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const closed = isClosed(request);

  const run = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      if (okMessage) showToast(okMessage, "success");
      await onChanged();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo completar la acción.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{request.equipment_name || `Equipo ${request.servicio_equipo_id}`}</p>
          <p className="text-xs text-slate-500">Business Case {String(request.business_case_id).slice(0, 8)} · Solicitud #{request.id}</p>
          {request.notes && <p className="mt-1 text-xs text-slate-600">{request.notes}</p>}
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {STATUS_LABELS[request.status] || request.status}
        </span>
      </div>

      {request.queries.length > 0 && (
        <ul className="space-y-2">
          {request.queries.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="font-mono text-slate-700">{q.provider_email}</span>
              {q.response_result ? (
                <span className="font-semibold text-slate-800">{SUPPLIER_RESULTS[q.response_result]}</span>
              ) : (
                !closed && (
                  <select
                    defaultValue=""
                    disabled={busy}
                    onChange={(e) =>
                      e.target.value &&
                      run(() => recordBcSupplierResponse(request.id, q.id, { result: e.target.value }), "Respuesta registrada")
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1"
                  >
                    <option value="">Registrar respuesta…</option>
                    {Object.entries(SUPPLIER_RESULTS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {!closed && (
        <>
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consultar proveedores</span>
            <ProviderEmailChipsInput value={emails} onChange={setEmails} />
            <input className={inputClass} placeholder="Notas para el proveedor (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button
              type="button"
              className={btnClass}
              disabled={busy || !emails.trim()}
              onClick={() =>
                run(async () => {
                  await sendBcAvailabilityToSuppliers(request.id, { provider_emails: emails, notes: notes || undefined });
                  setEmails("");
                  setNotes("");
                }, "Solicitud enviada a proveedores")
              }
            >
              {busy ? "Enviando..." : "Enviar a proveedores"}
            </button>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cerrar con resultado</span>
            <input className={inputClass} placeholder="Notas para el comercial (opcional)" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {CLOSE_OPTIONS.map(([status, label]) => (
                <button
                  key={status}
                  type="button"
                  className={btnClass}
                  disabled={busy}
                  onClick={() => run(() => closeBcAvailability(request.id, { status, notes: closeNotes || undefined }), "Comercial notificado")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {closed && request.result_notes && <p className="text-xs text-slate-600">Resultado: {request.result_notes}</p>}
    </div>
  );
};

const BcAvailabilityPanel = ({ open, onClose }) => {
  const { showToast } = useUI();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await listBcAvailability());
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudieron cargar las solicitudes.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <Modal open={open} onClose={onClose} title="Solicitudes de disponibilidad de equipo" maxWidth="max-w-2xl">
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        {loading && <p className="text-sm text-slate-500">Cargando…</p>}
        {!loading && requests.length === 0 && <p className="text-sm text-slate-500">No hay solicitudes.</p>}
        {requests.map((r) => (
          <RequestCard key={r.id} request={r} onChanged={load} showToast={showToast} />
        ))}
      </div>
    </Modal>
  );
};

export default BcAvailabilityPanel;
