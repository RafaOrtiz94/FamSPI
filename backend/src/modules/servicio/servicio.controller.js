const db = require("../../config/db");
const logger = require("../../config/logger");
const { google } = require("googleapis");
const { Readable } = require("stream");
const { generatePDF } = require("./desinfeccion.service");
const { resolveExternalDriveIntegrity } = require("../../utils/documentHash");

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
const WORKFLOW_SOURCE_TYPES = new Set(["public_purchase", "private_purchase"]);

const normalizeWorkflowSourceType = (value) => String(value || "").trim().toLowerCase();
const normalizeWorkflowSourceId = (value) => String(value || "").trim();
const isValidWorkflowSourceType = (value) => WORKFLOW_SOURCE_TYPES.has(normalizeWorkflowSourceType(value));
const clampLimit = (value, { min = 1, max = 200, fallback = 50 } = {}) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const ensureWorkflowDocumentsTable = async () => {
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.workflow_documents (
      id BIGSERIAL PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      document_code TEXT NOT NULL,
      stage_key TEXT,
      drive_file_id TEXT,
      drive_folder_id TEXT,
      request_id INTEGER,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_workflow_documents_source
      ON servicio.workflow_documents (source_type, source_id, created_at DESC)`,
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_workflow_documents_document_code
      ON servicio.workflow_documents (document_code, created_at DESC)`,
  );
  await db.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_documents_file
      ON servicio.workflow_documents (source_type, source_id, document_code, COALESCE(drive_file_id, ''))`,
  );
};

const trackWorkflowDocument = async (req, body, defaults = {}) => {
  try {
    const ok = Boolean(body?.ok);
    const driveFileId = body?.pdfId || body?.fileId || null;
    const driveFolderId = body?.driveFolderId || body?.folderId || null;
    if (!ok || !driveFileId) return;

    const sourceTypeRaw = req.body?.source_type || req.body?.sourceType || defaults.source_type || null;
    const sourceIdRaw = req.body?.source_id || req.body?.sourceId || defaults.source_id || null;
    const sourceType = sourceTypeRaw ? normalizeWorkflowSourceType(sourceTypeRaw) : null;
    const sourceId = sourceIdRaw ? normalizeWorkflowSourceId(sourceIdRaw) : null;
    if (!sourceType || !sourceId || !isValidWorkflowSourceType(sourceType)) return;

    await ensureWorkflowDocumentsTable();
    const metadata = JSON.stringify({
      message: body?.message || null,
      payload_summary: {
        orden: req.body?.ORDNumero || req.body?.Num_Orden || null,
        cliente: req.body?.ORDCliente || req.body?.Cliente || req.body?.cliente || null,
        equipo: req.body?.ORDEquipo || req.body?.Equipo || req.body?.equipo || null,
      },
      tracked_at: new Date().toISOString(),
    });
    const requestId = Number.isFinite(Number(req.body?.request_id)) ? Number(req.body?.request_id) : null;

    const { rows: existing } = await db.query(
      `SELECT id
         FROM servicio.workflow_documents
        WHERE source_type = $1
          AND source_id = $2
          AND document_code = $3
          AND COALESCE(drive_file_id, '') = COALESCE($4, '')
        LIMIT 1`,
      [sourceType, sourceId, defaults.document_code || "DOC", driveFileId],
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE servicio.workflow_documents
            SET stage_key = $1,
                drive_folder_id = $2,
                request_id = COALESCE($3, request_id),
                metadata = $4::jsonb,
                updated_at = now()
          WHERE id = $5`,
        [defaults.stage_key || null, driveFolderId, requestId, metadata, existing[0].id],
      );
    } else {
      const { rows: inserted } = await db.query(
        `INSERT INTO servicio.workflow_documents (
            source_type, source_id, document_code, stage_key, drive_file_id, drive_folder_id,
            request_id, created_by, created_by_email, metadata, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,now(),now())
          RETURNING id, drive_file_id`,
        [
          sourceType,
          sourceId,
          defaults.document_code || "DOC",
          defaults.stage_key || null,
          driveFileId,
          driveFolderId,
          requestId,
          req.user?.id || null,
          req.user?.email || null,
          metadata,
        ],
      );

      const newDoc = inserted[0];
      if (newDoc?.drive_file_id) {
        resolveExternalDriveIntegrity(newDoc.drive_file_id, drive)
          .then(async (result) => {
            if (result) {
              await db.query(
                `UPDATE servicio.workflow_documents SET metadata = jsonb_set(metadata, '{integrity}', $1::jsonb) WHERE id = $2`,
                [JSON.stringify({ hash: result.hash, algorithm: result.algorithm }), newDoc.id],
              );
              logger.info({ fileId: newDoc.drive_file_id }, "Integridad resuelta para documento de workflow de servicio");
            }
          })
          .catch((err) => logger.warn({ err }, "Error asíncrono resolviendo integridad de workflow de servicio"));
      }
    }
  } catch (error) {
    console.warn("⚠️ No se pudo registrar documento de workflow ST-01-01:", error?.message || error);
  }
};

