import React from "react";
import {
  FiAlertTriangle,
  FiCheck,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiShield,
  FiSlash,
  FiUserCheck,
} from "react-icons/fi";
import PdfSignerViewer from "./PdfSignerViewer";

export default function SignatureWorkflowDetailWorkspace({
  workflow,
  workflowMeta,
  currentDocument,
  signers,
  user,
  matchesCurrentUser,
  getSignerStatusMeta,
  formatDate,
  signingUrl,
  qrDataUrl,
  qrLoading,
  pdfBuffer,
  pdfLoading,
  actionableSigner,
  signatureB64,
  placement,
  setPlacement,
  consent,
  setConsent,
  consentText,
  setConsentText,
  rejectReason,
  setRejectReason,
  acting,
  handleSign,
  handleReject,
  handleDownloadQr,
  handleDownloadSource,
  handleDownloadFinal,
  handleDownloadValidationSheet,
  canManageWorkflow,
  reassignableStatuses,
  reassignableWorkflowStatuses,
  reassignSignerId,
  setReassignSignerId,
  reassignEmail,
  setReassignEmail,
  reassignName,
  setReassignName,
  reassignReason,
  setReassignReason,
  reassigning,
  handleReassign,
  showCancelConfirm,
  setShowCancelConfirm,
  cancelling,
  handleCancel,
  navigate,
}) {
  const completed = String(workflow.status || "").toLowerCase() === "completed";
  const canCancel =
    ["prepared", "sent", "in_progress", "partially_signed"].includes(String(workflow.status || "").toLowerCase()) &&
    canManageWorkflow;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50/70 px-2 py-3 sm:px-4 lg:px-6 xl:px-8">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-4">
        <header className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-3xl sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[0.97]"
                >
                  Volver
                </button>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${workflowMeta.className}`}>
                  {workflowMeta.label}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-mono text-slate-600">
                  {workflow.workflow_code || `#${workflow.id}`}
                </span>
              </div>
              <h1 className="mt-2 line-clamp-2 text-lg font-bold leading-tight text-slate-950 sm:text-2xl">
                {workflow.title}
              </h1>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={handleDownloadSource}
                className="cursor-pointer inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
              >
                <FiDownload size={14} />
                PDF base
              </button>
              <button
                type="button"
                onClick={handleDownloadQr}
                disabled={!signingUrl || qrLoading}
                className="cursor-pointer inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiDownload size={14} />
                QR
              </button>
              <button
                type="button"
                onClick={handleDownloadFinal}
                title={completed ? "Descargar el PDF firmado" : "Descargar el PDF con las firmas registradas hasta ahora; los espacios de quienes falten firmar quedan en blanco"}
                className="cursor-pointer inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100 active:scale-[0.97]"
              >
                <FiCheck size={14} />
                {completed ? "PDF firmado" : "PDF firmado parcial"}
              </button>
              {completed && (
                <button
                  type="button"
                  onClick={handleDownloadValidationSheet}
                  className="cursor-pointer col-span-2 inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 active:scale-[0.97] sm:col-span-1"
                >
                  <FiShield size={14} />
                  Hoja de validacion
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:rounded-3xl sm:p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FiFileText size={16} className="text-blue-600" />
                  <h2 className="text-lg font-bold text-slate-950">Documento a firmar</h2>
                </div>
                <p className="mt-1 break-all text-sm text-slate-500 sm:truncate">
                  {currentDocument?.filename || "Sin documento asociado"}
                </p>
              </div>
              {actionableSigner ? (
                <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">
                  Pendiente de tu firma
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                  Sin firma pendiente
                </span>
              )}
            </div>

            {pdfLoading ? (
              <div className="flex min-h-[48vh] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 sm:min-h-[560px]">
                <FiRefreshCw size={24} className="animate-spin text-blue-500" />
              </div>
            ) : pdfBuffer ? (
              <PdfSignerViewer
                pdfArrayBuffer={pdfBuffer}
                signatureB64={actionableSigner ? signatureB64 : null}
                placement={actionableSigner ? placement : null}
                onPlacement={actionableSigner ? setPlacement : undefined}
                readOnly={!actionableSigner}
              />
            ) : (
              <div className="flex min-h-[42vh] items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700 sm:min-h-[420px] sm:p-6">
                No se pudo cargar la previsualizacion del documento. Puedes descargar el PDF base desde el encabezado.
              </div>
            )}
          </section>

          <aside className="min-w-0 space-y-3 sm:space-y-4 xl:sticky xl:top-28">
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_14px_32px_rgba(15,23,42,0.07)] sm:rounded-3xl sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Firmantes</h2>
                  <p className="text-sm text-slate-500">{signers.length} participantes en orden</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {signers.filter((s) => String(s.status || "").toLowerCase() === "signed").length}/{signers.length}
                </span>
              </div>

              <div className="mt-4 max-h-[36vh] space-y-2 overflow-auto pr-1 sm:max-h-[42vh] xl:max-h-[calc(100vh-250px)]">
                {signers.map((signer) => {
                  const meta = getSignerStatusMeta(signer.status, signer.status || "Sin estado");
                  const isMe = matchesCurrentUser(signer, user);
                  const canReassign =
                    canManageWorkflow &&
                    reassignableStatuses.includes(String(signer.status || "").toLowerCase()) &&
                    reassignableWorkflowStatuses.includes(String(workflow.status || "").toLowerCase());

                  return (
                    <div key={signer.id} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-slate-900 sm:truncate">
                            {signer.sequence_order}. {signer.name_snapshot}
                            {isMe ? <span className="ml-1 text-xs font-medium text-blue-600">(tu)</span> : null}
                          </p>
                          <p className="break-all text-xs text-slate-500 sm:truncate">{signer.email_snapshot}</p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Firmado: {formatDate(signer.signed_at)}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>

                      {canReassign && (
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
                              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                            >
                              <FiUserCheck size={12} />
                              Reasignar
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <input
                                type="email"
                                placeholder="Email"
                                value={reassignEmail}
                                onChange={(event) => setReassignEmail(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                              />
                              <input
                                type="text"
                                placeholder="Nombre completo"
                                value={reassignName}
                                onChange={(event) => setReassignName(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                              />
                              <input
                                type="text"
                                placeholder="Motivo opcional"
                                value={reassignReason}
                                onChange={(event) => setReassignReason(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReassign(signer)}
                                  disabled={reassigning}
                                  className="cursor-pointer rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReassignSignerId(null)}
                                  disabled={reassigning}
                                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
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

            {actionableSigner && (
              <section className="rounded-2xl border border-blue-100 bg-white p-3 shadow-[0_14px_32px_rgba(37,99,235,0.10)] sm:rounded-3xl sm:p-4">
                <h2 className="text-lg font-bold text-slate-950">Accion de firma</h2>
                <p className="mt-1 text-sm text-slate-500">Ubica tu firma en el documento visible y confirma.</p>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Firma generada</p>
                  {signatureB64 ? (
                    <img src={signatureB64} alt="Firma" className="mt-2 max-h-[48px]" draggable={false} />
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">Generando firma...</p>
                  )}
                </div>

                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600"
                  />
                  <span className="min-w-0 text-sm font-semibold text-slate-800">Acepto firmar este documento</span>
                </label>

                <textarea
                  value={consentText}
                  onChange={(event) => setConsentText(event.target.value)}
                  rows={2}
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />

                <button
                  type="button"
                  onClick={handleSign}
                  disabled={acting || !consent || !placement}
                  className="mt-3 cursor-pointer inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-[0_12px_26px_rgba(37,99,235,0.25)] transition hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {acting ? <FiRefreshCw size={14} className="animate-spin" /> : <FiCheck size={14} />}
                  Firmar documento
                </button>

                {(!consent || !placement) && (
                  <p className="mt-2 text-center text-xs text-slate-500">
                    Falta aceptar el consentimiento y ubicar la firma.
                  </p>
                )}

                <details className="mt-4 rounded-2xl border border-red-100 bg-red-50/70 p-3">
                  <summary className="cursor-pointer text-sm font-bold text-red-700">Rechazar documento</summary>
                  <textarea
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    rows={3}
                    placeholder="Motivo de rechazo"
                    className="mt-3 w-full rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={acting || !rejectReason.trim()}
                    className="mt-2 cursor-pointer inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60 sm:w-auto"
                  >
                    <FiSlash size={14} />
                    Rechazar
                  </button>
                </details>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_14px_32px_rgba(15,23,42,0.07)] sm:rounded-3xl sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">QR para firmar</h2>
                  <p className="text-sm text-slate-500">Abre el workflow para firmar con sesion iniciada.</p>
                </div>
                {qrLoading ? <FiRefreshCw size={18} className="animate-spin text-blue-500" /> : null}
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center self-center rounded-2xl border border-slate-100 bg-slate-50 p-2 sm:self-auto">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={`QR ${workflow.workflow_code || workflow.id}`} className="h-full w-full" />
                  ) : (
                    <FiAlertTriangle size={18} className="text-amber-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 break-all text-xs text-slate-500">{signingUrl || "Sin enlace disponible"}</p>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    disabled={!signingUrl || qrLoading}
                    className="mt-3 cursor-pointer rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-60"
                  >
                    Descargar QR
                  </button>
                </div>
              </div>
            </section>

            {canCancel && (
              <section className="rounded-2xl border border-red-100 bg-red-50 p-3 sm:rounded-3xl sm:p-4">
                <p className="text-sm font-bold text-red-700">Cancelar workflow</p>
                <p className="mt-1 text-xs text-red-600">Detiene el proceso de firma.</p>
                {!showCancelConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="mt-3 cursor-pointer w-full rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 sm:w-auto"
                  >
                    Cancelar workflow
                  </button>
                ) : (
                  <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="cursor-pointer rounded-2xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      Si, cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={cancelling}
                      className="cursor-pointer rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
                    >
                      Volver
                    </button>
                  </div>
                )}
              </section>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
