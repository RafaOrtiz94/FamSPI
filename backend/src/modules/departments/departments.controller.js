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

const ensureDepartmentSchema = async () => {
  await db.query(`
    ALTER TABLE departments
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
  `);
  await db.query(`
    UPDATE departments
       SET status = 'active'
     WHERE status IS NULL OR trim(status) = '';
  `);
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'departments_status_check'
      ) THEN
        ALTER TABLE departments
          ADD CONSTRAINT departments_status_check
          CHECK (status IN ('active', 'inactive'));
      END IF;
    END $$;
  `);
};

const normalizeDepartmentStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["inactive", "inactivo", "disabled", "false", "0"].includes(normalized)) {
    return "inactive";
  }
  return "active";
};

/* ======================================================
   1. Listar todos los departamentos
====================================================== */
const getDepartments = async (req, res) => {
  try {
    await ensureDepartmentSchema();
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
    await ensureDepartmentSchema();
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
    await ensureDepartmentSchema();
    const { code, name, description } = req.body;
    const status = normalizeDepartmentStatus(req.body?.status || req.body?.active);

    if (!code || !name) {
      return res.status(400).json({
        ok: false,
        message: "Los campos 'code' y 'name' son obligatorios",
      });
    }

    const existing = await db.query(
      `SELECT id FROM departments WHERE code = $1 OR name = $2`,
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
      [code, name, description || null, status]
    );

    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("Error al crear el departamento:", err);
    res.status(500).json({ ok: false, message: "Error al crear el departamento" });
  }
};

/* ======================================================
   4. Actualizar un depart
   amento existente
====================================================== */
const updateDepartment = async (req, res) => {
  try {
    await ensureDepartmentSchema();
    const { id } = req.params;
    const { code, name, description } = req.body;
    const status = req.body?.status !== undefined
      ? normalizeDepartmentStatus(req.body.status)
      : req.body?.active !== undefined
        ? normalizeDepartmentStatus(req.body.active)
        : undefined;

    const { rows } = await db.query(
      `UPDATE departments
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           status = COALESCE($4, status),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [code, name, description, status, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Departamento no encontrado" });
    }

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
    await ensureDepartmentSchema();
    const { id } = req.params;
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
};