const withWorkflowTracking = (handler, defaults = {}) => async (req, res) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    trackWorkflowDocument(req, body, defaults);
    return originalJson(body);
  };
  return handler(req, res);
};

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
// 📆 CRONOGRAMA DE ACTIVIDADES TÉCNICAS
// ===============================================================
const ensureTechnicalActivitiesTable = async () => {
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.cronograma_actividades_tecnicas (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      activity_date DATE NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'programado',
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_cronograma_actividades_tecnicas_activity_date
      ON servicio.cronograma_actividades_tecnicas (activity_date, status)`,
  );
};

const listActividadesTecnicas = async (req, res) => {
  try {
    await ensureTechnicalActivitiesTable();
    const from = String(req.query?.from || "").slice(0, 10);
    const to = String(req.query?.to || "").slice(0, 10);
    if (!from || !to) {
      return res.status(400).json({ ok: false, error: "Parámetros from y to son obligatorios (YYYY-MM-DD)" });
    }

    const { rows } = await db.query(
      `SELECT
          a.id,
          a.user_id,
          COALESCE(u.fullname, u.name, u.email) AS user_name,
          a.activity_date,
          a.title,
          a.notes,
          a.status,
          a.source_type,
          a.source_id,
          a.created_by,
          a.created_by_email,
          a.created_at,
          a.updated_at
       FROM servicio.cronograma_actividades_tecnicas a
       LEFT JOIN public.users u ON u.id = a.user_id
       WHERE a.activity_date BETWEEN $1::date AND $2::date
       ORDER BY a.activity_date ASC, a.created_at ASC`,
      [from, to],
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("❌ Error listando actividades técnicas:", err);
    res.status(500).json({ ok: false, error: "Error al listar actividades técnicas" });
  }
};

const createActividadTecnica = async (req, res) => {
  try {
    await ensureTechnicalActivitiesTable();
    const activityDate = String(req.body?.activity_date || "").slice(0, 10);
    const title = String(req.body?.title || "").trim();
    const notes = String(req.body?.notes || "").trim() || null;
    const status = String(req.body?.status || "programado").toLowerCase();
    const userIdRaw = req.body?.user_id;
    const userId = Number.isFinite(Number(userIdRaw)) ? Number(userIdRaw) : req.user?.id || null;

    if (!activityDate || !title) {
      return res.status(400).json({ ok: false, error: "activity_date y title son obligatorios" });
    }

    const { rows } = await db.query(
      `INSERT INTO servicio.cronograma_actividades_tecnicas (
          user_id, activity_date, title, notes, status, source_type, created_by, created_by_email
        )
        VALUES ($1, $2::date, $3, $4, $5, 'manual', $6, $7)
        RETURNING *`,
      [userId, activityDate, title, notes, status, req.user?.id || null, req.user?.email || null],
    );
    res.status(201).json({ ok: true, row: rows[0] });
  } catch (err) {
    console.error("❌ Error creando actividad técnica:", err);
    res.status(500).json({ ok: false, error: "Error al crear actividad técnica" });
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
// 🧴 DESINFECCIÓN DE INSTRUMENTOS
// ===============================================================
const generateDisinfectionPDF = withWorkflowTracking(async (req, res) => {
  try {
    console.log("🎯 Controller: Received disinfection PDF request", {
      user: req.user?.email || req.user?.name || 'Unknown',
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {}),
      signaturePresent: !!req.body?.firma_ing_SC,
      signatureLength: req.body?.firma_ing_SC?.length,
      attachmentsPresent: !!req.body?.adjunto_evidencia,
      attachmentCount: req.body?.adjunto_evidencia?.length || 0
    });

    // Pass user info to the PDF generation function
    req.userInfo = req.user; // Make user info available to the service
    console.log("🎯 Controller: User info attached", { userInfo: req.userInfo });
    await generatePDF(req, res);
  } catch (err) {
    console.error("❌ Error generando PDF de desinfección:", err);
    res.status(500).json({ error: "Error generando PDF de desinfección" });
  }
}, { document_code: "F.ST-02", stage_key: "desinfeccion" });

// ===============================================================
// 🏫 COORDINACIÓN DE ENTRENAMIENTO
// ===============================================================
const generateTrainingCoordinationPDF = withWorkflowTracking(async (req, res) => {
  try {
    console.log("🎯 Controller: Received training coordination PDF request", {
      user: req.user?.email || req.user?.name || 'Unknown',
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {}),
      signaturePresent: !!req.body?.Firma_af_image,
      signatureLength: req.body?.Firma_af_image?.length,
      ordenNumero: req.body?.ORDNumero,
      cliente: req.body?.ORDCliente
    });

    // Import the training service endpoint handler (acepta req, res)
    const { generateTrainingPDF } = require("./entrenamiento.service");

    // Pass user info to the PDF generation function
    req.userInfo = req.user; // Make user info available to the service
    console.log("🎯 Controller: User info attached", { userInfo: req.userInfo });

    await generateTrainingPDF(req, res);
  } catch (err) {
    console.error("❌ Error generando PDF de coordinación de entrenamiento:", err);
    res.status(500).json({ error: "Error generando PDF de coordinación de entrenamiento" });
  }
}, { document_code: "F.ST-04", stage_key: "entrenamiento_coordinacion" });

// ===============================================================
// 📝 LISTA DE ASISTENCIA DE ENTRENAMIENTO
// ===============================================================
const generateAttendanceListPDF = withWorkflowTracking(async (req, res) => {
  try {
    console.log("📝 Controller: Received training attendance list PDF request", {
      user: req.user?.email || req.user?.name || 'Unknown',
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {}),
      signaturePresent: !!req.body?.Firma_Especialista,
      signatureLength: req.body?.Firma_Especialista?.length,
      ordenNumero: req.body?.Num_Orden,
      cliente: req.body?.ORDCliente
    });

    // Import the attendance service endpoint handler (acepta req, res)
    const { generateAttendanceListPDFEndpoint } = require("./asistencia-entrenamiento.service");

    // Pass user info to the PDF generation function
    req.userInfo = req.user; // Make user info available to the service
    console.log("📝 Controller: User info attached", { userInfo: req.userInfo });

    await generateAttendanceListPDFEndpoint(req, res);
  } catch (err) {
    console.error("❌ Error generando PDF de lista de asistencia:", err);
    res.status(500).json({ error: "Error generando PDF de lista de asistencia" });
  }
}, { document_code: "F.ST-05", stage_key: "entrenamiento_asistencia" });

// ===============================================================
// 🔧 VERIFICACIÓN DE EQUIPOS NUEVOS
// ===============================================================
const generateEquipmentVerificationPDF = withWorkflowTracking(async (req, res) => {
  try {
    console.log("🔧 Controller: Received equipment verification PDF request", {
      user: req.user?.email || req.user?.name || 'Unknown',
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {}),
      signaturePresent: !!req.body?.firma_af_image,
      signatureLength: req.body?.firma_af_image?.length,
      fecha: req.body?.Fecha,
      cliente: req.body?.Cliente,
      equipo: req.body?.Equipo,
      serie: req.body?.Serie
    });

    // Import the verification service endpoint handler (acepta req, res)
    const { generateEquipmentVerificationPDFEndpoint } = require("./verificacion-equipos.service");

    // Pass user info to the PDF generation function
    req.userInfo = req.user; // Make user info available to the service
    console.log("🔧 Controller: User info attached", { userInfo: req.userInfo });

    await generateEquipmentVerificationPDFEndpoint(req, res);
  } catch (err) {
    console.error("❌ Error generando PDF de verificación de equipos:", err);
    res.status(500).json({ error: "Error generando PDF de verificación de equipos" });
  }
}, { document_code: "F.ST-09", stage_key: "verificacion_equipo_nuevo" });

const listWorkflowDocuments = async (req, res) => {
  try {
    await ensureWorkflowDocumentsTable();
    const sourceType = normalizeWorkflowSourceType(req.query?.source_type);
    const sourceId = normalizeWorkflowSourceId(req.query?.source_id);
    const limit = clampLimit(req.query?.limit, { fallback: 50, max: 200 });
    if (!sourceType || !sourceId) {
      return res.status(400).json({ ok: false, error: "source_type y source_id son obligatorios" });
    }
    if (!isValidWorkflowSourceType(sourceType)) {
      return res.status(400).json({ ok: false, error: "source_type inválido" });
    }
    const { rows } = await db.query(
      `SELECT id, source_type, source_id, document_code, stage_key, drive_file_id, drive_folder_id,
              request_id, created_by, created_by_email, metadata, created_at, updated_at
         FROM servicio.workflow_documents
        WHERE source_type = $1
          AND source_id = $2
        ORDER BY created_at DESC
        LIMIT $3`,
      [sourceType, sourceId, limit],
    );
    res.json({ ok: true, source_type: sourceType, source_id: sourceId, limit, rows });
  } catch (err) {
    console.error("❌ Error listando documentos de workflow ST-01-01:", err);
    res.status(500).json({ ok: false, error: "Error al listar documentos de workflow" });
  }
};

const listWorkflowDocumentsSummary = async (req, res) => {
  try {
    await ensureWorkflowDocumentsTable();
    const sourceType = normalizeWorkflowSourceType(req.query?.source_type);
    const sourceIdsRaw = String(req.query?.source_ids || "");
    if (!sourceType || !sourceIdsRaw.trim()) {
      return res.status(400).json({ ok: false, error: "source_type y source_ids son obligatorios" });
    }
    if (!isValidWorkflowSourceType(sourceType)) {
      return res.status(400).json({ ok: false, error: "source_type inválido" });
    }

    const sourceIds = Array.from(
      new Set(
        sourceIdsRaw
          .split(",")
          .map((value) => normalizeWorkflowSourceId(value))
          .filter(Boolean),
      ),
    ).slice(0, 200);
    if (!sourceIds.length) {
      return res.status(400).json({ ok: false, error: "source_ids inválido" });
    }

    const { rows } = await db.query(
      `
        SELECT
          source_id,
          COUNT(*)::int AS total_documents,
          MAX(created_at) AS last_document_at,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT document_code), NULL) AS document_codes,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT stage_key), NULL) AS stage_keys
        FROM servicio.workflow_documents
        WHERE source_type = $1
          AND source_id = ANY($2::text[])
        GROUP BY source_id
        ORDER BY source_id ASC
      `,
      [sourceType, sourceIds],
    );

    res.json({
      ok: true,
      source_type: sourceType,
      count: rows.length,
      rows,
    });
  } catch (err) {
    console.error("❌ Error listando resumen de documentos workflow ST-01-01:", err);
    res.status(500).json({ ok: false, error: "Error al listar resumen de workflow" });
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
  listActividadesTecnicas,
  createActividadTecnica,
  getEquipos,
  createEquipo,
  getMantenimientos,
  getMantenimientosAnuales,
  createMantenimientoAnual,
  generateDisinfectionPDF,
  generateTrainingCoordinationPDF,
  generateAttendanceListPDF,
  generateEquipmentVerificationPDF,
  listWorkflowDocuments,
  listWorkflowDocumentsSummary,
};
