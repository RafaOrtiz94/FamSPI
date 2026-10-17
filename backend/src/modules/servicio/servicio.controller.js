const db = require("../../config/db");
const logger = require("../../config/logger");
const { google } = require("googleapis");
const { Readable } = require("stream");
const { generatePDF } = require("./desinfeccion.service");
const { resolveExternalDriveIntegrity } = require("../../utils/documentHash");
const {
  SUPPORTED_WORKFLOW_SOURCE_TYPES,
  upsertWorkflow,
  getWorkflow,
  validateSourceType,
} = require("./workflowRegistry.service");
const {
  appendWorkflowAuditEvent,
  listWorkflowTimeline,
} = require("./workflowAudit.service");
const {
  listDocumentTemplateCatalog,
} = require("./documentTemplateRegistry.service");
const {
  getDocumentCompatibility,
  listCatalogCompatibility,
} = require("./documentCompatibility.service");
const {
  getStateMachineCatalog,
  getStateMachine,
  resolveStageFromDocumentCode,
} = require("./workflowStateMachine.service");
const {
  getTrainingWorkflowDetail,
  updateTrainingWorkflowAction,
} = require("./trainingWorkflow.service");
const { generateFst06PDFEndpoint } = require("./fst06.service");
const { generateFst08PDFEndpoint } = require("./fst08.service");
const { generateFst12PDFEndpoint } = require("./fst12.service");
const {
  issueTrainingCertificateEndpoint,
  deliverTrainingCertificateEndpoint,
} = require("./trainingCertificates.service");
const {
  getWithdrawalWorkflowDetail,
  listWithdrawalWorkflows,
  updateWithdrawalWorkflowAction,
  attachFst11DocumentToWorkflow,
} = require("./withdrawalWorkflow.service");
const { issueFst11Document } = require("./fst11.service");
const {
  createCorrectiveCase,
  listCorrectiveCasesWorkspace,
  getCorrectiveCasesWorkspaceKpis,
  getCorrectiveCaseDetail,
  listCorrectiveCaseTimeline,
  listCorrectiveCaseEvents,
  listCorrectiveCaseComments,
  addCorrectiveCaseComment,
  listCorrectiveCaseEvidences,
  updateCorrectiveCaseAction,
} = require("./correctiveCases.service");
const { getTechnicalScheduleFeed } = require("./technicalSchedule.service");
const { getActionQueue } = require("./actionQueue.service");

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
const WORKFLOW_SOURCE_TYPES = new Set(Array.from(SUPPORTED_WORKFLOW_SOURCE_TYPES));
const STRICT_TEMPLATE_VALIDATION = String(process.env.STRICT_TEMPLATE_VALIDATION || "").trim().toLowerCase() === "true";

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
    const procedureCode = String(defaults.procedure_code || "ST-01-01").trim().toUpperCase();
    const documentCode = String(defaults.document_code || "DOC").trim().toUpperCase();
    const stageKey = defaults.stage_key || resolveStageFromDocumentCode(documentCode) || "document_generated";
    const payloadSummary = {
      orden: req.body?.ORDNumero || req.body?.Num_Orden || null,
      cliente: req.body?.ORDCliente || req.body?.Cliente || req.body?.cliente || null,
      equipo: req.body?.ORDEquipo || req.body?.Equipo || req.body?.equipo || null,
    };
    const templateValidation = req.workflow_template_validation || null;
    const templateMode =
      body?.template_mode ||
      body?.templateMode ||
      req.body?.template_mode ||
      req.body?.templateMode ||
      null;
    const templateVersion =
      body?.template_version ||
      body?.templateVersion ||
      req.body?.template_version ||
      req.body?.templateVersion ||
      templateValidation?.compatibility?.version ||
      null;
    const metadata = JSON.stringify({
      message: body?.message || null,
      payload_summary: payloadSummary,
      emission: {
        emitted_at: new Date().toISOString(),
        emitted_by: {
          user_id: req.user?.id || null,
          email: req.user?.email || null,
        },
        origin: {
          source_type: sourceType,
          source_id: sourceId,
          request_id: Number.isFinite(Number(req.body?.request_id)) ? Number(req.body?.request_id) : null,
          procedure_code: procedureCode,
          stage_key: stageKey,
          document_code: documentCode,
        },
      },
      template: {
        mode: templateMode || null,
        version: templateVersion || null,
        compatibility_status: templateValidation?.compatibility?.status || null,
        compatibility_checked_at: templateValidation?.validated_at || null,
      },
      drive: {
        file_id: driveFileId || null,
        folder_id: driveFolderId || null,
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
        [stageKey, driveFolderId, requestId, metadata, existing[0].id],
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
          documentCode,
          stageKey,
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

    await upsertWorkflow({
      sourceType,
      sourceId,
      requestId,
      clientName: payloadSummary.cliente || null,
      equipmentName: payloadSummary.equipo || null,
      procedureCode,
      globalStatus: "in_progress",
      currentStage: stageKey,
      metadata: {
        last_document_code: documentCode,
        last_document_at: new Date().toISOString(),
      },
      user: req.user,
    });

    await appendWorkflowAuditEvent({
      sourceType,
      sourceId,
      procedureCode,
      eventType: "document_generated",
      stageKey,
      actor: req.user,
      payload: {
        document_code: documentCode,
        drive_file_id: driveFileId,
        drive_folder_id: driveFolderId,
        request_id: requestId,
      },
    });
  } catch (error) {
    console.warn("⚠️ No se pudo registrar documento de workflow ST-01-01:", error?.message || error);
  }
};

const withWorkflowTracking = (handler, defaults = {}) => async (req, res) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const bodyWithValidation =
      body && typeof body === "object" && req.workflow_template_validation
        ? { ...body, workflow_template_validation: req.workflow_template_validation }
        : body;
    trackWorkflowDocument(req, bodyWithValidation, defaults);
    return originalJson(bodyWithValidation);
  };
  return handler(req, res);
};

