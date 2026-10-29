/**
 * ============================================================
 * 🧾 Middleware: Auditoría SPI Fam Project (Extendido)
 * ------------------------------------------------------------
 * Registra automáticamente las acciones críticas (POST, PUT, PATCH, DELETE)
 * en la tabla auditoria.logs, incluyendo trazabilidad entre módulos.
 *
 * ✅ Compatible con JWT
 * ✅ Omite rutas públicas y de autenticación
 * ✅ Guarda IP, User-Agent, duración y payload resumido
 * ✅ Soporta contexto cruzado (requests ↔ mantenimientos ↔ inventario)
 * ✅ Registra acciones automáticas del sistema
 * ============================================================
 */

const { logAction } = require("../utils/audit");
const logger = require("../config/logger");

async function auditMiddleware(req, res, next) {
  try {
    const method = req.method.toUpperCase();
    const trackable = ["POST", "PUT", "PATCH", "DELETE"];

    // Solo auditar métodos que modifican datos
    if (!trackable.includes(method)) return next();

    // Omitir rutas públicas o de autenticación
    if (
      req.originalUrl.startsWith("/api/v1/auth") ||
      req.originalUrl.startsWith("/auth")
    )
      return next();

    const start = Date.now();

    res.on("finish", async () => {
      try {
        const duration = Date.now() - start;
        const user = req.user || {};
        const usuario_id = user.id || null;
        const usuario_email = user.email || "anon";
        const rol = user.role || "sin-rol";
        const ip =
          req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
          req.ip ||
          null;
        const user_agent = req.headers["user-agent"] || "N/A";

        // Determinar módulo y acción
        const cleanPath = req.originalUrl.split("?")[0];
        const pathParts = cleanPath.split("/").filter(Boolean);
        const modulo = resolveModuleFromPath(pathParts);
        const accion = mapHttpMethodToAction(method, pathParts);
        const success = res.statusCode < 400;

        // Determinar ID del recurso afectado
        const resourceId = pathParts.find((p) => /^\d+$/.test(p)) || null;

        // Descripción más informativa
        const descripcion = resourceId
          ? `${method} ${modulo}/${resourceId} (${res.statusCode})`
          : `${method} ${req.originalUrl} (${res.statusCode})`;

        // 🧩 Contexto relacional mejorado
        const contexto = buildContext({
          modulo,
          pathParts,
          body: req.body,
          query: req.query,
        });
        contexto.resource_id = resourceId ? parseInt(resourceId, 10) : null;

        // Registrar acción manual o automática
        if (usuario_id || req.body?.auto_generated) {
          await logAction({
            usuario_id,
            usuario_email,
            rol,
            modulo,
            accion: success ? accion : `${accion}_failed`,
            descripcion,
            datos_anteriores: null,
            datos_nuevos: truncateBody(req.body),
            ip,
            user_agent,
            contexto,
            duracion_ms: duration,
          });

          logger.audit(
            `Acción registrada: ${usuario_email || "auto"} → ${accion} en ${modulo}`,
            contexto
          );
        } else {
          logger.debug(`🕵️ Omitido: sin usuario autenticado (${req.originalUrl})`);
        }
      } catch (err) {
        logger.error(
          { err, route: req.originalUrl },
          "❌ Error interno en auditMiddleware (res.finish)"
        );
      }
    });

    next();
  } catch (err) {
    logger.error(
      { err, route: req.originalUrl },
      "❌ Error general en auditMiddleware"
    );
    next();
  }
}

/* ============================================================
   🔹 Determina acción según método HTTP y ruta
============================================================ */
function mapHttpMethodToAction(method, pathParts) {
  switch (method) {
    case "POST":
      if (pathParts.some((p) => p.includes("approve"))) return "aprobar";
      if (pathParts.some((p) => p.includes("reject"))) return "rechazar";
      if (pathParts.some((p) => p.includes("upload"))) return "subir";
      if (pathParts.some((p) => p.includes("sign"))) return "firmar";
      return "crear";
    case "PUT":
    case "PATCH":
      return "actualizar";
    case "DELETE":
      return "eliminar";
    default:
      return method.toLowerCase();
  }
}

/* ============================================================
   🔹 Trunca cuerpo de la petición si es muy grande
============================================================ */
function truncateBody(body, limit = 800) {
  if (!body || typeof body !== "object") return null;
  try {
    // Clonar a JSON seguro (evita Buffers/ciclos) y devolver siempre un objeto
    const safe = JSON.parse(JSON.stringify(body));
    const str = JSON.stringify(safe);
    if (str.length > limit) {
      return { truncated: true, preview: str.slice(0, limit) + "...[truncated]" };
    }
    return safe;
  } catch {
    return null;
  }
}

module.exports = { auditMiddleware };

function resolveModuleFromPath(pathParts = []) {
  if (!Array.isArray(pathParts) || pathParts.length === 0) return "core";

  const apiIndex = pathParts.findIndex((segment) => segment === "v1");
  if (apiIndex >= 0 && pathParts[apiIndex + 1]) {
    return pathParts[apiIndex + 1];
  }

  if (pathParts[0] === "api" && pathParts[2]) {
    return pathParts[2];
  }

  return pathParts[pathParts.length - 1] || "core";
}

function buildContext({ modulo, pathParts, body = {}, query = {} }) {
  const toInt = (value) => {
    if (value === undefined || value === null) return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const reversed = [...(pathParts || [])].reverse();
  const numericSegment = reversed.find((segment) => /^\d+$/.test(segment));
  const numericId = toInt(numericSegment);

  const ctx = {
    request_id: toInt(body.request_id) ?? toInt(query.request_id) ?? null,
    mantenimiento_id:
      toInt(body.mantenimiento_id) ?? toInt(query.mantenimiento_id) ?? null,
    inventario_id:
      toInt(body.inventory_id) ??
      toInt(body.inventario_id) ??
      toInt(query.inventory_id) ??
      toInt(query.inventario_id) ??
      null,
    auto: Boolean(body.auto_generated || query.auto_generated),
  };

  const moduleName = (modulo || "").toLowerCase();
  if (!ctx.request_id && moduleName.includes("request") && numericId) {
    ctx.request_id = numericId;
  }
  if (!ctx.mantenimiento_id && moduleName.includes("manten") && numericId) {
    ctx.mantenimiento_id = numericId;
  }
  if (!ctx.inventario_id && moduleName.includes("invent") && numericId) {
    ctx.inventario_id = numericId;
  }

  return ctx;
}
