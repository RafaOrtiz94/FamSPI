const Joi = require('joi');
const db = require('../../config/db');
const logger = require('../../config/logger');
const { uploadFileToDrive } = require('../../utils/drive');
const { logAction } = require('../../utils/audit');
const { sendApprovalEmail } = require('../../utils/mailer'); // reuse to notify gerencia

const employeeSchema = Joi.object({
  nombre: Joi.string().required(),
  cedula: Joi.string().required(),
  cargo: Joi.string().required(),
  fecha_ingreso: Joi.date().required(),
  estado: Joi.string().valid('activo','inactivo').default('activo')
});

async function createEmployee(req, res) {
  try {
    const { error, value } = employeeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const insert = await db.query(
      `INSERT INTO employees (nombre, cedula, cargo, fecha_ingreso, estado) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [value.nombre, value.cedula, value.cargo, value.fecha_ingreso, value.estado]
    );
    const emp = insert.rows[0];
    await logAction(req.user.id, 'create_employee', { employee_id: emp.id });

    // notify gerencia by email (find emails of role 'gerencia')
    const ger = (await db.query('SELECT email FROM users WHERE role=$1', ['gerencia'])).rows;
    for (const g of ger) {
      try { await sendApprovalEmail(g.email, 'Nuevo ingreso', `<p>Se creó un empleado nuevo: ${emp.nombre}</p>`); } catch (e) { logger.warn('notify gerencia failed %o', e); }
    }

    res.status(201).json(emp);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Could not create employee' });
  }
}

async function listEmployees(req, res) {
  try {
    const rows = (await db.query('SELECT * FROM employees ORDER BY created_at DESC')).rows;
    res.json(rows);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Error listing employees' });
  }
}

async function updateEmployee(req, res) {
  const id = parseInt(req.params.id);
  try {
    const { error, value } = employeeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const upd = await db.query(
      `UPDATE employees SET nombre=$1, cedula=$2, cargo=$3, fecha_ingreso=$4, estado=$5, updated_at=now() WHERE id=$6 RETURNING *`,
      [value.nombre, value.cedula, value.cargo, value.fecha_ingreso, value.estado, id]
    );
    await logAction(req.user.id, 'update_employee', { employee_id: id });
    res.json(upd.rows[0]);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Error updating' });
  }
}

async function uploadDocument(req, res) {
  const id = parseInt(req.params.id);
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'file missing' });

  try {
    const driveRes = await uploadFileToDrive(file, `employees/${id}/${file.originalname}`);
    // save relationship (could be a table employee_documents, simplified: audit)
    await logAction(req.user.id, 'upload_employee_document', { employee_id: id, drive_file_id: driveRes.id });
    res.json({ message: 'Uploaded', drive_file_id: driveRes.id });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
}

module.exports = { createEmployee, listEmployees, updateEmployee, uploadDocument };
