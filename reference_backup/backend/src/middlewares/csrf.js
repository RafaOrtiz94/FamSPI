// src/middlewares/csrf.js
// CSRF estilo "double-submit": cookie XSRF-TOKEN + header X-XSRF-TOKEN
const crypto = require("crypto");
const { xsrfCookieOptions } = require("../config/security");

// Genera token si no existe
const csrfSeed = (req, res, next) => {
  if (!req.cookies["XSRF-TOKEN"]) {
    const token = crypto.randomBytes(24).toString("hex");
    res.cookie("XSRF-TOKEN", token, xsrfCookieOptions);
  }
  next();
};

// Verifica solo métodos que cambian estado
const csrfGuard = (req, res, next) => {
  const methods = ["POST", "PUT", "PATCH", "DELETE"];
  if (!methods.includes(req.method)) return next();

  const cookieToken = req.cookies["XSRF-TOKEN"];
  const headerToken = req.header("X-XSRF-TOKEN");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ ok: false, error: "csrf_invalid" });
  }
  next();
};

module.exports = { csrfSeed, csrfGuard };
