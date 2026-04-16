import React, { useState } from "react";

const CA0105AuthModal = ({ isOpen, onClose, onAuthenticated, actionLabel }) => {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorDesc, setErrorDesc] = useState(null);

  if (!isOpen) return null;

  const handleVerify = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorDesc(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (token.trim().length < 4) {
        throw new Error("Token 2FA insuficiente para liberar el cierre final.");
      }

      onAuthenticated();
      onClose();
    } catch (error) {
      setErrorDesc(error.message || "Firma electrónica inválida.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-[420px] rounded-2xl border border-indigo-500/20 bg-slate-950 p-8 shadow-[0_0_50px_rgba(99,102,241,0.15)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 transition hover:text-white"
        >
          ×
        </button>

        <div className="mb-6 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/10 text-indigo-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">
            Verificación de Seguridad
          </h2>
          <p className="mt-1 text-center text-sm text-slate-400">
            Confirma tu identidad para {actionLabel || "aprobar el documento"}
          </p>
        </div>

        <form onSubmit={handleVerify}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Token 2FA / Clave de Seguridad
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Ingresa tu token de 2FA..."
              autoFocus
            />
          </div>

          {errorDesc && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {errorDesc}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || token.trim().length < 4}
            className="w-full rounded-lg bg-indigo-600 py-3 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Verificando...
              </span>
            ) : (
              "Confirmar y Firmar"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Este proceso deja auditoría trazable en la bitácora GXP.
        </p>
      </div>
    </div>
  );
};

export default CA0105AuthModal;