// src/modules/users/users.controller.js
const db = require("../../config/db");
const logger = require("../../config/logger");

/**
 * 🧩 Obtener todos los usuarios (con nombre del departamento si existe)
 */
const getUsers = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        u.id,
        u.google_id,
        u.email,
        u.fullname,
        u.role,
        u.department_id,
        u.created_at,
        u.updated_at,
        d.name AS department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.created_at DESC
    `);
    res.status(200).json({ ok: true, data: rows });
  } catch (err) {
    logger.error({ err }, "❌ Error obteniendo usuarios");
    res.status(500).json({ ok: false, message: "Error obteniendo usuarios" });
  }
};

/**
 * 🧾 Obtener un usuario por ID
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
    logger.error({ err }, "❌ Error obteniendo usuario");
    res.status(500).json({ ok: false, message: "Error obteniendo usuario" });
  }
};

/**
 * ➕ Crear un nuevo usuario manualmente (raro, pero útil para pruebas o admin)
 */
const createUser = async (req, res) => {
  try {
    const { google_id, email, fullname, role, department_id } = req.body;

    const { rows } = await db.query(
      `
      INSERT INTO users (google_id, email, fullname, role, department_id, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
      `,
      [google_id, email, fullname, role || "pendiente", department_id || null]
    );

    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    logger.error({ err }, "❌ Error creando usuario");
    res.status(500).json({ ok: false, message: "Error creando usuario" });
  }
};

/**
 * ✏️ Actualizar rol o departamento de un usuario
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, department_id, fullname, email, google_id } = req.body;

    const { rows } = await db.query(
      `
      UPDATE users
      SET 
        role = COALESCE($1, role),
        department_id = COALESCE($2, department_id),
        fullname = COALESCE($3, fullname),
        email = COALESCE($4, email),
        google_id = COALESCE($5, google_id),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [role, department_id, fullname, email, google_id, id]
    );

    if (rows.length === 0)
      return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    res.status(200).json({ ok: true, data: rows[0] });
  } catch (err) {
    logger.error({ err }, "❌ Error actualizando usuario");
    res.status(500).json({ ok: false, message: "Error actualizando usuario" });
  }
};

/**
 * 🧹 Limpieza en cascada antes de eliminar un usuario.
 * Borra/actualiza cualquier relación que apunte al usuario para
 * evitar errores de FK y mantener la integridad en la BD.
 */
const cascadeUserCleanup = async (client, userId) => {
  const summary = {
    requestsDeleted: 0,
    requestApprovalsDeleted: 0,
    requestVersionsDeleted: 0,
    requestAttachmentsDeleted: 0,
    approvalsCleared: 0,
    attachmentsCleared: 0,
    historyCleared: 0,
    signaturesDeleted: 0,
    inventoryMovementsCleared: 0,
  };

  const { rows: requestRows } = await client.query(
    "SELECT id FROM requests WHERE requester_id = $1",
    [userId]
  );
  const requestIds = requestRows.map(({ id }) => Number(id)).filter(Boolean);

  if (requestIds.length > 0) {
    const idsParam = [requestIds];
    const deletedAttachments = await client.query(
      "DELETE FROM request_attachments WHERE request_id = ANY($1::int[])",
      idsParam
    );
    summary.requestAttachmentsDeleted = deletedAttachments.rowCount;

    const deletedVersions = await client.query(
      "DELETE FROM request_versions WHERE request_id = ANY($1::int[])",
      idsParam
    );
    summary.requestVersionsDeleted = deletedVersions.rowCount;

    const deletedApprovals = await client.query(
      "DELETE FROM request_approvals WHERE request_id = ANY($1::int[])",
      idsParam
    );
    summary.requestApprovalsDeleted = deletedApprovals.rowCount;

    const deletedRequests = await client.query(
      "DELETE FROM requests WHERE id = ANY($1::int[])",
      idsParam
    );
    summary.requestsDeleted = deletedRequests.rowCount;
  }

  const deletedSignatures = await client.query(
    "DELETE FROM document_signatures WHERE signer_user_id = $1",
    [userId]
  );
  summary.signaturesDeleted = deletedSignatures.rowCount;

  const clearedApprovals = await client.query(
    "UPDATE request_approvals SET approver_id = NULL WHERE approver_id = $1",
    [userId]
  );
  summary.approvalsCleared = clearedApprovals.rowCount;

  const clearedAttachments = await client.query(
    "UPDATE request_attachments SET uploaded_by = NULL WHERE uploaded_by = $1",
    [userId]
  );
  summary.attachmentsCleared = clearedAttachments.rowCount;

  const clearedHistory = await client.query(
    "UPDATE request_status_history SET changed_by = NULL WHERE changed_by = $1",
    [userId]
  );
  summary.historyCleared = clearedHistory.rowCount;

  const clearedInventory = await client.query(
    "UPDATE inventory_movements SET created_by = NULL WHERE created_by = $1",
    [userId]
  );
  summary.inventoryMovementsCleared = clearedInventory.rowCount;

  return summary;
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id, 10);

  if (Number.isNaN(userId)) {
    return res
      .status(400)
      .json({ ok: false, message: "ID de usuario inválido para eliminación" });
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query(
      `SELECT id, email FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (existingUser.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    const cleanupSummary = await cascadeUserCleanup(client, userId);

    const { rowCount } = await client.query(
      `DELETE FROM users WHERE id = $1`,
      [userId]
    );

    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    await client.query("COMMIT");
    res.status(200).json({
      ok: true,
      message: "Usuario eliminado correctamente",
      meta: cleanupSummary,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "❌ Error eliminando usuario");
    res.status(500).json({ ok: false, message: "Error eliminando usuario" });
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
