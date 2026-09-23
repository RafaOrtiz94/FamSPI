import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiHash,
  FiLock,
  FiMail,
  FiMessageSquare,
  FiPhone,
  FiRefreshCw,
  FiSend,
  FiThumbsUp,
  FiUser,
} from "react-icons/fi";
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
const FIELD_CLASS = "w-full min-h-11 rounded-xl border border-[#D1D5DB] bg-white px-3.5 py-2.5 text-sm text-[#1F2937] outline-none transition-all duration-150 placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10";
const ICON_FIELD_CLASS = `${FIELD_CLASS} pl-10`;
const TYPE_LABELS = { suggestion: "Sugerencia", complaint: "Queja" };
const TYPE_ICON = { suggestion: FiThumbsUp, complaint: FiAlertCircle };

const STEPS = [
  { icon: FiSend, title: "Envías el mensaje", text: "Recibes al instante una referencia única para seguimiento." },
  { icon: FiUser, title: "Confirmamos contacto", text: "Tu nombre y correo permiten aclarar detalles si hace falta." },
  { icon: FiCheckCircle, title: "Se resuelve el caso", text: "El equipo responsable da seguimiento hasta cerrarlo con evidencia." },
];

const Field = ({ label, icon: Icon, children }) => (
  <label className="block text-sm font-medium text-[#1F2937]">
    <span className="mb-1.5 block">{label}</span>
    <span className="relative block">
      {Icon && <Icon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />}
      {children}
    </span>
  </label>
);

