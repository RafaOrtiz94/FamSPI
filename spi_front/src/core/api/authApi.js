import api from "./index";

/**
 * ==========================================================
 * 🔐 Auth API — SPI Fam (JWT Header-based)
 * ----------------------------------------------------------
 * Maneja login con Google, logout, refresh y perfil del usuario.
 * Tokens se almacenan en localStorage:
 *  - accessToken
 *  - refreshToken
 * ==========================================================
 */

/* ==========================================================
   📦 Helpers de tokens
   ========================================================== */
export const getAccessToken = () => localStorage.getItem("accessToken");
export const getRefreshToken = () => localStorage.getItem("refreshToken");
export const hasRefreshToken = () => Boolean(getRefreshToken());

export const setTokens = (accessToken, refreshToken) => {
  if (accessToken) localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
};

/* ==========================================================
   🚀 Login con Google OAuth (flujo redirigido)
   ========================================================== */
export const googleLogin = () => {
  try {
    // Para build con Caddy, usar URL relativa para que Caddy haga proxy
    // Para desarrollo con npm start, usar la configuración del proxy setupProxy.js
    const isProductionBuild = process.env.NODE_ENV === 'production';

    if (isProductionBuild) {
      // En build, usar URL relativa - Caddy hará proxy de /api/*
      return '/api/v1/auth/google';
    } else {
      // En desarrollo con npm start, usar setupProxy.js
      return '/api/v1/auth/google';
    }
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
export const getProfile = async () => {
  const token = getAccessToken();
  if (!token) throw new Error("No hay token activo");

  const { data } = await api.get("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
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
    clearTokens();
    throw err;
  }
};
<<<<<<< Updated upstream
=======

/* ==========================================================
   ✍️  Consentimiento interno LOPDP
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
>>>>>>> Stashed changes
