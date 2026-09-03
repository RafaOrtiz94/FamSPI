import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCheck,
  FiClock,
  FiDownload,
  FiFileText,
  FiFilter,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/UIContext";
import {
  downloadTiActa,
  getTiActaSignatureWorkflow,
  listTiAllActas,
  startTiActaSignatureWorkflow,
  uploadTiActaSigned,
} from "../../../core/api/tiAssetsApi";
import { downloadSignatureWorkflowFinalPdf, validateSignerProfiles } from "../../../core/api/signatureWorkflowsApi";
import { getSignerCandidates } from "../../../core/api/usersApi";

const TIPO_CONFIG = {
  entrega: { label: "Entrega", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
  retiro: { label: "Retiro", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
};

const ESTADO_CONFIG = {
  true: { label: "Firmada", icon: FiCheck, bg: "bg-green-50", text: "text-green-700" },
  false: { label: "Pendiente firma", icon: FiClock, bg: "bg-amber-50", text: "text-amber-700" },
};

const WORKFLOW_STATUS_CONFIG = {
  prepared: { label: "Preparado", bg: "bg-slate-100", text: "text-slate-700" },
  sent: { label: "Enviado", bg: "bg-blue-50", text: "text-blue-700" },
  in_progress: { label: "En curso", bg: "bg-blue-50", text: "text-blue-700" },
  partially_signed: { label: "Firma parcial", bg: "bg-amber-50", text: "text-amber-700" },
  completed: { label: "Completado", bg: "bg-green-50", text: "text-green-700" },
  rejected: { label: "Rechazado", bg: "bg-red-50", text: "text-red-700" },
  cancelled: { label: "Cancelado", bg: "bg-slate-100", text: "text-slate-700" },
};

function TipoBadge({ tipo }) {
  const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.entrega;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function EstadoBadge({ isComplete, isAnnulled = false }) {
  if (isAnnulled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        <FiAlertTriangle size={10} /> Anulada
      </span>
    );
  }
  const cfg = ESTADO_CONFIG[String(isComplete)];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

function WorkflowBadge({ status, isComplete, isAnnulled = false }) {
  if (isAnnulled) return <EstadoBadge isComplete={isComplete} isAnnulled />;
  const normalized = String(status || "").toLowerCase();
  if (normalized) {
    const cfg = WORKFLOW_STATUS_CONFIG[normalized] || WORKFLOW_STATUS_CONFIG.prepared;
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
    );
  }
  return <EstadoBadge isComplete={isComplete} />;
}

function fmt(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSignerDraft() {
  return {
    user_id: "",
    is_required: true,
  };
}

function StartWorkflowModal({ acta, users, loadingUsers, saving, onClose, onSubmit }) {
  const { showToast } = useUI();
  const [signers, setSigners] = useState([buildSignerDraft()]);
  const [profileWarnings, setProfileWarnings] = useState([]);
  const [validating, setValidating] = useState(false);

  const setSignerField = (index, field, value) => {
    setProfileWarnings([]);
    setSigners((current) =>
      current.map((signer, signerIndex) =>
        signerIndex === index ? { ...signer, [field]: value } : signer
      )
    );
  };

  const addSigner = () => {
    setProfileWarnings([]);
    setSigners((current) => [...current, buildSignerDraft()]);
  };

  const removeSigner = (index) => {
    setProfileWarnings([]);
    setSigners((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
  };

  const handleSubmit = async () => {
    const normalized = signers.map((signer, index) => ({
      ...signer,
      sequence_order: index + 1,
      user_id: Number(signer.user_id || 0),
    }));

    if (normalized.some((signer) => !Number.isFinite(signer.user_id) || signer.user_id <= 0)) {
      showToast("Debes seleccionar un usuario en cada paso de firma", "warning");
      return;
    }

    const duplicated = normalized.map((signer) => signer.user_id);
    if (new Set(duplicated).size !== duplicated.length) {
      showToast("No puedes repetir el mismo firmante en el workflow", "warning");
      return;
    }

    // Validar fichas TH antes de crear el workflow
    setValidating(true);
    setProfileWarnings([]);
    try {
      const incomplete = await validateSignerProfiles(normalized.map((s) => s.user_id));
      if (incomplete.length > 0) {
        setProfileWarnings(incomplete);
        return;
      }
    } catch {
      // Si falla el chequeo, continuar sin bloquear
    } finally {
      setValidating(false);
    }

    const payloadSigners = normalized.map((signer) => {
      const user = users.find((item) => Number(item.id) === Number(signer.user_id));
      return {
        user_id: user.id,
        email: user.email,
        name: user.fullname || user.email,
        role: user.role || null,
        sequence_order: signer.sequence_order,
        is_required: signer.is_required !== false,
      };
    });

    onSubmit(payloadSigners);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Iniciar firma colectiva"
      maxWidth="max-w-4xl"
      disableClose={saving}
    >
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Actas TI</p>
          <p className="mt-2 text-sm text-slate-500">
            {acta?.acta_code || `Acta #${acta?.id || "-"}`} · {acta?.tipo || "-"} · selecciona los firmantes en el orden exacto para este documento.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Acta</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{acta?.acta_code || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tipo</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{acta?.tipo || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Colaborador</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{acta?.recipient_nombre || "-"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          Este flujo es manual. La secuencia se toma del orden visible de la lista y se enviará exactamente así al backend.
        </div>

        {loadingUsers ? (
          <div className="flex items-center justify-center py-10">
            <FiRefreshCw size={20} className="animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="space-y-3">
            {signers.map((signer, index) => {
              const selectedUser = users.find((item) => Number(item.id) === Number(signer.user_id || 0));
              return (
                <div
                  key={`signer-${index}`}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[80px_minmax(0,1fr)_156px_56px]"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Paso</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{index + 1}</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Firmante
                    </label>
                    <select
                      value={signer.user_id}
                      onChange={(event) => setSignerField(index, "user_id", event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value="">Selecciona un usuario</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullname || user.email} · {user.role || "sin rol"}
                        </option>
                      ))}
                    </select>
                    {selectedUser ? (
                      <p className="mt-1 text-xs text-slate-400">
                        {selectedUser.email} · {selectedUser.department_name || "Sin departamento"}
                      </p>
                    ) : null}
                  </div>

                  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={signer.is_required !== false}
                      onChange={(event) => setSignerField(index, "is_required", event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Obligatorio
                  </label>

                  <button
                    type="button"
                    onClick={() => removeSigner(index)}
                    disabled={signers.length <= 1}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addSigner}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97]"
            >
              <FiPlus size={14} />
              Agregar firmante
            </button>
          </div>
        )}

        {profileWarnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <FiAlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-amber-800">
                  Ficha incompleta — solicita a Talento Humano completar los datos antes de continuar
                </p>
                <ul className="mt-2 space-y-1.5">
                  {profileWarnings.map((w) => (
                    <li key={w.user_id} className="text-amber-700">
                      <span className="font-medium">{w.fullname || w.email}</span>
                      {" — faltan: "}
                      <span className="font-medium">{w.missing.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 -mx-4 -mb-4 px-4 py-4 sm:-mx-6 sm:-mb-5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 active:scale-[0.97]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || loadingUsers || validating || profileWarnings.length > 0}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.97] disabled:opacity-60"
          >
            {validating ? <FiRefreshCw size={14} className="animate-spin" /> : saving ? <FiRefreshCw size={14} className="animate-spin" /> : <FiCheck size={14} />}
            {validating ? "Validando fichas..." : saving ? "Iniciando..." : "Crear workflow"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const TIActasPage = () => {
  const { showToast } = useUI();
  const navigate = useNavigate();

  const [actas, setActas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [downloadingFinalPdfId, setDownloadingFinalPdfId] = useState(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowActa, setWorkflowActa] = useState(null);
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterEstado, setFilterEstado] = useState("");

  const loadActas = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterTipo) params.tipo = filterTipo;
      if (filterEstado !== "") params.is_complete = filterEstado;
      const rows = await listTiAllActas(params);
      setActas(Array.isArray(rows) ? rows : []);
    } catch {
      showToast("No se pudieron cargar las actas", "error");
    } finally {
      setLoading(false);
    }
  }, [filterEstado, filterTipo, showToast]);

  useEffect(() => {
    loadActas();
  }, [loadActas]);

  const handleDownload = async (acta) => {
    try {
      await downloadTiActa(acta.id, acta.tipo);
    } catch {
      showToast("No se pudo descargar el acta", "error");
    }
  };

  const handleSignedUpload = async (actaId, file) => {
    if (!file) return;
    setUploadingId(actaId);
    try {
      await uploadTiActaSigned(actaId, file);
      showToast("Acta firmada subida correctamente. Checklist del colaborador actualizado.", "success");
      await loadActas();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo subir el acta firmada", "error");
    } finally {
      setUploadingId(null);
    }
  };

  const handleOpenWorkflow = async (acta) => {
    try {
      const existing = acta.signature_workflow_id
        ? { workflow: { id: acta.signature_workflow_id } }
        : await getTiActaSignatureWorkflow(acta.id);
      const workflowId = Number(existing?.workflow?.id || existing?.id || 0) || null;
      if (!workflowId) {
        showToast("Esta acta TI aún no tiene workflow de firma vinculado", "info");
        return;
      }
      navigate(`/dashboard/signatures/workflows/${workflowId}`);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo abrir el workflow", "error");
    }
  };

  const handleDownloadFinalPdf = async (acta) => {
    setDownloadingFinalPdfId(acta.id);
    try {
      const wfData = await getTiActaSignatureWorkflow(acta.id);
      const workflowId = Number(wfData?.workflow?.id || wfData?.id || 0) || null;
      const documentId = Number(wfData?.documents?.[0]?.id || 0) || null;
      if (!workflowId || !documentId) throw new Error("Documento final no disponible");
      const res = await downloadSignatureWorkflowFinalPdf(workflowId, documentId);
      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showToast(error?.response?.data?.message || error?.message || "No se pudo descargar el PDF firmado", "error");
    } finally {
      setDownloadingFinalPdfId(null);
    }
  };

  const handleOpenStartWorkflowModal = async (acta) => {
    setWorkflowActa(acta);
    setShowWorkflowModal(true);
    if (directoryUsers.length) return;

    setLoadingUsers(true);
    try {
      const users = await getSignerCandidates();
      setDirectoryUsers(Array.isArray(users) ? users : []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar el directorio de usuarios", "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateWorkflow = async (signers) => {
    if (!workflowActa) return;
    setSavingWorkflow(true);
    try {
      const started = await startTiActaSignatureWorkflow(workflowActa.id, { signers });
      const workflowId = Number(started?.workflow?.id || started?.id || 0) || null;
      if (!workflowId) throw new Error("No se recibió el workflow creado");

      showToast("Workflow creado correctamente", "success");
      setShowWorkflowModal(false);
      setWorkflowActa(null);
      await loadActas();
      navigate(`/dashboard/signatures/workflows/${workflowId}`);
    } catch (error) {
      showToast(error?.response?.data?.message || error?.message || "No se pudo crear el workflow", "error");
    } finally {
      setSavingWorkflow(false);
    }
  };

  const filteredActas = actas.filter((acta) => {
    if (filterTipo && acta.tipo !== filterTipo) return false;
    if (filterEstado !== "" && String(acta.is_complete) !== filterEstado) return false;
    return true;
  });

  const total = actas.length;
  const firmadas = actas.filter((acta) => acta.is_complete).length;
  const anuladas = actas.filter((acta) => acta.is_annulled).length;
  const pendientes = total - firmadas - anuladas;

  return (
    <>
      <div className="flex min-w-0 flex-col space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Actas de entrega y retiro</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {total} acta{total !== 1 ? "s" : ""} generada{total !== 1 ? "s" : ""} · {firmadas} firmada{firmadas !== 1 ? "s" : ""} · {pendientes} pendiente{pendientes !== 1 ? "s" : ""} · {anuladas} anulada{anuladas !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={loadActas}
            disabled={loading}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 active:scale-[0.97] disabled:opacity-50"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: total, color: "text-slate-800" },
            { label: "Firmadas", value: firmadas, color: "text-green-700" },
            { label: "Pendientes", value: pendientes, color: "text-amber-700" },
            { label: "Anuladas", value: anuladas, color: "text-red-700" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className={`mt-0.5 text-2xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <FiFilter size={14} className="shrink-0 text-slate-400" />
          <select
            value={filterTipo}
            onChange={(event) => setFilterTipo(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="">Todos los tipos</option>
            <option value="entrega">Entrega</option>
            <option value="retiro">Retiro</option>
          </select>
          <select
            value={filterEstado}
            onChange={(event) => setFilterEstado(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="">Todos los estados</option>
            <option value="true">Firmadas</option>
            <option value="false">Pendientes</option>
          </select>
          {(filterTipo || filterEstado) && (
            <button
              type="button"
              onClick={() => {
                setFilterTipo("");
                setFilterEstado("");
              }}
              className="text-xs text-slate-400 transition-colors hover:text-slate-700"
            >
              Limpiar filtros
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">
            {filteredActas.length} resultado{filteredActas.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <FiRefreshCw size={20} className="animate-spin text-slate-300" />
            </div>
          ) : filteredActas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <FiFileText size={32} className="mb-3 text-slate-200" />
              <p className="text-sm font-medium text-slate-500">Sin actas generadas</p>
              <p className="mt-1 text-xs text-slate-400">
                Las actas se crean automáticamente al asignar o retirar equipos.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-400">
                    <th className="px-4 py-3 text-left font-medium">N° Acta</th>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Activo</th>
                    <th className="px-4 py-3 text-left font-medium">Colaborador</th>
                    <th className="px-4 py-3 text-left font-medium">Cargo</th>
                    <th className="px-4 py-3 text-left font-medium">Cédula</th>
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                    <th className="px-4 py-3 text-left font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActas.map((acta) => {
                    const isUploading = uploadingId === acta.id;
                    const isAnnulled = Boolean(acta.is_annulled);
                    return (
                      <tr key={acta.id} className={`transition-colors hover:bg-slate-50 ${isAnnulled ? "bg-red-50/30" : ""}`}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {acta.acta_code || `#${String(acta.id).padStart(6, "0")}`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <TipoBadge tipo={acta.tipo} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-slate-800">{acta.asset_name || "-"}</p>
                          {acta.asset_code ? (
                            <p className="font-mono text-[10px] text-slate-400">{acta.asset_code}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-slate-800">
                            {acta.recipient_nombre || <span className="italic text-slate-400">Sin nombre</span>}
                          </p>
                          <p className="text-[10px] text-slate-400">{acta.notes || ""}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{acta.recipient_cargo || "-"}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-slate-600">{acta.recipient_cedula || "-"}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmt(acta.generated_at)}</td>
                        <td className="px-4 py-3">
                          <WorkflowBadge status={acta.signature_workflow_status} isComplete={acta.is_complete} isAnnulled={isAnnulled} />
                          {isAnnulled && acta.annulment_reason ? (
                            <p className="mt-0.5 max-w-[220px] text-[10px] text-red-500">
                              {acta.annulment_reason}
                            </p>
                          ) : null}
                          {acta.is_complete && acta.signed_at ? (
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {new Date(acta.signed_at).toLocaleDateString("es-EC")}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {!isAnnulled && !acta.signature_workflow_id && !acta.signature_workflow_status && !acta.is_complete ? (
                              <button
                                type="button"
                                onClick={() => handleOpenStartWorkflowModal(acta)}
                                className="flex cursor-pointer items-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs text-white transition-colors hover:bg-blue-700 active:scale-[0.97] whitespace-nowrap"
                              >
                                <FiPlus size={11} /> Iniciar firma colectiva
                              </button>
                            ) : null}

                            {!isAnnulled && (acta.signature_workflow_id || acta.signature_workflow_status) ? (
                              <button
                                type="button"
                                onClick={() => handleOpenWorkflow(acta)}
                                className="flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs text-blue-700 transition-colors hover:bg-blue-100 active:scale-[0.97] whitespace-nowrap"
                              >
                                <FiFileText size={11} /> Workflow
                              </button>
                            ) : null}

                            {!isAnnulled && String(acta.signature_workflow_status || "").toLowerCase() === "completed" ? (
                              <button
                                type="button"
                                onClick={() => handleDownloadFinalPdf(acta)}
                                disabled={downloadingFinalPdfId === acta.id}
                                className="flex cursor-pointer items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 text-xs text-green-700 transition-colors hover:bg-green-100 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60 whitespace-nowrap"
                              >
                                {downloadingFinalPdfId === acta.id
                                  ? <FiRefreshCw size={11} className="animate-spin" />
                                  : <FiCheck size={11} />}
                                PDF Firmado
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleDownload(acta)}
                              title="Descargar acta"
                              className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97] whitespace-nowrap"
                            >
                              <FiDownload size={11} /> PDF
                            </button>

                            {!isAnnulled && acta.is_complete && acta.signed_pdf_drive_url ? (
                              <a
                                href={acta.signed_pdf_drive_url}
                                target="_blank"
                                rel="noreferrer"
                                title="Ver acta firmada en Drive"
                                className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 text-xs text-green-700 transition-colors hover:bg-green-100 whitespace-nowrap"
                              >
                                <FiCheck size={11} /> Firmada
                              </a>
                            ) : null}

                            {!isAnnulled && !acta.is_complete ? (
                              <label className="cursor-pointer" title="Subir acta firmada">
                                <span
                                  className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                                    isUploading
                                      ? "cursor-wait border-slate-200 bg-slate-100 text-slate-400"
                                      : "cursor-pointer border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                  }`}
                                >
                                  {isUploading ? (
                                    <>
                                      <FiRefreshCw size={11} className="animate-spin" /> Subiendo...
                                    </>
                                  ) : (
                                    <>
                                      <FiUploadCloud size={11} /> Firmar
                                    </>
                                  )}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,application/pdf"
                                  className="hidden"
                                  disabled={Boolean(uploadingId)}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) handleSignedUpload(acta.id, file);
                                    event.target.value = "";
                                  }}
                                />
                              </label>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showWorkflowModal && workflowActa ? (
        <StartWorkflowModal
          acta={workflowActa}
          users={directoryUsers}
          loadingUsers={loadingUsers}
          saving={savingWorkflow}
          onClose={() => {
            if (savingWorkflow) return;
            setShowWorkflowModal(false);
            setWorkflowActa(null);
          }}
          onSubmit={handleCreateWorkflow}
        />
      ) : null}
    </>
  );
};

export default TIActasPage;
