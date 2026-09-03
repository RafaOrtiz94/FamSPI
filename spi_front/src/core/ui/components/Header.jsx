// src/core/ui/components/Header.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useUI } from "../UIContext";
import { FiSun, FiMoon, FiLogOut } from "react-icons/fi";
import famLogo from "../../../assets/famproject_logo.png";
import { getAttendancePunctualitySummary } from "../../api/attendanceApi";
import PunctualityWinnerBadge from "./PunctualityWinnerBadge";
import { usePwaStatus } from "../../pwa/PwaStatusContext";

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
 const navigate = useNavigate();
 const location = useLocation();
 const [isPunctualityLeader, setIsPunctualityLeader] = useState(false);
 const { isOnline, isSlowConnection, effectiveType } = usePwaStatus();

 const displayName = useMemo(
 () => user?.fullname || user?.name || user?.email || "Usuario",
 [user?.fullname, user?.name, user?.email]
 );
 const userInitial = displayName?.charAt(0)?.toUpperCase() || "U";

 useEffect(() => {
 if (!user?.id) {
 setIsPunctualityLeader(false);
 return;
 }

 let cancelled = false;
 const loadPunctuality = async () => {
 try {
 const response = await getAttendancePunctualitySummary();
 if (!cancelled) setIsPunctualityLeader(Boolean(response?.data?.currentUser?.isWinner));
 } catch (_error) {
 if (!cancelled) setIsPunctualityLeader(false);
 }
 };

 loadPunctuality();
 return () => {
 cancelled = true;
 };
 }, [user?.id]);

 return (
 <header className="sticky top-0 z-10 bg-primary/95 text-white shadow-md backdrop-blur-md border-b border-primary-light transition-all duration-300">
 <div className="flex h-16 items-center justify-between gap-2 px-3 sm:px-6">
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
 <div
 className={`hidden rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] md:inline-flex ${
 isOnline
 ? isSlowConnection
 ? "bg-amber-400/15 text-amber-100 ring-1 ring-amber-300/40"
 : "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/30"
 : "bg-rose-400/15 text-rose-100 ring-1 ring-rose-300/40"
 }`}
 title={isOnline ? "Estado actual de conectividad de la PWA" : "La PWA está sin conexión"}
 >
 {isOnline ? (isSlowConnection ? `Red limitada${effectiveType ? ` ${effectiveType}` : ""}` : "PWA estable") : "Sin conexión"}
 </div>

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

 {/* Perfil (link a Mi Perfil) */}
 <button
 onClick={() => navigate("/dashboard/mi-perfil", { state: { backgroundLocation: location } })}
 className="flex items-center gap-3 rounded-lg bg-primary-light/40 px-3 py-1.5 shadow-inner hover:bg-white/10 transition focus-visible:ring-2 focus-visible:ring-accent"
 title="Ir a Mi Perfil"
 >
 <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold uppercase text-white">
 {user?.avatar_url ? (
 <img
 src={user.avatar_url}
 alt="Avatar"
 className="h-full w-full rounded-full object-cover"
 />
 ) : (
 userInitial
 )}
 <PunctualityWinnerBadge visible={isPunctualityLeader} size="sm" />
 </div>
 <div className="flex flex-col items-start leading-tight">
 <span className="text-sm font-semibold text-white truncate max-w-[120px] sm:max-w-[160px]">
 {displayName}
 </span>
 <span className="text-[11px] text-accent-light uppercase tracking-wide">
 Mi Perfil
 </span>
 </div>
 </button>

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
