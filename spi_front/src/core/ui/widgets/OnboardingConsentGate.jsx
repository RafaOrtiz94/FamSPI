import React, { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import {
  FiShield,
  FiPenTool,
  FiCheck,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import FirmaDigital from "../../../modules/servicio/components/FirmaDigital";
import { submitInternalLopdpConsent } from "../../api/authApi";
import { useAuth } from "../../auth/AuthContext";
import { useUI } from "../UIContext";
import {
  lopdpNoticeParagraphs,
  lopdpNoticeTitle,
  lopdpNoticeSubtitle,
} from "../legal/lopdpNoticeContent";

// ── Texto de consentimiento FamSign ──────────────────────────────────────────

const FAMSIGN_TITLE = "Sistema de firma digital FamSign";
const FAMSIGN_TEXT =
  "FamSign es el sistema oficial de firma digital de FamSPI. Al aceptar, autorizas que tus flujos de aprobación y documentos internos puedan requerir tu firma digital a través de FamSign, conforme a los procedimientos establecidos por la empresa y en cumplimiento de la Ley de Comercio Electrónico del Ecuador. Tu firma quedará vinculada a tu identidad verificada dentro del sistema.";

// ── PDF builder ───────────────────────────────────────────────────────────────

function buildPdf({ signatureBase64, notes, userName, userEmail }) {
  const doc = new jsPDF();
  const margin = 14;
  const maxWidth = 182;
  let y = 18;

  // LOPDP
  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text(lopdpNoticeTitle, margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(lopdpNoticeSubtitle, margin, y);
  y += 10;
  doc.setFontSize(11);
  lopdpNoticeParagraphs.forEach((p) => {
    const lines = doc.splitTextToSize(p, maxWidth);
    doc.text(lines, margin, y);
    y += lines.length * 6 + 3;
  });

  y += 5;

  // FamSign
  doc.setFontSize(13);
  doc.setFont(undefined, "bold");
  doc.text(FAMSIGN_TITLE, margin, y);
  y += 7;
  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  const famLines = doc.splitTextToSize(FAMSIGN_TEXT, maxWidth);
  doc.text(famLines, margin, y);
  y += famLines.length * 6 + 8;

  // Datos del colaborador
  doc.setFont(undefined, "bold");
  doc.text("Colaborador:", margin, y);
  doc.setFont(undefined, "normal");
  doc.text(` ${userName} (${userEmail})`, margin + 28, y);
  y += 7;
  doc.text(`Fecha de firma: ${new Date().toLocaleString("es-EC")}`, margin, y);
  y += 7;
  doc.text("Aceptó LOPDP: Sí", margin, y);
  y += 7;
  doc.text("Aceptó FamSign: Sí", margin, y);
  y += 10;

  if (notes?.trim()) {
    const noteLines = doc.splitTextToSize(`Notas: ${notes.trim()}`, maxWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 6 + 8;
  }

  // Firma
  if (signatureBase64) {
    if (y > 240) doc.addPage();
    doc.text("Firma digital:", margin, y);
    y += 5;
    const dataUrl = `data:image/png;base64,${signatureBase64}`;
    doc.addImage(dataUrl, "PNG", margin, y, 70, 35, undefined, "FAST");
  }

  return doc.output("datauristring").split(",")[1];
}

// ── Sub-modal de firma ────────────────────────────────────────────────────────

function SignatureModal({ sigRef, onConfirm, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F172A]/65 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl border border-[#E5E7EB] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)] sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle mobile */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <div className="h-1 w-9 rounded-full bg-[#E5E7EB]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Firma digital</p>
            <p className="text-sm font-semibold text-[#1F2937]">Dibuja tu firma</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] transition hover:bg-[#F3F4F6] cursor-pointer"
          >
            <FiX size={14} />
          </button>
        </div>

        {/* Canvas */}
        <div className="p-5">
          <div
            className="relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-white"
            style={{ height: 240 }}
          >
            <FirmaDigital ref={sigRef} height={240} strokeWidth={2.5} />
            {/* Línea guía */}
            <div
              className="pointer-events-none absolute left-4 right-4"
              style={{ bottom: "28%", borderBottom: "1.5px dashed #D1D5DB" }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-[#9CA3AF]">
            Usa el dedo o el mouse para dibujar tu firma
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => sigRef.current?.clear?.()}
              className="flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#6B7280] transition hover:bg-[#F9FAFB] active:scale-[0.97] cursor-pointer"
            >
              <FiTrash2 size={13} />
              Limpiar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-[0.97] cursor-pointer"
            >
              <FiCheck size={13} />
              Confirmar firma
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

const OnboardingConsentGate = ({ forceOpen = false }) => {
  const { user, reloadProfile } = useAuth();
  const { showToast } = useUI();
  const sigRef = useRef(null);

  const [acceptLopdp, setAcceptLopdp] = useState(false);
  const [acceptFamSign, setAcceptFamSign] = useState(false);
  const [notes, setNotes] = useState("");
  const [signatureBase64, setSignatureBase64] = useState(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [showLegal, setShowLegal] = useState(false);
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);

  const normalizedStatus = useMemo(
    () => (user?.lopdp_internal_status || "").toLowerCase(),
    [user?.lopdp_internal_status],
  );

  useEffect(() => {
    setVisible(forceOpen || normalizedStatus !== "granted");
  }, [forceOpen, normalizedStatus]);

  // Bloquear scroll del body mientras el gate está visible
  useEffect(() => {
    if (!visible) return undefined;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    const scrollY = window.scrollY || 0;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [visible]);

  if (!visible) return null;

  const canSubmit = acceptLopdp && acceptFamSign && Boolean(signatureBase64);

  // --- handlers de firma ---

  const handleConfirmSignature = () => {
    const base64 = sigRef.current?.getBase64?.();
    if (!base64 || base64.length < 20) {
      showToast("Dibuja tu firma antes de confirmar.", "warning");
      return;
    }
    setSignatureBase64(base64);
    setSignatureDataUrl(`data:image/png;base64,${base64}`);
    setSigModalOpen(false);
  };

  const handleClearSignature = () => {
    setSignatureBase64(null);
    setSignatureDataUrl(null);
  };

  // --- submit ---

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const pdfBase64 = buildPdf({
        signatureBase64,
        notes,
        userName: user?.fullname || "",
        userEmail: user?.email || "",
      });
      await submitInternalLopdpConsent({
        signatureBase64,
        pdfBase64,
        notes: notes?.trim() || undefined,
      });
      await reloadProfile();
      setVisible(false);
      showToast("Consentimiento y firma registrados correctamente.", "success");
    } catch (err) {
      console.error(err);
      showToast("No se pudo registrar el consentimiento. Intenta de nuevo.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Overlay principal */}
      <div className="fixed inset-0 z-[40] flex items-end justify-center bg-[#0F172A]/72 sm:items-center sm:p-4">
        <div className="relative flex w-full flex-col overflow-hidden rounded-t-2xl border border-[#E5E7EB] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.20),_0_4px_16px_rgba(15,23,42,0.08)] sm:rounded-2xl sm:max-w-4xl" style={{ maxHeight: "calc(96dvh - env(safe-area-inset-bottom, 0px))" }}>

          {/* Drag handle mobile */}
          <div className="flex shrink-0 justify-center pt-2.5 sm:hidden" aria-hidden="true">
            <div className="h-1 w-9 rounded-full bg-[#E5E7EB]" />
          </div>

          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-[#E5E7EB] px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF]">
              <FiShield size={18} className="text-[#2563EB]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">Bienvenido a FamSPI</p>
              <h2 className="text-base font-bold leading-tight text-[#1F2937] sm:text-lg">
                Consentimiento y firma digital
              </h2>
            </div>
            <div className="hidden flex-col items-end text-right sm:flex">
              <p className="text-xs font-semibold text-[#1F2937]">{user?.fullname}</p>
              <p className="text-xs text-[#6B7280]">{user?.email}</p>
            </div>
          </div>

          {/* Body — acción arriba en mobile, columnas en desktop */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">

            {/* Panel de acción — top en mobile (order-first), derecha en desktop */}
            <div className="order-first shrink-0 px-5 py-5 lg:order-2 lg:w-72 lg:overflow-y-auto lg:border-l lg:border-[#E5E7EB] xl:w-80">
              <div className="flex flex-col gap-4">

                {/* Info del colaborador (solo mobile) */}
                <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 sm:hidden">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#1F2937]">{user?.fullname}</p>
                    <p className="truncate text-xs text-[#6B7280]">{user?.email}</p>
                  </div>
                </div>

                {/* Zona de firma */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">
                    Tu firma digital
                  </p>
                  {signatureDataUrl ? (
                    <div className="relative overflow-hidden rounded-xl border border-[#D1D5DB] bg-white">
                      <img
                        src={signatureDataUrl}
                        alt="Firma capturada"
                        className="h-20 w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={handleClearSignature}
                        title="Borrar y repetir"
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] shadow-sm transition hover:text-[#DC2626] cursor-pointer"
                      >
                        <FiTrash2 size={11} />
                      </button>
                      <div className="flex items-center gap-1 px-3 py-1.5">
                        <FiCheck size={10} className="text-[#16A34A]" />
                        <span className="text-[10px] font-semibold text-[#16A34A]">Firma registrada</span>
                        <button
                          type="button"
                          onClick={() => setSigModalOpen(true)}
                          className="ml-auto text-[10px] text-[#2563EB] underline cursor-pointer"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSigModalOpen(true)}
                      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D1D5DB] bg-[#F9FAFB] py-5 transition hover:border-[#2563EB] hover:bg-[#EFF6FF] active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white">
                        <FiPenTool size={16} className="text-[#6B7280]" />
                      </div>
                      <p className="text-sm font-semibold text-[#1F2937]">Registrar mi firma</p>
                      <p className="text-xs text-[#6B7280]">Toca para dibujar tu firma</p>
                    </button>
                  )}
                </div>

                {/* Notas */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">
                    Notas (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Alguna observación sobre este consentimiento..."
                    className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptLopdp}
                      onChange={(e) => setAcceptLopdp(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D1D5DB] accent-[#2563EB]"
                    />
                    <span className="text-sm leading-snug text-[#374151]">
                      Acepto el aviso de confidencialidad y el tratamiento de datos conforme a la{" "}
                      <span className="font-semibold">LOPDP del Ecuador</span>.
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptFamSign}
                      onChange={(e) => setAcceptFamSign(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D1D5DB] accent-[#2563EB]"
                    />
                    <span className="text-sm leading-snug text-[#374151]">
                      Acepto el uso de <span className="font-semibold">FamSign</span> como mi sistema
                      de firma digital oficial en FamSPI.
                    </span>
                  </label>
                </div>

                {/* CTA */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <FiRefreshCw size={14} className="animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <FiCheck size={14} />
                      Firmar y continuar
                    </>
                  )}
                </button>

                {!canSubmit && !submitting && (
                  <p className="text-center text-xs text-[#9CA3AF]">
                    {!signatureBase64
                      ? "Primero registra tu firma digital."
                      : "Acepta ambos documentos para continuar."}
                  </p>
                )}
              </div>
            </div>

            {/* Panel legal — bottom en mobile (collapsible), izquierda en desktop */}
            <div className="min-h-0 border-t border-[#E5E7EB] lg:order-1 lg:flex-1 lg:overflow-y-auto lg:border-r lg:border-t-0 lg:border-[#E5E7EB]">
              {/* Toggle solo en mobile */}
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold text-[#1F2937] transition hover:bg-[#F9FAFB] lg:hidden cursor-pointer"
                onClick={() => setShowLegal((v) => !v)}
              >
                <span>Ver documentos a aceptar</span>
                {showLegal ? (
                  <FiChevronUp size={15} className="text-[#6B7280]" />
                ) : (
                  <FiChevronDown size={15} className="text-[#6B7280]" />
                )}
              </button>

              <div className={`px-5 pb-6 ${showLegal ? "block" : "hidden"} lg:block lg:pt-5`}>
                {/* Sección LOPDP */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">LOPDP Ecuador</p>
                  <p className="mt-1 text-sm font-semibold text-[#1F2937]">{lopdpNoticeTitle}</p>
                  <p className="mt-0.5 text-xs text-[#6B7280]">{lopdpNoticeSubtitle}</p>
                  <div className="mt-3 space-y-3">
                    {lopdpNoticeParagraphs.map((p, i) => (
                      <div key={i} className="flex gap-2.5">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7]">
                          <span className="text-[9px] font-bold text-[#D97706]">{i + 1}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-[#374151]">{p}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sección FamSign */}
                <div className="mt-6 border-t border-[#E5E7EB] pt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">FamSign</p>
                  <p className="mt-1 text-sm font-semibold text-[#1F2937]">{FAMSIGN_TITLE}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#374151]">{FAMSIGN_TEXT}</p>
                </div>

                {/* Nota legal final */}
                <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
                  <p className="text-xs leading-relaxed text-[#6B7280]">
                    Al firmar confirmas que leíste, comprendiste y aceptas voluntariamente estos documentos. Esta acción queda registrada con tu nombre, correo, IP y fecha en los registros de FamSPI.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modal de firma */}
      {sigModalOpen && (
        <SignatureModal
          sigRef={sigRef}
          onConfirm={handleConfirmSignature}
          onClose={() => setSigModalOpen(false)}
        />
      )}
    </>
  );
};

export default OnboardingConsentGate;
