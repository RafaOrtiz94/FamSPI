const PUBLIC_PATH_PREFIXES = [
  "/ws",
  "/internal/jobs",
  "/api/v1/equipment-purchases/events",
  "/api/v1/private-purchases/events",
  "/api/v1/ti-assets/public/",
  "/api/v1/auth/google",
  "/api/v1/gmail/auth/callback",
  "/api/v1/permisos/legal-verification/",
  "/api/v1/vacaciones/legal-verification/",
  "/health",
  "/api/verificar",
  "/api/verify",
  "/api/signature/verificar",
  "/api/signature/verify",
  "/api/v1/signature/verificar",
  "/api/v1/signature/verify",
  "/api/v1/signature-workflows/verify/"
];

function isPublicPath(pathname = "") {
  if (pathname === "/ws") return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

module.exports = {
  isPublicPath,
};
