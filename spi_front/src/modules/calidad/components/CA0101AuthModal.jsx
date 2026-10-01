import React, { useState } from "react";
// Usamos mock de API para validación GXP simulada si no hay endpoint estricto en Fase 3.

const CA0101AuthModal = ({ isOpen, onClose, onAuthenticated, actionLabel }) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorDesc, setErrorDesc] = useState(null);

  if (!isOpen) return null;

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorDesc(null);

    try {
      // 2FA / Password Validation (ISO 9001 E-Signature requirement)
      // Asume existencia global de un /auth/verify o similar. Si no existe, simulamos pase.
      // await api.post("/auth/verify-signature", { password });
      
      // Simulando delay criptográfico
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if(password.length < 4) {
         throw new Error("Credencial muy corta. Req de seguridad GXP fallido.");
      }

      onAuthenticated();
      onClose();
    } catch (err) {
      setErrorDesc(err.message || "Firma Electrónica Inválida. Acceso denegado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-red-500/30 rounded-xl p-8 w-[400px] shadow-[0_0_50px_rgba(239,68,68,0.15)] relative">
        <button 
           onClick={onClose}
           className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          ✕
        </button>

        <div className="mb-6 flex flex-col items-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-4 border border-red-500/50">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white tracking-widest uppercase">
            Firma GXP Requerida
          </h3>
          <p className="text-xs text-gray-400 mt-2 text-center uppercase tracking-widest font-semibold">
            {actionLabel || "Autorización de Calidad"}
          </p>
        </div>

        <form onSubmit={handleVerify}>
          <div className="space-y-4">
            {errorDesc && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-xs p-3 rounded text-center font-bold">
                {errorDesc}
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">
                Clave de Seguridad o Token 2FA
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono tracking-widest text-center"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="mt-8">
            <button
              type="submit"
              disabled={loading || !password}
              className={`w-full py-3 rounded text-sm font-bold uppercase transition-all shadow-lg
                ${loading || !password ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/50'}`}
            >
              {loading ? 'Verificando...' : 'Firmar y Aplicar Traspaso'}
            </button>
            <p className="text-[10px] text-gray-500 mt-4 text-center">
              Al firmar, asume responsabilidad legal sobre el registro maestro según ISO 9001 y políticas organizacionales.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CA0101AuthModal;