const runTemplateCompatibilityGate = async (req, res, documentCode, options = {}) => {
  try {
    const compatibility = await getDocumentCompatibility(documentCode);
    req.workflow_template_validation = compatibility;
    if (compatibility?.is_compatible) {
      return { ok: true, compatibility };
    }

    await appendWorkflowAuditEvent({
      sourceType: req.body?.source_type || req.body?.sourceType || "manual",
      sourceId: req.body?.source_id || req.body?.sourceId || String(req.body?.request_id || "template-validation"),
      procedureCode: "ST-01-01",
      eventType: "template_incompatibility_detected",
      stageKey: resolveStageFromDocumentCode(documentCode) || "template_validation",
      actor: req.user,
      payload: {
        document_code: documentCode,
        issues: compatibility?.issues || [],
      },
    });

    const strictValidation = Boolean(options?.strict) || STRICT_TEMPLATE_VALIDATION;
    if (strictValidation) {
      res.status(422).json({
        ok: false,
        code: "DOCUMENT_TEMPLATE_INCOMPATIBLE",
        message: `La plantilla ${documentCode} es incompatible con el contrato de campos`,
        compatibility,
      });
      return { ok: false, compatibility };
    }

    return { ok: true, compatibility };
  } catch (error) {
    logger.warn({ error, documentCode }, "No se pudo ejecutar validacion de compatibilidad documental");
    req.workflow_template_validation = {
      ok: false,
      document_code: documentCode,
      is_compatible: false,
      issues: [{ code: "VALIDATION_ERROR", message: "Error ejecutando validacion de plantilla" }],
    };
    return { ok: true, compatibility: req.workflow_template_validation };
  }
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
  // T10 del plan de rework: jefe_servicio necesita comparar carga de
  // ing_servicio vs esp_app para decidir a quien asignar un caso nuevo. El
  // rol vive en users, no en la tabla de disponibilidad -- se expone aca
  // para que el frontend pueda filtrar/agrupar el cronograma por especialidad
  // sin otro roundtrip.
  role: row.role || null,
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
        u.email,
        u.role
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

const getTechnicalScheduleFeedController = async (req, res) => {
  try {
    const data = await getTechnicalScheduleFeed({
      user: req.user,
      from: req.query?.from,
      to: req.query?.to,
      scope: req.query?.scope,
    });
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando cronograma técnico consolidado:", err);
    res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || "Error al listar cronograma técnico consolidado",
    });
  }
};

