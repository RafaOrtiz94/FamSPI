import React, { useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiLoader,
  FiSend,
  FiUpload,
} from "react-icons/fi";
import { TrainingSignatureProgress } from "./TrainingStatusBadge";

function PanelSection({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">{title}</h3>
      {children}
    </div>
  );
}

function ActionBtn({ onClick, disabled, loading, icon: Icon, label, variant = "primary" }) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 cursor-pointer active:scale-[0.97]";
  const variants = {
    primary:  "bg-blue-600 text-white hover:bg-blue-700",
    secondary:"border border-slate-300 text-slate-700 hover:bg-slate-50",
    success:  "bg-green-600 text-white hover:bg-green-700",
    outline:  "border border-blue-300 text-blue-700 hover:bg-blue-50",
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]}`}>
      {loading ? <FiLoader size={14} className="animate-spin" /> : <Icon size={14} />}
      {label}
    </button>
  );
}

// ── Acta Principal ────────────────────────────────────────────────────────────

export function TrainingActaPanel({ training, actions, onRefresh }) {
  const fileRef       = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy]           = useState({});

  const { type, status, acta_drive_url, signature_workflow_status } = training;
  const isExternaInstructor = type === "externa_instructor";
  const hasActa  = !!acta_drive_url;
  const inFirma  = ["pending", "in_progress"].includes(signature_workflow_status);
  const firmada  = signature_workflow_status === "completed";

  const act = async (key, fn) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try { await fn(); await onRefresh(); }
    catch (err) { console.error(err); }
    finally { setBusy((b) => ({ ...b, [key]: false })); }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await actions.uploadExternalActa(training.id, file);
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const sigTotal  = training.signature_total_signers  || 0;
  const sigSigned = training.signature_signed_count   || 0;

  return (
    <PanelSection title="📄 Registro de la capacitación">
      <div className="space-y-4">
        {/* Paso 1 — Generar acta */}
        <Step
          num={1}
          label="Generar el registro oficial"
          done={hasActa}
          info={hasActa ? "El registro está listo en Google Drive" : "Se crea automáticamente con los datos de la capacitación"}
        >
          <div className="flex flex-wrap gap-2">
            <ActionBtn
              icon={hasActa ? FiCheck : FiDownload}
              label={hasActa ? "Volver a generar" : "Generar registro"}
              loading={busy.gen}
              variant={hasActa ? "secondary" : "primary"}
              onClick={() => act("gen", () => actions.generateActa(training.id))}
            />
            {hasActa && (
              <ActionBtn
                icon={FiExternalLink}
                label="Ver documento"
                variant="outline"
                onClick={() => window.open(acta_drive_url, "_blank")}
              />
            )}
          </div>
        </Step>

        {/* Paso 2 — Subir acta firmada (solo externa_instructor) */}
        {isExternaInstructor && (
          <Step
            num={2}
            label="El instructor externo firma en papel"
            done={!!training.external_signed_acta_url}
            info="Descarga el documento, el instructor lo firma físicamente y luego súbelo aquí"
          >
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <ActionBtn
                icon={FiUpload}
                label={uploading ? "Subiendo…" : (training.external_signed_acta_url ? "Reemplazar documento" : "Subir documento firmado")}
                loading={uploading}
                variant={training.external_signed_acta_url ? "secondary" : "primary"}
                onClick={() => fileRef.current?.click()}
              />
              {training.external_signed_acta_url && (
                <ActionBtn
                  icon={FiExternalLink}
                  label="Ver documento firmado"
                  variant="outline"
                  onClick={() => window.open(training.external_signed_acta_url, "_blank")}
                />
              )}
            </div>
          </Step>
        )}

        {/* Paso (2 o 3) — Enviar a firma digital */}
        <Step
          num={isExternaInstructor ? 3 : 2}
          label="Los asistentes firman digitalmente"
          done={inFirma || firmada}
          info={
            firmada ? "Todos los participantes ya firmaron el registro"
            : inFirma ? "El registro fue enviado y está esperando las firmas"
            : isExternaInstructor
              ? "Primero sube el documento firmado por el instructor"
              : "Se enviará un enlace a cada participante para que firme desde su dispositivo"
          }
        >
          {!firmada && (
            <ActionBtn
              icon={FiSend}
              label={inFirma ? "Reenviar solicitud de firma" : "Solicitar firmas"}
              loading={busy.famsign}
              variant={inFirma ? "secondary" : "success"}
              disabled={!hasActa || (isExternaInstructor && !training.external_signed_acta_url)}
              onClick={() => act("famsign", () => actions.sendActaToFamSign(training.id))}
            />
          )}
          {firmada && (
            <span className="inline-flex items-center gap-2 text-green-700 text-sm font-medium">
              <FiCheckCircle size={16} /> Registro completado
            </span>
          )}
        </Step>

        {/* Progreso de firmas */}
        {sigTotal > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <TrainingSignatureProgress
              total={sigTotal}
              signed={sigSigned}
              label="personas han firmado"
            />
          </div>
        )}
      </div>
    </PanelSection>
  );
}

// ── Acta de Inasistentes ──────────────────────────────────────────────────────

export function TrainingAbsentActaPanel({ training, actions, onRefresh }) {
  const [busy, setBusy] = useState({});

  const { absent_acta_drive_url, absent_workflow_status } = training;
  const hasActa  = !!absent_acta_drive_url;
  const inFirma  = ["pending", "in_progress"].includes(absent_workflow_status);
  const firmada  = absent_workflow_status === "completed";

  const absentAttendees = (training.attendees || []).filter((a) => a.attendance_status === "absent");
  if (absentAttendees.length === 0) return null;

  const act = async (key, fn) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try { await fn(); await onRefresh(); }
    catch (err) { console.error(err); }
    finally { setBusy((b) => ({ ...b, [key]: false })); }
  };

  const sigTotal  = training.absent_total_signers  || 0;
  const sigSigned = training.absent_signed_count   || 0;

  return (
    <PanelSection title="📋 Personas que no asistieron">
      <p className="text-xs text-slate-500 mb-4">
        {absentAttendees.length} persona{absentAttendees.length !== 1 ? "s" : ""} {absentAttendees.length !== 1 ? "estuvieron" : "estuvo"} ausente{absentAttendees.length !== 1 ? "s" : ""}.
        Se genera un registro separado que ellas también deben firmar.
      </p>
      <div className="space-y-4">
        <Step
          num={1}
          label="Generar el registro de ausencias"
          done={hasActa}
          info={hasActa ? "El documento está listo" : "Se genera un documento separado para quienes no asistieron"}
        >
          <div className="flex flex-wrap gap-2">
            <ActionBtn
              icon={hasActa ? FiCheck : FiDownload}
              label={hasActa ? "Volver a generar" : "Generar registro"}
              loading={busy.gen}
              variant={hasActa ? "secondary" : "primary"}
              onClick={() => act("gen", () => actions.generateAbsentActa(training.id))}
            />
            {hasActa && (
              <ActionBtn
                icon={FiExternalLink}
                label="Ver documento"
                variant="outline"
                onClick={() => window.open(absent_acta_drive_url, "_blank")}
              />
            )}
          </div>
        </Step>

        <Step
          num={2}
          label="Los ausentes firman digitalmente"
          done={inFirma || firmada}
          info={
            firmada ? "Todos los ausentes ya firmaron"
            : inFirma ? "Se enviaron las solicitudes de firma"
            : "Se enviará un enlace de firma a cada persona que no asistió"
          }
        >
          {!firmada && (
            <ActionBtn
              icon={FiSend}
              label={inFirma ? "Reenviar solicitud" : "Solicitar firmas"}
              loading={busy.famsign}
              variant={inFirma ? "secondary" : "success"}
              disabled={!hasActa}
              onClick={() => act("famsign", () => actions.sendAbsentToFamSign(training.id))}
            />
          )}
          {firmada && (
            <span className="inline-flex items-center gap-2 text-green-700 text-sm font-medium">
              <FiCheckCircle size={16} /> Registro completo
            </span>
          )}
        </Step>

        {sigTotal > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <TrainingSignatureProgress
              total={sigTotal}
              signed={sigSigned}
              label="ausentes han firmado"
            />
          </div>
        )}
      </div>
    </PanelSection>
  );
}

// ── Helper Step ───────────────────────────────────────────────────────────────

function Step({ num, label, done, info, children }) {
  return (
    <div className="flex gap-3">
      <div className={`flex-none w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5
        ${done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
        {done ? <FiCheck size={13} /> : num}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold mb-0.5 ${done ? "text-green-700" : "text-slate-800"}`}>{label}</p>
        {info && <p className="text-xs text-slate-400 mb-2">{info}</p>}
        {children}
      </div>
    </div>
  );
}
