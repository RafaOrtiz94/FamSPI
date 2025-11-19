// src/core/ui/components/Header.jsx
import React from "react";
import { useAuth } from "../../auth/useAuth";
import { useUI } from "../UIContext";
import {
  FiSun,
  FiMoon,
  FiLogOut,
  FiBell,
  FiUser,
} from "react-icons/fi";
import famLogo from "../../../assets/famproject_logo.png";

/* ============================================================
   🧭 Header — Estilo Empresarial Moderno
   ------------------------------------------------------------
   • Fondo navy oscuro (#1E293B)
   • Efecto glass leve y sombra elegante
   • Botones con contraste acento petróleo
   • Logo visible, tipografía moderna y compacta
   ============================================================ */
export default function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useUI();

  return (
    <header className="sticky top-0 z-40 bg-primary/95 text-white shadow-md backdrop-blur-md border-b border-primary-light transition-all duration-300">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* =======================================================
           🔹 IZQUIERDA: Logo + Nombre
        ======================================================= */}
        <div className="flex items-center gap-3">
          {/* Logo + Marca */}
          <div className="flex items-center gap-2 select-none">
            <img
              src={famLogo}
              alt="FamProject Logo"
              className="h-9 w-auto drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold tracking-tight text-white">
                SPI Fam Project
              </h1>
              <p className="text-xs text-accent-light/90 font-medium -mt-1">
                Departamento de TI
              </p>
            </div>
          </div>
        </div>

        {/* =======================================================
           🔹 DERECHA: Acciones
        ======================================================= */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Tema */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-primary-light/40 hover:bg-primary-light/60 transition focus-visible:ring-2 focus-visible:ring-accent"
            title="Cambiar tema"
          >
            {theme === "dark" ? (
              <FiSun className="text-yellow-300" size={18} />
            ) : (
              <FiMoon className="text-accent" size={18} />
            )}
          </button>

          {/* Notificaciones */}
          <button
            className="relative p-2 rounded-lg bg-primary-light/40 hover:bg-primary-light/60 transition focus-visible:ring-2 focus-visible:ring-accent"
            title="Notificaciones"
          >
            <FiBell className="text-accent" size={18} />
            <span className="absolute top-1 right-1 h-2 w-2 bg-accent rounded-full animate-pulse" />
          </button>

          {/* Perfil */}
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-primary-light/40 px-3 py-1.5 shadow-inner">
            <FiUser className="text-accent" size={16} />
            <span className="text-sm font-medium truncate max-w-[140px] text-white">
              {user?.name || user?.email || "Usuario"}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg shadow-sm transition focus-visible:ring-2 focus-visible:ring-accent-light"
          >
            <FiLogOut size={16} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
