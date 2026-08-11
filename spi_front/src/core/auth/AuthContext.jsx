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
import { isTransientApiError } from "../api/index";
import { readCachedResource, writeCachedResource } from "../pwa/localCache";

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
const AUTH_PROFILE_CACHE_KEY = "auth_profile";

export const AuthProvider = ({ children }) => {
 const [user, setUser] = useState(null);
 const [isAuthenticated, setIsAuthenticated] = useState(false);
 const [loading, setLoading] = useState(true);
 const sessionTimerRef = useRef(null);
 const profileEnrichmentPromiseRef = useRef(null);

 const redirectToLogin = (error = null) => {
 if (!window.location.pathname.startsWith("/login")) {
  const url = error ? `/login?error=${error}` : "/login";
  window.location.replace(url);
 }
 };

 const clearSessionTimer = () => {
 if (sessionTimerRef.current) {
 clearTimeout(sessionTimerRef.current);
 sessionTimerRef.current = null;
 }
 };

 // Fase 2 (Plan Maestro Asistencia): distingue "sesion expirada" (recordamos
 // a donde volver) de "logout manual" (el usuario decidio salir, no hay que
 // reofrecer continuidad). manual=true => no guarda redirectTo ni marca error.
 const forceLogoutAndRedirect = (error = null, { manual = false } = {}) => {
 clearSessionTimer();
 setUser(null);
 setIsAuthenticated(false);
 clearTokens();

 if (manual) {
 sessionStorage.removeItem("redirectTo");
 redirectToLogin(error);
 return;
 }

 if (!window.location.pathname.startsWith("/login")) {
 const currentPath = window.location.pathname + window.location.search;
 if (currentPath && currentPath !== "/") {
 sessionStorage.setItem("redirectTo", currentPath);
 }
 }
 redirectToLogin(error || "session_expired");
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

 const decodeJwtPayload = (token) => {
 try {
 const [, payload] = String(token || "").split(".");
 if (!payload) return null;
 return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
 } catch (_err) {
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
 if (isTransientApiError(err) && user) {
  return;
 }
 }

 forceLogoutAndRedirect();
 };

 const mergeAndPersistUser = (incomingProfile, fallbackStoredUser = null) => {
  const nextUser = {
  ...((fallbackStoredUser && fallbackStoredUser.email === incomingProfile?.email) ? fallbackStoredUser : {}),
  ...(incomingProfile || {}),
  };
  setUser(nextUser);
  setIsAuthenticated(true);
  localStorage.setItem("user", JSON.stringify(nextUser));
  writeCachedResource(AUTH_PROFILE_CACHE_KEY, nextUser);
  return nextUser;
 };

 const enrichProfileInBackground = async () => {
 if (profileEnrichmentPromiseRef.current) {
  return profileEnrichmentPromiseRef.current;
 }

 profileEnrichmentPromiseRef.current = (async () => {
  try {
   const fullProfile = await getProfile();
   setUser((current) => {
    const nextUser = { ...(current || {}), ...(fullProfile || {}) };
    localStorage.setItem("user", JSON.stringify(nextUser));
    writeCachedResource(AUTH_PROFILE_CACHE_KEY, nextUser);
    return nextUser;
   });
   setIsAuthenticated(true);
   return fullProfile;
  } catch (error) {
   console.warn("⚠️ No se pudo enriquecer el perfil en segundo plano:", error?.message || error);
   return null;
  } finally {
   profileEnrichmentPromiseRef.current = null;
  }
 })();

 return profileEnrichmentPromiseRef.current;
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
  if (!hasRefreshToken()) {
   forceLogoutAndRedirect("missing_refresh_token");
   return false;
  }
  const storedUser = JSON.parse(localStorage.getItem("user") || "null");
  const profile = await getProfile({ lite: true });
  mergeAndPersistUser(profile, storedUser);
  scheduleSessionExpiry();
  void enrichProfileInBackground();
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
 const storedUser = JSON.parse(localStorage.getItem("user") || "null");
 const profile = await getProfile({ lite: true });
 mergeAndPersistUser(profile, storedUser);
 scheduleSessionExpiry();
 void enrichProfileInBackground();
 return profile; // 👈 importante
 } catch (err) {
 console.warn("⚠️ No se pudo sincronizar sesión:", err.message);
 console.warn("⚠️ AuthContext.refresh failed", err);
 const cachedUser =
  JSON.parse(localStorage.getItem("user") || "null") ||
  readCachedResource(AUTH_PROFILE_CACHE_KEY)?.data ||
  null;

 if (isTransientApiError(err) && cachedUser && getAccessToken()) {
  setUser(cachedUser);
  setIsAuthenticated(true);
  return cachedUser;
 }

 setIsAuthenticated(false);
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
 forceLogoutAndRedirect(null, { manual: true });
 }
 };

 const reloadProfile = async () => {
 try {
 const profile = await getProfile();
 mergeAndPersistUser(profile);
 return profile;
 } catch (err) {
 // Silent error
 return null;
  }
 };

 const bootstrapSessionFromToken = (token) => {
 const payload = decodeJwtPayload(token);
 if (!payload) return null;

 const storedUser = JSON.parse(localStorage.getItem("user") || "null");
 const nextUser = {
  ...((storedUser && storedUser.email === payload.email) ? storedUser : {}),
  id: payload.id,
  email: payload.email,
  fullname: payload.fullname,
  role: payload.role,
  department: payload.department,
  scope: payload.scope,
  dashboard: payload.dashboard,
  lopdp_internal_status: payload.lopdp_internal_status || "pending",
 };

 setUser(nextUser);
 setIsAuthenticated(true);
 setLoading(false);
 localStorage.setItem("user", JSON.stringify(nextUser));
  writeCachedResource(AUTH_PROFILE_CACHE_KEY, nextUser);
 scheduleSessionExpiry();
 void enrichProfileInBackground();
 return nextUser;
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
 if (!hasRefreshToken()) {
  console.warn("⚠️ Usuario tiene accessToken pero falta refreshToken (requerido para renovación continua)");
  forceLogoutAndRedirect("missing_refresh_token");
  return;
 }
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
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // ✅ Alias esperados por otros componentes
 const login = refresh;
 const logoutFn = signOut;
 // Fase 2: para 401 detectados en vivo (ej. AttendanceWidget) — a diferencia
 // de logout() (manual), preserva returnUrl y marca error=session_expired.
 const handleSessionExpired = () => forceLogoutAndRedirect(null);

 return (
 <AuthContext.Provider
 value={{
  user,
  isAuthenticated,
  loading,
  refresh,
  reloadProfile,
  bootstrapSessionFromToken,
  login,
 logout: logoutFn, // alias usado por Header y navegación
 signOut,
 handleSessionExpired,
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
