/**
 * src/modules/auth/auth.controller.js
 * ------------------------------------
 * 🔐 Autenticación Google OAuth2 → JWT Header-Based
 * - Tokens: accessToken (8h), refreshToken (7d)
 * - Frontend: recibe tokens vía fragment #accessToken=&refreshToken=
 * - Endpoints:
 *    /auth/google        → Redirige a Google OAuth
 *    /auth/callback      → Recibe code, genera tokens, redirige al frontend
 *    /auth/me            → Retorna usuario actual (JWT Bearer)
 *    /auth/refresh       → Genera nuevos tokens
 *    /auth/logout        → Cierra sesión activa
 *    /auth/sessions      → Auditoría de sesiones
 *    /auth/active-users  → Usuarios activos
 */

const { oauth2Client, google } = require("../../config/oauth");
const db = require("../../config/db");
const jwt = require("jsonwebtoken");
const logger = require("../../config/logger");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const {
  createSession,
  updateSessionRefreshToken,
  closeSessionsByEmail,
  closeSessionByRefreshToken,
} = require("./session.repository");

const SCOPES = ["profile", "email"];
const ROLE_META = {
  gerencia: { scope: "gerencia", dashboard: "/dashboard/gerencia" },
  gerente_general: { scope: "gerencia", dashboard: "/dashboard/gerencia" },
  director: { scope: "gerencia", dashboard: "/dashboard/gerencia" },
  finanzas: { scope: "finanzas", dashboard: "/dashboard/finanzas" },
  jefe_finanzas: { scope: "finanzas", dashboard: "/dashboard/finanzas" },
  comercial: { scope: "comercial", dashboard: "/dashboard/comercial" },
  jefe_comercial: { scope: "comercial", dashboard: "/dashboard/comercial" },
  backoffice_comercial: { scope: "comercial", dashboard: "/dashboard/comercial" },
  servicio_tecnico: {
    scope: "servicio_tecnico",
    dashboard: "/dashboard/servicio-tecnico",
  },
  tecnico: { scope: "servicio_tecnico", dashboard: "/dashboard/servicio-tecnico" },
  jefe_servicio_tecnico: {
    scope: "servicio_tecnico",
    dashboard: "/dashboard/servicio-tecnico",
  },
  jefe_tecnico: {
    scope: "servicio_tecnico",
    dashboard: "/dashboard/servicio-tecnico",
  },
  operaciones: { scope: "operaciones", dashboard: "/dashboard/operaciones" },
  jefe_operaciones: { scope: "operaciones", dashboard: "/dashboard/operaciones" },
  calidad: { scope: "calidad", dashboard: "/dashboard/calidad" },
  jefe_calidad: { scope: "calidad", dashboard: "/dashboard/calidad" },
  ti: { scope: "ti", dashboard: "/dashboard/ti" },
  jefe_ti: { scope: "ti", dashboard: "/dashboard/ti" },
  talento_humano: {
    scope: "talento_humano",
    dashboard: "/dashboard/talento-humano",
  },
  jefe_talento_humano: {
    scope: "talento_humano",
    dashboard: "/dashboard/talento-humano",
  },
  administrador: { scope: "admin", dashboard: "/dashboard/gerencia" },
};
const resolveRoleMeta = (role) => {
  const key = (role || "pendiente").toLowerCase();
  return (
    ROLE_META[key] || {
      scope: key,
      dashboard: "/dashboard",
    }
  );
};
const rawFrontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
const FRONTEND_URL = rawFrontendUrl.replace(/\/$/, "");
if (!process.env.FRONTEND_URL) {
  logger.warn(
    "⚠️ FRONTEND_URL no está definido en .env; usando %s como valor por defecto",
    FRONTEND_URL
  );
}
const isProd = process.env.NODE_ENV === "production";

/* ============================================================
   Helpers seguros para firmar tokens
============================================================ */
const signAccess = (payload) =>
  jwt.sign(
    {
      ...payload,
      iss: "spi-fam-backend",
      aud: "spi-fam-frontend",
      sub: payload.id?.toString(),
    },
    process.env.SECRET_KEY,
    { expiresIn: "8h" }
  );

const signRefresh = (payload) =>
  jwt.sign(
    {
      ...payload,
      iss: "spi-fam-backend",
      aud: "spi-fam-frontend",
      sub: payload.id?.toString(),
    },
    process.env.REFRESH_SECRET_KEY,
    { expiresIn: "7d" }
  );

const INTERNAL_LOPDP_FOLDER = "LOPDP INTERNO FAM";

/* ============================================================
   1️⃣ Redirigir a Google OAuth
============================================================ */
const googleAuthRedirect = (req, res) => {
  try {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
    logger.info(`🌐 Redirigiendo a Google OAuth: ${url}`);
    res.redirect(url);
  } catch (err) {
    logger.error("❌ Error generando URL de autenticación: %o", err);
    res.status(500).json({ ok: false, message: "Error iniciando autenticación con Google" });
  }
};

