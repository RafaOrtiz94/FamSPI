/**
 * src/modules/departments/departments.controller.js
 * =====================================================
 * CRUD completo para departamentos
 * -----------------------------------------------------
 * Listar todos los departamentos
 * Obtener uno por ID
 * Crear nuevo departamento
 * Actualizar departamento existente
 * Eliminar departamento
 * =====================================================
 */

const db = require("../../config/db");

const normalizeDepartmentStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["inactive", "inactivo", "disabled", "false", "0"].includes(normalized)) {
    return "inactive";
  }
  return "active";
};

const normalizeText = (value, max = 255) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, max) : "";
};

/* ======================================================
   1. Listar todos los departamentos
====================================================== */
const getDepartments = async (req, res) => {
  try {
    const includeInactive = String(req.query?.include_inactive || "").toLowerCase() === "true";
    const { rows } = await db.query(
      `SELECT id, code, name, description, status, (status = 'active') AS active, created_at, updated_at
       FROM departments
       ${includeInactive ? "" : "WHERE status = 'active'"}
       ORDER BY status = 'active' DESC, name ASC`
    );
    res.status(200).json({ ok: true, total: rows.length, data: rows });
  } catch (err) {
    console.error("Error al obtener departamentos:", err);
    res.status(500).json({ ok: false, message: "Error al obtener departamentos" });
  }
};

/* ======================================================
   2. Obtener un departamento por ID
====================================================== */
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT id, code, name, description, status, (status = 'active') AS active, created_at, updated_at
       FROM departments
       WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Departamento no encontrado" });
    }

    res.status(200).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("Error al obtener el departamento:", err);
    res.status(500).json({ ok: false, message: "Error al obtener el departamento" });
  }
};

/* ======================================================
   3. Crear un nuevo departamento
====================================================== */
const createDepartment = async (req, res) => {
  try {
    const code = normalizeText(req.body?.code, 50).toUpperCase();
    const name = normalizeText(req.body?.name);
    const description = normalizeText(req.body?.description, 500) || null;
    const status = normalizeDepartmentStatus(req.body?.status || req.body?.active);

    if (!code || !name) {
      return res.status(400).json({
        ok: false,
        message: "Los campos 'code' y 'name' son obligatorios",
      });
    }

    const existing = await db.query(
      `SELECT id FROM departments WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($2)`,
      [code, name]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "Ya existe un departamento con ese codigo o nombre",
      });
    }

    const { rows } = await db.query(
      `INSERT INTO departments (code, name, description, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [code, name, description, status]
    );

    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("Error al crear el departamento:", err);
    res.status(500).json({ ok: false, message: "Error al crear el departamento" });
  }
};

/* ======================================================
   4. Actualizar un departamento existente
====================================================== */
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const code = req.body?.code !== undefined ? normalizeText(req.body.code, 50).toUpperCase() : undefined;
    const name = req.body?.name !== undefined ? normalizeText(req.body.name) : undefined;
    const description = req.body?.description !== undefined ? (normalizeText(req.body.description, 500) || null) : undefined;
    const status = req.body?.status !== undefined
      ? normalizeDepartmentStatus(req.body.status)
      : req.body?.active !== undefined
        ? normalizeDepartmentStatus(req.body.active)
        : undefined;

    // Revalidar unicidad de code/name si se están cambiando
    if (code !== undefined || name !== undefined) {
      const uniquenessChecks = [];
      const uniquenessValues = [];
      
      if (code !== undefined) {
        uniquenessValues.push(code);
        uniquenessChecks.push(`(LOWER(code) = LOWER($${uniquenessValues.length}) AND id <> $${uniquenessValues.length + 1})`);
      }
      if (name !== undefined) {
        uniquenessValues.push(name);
        uniquenessChecks.push(`(LOWER(name) = LOWER($${uniquenessValues.length}) AND id <> $${uniquenessValues.length + 1})`);
      }
      
      uniquenessValues.push(id);
      const whereClause = uniquenessChecks.join(" OR ");
      
      const existing = await db.query(
        `SELECT id FROM departments WHERE ${whereClause}`,
        uniquenessValues
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({
          ok: false,
          message: "Ya existe otro departamento con ese codigo o nombre",
        });
      }
    }

    const previousResult = await db.query(
      `SELECT id, code, name, description, status
         FROM departments
        WHERE id = $1
        LIMIT 1`,
      [id]
    );

    if (previousResult.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Departamento no encontrado" });
    }

    // Construir SET dinámicamente para permitir limpiar campos nullable
    const sets = [];
    const values = [];
    let paramIndex = 1;

    if (code !== undefined) {
      sets.push(`code = $${paramIndex++}`);
      values.push(code);
    }
    if (name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      sets.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (status !== undefined) {
      sets.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (sets.length === 0) {
      return res.status(400).json({ ok: false, message: "No hay campos para actualizar" });
    }

    sets.push("updated_at = NOW()");
    values.push(id);

    const { rows } = await db.query(
      `UPDATE departments
       SET ${sets.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    res.status(200).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("Error al actualizar el departamento:", err);
    res.status(500).json({ ok: false, message: "Error al actualizar el departamento" });
  }
};

/* ======================================================
   5. Eliminar un departamento
====================================================== */
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const previousResult = await db.query(
      `SELECT id, code, name, description, status
         FROM departments
        WHERE id = $1
        LIMIT 1`,
      [id]
    );

    const result = await db.query(
      `UPDATE departments
          SET status = 'inactive',
              updated_at = NOW()
        WHERE id = $1
        RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Departamento no encontrado" });
    }

    res.status(200).json({ ok: true, message: "Departamento desactivado correctamente" });
  } catch (err) {
    console.error("Error al eliminar el departamento:", err);
    res.status(500).json({ ok: false, message: "Error al eliminar el departamento" });
  }
};

/* ======================================================
   Exportar controladores
====================================================== */
module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  normalizeDepartmentStatus,
};