const getActionQueueController = async (req, res) => {
  try {
    const data = await getActionQueue({
      user: req.user,
      scope: req.query?.scope,
    });
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando cola de acciones de servicio técnico:", err);
    res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || "Error al listar cola de acciones",
    });
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
    const gate = await runTemplateCompatibilityGate(req, res, "F.ST-02");
    if (!gate.ok) return;

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
    const gate = await runTemplateCompatibilityGate(req, res, "F.ST-04");
    if (!gate.ok) return;

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
    const gate = await runTemplateCompatibilityGate(req, res, "F.ST-05");
    if (!gate.ok) return;

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

const getTrainingWorkflowStatus = async (req, res) => {
  try {
    const sourceType = normalizeWorkflowSourceType(req.query?.source_type || req.query?.sourceType);
    const sourceId = normalizeWorkflowSourceId(req.query?.source_id || req.query?.sourceId);
    if (!sourceType || !sourceId) {
      return res.status(400).json({ ok: false, error: "source_type y source_id son obligatorios" });
    }
    if (!validateSourceType(sourceType)) {
      return res.status(400).json({ ok: false, error: "source_type invalido" });
    }

    const detail = await getTrainingWorkflowDetail({
      source_type: sourceType,
      source_id: sourceId,
    });
    if (!detail) {
      return res.status(404).json({
        ok: false,
        error: "No existe workflow de entrenamiento para la fuente indicada",
      });
    }

    return res.json({
      ok: true,
      source_type: sourceType,
      source_id: sourceId,
      workflow: detail,
    });
  } catch (error) {
    logger.error({ error }, "Error consultando workflow de entrenamiento");
    return res.status(500).json({ ok: false, error: "Error consultando workflow de entrenamiento" });
  }
};

const postTrainingWorkflowAction = async (req, res) => {
  try {
    const sourceType = normalizeWorkflowSourceType(req.body?.source_type || req.body?.sourceType);
    const sourceId = normalizeWorkflowSourceId(req.body?.source_id || req.body?.sourceId);
    if (!sourceType || !sourceId) {
      return res.status(400).json({ ok: false, error: "source_type y source_id son obligatorios" });
    }
    if (!validateSourceType(sourceType)) {
      return res.status(400).json({ ok: false, error: "source_type invalido" });
    }
    const action = String(req.body?.action || "").trim();
    if (!action) {
      return res.status(400).json({ ok: false, error: "action es obligatoria" });
    }

    const detail = await updateTrainingWorkflowAction({
      action,
      payload: req.body,
      user: req.user,
    });

    return res.json({
      ok: true,
      source_type: sourceType,
      source_id: sourceId,
      action,
      workflow: detail,
    });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error ejecutando accion de workflow de entrenamiento");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error ejecutando accion de workflow",
      code: error?.code || "TRAINING_WORKFLOW_ACTION_ERROR",
    });
  }
};

const generateTrainingEvaluationPDF = async (req, res) =>
  generateFst06PDFEndpoint(req, res);

const generateTrainingSpecialistEvaluationPDF = async (req, res) =>
  generateFst08PDFEndpoint(req, res);

const generateTrainingConformityPDF = async (req, res) =>
  generateFst12PDFEndpoint(req, res);

const issueTrainingCertificate = async (req, res) =>
  issueTrainingCertificateEndpoint(req, res);

const deliverTrainingCertificate = async (req, res) =>
  deliverTrainingCertificateEndpoint(req, res);

const listWithdrawalWorkflowStatus = async (req, res) => {
  try {
    const rows = await listWithdrawalWorkflows({
      q: req.query?.q || null,
      status: req.query?.status || null,
      sourceType: req.query?.source_type || null,
      limit: req.query?.limit || 100,
    });
    return res.json({
      ok: true,
      count: rows.length,
      rows,
    });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error listando workflows de retiro");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error listando workflows de retiro",
      code: error?.code || "WITHDRAWAL_WORKFLOW_LIST_ERROR",
      details: error?.details || null,
    });
  }
};

