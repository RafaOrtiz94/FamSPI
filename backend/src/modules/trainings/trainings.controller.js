const multer = require("multer");
const service = require("./trainings.service");

const ALLOWED_PDF_MIME = new Set(["application/pdf"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_PDF_MIME.has(file.mimetype));
  },
});

function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function fail(res, err) {
  const status = err.status || 500;
  const message = err.message || "Error interno";
  return res.status(status).json({ ok: false, message });
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

async function createTrainingController(req, res) {
  try {
    const result = await service.createTraining(req.body, req.user);
    ok(res, result, 201);
  } catch (err) {
    fail(res, err);
  }
}

async function listTrainingsController(req, res) {
  try {
    const filters = {
      type:       req.query.type,
      status:     req.query.status,
      area:       req.query.area,
      event_type: req.query.event_type,
      date_from:  req.query.date_from,
      date_to:    req.query.date_to,
      search:     req.query.search,
      limit:      parseInt(req.query.limit, 10) || 50,
      offset:     parseInt(req.query.offset, 10) || 0,
    };
    const result = await service.listTrainings(filters, req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function getTrainingController(req, res) {
  try {
    const result = await service.getTraining(parseInt(req.params.id, 10), req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function updateTrainingController(req, res) {
  try {
    const result = await service.updateTraining(parseInt(req.params.id, 10), req.body, req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function cancelTrainingController(req, res) {
  try {
    const result = await service.cancelTraining(parseInt(req.params.id, 10), req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

// ---------------------------------------------------------------------------
// Asistentes
// ---------------------------------------------------------------------------

async function addAttendeesController(req, res) {
  try {
    const { attendees } = req.body;
    if (!Array.isArray(attendees) || !attendees.length) {
      return res.status(422).json({ ok: false, message: "attendees requerido" });
    }
    const result = await service.addAttendees(parseInt(req.params.id, 10), attendees, req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function removeAttendeeController(req, res) {
  try {
    const result = await service.removeAttendee(
      parseInt(req.params.id, 10),
      parseInt(req.params.attendeeId, 10),
      req.user
    );
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function markAttendanceController(req, res) {
  try {
    const { attendance } = req.body;
    if (!Array.isArray(attendance) || !attendance.length) {
      return res.status(422).json({ ok: false, message: "attendance requerido: [{userId, status}]" });
    }
    const result = await service.markAttendance(parseInt(req.params.id, 10), attendance, req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

// ---------------------------------------------------------------------------
// Mis capacitaciones
// ---------------------------------------------------------------------------

async function getMyAssignedController(req, res) {
  try {
    const result = await service.getMyAssigned(req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

// ---------------------------------------------------------------------------
// Acta + FamSign
// ---------------------------------------------------------------------------

async function generateActaController(req, res) {
  try {
    const result = await service.generateActa(parseInt(req.params.id, 10), req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function uploadExternalActaController(req, res) {
  try {
    const file = req.file;
    if (!file) return res.status(422).json({ ok: false, message: "Se requiere un archivo PDF" });
    const result = await service.uploadExternalActa(
      parseInt(req.params.id, 10),
      file.buffer,
      file.originalname,
      req.user
    );
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function uploadManualSignedActaController(req, res) {
  try {
    const file = req.file;
    if (!file) return res.status(422).json({ ok: false, message: "Se requiere un archivo PDF" });
    const result = await service.uploadManualSignedActa(
      parseInt(req.params.id, 10),
      file.buffer,
      file.originalname,
      req.user
    );
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function sendActaToFamSignController(req, res) {
  try {
    const result = await service.sendActaToFamSign(parseInt(req.params.id, 10), req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function remindMainController(req, res) {
  try {
    const result = await service.remindPendingSigners(parseInt(req.params.id, 10), "main", req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function generateAbsentActaController(req, res) {
  try {
    const result = await service.generateAbsentActa(parseInt(req.params.id, 10), req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function sendAbsentActaToFamSignController(req, res) {
  try {
    const result = await service.sendAbsentActaToFamSign(parseInt(req.params.id, 10), req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function uploadManualSignedAbsentActaController(req, res) {
  try {
    const file = req.file;
    if (!file) return res.status(422).json({ ok: false, message: "Se requiere un archivo PDF" });
    const result = await service.uploadManualSignedAbsentActa(
      parseInt(req.params.id, 10),
      file.buffer,
      file.originalname,
      req.user
    );
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function remindAbsentController(req, res) {
  try {
    const result = await service.remindPendingSigners(parseInt(req.params.id, 10), "absent", req.user);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
}

async function listParticipantsController(req, res) {
  try {
    const db = require("../../config/db");
    const search = String(req.query.search || "").trim().toLowerCase();
    let query = `
      SELECT u.id, u.fullname, u.email, u.role,
             cp.profile->'laboral'->>'cargo' AS cargo,
             cp.profile->'laboral'->>'area'  AS area
      FROM users u
      LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE u.active = true
    `;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (LOWER(u.fullname) LIKE $1 OR LOWER(u.email) LIKE $1)`;
    }
    query += " ORDER BY u.fullname LIMIT 500";
    const { rows } = await db.query(query, params);
    ok(res, rows);
  } catch (err) {
    fail(res, err);
  }
}

module.exports = {
  createTrainingController,
  listTrainingsController,
  listParticipantsController,
  getTrainingController,
  updateTrainingController,
  cancelTrainingController,
  addAttendeesController,
  removeAttendeeController,
  markAttendanceController,
  getMyAssignedController,
  // Acta + FamSign
  upload,
  generateActaController,
  uploadExternalActaController,
  uploadManualSignedActaController,
  sendActaToFamSignController,
  remindMainController,
  generateAbsentActaController,
  uploadManualSignedAbsentActaController,
  sendAbsentActaToFamSignController,
  remindAbsentController,
};
