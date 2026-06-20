import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCheck,
  FiClock,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiShield,
  FiSlash,
  FiUserCheck,
} from "react-icons/fi";
import { generateSignatureValidationSheet } from "../utils/signatureValidationSheetPdf";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import {
  cancelSignatureWorkflow,
  downloadSignatureWorkflowFinalPdf,
  downloadSignatureWorkflowSourcePdf,
  getSignatureWorkflow,
  getSignatureWorkflowSourcePdfBuffer,
  openSignatureWorkflowStep,
  reassignSignatureWorkflowSigner,
  rejectSignatureWorkflowStep,
  signSignatureWorkflowStep,
} from "../../../core/api/signatureWorkflowsApi";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import PdfSignerViewer from "../components/PdfSignerViewer";

const WORKFLOW_STATUS_META = {
  prepared: { label: "Preparado", className: "bg-slate-100 text-slate-700" },
  sent: { label: "Enviado", className: "bg-blue-50 text-blue-700" },
  in_progress: { label: "En curso", className: "bg-indigo-50 text-indigo-700" },
  partially_signed: { label: "Firma parcial", className: "bg-violet-50 text-violet-700" },
  completed: { label: "Completado", className: "bg-green-50 text-green-700" },
  rejected: { label: "Rechazado", className: "bg-red-50 text-red-700" },
  cancelled: { label: "Cancelado", className: "bg-slate-200 text-slate-700" },
  expired: { label: "Expirado", className: "bg-orange-50 text-orange-700" },
};

const SIGNER_STATUS_META = {
  pending: { label: "Pendiente", className: "bg-slate-100 text-slate-700" },
  available: { label: "Disponible", className: "bg-blue-50 text-blue-700" },
  opened: { label: "Abierto", className: "bg-indigo-50 text-indigo-700" },
  signed: { label: "Firmado", className: "bg-green-50 text-green-700" },
  rejected: { label: "Rechazado", className: "bg-red-50 text-red-700" },
};

