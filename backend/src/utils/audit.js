/**
 * ============================================================
 * 🧾 Utils: Auditoría SPI Fam Project (Extendido)
 * ------------------------------------------------------------
 * Registra en la tabla `auditoria.logs` todas las acciones
 * relevantes del sistema (crear, editar, eliminar, aprobar, etc.)
 *
 * Estructura de tabla extendida:
 *   id SERIAL PK
 *   usuario_id INT FK → users.id
 *   usuario_email TEXT
 *   rol TEXT
 *   modulo TEXT
 *   accion TEXT
 *   descripcion TEXT
 *   datos_anteriores JSONB
 *   datos_nuevos JSONB
 *   ip TEXT
 *   user_agent TEXT
 *   duracion_ms INT
 *   request_id INT NULL
 *   mantenimiento_id INT NULL
 *   inventario_id INT NULL
 *   auto BOOLEAN DEFAULT false
 *   creado_en TIMESTAMPTZ DEFAULT NOW()
 * ============================================================
 */

const db = require("../config/db");
const logger = require("../config/logger");

/**
 * Inserta un registro de auditoría extendido
 * ------------------------------------------------------------
 * @param {Object} params - Parámetros del registro
 * @param {number|null} params.usuario_id
 * @param {string} params.usuario_email
 * @param {string} params.rol
 * @param {string} params.modulo
 * @param {string} params.accion
 * @param {string} [params.descripcion]
 * @param {object|null} [params.datos_anteriores]
 * @param {object|null} [params.datos_nuevos]
 * @param {string|null} [params.ip]
 * @param {string|null} [params.user_agent]
 * @param {number|null} [params.duracion_ms]
 * @param {object} [params.contexto] - IDs relacionados entre módulos
 * @param {number|null} [params.contexto.request_id]
 * @param {number|null} [params.contexto.mantenimiento_id]
 * @param {number|null} [params.contexto.inventario_id]
 * @param {boolean} [params.contexto.auto]
 */
async function logAction(params = {}) {
  try {
    const {
      usuario_id,
      user_id,
      userId,
      usuario_email,
      user_email,
      userEmail,
      email,
      rol,
      role,
      modulo,
      module,
      accion,
      action,
      descripcion,
      description,
      datos_anteriores,
      previous_data,
      before,
      datos_nuevos,
      details,
      data,
      after,
      ip = null,
      user_agent,
      userAgent,
      duracion_ms = null,
      duration_ms,
      contexto = {},
      context = {},
      entity,
      entity_id,
      entityId,
      request_id,
      mantenimiento_id,
      inventario_id,
      auto,
    } = params;

    const actorId =
      usuario_id ??
      user_id ??
      userId ??
      null;
    let actorEmail =
      usuario_email ??
      user_email ??
      userEmail ??
      email ??
      "anon";
    let actorRole =
      rol ??
      role ??
      "sin-rol";
    const moduleName =
      modulo ??
      module ??
      "core";
    const actionName =
      accion ??
      action ??
      "desconocida";
    const descriptionText =
      descripcion ??
      description ??
      "";
    const previousData =
      datos_anteriores ??
      previous_data ??
      before ??
      null;
    const nextData =
      datos_nuevos ??
      details ??
      data ??
      after ??
      null;
    const durationMs =
      duracion_ms ??
      duration_ms ??
      null;

    if (actorId && (actorEmail === "anon" || actorRole === "sin-rol")) {
      const { rows } = await db.query(
        `SELECT email, role
           FROM users
          WHERE id = $1
          LIMIT 1`,
        [actorId]
      );
      if (rows[0]) {
        actorEmail = actorEmail === "anon" ? rows[0].email || actorEmail : actorEmail;
        actorRole = actorRole === "sin-rol" ? rows[0].role || actorRole : actorRole;
      }
    }

    // 🧩 Desestructurar contexto relacional
    const {
      request_id: contextRequestId = null,
      mantenimiento_id: contextMaintenanceId = null,
      inventario_id: contextInventoryId = null,
      auto: contextAuto = false,
    } = { ...context, ...contexto };

    const resolvedRequestId =
      request_id ??
      contextRequestId ??
      (entity === "requests" || entity === "personnel_requests" ? (entity_id ?? entityId ?? null) : null);
    const resolvedMaintenanceId =
      mantenimiento_id ??
      contextMaintenanceId ??
      (entity === "mantenimientos" ? (entity_id ?? entityId ?? null) : null);
    const resolvedInventoryId =
      inventario_id ??
      contextInventoryId ??
      (entity === "inventario" ? (entity_id ?? entityId ?? null) : null);
    const isAuto =
      auto ??
      contextAuto ??
      false;

    if (!actionName || !moduleName) {
      logger.warn("⚠️ logAction llamado sin acción o módulo válido");
      return;
    }

    // 🗃️ Inserción extendida
    const query = `
      INSERT INTO auditoria.logs (
        usuario_id,
        usuario_email,
        rol,
        modulo,
        accion,
        descripcion,
        datos_anteriores,
        datos_nuevos,
        ip,
        user_agent,
        duracion_ms,
        request_id,
        mantenimiento_id,
        inventario_id,
        auto,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, NOW())
    `;

    const values = [
      actorId,
      actorEmail,
      actorRole,
      moduleName,
      actionName,
      descriptionText,
      previousData,
      nextData,
      ip,
      user_agent ?? userAgent ?? null,
      durationMs,
      resolvedRequestId,
      resolvedMaintenanceId,
      resolvedInventoryId,
      isAuto,
    ];

    await db.query(query, values);

    logger.audit(
      `🧾 Auditoría registrada → ${moduleName}.${actionName}`,
      {
        usuario_email: actorEmail,
        rol: actorRole,
        modulo: moduleName,
        accion: actionName,
        request_id: resolvedRequestId,
        mantenimiento_id: resolvedMaintenanceId,
        inventario_id: resolvedInventoryId,
        auto: isAuto,
      }
    );
  } catch (err) {
    // Nunca romper flujo principal
    logger.error(
      {
        err,
        modulo: params.modulo ?? params.module ?? "core",
        accion: params.accion ?? params.action ?? "desconocida",
        usuario_email:
          params.usuario_email ??
          params.user_email ??
          params.userEmail ??
          params.email ??
          "anon",
      },
      "❌ Error registrando auditoría en DB"
    );

    // Fallback: guardar en consola si falla DB
    try {
      console.error(
        "[AUDIT FALLBACK]",
        JSON.stringify({
          modulo: params.modulo ?? params.module ?? "core",
          accion: params.accion ?? params.action ?? "desconocida",
          usuario_email:
            params.usuario_email ??
            params.user_email ??
            params.userEmail ??
            params.email ??
            "anon",
          descripcion: params.descripcion ?? params.description ?? "",
        })
      );
    } catch {
      /* no-op */
    }
  }
}

module.exports = { logAction };
