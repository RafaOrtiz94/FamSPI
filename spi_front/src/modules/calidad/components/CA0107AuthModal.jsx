import React, { useState } from "react";

const CA0107AuthModal = ({ isOpen, onClose, onAuthenticated, actionLabel }) => {
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
      if (token.trim().length < 4) throw new Error("Token 2FA insuficiente.");
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
      <div className="relative w-[420px] rounded-2xl border border-red-500/20 bg-slate-950 p-8 shadow-[0_0_50px_rgba(239,68,68,0.15)]">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-white">×</button>
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-red-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Verificación de Seguridad</h2>
          <p className="mt-1 text-center text-sm text-slate-400">Confirma tu identidad para {actionLabel || "cerrar la queja"}</p>
        </div>
        <form onSubmit={handleVerify}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-slate-300">Token 2FA / Clave</label>
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="Ingresa tu token de 2FA..." autoFocus />
          </div>
          {errorDesc && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{errorDesc}</div>}
          <button type="submit" disabled={loading || token.trim().length < 4}
            className="w-full rounded-lg bg-red-600 py-3 font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Verificando..." : "Confirmar y Firmar"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">Auditoría GXP trazable.</p>
      </div>
    </div>
  );
};

export default CA0107AuthModal;