/* ============================================================
   2️⃣ Callback de Google → genera tokens JWT
============================================================ */
const googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      logger.warn("⚠️ No se recibió 'code' en el callback de Google");
      return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
    }

    // Intercambiar code por tokens de Google
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    });
    oauth2Client.setCredentials(tokens);

    // Obtener datos del usuario
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    if (!data.verified_email) {
      return res.redirect(`${FRONTEND_URL}/login?error=email_not_verified`);
    }

    const email = data.email;
    const googleId = data.id;
    const fullname = data.name;
    const domain = data.hd || email.split("@")[1];
    const allowedDomain = process.env.ALLOWED_DOMAIN;

    if (allowedDomain && domain !== allowedDomain) {
      logger.warn(`⛔ Dominio no permitido: ${domain}`);
      const msg = encodeURIComponent(`Solo se permiten cuentas @${allowedDomain}`);
      return res.redirect(`${FRONTEND_URL}/login?error=${msg}`);
    }

    // Buscar o crear usuario
    const existing = await db.query(
      "SELECT id, email, fullname, role, department_id, lopdp_internal_status FROM users WHERE email = $1 LIMIT 1",
      [email]
    );
    let user;

    if (existing.rows.length === 0) {
      logger.info(`🆕 Creando nuevo usuario: ${email}`);
      const ins = await db.query(
        `
        INSERT INTO users (
          google_id,
          email,
          fullname,
          name,
          role,
          department_id,
          lopdp_internal_status
        )
        VALUES ($1, $2, $3, $4, $5, (SELECT id FROM departments WHERE code = $6 LIMIT 1), 'pending')
        RETURNING id, email, fullname, role, department_id, lopdp_internal_status;
        `,
        [googleId, email, fullname, data.given_name || "Usuario", "pendiente", "comercial"]
      );
      user = ins.rows[0];
    } else {
      logger.info(`🔄 Actualizando usuario existente: ${email}`);
      const upd = await db.query(
        `
        UPDATE users
        SET google_id = $1,
            fullname = $2,
            updated_at = NOW(),
            department_id = COALESCE(department_id, (SELECT id FROM departments WHERE code = $4 LIMIT 1)),
      lopdp_internal_status = COALESCE(lopdp_internal_status, 'pending')
        WHERE email = $3
        RETURNING id, email, fullname, role, department_id, lopdp_internal_status;
        `,
        [googleId, fullname, email, "ti"]
      );
      user = upd.rows[0];
    }

    const roleValue = user.role || "pendiente";
    const roleMeta = resolveRoleMeta(roleValue);
    let department = roleMeta.scope || "pendiente";
    if (user?.department_id) {
      const depQ = await db.query("SELECT code FROM departments WHERE id = $1 LIMIT 1", [
        user.department_id,
      ]);
      department = depQ.rows[0]?.code || department;
    }

    const userProfile = {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      role: roleValue,
      department,
      scope: roleMeta.scope,
      dashboard: roleMeta.dashboard,
      lopdp_internal_status: user.lopdp_internal_status || "pending",
    };

    // Firmar tokens
    const accessToken = signAccess(userProfile);
    const refreshToken = signRefresh({ id: user.id, email: user.email });

    // Registrar sesión
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || req.ip;
    try {
      await createSession({
        email,
        ip,
        userAgent: req.headers["user-agent"],
        refreshToken,
      });
    } catch (sessionErr) {
      logger.warn("⚠️ No se pudo registrar la sesión en user_sessions: %s", sessionErr.message);
    }

    // Redirigir al frontend con tokens
    const redirectUrl = `${FRONTEND_URL}/login/callback#accessToken=${encodeURIComponent(
      accessToken
    )}&refreshToken=${encodeURIComponent(refreshToken)}&email=${encodeURIComponent(email)}`;

    logger.info(`✅ Login exitoso: ${email}`);
    return res.redirect(redirectUrl);
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.code === "EPERM") {
      logger.error(
        "❌ No se pudo conectar a PostgreSQL (%s:%s). ¿Está levantado el servidor?",
        process.env.DB_HOST || "localhost",
        process.env.DB_PORT || 5432
      );
      return res.redirect(`${FRONTEND_URL}/login?error=db_unavailable`);
    }
    logger.error("❌ Error general en callback OAuth2: %s", err.message);
    logger.error("💥 Detalles completos del error:", {
      name: err.name,
      message: err.message,
      stack: err.stack,
      response: err.response?.data,
      code: err.code,
    });
    return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  } finally {
    oauth2Client.setCredentials(null);
  }
};