const getWithdrawalWorkflowStatus = async (req, res) => {
  try {
    const sourceType = normalizeWorkflowSourceType(req.query?.source_type || req.query?.sourceType);
    const sourceId = normalizeWorkflowSourceId(req.query?.source_id || req.query?.sourceId);
    const requestId = Number.isFinite(Number(req.query?.request_id || req.query?.requestId))
      ? Number(req.query.request_id || req.query.requestId)
      : null;

    if ((!sourceType || !sourceId) && !requestId) {
      return res.status(400).json({
        ok: false,
        error: "Debe enviar source_type + source_id o request_id",
      });
    }

    const detail = await getWithdrawalWorkflowDetail({
      sourceType: sourceType || null,
      sourceId: sourceId || null,
      requestId,
      createIfMissing: false,
    });
    if (!detail) {
      return res.status(404).json({
        ok: false,
        error: "No existe workflow de retiro para la referencia indicada",
      });
    }
    return res.json({
      ok: true,
      source_type: detail.source_type,
      source_id: detail.source_id,
      request_id: detail.request_id || null,
      workflow: detail,
    });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error consultando workflow de retiro");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error consultando workflow de retiro",
      code: error?.code || "WITHDRAWAL_WORKFLOW_GET_ERROR",
      details: error?.details || null,
    });
  }
};

const postWithdrawalWorkflowAction = async (req, res) => {
  try {
    const action = String(req.body?.action || "").trim();
    if (!action) {
      return res.status(400).json({ ok: false, error: "action es obligatoria" });
    }
    const detail = await updateWithdrawalWorkflowAction({
      action,
      payload: req.body || {},
      user: req.user,
    });
    return res.json({
      ok: true,
      action,
      source_type: detail.source_type,
      source_id: detail.source_id,
      request_id: detail.request_id || null,
      workflow: detail,
    });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error ejecutando accion en workflow de retiro");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error ejecutando acción en workflow de retiro",
      code: error?.code || "WITHDRAWAL_WORKFLOW_ACTION_ERROR",
      details: error?.details || null,
    });
  }
};

const generateWithdrawalActPDF = async (req, res) => {
  try {
    const gate = await runTemplateCompatibilityGate(req, res, "F.ST-11");
    if (!gate.ok) return;

    const sourceType = normalizeWorkflowSourceType(req.body?.source_type || req.body?.sourceType);
    const sourceId = normalizeWorkflowSourceId(req.body?.source_id || req.body?.sourceId);
    const requestId = Number.isFinite(Number(req.body?.request_id || req.body?.requestId))
      ? Number(req.body.request_id || req.body.requestId)
      : null;

    if ((!sourceType || !sourceId) && !requestId) {
      return res.status(400).json({
        ok: false,
        error: "Debe enviar source_type + source_id o request_id para emitir F.ST-11",
      });
    }

    const workflow = await getWithdrawalWorkflowDetail({
      sourceType: sourceType || null,
      sourceId: sourceId || null,
      requestId,
      createIfMissing: true,
    });
    if (!workflow) {
      return res.status(404).json({
        ok: false,
        error: "No se encontró workflow para emitir F.ST-11",
      });
    }
    const disinfectionStatus = workflow?.workflow_state?.disinfection?.status || "pending";
    const packagingStatus = workflow?.workflow_state?.packaging?.status || "pending";
    const pickedUpAt = workflow?.workflow_state?.logistics?.picked_up_at || null;
    if (disinfectionStatus !== "completed" || packagingStatus !== "completed" || !pickedUpAt) {
      return res.status(409).json({
        ok: false,
        error: "No se puede emitir F.ST-11 sin desinfección, embalaje y retiro ejecutado",
        code: "FST11_PRECONDITIONS_NOT_MET",
        details: {
          disinfection_status: disinfectionStatus,
          packaging_status: packagingStatus,
          picked_up_at: pickedUpAt,
        },
      });
    }

    const issued = await issueFst11Document({
      sourceType: workflow.source_type,
      sourceId: workflow.source_id,
      requestId: workflow.request_id || null,
      clientName: workflow.client_name || null,
      equipmentName: workflow.equipment_name || null,
      workflowStatus: workflow.workflow_status,
      workflowState: workflow.workflow_state,
      notes: req.body?.notes || null,
      user: req.user,
    });

    const detail = await attachFst11DocumentToWorkflow({
      sourceType: workflow.source_type,
      sourceId: workflow.source_id,
      requestId: workflow.request_id || null,
      fileId: issued.file_id,
      link: issued.link,
      folderId: issued.folder_id,
      generatedAt: issued.generated_at,
      templateMode: issued.template_mode,
      signedClient: req.body?.signed_client || false,
      signedTechnical: req.body?.signed_technical || false,
      notes: req.body?.notes || null,
      user: req.user,
    });

    return res.json({
      ok: true,
      message: "F.ST-11 emitido y registrado correctamente",
      source_type: detail.source_type,
      source_id: detail.source_id,
      request_id: detail.request_id || null,
      driveFolderId: issued.folder_id,
      pdfId: issued.file_id,
      pdfLink: issued.link,
      template_mode: issued.template_mode,
      workflow: detail,
      workflow_template_validation: req.workflow_template_validation || null,
    });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error emitiendo F.ST-11");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error emitiendo F.ST-11",
      code: error?.code || "WITHDRAWAL_FST11_ERROR",
      details: error?.details || null,
    });
  }
};

