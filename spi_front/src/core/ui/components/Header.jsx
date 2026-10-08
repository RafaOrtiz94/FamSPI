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
 Header — banda de identidad naval (DESIGN.md §3.1/§4)
 Superficie opaca --nav, sin blur ni sombra decorativa. Se
 continúa visualmente con NavigationBar (misma familia naval)
 separadas solo por un hairline, formando una única banda de
 navegación de dos niveles: identidad arriba, accesos abajo.
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
 <header className="sticky top-0 z-20 bg-[var(--nav)] text-[var(--nav-selected-text)]">
 <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-6">
 {/* =======================================================
 IZQUIERDA: Logo + Nombre
 ======================================================= */}
 <div className="flex min-w-0 items-center gap-3">
 <div className="flex min-w-0 items-center gap-2 select-none">
 <img
 src={famLogo}
 alt="FamProject"
 className="h-8 w-auto flex-shrink-0"
 />
 <div className="hidden min-w-0 sm:block">
 <h1 className="truncate text-[15px] font-semibold leading-none tracking-tight text-[var(--nav-selected-text)]">
 FamSPI
 </h1>
 <p className="mt-1 truncate text-[11px] leading-none text-[var(--nav-text)]">
 Departamento de TI
 </p>
 </div>
 </div>
 </div>

 {/* =======================================================
 DERECHA: Acciones
 ======================================================= */}
 <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
 <div
 className={`hidden rounded-md px-2.5 py-1 text-[11px] font-medium md:inline-flex ${
 isOnline
 ? isSlowConnection
 ? "bg-[var(--warning-bg)] text-[var(--warning-text)]"
 : "bg-[var(--success-bg)] text-[var(--success-text)]"
 : "bg-[var(--danger-bg)] text-[var(--danger-text)]"
 }`}
 title={isOnline ? "Estado actual de conectividad de la PWA" : "La PWA está sin conexión"}
 >
 {isOnline ? (isSlowConnection ? `Red limitada${effectiveType ? ` ${effectiveType}` : ""}` : "PWA estable") : "Sin conexión"}
 </div>

 {/* Tema */}
 <button
 onClick={toggleTheme}
 className="rounded-lg p-2 text-[var(--nav-text)] transition hover:bg-white/10 hover:text-[var(--nav-selected-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nav-marker)]"
 title="Cambiar tema"
 >
 {theme === "dark" ? <FiSun size={18} /> : <FiMoon size={18} />}
 </button>

 {/* Perfil (link a Mi Perfil) */}
 <button
 onClick={() => navigate("/dashboard/mi-perfil", { state: { backgroundLocation: location } })}
 className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nav-marker)] sm:px-3"
 title="Ir a Mi Perfil"
 >
 <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold uppercase text-[var(--nav-selected-text)]">
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
 <div className="hidden flex-col items-start leading-tight sm:flex">
 <span className="max-w-[160px] truncate text-sm font-medium text-[var(--nav-selected-text)]">
 {displayName}
 </span>
 <span className="text-[11px] text-[var(--nav-text)]">
 Mi Perfil
 </span>
 </div>
 </button>

 {/* Logout */}
 <button
 onClick={logout}
 title="Cerrar sesión"
 className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--nav-text)] transition hover:bg-white/10 hover:text-[var(--nav-selected-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nav-marker)] sm:px-3"
 >
 <FiLogOut size={16} />
 <span className="hidden sm:inline">Salir</span>
 </button>
 </div>
 </div>
 </header>
 );
}
