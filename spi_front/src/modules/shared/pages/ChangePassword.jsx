import React, { useState } from "react";
import { motion } from "framer-motion";
import { FiKey, FiLoader } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../core/auth/AuthContext";
import { changePassword } from "../../../core/api/authApi";
import famLogo from "../../../assets/famproject_logo.png";

const MIN_LENGTH = 8;

// Pantalla obligatoria para pasantes (auth_provider=local) tras alta o reset
// de password por un admin -- ProtectedRoute redirige aca automaticamente
// mientras user.must_change_password sea true, sin dejar navegar a ningun
// otro lado. Ver docs/plans/pasantes-access-plan.md.
export default function ChangePassword() {
  const { user, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const mustChange = user?.must_change_password === true;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < MIN_LENGTH) {
      setError(`La nueva contraseña debe tener al menos ${MIN_LENGTH} caracteres`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await changePassword({ currentPassword: mustChange ? undefined : currentPassword, newPassword });
      await reloadProfile();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "No se pudo cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-light dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-[90%] max-w-[440px] rounded-3xl border border-white/40 bg-white/95 px-10 py-12 text-center shadow-2xl backdrop-blur-2xl dark:border-gray-700/40 dark:bg-gray-800/90"
      >
        <img src={famLogo} alt="FamProject Logo" className="mx-auto mb-4 w-24 drop-shadow-md" />

        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <FiKey className="text-amber-600 dark:text-amber-400" size={20} />
        </div>

        <h2 className="mb-1 text-2xl font-bold tracking-tight text-neutral-800 dark:text-white">
          {mustChange ? "Configura tu contraseña" : "Cambiar contraseña"}
        </h2>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          {mustChange
            ? "Esta es tu primera vez, o tu contraseña fue reiniciada. Debes crear una contraseña nueva antes de continuar."
            : "Actualiza tu contraseña de acceso."}
        </p>

        {error && (
          <div className="mb-5 rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          {!mustChange && (
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Contraseña actual"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          )}
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="Confirma la nueva contraseña"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {loading ? <FiLoader className="animate-spin" /> : null}
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