// ===============================================================
// 🔧 VERIFICACIÓN DE EQUIPOS NUEVOS
// ===============================================================
const generateEquipmentVerificationPDF = withWorkflowTracking(async (req, res) => {
  try {
    const gate = await runTemplateCompatibilityGate(req, res, "F.ST-09", { strict: true });
    if (!gate.ok) return;

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

const getWorkflowReportingSummary = async (_req, res) => {
  const warnings = [];
  const safeCount = async ({ key, sql, values = [], column = "total" }) => {
    try {
      const { rows } = await db.query(sql, values);
      return Number(rows?.[0]?.[column] || 0);
    } catch (error) {
      warnings.push({
        metric: key,
        message: error?.message || "query_failed",
      });
      return 0;
    }
  };

  try {
    const [
      workflowsTotal,
      workflowsWithoutDocuments,
      openReinspectionsPublic,
      openReinspectionsPrivate,
      sparePartsPending,
      overdueReprogrammings,
      overdueCertificates,
    ] = await Promise.all([
      safeCount({
        key: "workflows_total",
        sql: `SELECT COUNT(*)::int AS total FROM servicio.workflows`,
      }),
      safeCount({
        key: "workflows_without_documents",
        sql: `
          SELECT COUNT(*)::int AS total
          FROM servicio.workflows w
          LEFT JOIN (
            SELECT source_type, source_id, procedure_code, COUNT(*)::int AS total_docs
            FROM servicio.workflow_documents
            GROUP BY source_type, source_id, procedure_code
          ) d
            ON d.source_type = w.source_type
           AND d.source_id = w.source_id
           AND d.procedure_code = w.procedure_code
          WHERE COALESCE(d.total_docs, 0) = 0
        `,
      }),
      safeCount({
        key: "open_reinspections_public",
        sql: `
          SELECT COUNT(*)::int AS total
          FROM equipment_purchase_requests
          WHERE inspection_site_status = 'non_compliant_reinspection_pending'
        `,
      }),
      safeCount({
        key: "open_reinspections_private",
        sql: `
          SELECT COUNT(*)::int AS total
          FROM private_purchase_requests
          WHERE site_inspection_status = 'non_compliant_reinspection_pending'
        `,
      }),
      safeCount({
        key: "spare_parts_pending_quote",
        sql: `
          SELECT COUNT(*)::int AS total
          FROM servicio.corrective_cases
          WHERE status IN ('parts_pending_quote', 'parts_pending_client_approval')
        `,
      }),
      safeCount({
        key: "overdue_reprogrammings",
        sql: `
          SELECT COUNT(*)::int AS total
          FROM servicio.preventive_plan_items
          WHERE status = 'reprogrammed'
            AND COALESCE(reprogrammed_to_date, planned_date) < CURRENT_DATE
        `,
      }),
      safeCount({
        key: "overdue_certificates",
        sql: `
          SELECT COUNT(*)::int AS total
          FROM servicio.training_event_certificates
          WHERE delivery_deadline_at IS NOT NULL
            AND delivered_at IS NULL
            AND delivery_deadline_at < now()
        `,
      }),
    ]);

    return res.json({
      ok: true,
      data: {
        generated_at: new Date().toISOString(),
        metrics: {
          workflows_total: workflowsTotal,
          workflows_without_documents: workflowsWithoutDocuments,
          open_reinspections: openReinspectionsPublic + openReinspectionsPrivate,
          open_reinspections_public: openReinspectionsPublic,
          open_reinspections_private: openReinspectionsPrivate,
          spare_parts_pending_quote: sparePartsPending,
          overdue_reprogrammings: overdueReprogrammings,
          overdue_certificates_delivery: overdueCertificates,
        },
        warnings,
      },
    });
  } catch (err) {
    console.error("❌ Error construyendo resumen operativo ST:", err);
    return res.status(500).json({ ok: false, error: "Error al construir resumen operativo ST" });
  }
};

const getWorkflowCatalog = async (req, res) => {
  try {
    const withCompatibility = String(req.query?.with_compatibility || "true").toLowerCase() !== "false";
    const includeInactive = String(req.query?.include_inactive || "false").toLowerCase() === "true";
    const catalogRows = await listDocumentTemplateCatalog({ includeInactive });
    if (!withCompatibility) {
      return res.json({ ok: true, count: catalogRows.length, rows: catalogRows });
    }

    const compatibilityRows = await listCatalogCompatibility({ includeInactive });
    const compatibilityMap = new Map(compatibilityRows.map((row) => [row.document_code, row]));
    const rows = catalogRows.map((item) => ({
      ...item,
      compatibility: compatibilityMap.get(item.document_code) || null,
    }));
    return res.json({ ok: true, count: rows.length, rows });
  } catch (error) {
    logger.error({ error }, "Error listando catalogo documental de workflow");
    return res.status(500).json({ ok: false, error: "Error al listar catalogo documental de workflow" });
  }
};

const getWorkflowStateMachines = async (_req, res) => {
  try {
    const rows = getStateMachineCatalog();
    return res.json({ ok: true, count: rows.length, rows });
  } catch (error) {
    logger.error({ error }, "Error listando maquinas de estado de workflow");
    return res.status(500).json({ ok: false, error: "Error al listar maquinas de estado" });
  }
};

const getWorkflowRegistryStatus = async (req, res) => {
  try {
    const sourceType = normalizeWorkflowSourceType(req.query?.source_type);
    const sourceId = normalizeWorkflowSourceId(req.query?.source_id);
    const procedureCode = String(req.query?.procedure_code || "ST-01-01").trim().toUpperCase();
    if (!sourceType || !sourceId) {
      return res.status(400).json({ ok: false, error: "source_type y source_id son obligatorios" });
    }
    if (!validateSourceType(sourceType)) {
      return res.status(400).json({ ok: false, error: "source_type invalido" });
    }

    const workflow = await getWorkflow({ sourceType, sourceId, procedureCode });
    const machine = getStateMachine(procedureCode);
    return res.json({
      ok: true,
      source_type: sourceType,
      source_id: sourceId,
      procedure_code: procedureCode,
      workflow: workflow || null,
      state_machine: machine || null,
    });
  } catch (error) {
    logger.error({ error }, "Error consultando estado del workflow");
    return res.status(500).json({ ok: false, error: "Error al consultar estado del workflow" });
  }
};

const upsertWorkflowRegistryStatus = async (req, res) => {
  try {
    const sourceType = normalizeWorkflowSourceType(req.body?.source_type || req.body?.sourceType);
    const sourceId = normalizeWorkflowSourceId(req.body?.source_id || req.body?.sourceId);
    const procedureCode = String(req.body?.procedure_code || "ST-01-01").trim().toUpperCase();
    if (!sourceType || !sourceId) {
      return res.status(400).json({ ok: false, error: "source_type y source_id son obligatorios" });
    }
    if (!validateSourceType(sourceType)) {
      return res.status(400).json({ ok: false, error: "source_type invalido" });
    }

    const row = await upsertWorkflow({
      sourceType,
      sourceId,
      requestId: req.body?.request_id || req.body?.requestId || null,
      clientName: req.body?.client_name || req.body?.clientName || null,
      equipmentName: req.body?.equipment_name || req.body?.equipmentName || null,
      procedureCode,
      globalStatus: req.body?.global_status || req.body?.globalStatus || null,
      currentStage: req.body?.current_stage || req.body?.currentStage || null,
      metadata: req.body?.metadata || {},
      user: req.user,
    });

    await appendWorkflowAuditEvent({
      sourceType,
      sourceId,
      procedureCode,
      eventType: "workflow_upserted",
      stageKey: row?.current_stage || null,
      actor: req.user,
      payload: {
        request_id: row?.request_id || null,
        global_status: row?.global_status || null,
        current_stage: row?.current_stage || null,
      },
    });

    return res.status(201).json({ ok: true, row });
  } catch (error) {
    logger.error({ error }, "Error actualizando registro de workflow");
    return res.status(500).json({ ok: false, error: "Error al actualizar registro de workflow" });
  }
};

const getWorkflowTimelineEvents = async (req, res) => {
  try {
    const sourceType = normalizeWorkflowSourceType(req.query?.source_type);
    const sourceId = normalizeWorkflowSourceId(req.query?.source_id);
    const procedureCode = String(req.query?.procedure_code || "ST-01-01").trim().toUpperCase();
    const limit = clampLimit(req.query?.limit, { fallback: 100, max: 200 });
    if (!sourceType || !sourceId) {
      return res.status(400).json({ ok: false, error: "source_type y source_id son obligatorios" });
    }
    if (!validateSourceType(sourceType)) {
      return res.status(400).json({ ok: false, error: "source_type invalido" });
    }

    const rows = await listWorkflowTimeline({
      sourceType,
      sourceId,
      procedureCode,
      limit,
    });
    return res.json({
      ok: true,
      source_type: sourceType,
      source_id: sourceId,
      procedure_code: procedureCode,
      count: rows.length,
      rows,
    });
  } catch (error) {
    logger.error({ error }, "Error listando timeline de workflow");
    return res.status(500).json({ ok: false, error: "Error al listar timeline de workflow" });
  }
};

// ===============================================================
// 🔧 ST-01-03 CORRECTIVOS / CEAC
// ===============================================================
const createCorrectiveCaseController = async (req, res) => {
  try {
    const detail = await createCorrectiveCase({
      actorUser: req.user,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, case: detail });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error creando caso correctivo");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error creando caso correctivo",
      code: error?.code || "CORRECTIVE_CASE_CREATE_ERROR",
      details: error?.details || null,
    });
  }
};

const listCorrectiveCasesWorkspaceController = async (req, res) => {
  try {
    const rows = await listCorrectiveCasesWorkspace({
      actorUser: req.user,
      status: req.query?.status || null,
      classification: req.query?.classification || null,
      q: req.query?.q || null,
      onlyMine: String(req.query?.only_mine || "").toLowerCase() === "true",
      limit: req.query?.limit || 250,
    });
    return res.json({ ok: true, count: rows.length, rows });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error listando workspace de casos correctivos");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error listando workspace correctivo",
      code: error?.code || "CORRECTIVE_CASE_WORKSPACE_LIST_ERROR",
      details: error?.details || null,
    });
  }
};

const getCorrectiveCasesWorkspaceKpisController = async (req, res) => {
  try {
    const data = await getCorrectiveCasesWorkspaceKpis({
      actorUser: req.user,
      status: req.query?.status || null,
      classification: req.query?.classification || null,
      q: req.query?.q || null,
      onlyMine: String(req.query?.only_mine || "").toLowerCase() === "true",
    });
    return res.json({ ok: true, data });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error calculando KPI de casos correctivos");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error calculando KPI correctivo",
      code: error?.code || "CORRECTIVE_CASE_WORKSPACE_KPI_ERROR",
      details: error?.details || null,
    });
  }
};

const getCorrectiveCaseDetailController = async (req, res) => {
  try {
    const caseId = Number(req.params.id);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ ok: false, error: "id inválido" });
    }
    const detail = await getCorrectiveCaseDetail(caseId, req.user);
    return res.json({ ok: true, case: detail });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error consultando detalle de caso correctivo");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error consultando caso correctivo",
      code: error?.code || "CORRECTIVE_CASE_DETAIL_ERROR",
      details: error?.details || null,
    });
  }
};

const listCorrectiveCaseTimelineController = async (req, res) => {
  try {
    const caseId = Number(req.params.id);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ ok: false, error: "id inválido" });
    }
    const rows = await listCorrectiveCaseTimeline(caseId, req.user);
    return res.json({ ok: true, count: rows.length, rows });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error listando timeline de caso correctivo");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error listando timeline correctivo",
      code: error?.code || "CORRECTIVE_CASE_TIMELINE_ERROR",
      details: error?.details || null,
    });
  }
};

