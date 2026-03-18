  // src/modules/users/users.controller.js
  const db = require("../../config/db");
  const logger = require("../../config/logger");

const ADMIN_VIEW_ROLES = new Set([
    "talento_humano",
    "jefe_talento_humano",
    "gerencia",
    "gerencia_general",
    "gerente_general",
    "director",
    "ti",
    "jefe_ti",
    "admin_ti",
    "admin",
    "administrador",
]);

const ALLOWED_USER_ROLES = new Set([
  "pendiente",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "director",
  "comercial",
  "asesor_comercial",
  "acp_comercial",
  "backoffice_comercial",
  "marketing",
  "jefe_comercial",
  "servicio_tecnico",
  "tecnico",
  "jefe_servicio_tecnico",
  "jefe_tecnico",
  "finanzas",
  "jefe_finanzas",
  "jefe_financiero",
  "talento_humano",
  "jefe_talento_humano",
  "ti",
  "jefe_ti",
  "admin_ti",
  "operaciones",
  "jefe_operaciones",
  "calidad",
  "jefe_calidad",
  "logistica",
  "jefe_logistica",
  "usuario",
  "admin",
  "administrador",
]);

const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
const normalizeText = (value, max = 255) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, max) : "";
};
const normalizeEmail = (value) => normalizeText(value, 320).toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const parseDepartmentId = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
};

const parseBoolean = (value) => {
  if (value === true || value === false) return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "si", "sí", "active", "activo"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "inactive", "inactivo"].includes(normalized)) return false;
  return null;
};

const collectRoles = (user = {}) => {
  const roles = new Set();
  [user.role, user.role_name, user.scope, user.rol].forEach((value) => {
    const normalized = normalizeRole(value);
    if (normalized) roles.add(normalized);
  });
  if (Array.isArray(user.roles)) user.roles.forEach((role) => roles.add(normalizeRole(role)));
  if (Array.isArray(user.scopes)) user.scopes.forEach((scope) => roles.add(normalizeRole(scope)));
  return roles;
};

const ensureDepartmentExists = async (departmentId, { requireActive = false } = {}) => {
  if (departmentId == null) return;
  const { rows } = await db.query(
    "SELECT id, COALESCE(status, 'active') AS status FROM departments WHERE id = $1 LIMIT 1",
    [departmentId]
  );
  if (!rows[0]) {
    const error = new Error("Departamento no encontrado");
    error.status = 400;
    throw error;
  }
  if (requireActive && String(rows[0].status || "active").toLowerCase() !== "active") {
    const error = new Error("El departamento seleccionado está inactivo");
    error.status = 400;
    throw error;
  }
};

const ensureUniqueUserIdentity = async ({ email, googleId, excludeId = null }) => {
  const checks = [];
  const values = [];

  if (email) {
    values.push(email);
    checks.push(`LOWER(email) = LOWER($${values.length})`);
  }

  if (googleId) {
    values.push(googleId);
    checks.push(`google_id = $${values.length}`);
  }

  if (!checks.length) return;

  let query = `SELECT id FROM users WHERE (${checks.join(" OR ")})`;
  if (excludeId != null) {
    values.push(excludeId);
    query += ` AND id <> $${values.length}`;
  }
  query += " LIMIT 1";

  const { rows } = await db.query(query, values);
  if (rows[0]) {
    const error = new Error("Ya existe un usuario con el mismo correo o Google ID");
    error.status = 409;
    throw error;
  }
};

  /**
   *  Obtener todos los usuarios (con nombre del departamento si existe)
   */
