import api, {
 API_BASE_URL,
 setTokens as setApiTokens,
 clearTokens as clearApiTokens,
 getAccessToken as getApiAccessToken,
 getRefreshToken as getApiRefreshToken,
 hasRefreshToken as hasApiRefreshToken,
} from "./index";

/**
 * ==========================================================
 * 🔐 Auth API — SPI Fam (JWT Header-based)
 * ----------------------------------------------------------
 * Maneja login con Google, logout, refresh y perfil del usuario.
 * Tokens se almacenan en localStorage:
 * - accessToken
 * - refreshToken
 * ==========================================================
 */

/* ==========================================================
 📦 Helpers de tokens
 ========================================================== */
export const getAccessToken = () => getApiAccessToken();
export const getRefreshToken = () => getApiRefreshToken();
export const hasRefreshToken = () => hasApiRefreshToken();

export const setTokens = (accessToken, refreshToken) => {
 setApiTokens(accessToken, refreshToken);
};

export const clearTokens = () => {
 clearApiTokens();
};

/* ==========================================================
 🚀 Login con Google OAuth (flujo redirigido)
 ========================================================== */
export const googleLogin = () => {
 try {
 const cleanBaseUrl = API_BASE_URL.replace(/\/$/, "");
 return `${cleanBaseUrl}/auth/google`;
 } catch (err) {
 console.error("❌ Error generando URL de login:", err);
 alert("No se pudo conectar con el servidor de autenticación.");
 return null;
 }
};

/* ==========================================================
 🔁 Callback OAuth2 — llamado desde LoginCallback.jsx
 ========================================================== */
/* ==========================================================
 🔁 Callback OAuth2 — llamado desde LoginCallback.jsx
 ========================================================== */
export const handleGoogleCallback = (hash) => {
 const params = new URLSearchParams(hash.replace(/^#/, ""));
 const accessToken = params.get("accessToken");
 const refreshToken = params.get("refreshToken");
 const email = params.get("email"); // 👈 agregado

 if (accessToken) setTokens(accessToken, refreshToken);

 return { accessToken, refreshToken, email };
};

/* ==========================================================
 🚪 Logout (invalida tokens y sesión)
 ========================================================== */
export const logout = async () => {
 try {
 const token = getAccessToken();
 if (token) {
 await api.post(
 "/auth/logout",
 {},
 { headers: { Authorization: `Bearer ${token}` } }
 );
 }
 } catch (err) {
 console.warn("⚠️ Error cerrando sesión:", err.message);
 } finally {
 clearTokens();
 }
};

/* ==========================================================
 🧭 Perfil actual (/auth/me)
 ========================================================== */
export const getProfile = async (options = {}) => {
 const token = getAccessToken();
 if (!token) throw new Error("No hay token activo");
 const params = options?.lite ? { lite: "1" } : undefined;

 const { data } = await api.get("/auth/me", {
 headers: { Authorization: `Bearer ${token}` },
 params,
 });

 if (!data?.user) throw new Error("Usuario no encontrado");
 return data.user;
};

/* ==========================================================
 🔁 Refresh token (/auth/refresh)
 ========================================================== */
export const refreshAccessToken = async () => {
 const refreshToken = getRefreshToken();
 if (!refreshToken) throw new Error("No hay refresh token");

 try {
 const { data } = await api.post(
 "/auth/refresh",
 {},
 { headers: { "x-refresh-token": refreshToken } }
 );

 if (data?.accessToken) {
 setTokens(data.accessToken, data.refreshToken);
 return data.accessToken;
 } else {
 throw new Error("El servidor no devolvió accessToken");
 }
 } catch (err) {
 console.error("❌ Error al refrescar token:", err.message);
 if (err?.response?.status === 401) {
 clearTokens();
 }
 throw err;
 }
};

/* ==========================================================
 ✍️ Consentimiento interno LOPDP
 ========================================================== */
export const submitInternalLopdpConsent = async ({
 signatureBase64,
 pdfBase64,
 notes,
}) => {
 const token = getAccessToken();
 if (!token) throw new Error("No hay token activo");

 const { data } = await api.post(
 "/auth/lopdp/accept",
 {
 signature_base64: signatureBase64,
 pdf_base64: pdfBase64,
 notes,
 accepted: true,
 },
 { headers: { Authorization: `Bearer ${token}` } }
 );

 if (!data?.ok) throw new Error(data?.message || "No se pudo registrar la aceptación");
 return data;
};

// Alias for consistency
export const acceptInternalLopdp = submitInternalLopdpConsent;

/* ==========================================================
 🧪 Login sandbox (solo cuando REACT_APP_SANDBOX_AUTH=true)
 ========================================================== */
export const sandboxLogin = async (email, password) => {
  const { data } = await api.post("/auth/local", { email, password });
  if (!data?.ok) throw new Error(data?.message || "Credenciales incorrectas");
  setTokens(data.accessToken, data.refreshToken);
  return data;
};
