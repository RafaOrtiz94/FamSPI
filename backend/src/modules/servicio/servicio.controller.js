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
// ✅ DISPONIBILIDAD DE TÉCNICOS
// ===============================================================

const ensureDisponibilidadTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.disponibilidad_tecnicos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
      name TEXT,
      status TEXT DEFAULT 'no_disponible',
      note TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
};

const mapDisponibilidadRow = (row) => ({
  user_id: row.user_id,
  userId: row.user_id,
  name:
    row.fullname ||
    row.name ||
    row.email,
  status: row.status,
  note: row.note,
  updatedAt: row.updated_at,
});

const getDisponibilidadTecnicos = async (req, res) => {
  try {
    await ensureDisponibilidadTable();
    const { rows } = await db.query(`
      SELECT
        d.user_id,
        d.status,
        d.note,
        d.updated_at,
        u.fullname,
        u.name,
        u.email
      FROM servicio.disponibilidad_tecnicos d
      LEFT JOIN public.users u ON u.id = d.user_id
      ORDER BY COALESCE(u.fullname, u.name, u.email, d.name) ASC;
    `);

    res.json({ ok: true, rows: rows.map(mapDisponibilidadRow) });
  } catch (err) {
    console.error("❌ Error listando disponibilidad de técnicos:", err);
    res.status(500).json({ ok: false, error: "Error al listar disponibilidad" });
  }
};

const updateDisponibilidadTecnico = async (req, res) => {
  try {
    await ensureDisponibilidadTable();

    const userId = req.user?.id;
    const status = String(req.body?.status || "no_disponible").toLowerCase();
    const note = req.body?.note || "";
    const name =
      req.user?.full_name ||
      req.user?.fullname ||
      req.user?.name ||
      req.user?.email ||
      req.user?.display_name;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "Usuario no identificado" });
    }

    const { rows } = await db.query(
      `INSERT INTO servicio.disponibilidad_tecnicos (user_id, name, status, note, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE
         SET status = EXCLUDED.status,
             note = EXCLUDED.note,
             name = EXCLUDED.name,
             updated_at = now()
       RETURNING *;`,
      [userId, name, status, note]
    );

    res.json({ ok: true, result: mapDisponibilidadRow(rows[0]) });
  } catch (err) {
    console.error("❌ Error actualizando disponibilidad:", err);
    res.status(500).json({ ok: false, error: "Error al actualizar disponibilidad" });
  }
};

// ===============================================================
// ⚙️ EQUIPOS
// ===============================================================
const mapEquipmentRow = (row) => ({
  id_equipo: row.id ?? row.id_equipo,
  code: row.code,
  nombre: row.name ?? row.nombre,
  fabricante: row.manufacturer ?? row.fabricante,
  modelo: row.model ?? row.modelo,
  categoria: row.category ?? row.categoria,
  category_type: row.category_type,
  descripcion: row.description ?? row.descripcion,
  estado: row.status ?? row.estado,
  ubicacion_actual: row.default_location ?? row.ubicacion_actual,
  capacity_per_hour: row.capacity_per_hour,
  max_daily_capacity: row.max_daily_capacity,
  base_price: row.base_price,
  maintenance_cost: row.maintenance_cost,
  technical_specs: row.technical_specs,
  default_calculation_formula: row.default_calculation_formula,
  metadata: row.metadata,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getEquipos = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM public.equipment_models ORDER BY name ASC;
    `);
    res.json(rows.map(mapEquipmentRow));
  } catch (err) {
    console.error("❌ Error al listar equipos:", err);
    res.status(500).json({ error: "Error al listar equipos" });
  }
};

const createEquipo = async (req, res) => {
  try {
    const {
      code,
      nombre,
      modelo,
      fabricante,
      categoria,
      description,
      descripcion,
      serie,
      ubicacion_actual,
      fecha_instalacion,
      estado,
      capacity_per_hour,
      max_daily_capacity,
      base_price,
    } = req.body;

    const metadata = {};
    if (serie) metadata.serie = serie;
    if (fecha_instalacion) metadata.fecha_instalacion = fecha_instalacion;
    if (categoria) metadata.categoria = categoria;

    const { rows } = await db.query(`
      INSERT INTO public.equipment_models
       (code, name, model, manufacturer, category, category_type, description, status, default_location,
        capacity_per_hour, max_daily_capacity, base_price, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *;
    `,
      [
        code ?? null,
        nombre,
        modelo,
        fabricante,
        categoria ?? null,
        req.body.category_type ?? null,
        description ?? descripcion ?? null,
        estado ?? "operativo",
        ubicacion_actual ?? null,
        capacity_per_hour ?? null,
        max_daily_capacity ?? null,
        base_price ?? null,
        Object.keys(metadata).length ? metadata : null,
      ]
    );
    res.status(201).json(mapEquipmentRow(rows[0]));
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
        e.name AS equipo_nombre,
        e.manufacturer AS fabricante,
        e.category AS categoria
      FROM servicio.cronograma_mantenimientos m
      JOIN public.equipment_models e ON e.id = m.id_equipo
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
        e.name AS equipo_nombre,
        e.manufacturer AS fabricante
      FROM servicio.cronograma_mantenimientos_anuales ma
      JOIN public.equipment_models e ON e.id = ma.id_equipo
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
  getDisponibilidadTecnicos,
  updateDisponibilidadTecnico,
  getEquipos,
  createEquipo,
  getMantenimientos,
  getMantenimientosAnuales,
  createMantenimientoAnual,
};