/* ============================================================
   3️⃣ /auth/me → requiere Authorization: Bearer
============================================================ */
const me = async (req, res) => {
  try {
    const { email } = req.user || {};
    if (!email) return res.status(401).json({ error: "No autorizado" });

    const { rows } = await db.query(
      `
      SELECT
        u.id,
        u.email,
        u.fullname,
        u.role,
        d.code AS department,
        u.lopdp_internal_status,
        u.lopdp_internal_signed_at,
        u.lopdp_internal_pdf_file_id,
        u.lopdp_internal_signature_file_id
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.email = $1 LIMIT 1;
      `,
      [email]
    );

    if (!rows.length) return res.status(404).json({ error: "Usuario no encontrado" });
    const payload = rows[0];
    const meta = resolveRoleMeta(payload.role);
    return res.status(200).json({
      user: {
        ...payload,
        scope: meta.scope,
        dashboard: meta.dashboard,
        lopdp_internal_status: payload.lopdp_internal_status || "pending",
      },
    });
  } catch (err) {
    logger.error("❌ Error en /auth/me: %o", err);
    res.status(500).json({ error: "No se pudo obtener el usuario actual" });
  }
};

/* ============================================================
   4️⃣ /auth/refresh
============================================================ */
const refreshToken = async (req, res) => {
  try {
    const token = req.headers["x-refresh-token"] || req.body?.refreshToken;
    if (!token)
      return res.status(401).json({ ok: false, message: "No hay refresh token." });

    const decoded = jwt.verify(token, process.env.REFRESH_SECRET_KEY);

    const { rows } = await db.query(
      "SELECT id, email, fullname, role, department_id FROM users WHERE id = $1 LIMIT 1;",
      [decoded.id]
    );
    if (!rows.length)
      return res.status(401).json({ ok: false, message: "Usuario no válido." });

    const u = rows[0];
    const depQ = await db.query("SELECT code FROM departments WHERE id = $1", [
      u.department_id,
    ]);
    const department = depQ.rows[0]?.code || "pendiente";

    const roleMeta = resolveRoleMeta(u.role);
    const newAccessToken = signAccess({
      id: u.id,
      email: u.email,
      fullname: u.fullname,
      role: u.role,
      department,
      scope: roleMeta.scope,
      dashboard: roleMeta.dashboard,
    });
    const newRefreshToken = signRefresh({ id: u.id, email: u.email });

    // Actualiza sesión activa con nuevo refresh
    const updated = await updateSessionRefreshToken({
      email: u.email,
      previousToken: token,
      newToken: newRefreshToken,
    });

    if (!updated) {
      await createSession({
        email: u.email,
        ip: req.headers["x-forwarded-for"]?.split(",")[0] || req.ip,
        userAgent: req.headers["user-agent"],
        refreshToken: newRefreshToken,
      });
    }

    return res.status(200).json({
      ok: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    logger.warn("refreshToken inválido/expirado: %s", err.message);
    return res.status(401).json({ ok: false, message: "Token inválido o expirado." });
  }
};

/* ============================================================
   5️⃣ Logout
============================================================ */
const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let email = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        email = decoded.email;
      } catch {
        logger.warn("⚠️ Token inválido durante logout");
      }
    }

    if (email) {
      await closeSessionsByEmail(email);
    } else if (req.headers["x-refresh-token"]) {
      await closeSessionByRefreshToken(req.headers["x-refresh-token"]);
    }

    return res.status(200).json({ ok: true, message: "Sesión cerrada." });
  } catch (err) {
    logger.error("❌ Error cerrando sesión: %o", err);
    res.status(500).json({ ok: false, message: "Error cerrando sesión" });
  }
};

/* ============================================================
   Auditoría
============================================================ */
const listSessions = async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        us.id, us.user_email, u.fullname, u.role, d.code AS department,
        us.ip, us.user_agent, us.login_time, us.logout_time,
        CASE WHEN us.logout_time IS NULL THEN 'Activa' ELSE 'Cerrada' END AS estado
      FROM user_sessions us
      LEFT JOIN users u ON u.email = us.user_email
      LEFT JOIN departments d ON d.id = u.department_id
      ORDER BY us.login_time DESC;
    `);
    logger.info("[AUTH] Consulta de sesiones", { total: rows.length });
    return res.status(200).json({ ok: true, total: rows.length, sessions: rows });
  } catch (err) {
    logger.error("❌ Error obteniendo sesiones: %o", err);
    return res.status(500).json({ ok: false, message: "Error obteniendo sesiones" });
  }
};

const activeUsers = async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT DISTINCT ON (us.user_email)
        us.user_email, u.fullname, u.role, d.code AS department,
        us.ip, us.user_agent, us.login_time
      FROM user_sessions us
      LEFT JOIN users u ON u.email = us.user_email
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE us.logout_time IS NULL
      ORDER BY us.user_email, us.login_time DESC;
    `);
    logger.info("[AUTH] Usuarios activos consultados", { total: rows.length });
    return res.status(200).json({ ok: true, total: rows.length, active: rows });
  } catch (err) {
    logger.error("❌ Error usuarios activos: %o", err);
    return res.status(500).json({ ok: false, message: "Error obteniendo usuarios activos" });
  }
};