function getStatusMeta(map, key, fallbackLabel = "Sin estado") {
  return map[String(key || "").toLowerCase()] || {
    label: fallbackLabel,
    className: "bg-slate-100 text-slate-700",
  };
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-EC", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function triggerBlobDownload(blob, filename) {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

function matchesCurrentUser(signer, user) {
  if (!signer || !user) return false;
  const userId = Number(user.id || 0);
  const signerUserId = Number(signer.user_id || 0);
  const signerEmail = String(signer.email_snapshot || "").trim().toLowerCase();
  const userEmail = String(user.email || "").trim().toLowerCase();
  return (userId > 0 && signerUserId === userId) || (userEmail && signerEmail === userEmail);
}

const SignatureWorkflowDetailPage = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useUI();

  const [signatureB64, setSignatureB64] = useState(null);
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [placement, setPlacement] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [reassignSignerId, setReassignSignerId] = useState(null);
  const [reassignEmail, setReassignEmail] = useState("");
  const [reassignName, setReassignName] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentText, setConsentText] = useState(
    "He revisado el documento y acepto firmarlo electrónicamente dentro de FamSPI."
  );
  const [rejectReason, setRejectReason] = useState("");

  const loadWorkflow = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getSignatureWorkflow(workflowId);
      setData(response);
    } catch (err) {
      const message = err?.response?.data?.message || "No se pudo cargar el workflow";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  useEffect(() => {
    let parts = [];
    const fullName = user?.name || user?.username || "";
    if (fullName.trim()) {
      parts = fullName.trim().split(/\s+/);
    } else if (user?.email) {
      // parse "rafael.ortiz@fam-project.com" → ["rafael", "ortiz"]
      const localPart = user.email.split("@")[0] || "";
      parts = localPart.split(/[._-]+/).filter(Boolean);
    }
    if (!parts.length) return;
    const initial = parts[0][0].toUpperCase();
    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const lastName_cap = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    const sigText = `${initial}.${lastName_cap}`;
    if (!sigText) return;

    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 110;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "italic 48px 'Brush Script MT', 'Segoe Script', cursive";
    ctx.fillStyle = "rgba(18, 38, 72, 0.78)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(sigText, canvas.width / 2, canvas.height / 2);
    setSignatureB64(canvas.toDataURL("image/png"));
  }, [user]);

  const currentDocument = data?.documents?.[0] || null;

  useEffect(() => {
    if (!data) return;
    const wf = data.workflow;
    const doc = data.documents?.[0];
    const signers = data.signers || [];
    const myS = signers.find((s) => matchesCurrentUser(s, user));
    const isActionable = myS && ["available", "opened"].includes(String(myS.status || "").toLowerCase());
    if (!isActionable || !doc || !wf) return;
    setPdfLoading(true);
    getSignatureWorkflowSourcePdfBuffer(wf.id, doc.id)
      .then((buf) => setPdfBuffer(buf))
      .catch(() => {})
      .finally(() => setPdfLoading(false));
  }, [data, user]);

  const workflow = data?.workflow || null;
  const signers = useMemo(() => data?.signers || [], [data?.signers]);
  const mySigner = useMemo(
    () => signers.find((signer) => matchesCurrentUser(signer, user)),
    [signers, user]
  );
  const actionableSigner =
    mySigner && ["available", "opened"].includes(String(mySigner.status || "").toLowerCase())
      ? mySigner
      : null;

  const handleOpenStep = async () => {
    if (!actionableSigner) return;
    setActing(true);
    try {
      await openSignatureWorkflowStep(workflow.id, actionableSigner.id);
      await loadWorkflow();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo abrir el paso de firma", "error");
    } finally {
      setActing(false);
    }
  };

  const handleSign = async () => {
    if (!actionableSigner) return;
    if (!consent) {
      showToast("Debes aceptar el consentimiento expreso antes de firmar", "warning");
      return;
    }
    if (!placement) {
      showToast("Debes ubicar tu firma en el documento antes de firmar", "warning");
      return;
    }

    const signatureVisual = signatureB64 || null;

    setActing(true);
    try {
      if (String(actionableSigner.status || "").toLowerCase() === "available") {
        await openSignatureWorkflowStep(workflow.id, actionableSigner.id);
      }
      await signSignatureWorkflowStep(workflow.id, actionableSigner.id, {
        consent: true,
        consent_text: consentText,
        session_id: `workflow_${workflow.id}_${Date.now()}`,
        signature_visual_base64: signatureVisual,
        signature_placement: placement,
      });
      showToast("Firma registrada correctamente", "success");
      await loadWorkflow();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo firmar el documento", "error");
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!actionableSigner) return;
    if (!rejectReason.trim()) {
      showToast("Debes indicar el motivo del rechazo", "warning");
      return;
    }

    setActing(true);
    try {
      if (String(actionableSigner.status || "").toLowerCase() === "available") {
        await openSignatureWorkflowStep(workflow.id, actionableSigner.id);
      }
      await rejectSignatureWorkflowStep(workflow.id, actionableSigner.id, {
        reason: rejectReason.trim(),
      });
      showToast("Rechazo registrado", "success");
      await loadWorkflow();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo rechazar el documento", "error");
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelSignatureWorkflow(workflow.id);
      showToast("Workflow cancelado", "success");
      setShowCancelConfirm(false);
      await loadWorkflow();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo cancelar el workflow", "error");
    } finally {
      setCancelling(false);
    }
  };

  const handleReassign = async (signer) => {
    if (!reassignEmail.trim() || !reassignName.trim()) {
      showToast("Email y nombre son requeridos", "warning");
      return;
    }
    setReassigning(true);
    try {
      await reassignSignatureWorkflowSigner(workflow.id, signer.id, {
        email: reassignEmail.trim(),
        name: reassignName.trim(),
        reason: reassignReason.trim() || undefined,
      });
      showToast("Firmante reasignado correctamente", "success");
      setReassignSignerId(null);
      setReassignEmail("");
      setReassignName("");
      setReassignReason("");
      await loadWorkflow();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo reasignar el firmante", "error");
    } finally {
      setReassigning(false);
    }
  };

  const handleDownloadSource = async () => {
    if (!workflow || !currentDocument) return;
    try {
      const response = await downloadSignatureWorkflowSourcePdf(workflow.id, currentDocument.id);
      triggerBlobDownload(response.blob, response.filename);
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo descargar el PDF base", "error");
    }
  };

  const handleDownloadValidationSheet = async () => {
    try {
      await generateSignatureValidationSheet({ workflow, signers, documents: data?.documents || [] });
    } catch {
      showToast("No se pudo generar la hoja de validación", "error");
    }
  };

  const handleDownloadFinal = async () => {
    if (!workflow || !currentDocument) return;
    try {
      const response = await downloadSignatureWorkflowFinalPdf(workflow.id, currentDocument.id);
      triggerBlobDownload(response.blob, response.filename);
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo descargar el PDF final", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <FiRefreshCw size={22} className="animate-spin text-slate-300" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <FiAlertTriangle size={16} />
            No se pudo cargar el workflow
          </div>
          <p className="mt-2 text-sm">{error || "Workflow no encontrado"}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 cursor-pointer rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 active:scale-[0.97]"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const workflowMeta = getStatusMeta(WORKFLOW_STATUS_META, workflow.status, workflow.status || "Sin estado");

  const canManageWorkflow =
    Number(workflow.created_by) === Number(user?.id) ||
    ["admin", "administrador"].includes(String(user?.role || "").toLowerCase());

  const reassignableStatuses = ["pending", "available"];
  const reassignableWorkflowStatuses = ["prepared", "sent", "in_progress", "partially_signed"];

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 active:scale-[0.97]"
        >
          ← Volver
        </button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${workflowMeta.className}`}>
                {workflowMeta.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-mono text-slate-600">
                {workflow.workflow_code}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">{workflow.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {workflow.source_module} / {workflow.source_entity} / {workflow.source_entity_id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSource}
              className="cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97]"
            >
              <FiDownload size={14} />
              PDF base
            </button>
            {String(workflow.status || "").toLowerCase() === "completed" && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadFinal}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 active:scale-[0.97]"
                >
                  <FiCheck size={14} />
                  PDF firmado
                </button>
                <button
                  type="button"
                  onClick={handleDownloadValidationSheet}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 active:scale-[0.97]"
                >
                  <FiShield size={14} />
                  Hoja de validación
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2">
              <FiFileText size={16} className="text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">Documento</h2>
            </div>
            {currentDocument ? (
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">{currentDocument.filename}</p>
                <p className="mt-1 text-xs text-slate-500">
                  SHA base: <span className="font-mono">{currentDocument.source_sha256}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Finalizado: {formatDate(currentDocument.finalized_at)}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No hay documento asociado.</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2">
              <FiClock size={16} className="text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
            </div>
            <div className="mt-4 space-y-3">
              {(data.events || []).length ? (
                data.events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">{event.event_type}</p>
                      <span className="text-xs text-slate-400">{formatDate(event.created_at)}</span>
                    </div>
                    {event.event_description && (
                      <p className="mt-1 text-xs text-slate-500">{event.event_description}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Aún no hay eventos registrados.</p>
              )}
            </div>
          </section>

          {/* Cancel section — only for creator/admin on active workflows */}
          {(() => {
            const cancelableStatuses = ["prepared","sent","in_progress","partially_signed"];
            const canCancel = cancelableStatuses.includes(String(workflow.status || "").toLowerCase()) && canManageWorkflow;
            if (!canCancel) return null;
            return (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-700">Cancelar workflow</p>
                <p className="mt-1 text-xs text-red-500">
                  Esta acción detiene el proceso de firma. No se puede deshacer.
                </p>
                {!showCancelConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="mt-3 cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 active:scale-[0.97]"
                  >
                    <FiSlash size={14} />
                    Cancelar workflow
                  </button>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-red-600 font-semibold">¿Confirmas la cancelación?</p>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="cursor-pointer inline-flex items-center gap-2 rounded-2xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancelling ? <FiRefreshCw size={14} className="animate-spin" /> : <FiSlash size={14} />}
                      Sí, cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={cancelling}
                      className="cursor-pointer rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 active:scale-[0.97]"
                    >
                      Volver
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <h2 className="text-lg font-semibold text-slate-900">Firmantes</h2>
            <div className="mt-4 space-y-3">
              {signers.map((signer) => {
                const meta = getStatusMeta(SIGNER_STATUS_META, signer.status, signer.status || "Sin estado");
                const isMe = matchesCurrentUser(signer, user);
                return (
                  <div key={signer.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {signer.sequence_order}. {signer.name_snapshot}
                          {isMe ? <span className="ml-2 text-xs font-normal text-slate-400">(tú)</span> : null}
                          {signer.is_required === false && (
                            <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Opcional</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {signer.role_snapshot || "sin rol"} · {signer.email_snapshot}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Abierto: {formatDate(signer.opened_at)} · Firmado: {formatDate(signer.signed_at)}
                    </p>
                    {canManageWorkflow &&
                      reassignableStatuses.includes(String(signer.status || "").toLowerCase()) &&
                      reassignableWorkflowStatuses.includes(String(workflow.status || "").toLowerCase()) && (
                        <div className="mt-3 border-t border-slate-200 pt-3">
                          {reassignSignerId !== signer.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setReassignSignerId(signer.id);
                                setReassignEmail(signer.email_snapshot || "");
                                setReassignName(signer.name_snapshot || "");
                                setReassignReason("");
                              }}
                              className="cursor-pointer inline-flex items-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 active:scale-[0.97]"
                            >
                              <FiUserCheck size={12} />
                              Reasignar
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-amber-700">Nuevo firmante</p>
                              <input
                                type="email"
                                placeholder="Email *"
                                value={reassignEmail}
                                onChange={(e) => setReassignEmail(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                              />
                              <input
                                type="text"
                                placeholder="Nombre completo *"
                                value={reassignName}
                                onChange={(e) => setReassignName(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                              />
                              <input
                                type="text"
                                placeholder="Motivo (opcional)"
                                value={reassignReason}
                                onChange={(e) => setReassignReason(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReassign(signer)}
                                  disabled={reassigning}
                                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {reassigning ? <FiRefreshCw size={11} className="animate-spin" /> : <FiUserCheck size={11} />}
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReassignSignerId(null)}
                                  disabled={reassigning}
                                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 active:scale-[0.97]"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <h2 className="text-lg font-semibold text-slate-900">Acción</h2>
            {!actionableSigner ? (
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                No tienes un paso de firma disponible en este momento.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <button
                  type="button"
                  onClick={handleOpenStep}
                  disabled={acting || String(actionableSigner.status || "").toLowerCase() === "opened"}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiFileText size={14} />
                  {String(actionableSigner.status || "").toLowerCase() === "opened"
                    ? "Paso abierto"
                    : "Abrir paso de firma"}
                </button>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Consentimiento expreso</p>
                    <p className="mt-1 text-xs text-slate-500">
                      La firma queda registrada como evidencia interna del workflow.
                    </p>
                  </div>
                </label>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Texto de consentimiento
                  </label>
                  <textarea
                    value={consentText}
                    onChange={(event) => setConsentText(event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-slate-500">Tu firma</p>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      {signatureB64 ? (
                        <img
                          src={signatureB64}
                          alt="Firma"
                          className="max-h-[52px] select-none opacity-90"
                          draggable={false}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Generando firma…</span>
                      )}
                      <p className="text-[11px] text-slate-400">
                        Se incrustará donde la ubiques en el documento
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      Ubicar firma en el documento
                    </p>
                    {pdfLoading ? (
                      <div className="flex h-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                      </div>
                    ) : pdfBuffer ? (
                      <PdfSignerViewer
                        pdfArrayBuffer={pdfBuffer}
                        signatureB64={signatureB64}
                        placement={placement}
                        onPlacement={setPlacement}
                      />
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                        No se pudo cargar el documento para previsualización.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={handleSign}
                    disabled={acting || !consent || !placement}
                    className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {acting ? <FiRefreshCw size={14} className="animate-spin" /> : <FiCheck size={14} />}
                    Firmar documento
                  </button>

                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <label className="mb-1 block text-xs font-semibold text-red-500">
                      Motivo de rechazo
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    />
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={acting || !rejectReason.trim()}
                      className="mt-3 cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiSlash size={14} />
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SignatureWorkflowDetailPage;
