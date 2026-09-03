import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiCheck,
  FiClock,
  FiFileText,
  FiInbox,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import Modal from "../../../core/ui/components/Modal";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import {
  createSignatureWorkflow,
  listMyCompletedSignatureWorkflows,
  listMyPendingSignatureWorkflows,
  listSignatureWorkflows,
  listSignatureWorkflowSignerCandidates,
  sendSignatureWorkflow,
} from "../../../core/api/signatureWorkflowsApi";

const TAB_CONFIG = {
  inbox: {
    label: "Pendientes",
    emptyTitle: "No tienes firmas pendientes",
    emptyMessage: "Cuando un documento quede listo para tu paso de firma aparecerá aquí.",
  },
  created: {
    label: "Creados por mí",
    emptyTitle: "Aún no has iniciado workflows",
    emptyMessage: "Los workflows que inicies desde actas o documentos aparecerán en esta bandeja.",
  },
  completed: {
    label: "Completados",
    emptyTitle: "No hay workflows completados",
    emptyMessage: "Aquí verás los documentos que ya cerraron su cadena de firma.",
  },
  all: {
    label: "Todos",
    emptyTitle: "No hay workflows visibles",
    emptyMessage: "No se encontraron workflows con los filtros actuales.",
  },
};

const TAB_ROUTES = [
  { id: "inbox", path: "/dashboard/signatures/inbox", icon: FiInbox },
  { id: "created", path: "/dashboard/signatures/created", icon: FiFileText },
  { id: "completed", path: "/dashboard/signatures/completed", icon: FiCheck },
  { id: "all", path: "/dashboard/signatures/all", icon: FiClock },
];

const STATUS_STYLES = {
  prepared: "bg-slate-100 text-slate-700",
  sent: "bg-blue-50 text-blue-700",
  in_progress: "bg-blue-50 text-blue-700",
  partially_signed: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-slate-200 text-slate-700",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRouteTab(pathname) {
  if (pathname.endsWith("/created")) return "created";
  if (pathname.endsWith("/completed")) return "completed";
  if (pathname.endsWith("/all")) return "all";
  return "inbox";
}

function WorkflowStatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_STYLES[normalized] || "bg-slate-100 text-slate-700"
      }`}
    >
      {normalized ? normalized.replace(/_/g, " ") : "sin estado"}
    </span>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rounded-full bg-slate-100 p-4 text-slate-400">
        <FiInbox size={24} />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
    </div>
  );
}

const buildSignerDraft = () => ({ user_id: "", is_required: true });

function getUserLabel(user) {
  return user?.fullname || user?.name || user?.email || "Usuario sin nombre";
}

function readPdfAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.replace(/^data:application\/pdf;base64,/, ""));
    };
    reader.onerror = () => reject(new Error("No se pudo leer el PDF"));
    reader.readAsDataURL(file);
  });
}

function ManualWorkflowModal({ open, users = [], loadingUsers, saving, onClose, onSubmit }) {
  const { showToast } = useUI();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentFile, setDocumentFile] = useState(null);
  const [signers, setSigners] = useState([buildSignerDraft()]);

  const setSignerField = (index, field, value) => {
    setSigners((current) =>
      current.map((signer, signerIndex) =>
        signerIndex === index ? { ...signer, [field]: value } : signer
      )
    );
  };

  const addSigner = () => setSigners((current) => [...current, buildSignerDraft()]);
  const removeSigner = (index) => {
    setSigners((current) => (current.length <= 1 ? current : current.filter((_, signerIndex) => signerIndex !== index)));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setDocumentFile(null);
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Solo puedes subir documentos PDF", "warning");
      event.target.value = "";
      return;
    }
    setDocumentFile(file);
  };

  const handleSubmit = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      showToast("Ingresa un titulo para el workflow", "warning");
      return;
    }
    if (!documentFile) {
      showToast("Sube el documento PDF que se va a firmar", "warning");
      return;
    }

    const normalizedSigners = signers.map((signer, index) => ({
      ...signer,
      sequence_order: index + 1,
      user_id: Number(signer.user_id || 0),
    }));

    if (normalizedSigners.some((signer) => !Number.isFinite(signer.user_id) || signer.user_id <= 0)) {
      showToast("Selecciona un usuario en cada paso de firma", "warning");
      return;
    }

    const signerIds = normalizedSigners.map((signer) => signer.user_id);
    if (new Set(signerIds).size !== signerIds.length) {
      showToast("No puedes repetir el mismo firmante", "warning");
      return;
    }

    const pdfBase64 = await readPdfAsBase64(documentFile);
    const payloadSigners = normalizedSigners.map((signer) => {
      const user = users.find((item) => Number(item.id) === signer.user_id);
      return {
        user_id: user.id,
        email: user.email,
        name: getUserLabel(user),
        role: user.role || null,
        sequence_order: signer.sequence_order,
        is_required: signer.is_required !== false,
      };
    });

    onSubmit({
      title: normalizedTitle,
      description: description.trim(),
      documentFile,
      pdfBase64,
      signers: payloadSigners,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo workflow de firma" maxWidth="max-w-5xl" disableClose={saving}>
      <div className="space-y-5">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">Solicitar firmas desde FamSign</p>
          <p className="mt-1 text-sm text-blue-700">
            Sube un PDF, selecciona los firmantes y el sistema enviara el workflow a todos para firma paralela.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Titulo del documento
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Acuerdo de confidencialidad, acta de entrega, contrato interno"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Descripcion opcional
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="Contexto para los firmantes"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-blue-300 hover:bg-blue-50">
            <FiUpload size={24} className="text-slate-400" />
            <span className="mt-3 text-sm font-semibold text-slate-800">
              {documentFile ? documentFile.name : "Subir PDF"}
            </span>
            <span className="mt-1 text-xs text-slate-400">
              {documentFile ? `${Math.max(1, Math.round(documentFile.size / 1024))} KB` : "Documento que se va a firmar"}
            </span>
            <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} className="hidden" />
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Firmantes</p>
              <p className="mt-1 text-xs text-slate-500">Todos los firmantes recibiran la solicitud al enviar el workflow.</p>
            </div>
            <button
              type="button"
              onClick={addSigner}
              disabled={saving || loadingUsers}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlus size={14} />
              Agregar firmante
            </button>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-10">
              <FiRefreshCw size={20} className="animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {signers.map((signer, index) => {
                const selectedUser = users.find((item) => Number(item.id) === Number(signer.user_id || 0));
                return (
                  <div key={`manual-signer-${index}`} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 lg:grid-cols-[72px_minmax(0,1fr)_150px_48px]">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Paso</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{index + 1}</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Usuario firmante
                      </label>
                      <select
                        value={signer.user_id}
                        onChange={(event) => setSignerField(index, "user_id", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Selecciona un usuario</option>
                        {users.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {getUserLabel(candidate)} - {candidate.role || "sin rol"}
                          </option>
                        ))}
                      </select>
                      {selectedUser ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {selectedUser.email} - {selectedUser.department_name || "Sin departamento"}
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
                      disabled={signers.length <= 1 || saving}
                      className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Quitar firmante"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="-mx-4 -mb-4 flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:-mx-6 sm:-mb-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || loadingUsers}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <FiRefreshCw size={14} className="animate-spin" /> : <FiSend size={14} />}
            {saving ? "Creando workflow..." : "Solicitar firmas"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const SignatureDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useUI();

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pendingRows, setPendingRows] = useState([]);
  const [completedRows, setCompletedRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [showManualWorkflow, setShowManualWorkflow] = useState(false);
  const [signerUsers, setSignerUsers] = useState([]);
  const [loadingSignerUsers, setLoadingSignerUsers] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);

  const activeTab = useMemo(() => getRouteTab(location.pathname), [location.pathname]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, completed, all] = await Promise.all([
        listMyPendingSignatureWorkflows(),
        listMyCompletedSignatureWorkflows(),
        listSignatureWorkflows(),
      ]);
      setPendingRows(Array.isArray(pending) ? pending : []);
      setCompletedRows(Array.isArray(completed) ? completed : []);
      setAllRows(Array.isArray(all) ? all : []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar la bandeja de firmas", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadSignerUsers = useCallback(async () => {
    setLoadingSignerUsers(true);
    try {
      const users = await listSignatureWorkflowSignerCandidates();
      setSignerUsers(Array.isArray(users) ? users : []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar la lista de firmantes", "error");
    } finally {
      setLoadingSignerUsers(false);
    }
  }, [showToast]);

  const openManualWorkflow = () => {
    setShowManualWorkflow(true);
    if (!signerUsers.length) loadSignerUsers();
  };

  const handleCreateManualWorkflow = async ({ title, description, documentFile, pdfBase64, signers }) => {
    setCreatingWorkflow(true);
    try {
      const created = await createSignatureWorkflow({
        source_module: "famsign",
        source_entity: "manual_document",
        source_entity_id: Math.floor(Date.now() / 1000),
        document_type: "uploaded_pdf",
        title,
        description,
        document: {
          filename: documentFile.name,
          pdf_base64: pdfBase64,
        },
        signers,
        meta: {
          created_from: "signature_center",
          requested_by: user?.email || null,
        },
      });
      const workflowId = created?.workflow?.id || created?.id;
      if (!workflowId) throw new Error("El backend no devolvio el ID del workflow");
      await sendSignatureWorkflow(workflowId);
      showToast("Workflow enviado a todos los firmantes", "success");
      setShowManualWorkflow(false);
      await loadData();
      navigate(`/dashboard/signatures/workflows/${workflowId}`);
    } catch (error) {
      showToast(error?.response?.data?.message || error?.message || "No se pudo crear el workflow", "error");
    } finally {
      setCreatingWorkflow(false);
    }
  };

  const createdRows = useMemo(() => {
    const currentUserId = Number(user?.id || 0);
    return allRows.filter((row) => Number(row.created_by || 0) === currentUserId);
  }, [allRows, user?.id]);

  const rowsByTab = useMemo(
    () => ({
      inbox: pendingRows,
      created: createdRows,
      completed: completedRows,
      all: allRows,
    }),
    [allRows, completedRows, createdRows, pendingRows]
  );

  const rawRows = useMemo(() => rowsByTab[activeTab] || [], [activeTab, rowsByTab]);
  const filteredRows = useMemo(() => {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return rawRows;
    return rawRows.filter((row) =>
      [
        row.workflow_code,
        row.title,
        row.source_module,
        row.source_entity,
        row.status,
        row.document_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    );
  }, [query, rawRows]);

  const stats = useMemo(() => {
    const inProgress = allRows.filter((row) =>
      ["sent", "in_progress", "partially_signed"].includes(String(row.status || "").toLowerCase())
    ).length;
    return {
      pending: pendingRows.length,
      created: createdRows.length,
      completed: completedRows.length,
      inProgress,
    };
  }, [allRows, completedRows, createdRows, pendingRows]);

  const tabMeta = TAB_CONFIG[activeTab] || TAB_CONFIG.inbox;

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">FamSign</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Centro de firmas</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Revisa tus pasos pendientes, sigue workflows creados desde otros módulos y descarga el documento final cuando la cadena se complete.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openManualWorkflow}
              className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.97]"
            >
              <span className="inline-flex items-center gap-2">
                <FiPlus size={14} />
                Nuevo workflow
              </span>
            </button>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2">
                <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Actualizar
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap sm:flex-nowrap sm:divide-x divide-slate-100">
          {[
            { label: "Pendientes", value: stats.pending, tone: stats.pending > 0 ? "text-blue-700" : "text-slate-900" },
            { label: "En proceso", value: stats.inProgress, tone: "text-slate-900" },
            { label: "Creados por mí", value: stats.created, tone: "text-slate-900" },
            { label: "Completados", value: stats.completed, tone: stats.completed > 0 ? "text-green-700" : "text-slate-900" },
          ].map((item, index) => (
            <div key={item.label} className={`flex-1 min-w-[50%] px-4 py-3 sm:min-w-0 ${index > 1 ? "border-t border-slate-100 sm:border-t-0" : ""}`}>
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TAB_ROUTES.map(({ id, path, icon: Icon }) => {
              const isActive = id === activeTab;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(path)}
                  className={`cursor-pointer rounded-2xl px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97] ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon size={14} />
                    {TAB_CONFIG[id].label}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
            <FiSearch size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por código, título o módulo"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 lg:w-80"
            />
          </label>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <FiRefreshCw size={20} className="animate-spin text-slate-300" />
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState title={tabMeta.emptyTitle} message={tabMeta.emptyMessage} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <button
                  key={`${activeTab}-${row.id || row.workflow_id}`}
                  type="button"
                  onClick={() => navigate(`/dashboard/signatures/workflows/${row.id || row.workflow_id}`)}
                  className="cursor-pointer flex w-full flex-col gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 active:scale-[0.997] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                        {row.workflow_code || `WF-${row.id}`}
                      </span>
                      <WorkflowStatusBadge status={row.status || row.signer_status} />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{row.title || "Sin título"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.source_module || "-"} / {row.source_entity || "-"} / {row.source_entity_id || "-"}
                    </p>
                    {row.document_type ? (
                      <p className="mt-1 text-xs text-slate-400">{row.document_type}</p>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-400">{formatDate(row.created_at || row.signed_at)}</p>
                    <p className="mt-2 text-sm font-medium text-blue-700">Abrir workflow</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <ManualWorkflowModal
        open={showManualWorkflow}
        users={signerUsers}
        loadingUsers={loadingSignerUsers}
        saving={creatingWorkflow}
        onClose={() => {
          if (!creatingWorkflow) setShowManualWorkflow(false);
        }}
        onSubmit={handleCreateManualWorkflow}
      />
    </div>
  );
};

export default SignatureDashboard;