/* ============================================================
   6️⃣ Consentimiento interno LOPDP (nuevos colaboradores)
============================================================ */
const acceptInternalLopdp = async (req, res) => {
  try {
    const actor = req.user || {};
    if (!actor?.email) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const {
      signature_base64: signatureBase64,
      pdf_base64: pdfBase64,
      notes,
      accepted,
    } = req.body || {};

    if (!accepted) {
      return res
        .status(400)
        .json({ ok: false, message: "Debe aceptar el aviso de protección de datos" });
    }

    if (!signatureBase64 || !pdfBase64) {
      return res.status(400).json({ ok: false, message: "Falta la firma o el PDF generado" });
    }

    const { rows } = await db.query(
      "SELECT id, email, fullname, role, department_id, lopdp_internal_status FROM users WHERE email = $1 LIMIT 1",
      [actor.email]
    );

    if (!rows.length) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    const user = rows[0];

    if ((user.lopdp_internal_status || "").toLowerCase() === "granted") {
      return res.status(200).json({ ok: true, alreadyAccepted: true });
    }

    const rootId =
      process.env.DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_FOLDER_ID;
    if (!rootId) {
      return res.status(500).json({
        ok: false,
        message: "No se ha configurado DRIVE_ROOT_FOLDER_ID en el entorno",
      });
    }

    const baseFolder = await ensureFolder(INTERNAL_LOPDP_FOLDER, rootId);
    const personFolder = await ensureFolder(user.fullname || user.email, baseFolder.id);
    const today = new Date().toISOString().slice(0, 10);

    const signatureFile = await uploadBase64File(
      `firma-${user.email}-${today}.png`,
      signatureBase64,
      "image/png",
      personFolder.id
    );

    const pdfFile = await uploadBase64File(
      `LOPDP-${user.email}-${today}.pdf`,
      pdfBase64,
      "application/pdf",
      personFolder.id
    );

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      req.ip;
    const userAgent = req.headers["user-agent"] || null;

    const updated = await db.query(
      `
      UPDATE users
      SET lopdp_internal_status = 'granted',
          lopdp_internal_signed_at = NOW(),
          lopdp_internal_pdf_file_id = $2,
          lopdp_internal_signature_file_id = $3,
          lopdp_internal_ip = $4,
          lopdp_internal_user_agent = $5,
          lopdp_internal_notes = COALESCE($6, lopdp_internal_notes),
          updated_at = NOW()
      WHERE email = $1
      RETURNING id, email, fullname, role, department_id, lopdp_internal_status, lopdp_internal_signed_at, lopdp_internal_pdf_file_id, lopdp_internal_signature_file_id;
      `,
      [user.email, pdfFile.id, signatureFile.id, ip, userAgent, notes || null]
    );

    await db
      .query(
        `
        INSERT INTO user_lopdp_consents (
          user_id,
          user_email,
          status,
          pdf_file_id,
          signature_file_id,
          ip,
          user_agent,
          notes
        ) VALUES ($1, $2, 'granted', $3, $4, $5, $6, $7);
        `,
        [user.id, user.email, pdfFile.id, signatureFile.id, ip, userAgent, notes || null]
      )
      .catch((err) => logger.warn({ err }, "No se pudo registrar auditoría interna LOPDP"));

    const updatedUser = updated.rows[0];
    let department = null;
    if (updatedUser?.department_id) {
      const depQ = await db.query("SELECT code FROM departments WHERE id = $1 LIMIT 1", [
        updatedUser.department_id,
      ]);
      department = depQ.rows[0]?.code || null;
    }
    const meta = resolveRoleMeta(updatedUser.role || "pendiente");

    return res.status(200).json({
      ok: true,
      user: {
        ...updatedUser,
        department: department || meta.scope || "pendiente",
        scope: meta.scope,
        dashboard: meta.dashboard,
      },
    });
  } catch (err) {
    logger.error({ err }, "❌ Error registrando LOPDP interno");
    return res.status(500).json({ ok: false, message: "No se pudo registrar la aceptación" });
  }
};

/* ============================================================
   Exportación
============================================================ */
module.exports = {
  googleAuthRedirect,
  googleCallback,
  me,
  refreshToken,
  logout,
  listSessions,
  activeUsers,
  acceptInternalLopdp,
};
