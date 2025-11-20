import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import { FiShield, FiAlertTriangle, FiCheckCircle, FiRefreshCcw } from "react-icons/fi";
import FirmaDigital from "../../servicio/components/FirmaDigital";
import { submitInternalLopdpConsent } from "../../../core/api/authApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";

const paragraphs = [
  "FamSPI protege los datos personales conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP).",
  "Como colaborador te comprometes a custodiar la información de clientes, proveedores, aliados y compañeros, evitando su uso no autorizado o divulgación.",
  "Solo podrás compartir datos con terceros cuando exista base legal, autorización formal o necesidad operativa validada por la empresa.",
  "Reporta incidentes de seguridad o fugas de información inmediatamente al área de TI/Talento Humano.",
  "La firma implica reconocer estas responsabilidades y acatar los procedimientos internos de protección de datos y confidencialidad.",
];

const InternalLopdpConsentModal = ({ forceOpen = false }) => {
  const { user, reloadProfile } = useAuth();
  const { showToast } = useUI();
  const signatureRef = useRef(null);
  const [accept, setAccept] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);

  const normalizedStatus = useMemo(
    () => (user?.lopdp_internal_status || "").toLowerCase(),
    [user?.lopdp_internal_status]
  );

  useEffect(() => {
    setVisible(forceOpen || normalizedStatus !== "granted");
  }, [forceOpen, normalizedStatus]);

  useEffect(() => {
    if (!visible) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (!visible) return null;

  const buildPdf = (signatureBase64) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Acuerdo de Confidencialidad y Protección de Datos", 14, 18);
    doc.setFontSize(11);
    doc.text("LOPDP - Ecuador / Uso interno FamSPI", 14, 26);

    let y = 38;
    paragraphs.forEach((p) => {
      const lines = doc.splitTextToSize(p, 180);
      doc.text(lines, 14, y);
      y += lines.length * 7 + 2;
    });

    y += 4;
    doc.text(`Colaborador: ${user?.fullname || ""} (${user?.email || ""})`, 14, y);
    y += 7;
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, y);

    if (signatureBase64) {
      const dataUrl = `data:image/png;base64,${signatureBase64}`;
      doc.text("Firma:", 14, y + 15);
      doc.addImage(dataUrl, "PNG", 40, y + 2, 60, 30, undefined, "FAST");
    }

    if (notes) {
      const noteLines = doc.splitTextToSize(`Notas: ${notes}`, 180);
      doc.text(noteLines, 14, y + 40);
    }

    return doc.output("datauristring").split(",")[1];
  };

  const handleSubmit = async () => {
    if (!accept) {
      showToast("Debes aceptar el compromiso de protección de datos.", "warning");
      return;
    }
    const signatureBase64 = signatureRef.current?.getBase64?.();
    if (!signatureBase64 || signatureBase64.length < 20) {
      showToast("Firma requerida.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const pdfBase64 = buildPdf(signatureBase64);
      await submitInternalLopdpConsent({
        signatureBase64,
        pdfBase64,
        notes: notes?.trim() || undefined,
      });
      await reloadProfile();
      setVisible(false);
      showToast("Consentimiento registrado correctamente.", "success");
    } catch (err) {
      console.error(err);
      showToast("No se pudo registrar el consentimiento.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-center gap-3 mb-4">
          <FiShield className="h-6 w-6 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-600">Protección de datos (LOPDP)</p>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Acuerdo interno de confidencialidad
            </h2>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            {paragraphs.map((p, idx) => (
              <div key={idx} className="flex gap-2">
                <FiAlertTriangle className="mt-1 h-4 w-4 text-amber-500" />
                <p>{p}</p>
              </div>
            ))}
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
              <p className="text-xs">
                Al firmar, autorizas a FamSPI a conservar esta evidencia en la carpeta «LOPDP INTERNO FAM» del Drive corporativo.
              </p>
            </div>
            <div className="space-y-2 text-xs">
              <p className="font-semibold">Colaborador:</p>
              <p>{user?.fullname}</p>
              <p className="text-slate-500">{user?.email}</p>
            </div>
            <textarea
              className="w-full rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              rows={4}
              placeholder="Notas u observaciones (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <label className="flex items-start gap-3 text-sm font-medium text-slate-800 dark:text-slate-100">
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                Acepto el aviso de confidencialidad y el tratamiento de datos conforme a la LOPDP del Ecuador.
              </span>
            </label>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100">
                <span>Firma requerida</span>
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700"
                  onClick={() => signatureRef.current?.clear?.()}
                >
                  <FiRefreshCcw className="h-4 w-4" /> Limpiar
                </button>
              </div>
              <FirmaDigital ref={signatureRef} height={200} strokeWidth={2.4} />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Guardando consentimiento..." : "Firmar y continuar"}
              {!submitting && <FiCheckCircle className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InternalLopdpConsentModal;
