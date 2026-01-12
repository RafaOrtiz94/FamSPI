/**
 * src/modules/departments/departments.controller.js
 * =====================================================
 * CRUD completo para departamentos
 * -----------------------------------------------------
 * ✅ Listar todos los departamentos
 * ✅ Obtener uno por ID
 * ✅ Crear nuevo departamento
 * ✅ Actualizar departamento existente
 * ✅ Eliminar departamento
 * =====================================================
 */

const db = require("../../config/db");

/* ======================================================
   1️⃣ Listar todos los departamentos
====================================================== */
const getDepartments = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, code, name, description, created_at, updated_at
       FROM departments
       ORDER BY id ASC`
    );
    res.status(200).json({ ok: true, total: rows.length, data: rows });
  } catch (err) {
    console.error("❌ Error al obtener departamentos:", err);
    res.status(500).json({ ok: false, message: "Error al obtener departamentos" });
  }
};

/* ======================================================
   2️⃣ Obtener un departamento por ID
====================================================== */
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT id, code, name, description, created_at, updated_at
       FROM departments
       WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Departamento no encontrado" });
    }

    res.status(200).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("❌ Error al obtener el departamento:", err);
    res.status(500).json({ ok: false, message: "Error al obtener el departamento" });
  }
};

/* ======================================================
   3️⃣ Crear un nuevo departamento
====================================================== */
const createDepartment = async (req, res) => {
  try {
    const { code, name, description } = req.body;

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
        message: "Ya existe un departamento con ese código o nombre",
      });
    }

    const { rows } = await db.query(
      `INSERT INTO departments (code, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [code, name, description || null]
    );

    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("❌ Error al crear el departamento:", err);
    res.status(500).json({ ok: false, message: "Error al crear el departamento" });
  }
};

/* ======================================================
   4️⃣ Actualizar un depart
   amento existente
====================================================== */
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description } = req.body;

    const { rows } = await db.query(
      `UPDATE departments
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [code, name, description, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Departamento no encontrado" });
    }

    res.status(200).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("❌ Error al actualizar el departamento:", err);
    res.status(500).json({ ok: false, message: "Error al actualizar el departamento" });
  }
};

/* ======================================================
   5️⃣ Eliminar un departamento
====================================================== */
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`DELETE FROM departments WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Departamento no encontrado" });
    }

    res.status(200).json({ ok: true, message: "Departamento eliminado correctamente" });
  } catch (err) {
    console.error("❌ Error al eliminar el departamento:", err);
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