const getUsers = async (req, res) => {
  try {
    const requesterRoles = collectRoles(req.user);
    const canSeeFullUsers = Array.from(requesterRoles).some((role) => ADMIN_VIEW_ROLES.has(role));
    const search = normalizeText(req.query?.search || "", 120).toLowerCase();
    const roleFilter = normalizeRole(req.query?.role);
    const departmentId = parseDepartmentId(req.query?.department_id);
    const activeFilter = parseBoolean(req.query?.active);

    if (Number.isNaN(departmentId)) {
      return res.status(400).json({ ok: false, message: "Departamento inválido" });
    }

    const selectClause = canSeeFullUsers
      ? `u.id, u.google_id, u.email, COALESCE(NULLIF(u.fullname, ''), CONCAT('Usuario #', u.id)) AS fullname, u.role, u.active, u.department_id, u.created_at, u.updated_at, d.name AS department_name`
      : `u.id, u.email, COALESCE(NULLIF(u.fullname, ''), CONCAT('Usuario #', u.id)) AS fullname, u.role, u.active, d.name AS department_name`;
    const filters = [];
    const values = [];

    if (search) {
      values.push(`%${search}%`);
      filters.push(`(
        LOWER(COALESCE(u.fullname, '')) LIKE $${values.length}
        OR LOWER(COALESCE(u.email, '')) LIKE $${values.length}
        OR LOWER(COALESCE(u.role, '')) LIKE $${values.length}
      )`);
    }

    if (roleFilter) {
      values.push(roleFilter);
      filters.push(`LOWER(COALESCE(u.role, '')) = $${values.length}`);
    }

    if (departmentId != null) {
      values.push(departmentId);
      filters.push(`u.department_id = $${values.length}`);
    }

    if (activeFilter !== null) {
      values.push(activeFilter);
      filters.push(`COALESCE(u.active, true) = $${values.length}`);
    } else if (!canSeeFullUsers) {
      filters.push("COALESCE(u.active, true) = true");
    }

    const { rows } = await db.query(`
      SELECT ${selectClause}
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY fullname ASC
    `, values);

    return res.status(200).json({
      ok: true,
      count: rows.length,
      data: rows
    });

  } catch (err) {
    logger.error({ err }, "Error obteniendo usuarios");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo usuarios"
    });
  }
};

  /**
   *  Obtener un usuario por ID
   */
  const getUserById = async (req, res) => {
    try {
      const { id } = req.params;
      const { rows } = await db.query(
        `
        SELECT 
          u.id,
          u.google_id,
          u.email,
          u.fullname,
          u.role,
          u.active,
          u.department_id,
          d.name AS department_name,
          u.created_at,
          u.updated_at
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = $1
        `,
        [id]
      );

      if (rows.length === 0)
        return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

      res.status(200).json({ ok: true, data: rows[0] });
    } catch (err) {
      logger.error({ err }, "Error obteniendo usuario");
      res.status(500).json({ ok: false, message: "Error obteniendo usuario" });
    }
  };

  /**
   *  Crear un nuevo usuario manualmente (raro, pero útil para pruebas o admin)
   */