export default function SuggestionBoxPublicPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const prefersReducedMotion = useReducedMotion();
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const nearLimit = form.message.length > 4500;

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
    <main
      className="min-h-screen bg-[#F9FAFB] px-4 py-6 text-[#1F2937] sm:px-6 lg:px-8"
      style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #E2E8F0 1px, transparent 0)", backgroundSize: "22px 22px" }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <motion.header
          {...motionProps}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] px-5 py-6 text-white shadow-[0_15px_35px_rgba(15,23,42,0.14)] sm:px-7"
        >
          <div className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-[#0EA5E9]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-[#2563EB]/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <img src={famLogo} alt="FamProject" className="h-8 w-auto" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#7DD3FC]">Canal público de mejora</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">Buzón de sugerencias</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#CBD5E1]">
                Registra una situación, queja o propuesta de mejora. El seguimiento requiere datos de contacto.
              </p>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-[#CBD5E1] backdrop-blur-sm">
              <motion.span
                animate={prefersReducedMotion ? {} : { opacity: [1, 0.5, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0EA5E9]/20 text-[#7DD3FC]"
              >
                <FiLock size={10} />
              </motion.span>
              Envío identificado
            </div>
          </div>
        </motion.header>

        <AnimatePresence mode="wait">
          {reference ? (
            <motion.section
              key="success"
              className="relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-10"
              {...motionProps}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#0EA5E9] via-[#2563EB] to-[#0EA5E9]" />
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                {!prefersReducedMotion && (
                  <>
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0.5 }}
                      animate={{ scale: 1.7, opacity: 0 }}
                      transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.1 }}
                      className="absolute inset-0 rounded-full bg-[#DCFCE7]"
                    />
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0.5 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.3 }}
                      className="absolute inset-0 rounded-full bg-[#DCFCE7]"
                    />
                  </>
                )}
                <motion.div
                  initial={prefersReducedMotion ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.05 }}
                  className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]"
                >
                  <FiCheckCircle size={26} />
                </motion.div>
              </div>
              <h2 className="mt-5 text-xl font-semibold text-[#1F2937]">Mensaje registrado</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#6B7280]">
                Conserva esta referencia para dar seguimiento:
              </p>
              <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5">
                <FiHash className="text-[#9CA3AF]" size={15} />
                <span className="font-mono text-base font-semibold tracking-wide text-[#1F2937]">{reference}</span>
              </div>
              <button
                type="button"
                onClick={() => setReference("")}
                className="mt-7 min-h-11 cursor-pointer rounded-2xl bg-[#2563EB] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition-all duration-150 hover:bg-[#1D4ED8] hover:shadow-[0_10px_24px_rgba(37,99,235,0.32)] active:scale-[0.97]"
              >
                Enviar otro mensaje
              </button>
            </motion.section>
          ) : (
            <motion.section
              key="form"
              className="grid items-start gap-5 lg:grid-cols-[0.82fr_1.18fr]"
              {...motionProps}
            >
              <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#1D4ED8]">
                  <FiMessageSquare size={20} />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-[#1F2937]">Cómo se atiende</h2>

                <ol className="mt-5 space-y-5">
                  {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isLast = index === STEPS.length - 1;
                    return (
                      <li key={step.title} className="relative flex gap-3.5 pl-0.5">
                        {!isLast && <span className="absolute left-[15px] top-8 h-[calc(100%-4px)] w-px bg-[#E5E7EB]" aria-hidden="true" />}
                        <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#1D4ED8] ring-4 ring-white">
                          <Icon size={14} />
                        </span>
                        <div className="pt-0.5">
                          <p className="text-sm font-semibold text-[#1F2937]">{step.title}</p>
                          <p className="mt-0.5 text-xs leading-5 text-[#6B7280]">{step.text}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-6 rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Ejemplo de referencia</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[#6B7280]">BQ-20260923-A1B2C3</p>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#FEF3C7]/60 p-3 text-xs leading-5 text-[#92400E]">
                  <FiLock className="mt-0.5 shrink-0" size={13} />
                  No se aceptan envíos anónimos en este canal.
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

                <div className="mt-5">
                  <label className="text-sm font-medium text-[#1F2937]">
                    Tipo de mensaje
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      {Object.entries(TYPE_LABELS).map(([value, label]) => {
                        const Icon = TYPE_ICON[value];
                        const active = form.submission_type === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => update("submission_type", value)}
                            className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] ${
                              active
                                ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                                : "border-[#D1D5DB] bg-white text-[#6B7280] hover:border-[#9CA3AF]"
                            }`}
                          >
                            <Icon size={14} />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </label>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field label="Asunto">
                    <input required value={form.subject} onChange={(event) => update("subject", event.target.value)} className={FIELD_CLASS} maxLength={160} placeholder="Resume el tema" />
                  </Field>
                  <Field label="Nombre" icon={FiUser}>
                    <input required value={form.reporter_name} onChange={(event) => update("reporter_name", event.target.value)} className={ICON_FIELD_CLASS} maxLength={160} placeholder="Tu nombre" />
                  </Field>
                  <Field label="Correo" icon={FiMail}>
                    <input required type="email" value={form.reporter_email} onChange={(event) => update("reporter_email", event.target.value)} className={ICON_FIELD_CLASS} maxLength={254} placeholder="correo@ejemplo.com" />
                  </Field>
                  <Field label="Teléfono (opcional)" icon={FiPhone}>
                    <input value={form.reporter_phone} onChange={(event) => update("reporter_phone", event.target.value)} className={ICON_FIELD_CLASS} maxLength={50} placeholder="09xxxxxxxx" />
                  </Field>
                </div>

                <div className="mt-5">
                  <Field label="Mensaje">
                    <textarea required value={form.message} onChange={(event) => update("message", event.target.value)} className={`${FIELD_CLASS} min-h-36 resize-y`} maxLength={5000} placeholder="Describe la situación con el detalle que consideres necesario" />
                  </Field>
                  <span className={`mt-1 block text-right text-xs transition-colors ${nearLimit ? "font-semibold text-[#D97706]" : "text-[#9CA3AF]"}`}>{form.message.length}/5000</span>
                </div>

                <input tabIndex="-1" autoComplete="off" aria-hidden="true" value={form.website} onChange={(event) => update("website", event.target.value)} className="hidden" name="website" />

                <div className="mt-6 flex justify-end">
                  <button
                    disabled={sending}
                    type="submit"
                    className="min-h-11 cursor-pointer rounded-2xl bg-[#2563EB] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition-all duration-150 hover:bg-[#1D4ED8] hover:shadow-[0_10px_24px_rgba(37,99,235,0.32)] disabled:cursor-wait disabled:opacity-60 active:scale-[0.97]"
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
