import React from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import { FiClock, FiMail, FiLogOut, FiCopy } from "react-icons/fi";

const ActivationPending = () => {
  const { user, logout } = useAuth();

  const supportEmail = "soporte-ti@fam-project.com";

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Email copiado al portapapeles");
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("¿Estás seguro de que quieres cerrar sesión?")) {
      await logout();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
          {/* Icono principal */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-6">
            <FiClock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Activación en marcha
          </h1>

          {/* Mensaje principal */}
          <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            Tu activación está en proceso. Solicita asignación de rol a{" "}
            <span className="font-medium text-blue-600 dark:text-blue-400">
              soporte-ti@fam-project.com
            </span>{" "}
            (administrador del sistema)
          </p>

          {/* Información del usuario */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              Usuario registrado
            </div>
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {user?.email || "usuario@famproject.com.ec"}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="space-y-3">
            {/* Copiar email de soporte */}
            <button
              onClick={() => copyToClipboard(supportEmail)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              <FiMail className="w-4 h-4" />
              Copiar email de soporte
              <FiCopy className="w-4 h-4" />
            </button>

            {/* Cerrar sesión */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              <FiLogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 text-xs text-slate-400 dark:text-slate-500">
            FamSPI - Sistema de Gestión Empresarial
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivationPending;