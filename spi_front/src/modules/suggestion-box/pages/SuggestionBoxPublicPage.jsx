import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FiAlertCircle, FiCheckCircle, FiLock, FiMessageSquare, FiRefreshCw, FiSend } from "react-icons/fi";
import famLogo from "../../../assets/famproject_logo.png";
import { createPublicSuggestionBoxSubmission } from "../api/suggestionBoxPublicApi";

const EMPTY_FORM = {
  submission_type: "suggestion",
  is_anonymous: false,
  reporter_name: "",
  reporter_email: "",
  reporter_phone: "",
  subject: "",
  message: "",
  website: "",
};

const EASE_OUT = [0.23, 1, 0.32, 1];
const FIELD_CLASS = "w-full min-h-11 rounded-xl border border-[#D1D5DB] bg-white px-3.5 py-2.5 text-sm text-[#1F2937] outline-none transition-colors duration-150 placeholder:text-[#6B7280]/70 focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20";

const Field = ({ label, children }) => (
  <label className="block text-sm font-medium text-[#1F2937]">
    <span className="mb-1.5 block">{label}</span>
    {children}
  </label>
);

export default function SuggestionBoxPublicPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const prefersReducedMotion = useReducedMotion();
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSending(true);
    try {
      const result = await createPublicSuggestionBoxSubmission({ ...form, is_anonymous: false });
      setReference(result?.data?.reference_code || "");
      setForm(EMPTY_FORM);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.response?.data?.error || "No se pudo enviar el mensaje. Revisa los campos e intenta nuevamente.");
    } finally {
      setSending(false);
    }
  };

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, transform: "translateY(10px)" },
        animate: { opacity: 1, transform: "translateY(0px)" },
        transition: { duration: 0.28, ease: EASE_OUT },
      };

  return (
    <main className="min-h-screen bg-[#F9FAFB] px-4 py-6 text-[#1F2937] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="rounded-2xl bg-[#1E293B] px-5 py-5 text-white shadow-[0_15px_35px_rgba(15,23,42,0.08)] sm:px-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <img src={famLogo} alt="FamProject" className="h-8 w-auto" />
              <p className="mt-5 text-xs font-medium text-[#D1D5DB]">Canal publico de mejora</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">Buzon de sugerencias y quejas</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#D1D5DB]">
                Registra una situacion, queja o propuesta de mejora. El seguimiento requiere datos de contacto.
              </p>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs text-[#D1D5DB]">
              <FiLock size={14} />
              Envio identificado
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {reference ? (
            <motion.section
              key="success"
              className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-8"
              {...motionProps}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
                <FiCheckCircle size={26} />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-[#1F2937]">Mensaje registrado</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#6B7280]">
                Tu referencia es <span className="font-mono font-semibold text-[#1F2937]">{reference}</span>. Conservala para seguimiento.
              </p>
              <button
                type="button"
                onClick={() => setReference("")}
                className="mt-6 min-h-11 cursor-pointer rounded-2xl bg-[#2563EB] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#1D4ED8] active:scale-[0.97]"
              >
                Enviar otro mensaje
              </button>
            </motion.section>
          ) : (
            <motion.section
              key="form"
              className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]"
              {...motionProps}
            >
              <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#1D4ED8]">
                  <FiMessageSquare size={20} />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-[#1F2937]">Como se atiende</h2>
                <div className="mt-4 space-y-4 text-sm leading-6 text-[#6B7280]">
                  <p>El equipo responsable recibe el registro con una referencia unica.</p>
                  <p>Los datos de contacto permiten aclarar informacion y cerrar el caso con evidencia.</p>
                  <p>No se aceptan envios anonimos en este canal.</p>
                </div>
              </aside>

              <form onSubmit={submit} className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#6B7280]">Formulario</p>
                    <h2 className="text-lg font-semibold text-[#1F2937]">Detalle del mensaje</h2>
                  </div>
                  <span className="w-fit rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-[#1F2937]">
                    Max. 5000 caracteres
                  </span>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      role="alert"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: EASE_OUT }}
                      className="mt-4 flex items-start gap-2 overflow-hidden rounded-xl border border-[#FEE2E2] bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]"
                    >
                      <FiAlertCircle className="mt-0.5 shrink-0" size={16} />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field label="Tipo de mensaje">
                    <select value={form.submission_type} onChange={(event) => update("submission_type", event.target.value)} className={FIELD_CLASS}>
                      <option value="suggestion">Sugerencia</option>
                      <option value="complaint">Queja</option>
                    </select>
                  </Field>
                  <Field label="Asunto">
                    <input required value={form.subject} onChange={(event) => update("subject", event.target.value)} className={FIELD_CLASS} maxLength={160} />
                  </Field>
                  <Field label="Nombre">
                    <input required value={form.reporter_name} onChange={(event) => update("reporter_name", event.target.value)} className={FIELD_CLASS} maxLength={160} />
                  </Field>
                  <Field label="Correo">
                    <input required type="email" value={form.reporter_email} onChange={(event) => update("reporter_email", event.target.value)} className={FIELD_CLASS} maxLength={254} />
                  </Field>
                  <Field label="Telefono (opcional)">
                    <input value={form.reporter_phone} onChange={(event) => update("reporter_phone", event.target.value)} className={FIELD_CLASS} maxLength={50} />
                  </Field>
                </div>

                <div className="mt-5">
                  <Field label="Mensaje">
                    <textarea required value={form.message} onChange={(event) => update("message", event.target.value)} className={`${FIELD_CLASS} min-h-36 resize-y`} maxLength={5000} />
                    <span className="mt-1 block text-right text-xs text-[#6B7280]">{form.message.length}/5000</span>
                  </Field>
                </div>

                <input tabIndex="-1" autoComplete="off" aria-hidden="true" value={form.website} onChange={(event) => update("website", event.target.value)} className="hidden" name="website" />

                <div className="mt-6 flex justify-end">
                  <button
                    disabled={sending}
                    type="submit"
                    className="min-h-11 cursor-pointer rounded-2xl bg-[#2563EB] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#1D4ED8] disabled:cursor-wait disabled:opacity-60 active:scale-[0.97]"
                  >
                    <span className="inline-flex items-center gap-2">
                      {sending ? <FiRefreshCw className="animate-spin" /> : <FiSend />}
                      {sending ? "Enviando" : "Enviar mensaje"}
                    </span>
                  </button>
                </div>
              </form>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
