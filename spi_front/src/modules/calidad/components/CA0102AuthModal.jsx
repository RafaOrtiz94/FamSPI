import React, { useState } from "react";

const CA0102AuthModal = ({ isOpen, onClose, onAuthenticated, actionLabel }) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorDesc, setErrorDesc] = useState(null);

  if (!isOpen) return null;

  const handleVerify = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorDesc(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));

      if (password.trim().length < 4) {
        throw new Error("Credencial insuficiente para liberar el cierre GXP.");
      }

      onAuthenticated();
      onClose();
    } catch (error) {
      setErrorDesc(error.message || "Firma electronica invalida.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-[420px] rounded-2xl border border-cyan-500/20 bg-slate-950 p-8 shadow-[0_0_50px_rgba(34,211,238,0.15)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 transition hover:text-white"
        >
          ✕
        </button>

        <div className="mb-6 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-black uppercase tracking-[0.28em] text-white">
            Firma GXP Requerida
          </h3>
          <p className="mt-2 text-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {actionLabel || "Autorizacion de cierre"}
          </p>
        </div>

        <form onSubmit={handleVerify}>
          <div className="space-y-4">
            {errorDesc ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-center text-xs font-bold text-rose-200">
                {errorDesc}
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                Clave de seguridad o token 2FA
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-center font-mono tracking-[0.3em] text-white outline-none transition focus:border-cyan-400"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="mt-8">
            <button
              type="submit"
              disabled={loading || !password}
              className={`w-full rounded-xl py-3 text-sm font-black uppercase tracking-[0.24em] transition ${
                loading || !password
                  ? "cursor-not-allowed bg-slate-700 text-slate-500"
                  : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              }`}
            >
              {loading ? "Verificando..." : "Firmar y cerrar"}
            </button>
            <p className="mt-4 text-center text-[10px] text-slate-500">
              La firma valida el cierre y deja evidencia de responsabilidad operativa.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CA0102AuthModal;
