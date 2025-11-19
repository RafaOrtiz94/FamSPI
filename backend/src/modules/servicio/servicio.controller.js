const db = require("../../config/db");
const { google } = require("googleapis");
const { Readable } = require("stream");

// ===============================================================
// 🔐 CONFIGURACIÓN GOOGLE DRIVE / DOCS
// ===============================================================
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GSA_KEY_PATH,
  scopes: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
  ],
});
const drive = google.drive({ version: "v3", auth });
const docs = google.docs({ version: "v1", auth });

// ===============================================================
// 🧠 CAPACITACIONES
// ===============================================================
const getCapacitaciones = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM servicio.cronograma_capacitacion
      ORDER BY fecha DESC;
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error al listar capacitaciones:", err);
    res.status(500).json({ error: "Error al listar capacitaciones" });
  }
};

const createCapacitacion = async (req, res) => {
  try {
    const {
      titulo,
      descripcion,
      instructor,
      modalidad,
      fecha,
      hora_inicio,
      hora_fin,
      ubicacion,
    } = req.body;

    const { rows } = await db.query(
      `INSERT INTO servicio.cronograma_capacitacion 
       (titulo, descripcion, instructor, modalidad, fecha, hora_inicio, hora_fin, ubicacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;`,
      [titulo, descripcion, instructor, modalidad, fecha, hora_inicio, hora_fin, ubicacion]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Error creando capacitación:", err);
    res.status(500).json({ error: "Error al crear capacitación" });
  }
};

const updateCapacitacion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titulo,
      descripcion,
      instructor,
      modalidad,
      fecha,
      hora_inicio,
      hora_fin,
      ubicacion,
      estado,
    } = req.body;

    const { rows } = await db.query(
      `UPDATE servicio.cronograma_capacitacion
       SET titulo=$1, descripcion=$2, instructor=$3, modalidad=$4, fecha=$5,
           hora_inicio=$6, hora_fin=$7, ubicacion=$8, estado=$9, updated_at=now()
       WHERE id_capacitacion=$10 RETURNING *;`,
      [titulo, descripcion, instructor, modalidad, fecha, hora_inicio, hora_fin, ubicacion, estado, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Capacitación no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error actualizando capacitación:", err);
    res.status(500).json({ error: "Error al actualizar capacitación" });
  }
};

const deleteCapacitacion = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM servicio.cronograma_capacitacion WHERE id_capacitacion=$1;`, [id]);
    res.json({ message: "Capacitación eliminada correctamente" });
  } catch (err) {
    console.error("❌ Error eliminando capacitación:", err);
    res.status(500).json({ error: "Error al eliminar capacitación" });
  }
};

// ===============================================================
// ⚙️ EQUIPOS
// ===============================================================
const getEquipos = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM servicio.equipos ORDER BY nombre ASC;
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error al listar equipos:", err);
    res.status(500).json({ error: "Error al listar equipos" });
  }
};

const createEquipo = async (req, res) => {
  try {
    const {
      nombre,
      modelo,
      fabricante,
      categoria,
      descripcion,
      serie,
      ubicacion_actual,
      fecha_instalacion,
      estado,
    } = req.body;

    const { rows } = await db.query(
      `INSERT INTO servicio.equipos 
       (nombre, modelo, fabricante, categoria, descripcion, serie, ubicacion_actual, fecha_instalacion, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *;`,
      [nombre, modelo, fabricante, categoria, descripcion, serie, ubicacion_actual, fecha_instalacion, estado]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Error creando equipo:", err);
    res.status(500).json({ error: "Error al crear equipo" });
  }
};

// ===============================================================
// 🛠️ MANTENIMIENTOS
// ===============================================================
const getMantenimientos = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        m.*, 
        e.nombre AS equipo_nombre,
        e.fabricante,
        e.categoria
      FROM servicio.cronograma_mantenimientos m
      JOIN servicio.equipos e ON e.id_equipo = m.id_equipo
      ORDER BY fecha_programada DESC;
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error listando mantenimientos:", err);
    res.status(500).json({ error: "Error al listar mantenimientos" });
  }
};

// ===============================================================
// 📅 MANTENIMIENTOS ANUALES
// ===============================================================
const getMantenimientosAnuales = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        ma.*, 
        e.nombre AS equipo_nombre,
        e.fabricante
      FROM servicio.cronograma_mantenimientos_anuales ma
      JOIN servicio.equipos e ON e.id_equipo = ma.id_equipo
      ORDER BY fecha_programada;
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error listando mantenimientos anuales:", err);
    res.status(500).json({ error: "Error al listar mantenimientos anuales" });
  }
};

const createMantenimientoAnual = async (req, res) => {
  try {
    const { id_equipo, mes, responsable, fecha_programada, estado, comentarios } = req.body;
    const { rows } = await db.query(
      `INSERT INTO servicio.cronograma_mantenimientos_anuales
       (id_equipo, mes, responsable, fecha_programada, estado, comentarios)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *;`,
      [id_equipo, mes, responsable, fecha_programada, estado, comentarios]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Error creando mantenimiento anual:", err);
    res.status(500).json({ error: "Error al crear mantenimiento anual" });
  }
};

// ===============================================================
// ✅ EXPORTS
// ===============================================================
module.exports = {
  getCapacitaciones,
  createCapacitacion,
  updateCapacitacion,
  deleteCapacitacion,
  getEquipos,
  createEquipo,
  getMantenimientos,
  getMantenimientosAnuales,
  createMantenimientoAnual,
};
