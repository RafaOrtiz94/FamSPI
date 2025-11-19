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
async function logAction({
  usuario_id = null,
  usuario_email = "anon",
  rol = "sin-rol",
  modulo = "core",
  accion = "desconocida",
  descripcion = "",
  datos_anteriores = null,
  datos_nuevos = null,
  ip = null,
  user_agent = null,
  duracion_ms = null,
  contexto = {},
}) {
  try {
    // 🧩 Desestructurar contexto relacional
    const {
      request_id = null,
      mantenimiento_id = null,
      inventario_id = null,
      auto = false,
    } = contexto || {};

    if (!accion || !modulo) {
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
    ];

    await db.query(query, values);

    logger.audit(
      {
        usuario_email,
        rol,
        modulo,
        accion,
        request_id,
        mantenimiento_id,
        inventario_id,
        auto,
      },
      `🧾 Auditoría registrada → ${modulo}.${accion}`
    );
  } catch (err) {
    // Nunca romper flujo principal
    logger.error(
      { err, modulo, accion, usuario_email },
      "❌ Error registrando auditoría en DB"
    );

    // Fallback: guardar en consola si falla DB
    try {
      console.error(
        "[AUDIT FALLBACK]",
        JSON.stringify({
          modulo,
          accion,
          usuario_email,
          descripcion,
        })
      );
    } catch {
      /* no-op */
    }
  }
}

module.exports = { logAction };