const createUser = async (req, res) => {
  try {
    const googleId = normalizeText(req.body?.google_id, 255) || null;
    const email = normalizeEmail(req.body?.email);
    const fullname = normalizeText(req.body?.fullname);
    const role = normalizeRole(req.body?.role || "pendiente");
    const departmentId = parseDepartmentId(req.body?.department_id);
    const active = req.body?.active !== undefined ? parseBoolean(req.body.active) : true;

    if (!fullname || !email) {
      return res.status(400).json({ ok: false, message: "Nombre y correo son obligatorios" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, message: "Correo electrónico inválido" });
    }

    if (!ALLOWED_USER_ROLES.has(role)) {
      return res.status(400).json({ ok: false, message: "Rol inválido" });
    }

    if (Number.isNaN(departmentId)) {
      return res.status(400).json({ ok: false, message: "Departamento inválido" });
    }

    if (active === null) {
      return res.status(400).json({ ok: false, message: "Estado activo/inactivo inválido" });
    }

    await ensureDepartmentExists(departmentId, { requireActive: true });
    await ensureUniqueUserIdentity({ email, googleId });

      const { rows } = await db.query(
        `
        INSERT INTO users (google_id, email, fullname, role, department_id, active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
        `,
        [googleId, email, fullname, role || "pendiente", departmentId, active]
      );

      res.status(201).json({ ok: true, data: rows[0] });
    } catch (err) {
      logger.error({ err }, "Error creando usuario");
      res.status(err.status || 500).json({ ok: false, message: err.message || "Error creando usuario" });
    }
  };

  /**
   *  Actualizar rol o departamento de un usuario
   */
  const updateUser = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = Number(id);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ ok: false, message: "ID de usuario inválido" });
      }

      const role = req.body?.role !== undefined ? normalizeRole(req.body.role) : undefined;
      const departmentId = req.body?.department_id !== undefined ? parseDepartmentId(req.body.department_id) : undefined;
      const fullname = req.body?.fullname !== undefined ? normalizeText(req.body.fullname) : undefined;
      const email = req.body?.email !== undefined ? normalizeEmail(req.body.email) : undefined;
      const googleId = req.body?.google_id !== undefined ? (normalizeText(req.body.google_id, 255) || null) : undefined;
      const active = req.body?.active !== undefined ? parseBoolean(req.body.active) : undefined;

      if (email !== undefined && !isValidEmail(email)) {
        return res.status(400).json({ ok: false, message: "Correo electrónico inválido" });
      }

      if (role !== undefined && !ALLOWED_USER_ROLES.has(role)) {
        return res.status(400).json({ ok: false, message: "Rol inválido" });
      }

      if (departmentId !== undefined && Number.isNaN(departmentId)) {
        return res.status(400).json({ ok: false, message: "Departamento inválido" });
      }

      if (active === null) {
        return res.status(400).json({ ok: false, message: "Estado activo/inactivo inválido" });
      }

      await ensureDepartmentExists(departmentId, { requireActive: true });
      await ensureUniqueUserIdentity({ email, googleId, excludeId: userId });

      const { rows } = await db.query(
        `
        UPDATE users
        SET 
          role = COALESCE($1, role),
          department_id = COALESCE($2, department_id),
          fullname = COALESCE($3, fullname),
          email = COALESCE($4, email),
          google_id = COALESCE($5, google_id),
          active = COALESCE($6, active),
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
        `,
        [role, departmentId, fullname, email, googleId, active, userId]
      );

      if (rows.length === 0)
        return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

      res.status(200).json({ ok: true, data: rows[0] });
    } catch (err) {
      logger.error({ err }, "Error actualizando usuario");
      res.status(err.status || 500).json({ ok: false, message: err.message || "Error actualizando usuario" });
    }
  };

  /**
   *  Limpieza en cascada antes de eliminar un usuario.
   * Borra/actualiza cualquier relación que apunte al usuario para
   * evitar errores de FK y mantener la integridad en la BD.
   */
  const deleteUser = async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (Number.isNaN(userId)) {
      return res
        .status(400)
          .json({ ok: false, message: "ID de usuario invalido para desactivacion" });
    }

    const client = await db.getClient();

    try {
      await client.query("BEGIN");

      const existingUser = await client.query(
        `SELECT id, email, COALESCE(active, true) AS active FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      );

      if (existingUser.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ ok: false, message: "Usuario no encontrado" });
      }

      if (existingUser.rows[0].active === false) {
        await client.query("COMMIT");
        return res.status(200).json({
          ok: true,
          message: "El usuario ya se encontraba inactivo",
          data: { id: userId, active: false },
        });
      }

      const { rows } = await client.query(
        `
        UPDATE users
           SET active = false,
               updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, active, updated_at
        `,
        [userId]
      );

      await client.query("COMMIT");
      res.status(200).json({
        ok: true,
        message: "Usuario desactivado correctamente",
        data: rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error({ err }, "Error desactivando usuario");
      res.status(500).json({ ok: false, message: "Error desactivando usuario" });
    } finally {
      client.release();
    }
  };

  module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
  };


