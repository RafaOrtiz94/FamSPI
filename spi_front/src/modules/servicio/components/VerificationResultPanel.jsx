import React from "react";
import Button from "../../../core/ui/components/Button";

const VerificationResultPanel = ({ purchase = {}, onOpenVerification }) => {
 const workflow = purchase?.installation_workflow || {};
 const verificationDecision = workflow?.verification_decision || {};
 const verificationCycle = workflow?.verification_cycle || {};
 const attempts = Array.isArray(verificationCycle?.attempts) ? verificationCycle.attempts : [];
 const latestAttempt = attempts.length ? attempts[attempts.length - 1] : null;

 const decisionLabel =
 verificationDecision?.applies === true
 ? "Aplica verificación"
 : verificationDecision?.applies === false
 ? "No aplica verificación"
 : "Sin decisión técnica";
 const statusLabel = String(verificationCycle?.status || "pending_decision")
 .replace(/_/g, " ")
 .replace(/\b\w/g, (char) => char.toUpperCase());
 const canRegisterVerification = verificationDecision?.applies === true;

 return (
 <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
 <div className="flex items-center justify-between gap-2">
 <h4 className="font-semibold text-slate-900">F.ST-09 · Verificación técnica</h4>
 <Button size="sm" onClick={onOpenVerification} disabled={!canRegisterVerification}>
 Registrar F.ST-09
 </Button>
 </div>
 <div className="grid grid-cols-1 gap-2 text-xs text-slate-600">
 <p>Decisión técnica: <span className="font-semibold text-slate-800">{decisionLabel}</span></p>
 <p>Estado ciclo: <span className="font-semibold text-slate-800">{statusLabel}</span></p>
 <p>Fuente técnica: <span className="font-semibold text-slate-800">{verificationDecision?.source_reference || "Pendiente"}</span></p>
 </div>

 {latestAttempt ? (
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
 <p className="font-semibold text-slate-800">Último intento #{latestAttempt.attempt_number || attempts.length}</p>
 <p>Resultado: {latestAttempt.result === "failed" ? "Fallida" : "Aprobada"}</p>
 <p>Criterio: {latestAttempt.criteria_reference || "N/D"}</p>
 {latestAttempt.document_link ? (
 <a
 href={latestAttempt.document_link}
 target="_blank"
 rel="noreferrer"
 className="mt-1 inline-block text-slate-700 underline"
 >
 Ver PDF F.ST-09
 </a>
 ) : null}
 </div>
 ) : (
 <p className="text-xs text-amber-700">
 {canRegisterVerification
 ? "Aún no se registra verificación F.ST-09."
 : "Primero debes registrar una decision tecnica que habilite la verificacion."}
 </p>
 )}
 </div>
 );
};

export default VerificationResultPanel;
