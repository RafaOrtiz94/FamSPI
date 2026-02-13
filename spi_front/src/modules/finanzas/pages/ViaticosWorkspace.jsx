import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiUpload, FiFileText, FiCheckCircle } from "react-icons/fi";
import {
  addViaticoDocument,
  getViaticoReport,
  listViaticoDocuments,
  listViaticos,
  listViaticosCandidates,
  upsertViatico,
  updateViaticoStatus,
} from "../../../core/api/viaticosApi";
import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "approved", label: "Aprobado" },
  { value: "paid", label: "Pagado" },
  { value: "rejected", label: "Rechazado" },
];

const DOC_TYPE_OPTIONS = [
  { value: "invoice", label: "Factura" },
  { value: "liquidation", label: "Liquidación" },
  { value: "support", label: "Soporte" },
];

const FINANCE_SCOPES = ["finanzas", "jefe_finanzas", "jefe_financiero", "gerencia", "gerencia_general"];

const toMoney = (value, currency = "USD") => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const currentMonthRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { firstDay, lastDay };
};

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const normalizeRoles = (user) => {
  const values = [user?.scope, user?.role, user?.role_name, ...(Array.isArray(user?.roles) ? user.roles : [])];
  return values
    .flatMap((item) => String(item || "").split(","))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const ViaticosWorkspace = () => {
  const { showToast } = useUI();
  const { user } = useAuth();
  const range = useMemo(() => currentMonthRange(), []);
  const roleList = useMemo(() => normalizeRoles(user), [user]);
  const isFinance = roleList.some((role) => FINANCE_SCOPES.includes(role));

  const [filters, setFilters] = useState({
    start_date: range.firstDay,
    end_date: range.lastDay,
    status: "",
  });

  const [candidates, setCandidates] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [manualDraft, setManualDraft] = useState({
    source_type: "manual_trip",
    source_id: "",
    visit_date: new Date().toISOString().slice(0, 10),
    city: "",
    amount: 0,
    currency: "USD",
    distance_km: 0,
    liquidation_amount: 0,
    fuel_amount: 0,
    outside_labor_area: false,
    outside_labor_area_reason: "",
    notes: "",
  });

  const [docsByAllowance, setDocsByAllowance] = useState({});
  const [docDrafts, setDocDrafts] = useState({});
  const [reports, setReports] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        start_date: filters.start_date,
        end_date: filters.end_date,
        status: filters.status || undefined,
      };

      const allowanceData = await listViaticos(params);
      setAllowances(Array.isArray(allowanceData) ? allowanceData : []);

      if (isFinance || roleList.some((role) => ["comercial", "jefe_comercial", "acp_comercial", "backoffice_comercial"].includes(role))) {
        const candidateData = await listViaticosCandidates(params);
        setCandidates(Array.isArray(candidateData) ? candidateData : []);
      } else {
        setCandidates([]);
      }

      const nextDrafts = {};
      (Array.isArray(allowanceData) ? allowanceData : []).forEach((item) => {
        nextDrafts[item.id] = {
          amount: Number(item.amount || 0),
          approved_amount: Number(item.approved_amount || 0),
          status: item.status || "pending",
          notes: item.notes || "",
          currency: item.currency || "USD",
          distance_km: Number(item.distance_km || 0),
          liquidation_amount: Number(item.liquidation_amount || 0),
          fuel_amount: Number(item.fuel_amount || 0),
          outside_labor_area: Boolean(item.outside_labor_area),
          outside_labor_area_reason: item.outside_labor_area_reason || "",
        };
      });
      setDrafts(nextDrafts);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar viáticos", "error");
    } finally {
      setLoading(false);
    }
  }, [filters.end_date, filters.start_date, filters.status, isFinance, roleList, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    return allowances.reduce(
      (acc, item) => {
        acc.total += Number(item.amount || 0);
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, paid: 0, rejected: 0 }
    );
  }, [allowances]);

  const updateDraft = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        amount: prev[id]?.amount ?? 0,
        approved_amount: prev[id]?.approved_amount ?? 0,
        status: prev[id]?.status || "pending",
        notes: prev[id]?.notes || "",
        currency: prev[id]?.currency || "USD",
        distance_km: prev[id]?.distance_km ?? 0,
        liquidation_amount: prev[id]?.liquidation_amount ?? 0,
        fuel_amount: prev[id]?.fuel_amount ?? 0,
        outside_labor_area: Boolean(prev[id]?.outside_labor_area),
        outside_labor_area_reason: prev[id]?.outside_labor_area_reason || "",
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSaveAllowance = async (allowance) => {
    const draft = drafts[allowance.id] || {};
    setSavingId(`save-${allowance.id}`);
    try {
      await upsertViatico({
        source_type: allowance.source_type,
        source_id: allowance.source_id,
        visit_date: allowance.visit_date,
        city: allowance.city,
        amount: Number(draft.amount || 0),
        currency: draft.currency || allowance.currency || "USD",
        distance_km: Number(draft.distance_km || 0),
        liquidation_amount: Number(draft.liquidation_amount || 0),
        fuel_amount: Number(draft.fuel_amount || 0),
        outside_labor_area: Boolean(draft.outside_labor_area),
        outside_labor_area_reason: draft.outside_labor_area_reason || "",
        notes: draft.notes || "",
      });
      showToast("Viático actualizado", "success");
      await loadData();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateManual = async () => {
    if (!manualDraft.outside_labor_area) {
      showToast("Solo se permiten viáticos para gastos fuera del área de labores", "warning");
      return;
    }

    if (Number(manualDraft.fuel_amount || 0) > 0 && Number(manualDraft.distance_km || 0) <= 1000) {
      showToast("Gasolina solo aplica para recorridos mayores a 1000 km", "warning");
      return;
    }

    setSavingId("manual");
    try {
      await upsertViatico({
        ...manualDraft,
        source_id: manualDraft.source_id ? Number(manualDraft.source_id) : null,
        amount: Number(manualDraft.amount || 0),
        distance_km: Number(manualDraft.distance_km || 0),
        liquidation_amount: Number(manualDraft.liquidation_amount || 0),
        fuel_amount: Number(manualDraft.fuel_amount || 0),
      });
      showToast("Solicitud de viático registrada", "success");
      setManualDraft((prev) => ({
        ...prev,
        source_id: "",
        city: "",
        amount: 0,
        distance_km: 0,
        liquidation_amount: 0,
        fuel_amount: 0,
        outside_labor_area: false,
        outside_labor_area_reason: "",
        notes: "",
      }));
      await loadData();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo crear la solicitud", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateFromCandidate = async (item) => {
    const key = `${item.source_type}:${item.source_id}`;
    setSavingId(`candidate-${key}`);
    try {
      await upsertViatico({
        source_type: item.source_type,
        source_id: item.source_id,
        amount: Number(item.amount || 0),
        notes: item.notes || "",
      });
      showToast("Viático base creado desde visita", "success");
      await loadData();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo crear viático", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handlePatchStatus = async (allowance, status) => {
    if (!isFinance) return;
    const draft = drafts[allowance.id] || {};
    setSavingId(`status-${allowance.id}`);
    try {
      await updateViaticoStatus(allowance.id, {
        status,
        amount: Number(draft.amount || allowance.amount || 0),
        approved_amount: Number(draft.approved_amount || allowance.approved_amount || 0),
        notes: draft.notes ?? allowance.notes,
      });
      showToast("Estado actualizado", "success");
      await loadData();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar el estado", "error");
    } finally {
      setSavingId(null);
    }
  };

  const loadDocuments = async (allowanceId) => {
    try {
      const docs = await listViaticoDocuments(allowanceId);
      setDocsByAllowance((prev) => ({ ...prev, [allowanceId]: docs }));
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudieron cargar documentos", "error");
    }
  };

  const updateDocDraft = (allowanceId, field, value) => {
    setDocDrafts((prev) => ({
      ...prev,
      [allowanceId]: {
        doc_type: prev[allowanceId]?.doc_type || "invoice",
        amount: prev[allowanceId]?.amount ?? "",
        notes: prev[allowanceId]?.notes || "",
        expense_date: prev[allowanceId]?.expense_date || "",
        invoice_number: prev[allowanceId]?.invoice_number || "",
        file: prev[allowanceId]?.file || null,
        ...prev[allowanceId],
        [field]: value,
      },
    }));
  };

  const handleUploadDocument = async (allowanceId) => {
    const draft = docDrafts[allowanceId];
    if (!draft?.file) {
      showToast("Selecciona un archivo", "warning");
      return;
    }
    if (draft.file.size > 15 * 1024 * 1024) {
      showToast("El archivo excede 15MB", "warning");
      return;
    }

    setSavingId(`doc-${allowanceId}`);
    try {
      const base64 = await readFileAsDataURL(draft.file);
      await addViaticoDocument(allowanceId, {
        doc_type: draft.doc_type,
        file_name: draft.file.name,
        mime_type: draft.file.type,
        file_base64: base64,
        amount: draft.amount !== "" ? Number(draft.amount) : null,
        notes: draft.notes || "",
        expense_date: draft.expense_date || null,
        invoice_number: draft.invoice_number || null,
      });

      showToast("Documento cargado", "success");
      setDocDrafts((prev) => ({ ...prev, [allowanceId]: null }));
      await loadDocuments(allowanceId);
      await loadData();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar documento", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleBuildReport = async (allowanceId) => {
    setSavingId(`report-${allowanceId}`);
    try {
      const report = await getViaticoReport(allowanceId);
      setReports((prev) => ({ ...prev, [allowanceId]: report }));
      showToast("Reporte generado", "success");
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo generar reporte", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workspace de Viáticos</h1>
          <p className="text-sm text-slate-600">
            {isFinance
              ? "Control financiero de viáticos, documentos y validación con asistencia."
              : "Registro y seguimiento de viáticos con soporte documental."}
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <FiRefreshCw /> Recargar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">Pendientes</p><p className="text-xl font-bold text-slate-900">{summary.pending}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">Aprobados</p><p className="text-xl font-bold text-slate-900">{summary.approved}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">Pagados</p><p className="text-xl font-bold text-slate-900">{summary.paid}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">Rechazados</p><p className="text-xl font-bold text-slate-900">{summary.rejected}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">Monto total</p><p className="text-xl font-bold text-slate-900">{toMoney(summary.total)}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <label className="text-sm text-slate-700">Desde
          <input type="date" value={filters.start_date} onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm text-slate-700">Hasta
          <input type="date" value={filters.end_date} onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm text-slate-700">Estado
          <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>
      </div>

      {!isFinance && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Nueva Solicitud de Viático</h2>
          <p className="text-xs text-slate-500">Para técnicos o para casos fuera de visita comercial registrada.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-xs text-slate-600">Tipo origen
              <select value={manualDraft.source_type} onChange={(e) => setManualDraft((prev) => ({ ...prev, source_type: e.target.value }))} className="mt-1 w-full rounded border px-2 py-2">
                <option value="manual_trip">Manual</option>
                <option value="client_visit">Visita cliente</option>
                <option value="prospect_visit">Visita prospecto</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">ID visita (si aplica)
              <input value={manualDraft.source_id} onChange={(e) => setManualDraft((prev) => ({ ...prev, source_id: e.target.value }))} className="mt-1 w-full rounded border px-2 py-2" />
            </label>
            <label className="text-xs text-slate-600">Fecha
              <input type="date" value={manualDraft.visit_date} onChange={(e) => setManualDraft((prev) => ({ ...prev, visit_date: e.target.value }))} className="mt-1 w-full rounded border px-2 py-2" />
            </label>
            <label className="text-xs text-slate-600">Ciudad
              <input value={manualDraft.city} onChange={(e) => setManualDraft((prev) => ({ ...prev, city: e.target.value }))} className="mt-1 w-full rounded border px-2 py-2" />
            </label>
            <label className="text-xs text-slate-600">Monto
              <input type="number" min="0" step="0.01" value={manualDraft.amount} onChange={(e) => setManualDraft((prev) => ({ ...prev, amount: e.target.value }))} className="mt-1 w-full rounded border px-2 py-2" />
            </label>
            <label className="text-xs text-slate-600">Km recorridos
              <input type="number" min="0" step="0.01" value={manualDraft.distance_km} onChange={(e) => setManualDraft((prev) => ({ ...prev, distance_km: e.target.value }))} className="mt-1 w-full rounded border px-2 py-2" />
            </label>
            <label className="text-xs text-slate-600">Liquidación gastos
              <input type="number" min="0" step="0.01" value={manualDraft.liquidation_amount} onChange={(e) => setManualDraft((prev) => ({ ...prev, liquidation_amount: e.target.value }))} className="mt-1 w-full rounded border px-2 py-2" />
            </label>
            <label className="text-xs text-slate-600">Gasolina
              <input type="number" min="0" step="0.01" value={manualDraft.fuel_amount} onChange={(e) => setManualDraft((prev) => ({ ...prev, fuel_amount: e.target.value }))} className="mt-1 w-full rounded border px-2 py-2" />
            </label>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={manualDraft.outside_labor_area} onChange={(e) => setManualDraft((prev) => ({ ...prev, outside_labor_area: e.target.checked }))} />
              Gastos fuera del área de labores
            </label>
            <label className="text-xs text-slate-600">Razón fuera de área
              <input value={manualDraft.outside_labor_area_reason} onChange={(e) => setManualDraft((prev) => ({ ...prev, outside_labor_area_reason: e.target.value }))} className="mt-1 w-full rounded border px-2 py-2" />
            </label>
          </div>
          <label className="mt-2 block text-xs text-slate-600">Notas
            <input value={manualDraft.notes} onChange={(e) => setManualDraft((prev) => ({ ...prev, notes: e.target.value }))} className="mt-1 w-full rounded border px-2 py-2" />
          </label>
          <div className="mt-3">
            <button type="button" disabled={savingId === "manual"} onClick={handleCreateManual} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              Crear solicitud
            </button>
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Visitas elegibles para viáticos</h2>
          <div className="mt-3 space-y-2">
            {candidates.map((item) => {
              const key = `${item.source_type}:${item.source_id}`;
              return (
                <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-2 text-sm">
                  <div>
                    <strong>{item.reference_name || item.requester_email}</strong> · {String(item.visit_date || "").slice(0, 10)} · {item.city || "N/A"}
                  </div>
                  {item.allowance_id ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Con viático</span>
                  ) : (
                    <button type="button" disabled={savingId === `candidate-${key}`} onClick={() => handleCreateFromCandidate(item)} className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">
                      Crear viático
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando viáticos...</p>
        ) : allowances.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No hay registros en el rango seleccionado.</p>
        ) : (
          allowances.map((item) => {
            const draft = drafts[item.id] || {};
            const docs = docsByAllowance[item.id] || [];
            const docDraft = docDrafts[item.id] || {};
            const report = reports[item.id];

            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
                  <div className="lg:col-span-2">
                    <p className="text-xs uppercase text-slate-500">Solicitante</p>
                    <p className="text-sm font-semibold text-slate-900">{item.requester_name || item.requester_email}</p>
                    <p className="text-xs text-slate-500">{item.source_type} #{item.source_id || "manual"}</p>
                  </div>
                  <div><p className="text-xs uppercase text-slate-500">Fecha</p><p className="text-sm font-semibold text-slate-900">{String(item.visit_date || "").slice(0, 10)}</p></div>
                  <div><p className="text-xs uppercase text-slate-500">Estado</p><p className="text-sm font-semibold text-slate-900">{item.status}</p></div>
                  <div><p className="text-xs uppercase text-slate-500">Cotejo asistencia</p><p className="text-sm font-semibold text-slate-900">{item.attendance_check_status || "unchecked"}</p></div>
                  <div><p className="text-xs uppercase text-slate-500">Docs</p><p className="text-sm font-semibold text-slate-900">{item.docs_count || 0}</p></div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-6">
                  <label className="text-xs text-slate-600">Monto solicitado
                    <input type="number" min="0" step="0.01" value={draft.amount ?? item.amount ?? 0} onChange={(e) => updateDraft(item.id, "amount", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                  </label>
                  {isFinance && (
                    <label className="text-xs text-slate-600">Monto aprobado
                      <input type="number" min="0" step="0.01" value={draft.approved_amount ?? item.approved_amount ?? 0} onChange={(e) => updateDraft(item.id, "approved_amount", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                    </label>
                  )}
                  <label className="text-xs text-slate-600">Liquidación
                    <input type="number" min="0" step="0.01" value={draft.liquidation_amount ?? item.liquidation_amount ?? 0} onChange={(e) => updateDraft(item.id, "liquidation_amount", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                  </label>
                  <label className="text-xs text-slate-600">Gasolina
                    <input type="number" min="0" step="0.01" value={draft.fuel_amount ?? item.fuel_amount ?? 0} onChange={(e) => updateDraft(item.id, "fuel_amount", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                  </label>
                  <label className="text-xs text-slate-600">Km
                    <input type="number" min="0" step="0.01" value={draft.distance_km ?? item.distance_km ?? 0} onChange={(e) => updateDraft(item.id, "distance_km", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 mt-5">
                    <input type="checkbox" checked={Boolean(draft.outside_labor_area ?? item.outside_labor_area)} onChange={(e) => updateDraft(item.id, "outside_labor_area", e.target.checked)} />
                    Fuera de área
                  </label>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <label className="text-xs text-slate-600">Razón fuera de área
                    <input value={draft.outside_labor_area_reason ?? item.outside_labor_area_reason ?? ""} onChange={(e) => updateDraft(item.id, "outside_labor_area_reason", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                  </label>
                  <label className="text-xs text-slate-600">Notas
                    <input value={draft.notes ?? item.notes ?? ""} onChange={(e) => updateDraft(item.id, "notes", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Facturas: {toMoney(item.invoices_total || 0, item.currency || "USD")}</span>
                  <button type="button" disabled={savingId === `save-${item.id}`} onClick={() => handleSaveAllowance(item)} className="rounded-full border border-blue-300 bg-blue-50 px-2 py-1 text-blue-700">Guardar datos</button>
                  {isFinance && (
                    <button type="button" disabled={savingId === `report-${item.id}`} onClick={() => handleBuildReport(item.id)} className="rounded-full border border-indigo-300 bg-indigo-50 px-2 py-1 text-indigo-700 inline-flex items-center gap-1"><FiCheckCircle /> Cotejar asistencia</button>
                  )}
                  <button type="button" onClick={() => loadDocuments(item.id)} className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-slate-700 inline-flex items-center gap-1"><FiFileText /> Ver docs</button>
                  {isFinance && (
                    <>
                      <button type="button" onClick={() => handlePatchStatus(item, "approved")} className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700">Aprobar</button>
                      <button type="button" onClick={() => handlePatchStatus(item, "paid")} className="rounded-full border border-blue-300 bg-blue-50 px-2 py-1 text-blue-700">Marcar pagado</button>
                      <button type="button" onClick={() => handlePatchStatus(item, "rejected")} className="rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700">Rechazar</button>
                    </>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-6">
                  <label className="text-xs text-slate-600">Tipo doc
                    <select value={docDraft.doc_type || "invoice"} onChange={(e) => updateDocDraft(item.id, "doc_type", e.target.value)} className="mt-1 w-full rounded border px-2 py-1">
                      {DOC_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-slate-600">Monto
                    <input type="number" min="0" step="0.01" value={docDraft.amount ?? ""} onChange={(e) => updateDocDraft(item.id, "amount", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                  </label>
                  <label className="text-xs text-slate-600">Fecha gasto
                    <input type="date" value={docDraft.expense_date || ""} onChange={(e) => updateDocDraft(item.id, "expense_date", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                  </label>
                  <label className="text-xs text-slate-600">Nro factura
                    <input value={docDraft.invoice_number || ""} onChange={(e) => updateDocDraft(item.id, "invoice_number", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                  </label>
                  <label className="text-xs text-slate-600 md:col-span-2">Archivo
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => updateDocDraft(item.id, "file", e.target.files?.[0] || null)} className="mt-1 w-full text-xs" />
                  </label>
                  <label className="text-xs text-slate-600 md:col-span-5">Notas documento
                    <input value={docDraft.notes || ""} onChange={(e) => updateDocDraft(item.id, "notes", e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
                  </label>
                  <div className="flex items-end">
                    <button type="button" disabled={savingId === `doc-${item.id}`} onClick={() => handleUploadDocument(item.id)} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1"><FiUpload /> Subir doc</button>
                  </div>
                </div>

                {docs.length > 0 && (
                  <div className="mt-2 rounded border border-slate-200 p-2 text-xs text-slate-700">
                    {docs.map((doc) => (
                      <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                        <span>{doc.doc_type} · {doc.file_name} · {doc.amount ? toMoney(doc.amount, item.currency || "USD") : "sin monto"}</span>
                        {doc.drive_link ? <a href={doc.drive_link} target="_blank" rel="noreferrer" className="text-blue-700 underline">Abrir</a> : <span>Sin enlace</span>}
                      </div>
                    ))}
                  </div>
                )}

                {report && (
                  <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                    <div>Asistencia: <strong>{report.attendance?.status}</strong> {report.attendance?.min_distance_km != null ? `(distancia mínima ${Number(report.attendance.min_distance_km).toFixed(2)} km)` : ""}</div>
                    <div>Regla fuera de área: <strong>{report.rules?.outside_labor_area ? "Sí" : "No"}</strong></div>
                    <div>Km > 1000 para gasolina: <strong>{report.rules?.fuel_eligible_by_km ? "Sí" : "No"}</strong></div>
                    <div>Monto sugerido: <strong>{toMoney(report.recommendation?.suggested_amount || 0, item.currency || "USD")}</strong></div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ViaticosWorkspace;