const listCorrectiveCaseEventsController = async (req, res) => {
  try {
    const caseId = Number(req.params.id);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ ok: false, error: "id inválido" });
    }
    const rows = await listCorrectiveCaseEvents(caseId, req.user);
    return res.json({ ok: true, count: rows.length, rows });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error listando eventos de caso correctivo");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error listando eventos correctivos",
      code: error?.code || "CORRECTIVE_CASE_EVENTS_ERROR",
      details: error?.details || null,
    });
  }
};

const listCorrectiveCaseCommentsController = async (req, res) => {
  try {
    const caseId = Number(req.params.id);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ ok: false, error: "id inválido" });
    }
    const rows = await listCorrectiveCaseComments(caseId, req.user);
    return res.json({ ok: true, count: rows.length, rows });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error listando comentarios de caso correctivo");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error listando comentarios correctivos",
      code: error?.code || "CORRECTIVE_CASE_COMMENTS_ERROR",
      details: error?.details || null,
    });
  }
};

const addCorrectiveCaseCommentController = async (req, res) => {
  try {
    const caseId = Number(req.params.id);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ ok: false, error: "id inválido" });
    }
    const comment = await addCorrectiveCaseComment({
      caseId,
      actorUser: req.user,
      message: req.body?.message,
      visibility: req.body?.visibility || "public",
    });
    return res.status(201).json({ ok: true, comment });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error agregando comentario a caso correctivo");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error agregando comentario",
      code: error?.code || "CORRECTIVE_CASE_COMMENT_CREATE_ERROR",
      details: error?.details || null,
    });
  }
};

