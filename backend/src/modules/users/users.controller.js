// src/modules/users/users.controller.js
   const db = require("../../config/db");
   const logger = require("../../config/logger");
   const { isPassiveEmploymentStatus } = require("../shared/profileSync");
   const { findExistingUserByIdentity } = require("../../utils/userIdentity");

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
  "responsable_tecnico",
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

const getActorContext = (req) => {
  const roles = Array.from(collectRoles(req.user || {}));
  return {
    usuario_id: req.user?.id || null,
    usuario_email: req.user?.email || req.user?.correo || "anon",
    rol: roles[0] || "sin-rol",
  };
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
    const forSigners = req.query?.for_signers === "true" || req.query?.for_signers === "1";

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
    } else if (!canSeeFullUsers || forSigners) {
      filters.push("COALESCE(u.active, true) = true");
    }

    // for_signers: excluir colaboradores en proceso de desvinculacion o con estatus pasivo
    const joins = ["LEFT JOIN departments d ON u.department_id = d.id"];
    if (forSigners) {
      joins.push("LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id");
      joins.push(`LEFT JOIN offboarding_processes op ON op.user_id = u.id`);
      const PASSIVE = ["pasivo", "desvinculado", "inactivo", "en_desvinculacion"];
      values.push(PASSIVE);
      filters.push(
        `LOWER(TRIM(COALESCE(cp.profile->'laboral'->>'estatus_empleado', 'activo'))) <> ALL($${values.length}::text[])`
      );
      filters.push("COALESCE(op.is_closed, false) = false");
      filters.push(
        "LOWER(TRIM(COALESCE(cp.profile->'onboarding'->>'offboarding_requested', 'false'))) NOT IN ('true', '1', 'yes', 'si', 'sí')"
      );
    }

    const { rows } = await db.query(`
      SELECT ${selectClause}
      FROM users u
      ${joins.join(" ")}
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

    // Alta manual (ej. TI pre-provisionando una cuenta corporativa antes del
    // primer dia): ensureUniqueUserIdentity solo cubre email/google_id, que
    // nunca coinciden con una cuenta creada antes por otro flujo (ej. hire
    // con email placeholder). Se bloquea por nombre para que TI decida a
    // mano si es la misma persona en vez de duplicar.
    const existingByIdentity = await findExistingUserByIdentity(db, { fullname });
    if (existingByIdentity) {
      return res.status(409).json({
        ok: false,
        message: `Ya existe un usuario con el mismo nombre: "${existingByIdentity.fullname}" (id ${existingByIdentity.id}, ${existingByIdentity.email}). Si es la misma persona, edita esa cuenta en vez de crear una nueva.`,
      });
    }

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

      const previousResult = await db.query(
        `SELECT id, email, fullname, role, department_id, active, 
                cp.profile->'laboral'->>'estatus_empleado' AS estatus_empleado
           FROM users u
           LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
          WHERE u.id = $1
          LIMIT 1`,
        [userId]
      );

      const prevEmploymentStatus = String(previousResult.rows[0]?.estatus_empleado || "").trim().toLowerCase();
      const prevActive = previousResult.rows[0]?.active !== false;

      const sets = [];
      const values = [];
      let paramIndex = 1;

      if (role !== undefined) {
        sets.push(`role = $${paramIndex++}`);
        values.push(role);
      }
      if (departmentId !== undefined) {
        sets.push(`department_id = $${paramIndex++}`);
        values.push(departmentId);
      }
      if (fullname !== undefined) {
        sets.push(`fullname = $${paramIndex++}`);
        values.push(fullname);
      }
      if (email !== undefined) {
        sets.push(`email = $${paramIndex++}`);
        values.push(email);
      }
      if (googleId !== undefined) {
        sets.push(`google_id = $${paramIndex++}`);
        values.push(googleId);
      }
      if (active !== undefined) {
        sets.push(`active = $${paramIndex++}`);
        values.push(active);
      }

      if (sets.length === 0) {
        return res.status(400).json({ ok: false, message: "No hay campos para actualizar" });
      }

      sets.push("updated_at = NOW()");
      values.push(userId);

      const { rows } = await db.query(
        `UPDATE users SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (rows.length === 0)
        return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

      const updatedUser = rows[0];
      const newActive = active !== undefined ? active : prevActive;

      if (active !== undefined && !newActive && !isPassiveEmploymentStatus(prevEmploymentStatus)) {
        await db.query(
          `UPDATE collaborator_profiles 
           SET profile = jsonb_set(
             COALESCE(profile, '{}'::jsonb),
             ARRAY['laboral', 'estatus_empleado'],
             to_jsonb('inactivo'::text),
             true
           ),
           updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );
      } else if (active !== undefined && newActive && isPassiveEmploymentStatus(prevEmploymentStatus)) {
        await db.query(
          `UPDATE collaborator_profiles 
           SET profile = jsonb_set(
             COALESCE(profile, '{}'::jsonb),
             ARRAY['laboral', 'estatus_empleado'],
             to_jsonb('activo'::text),
             true
           ),
           updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );
      }

      res.status(200).json({ ok: true, data: updatedUser });
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
        `SELECT id, email, role, COALESCE(active, true) AS active FROM users WHERE id = $1 LIMIT 1`,
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

      // Verificar si es el último admin activo
      const userRole = normalizeRole(existingUser.rows[0].role);
      const adminRoles = ["admin", "administrador", "ti", "jefe_ti", "admin_ti"];
      if (adminRoles.includes(userRole)) {
        const activeAdminsResult = await client.query(
          `SELECT COUNT(*) AS count FROM users WHERE LOWER(COALESCE(role, '')) = ANY($1) AND COALESCE(active, true) = true`,
          [adminRoles.map((r) => r.toLowerCase())]
        );
        const activeAdminsCount = parseInt(activeAdminsResult.rows[0].count, 10);
        if (activeAdminsCount <= 1) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            ok: false,
            message: "No se puede desactivar el último administrador activo del sistema",
          });
        }
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
    // Helpers puros expuestos para pruebas de verificacion.
    normalizeRole,
    normalizeText,
    normalizeEmail,
    isValidEmail,
    parseBoolean,
  };

