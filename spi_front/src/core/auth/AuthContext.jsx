// src/core/auth/AuthContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
 getProfile,
 getAccessToken,
 refreshAccessToken,
 logout,
 hasRefreshToken,
 clearTokens,
} from "../api/authApi";

/**
 * ============================================================
 * 🌐 AuthContext
 * ------------------------------------------------------------
 * - Mantiene el estado global de autenticación.
 * - Gestiona tokens, sesión y datos del usuario.
 * - Expone métodos login(), logout(), refresh().
 * ============================================================
 */
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
 const [user, setUser] = useState(null);
 const [isAuthenticated, setIsAuthenticated] = useState(false);
 const [loading, setLoading] = useState(true);
 const sessionTimerRef = useRef(null);

 const redirectToLogin = () => {
 if (!window.location.pathname.startsWith("/login")) {
 window.location.replace("/login");
 }
 };

 const clearSessionTimer = () => {
 if (sessionTimerRef.current) {
 clearTimeout(sessionTimerRef.current);
 sessionTimerRef.current = null;
 }
 };

 const forceLogoutAndRedirect = () => {
 clearSessionTimer();
 setUser(null);
 setIsAuthenticated(false);
 clearTokens();
 redirectToLogin();
 };

 const decodeJwtExp = (token) => {
 try {
 const [, payload] = token.split(".");
 if (!payload) return null;
 const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
 return decoded?.exp ? Number(decoded.exp) : null;
 } catch (err) {
 return null;
 }
 };

 const scheduleSessionExpiry = async () => {
 clearSessionTimer();
 const accessToken = localStorage.getItem("accessToken");
 if (!accessToken) return;

 const exp = decodeJwtExp(accessToken);
 if (!exp) return;

 const nowSeconds = Math.floor(Date.now() / 1000);
 const delayMs = Math.max((exp - nowSeconds) * 1000, 0);

 if (delayMs === 0) {
 try {
 if (hasRefreshToken()) {
 await refreshAccessToken();
 scheduleSessionExpiry();
 return;
 }
 } catch (err) {
 // fall through
 }
 forceLogoutAndRedirect();
 return;
 }

 sessionTimerRef.current = setTimeout(async () => {
 try {
 if (hasRefreshToken()) {
 await refreshAccessToken();
 scheduleSessionExpiry();
 return;
 }
 } catch (err) {
 // ignore and redirect
 }
 forceLogoutAndRedirect();
 }, delayMs);
 };

 const ensureActiveSession = async () => {
 const accessToken = getAccessToken();
 const refreshToken = hasRefreshToken();

 if (!accessToken) {
 if (isAuthenticated) {
 forceLogoutAndRedirect();
 }
 return;
 }

 const exp = decodeJwtExp(accessToken);
 if (!exp) return;

 const nowSeconds = Math.floor(Date.now() / 1000);
 if (exp > nowSeconds) return;

 try {
 if (refreshToken) {
 const newAccess = await refreshAccessToken();
 if (newAccess) {
 scheduleSessionExpiry();
 return;
 }
 }
 } catch (err) {
 // fall through
 }

 forceLogoutAndRedirect();
 };

 /* ============================================================
 🚀 Sincronizar sesión desde tokens locales o refresh
 ============================================================ */
 const refresh = async () => {
 try {
 const activeAccessToken = getAccessToken();
 const activeExp = activeAccessToken ? decodeJwtExp(activeAccessToken) : null;
 const nowSeconds = Math.floor(Date.now() / 1000);

 if (!activeAccessToken && !hasRefreshToken()) {
 setUser(null);
 setIsAuthenticated(false);
 clearTokens();
 return false;
 }

 if (activeAccessToken && (!activeExp || activeExp > nowSeconds)) {
 const profile = await getProfile();
 setUser(profile);
 setIsAuthenticated(true);
 localStorage.setItem("user", JSON.stringify(profile));
 scheduleSessionExpiry();
 return profile;
 }

 if (!hasRefreshToken()) {
 setUser(null);
 setIsAuthenticated(false);
 clearTokens();
 return false;
 }

 const newAccess = await refreshAccessToken();
 if (!newAccess) return false;
 const profile = await getProfile();
 setUser(profile);
 setIsAuthenticated(true);
 localStorage.setItem("user", JSON.stringify(profile));
 scheduleSessionExpiry();
 return profile; // 👈 importante
 } catch (err) {
 console.warn("⚠️ No se pudo sincronizar sesión:", err.message);
 setIsAuthenticated(false);
 console.warn("⚠️ AuthContext.refresh failed", err);
 forceLogoutAndRedirect();
 return false;
 } finally {
 setLoading(false);
 }
 };

 /* ============================================================
 🧹 Cerrar sesión
 ============================================================ */
 const signOut = async () => {
 try {
 await logout();
 } catch (err) {
 console.error("❌ Error cerrando sesión:", err);
 } finally {
 forceLogoutAndRedirect();
 }
 };

 const reloadProfile = async () => {
 try {
 const profile = await getProfile();
 setUser(profile);
 setIsAuthenticated(true);
 localStorage.setItem("user", JSON.stringify(profile));
 return profile;
 } catch (err) {
 // Silent error
 return null;
 }
 };

 /* ============================================================
 🔄 Verificar sesión al cargar la app
 ============================================================ */
 useEffect(() => {
 const init = async () => {
 const storedUser = localStorage.getItem("user");
 const activeAccessToken = getAccessToken();
 const activeExp = activeAccessToken ? decodeJwtExp(activeAccessToken) : null;
 const nowSeconds = Math.floor(Date.now() / 1000);
 const hasValidAccessToken =
 Boolean(activeAccessToken) && (!activeExp || activeExp > nowSeconds);

 if (storedUser && hasValidAccessToken) {
 setUser(JSON.parse(storedUser));
 setIsAuthenticated(true);
 setLoading(false);
 // Sincronizar en segundo plano para actualizar avatar/datos
 refresh();
 scheduleSessionExpiry();
 } else {
 if (storedUser && !hasRefreshToken() && !activeAccessToken) {
 localStorage.removeItem("user");
 }
 await refresh();
 }
 };

 const handleSessionExpiredEvent = () => {
 forceLogoutAndRedirect();
 };

 const handleVisibilityOrFocus = () => {
 if (document.visibilityState && document.visibilityState !== "visible") return;
 ensureActiveSession();
 };

 init();
 window.addEventListener("auth:session-expired", handleSessionExpiredEvent);
 window.addEventListener("visibilitychange", handleVisibilityOrFocus);
 window.addEventListener("focus", handleVisibilityOrFocus);
 return () => {
 clearSessionTimer();
 window.removeEventListener("auth:session-expired", handleSessionExpiredEvent);
 window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
 window.removeEventListener("focus", handleVisibilityOrFocus);
 };
 }, []);

 // ✅ Alias esperados por otros componentes
 const login = refresh;
 const logoutFn = signOut;

 return (
 <AuthContext.Provider
 value={{
 user,
 isAuthenticated,
 loading,
 refresh,
 reloadProfile,
 login,
 logout: logoutFn, // alias usado por Header y navegación
 signOut,
 }}
 >
 {children}
 </AuthContext.Provider>
 );
};

/**
 * ============================================================
 * 🧠 Hook de acceso rápido
 * ------------------------------------------------------------
 * Permite obtener user, login, logout, etc. desde cualquier parte.
 * ============================================================
 */
export const useAuth = () => useContext(AuthContext);