const listCorrectiveCaseEvidencesController = async (req, res) => {
  try {
    const caseId = Number(req.params.id);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ ok: false, error: "id inválido" });
    }
    const rows = await listCorrectiveCaseEvidences(caseId, req.user);
    return res.json({ ok: true, count: rows.length, rows });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error listando evidencias de caso correctivo");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error listando evidencias",
      code: error?.code || "CORRECTIVE_CASE_EVIDENCE_LIST_ERROR",
      details: error?.details || null,
    });
  }
};

const postCorrectiveCaseActionController = async (req, res) => {
  try {
    const caseId = Number(req.params.id);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ ok: false, error: "id inválido" });
    }
    const action = String(req.body?.action || "").trim();
    if (!action) {
      return res.status(400).json({ ok: false, error: "action es obligatoria" });
    }
    const detail = await updateCorrectiveCaseAction({
      caseId,
      action,
      payload: req.body || {},
      actorUser: req.user,
    });
    return res.json({
      ok: true,
      action,
      case: detail,
    });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error ejecutando acción de caso correctivo");
    return res.status(status).json({
      ok: false,
      error: error?.message || "Error ejecutando acción correctiva",
      code: error?.code || "CORRECTIVE_CASE_ACTION_ERROR",
      details: error?.details || null,
    });
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
  getTechnicalScheduleFeed: getTechnicalScheduleFeedController,
  getActionQueue: getActionQueueController,
  getEquipos,
  createEquipo,
  getMantenimientos,
  getMantenimientosAnuales,
  createMantenimientoAnual,
  generateDisinfectionPDF,
  generateTrainingCoordinationPDF,
  generateAttendanceListPDF,
  getTrainingWorkflowStatus,
  postTrainingWorkflowAction,
  generateTrainingEvaluationPDF,
  generateTrainingSpecialistEvaluationPDF,
  generateTrainingConformityPDF,
  issueTrainingCertificate,
  deliverTrainingCertificate,
  listWithdrawalWorkflowStatus,
  getWithdrawalWorkflowStatus,
  postWithdrawalWorkflowAction,
  generateWithdrawalActPDF,
  generateEquipmentVerificationPDF,
  listWorkflowDocuments,
  listWorkflowDocumentsSummary,
  getWorkflowReportingSummary,
  getWorkflowCatalog,
  getWorkflowStateMachines,
  getWorkflowRegistryStatus,
  upsertWorkflowRegistryStatus,
  getWorkflowTimelineEvents,
  createCorrectiveCaseController,
  listCorrectiveCasesWorkspaceController,
  getCorrectiveCasesWorkspaceKpisController,
  getCorrectiveCaseDetailController,
  listCorrectiveCaseTimelineController,
  listCorrectiveCaseEventsController,
  listCorrectiveCaseCommentsController,
  addCorrectiveCaseCommentController,
  listCorrectiveCaseEvidencesController,
  postCorrectiveCaseActionController,
};
